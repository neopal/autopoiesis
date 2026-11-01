import {
  buildField,
  buildTimeline,
  geometrySignature,
  armSide,
  commitCounterfield,
  liftLatest,
  releaseField
} from './engine.mjs';

const VERTEX_SHADER = `
  attribute vec3 a_position;
  attribute vec3 a_color;
  uniform mat4 u_matrix;
  varying vec3 v_color;
  void main() {
    gl_Position = u_matrix * vec4(a_position, 1.0);
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec3 v_color;
  uniform float u_alpha;
  void main() {
    gl_FragColor = vec4(v_color, u_alpha);
  }
`;

const SEGMENTS = 24;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field;
let stageNode;
let canvasNode;
let readoutNode;
let memoryNode;
let stateNode;
let hintNode;
let interactionNode;
let gl;
let program;
let positionBuffer;
let colorBuffer;
let positionLocation;
let colorLocation;
let matrixLocation;
let alphaLocation;
let lastFrame = 0;
let cursorSide = 'left';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function shader(kind, source) {
  const unit = gl.createShader(kind);
  gl.shaderSource(unit, source);
  gl.compileShader(unit);
  if (!gl.getShaderParameter(unit, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(unit));
  return unit;
}

function setupProgram() {
  const vertex = shader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  positionLocation = gl.getAttribLocation(program, 'a_position');
  colorLocation = gl.getAttribLocation(program, 'a_color');
  matrixLocation = gl.getUniformLocation(program, 'u_matrix');
  alphaLocation = gl.getUniformLocation(program, 'u_alpha');
  positionBuffer = gl.createBuffer();
  colorBuffer = gl.createBuffer();
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[row + column * 4] =
        a[row] * b[column * 4] +
        a[row + 4] * b[column * 4 + 1] +
        a[row + 8] * b[column * 4 + 2] +
        a[row + 12] * b[column * 4 + 3];
    }
  }
  return out;
}

function perspective(fov, aspect, near, far) {
  const scale = 1 / Math.tan(fov / 2);
  return new Float32Array([
    scale / aspect, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0
  ]);
}

function rotateX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function rotateY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function translate(x, y, z) {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
}

function pointFor(ribbon, segment) {
  const u = segment / (SEGMENTS - 1) - 0.5;
  const crown = Math.sin((u + 0.5) * Math.PI);
  const angle = ribbon.phase + field.volume.twist * (u * 1.85) + ribbon.curve * crown + field.volume.yaw * (u + 0.5);
  const radius = ribbon.radius * (0.73 + field.volume.fold * crown * 0.55);
  return {
    x: Math.cos(angle) * radius * 1.14,
    y: u * 2.15 + Math.sin(angle * 1.35 + ribbon.phase) * ribbon.lift * 0.42 + field.volume.rise * Math.sin(u * Math.PI),
    z: Math.sin(angle) * radius * 0.86 + ribbon.depth * 0.08 * Math.cos(u * Math.PI * 2)
  };
}

function paletteFor(index, segment, side) {
  const phase = index / field.ribbons.length;
  const shade = 0.58 + 0.32 * Math.sin(segment / (SEGMENTS - 1) * Math.PI + phase * 9);
  const cyan = [0.34, 0.82, 0.78];
  const coral = [1.0, 0.39, 0.24];
  const bone = [0.82, 0.77, 0.64];
  const source = side < 0.33 ? cyan : side > 0.67 ? coral : bone;
  return source.map((value) => value * shade);
}

function pushVertex(positions, colors, point, color) {
  positions.push(point.x, point.y, point.z);
  colors.push(color[0], color[1], color[2]);
}

function geometryBuffers() {
  const positions = [];
  const colors = [];
  const lines = [];
  const lineColors = [];
  const points = field.ribbons.map((ribbon) => Array.from({ length: SEGMENTS }, (_, segment) => pointFor(ribbon, segment)));

  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    for (let segment = 0; segment < SEGMENTS - 1; segment += 1) {
      const a = points[index][segment];
      const b = points[nextIndex][segment];
      const c = points[nextIndex][segment + 1];
      const d = points[index][segment + 1];
      const side = index / points.length;
      const first = paletteFor(index, segment, side);
      const second = paletteFor(nextIndex, segment + 1, nextIndex / points.length);
      pushVertex(positions, colors, a, first);
      pushVertex(positions, colors, b, second.map((value) => value * 0.72));
      pushVertex(positions, colors, c, second);
      pushVertex(positions, colors, a, first);
      pushVertex(positions, colors, c, second);
      pushVertex(positions, colors, d, first.map((value) => value * 0.88));
    }
    for (let segment = 0; segment < SEGMENTS - 1; segment += 1) {
      const a = points[index][segment];
      const b = points[index][segment + 1];
      lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const lineColor = paletteFor(index, segment, index / points.length).map((value) => Math.min(1, value * 1.2));
      lineColors.push(...lineColor, ...lineColor);
    }
  }
  return {
    surfaces: { positions: new Float32Array(positions), colors: new Float32Array(colors) },
    lines: { positions: new Float32Array(lines), colors: new Float32Array(lineColors) }
  };
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.floor(canvasNode.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvasNode.clientHeight * ratio));
  if (canvasNode.width !== width || canvasNode.height !== height) {
    canvasNode.width = width;
    canvasNode.height = height;
    gl.viewport(0, 0, width, height);
  }
}

function drawFrame(now = 0) {
  resize();
  const width = canvasNode.width;
  const height = canvasNode.height;
  const aspect = width / Math.max(1, height);
  const drift = staticMode || reducedMotion ? 0 : now * 0.000035;
  const projection = perspective(Math.PI / 3.2, aspect, 0.1, 20);
  const view = multiply(translate(0, 0, -4.3), multiply(rotateY(field.volume.yaw + drift), rotateX(field.volume.pitch - drift * 0.55)));
  const matrix = multiply(projection, view);
  const buffers = geometryBuffers();

  gl.clearColor(0.018, 0.028, 0.043, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniformMatrix4fv(matrixLocation, false, matrix);
  gl.uniform1f(alphaLocation, 0.88);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.surfaces.positions, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.surfaces.colors, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, buffers.surfaces.positions.length / 3);

  gl.uniform1f(alphaLocation, 0.92);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.lines.positions, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, buffers.lines.colors, gl.DYNAMIC_DRAW);
  gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.LINES, 0, buffers.lines.positions.length / 3);

  if (!staticMode && !reducedMotion) requestAnimationFrame(drawFrame);
}

function textFor(stage) {
  return {
    quiet: 'the field is waiting for a pair',
    'armed / left': 'left pressure is armed; the volume holds',
    'armed / right': 'right pressure is armed; the volume holds',
    'paired / ready': 'opposition is ready to produce the field',
    'produced / counterfield': 'the unequal pair rewrote the whole volume',
    'lifted / exact': 'the last counterfield was lifted exactly',
    released: 'the volume is quiet again'
  }[stage] ?? 'the field is deciding';
}

function render(stage = field.interaction) {
  drawFrame(lastFrame);
  const offers = field.offers.map((offer) => offer.side).join(' + ') || 'none';
  readoutNode.textContent = `${stage} / ${String(field.revision).padStart(2, '0')} · ${offers}`;
  memoryNode.textContent = `${field.memory.length} production${field.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = textFor(stage);
  interactionNode.textContent = textFor(stage);
  hintNode.textContent = field.offers.length === 0 ? 'arm left and right · then produce the counterfield' : field.offers.length === 1 ? 'arm the opposite side · the volume still holds' : 'produce the counterfield · let the field rewrite itself';
}

function arm(side, amount = 0.72) {
  if (staticMode) return field;
  cursorSide = side;
  field = armSide(field, { side, amount });
  stageNode.focus({ preventScroll: true });
  render(field.interaction);
  return field;
}

function produce() {
  if (staticMode) return { accepted: false, field };
  const result = commitCounterfield(field);
  field = result.field;
  render(result.accepted ? 'produced / counterfield' : field.interaction);
  return result;
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  render('lifted / exact');
  return field;
}

function release() {
  if (staticMode) return field;
  field = releaseField();
  cursorSide = 'left';
  render('released');
  return field;
}

function sideFromEvent(event) {
  const rect = canvasNode.getBoundingClientRect();
  return event.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
}

function amountFromEvent(event) {
  const rect = canvasNode.getBoundingClientRect();
  const distance = Math.abs(event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
  return Number(clamp(0.38 + distance * 0.54, 0.38, 0.92).toFixed(2));
}

function bindControls() {
  stageNode.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      arm('left', 0.68);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      arm('right', 0.82);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      produce();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
      event.preventDefault();
      release();
    }
  });
  canvasNode.addEventListener('pointerdown', (event) => {
    if (staticMode) return;
    event.preventDefault();
    canvasNode.setPointerCapture?.(event.pointerId);
    arm(sideFromEvent(event), amountFromEvent(event));
  });
  canvasNode.addEventListener('pointerup', (event) => {
    if (canvasNode.hasPointerCapture?.(event.pointerId)) canvasNode.releasePointerCapture(event.pointerId);
  });
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'left') arm('left', 0.68);
      if (button.dataset.action === 'right') arm('right', 0.82);
      if (button.dataset.action === 'produce') produce();
      if (button.dataset.action === 'lift') lift();
      if (button.dataset.action === 'release') release();
    });
  });
}

function setup() {
  stageNode = document.querySelector('[data-volume-stage]');
  canvasNode = document.querySelector('[data-volume-canvas]');
  readoutNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  interactionNode = document.querySelector('[data-interaction-state]');
  gl = canvasNode.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
  if (!gl) {
    stateNode.textContent = 'WebGL is unavailable in this browser';
    interactionNode.textContent = 'WebGL is unavailable in this browser';
    return;
  }
  setupProgram();
  field = staticMode ? buildTimeline().at(-1) : buildField();
  bindControls();
  render(staticMode ? 'produced / counterfield' : 'quiet');
  window.addEventListener('resize', () => render(field.interaction));
  window.__mutinePortraitV039 = {
    getState: () => structuredClone(field),
    arm: (side, amount = 0.72) => arm(side, amount),
    produce,
    lift,
    release,
    geometrySignature: () => geometrySignature(field),
    context: gl
  };
  window.dispatchEvent(new CustomEvent('mutine:ready', { detail: 'portrait-v039' }));
}

setup();
