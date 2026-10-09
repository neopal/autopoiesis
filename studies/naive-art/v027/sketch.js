import {
  buildFrame,
  buildTimeline,
  changedLayerIds,
  commitCorrection,
  geometrySignature,
  liftLatestCorrection,
  releaseMemory
} from './engine.mjs';

const field = document.querySelector('#register-field');
const stage = document.querySelector('#register-stage');
const layerHost = document.querySelector('#print-layers');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const statusReadout = document.querySelector('[data-status]');
const buttons = [...document.querySelectorAll('[data-gesture]')];
const staticMode = document.documentElement.classList.contains('static-mode');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = buildFrame(0, []);
let gesture = null;

function settledFrame() {
  let next = buildFrame(0, []);
  for (const loop of buildTimeline().loops) next = commitCorrection(next, loop);
  return next;
}

if (staticMode || reducedMotion) state = settledFrame();

function normalizedPoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function svgLikeLayer(plate) {
  const layer = document.createElement('div');
  layer.className = 'print-layer';
  layer.dataset.printLayer = String(plate.id);
  layer.setAttribute('aria-hidden', 'true');
  const voidShape = document.createElement('div');
  voidShape.className = 'plate-void';
  layer.append(voidShape);
  layer._voidShape = voidShape;
  layer._plateId = plate.id;
  return layer;
}

function ensureLayers() {
  if (layerHost.children.length) return;
  state.scene.plates.forEach((plate) => layerHost.append(svgLikeLayer(plate)));
}

function render() {
  ensureLayers();
  stageReadout.textContent = `correction ${String(state.stage).padStart(2, '0')} / 04`;
  memoryReadout.textContent = `${state.memory.length} stored`;
  statusReadout.textContent = state.interaction === 'correction-refused-open'
    ? 'open correction refused'
    : state.interaction === 'correction-committed'
      ? 'the register slipped'
      : state.interaction === 'correction-lifted'
        ? 'latest slip lifted'
        : state.interaction === 'memory-released'
          ? 'register released'
          : 'draw a loop and return';
  state.scene.plates.forEach((plate) => {
    const layer = layerHost.querySelector(`[data-print-layer="${plate.id}"]`);
    layer.style.background = plate.ink;
    layer.style.borderColor = plate.edge;
    layer.style.clipPath = plate.clipPath;
    layer.style.transform = plate.transform;
    layer.classList.toggle('is-changed', plate.changed);
    layer._voidShape.style.clipPath = plate.voidPath;
    layer._voidShape.style.background = 'var(--paper)';
  });
  field.dataset.interaction = state.interaction;
  field.dataset.changedLayers = String(changedLayerIds(state).length);
}

function beginGesture(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const point = normalizedPoint(event);
  gesture = { ...point, lastX: point.x, lastY: point.y, length: 0, pointerId: event.pointerId };
  stage.setPointerCapture?.(event.pointerId);
  field.dataset.interaction = 'correction-armed';
}

function extendGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const point = normalizedPoint(event);
  const dx = point.x - gesture.lastX;
  const dy = point.y - gesture.lastY;
  gesture.length += Math.sqrt(dx * dx + dy * dy);
  gesture.lastX = point.x;
  gesture.lastY = point.y;
}

function endGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const point = normalizedPoint(event);
  const dx = point.x - gesture.x;
  const dy = point.y - gesture.y;
  const closure = Math.sqrt(dx * dx + dy * dy);
  const loop = {
    startX: gesture.x,
    startY: gesture.y,
    endX: point.x,
    endY: point.y,
    length: gesture.length,
    closure
  };
  gesture = null;
  stage.releasePointerCapture?.(event.pointerId);
  state = commitCorrection(state, loop);
  render();
}

function deterministicCorrection() {
  state = commitCorrection(state, buildTimeline().loops[state.memory.length % 4]);
  render();
}

function lift() {
  state = liftLatestCorrection(state);
  render();
}

function release() {
  state = releaseMemory(state);
  render();
}

stage.addEventListener('pointerdown', beginGesture);
stage.addEventListener('pointermove', extendGesture);
stage.addEventListener('pointerup', endGesture);
stage.addEventListener('pointercancel', () => { gesture = null; });

field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicCorrection();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
    return;
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

buttons.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.gesture === 'correct') deterministicCorrection();
  if (button.dataset.gesture === 'undo') lift();
  if (button.dataset.gesture === 'release') release();
}));

window.__mutineNaiveV027 = {
  getState: () => ({ ...state, geometrySignature: geometrySignature(state) }),
  beginGesture,
  commit: deterministicCorrection,
  lift,
  release,
  buildTimeline
};

render();
