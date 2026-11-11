import {
  PAIR_COUNT,
  buildFrame,
  buildTimeline,
  commitPass,
  corridorAtPoint,
  corridorPoint,
  completePass,
  geometrySignature,
  beginPass,
  liftLatest,
  movePass,
  releaseField
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let pointerSession = false;
let selectedPair = 0;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'field-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#f5f0e4' }),
    svgElement('stop', { offset: '55%', 'stop-color': '#e9e3d3' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#d6d0c1' })
  );
  const grain = svgElement('pattern', { id: 'field-grain', width: '28', height: '28', patternUnits: 'userSpaceOnUse' });
  grain.append(
    svgElement('circle', { cx: '4', cy: '7', r: '1', fill: '#496159', 'fill-opacity': '.18' }),
    svgElement('circle', { cx: '19', cy: '17', r: '.8', fill: '#c45a42', 'fill-opacity': '.14' }),
    svgElement('path', { d: 'M 1 25 L 7 23', stroke: '#496159', 'stroke-opacity': '.1', 'stroke-width': '1' })
  );
  const blur = svgElement('filter', { id: 'mark-shadow', x: '-30%', y: '-50%', width: '160%', height: '200%' });
  blur.append(svgElement('feGaussianBlur', { stdDeviation: '8' }));
  defs.append(ground, grain, blur);
  for (const mark of frame.marks) {
    const mask = svgElement('mask', { id: `mark-mask-${mark.index}`, maskUnits: 'userSpaceOnUse' });
    mask.append(svgElement('rect', {
      x: mark.x - mark.width,
      y: mark.y - mark.height,
      width: mark.width * 2,
      height: mark.height * 2,
      fill: 'white'
    }));
    if (mark.notchPath) mask.append(svgElement('path', {
      d: mark.notchPath,
      transform: `rotate(${mark.rotation} ${mark.x} ${mark.y})`,
      fill: 'black'
    }));
    defs.append(mask);
  }
  return defs;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1200,
    y: ((event.clientY - rect.top) / rect.height) * 760
  };
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  const title = svgElement('title');
  title.textContent = 'The gap is a third mark.';
  fragment.append(title);
  fragment.append(svgElement('rect', { class: 'field-ground', x: 0, y: 0, width: 1200, height: 760 }));
  fragment.append(svgElement('rect', { class: 'field-grain', x: 0, y: 0, width: 1200, height: 760 }));

  for (const pair of frame.pairs) {
    fragment.append(svgElement('path', {
      class: 'pair-guide',
      d: `M ${pair.entry.x} ${pair.entry.y} L ${pair.exit.x} ${pair.exit.y}`,
      'data-pair-guide': pair.index
    }));
    fragment.append(svgElement('circle', { class: 'pair-entry', cx: pair.entry.x, cy: pair.entry.y, r: 5, 'data-pair-entry': pair.index }));
    fragment.append(svgElement('circle', { class: 'pair-entry', cx: pair.exit.x, cy: pair.exit.y, r: 5, 'data-pair-exit': pair.index }));
  }

  for (const mark of frame.marks) {
    const transform = `rotate(${mark.rotation} ${mark.x} ${mark.y})`;
    fragment.append(svgElement('rect', {
      class: 'mark-shadow',
      x: mark.x - mark.width / 2 + 8,
      y: mark.y - mark.height / 2 + 10,
      width: mark.width,
      height: mark.height,
      rx: 3,
      transform,
      'data-shadow': mark.index
    }));
    fragment.append(svgElement('rect', {
      class: 'mark',
      x: mark.x - mark.width / 2,
      y: mark.y - mark.height / 2,
      width: mark.width,
      height: mark.height,
      rx: 3,
      transform,
      mask: `url(#mark-mask-${mark.index})`,
      'data-mark': mark.index,
      'data-pair': mark.pair,
      'data-signature': mark.signature
    }));
  }

  for (const cut of frame.cuts) {
    fragment.append(svgElement('path', {
      class: 'gap-edge',
      d: cut.path,
      'data-cut': cut.order,
      'data-pair': cut.pair
    }));
  }

  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.cutCount = String(frame.cuts.length);
  field.dataset.ready = 'true';
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  const open = frame.state.openCorridors.length;
  memoryReadout.textContent = `${frame.memory.length} cut${frame.memory.length === 1 ? '' : 's'} · ${open} corridor${open === 1 ? '' : 's'} open`;
}

function passNext() {
  if (staticMode) return;
  const pair = frame.memory.length % PAIR_COUNT;
  const fromSide = frame.memory.length % 2 === 0 ? -1 : 1;
  selectedPair = (pair + 1) % PAIR_COUNT;
  renderFrame(completePass(frame, pair, fromSide, -fromSide));
}

function lift() {
  if (staticMode) return;
  renderFrame(liftLatest(frame));
}

function release() {
  if (staticMode) return;
  pointerSession = false;
  renderFrame(releaseField());
}

function beginPointerPass(position) {
  const pair = corridorAtPoint(frame, position);
  if (pair === null) return false;
  const entry = corridorPoint(pair, -1);
  const exit = corridorPoint(pair, 1);
  const fromSide = Math.hypot(position.x - entry.x, position.y - entry.y) <= Math.hypot(position.x - exit.x, position.y - exit.y) ? -1 : 1;
  selectedPair = pair;
  pointerSession = true;
  renderFrame(beginPass(frame, pair, fromSide));
  return true;
}

field.addEventListener('pointermove', (event) => {
  if (staticMode) return;
  const position = localPoint(event);
  if (!pointerSession) beginPointerPass(position);
  if (!pointerSession || !frame.pending) return;
  const next = movePass(frame, position);
  renderFrame(next);
  if (next.interaction.startsWith('pass-refused')) pointerSession = false;
});

field.addEventListener('pointerleave', () => {
  if (staticMode || !pointerSession || !frame.pending) return;
  pointerSession = false;
  renderFrame(commitPass(frame));
});

field.addEventListener('pointerup', () => {
  if (staticMode || !pointerSession || !frame.pending) return;
  pointerSession = false;
  renderFrame(commitPass(frame));
});

field.addEventListener('pointercancel', () => {
  pointerSession = false;
  if (staticMode || !frame.pending) return;
  renderFrame({ ...frame, pending: null, interaction: frame.memory.length ? 'settled' : 'quiet', event: null });
});

document.querySelector('#pass-control').addEventListener('click', passNext);
document.querySelector('#lift-control').addEventListener('click', lift);
document.querySelector('#release-control').addEventListener('click', release);

field.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    selectedPair = (selectedPair + (event.key === 'ArrowRight' ? 1 : -1) + PAIR_COUNT) % PAIR_COUNT;
    renderFrame({ ...frame, interaction: 'pair-selected', event: null });
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const fromSide = frame.memory.length % 2 === 0 ? -1 : 1;
    renderFrame(completePass(frame, selectedPair, fromSide, -fromSide));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

if (html.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window.__mutineSvgV049 = {
  getFrame: () => frame,
  getState: () => ({
    memory: frame.memory.length,
    interaction: frame.interaction,
    signature: geometrySignature(frame),
    cuts: frame.cuts.length,
    pending: Boolean(frame.pending)
  }),
  geometrySignature: () => geometrySignature(frame),
  corridorPoint,
  passNext,
  release
};
window._mutineReady = true;
