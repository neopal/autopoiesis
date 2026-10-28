import {
  PLATE_COUNT,
  buildFrame,
  buildTimeline,
  geometrySignature,
  probeMaterial,
  castMaterial,
  liftLatest,
  releaseMaterial
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = staticMode || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;

let stage;
let canvas;
let context;
let statusNode;
let stageNode;
let memoryNode;
let stateNode;
let hintNode;
let state;
let gesture = null;
let frameHandle = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function setup() {
  stage = document.querySelector('[data-resistance-cast]');
  canvas = document.querySelector('#resistance-canvas');
  context = canvas.getContext('2d', { alpha: false });
  statusNode = document.querySelector('[data-interaction-state]');
  stageNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  state = staticMode ? buildTimeline().at(-1) : buildFrame();
  bindControls();
  resizeCanvas();
  render('waiting');
  window.__mutinePortraitV036 = {
    getState: () => structuredClone(state),
    probe: (start, end, pressure = 0.72) => {
      state = probeMaterial(state, { start, end, pressure });
      render('probing');
      return state;
    },
    cast: () => castRevision(),
    lift: () => liftRevision(),
    release: () => releaseRevision(),
    geometrySignature: () => geometrySignature(state)
  };
  window.dispatchEvent(new CustomEvent('mutine:ready', { detail: 'portrait-v036' }));
}

function bindControls() {
  canvas.addEventListener('pointerdown', beginProbe);
  canvas.addEventListener('pointermove', moveProbe);
  canvas.addEventListener('pointerup', finishProbe);
  canvas.addEventListener('pointercancel', cancelProbe);
  stage.addEventListener('keydown', handleKeydown);
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'cast') castRevision();
      if (action === 'lift') liftRevision();
      if (action === 'release') releaseRevision();
    });
  });
}

function normalizedPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - (rect.left + rect.width * 0.5)) / Math.max(1, rect.width * 0.44), -1, 1),
    y: clamp((event.clientY - (rect.top + rect.height * 0.5)) / Math.max(1, rect.height * 0.44), -0.7, 0.7)
  };
}

function beginProbe(event) {
  if (staticMode) return;
  event.preventDefault();
  stage.focus({ preventScroll: true });
  const point = normalizedPoint(event);
  gesture = { start: point, end: point, pressure: 0.22 };
  canvas.setPointerCapture?.(event.pointerId);
  state = probeMaterial(state, { start: point, end: point, pressure: gesture.pressure });
  render('probing');
}

function moveProbe(event) {
  if (!gesture || staticMode) return;
  const point = normalizedPoint(event);
  gesture.end = point;
  const distance = Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y);
  gesture.pressure = clamp(0.24 + distance * 0.75, 0.24, 1);
  state = probeMaterial(state, { start: gesture.start, end: point, pressure: gesture.pressure });
  render('probing');
}

function finishProbe(event) {
  if (!gesture || staticMode) return;
  const point = normalizedPoint(event);
  gesture.end = point;
  const distance = Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y);
  gesture.pressure = clamp(0.24 + distance * 0.75, 0.24, 1);
  state = probeMaterial(state, { start: gesture.start, end: point, pressure: gesture.pressure });
  gesture = null;
  canvas.releasePointerCapture?.(event.pointerId);
  castRevision();
}

function cancelProbe() {
  gesture = null;
  render('waiting');
}

function castRevision() {
  if (staticMode) return state;
  const result = castMaterial(state);
  state = result.frame;
  render('cast');
  return result;
}

function liftRevision() {
  state = liftLatest(state);
  render('lifted');
  return state;
}

function releaseRevision() {
  gesture = null;
  state = releaseMaterial();
  render('released');
  return state;
}

function keyboardProbe(direction) {
  const probes = {
    ArrowUp: [{ x: 0.58, y: 0.58 }, { x: -0.36, y: -0.55 }],
    ArrowRight: [{ x: -0.62, y: -0.12 }, { x: 0.68, y: 0.18 }],
    ArrowDown: [{ x: -0.42, y: -0.58 }, { x: 0.5, y: 0.56 }],
    ArrowLeft: [{ x: 0.64, y: 0.1 }, { x: -0.64, y: -0.22 }]
  };
  const [start, end] = probes[direction];
  state = probeMaterial(state, { start, end, pressure: 0.72 });
  render('probing');
}

function handleKeydown(event) {
  if (Object.hasOwn({ ArrowUp: true, ArrowRight: true, ArrowDown: true, ArrowLeft: true }, event.key)) {
    event.preventDefault();
    if (!staticMode) keyboardProbe(event.key);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    castRevision();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftRevision();
  } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
    event.preventDefault();
    releaseRevision();
  }
}

function resizeCanvas() {
  if (!canvas || !stage) return;
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  render('waiting');
}

function screenPoint(normalized, width, height) {
  return {
    x: width * 0.5 + normalized.x * width * 0.44,
    y: height * 0.5 + normalized.y * height * 0.44
  };
}

function drawBackground(ctx, width, height) {
  const gradient = ctx.createRadialGradient(width * 0.48, height * 0.46, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
  gradient.addColorStop(0, '#282434');
  gradient.addColorStop(0.48, '#171520');
  gradient.addColorStop(1, '#0e0d14');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let index = 0; index < 18; index += 1) {
    const x = width * (0.04 + ((index * 0.173) % 0.92));
    const y = height * (0.08 + ((index * 0.317) % 0.82));
    const radius = Math.min(width, height) * (0.02 + ((index * 0.037) % 0.045));
    ctx.fillStyle = index % 3 === 0 ? '#c7dc78' : index % 3 === 1 ? '#ff8b5c' : '#7c9dff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(246,237,221,.1)';
  ctx.lineWidth = 1;
  ctx.strokeRect(18.5, 18.5, width - 37, height - 37);
}

function platePath(ctx, plate, width, height) {
  const unit = Math.min(width, height);
  const left = width * 0.5 + plate.x * unit * 0.34 - plate.width * unit * 0.47;
  const top = height * 0.5 + plate.y * unit * 0.51 - plate.height * unit * 0.52;
  const plateWidth = plate.width * unit * 0.94;
  const plateHeight = plate.height * unit * 0.95;
  const notchX = left + plateWidth * (0.36 + plate.notch * 0.22);
  const splitX = left + plateWidth * (0.66 - plate.split * 0.18);
  ctx.beginPath();
  ctx.moveTo(left, top + plateHeight * 0.18);
  ctx.lineTo(left + plateWidth * 0.11, top);
  ctx.lineTo(left + plateWidth * 0.58, top + plateHeight * 0.04);
  ctx.lineTo(left + plateWidth, top + plateHeight * 0.2);
  ctx.lineTo(left + plateWidth * 0.92, top + plateHeight);
  ctx.lineTo(splitX, top + plateHeight * 0.88);
  ctx.lineTo(notchX, top + plateHeight * 0.57);
  ctx.lineTo(left + plateWidth * 0.19, top + plateHeight * 0.92);
  ctx.closePath();
  return { left, top, plateWidth, plateHeight, notchX, splitX };
}

function drawPlate(ctx, plate, width, height, index) {
  const geometry = platePath(ctx, plate, width, height);
  const colors = {
    quiet: ['#d9d0bf', '#8d86a4'],
    hardened: ['#ff9a62', '#ffc36e'],
    fractured: ['#7393ff', '#b9c8ff'],
    binder: ['#b8d96d', '#ecf4ae']
  };
  const [start, end] = colors[plate.state] || colors.quiet;

  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(plate.tilt);
  ctx.translate(-width * 0.5, -height * 0.5);
  ctx.shadowColor = plate.state === 'quiet' ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.54)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  const fill = ctx.createLinearGradient(geometry.left, geometry.top, geometry.left + geometry.plateWidth, geometry.top + geometry.plateHeight);
  fill.addColorStop(0, start);
  fill.addColorStop(1, end);
  ctx.fillStyle = fill;
  ctx.globalAlpha = plate.state === 'quiet' ? 0.72 : 0.96;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = plate.state === 'fractured' ? '#dce4ff' : '#17131c';
  ctx.lineWidth = 1.15;
  ctx.stroke();

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#16121b';
  ctx.beginPath();
  ctx.moveTo(geometry.notchX, geometry.top + geometry.plateHeight * 0.57);
  ctx.lineTo(geometry.notchX + geometry.plateWidth * (0.08 + plate.notch * 0.16), geometry.top + geometry.plateHeight * 0.42);
  ctx.lineTo(geometry.notchX + geometry.plateWidth * (0.14 + plate.notch * 0.2), geometry.top + geometry.plateHeight * 0.93);
  ctx.lineTo(geometry.notchX - geometry.plateWidth * 0.02, geometry.top + geometry.plateHeight * 0.84);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = plate.state === 'binder' ? '#f6f2cf' : '#ffffff';
  ctx.lineWidth = 1;
  const lamina = geometry.top + geometry.plateHeight * (0.28 + (index % 3) * 0.12);
  ctx.beginPath();
  ctx.moveTo(geometry.left + geometry.plateWidth * 0.14, lamina);
  ctx.lineTo(geometry.left + geometry.plateWidth * (0.78 + plate.bridge * 0.12), lamina + geometry.plateHeight * 0.04);
  ctx.stroke();

  if (plate.bridge > 0.17) {
    ctx.globalAlpha = 0.78;
    ctx.strokeStyle = '#eff4bd';
    ctx.lineWidth = Math.max(2, geometry.plateHeight * 0.09);
    ctx.beginPath();
    ctx.moveTo(geometry.left + geometry.plateWidth * 0.22, geometry.top + geometry.plateHeight * 0.74);
    ctx.lineTo(geometry.left + geometry.plateWidth * 0.78, geometry.top + geometry.plateHeight * 0.26);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  for (let mark = 0; mark < 5; mark += 1) {
    const markX = geometry.left + geometry.plateWidth * (0.18 + ((mark * 0.137 + index * 0.071) % 0.64));
    const markY = geometry.top + geometry.plateHeight * (0.18 + ((mark * 0.19 + index * 0.08) % 0.56));
    ctx.fillRect(markX, markY, Math.max(2, geometry.plateWidth * 0.018), Math.max(1, geometry.plateHeight * 0.05));
  }
  ctx.restore();
}

function drawSpecimen(ctx, width, height, frame) {
  const unit = Math.min(width, height);
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = '#ff8b5c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - unit * 0.29, height * 0.15);
  ctx.lineTo(width * 0.5 + unit * 0.24, height * 0.85);
  ctx.stroke();
  ctx.restore();

  frame.plates.forEach((plate, index) => drawPlate(ctx, plate, width, height, index));

  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.fillStyle = '#f6eddb';
  ctx.font = `${Math.max(9, unit * 0.018)}px ui-monospace, SFMono-Regular, monospace`;
  ctx.letterSpacing = '0.12em';
  ctx.fillText('RESISTANCE / 036', width * 0.07, height * 0.1);
  ctx.fillText(String(frame.revision).padStart(2, '0'), width * 0.86, height * 0.9);
  ctx.restore();
}

function drawGesture(ctx, width, height) {
  if (!gesture || staticMode) return;
  const start = screenPoint(gesture.start, width, height);
  const end = screenPoint(gesture.end, width, height);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = '#c7dc78';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ff9a62';
  ctx.beginPath();
  ctx.arc(end.x, end.y, 5 + gesture.pressure * 7, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function render(reason) {
  if (!context || !stage) return;
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (!width || !height) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  drawBackground(context, width, height);
  drawSpecimen(context, width, height, state);
  drawGesture(context, width, height);
  stageNode.textContent = `${state.revision ? 'cast specimen' : 'quiet specimen'} / ${String(state.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${state.memory.length} cast${state.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = state.memory.length ? `the material has changed its next rule · ${state.memory.at(-1).kind}` : 'the material has not answered';
  hintNode.textContent = state.lastProbe ? 'resistance is loaded · release to cast' : 'drag across the specimen · release to cast';
  statusNode.textContent = humanState(reason);
  if (frameHandle) cancelAnimationFrame(frameHandle);
  if (!reducedMotion) frameHandle = requestAnimationFrame(() => { frameHandle = 0; });
}

function humanState(reason) {
  const labels = {
    waiting: 'The specimen is waiting for a first probe.',
    probing: 'Pressure is loading without moving the specimen.',
    cast: 'Resistance produced three remote material roles.',
    lifted: 'The latest cast was lifted from the specimen.',
    released: 'The material returned to its deterministic quiet seed.'
  };
  return labels[reason] || labels.waiting;
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', setup);
