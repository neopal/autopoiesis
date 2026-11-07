import {
  LOOK_THRESHOLD,
  PORT_COUNT,
  advanceLook,
  beginLook,
  buildFrame,
  buildTimeline,
  commitLook,
  geometrySignature,
  leaveLook,
  liftLatestReply,
  portAtPoint,
  releaseGlyph
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let lookSource = null;
let lookStartedAt = 0;
let lookTimer = null;
let pointerActive = false;
let selectedPort = 0;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'glyph-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#0b0d13' }),
    svgElement('stop', { offset: '52%', 'stop-color': '#171827' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#0d1119' })
  );
  const haze = svgElement('radialGradient', { id: 'glyph-haze', cx: '.5', cy: '.48', r: '.72' });
  haze.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#8a7fc4', 'stop-opacity': '.12' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#11131b', 'stop-opacity': '0' })
  );
  const shadow = svgElement('filter', { id: 'glyph-shadow', x: '-20%', y: '-30%', width: '140%', height: '170%' });
  shadow.append(svgElement('feGaussianBlur', { stdDeviation: '11' }));
  defs.append(ground, haze, shadow);
  return defs;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1200,
    y: ((event.clientY - rect.top) / rect.height) * 760
  };
}

function nextPort() {
  const last = frame.memory.at(-1)?.sourcePort;
  return last === undefined ? 0 : (last + 1) % PORT_COUNT;
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  fragment.append(svgElement('rect', { class: 'glyph-ground', x: '0', y: '0', width: '1200', height: '760' }));
  fragment.append(svgElement('rect', { class: 'glyph-haze', x: '0', y: '0', width: '1200', height: '760' }));
  fragment.append(svgElement('path', { class: 'glyph-axis', d: 'M 88 112 H 1112 M 88 648 H 1112' }));
  fragment.append(svgElement('path', { class: 'glyph-threshold', d: 'M 210 90 V 670 M 990 90 V 670' }));
  fragment.append(svgElement('path', { class: 'glyph-shadow', d: frame.spinePath }));
  fragment.append(svgElement('path', { class: 'glyph-echo', d: frame.spinePath }));
  fragment.append(svgElement('path', { class: 'glyph-spine', d: frame.spinePath, 'data-spine': 'true' }));
  for (const port of frame.ports) {
    fragment.append(svgElement('path', {
      class: 'glyph-port',
      d: port.path,
      'data-port': String(port.index),
      'data-state': port.state
    }));
  }
  if (frame.pending?.sourcePort !== undefined) {
    const port = frame.ports[frame.pending.sourcePort];
    fragment.append(svgElement('path', { class: 'glyph-pending', d: port.path, 'data-pending-port': String(port.index) }));
  }
  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.replyCount = String(frame.memory.length);
  field.dataset.ready = 'true';
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} repl${frame.memory.length === 1 ? 'y' : 'ies'} · ${frame.memory.length ? 'attention spent' : 'no attention spent'}`;
}

function clearLookTimer() {
  if (lookTimer !== null) window.clearTimeout(lookTimer);
  lookTimer = null;
}

function scheduleLookArm() {
  clearLookTimer();
  lookTimer = window.setTimeout(() => {
    if (lookSource === null) return;
    renderFrame(advanceLook(frame, performance.now() - lookStartedAt));
  }, LOOK_THRESHOLD);
}

function startLook(sourcePort) {
  if (staticMode || sourcePort === null || sourcePort === undefined) return;
  lookSource = sourcePort;
  selectedPort = sourcePort;
  lookStartedAt = performance.now();
  renderFrame(beginLook(frame, sourcePort));
  scheduleLookArm();
}

function finishLook() {
  if (lookSource === null) return;
  clearLookTimer();
  const source = lookSource;
  const elapsed = performance.now() - lookStartedAt;
  lookSource = null;
  renderFrame(leaveLook(advanceLook(frame, elapsed), source));
}

function cancelLook() {
  if (lookSource === null) return;
  clearLookTimer();
  lookSource = null;
  renderFrame({ ...frame, pending: null, interaction: frame.memory.length ? 'settled' : 'quiet', event: null });
}

function deterministicAttend() {
  clearLookTimer();
  lookSource = null;
  const source = nextPort();
  selectedPort = source;
  renderFrame(commitLook(frame, source));
}

field.addEventListener('pointermove', (event) => {
  if (staticMode) return;
  const port = portAtPoint(frame, localPoint(event));
  if (lookSource === null && port !== null) startLook(port);
  if (lookSource !== null && port !== lookSource && !pointerActive) finishLook();
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  pointerActive = true;
  const port = portAtPoint(frame, localPoint(event));
  if (port !== null) {
    startLook(port);
    try { field.setPointerCapture?.(event.pointerId); } catch {}
  }
});

field.addEventListener('pointerup', (event) => {
  if (staticMode) return;
  pointerActive = false;
  try { field.releasePointerCapture?.(event.pointerId); } catch {}
  finishLook();
});

field.addEventListener('pointerleave', () => {
  if (staticMode) return;
  pointerActive = false;
  finishLook();
});

field.addEventListener('pointercancel', () => {
  pointerActive = false;
  cancelLook();
});

document.querySelector('#attend-control').addEventListener('click', deterministicAttend);
document.querySelector('#lift-control').addEventListener('click', () => {
  clearLookTimer();
  lookSource = null;
  renderFrame(liftLatestReply(frame));
});
document.querySelector('#release-control').addEventListener('click', () => {
  clearLookTimer();
  lookSource = null;
  renderFrame(releaseGlyph());
});

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    clearLookTimer();
    lookSource = null;
    selectedPort = (selectedPort + (event.key === 'ArrowRight' ? 1 : -1) + PORT_COUNT) % PORT_COUNT;
    renderFrame({
      ...frame,
      pending: { sourcePort: selectedPort, elapsed: LOOK_THRESHOLD, armed: true },
      interaction: 'look-armed',
      event: null
    });
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    clearLookTimer();
    lookSource = null;
    renderFrame(commitLook(frame, selectedPort));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    clearLookTimer();
    lookSource = null;
    renderFrame(liftLatestReply(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    clearLookTimer();
    lookSource = null;
    renderFrame(releaseGlyph());
  }
});

if (document.documentElement.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window._mutineReady = true;
