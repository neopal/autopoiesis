import {
  beginPressure,
  buildFrame,
  buildTimeline,
  commitPressure,
  geometrySignature,
  liftLatestPressure,
  pressureSideAtPoint,
  releaseBlock,
  releasePressure
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
const HOLD_MS = 240;
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let activePointer = false;
let activeSide = null;
let pressStartedAt = 0;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'block-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#0e1419' }),
    svgElement('stop', { offset: '52%', 'stop-color': '#1b252d' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#0b1014' })
  );
  const haze = svgElement('radialGradient', { id: 'block-haze', cx: '.5', cy: '.45', r: '.72' });
  haze.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#d9a45c', 'stop-opacity': '.08' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#0f1419', 'stop-opacity': '0' })
  );
  const body = svgElement('linearGradient', { id: 'body-fill', x1: '0', y1: '0', x2: '1', y2: '1' });
  body.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#76929a' }),
    svgElement('stop', { offset: '44%', 'stop-color': '#4d6770' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#263941' })
  );
  const jawLeft = svgElement('linearGradient', { id: 'jaw-left', x1: '0', y1: '0', x2: '1', y2: '1' });
  jawLeft.append(svgElement('stop', { offset: '0%', 'stop-color': '#c36d50' }), svgElement('stop', { offset: '100%', 'stop-color': '#633b35' }));
  const jawRight = svgElement('linearGradient', { id: 'jaw-right', x1: '1', y1: '0', x2: '0', y2: '1' });
  jawRight.append(svgElement('stop', { offset: '0%', 'stop-color': '#d9a45c' }), svgElement('stop', { offset: '100%', 'stop-color': '#725536' }));
  const shadow = svgElement('filter', { id: 'block-shadow', x: '-25%', y: '-20%', width: '150%', height: '170%' });
  shadow.append(svgElement('feGaussianBlur', { stdDeviation: '13' }));
  defs.append(ground, haze, body, jawLeft, jawRight, shadow);
  return defs;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * 1000, y: ((event.clientY - rect.top) / rect.height) * 760 };
}

function alternateSide() {
  return frame.memory.at(-1)?.side === 'left' ? 'right' : 'left';
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  fragment.append(svgElement('rect', { class: 'field-ground', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('rect', { class: 'field-haze', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('path', { class: 'field-axis', d: 'M 500 54 V 706' }));
  fragment.append(svgElement('path', { class: 'field-rule', d: 'M 112 380 H 888 M 190 120 H 810 M 190 640 H 810' }));
  fragment.append(svgElement('path', { class: 'block-shadow', d: frame.bodyPath }));
  fragment.append(svgElement('path', { class: 'block-body', d: `${frame.bodyPath} ${frame.voidPath}`, 'fill-rule': 'evenodd', 'data-body': 'true' }));
  fragment.append(svgElement('path', { class: 'block-cut', d: frame.voidPath, 'data-void': 'true' }));
  fragment.append(svgElement('path', { class: 'block-cut-inner', d: frame.voidPath }));
  for (const layer of frame.layers) fragment.append(svgElement('path', { class: 'block-layer', d: layer.path, 'data-layer': String(layer.index) }));
  fragment.append(svgElement('path', { class: 'pressure-jaw', d: frame.jaws.left, 'data-side': 'left' }));
  fragment.append(svgElement('path', { class: 'pressure-jaw', d: frame.jaws.right, 'data-side': 'right' }));
  fragment.append(svgElement('path', { class: 'pressure-mark', d: 'M 214 302 V 458 M 786 302 V 458' }));
  fragment.append(svgElement('path', { class: 'load-notch', d: 'M 454 78 H 546 M 454 682 H 546' }));
  if (frame.pending?.side) {
    fragment.append(svgElement('path', { class: 'pressure-jaw is-pending', d: frame.jaws[frame.pending.side], 'data-pending-side': frame.pending.side }));
  }
  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.loadCount = String(frame.memory.length);
  field.dataset.lastSide = frame.state.lastSide ?? '';
  field.dataset.mode = frame.state.mode;
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} load${frame.memory.length === 1 ? '' : 's'} · ${frame.memory.length ? `resistance ${frame.state.resistance}` : 'material unspent'}`;
}

function deterministicPulse() {
  renderFrame(commitPressure(frame, alternateSide()));
}

function cancelPending() {
  renderFrame({ ...frame, pending: null, interaction: frame.memory.length ? 'settled' : 'quiet', event: null });
}

field.addEventListener('pointerdown', (event) => {
  const side = pressureSideAtPoint(frame, localPoint(event));
  if (!side) return;
  activePointer = true;
  activeSide = side;
  pressStartedAt = performance.now();
  try { field.setPointerCapture?.(event.pointerId); } catch {}
  renderFrame(beginPressure(frame, side));
});

field.addEventListener('pointerup', (event) => {
  if (!activePointer) return;
  activePointer = false;
  try { field.releasePointerCapture?.(event.pointerId); } catch {}
  const held = performance.now() - pressStartedAt >= HOLD_MS;
  renderFrame(releasePressure(frame, activeSide, held));
  activeSide = null;
});

field.addEventListener('pointercancel', () => {
  activePointer = false;
  activeSide = null;
  cancelPending();
});

document.querySelector('#press-control').addEventListener('click', deterministicPulse);
document.querySelector('#lift-control').addEventListener('click', () => renderFrame(liftLatestPressure(frame)));
document.querySelector('#release-control').addEventListener('click', () => renderFrame(releaseBlock()));

let keyboardSide = null;
let keyboardStartedAt = 0;
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardSide = event.key === 'ArrowLeft' ? 'left' : 'right';
    keyboardStartedAt = performance.now();
    renderFrame(beginPressure(frame, keyboardSide));
  } else if (event.key === ' ') {
    event.preventDefault();
    if (!keyboardSide) keyboardSide = alternateSide();
    keyboardStartedAt = performance.now();
    renderFrame(beginPressure(frame, keyboardSide));
  } else if (event.key === 'Enter') {
    event.preventDefault();
    deterministicPulse();
  } else if (event.key === 'Delete') {
    event.preventDefault();
    renderFrame(liftLatestPressure(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    renderFrame(releaseBlock());
  }
});

field.addEventListener('keyup', (event) => {
  if ((event.key === ' ' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') && keyboardSide) {
    event.preventDefault();
    renderFrame(releasePressure(frame, keyboardSide, performance.now() - keyboardStartedAt >= HOLD_MS));
    keyboardSide = null;
  }
});

if (document.documentElement.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window._mutineReady = true;
field.dataset.ready = 'true';
