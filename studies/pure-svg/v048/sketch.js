import {
  DRAG_THRESHOLD,
  GATE_COUNT,
  buildFrame,
  buildTimeline,
  commitDrag,
  completeDrag,
  gateAtPoint,
  gatePoint,
  geometrySignature,
  liftLatest,
  moveDrag,
  beginDrag,
  releaseSeal
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const seal = document.querySelector('#seal');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let pointerActive = false;
let selectedSource = 0;
let selectedTarget = 1;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'seal-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#f4ead8' }),
    svgElement('stop', { offset: '52%', 'stop-color': '#e4d7c2' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#cfc1aa' })
  );
  const wash = svgElement('radialGradient', { id: 'seal-wash', cx: '.48', cy: '.46', r: '.7' });
  wash.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#bf5c46', 'stop-opacity': '.08' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#47758a', 'stop-opacity': '0' })
  );
  const blur = svgElement('filter', { id: 'seal-blur', x: '-20%', y: '-30%', width: '140%', height: '170%' });
  blur.append(svgElement('feGaussianBlur', { stdDeviation: '13' }));
  defs.append(ground, wash, blur);
  return defs;
}

function localPoint(event) {
  const rect = seal.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1200,
    y: ((event.clientY - rect.top) / rect.height) * 760
  };
}

function gateMarkPath(index) {
  const point = gatePoint(index);
  const radius = 15;
  return `M ${point.x} ${point.y - radius} L ${point.x + radius} ${point.y} L ${point.x} ${point.y + radius} L ${point.x - radius} ${point.y} Z`;
}

function pendingPath() {
  if (!frame.pending) return null;
  const source = gatePoint(frame.pending.sourceGate);
  const target = frame.pending.lastPoint ?? source;
  return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  const title = svgElement('title');
  title.textContent = 'The hole changes sides.';
  fragment.append(title);
  fragment.append(svgElement('rect', { class: 'seal-ground', x: 0, y: 0, width: 1200, height: 760 }));
  fragment.append(svgElement('rect', { class: 'seal-wash', x: 0, y: 0, width: 1200, height: 760 }));
  fragment.append(svgElement('path', { class: 'seal-shadow', d: frame.outerPath }));
  fragment.append(svgElement('path', { class: 'seal-body', d: frame.compoundPath, 'data-compound': 'true' }));
  fragment.append(svgElement('path', { class: 'seal-outline', d: frame.outerPath }));
  for (const aperture of frame.apertures) {
    fragment.append(svgElement('path', {
      class: 'aperture-outline',
      d: aperture.path,
      'data-aperture': aperture.index,
      'data-winding': aperture.winding
    }));
  }
  fragment.append(svgElement('path', { class: 'seal-crease', d: 'M 276 420 L 528 292 L 856 470' }));
  for (let index = 0; index < GATE_COUNT; index += 1) {
    fragment.append(svgElement('path', {
      class: 'gate-mark',
      d: gateMarkPath(index),
      'data-gate': index,
      'data-selected': String(frame.pending?.sourceGate === index || selectedSource === index)
    }));
  }
  const pending = pendingPath();
  if (pending) fragment.append(svgElement('path', { class: 'draw-pending', d: pending }));
  seal.replaceChildren(fragment);
  seal.dataset.signature = geometrySignature(frame);
  seal.dataset.memory = String(frame.memory.length);
  seal.dataset.interaction = frame.interaction;
  seal.dataset.inversionCount = String(frame.memory.length);
  seal.dataset.ready = 'true';
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  const holes = frame.state.openApertures.length;
  memoryReadout.textContent = `${frame.memory.length} inversion${frame.memory.length === 1 ? '' : 's'} · ${holes} hole${holes === 1 ? '' : 's'} held`;
}

function nextRoute() {
  const source = frame.memory.at(-1)?.targetGate ?? selectedSource;
  return { source, target: (source + 1) % GATE_COUNT };
}

function drawNext() {
  if (staticMode) return;
  const route = nextRoute();
  selectedSource = route.source;
  selectedTarget = route.target;
  renderFrame(completeDrag(frame, route.source, route.target, DRAG_THRESHOLD + 48));
}

function lift() {
  if (staticMode) return;
  renderFrame(liftLatest(frame));
}

function release() {
  if (staticMode) return;
  renderFrame(releaseSeal());
}

function commitKeyboardDrag() {
  if (!frame.pending) return;
  renderFrame(commitDrag({
    ...frame,
    pending: { ...frame.pending, lastPoint: gatePoint(selectedTarget), pathLength: DRAG_THRESHOLD, crossed: true }
  }, selectedTarget));
}

seal.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  pointerActive = true;
  const source = gateAtPoint(frame, localPoint(event));
  if (source === null) {
    pointerActive = false;
    renderFrame({ ...frame, interaction: 'draw-refused-miss', event: { type: 'draw-refused-miss' } });
    return;
  }
  selectedSource = source;
  selectedTarget = (source + 1) % GATE_COUNT;
  renderFrame(beginDrag(frame, source));
  try { seal.setPointerCapture?.(event.pointerId); } catch {}
});

seal.addEventListener('pointermove', (event) => {
  if (staticMode || !pointerActive || !frame.pending) return;
  renderFrame(moveDrag(frame, localPoint(event)));
});

seal.addEventListener('pointerup', (event) => {
  if (staticMode || !pointerActive) return;
  pointerActive = false;
  try { seal.releasePointerCapture?.(event.pointerId); } catch {}
  renderFrame(commitDrag(frame, gateAtPoint(frame, localPoint(event))));
});

seal.addEventListener('pointercancel', () => {
  pointerActive = false;
  if (staticMode || !frame.pending) return;
  renderFrame({ ...frame, pending: null, interaction: frame.memory.length ? 'settled' : 'quiet', event: null });
});

document.querySelector('#draw-control').addEventListener('click', drawNext);
document.querySelector('#lift-control').addEventListener('click', lift);
document.querySelector('#release-control').addEventListener('click', release);

seal.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    if (frame.pending) {
      selectedTarget = (selectedTarget + delta + GATE_COUNT) % GATE_COUNT;
      renderFrame({
        ...frame,
        pending: { ...frame.pending, lastPoint: gatePoint(selectedTarget), pathLength: DRAG_THRESHOLD, crossed: true },
        interaction: 'draw-crossed',
        event: null
      });
    } else {
      selectedSource = (selectedSource + delta + GATE_COUNT) % GATE_COUNT;
      selectedTarget = (selectedSource + 1) % GATE_COUNT;
      renderFrame({ ...frame, interaction: 'gate-selected', event: null });
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending) commitKeyboardDrag();
    else renderFrame(beginDrag(frame, selectedSource));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

if (html.classList.contains('static-mode')) seal.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window.__mutineSvgV048 = {
  getFrame: () => frame,
  getState: () => ({
    memory: frame.memory.length,
    interaction: frame.interaction,
    signature: geometrySignature(frame),
    openApertures: [...frame.state.openApertures],
    pending: Boolean(frame.pending)
  }),
  geometrySignature: () => geometrySignature(frame),
  gatePoint,
  release
};
window._mutineReady = true;
