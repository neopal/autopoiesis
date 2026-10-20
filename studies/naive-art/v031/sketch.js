import {
  MIN_PAIR_DWELL,
  TILE_COUNT,
  buildFrame,
  buildTimeline,
  commitAttention,
  geometrySignature,
  liftLatestAttention,
  releaseMemory
} from './engine.mjs';

const canvas = document.querySelector('#witness-canvas');
const field = document.querySelector('#orbit-field');
const stageNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const statusNode = document.querySelector('[data-status]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const LOGICAL_WIDTH = 1200;
const LOGICAL_HEIGHT = 760;
const pointerMap = new Map();

let gl;
let program;
let fillBuffer;
let lineBuffer;
let state = buildFrame();
let pendingFirst = null;
let livePair = null;
let statusOverride = '';
let lastTilePoints = [];

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  uniform vec2 u_resolution;
  varying vec4 v_color;
  void main() {
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clip = zeroToOne * 2.0 - 1.0;
    clip.y = -clip.y;
    gl_Position = vec4(clip, 0.0, 1.0);
    v_color = a_color;
  }
`;
const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec4 v_color;
  void main() { gl_FragColor = v_color; }
`;

const MARKS = {
  arc: [[-0.55, -0.1], [-0.3, -0.48], [0.18, -0.5], [0.52, -0.15], [0.26, 0.42], [-0.32, 0.5]],
  slash: [[-0.48, 0.58], [0.42, -0.6]],
  loop: [[-0.42, -0.05], [-0.2, -0.46], [0.3, -0.35], [0.42, 0.18], [0.06, 0.49], [-0.34, 0.18], [-0.42, -0.05]],
  cross: [[-0.46, -0.46], [0.46, 0.46], [-0.44, 0.45], [0.44, -0.46]],
  dot: [[-0.04, -0.46], [0.04, 0.46]],
  step: [[-0.5, 0.42], [-0.12, 0.42], [-0.12, -0.04], [0.34, -0.04], [0.34, -0.46]],
  hook: [[0.42, -0.48], [-0.12, -0.48], [-0.42, -0.16], [-0.22, 0.4], [0.34, 0.42]]
};
const QUIET_COLORS = [[0.82, 0.67, 0.42], [0.48, 0.67, 0.72], [0.82, 0.45, 0.33], [0.58, 0.72, 0.45], [0.75, 0.53, 0.72], [0.88, 0.72, 0.38], [0.41, 0.64, 0.68]];

function shader(type, source) {
  const result = gl.createShader(type);
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
  return result;
}

function initWebGL() {
  gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('native WebGL is unavailable');
  const vertex = shader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  fillBuffer = gl.createBuffer();
  lineBuffer = gl.createBuffer();
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function tileCenter(tile) {
  return {
    x: LOGICAL_WIDTH * (0.5 + tile.x * 0.5),
    y: LOGICAL_HEIGHT * (0.5 + tile.y * 0.62)
  };
}

function transformPoint(tile, point, multiplier = 1) {
  const center = tileCenter(tile);
  const width = 142 * tile.scale * multiplier;
  const height = 108 * tile.scale * multiplier;
  const tiltX = 1 - tile.rotY * 0.14;
  const tiltY = 1 - tile.rotX * 0.12;
  const cos = Math.cos(tile.rotZ);
  const sin = Math.sin(tile.rotZ);
  const px = point[0] * width * tiltX;
  const py = point[1] * height * tiltY;
  return [center.x + px * cos - py * sin, center.y + px * sin + py * cos];
}

function polygonFor(tile, multiplier = 1) {
  const notch = tile.state === 'vacant-witness' ? Math.min(0.88, tile.notch + 0.18) : tile.notch;
  const points = [
    [-0.95, -0.72], [-0.22, -0.96], [0.9, -0.57], [0.7, 0.12 - notch * 0.22],
    [0.22, 0.9], [-0.72, 0.7], [-0.96, 0.1 + notch * 0.16]
  ];
  return points.map((point) => transformPoint(tile, point, multiplier));
}

function colorFor(tile, alpha = 0.94) {
  const base = QUIET_COLORS[tile.id % QUIET_COLORS.length];
  if (tile.state === 'averted') return [base[0] * 0.72, base[1] * 0.8, base[2] * 0.9, alpha];
  if (tile.state === 'counterfeit') return [0.91, 0.35 + base[1] * 0.22, 0.22 + base[2] * 0.32, alpha];
  if (tile.state === 'vacant-witness') return [0.26, 0.35, 0.42, alpha];
  return [base[0], base[1], base[2], alpha];
}

function pushTriangle(target, a, b, c, color) {
  target.push(a[0], a[1], ...color, b[0], b[1], ...color, c[0], c[1], ...color);
}

function pushPolygon(target, points, color) {
  const center = points.reduce((sum, point) => [sum[0] + point[0] / points.length, sum[1] + point[1] / points.length], [0, 0]);
  for (let index = 0; index < points.length; index += 1) {
    pushTriangle(target, center, points[index], points[(index + 1) % points.length], color);
  }
}

function pushLine(target, a, b, color) {
  target.push(a[0], a[1], ...color, b[0], b[1], ...color);
}

function buildGeometry() {
  const fills = [];
  const lines = [];
  const background = [0.03, 0.07, 0.12, 1];
  pushPolygon(fills, [[0, 0], [LOGICAL_WIDTH, 0], [LOGICAL_WIDTH, LOGICAL_HEIGHT], [0, LOGICAL_HEIGHT]], background);

  for (let ring = 0; ring < 2; ring += 1) {
    const ringPoints = [];
    const radiusX = 272 + ring * 76;
    const radiusY = 178 + ring * 55;
    for (let index = 0; index < 49; index += 1) {
      const angle = (index / 48) * Math.PI * 2;
      ringPoints.push([LOGICAL_WIDTH / 2 + Math.cos(angle) * radiusX, LOGICAL_HEIGHT / 2 + Math.sin(angle) * radiusY]);
      if (index > 0) pushLine(lines, ringPoints[index - 1], ringPoints[index], [0.24, 0.39, 0.45, ring === 0 ? 0.16 : 0.08]);
    }
  }
  for (let index = 0; index < 42; index += 1) {
    const x = 48 + ((index * 173) % 1100);
    const y = 38 + ((index * 97) % 680);
    const r = index % 3 === 0 ? 2.4 : 1.2;
    pushLine(lines, [x - r, y], [x + r, y], [0.78, 0.68, 0.46, 0.22]);
  }

  lastTilePoints = [];
  state.tiles.forEach((tile) => {
    const center = tileCenter(tile);
    lastTilePoints.push(center);
    pushPolygon(fills, polygonFor(tile, 1.12), [0.01, 0.02, 0.04, 0.54]);
  });
  state.tiles.forEach((tile) => {
    const polygon = polygonFor(tile);
    pushPolygon(fills, polygon, colorFor(tile));
    const mark = MARKS[tile.mark] ?? MARKS.arc;
    for (let index = 1; index < mark.length; index += 1) {
      pushLine(lines, transformPoint(tile, mark[index - 1], 0.7), transformPoint(tile, mark[index], 0.7), [0.05, 0.08, 0.11, tile.state === 'vacant-witness' ? 0.7 : 0.9]);
    }
    const edgeColor = tile.state === 'vacant-witness' ? [0.86, 0.53, 0.36, 0.8] : [0.96, 0.9, 0.72, 0.62];
    for (let index = 0; index < polygon.length; index += 1) pushLine(lines, polygon[index], polygon[(index + 1) % polygon.length], edgeColor);
    if (tile.state === 'vacant-witness') {
      const vacancy = polygonFor({ ...tile, scale: tile.scale * 0.43, rotZ: tile.rotZ - 0.3 }, 1);
      pushPolygon(fills, vacancy, [0.03, 0.07, 0.11, 0.88]);
    }
  });
  return { fills, lines };
}

function drawBuffer(buffer, data, mode) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
  const position = gl.getAttribLocation(program, 'a_position');
  const color = gl.getAttribLocation(program, 'a_color');
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(color);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
  gl.drawArrays(mode, 0, data.length / 6);
}

function resize() {
  const width = Math.max(320, Math.floor(canvas.getBoundingClientRect().width));
  const height = Math.max(202, Math.floor(width * LOGICAL_HEIGHT / LOGICAL_WIDTH));
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
  render();
}

function render() {
  if (!gl) return;
  gl.useProgram(program);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), LOGICAL_WIDTH, LOGICAL_HEIGHT);
  gl.clearColor(0.02, 0.04, 0.08, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const geometry = buildGeometry();
  drawBuffer(fillBuffer, geometry.fills, gl.TRIANGLES);
  drawBuffer(lineBuffer, geometry.lines, gl.LINES);
  stageNode.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryNode.textContent = `${state.memory.length} retained`;
  statusNode.textContent = statusOverride || statusFor(state.interaction);
  field.dataset.memory = String(state.memory.length);
  field.dataset.signature = geometrySignature(state);
}

function statusFor(interaction) {
  return {
    idle: 'choose two witnesses · hold until they misread',
    'attention-refused': 'the pair was too light, too far, or the same place',
    'attention-committed': 'one turned · one copied · one went vacant',
    'attention-lifted': 'last misread lifted · orbit restored',
    'memory-released': 'the seeded orbit is quiet'
  }[interaction] || interaction;
}

function tileAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * LOGICAL_WIDTH;
  const y = (clientY - rect.top) / rect.height * LOGICAL_HEIGHT;
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  state.tiles.forEach((tile, index) => {
    const center = tileCenter(tile);
    const candidate = (center.x - x) ** 2 + (center.y - y) ** 2;
    if (candidate < distance) { distance = candidate; best = index; }
  });
  return best;
}

function tileDistance(first, second) {
  const a = tileCenter(state.tiles[first]);
  const b = tileCenter(state.tiles[second]);
  return Math.hypot(a.x - b.x, a.y - b.y) / LOGICAL_WIDTH;
}

function commitPair(pair) {
  const distance = pair.distance ?? tileDistance(pair.first, pair.second);
  const dwell = pair.dwell ?? MIN_PAIR_DWELL + 80;
  const next = commitAttention(state, { first: pair.first, second: pair.second, distance, dwell });
  if (next.interaction === 'attention-refused') {
    statusOverride = 'the pair was refused · two distinct places must stay near and held';
  } else {
    statusOverride = '';
    pendingFirst = null;
  }
  state = next;
  render();
}

function deterministicPair() {
  const next = timeline[state.memory.length % timeline.length];
  commitPair(next);
}

function selectTile(index) {
  const tile = Math.max(0, Math.min(TILE_COUNT - 1, Number(index) || 0));
  if (pendingFirst === null) {
    pendingFirst = tile;
    statusOverride = `witness ${tile + 1} held in attention · choose another`;
  } else if (pendingFirst === tile) {
    statusOverride = 'the same witness cannot make a pair';
  } else {
    livePair = { first: pendingFirst, second: tile, startedAt: performance.now(), distance: tileDistance(pendingFirst, tile) };
    statusOverride = `witnesses ${pendingFirst + 1} + ${tile + 1} paired · hold until they yield`;
  }
  render();
}

function pointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  const tile = tileAt(event.clientX, event.clientY);
  const startedAt = performance.now();
  pointerMap.set(event.pointerId, { tile, startedAt });
  canvas.setPointerCapture?.(event.pointerId);
  if (pointerMap.size === 1) {
    if (pendingFirst === null) pendingFirst = tile;
    else if (pendingFirst !== tile) livePair = { first: pendingFirst, second: tile, startedAt, distance: tileDistance(pendingFirst, tile) };
  } else {
    const points = [...pointerMap.values()];
    if (points[0].tile !== points[1].tile) livePair = { first: points[0].tile, second: points[1].tile, startedAt, distance: tileDistance(points[0].tile, points[1].tile) };
  }
  render();
}

function pointerUp(event) {
  if (!pointerMap.has(event.pointerId)) return;
  event.preventDefault();
  const pointer = pointerMap.get(event.pointerId);
  const now = performance.now();
  if (livePair) {
    const dwell = now - livePair.startedAt;
    if (dwell >= MIN_PAIR_DWELL) commitPair({ ...livePair, dwell });
    else statusOverride = 'too light · the witnesses forgot the pair';
  } else if (pointer && pendingFirst === pointer.tile) {
    statusOverride = `witness ${pointer.tile + 1} selected · choose a distinct second witness`;
  }
  pointerMap.delete(event.pointerId);
  if (!pointerMap.size) livePair = null;
  canvas.releasePointerCapture?.(event.pointerId);
  render();
}

function lift() {
  pointerMap.clear();
  livePair = null;
  state = liftLatestAttention(state);
  statusOverride = '';
  render();
}

function release() {
  pointerMap.clear();
  livePair = null;
  pendingFirst = null;
  state = releaseMemory(state);
  statusOverride = '';
  render();
}

document.querySelector('[data-action="pair"]').addEventListener('click', deterministicPair);
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', release);
canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', (event) => { pointerMap.delete(event.pointerId); livePair = null; statusOverride = 'the pair dissolved before it yielded'; render(); });
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); deterministicPair(); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') { event.preventDefault(); release(); }
  else if (/^[1-7]$/.test(event.key)) { event.preventDefault(); selectTile(Number(event.key) - 1); }
});
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's' && !event.metaKey && !event.ctrlKey) {
    const link = document.createElement('a');
    link.download = 'mutine-naive-v031.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
});

window.__mutineNaiveV031 = {
  getState: () => structuredClone(state),
  geometrySignature: () => geometrySignature(state),
  pair: deterministicPair,
  lift,
  release,
  selectTile,
  tilePoints: () => structuredClone(lastTilePoints),
  minDwell: MIN_PAIR_DWELL,
  reducedMotion
};

initWebGL();
resize();
window._p5Ready = true;
