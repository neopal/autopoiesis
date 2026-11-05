import {
  beginAttention,
  buildFrame,
  buildTimeline,
  commitAttention,
  geometrySignature,
  handoffAttention,
  liftLatestAttention,
  releaseRegister,
  tileAtPoint
} from './engine.mjs';

const NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#field');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const html = document.documentElement;
const staticMode = html.classList.contains('static-mode') || html.classList.contains('blind-mode');
let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let activePointer = false;

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function makeDefs() {
  const defs = svgElement('defs');
  const ground = svgElement('linearGradient', { id: 'register-ground', x1: '0', y1: '0', x2: '1', y2: '1' });
  ground.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#f3eee3' }),
    svgElement('stop', { offset: '48%', 'stop-color': '#e4dccd' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#d7cdbd' })
  );
  const wash = svgElement('radialGradient', { id: 'register-wash', cx: '.52', cy: '.46', r: '.72' });
  wash.append(
    svgElement('stop', { offset: '0%', 'stop-color': '#fff9ec', 'stop-opacity': '.34' }),
    svgElement('stop', { offset: '100%', 'stop-color': '#aa9276', 'stop-opacity': '.14' })
  );
  const shadow = svgElement('filter', { id: 'register-shadow', x: '-20%', y: '-20%', width: '140%', height: '160%' });
  shadow.append(svgElement('feGaussianBlur', { stdDeviation: '8' }));
  const colors = [
    ['tile-cobalt', '#5e87a0', '#294d65'],
    ['tile-oxide', '#cb8067', '#8f4538'],
    ['tile-ochre', '#d5aa5c', '#98702c'],
    ['tile-moss', '#879276', '#4f5e4a'],
    ['tile-violet', '#9989a1', '#62516b']
  ];
  for (const [id, start, end] of colors) {
    const gradient = svgElement('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '1' });
    gradient.append(
      svgElement('stop', { offset: '0%', 'stop-color': start }),
      svgElement('stop', { offset: '100%', 'stop-color': end })
    );
    defs.append(gradient);
  }
  defs.append(ground, wash, shadow);
  return defs;
}

function toneFor(index) {
  return ['cobalt', 'oxide', 'ochre', 'moss', 'violet'][index % 5];
}

function renderFrame(nextFrame) {
  frame = nextFrame;
  const fragment = document.createDocumentFragment();
  fragment.append(makeDefs());
  fragment.append(svgElement('rect', { class: 'register-ground', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('rect', { class: 'register-wash', x: '0', y: '0', width: '1000', height: '760' }));
  fragment.append(svgElement('ellipse', { class: 'register-ring', cx: '510', cy: '382', rx: '264', ry: '198' }));
  fragment.append(svgElement('ellipse', { class: 'register-ring', cx: '510', cy: '382', rx: '194', ry: '142' }));
  fragment.append(svgElement('path', { class: 'register-tick', d: 'M 456 382 H 564 M 510 328 V 436' }));

  for (const tile of frame.tiles) {
    const attributes = {
      class: 'tile-shadow', d: tile.compoundPath, 'data-tile-shadow': String(tile.index), 'fill-rule': 'evenodd'
    };
    fragment.append(svgElement('path', attributes));
    fragment.append(svgElement('path', {
      class: 'tile', d: tile.compoundPath, 'data-tile': String(tile.index), 'data-state': tile.state,
      'data-tone': toneFor(tile.index), 'fill-rule': 'evenodd'
    }));
    fragment.append(svgElement('path', { class: 'tile-counter', d: tile.counterPath, 'data-counter': String(tile.index) }));
    if (tile.fracturePath) fragment.append(svgElement('path', { class: 'tile-fracture', d: tile.fracturePath, 'data-fracture': String(tile.index) }));
    if (frame.pending.includes(tile.index)) fragment.append(svgElement('path', { class: 'tile-pending', d: tile.outerPath, 'data-pending': String(tile.index) }));
  }

  field.replaceChildren(fragment);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = frame.interaction;
  field.dataset.tileCount = String(frame.tiles.length);
  field.dataset.openedCount = String(frame.tiles.filter((tile) => tile.state === 'opened').length);
  field.dataset.selected = frame.pending.join(',');
  stage.textContent = `${frame.interaction.replaceAll('-', ' ')} / ${String(frame.memory.length).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} handoff${frame.memory.length === 1 ? '' : 's'} · ${frame.memory.length ? 'absence spent elsewhere' : 'no absence spent'}`;
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * 1000, y: ((event.clientY - rect.top) / rect.height) * 760 };
}

function cancelPending() {
  renderFrame({ ...frame, pending: [], interaction: frame.memory.length ? 'settled' : 'quiet', event: null });
}

function deterministicAttention() {
  let next = beginAttention(frame, 2);
  next = handoffAttention(next, 8);
  renderFrame(commitAttention(next));
}

field.addEventListener('pointerdown', (event) => {
  const tile = tileAtPoint(frame, localPoint(event));
  if (tile === null) return;
  activePointer = true;
  try { field.setPointerCapture?.(event.pointerId); } catch {}
  if (!frame.pending.length) renderFrame(beginAttention(frame, tile));
  else if (frame.pending.length === 1) renderFrame(handoffAttention(frame, tile));
});

field.addEventListener('pointermove', (event) => {
  if (!activePointer) return;
  field.dataset.hover = String(tileAtPoint(frame, localPoint(event)) ?? '');
});

field.addEventListener('pointerup', (event) => {
  if (!activePointer) return;
  activePointer = false;
  try { field.releasePointerCapture?.(event.pointerId); } catch {}
  if (frame.pending.length === 2) renderFrame(commitAttention(frame));
  else if (frame.interaction !== 'attention-refused-repeat') renderFrame({ ...frame, interaction: 'attention-held', event: null });
});

field.addEventListener('pointercancel', () => {
  activePointer = false;
  cancelPending();
});

document.querySelector('#attend-control').addEventListener('click', deterministicAttention);
document.querySelector('#lift-control').addEventListener('click', () => renderFrame(liftLatestAttention(frame)));
document.querySelector('#release-control').addEventListener('click', () => renderFrame(releaseRegister()));

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    if (!frame.pending.length) renderFrame(beginAttention(frame, 2));
    else if (frame.pending.length === 1) renderFrame(handoffAttention(frame, (frame.pending[0] + 6) % frame.tiles.length));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    renderFrame(commitAttention(frame));
  } else if (event.key === 'Delete') {
    event.preventDefault();
    renderFrame(liftLatestAttention(frame));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    renderFrame(releaseRegister());
  }
});

if (document.documentElement.classList.contains('static-mode')) field.removeAttribute('aria-keyshortcuts');
renderFrame(frame);
window._mutineReady = true;
field.dataset.ready = 'true';
