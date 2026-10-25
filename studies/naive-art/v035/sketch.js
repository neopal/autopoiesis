import {
  MIN_STROKE_POINTS,
  armStroke,
  buildFrame,
  buildTimeline,
  commitStroke,
  geometrySignature,
  liftLatestStroke,
  releaseMemory,
  strokeIsValid
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const plateField = document.querySelector('#plate-field');
const canvasWrap = document.querySelector('#plate-canvas-wrap');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
let state = buildFrame();
let sketch;
let baseLayer;
let inkLayer;
let pointerActive = false;
let pointerPoints = [];

function settledFrame() {
  let frame = buildFrame();
  for (const points of buildTimeline()) frame = commitStroke(frame, { points });
  return frame;
}

if (staticMode) state = settledFrame();

function copyState(value) {
  return JSON.parse(JSON.stringify(value));
}

function statusText() {
  return {
    idle: 'draw a bounded pressure stroke',
    'stroke-armed': 'pressure is being misread',
    'stroke-refused': 'the plate stays exact',
    'stroke-committed': 'the model invented the wrong contour',
    'stroke-lifted': 'the last error was lifted',
    'memory-released': 'the plate is released'
  }[state.interaction] || state.interaction;
}

function updateUi() {
  if (!stageEl) return;
  stageEl.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
}

function updateState(next) {
  state = next;
  updateUi();
  if (sketch) sketch.redraw();
}

function deterministicMisread() {
  const points = buildTimeline()[state.memory.length % buildTimeline().length];
  const armed = armStroke(state, { points });
  updateState(commitStroke(armed, { points }));
  plateField?.focus({ preventScroll: true });
}

function lift() {
  updateState(liftLatestStroke(state));
  plateField?.focus({ preventScroll: true });
}

function release() {
  updateState(releaseMemory());
  plateField?.focus({ preventScroll: true });
}

function pointFromEvent(event) {
  const canvas = document.querySelector('#plate-canvas');
  const rect = canvas?.getBoundingClientRect();
  if (!rect) return [0.5, 0.5];
  return [
    Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  ];
}

function commitPointerGesture() {
  const points = pointerPoints.slice();
  pointerPoints = [];
  pointerActive = false;
  if (strokeIsValid(points)) {
    const armed = armStroke(state, { points });
    updateState(commitStroke(armed, { points }));
  } else {
    updateState(commitStroke(state, { points }));
  }
}

document.querySelector('[data-action="misread"]')?.addEventListener('click', deterministicMisread);
document.querySelector('[data-action="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-action="release"]')?.addEventListener('click', release);

canvasWrap?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  pointerActive = true;
  pointerPoints = [pointFromEvent(event)];
  plateField.focus({ preventScroll: true });
  canvasWrap.setPointerCapture?.(event.pointerId);
  sketch?.redraw();
}, true);
window.addEventListener('pointermove', (event) => {
  if (!pointerActive || staticMode) return;
  const point = pointFromEvent(event);
  const previous = pointerPoints.at(-1);
  if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.008) {
    if (pointerPoints.length < 32) pointerPoints.push(point);
    sketch?.redraw();
  }
}, true);
window.addEventListener('pointerup', (event) => {
  if (!pointerActive || staticMode) return;
  pointerPoints.push(pointFromEvent(event));
  canvasWrap.releasePointerCapture?.(event.pointerId);
  commitPointerGesture();
}, true);
window.addEventListener('pointercancel', () => {
  pointerActive = false;
  pointerPoints = [];
  sketch?.redraw();
}, true);
window.addEventListener('mousemove', (event) => {
  if (!pointerActive || staticMode) return;
  const point = pointFromEvent(event);
  const previous = pointerPoints.at(-1);
  if (!previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.008) {
    if (pointerPoints.length < 32) pointerPoints.push(point);
    sketch?.redraw();
  }
}, true);
window.addEventListener('mouseup', (event) => {
  if (!pointerActive || staticMode) return;
  pointerPoints.push(pointFromEvent(event));
  commitPointerGesture();
}, true);
plateField?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicMisread();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

const PALETTE = {
  field: '#0d1214',
  fieldGlow: '#273337',
  shadow: '#071011',
  plate: '#d7d0ba',
  plateLight: '#eee7d0',
  plateShade: '#8c9188',
  ink: '#1b2425',
  coral: '#d98268',
  cyan: '#8fbdb9',
  yellow: '#e0c36d',
  absence: '#62423f',
  preview: '#e0c36d'
};

function anchorPoint(anchor, width, height) {
  const scale = Math.min(width, height) * 0.93;
  return [width * 0.5 + anchor.x * scale * 0.92, height * 0.5 + anchor.y * scale * 0.78];
}

function platePoints(width, height) {
  return state.anchors.map((anchor) => anchorPoint(anchor, width, height));
}

function drawPlateShape(layer, points, fillColour, strokeColour, weight, offset = [0, 0]) {
  layer.push();
  layer.translate(offset[0], offset[1]);
  layer.fill(fillColour);
  layer.stroke(strokeColour);
  layer.strokeWeight(weight);
  layer.beginShape();
  points.forEach(([x, y]) => layer.vertex(x, y));
  layer.endShape(layer.CLOSE);
  layer.pop();
}

function drawAperture(layer, width, height, fillColour, strokeColour, weight, offset = [0, 0]) {
  const aperture = state.aperture;
  const scale = Math.min(width, height) * 0.93;
  const x = width * 0.5 + aperture.x * scale * 0.92 + offset[0];
  const y = height * 0.5 + aperture.y * scale * 0.78 + offset[1];
  const rx = aperture.rx * scale * 0.62;
  const ry = aperture.ry * scale * 0.62;
  layer.push();
  layer.translate(x, y);
  layer.rotate(aperture.rotation);
  layer.fill(fillColour);
  layer.stroke(strokeColour);
  layer.strokeWeight(weight);
  layer.beginShape();
  for (let index = 0; index < 20; index += 1) {
    const angle = (Math.PI * 2 * index) / 20;
    const bite = index > 8 && index < 13 ? aperture.bite * rx * 0.34 : 0;
    layer.vertex(Math.cos(angle) * (rx - bite), Math.sin(angle) * ry);
  }
  layer.endShape(layer.CLOSE);
  layer.pop();
}

function stateColour(anchor) {
  return {
    pressed: PALETTE.coral,
    'false-contour': PALETTE.cyan,
    absence: PALETTE.absence,
    remembering: PALETTE.yellow
  }[anchor.state] || PALETTE.plateShade;
}

function drawAnchorMarks(layer, width, height) {
  const scale = Math.min(width, height) * 0.93;
  for (const anchor of state.anchors) {
    if (anchor.state === 'quiet') continue;
    const [x, y] = anchorPoint(anchor, width, height);
    const radius = Math.max(8, scale * (0.022 + anchor.crease * 0.015));
    layer.push();
    layer.translate(x, y);
    layer.rotate(anchor.fold);
    layer.noFill();
    layer.stroke(stateColour(anchor));
    layer.strokeWeight(Math.max(1.1, scale * 0.006));
    layer.arc(0, 0, radius * 2.2, radius * 0.92, -0.9, 2.3);
    layer.arc(0, 0, radius * 1.35, radius * 2.8, 2.4, 5.1);
    if (anchor.state === 'absence') {
      layer.stroke(PALETTE.plateLight);
      layer.strokeWeight(Math.max(1, scale * 0.004));
      layer.line(-radius * 0.8, 0, radius * 0.8, 0);
    }
    layer.pop();
  }
}

function drawRibs(layer, points, width, height) {
  const centre = [width * 0.5, height * 0.5];
  const scale = Math.min(width, height) * 0.93;
  layer.push();
  layer.noFill();
  layer.stroke(PALETTE.plateShade);
  layer.strokeWeight(Math.max(0.7, scale * 0.002));
  for (let index = 0; index < points.length; index += 2) {
    const [x, y] = points[index];
    const [nextX, nextY] = points[(index + 1) % points.length];
    layer.beginShape();
    layer.vertex(x * 0.82 + centre[0] * 0.18, y * 0.82 + centre[1] * 0.18);
    layer.vertex((nextX + x) * 0.48 + centre[0] * 0.04, (nextY + y) * 0.48 + centre[1] * 0.04);
    layer.endShape();
  }
  layer.pop();
}

function drawPreview(layer, width, height) {
  if (pointerPoints.length < 2) return;
  layer.push();
  layer.noFill();
  layer.stroke(PALETTE.preview);
  layer.strokeWeight(Math.max(1.2, Math.min(width, height) * 0.006));
  layer.beginShape();
  pointerPoints.forEach(([x, y]) => layer.vertex(x * width, y * height));
  layer.endShape();
  layer.pop();
}

function render(p) {
  const width = p.width;
  const height = p.height;
  const points = platePoints(width, height);
  const scale = Math.min(width, height);

  baseLayer.clear();
  baseLayer.background(PALETTE.field);
  baseLayer.noStroke();
  baseLayer.fill(PALETTE.fieldGlow);
  baseLayer.ellipse(width * 0.24, height * 0.25, scale * 0.64, scale * 0.34);
  baseLayer.fill(PALETTE.shadow);
  baseLayer.ellipse(width * 0.75, height * 0.76, scale * 0.88, scale * 0.38);
  drawPlateShape(baseLayer, points, PALETTE.shadow, PALETTE.shadow, 0, [scale * 0.025, scale * 0.04]);
  drawPlateShape(baseLayer, points, PALETTE.plate, PALETTE.ink, Math.max(1, scale * 0.009));
  drawRibs(baseLayer, points, width, height);
  drawAperture(baseLayer, width, height, PALETTE.field, PALETTE.coral, Math.max(1.2, scale * 0.008));
  drawAnchorMarks(baseLayer, width, height);

  inkLayer.clear();
  drawAperture(inkLayer, width, height, 'rgba(0,0,0,0)', PALETTE.plateLight, Math.max(0.7, scale * 0.003), [scale * 0.012, scale * 0.018]);
  drawPreview(inkLayer, width, height);

  p.clear();
  p.image(baseLayer, 0, 0);
  p.image(inkLayer, 0, 0);
}

sketch = new window.p5((p) => {
  p.setup = () => {
    window.p5.disableFriendlyErrors = true;
    const width = Math.max(320, canvasWrap?.clientWidth || 900);
    const height = Math.max(188, Math.round(width * 820 / 1400));
    p.pixelDensity(1);
    const canvas = p.createCanvas(width, height);
    canvas.id('plate-canvas');
    baseLayer = p.createGraphics(width, height);
    inkLayer = p.createGraphics(width, height);
    p.noLoop();
    p.frameRate(30);
    p.redraw();
    window._p5Ready = true;
  };
  p.draw = () => render(p);
  p.windowResized = () => {
    const width = Math.max(320, canvasWrap?.clientWidth || 900);
    const height = Math.max(188, Math.round(width * 820 / 1400));
    p.resizeCanvas(width, height);
    baseLayer = p.createGraphics(width, height);
    inkLayer = p.createGraphics(width, height);
    p.redraw();
  };
}, canvasWrap);

window.__mutineNaiveV035 = {
  getState: () => copyState(state),
  geometrySignature: () => geometrySignature(state),
  getPointerPoints: () => copyState(pointerPoints),
  misread: deterministicMisread,
  lift,
  release
};
updateUi();
