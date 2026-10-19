import {
  buildFrame,
  buildTimeline,
  commitPressure,
  geometrySignature,
  liftLatestPressure,
  releaseMemory,
  MIN_DWELL,
  ZONE_COUNT
} from './engine.mjs';

const svg = document.querySelector('#pressure-svg');
const field = document.querySelector('#slab-field');
const bodyPath = document.querySelector('#slab-body');
const shadowPath = document.querySelector('#slab-shadow-path');
const lightPath = document.querySelector('#slab-light-path');
const grainPath = document.querySelector('#slab-grain');
const seamsGroup = document.querySelector('#slab-seams');
const witnessesGroup = document.querySelector('#pressure-witnesses');
const stageNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const statusNode = document.querySelector('[data-status]');
const timeline = buildTimeline();
let state = buildFrame();
let pointerDown = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function closedPath(points, offsetX = 0, offsetY = 0) {
  const shifted = points.map((point) => ({ x: point.x * 1200 + offsetX, y: point.y * 760 + offsetY }));
  const firstMid = midpoint(shifted.at(-1), shifted[0]);
  let path = `M ${firstMid.x.toFixed(2)} ${firstMid.y.toFixed(2)}`;
  shifted.forEach((point, index) => {
    const next = shifted[(index + 1) % shifted.length];
    const nextMid = midpoint(point, next);
    path += ` Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${nextMid.x.toFixed(2)} ${nextMid.y.toFixed(2)}`;
  });
  return `${path} Z`;
}

function seamPath(points, offsetX = 0, offsetY = 0) {
  const scaled = points.map((point) => ({ x: point.x * 1200 + offsetX, y: point.y * 760 + offsetY }));
  let path = `M ${scaled[0].x.toFixed(2)} ${scaled[0].y.toFixed(2)}`;
  for (let index = 1; index < scaled.length; index += 1) {
    const prior = scaled[index - 1];
    const point = scaled[index];
    const controlX = (prior.x + point.x) / 2;
    const controlY = (prior.y + point.y) / 2 + (point.bend || 0) * 12;
    path += ` Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }
  return path;
}

function renderSeams() {
  seamsGroup.replaceChildren();
  state.surface.seams.forEach((seam, index) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'slab-seam');
    path.setAttribute('d', seamPath(seam.points));
    path.dataset.seam = String(index);
    seamsGroup.append(path);
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    highlight.setAttribute('class', 'slab-seam-highlight');
    highlight.setAttribute('d', seamPath(seam.points, -2, -3));
    seamsGroup.append(highlight);
  });
}

function renderWitnesses() {
  witnessesGroup.replaceChildren();
  if (!pointerDown || document.documentElement.classList.contains('blind-mode')) return;
  const cx = pointerDown.x * 1200;
  const cy = pointerDown.y * 760;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('class', 'pressure-witness-ring');
  ring.setAttribute('cx', cx.toFixed(2));
  ring.setAttribute('cy', cy.toFixed(2));
  ring.setAttribute('r', '28');
  witnessesGroup.append(ring);
}

function render() {
  const d = closedPath(state.surface.boundary);
  bodyPath.setAttribute('d', d);
  shadowPath.setAttribute('d', d);
  lightPath.setAttribute('d', closedPath(state.surface.boundary, -3, -5));
  grainPath.setAttribute('d', d);
  renderSeams();
  renderWitnesses();
  stageNode.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryNode.textContent = `${state.memory.length} retained`;
  statusNode.textContent = statusFor(state.interaction);
  field.dataset.memory = String(state.memory.length);
  field.dataset.signature = geometrySignature(state);
}

function statusFor(interaction) {
  const labels = {
    idle: 'hold until the slab yields',
    'pressure-armed': 'weight held · not yet remembered',
    'pressure-refused-light': 'too light · the slab forgot it',
    'pressure-committed': 'the load travelled to a wrong edge',
    'pressure-lifted': 'latest load lifted',
    'memory-released': 'the seeded slab is quiet'
  };
  return labels[interaction] || interaction;
}

function normalizedPoint(event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
  };
}

function zoneFor(point) {
  const angle = (Math.atan2(point.y - 0.5, point.x - 0.5) + Math.PI * 2) % (Math.PI * 2);
  return Math.floor((angle / (Math.PI * 2)) * ZONE_COUNT) % ZONE_COUNT;
}

function armPressure(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const point = normalizedPoint(event);
  const zone = zoneFor(point);
  pointerDown = { ...point, zone, started: performance.now() };
  state = buildFrame(state.stage, state.memory, zone);
  state = { ...state, interaction: 'pressure-armed' };
  svg.setPointerCapture?.(event.pointerId);
  render();
}

function releasePressure(event) {
  if (!pointerDown) return;
  const duration = performance.now() - pointerDown.started;
  const intensity = event.pointerType === 'pen' && event.pressure ? event.pressure : 0.76;
  const gesture = { zone: pointerDown.zone, dwell: duration, intensity };
  pointerDown = null;
  state = commitPressure(state, gesture);
  svg.releasePointerCapture?.(event.pointerId);
  render();
}

function deterministicLoad() {
  pointerDown = null;
  state = commitPressure(state, timeline[state.memory.length % timeline.length]);
  render();
}

function lift() {
  pointerDown = null;
  state = liftLatestPressure(state);
  render();
}

function release() {
  pointerDown = null;
  state = releaseMemory(state);
  render();
}

svg.addEventListener('pointerdown', armPressure);
svg.addEventListener('pointerup', releasePressure);
svg.addEventListener('pointercancel', () => { pointerDown = null; state = { ...state, interaction: 'idle' }; render(); });
svg.addEventListener('pointerleave', () => { if (pointerDown) render(); });

document.querySelector('[data-gesture="load"]').addEventListener('click', deterministicLoad);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);

field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicLoad();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

window.__mutineNaiveV030 = {
  getState: () => structuredClone(state),
  geometrySignature: () => geometrySignature(state),
  load: deterministicLoad,
  lift,
  release,
  minDwell: MIN_DWELL
};

render();
