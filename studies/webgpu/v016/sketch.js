import {
  STAGES,
  applyKnot,
  buildTimeline,
  defaultGesture,
  geometrySignature,
  isMeaningfulGesture,
  liftLatestKnot,
  releaseKnots
} from './engine.mjs';

const canvas = document.querySelector('#field');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true });
const fallback = gl ? null : canvas.getContext('2d', { alpha: false });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  dragging: false,
  gesture: null,
  view: { width: 1, height: 1, dpr: 1 },
  rotation: 0
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');

const vertexSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;
in float a_pointSize;
out vec4 v_color;
uniform float u_pointMode;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  gl_PointSize = mix(1.0, a_pointSize, u_pointMode);
  v_color = a_color;
}`;
const fragmentSource = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;
uniform float u_pointMode;
void main() {
  if (u_pointMode > 0.5 && distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;
  outColor = v_color;
}`;

const compileShader = (type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('WebGL2 shader compilation failed');
  return shader;
};

const program = gl ? gl.createProgram() : null;
const locations = {};
if (gl) {
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL2 program linking failed');
  locations.position = gl.getAttribLocation(program, 'a_position');
  locations.color = gl.getAttribLocation(program, 'a_color');
  locations.pointSize = gl.getAttribLocation(program, 'a_pointSize');
  locations.pointMode = gl.getUniformLocation(program, 'u_pointMode');
}

const linePositionBuffer = gl?.createBuffer();
const lineColorBuffer = gl?.createBuffer();
const lineSizeBuffer = gl?.createBuffer();
const pointPositionBuffer = gl?.createBuffer();
const pointColorBuffer = gl?.createBuffer();
const pointSizeBuffer = gl?.createBuffer();

const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
  canvas.width = Math.floor(state.view.width * dpr);
  canvas.height = Math.floor(state.view.height * dpr);
  render(performance.now());
};

const localPoint = (event) => {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0.06, Math.min(0.94, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.08, Math.min(0.92, (event.clientY - rect.top) / rect.height))
  };
};

const project = (node, rotation = state.rotation) => {
  const yaw = 0.62 + rotation;
  const pitch = -0.26 + Math.sin(rotation * 0.7) * 0.04;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const x1 = node.x * cosYaw - node.z * sinYaw;
  const z1 = node.x * sinYaw + node.z * cosYaw;
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const y1 = node.y * cosPitch - z1 * sinPitch;
  const z2 = node.y * sinPitch + z1 * cosPitch;
  const perspective = 1.18 / (1.56 - z2);
  return { x: x1 * perspective, y: y1 * perspective * 0.9, z: z2 };
};

const gestureNode = (point) => {
  const angle = (point.x * Math.PI * 2.0) + Math.PI * 0.12;
  return { x: Math.cos(angle) * 0.31, y: (point.y - 0.5) * 1.28, z: Math.sin(angle) * 0.31 };
};

const colors = {
  base: [0.35, 0.66, 0.68, 0.38],
  brace: [0.42, 0.54, 0.62, 0.25],
  bridge: [0.91, 0.62, 0.31, 0.96],
  node: [0.73, 0.91, 0.83, 0.84],
  graft: [0.94, 0.47, 0.38, 0.98],
  ghost: [0.95, 0.75, 0.37, 0.72]
};

const colorForNode = (node) => {
  if (node.graft > 0) return colors.graft;
  const strandTint = [0.72, 0.9, 0.82, 0.82];
  strandTint[0] -= node.strand * 0.055;
  strandTint[2] += node.strand * 0.025;
  return strandTint;
};

const drawFallback = () => {
  if (!fallback) return;
  const { width, height, dpr } = state.view;
  fallback.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gradient = fallback.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#07131d');
  gradient.addColorStop(0.52, '#0c1b25');
  gradient.addColorStop(1, '#040a11');
  fallback.fillStyle = gradient;
  fallback.fillRect(0, 0, width, height);
  const toCanvas = (node) => {
    const p = project(node);
    return { x: width * (0.5 + p.x * 0.42), y: height * (0.5 - p.y * 0.42) };
  };
  for (const entry of state.frame.graph.edges) {
    const a = toCanvas(state.frame.graph.nodes[entry.edge[0]]);
    const b = toCanvas(state.frame.graph.nodes[entry.edge[1]]);
    fallback.strokeStyle = entry.type === 'bridge' ? '#e7a353' : entry.type === 'brace' ? 'rgba(119,162,176,.32)' : 'rgba(110,201,192,.46)';
    fallback.lineWidth = entry.type === 'bridge' ? 2.2 : 1;
    fallback.beginPath();
    fallback.moveTo(a.x, a.y);
    fallback.lineTo(b.x, b.y);
    fallback.stroke();
  }
  for (const node of state.frame.graph.nodes) {
    const p = toCanvas(node);
    fallback.fillStyle = node.graft ? '#e97861' : '#bce4d5';
    fallback.beginPath();
    fallback.arc(p.x, p.y, node.graft ? 3.4 : 2.2, 0, Math.PI * 2);
    fallback.fill();
  }
};

const drawWebGL = () => {
  const { width, height, dpr } = state.view;
  gl.viewport(0, 0, Math.floor(width * dpr), Math.floor(height * dpr));
  gl.clearColor(0.018, 0.039, 0.063, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(program);

  const linePositions = [];
  const lineColors = [];
  const lineSizes = [];
  for (const entry of state.frame.graph.edges) {
    const a = project(state.frame.graph.nodes[entry.edge[0]]);
    const b = project(state.frame.graph.nodes[entry.edge[1]]);
    const color = entry.type === 'bridge' ? colors.bridge : entry.type === 'brace' ? colors.brace : colors.base;
    linePositions.push(a.x, a.y, b.x, b.y);
    lineColors.push(...color, ...color);
    lineSizes.push(1, 1);
  }
  if (state.dragging && state.gesture && !blindMode) {
    const a = project(gestureNode(state.gesture.start));
    const b = project(gestureNode(state.gesture.end));
    linePositions.push(a.x, a.y, b.x, b.y);
    lineColors.push(...colors.ghost, ...colors.ghost);
    lineSizes.push(1.8, 1.8);
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, linePositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(linePositions), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locations.position);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineColors), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locations.color);
  gl.vertexAttribPointer(locations.color, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, lineSizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineSizes), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(locations.pointSize);
  gl.vertexAttribPointer(locations.pointSize, 1, gl.FLOAT, false, 0, 0);
  gl.uniform1f(locations.pointMode, 0);
  gl.drawArrays(gl.LINES, 0, linePositions.length / 2);

  const pointPositions = [];
  const pointColors = [];
  const pointSizes = [];
  for (const node of state.frame.graph.nodes) {
    const p = project(node);
    const color = colorForNode(node);
    pointPositions.push(p.x, p.y);
    pointColors.push(...color);
    pointSizes.push(node.graft > 0 ? 6.2 : 3.2 + Math.max(0, p.z) * 1.5);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, pointPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointPositions), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, pointColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointColors), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(locations.color, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, pointSizeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pointSizes), gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(locations.pointSize, 1, gl.FLOAT, false, 0, 0);
  gl.uniform1f(locations.pointMode, 1);
  gl.drawArrays(gl.POINTS, 0, pointPositions.length / 2);
};

const updateReadout = () => {
  stageElement.textContent = `stage ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${state.frame.memory.length} ${state.frame.memory.length === 1 ? 'knot' : 'knots'}`;
  rendererElement.textContent = gl ? 'WEBGL2 / TOPOLOGY CHECK' : 'CANVAS / TOPOLOGY FALLBACK';
};

const render = (now = performance.now()) => {
  if (!staticMode && !reducedMotion) state.rotation = now * 0.00016;
  if (gl) drawWebGL();
  else drawFallback();
  updateReadout();
};

const commitGesture = (gesture) => {
  if (!isMeaningfulGesture(gesture)) return;
  state.frame = applyKnot(state.frame, gesture);
  render();
};
const spliceDefault = () => commitGesture(defaultGesture());
const lift = () => { state.frame = liftLatestKnot(state.frame); render(); };
const release = () => { state.frame = releaseKnots(); render(); };

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  state.dragging = true;
  state.gesture = { start: localPoint(event), end: localPoint(event) };
  canvas.setPointerCapture?.(event.pointerId);
  render();
});
canvas.addEventListener('pointermove', (event) => {
  if (!state.dragging || !state.gesture) return;
  state.gesture.end = localPoint(event);
  render();
});
canvas.addEventListener('pointerup', (event) => {
  if (!state.dragging || !state.gesture) return;
  state.gesture.end = localPoint(event);
  const gesture = state.gesture;
  state.dragging = false;
  state.gesture = null;
  canvas.releasePointerCapture?.(event.pointerId);
  commitGesture(gesture);
});
canvas.addEventListener('pointercancel', () => { state.dragging = false; state.gesture = null; render(); });
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    spliceDefault();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

document.querySelector('[data-gesture="splice"]').addEventListener('click', spliceDefault);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__MUTINE_STATE__ = {
  get frame() { return state.frame; },
  get signature() { return geometrySignature(state.frame); },
  splice: commitGesture,
  lift,
  release,
  defaultGesture: spliceDefault
};

resize();
window.__MUTINE_READY__ = true;

const animate = (now) => {
  render(now);
  window.requestAnimationFrame(animate);
};
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
