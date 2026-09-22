import {
  STAGES,
  applyPressure,
  buildFrame,
  buildTimeline,
  liftLatestPressure,
  releasePressures
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const rendererReadout = document.querySelector('[data-renderer]');
const pressControl = document.querySelector('[data-gesture="press"]');
const liftControl = document.querySelector('[data-gesture="lift"]');
const releaseControl = document.querySelector('[data-gesture="release"]');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || location.search.includes('interaction=1');
const staticMode = params.get('static') === '1' || location.search.includes('static=1') || location.hash === '#static';
const blindMode = params.has('blind') || location.hash === '#blind' || document.documentElement.classList.contains('blind-mode');
const frozen = reducedMotion || staticMode;
const timeline = buildTimeline(STAGES);
const VIEW_WIDTH = 1260;
const VIEW_HEIGHT = 860;
const STAGE_MS = 3600;
const hasWebGPU = Boolean(navigator.gpu);

let startedAt = performance.now();
let currentStage = frozen ? timeline.length - 1 : 0;
let paused = frozen || interactivePreview;
let interactionFrame = null;
let draftPath = [];
let drawing = false;
let lastPointer = null;
let width = 1;
let height = 1;
let pixelRatio = 1;

const colors = {
  void: '#0c1018',
  deep: '#121c2a',
  grid: '#7690ac',
  ink: '#edf0e8',
  ice: '#9bd6d0',
  orange: '#e39a6b',
  lilac: '#b9a7de',
  shadow: '#070a10'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pxX = (value) => value * VIEW_WIDTH;
const pxY = (value) => value * VIEW_HEIGHT;
const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
};

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  context.setTransform(pixelRatio * width / VIEW_WIDTH, 0, 0, pixelRatio * height / VIEW_HEIGHT, 0, 0);
  renderCurrent();
}

function project(node) {
  const horizon = 0.16 + node.y * 0.84;
  const lift = node.height * (78 + horizon * 22);
  return {
    x: pxX(node.x),
    y: pxY(node.y) - lift,
    groundY: pxY(node.y),
    lift
  };
}

function drawAtmosphere(frame) {
  const wash = context.createRadialGradient(760, 210, 30, 620, 520, 960);
  wash.addColorStop(0, '#34475f');
  wash.addColorStop(.34, colors.deep);
  wash.addColorStop(1, colors.void);
  context.fillStyle = wash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = colors.grid;
  context.lineWidth = .6;
  for (let index = 0; index < 15; index += 1) {
    const y = 62 + index * 57;
    context.beginPath();
    context.moveTo(24, y);
    context.bezierCurveTo(300, y - 34 + frame.stage * 1.4, 910, y + 26, VIEW_WIDTH - 20, y - 10);
    context.stroke();
  }
  for (let index = 0; index < 260; index += 1) {
    const x = 22 + ((index * 173 + frame.stage * 13) % 1210);
    const y = 28 + ((index * 97 + frame.stage * 7) % 798);
    const size = .5 + (index % 4) * .45;
    context.fillStyle = index % 5 === 0 ? rgba(colors.orange, .28) : rgba(colors.ink, .1);
    context.fillRect(x, y, size, size);
  }
  context.restore();
}

function drawGroundShadow(frame) {
  context.save();
  context.globalAlpha = .28;
  context.fillStyle = colors.shadow;
  context.beginPath();
  context.ellipse(640, 735, 465, 48, -.05 + frame.stage * .002, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function faceColor(nodes, face) {
  const average = face.reduce((sum, index) => sum + nodes[index].height, 0) / face.length;
  const pressure = face.reduce((sum, index) => sum + nodes[index].pressure, 0) / face.length;
  const fold = face.reduce((sum, index) => sum + nodes[index].fold, 0) / face.length;
  const hue = 196 + pressure * 18 - fold * 7;
  const saturation = 22 + pressure * 28 + fold * 12;
  const lightness = 19 + average * 42 + pressure * 9;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function drawSurface(frame) {
  const { nodes, faces } = frame.surface;
  drawGroundShadow(frame);
  context.save();
  context.lineJoin = 'round';
  faces.forEach((face, index) => {
    const projected = face.map((nodeIndex) => project(nodes[nodeIndex]));
    context.beginPath();
    context.moveTo(projected[0].x, projected[0].y);
    projected.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.closePath();
    context.fillStyle = faceColor(nodes, face);
    context.globalAlpha = .68 + (index % 3) * .05;
    context.fill();
    context.strokeStyle = rgba(colors.ink, .055 + (frame.aggregate.creasedNodes ? .018 : 0));
    context.lineWidth = .42;
    context.stroke();
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  nodes.forEach((node, index) => {
    if (node.pressure < .08 && index % 4 !== 0) return;
    const point = project(node);
    const glow = clamp(node.pressure * .16 + node.fold * .12, .05, .52);
    context.fillStyle = index % 3 === 0 ? rgba(colors.orange, glow) : rgba(colors.ice, glow);
    context.fillRect(point.x - .7, point.y - .7, 1.4 + node.fold * 1.5, 1.4 + node.fold * 1.5);
  });
  context.restore();
}

function drawCreases(frame) {
  if (blindMode) return;
  frame.memory.forEach((pressure, index) => {
    context.save();
    context.globalAlpha = .12 + index * .025;
    context.strokeStyle = index % 2 ? colors.lilac : colors.orange;
    context.lineWidth = 1.1 + index * .14;
    context.setLineDash([3 + index, 9 + index * 2]);
    context.beginPath();
    pressure.path.forEach((point, pointIndex) => {
      const node = { x: point.x, y: point.y, height: .18 + index * .01 };
      const projected = project(node);
      if (pointIndex === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    context.stroke();
    context.setLineDash([]);
    context.restore();
  });
}

function drawDraft() {
  if (!drawing || draftPath.length < 2 || blindMode) return;
  context.save();
  context.globalAlpha = .8;
  context.strokeStyle = colors.ice;
  context.lineWidth = 2.2;
  context.setLineDash([4, 7]);
  context.beginPath();
  draftPath.forEach((point, index) => {
    const x = pxX(point.x);
    const y = pxY(point.y);
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}

function updateReadout(frame) {
  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} pressure${frame.memory.length === 1 ? '' : 's'}`;
  rendererReadout.textContent = hasWebGPU ? 'WEBGPU / PRESSURE READY' : 'CANVAS / PRESSURE FALLBACK';
  liftControl.disabled = frame.memory.length === 0;
}

function renderFrame(frame) {
  drawAtmosphere(frame);
  drawSurface(frame);
  drawCreases(frame);
  drawDraft();
  updateReadout(frame);
}

function currentFrame() {
  return interactionFrame || timeline[currentStage];
}

function renderCurrent() {
  renderFrame(currentFrame());
}

function animationLoop(now) {
  if (!paused && !interactionFrame) {
    currentStage = Math.min(timeline.length - 1, Math.floor((now - startedAt) / STAGE_MS));
  }
  renderCurrent();
  requestAnimationFrame(animationLoop);
}

function normalizedPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), .06, .94),
    y: clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), .08, .92)
  };
}

function canonicalPath(point = { x: .76, y: .2 }) {
  const x = clamp(point.x, .18, .82);
  const y = clamp(point.y, .18, .82);
  return [
    { x: clamp(x - .27, .08, .92), y: clamp(y + .18, .1, .9) },
    { x, y },
    { x: clamp(x + .24, .08, .92), y: clamp(y - .16, .1, .9) }
  ];
}

function applyVisitorPressure(path, pressure) {
  const base = currentFrame();
  interactionFrame = applyPressure(base, path, pressure);
  paused = true;
  renderCurrent();
}

function pressFromKeyboard() {
  applyVisitorPressure(canonicalPath(), .76);
}

function liftLatest() {
  const base = currentFrame();
  if (!base.memory.length) return;
  interactionFrame = liftLatestPressure(base);
  paused = true;
  renderCurrent();
}

function releaseCurrent() {
  interactionFrame = releasePressures();
  currentStage = 0;
  startedAt = performance.now();
  paused = frozen || interactivePreview;
  draftPath = [];
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture?.(event.pointerId);
  paused = true;
  drawing = true;
  lastPointer = normalizedPoint(event);
  draftPath = [lastPointer];
  renderCurrent();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drawing || staticMode) return;
  const point = normalizedPoint(event);
  if (!lastPointer || Math.hypot(point.x - lastPointer.x, point.y - lastPointer.y) > .012) {
    draftPath.push(point);
    lastPointer = point;
    renderCurrent();
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (!drawing || staticMode) return;
  event.preventDefault();
  drawing = false;
  canvas.releasePointerCapture?.(event.pointerId);
  const point = normalizedPoint(event);
  if (!draftPath.length) draftPath = [point];
  if (draftPath.length < 2) draftPath = canonicalPath(point);
  const length = draftPath.slice(1).reduce((sum, item, index) => sum + Math.hypot(item.x - draftPath[index].x, item.y - draftPath[index].y), 0);
  applyVisitorPressure(draftPath, clamp(.38 + length * 1.35, .4, .98));
  draftPath = [];
  lastPointer = null;
});

canvas.addEventListener('pointercancel', () => {
  drawing = false;
  draftPath = [];
  lastPointer = null;
  renderCurrent();
});

canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pressFromKeyboard();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
});

pressControl.addEventListener('click', pressFromKeyboard);
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseCurrent);
window.addEventListener('resize', resizeCanvas);

resizeCanvas();
requestAnimationFrame(animationLoop);
