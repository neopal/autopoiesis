import {
  CELL_COUNT,
  MEMORY_WINDOW,
  applyFusion,
  armCell,
  buildFrame,
  geometrySignature,
  liftLatestFusion,
  releaseField
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const offerControl = document.querySelector('#offer-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const palette = ['#e6a46c', '#82bdb1', '#c98f9b', '#dfcb8c', '#8ea9c2', '#d6b89c', '#9eb49f', '#b6a5c8', '#d3a878'];
let frame = buildFrame(0, []);
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Number(clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1).toFixed(4)),
    y: Number(clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1).toFixed(4))
  };
}

function stateLabel(current) {
  if (current.interaction === 'first-place-armed') return 'ONE PLACE OFFERED / WAITING FOR ANOTHER';
  if (current.interaction === 'seam-fused') return 'SEAM FUSED / REMOTE BODY RE-FORMED';
  if (current.interaction === 'fusion-refused-same-place') return 'SAME PLACE REFUSED / OFFER STILL OPEN';
  if (current.interaction === 'fusion-lifted') return 'LATEST FUSION LIFTED / PRIOR FIELD RESTORED';
  if (current.interaction === 'fusion-memory-full') return 'FOUR FUSIONS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'released') return 'FIELD RELEASED / SEAM AT SEED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 12`;
}

function relayPath(current) {
  const latest = current.event?.committed ? current.event : null;
  if (!latest || blind) return '';
  const source = current.cells[latest.source];
  const target = current.cells[latest.target];
  const relay = current.cells[latest.relay];
  return `<g class="relay-thread" aria-hidden="true"><path d="M ${fixed(source.x * 1000)} ${fixed(source.y * 680)} C 390 92 610 118 ${fixed(target.x * 1000)} ${fixed(target.y * 680)}"/><path d="M ${fixed(target.x * 1000)} ${fixed(target.y * 680)} C 760 420 360 560 ${fixed(relay.x * 1000)} ${fixed(relay.y * 680)}"/></g>`;
}

function render(current = frame) {
  const latest = current.event?.committed ? current.event : null;
  const cells = current.cells.map((cell, index) => {
    const classes = ['cell'];
    if (current.armedSource === index) classes.push('cell--armed');
    if (latest?.source === index) classes.push('cell--source');
    if (latest?.target === index) classes.push('cell--target');
    if (latest?.relay === index) classes.push('cell--relay');
    return `<g class="cell-group ${classes.join(' ')}" data-cell="${index}">
      <path class="cell-shadow" d="${cell.pathSignature}" transform="translate(8 12)"/>
      <path class="cell-body" data-cell-path="${index}" d="${cell.pathSignature}" fill="${palette[index % palette.length]}" fill-rule="evenodd"/>
      <path class="cell-edge" d="${cell.pathSignature}"/>
    </g>`;
  }).join('');
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="50">${stateLabel(current)}</text><text x="958" y="638" text-anchor="end">${CELL_COUNT} BODIES / ${current.memory.length} FUSIONS / ${latest ? `RELAY ${latest.relay + 1}` : 'NO ANSWER YET'}</text></g>`;
  const armMark = !blind && current.armedSource !== null && current.armedSource !== undefined
    ? `<circle class="offer-mark" cx="${fixed(current.cells[current.armedSource].x * 1000)}" cy="${fixed(current.cells[current.armedSource].y * 680)}" r="${fixed(46 + current.cells[current.armedSource].w * 100)}"/>`
    : '';

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="50%" cy="46%" r="78%"><stop offset="0" stop-color="#263a3b"/><stop offset=".53" stop-color="#131f20"/><stop offset="1" stop-color="#080b0c"/></radialGradient>
    <linearGradient id="glaze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6a46c" stop-opacity=".13"/><stop offset=".48" stop-color="#82bdb1" stop-opacity=".03"/><stop offset="1" stop-color="#c98f9b" stop-opacity=".1"/></linearGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="29" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <rect class="field-glaze" x="18" y="18" width="964" height="644" rx="24" filter="url(#grain)"/>
  <path class="field-void" d="M 500 254 C 570 250 632 300 645 350 C 657 402 598 451 516 456 C 426 462 360 416 371 356 C 381 301 430 259 500 254 Z"/>
  <path class="field-crease" d="M 124 510 C 305 576 696 104 874 194"/>
  <g class="woven-field">${relayPath(current)}${cells}${armMark}</g>${labels}`;

  stageReadout.textContent = current.interaction === 'first-place-armed'
    ? 'one place offered · memory remains unchanged'
    : current.interaction === 'seam-fused'
      ? 'second place answered · three bodies re-formed'
      : current.interaction === 'fusion-refused-same-place'
        ? 'same place refused · offer remains open'
        : current.interaction === 'fusion-lifted'
          ? 'latest fusion lifted · prior field restored'
          : current.interaction === 'fusion-memory-full'
            ? 'four fusions retained · lift or release'
            : current.interaction === 'released'
              ? 'field released · seed geometry restored'
              : `stage ${String(current.stage).padStart(2, '0')} / 12`;
  memoryReadout.textContent = `${current.memory.length} fusions · ${latest ? `body ${latest.source + 1} ⇄ ${latest.target + 1} ⇢ ${latest.relay + 1}` : 'the seam is waiting'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.cellCount = String(current.cells.length);
  field.dataset.pathCount = String(current.cells.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.source = latest ? String(latest.source) : '';
  field.dataset.target = latest ? String(latest.target) : '';
  field.dataset.relay = latest ? String(latest.relay) : '';
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  offerControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  offerControl.textContent = current.armedSource === null ? 'offer another place' : 'answer the offered place';
}

function arm(point) {
  if (staticMode || blind) return;
  frame = armCell(frame, point);
  notice = 'first-place-offered-no-write';
  render(frame);
}

function fuse(point) {
  if (staticMode || blind) return;
  frame = applyFusion(frame, point);
  notice = frame.event?.committed ? 'seam-fused' : frame.interaction;
  render(frame);
}

function offer(point = { x: 0.18, y: 0.34 }) {
  if (frame.armedSource === null || frame.armedSource === undefined) arm(point);
  else fuse({ x: 0.82, y: 0.68 });
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestFusion(frame);
  notice = 'latest-fusion-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseField();
  notice = 'field-released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  const point = normalizedPoint(event.clientX, event.clientY);
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId };
  if (frame.armedSource === null || frame.armedSource === undefined) arm(point);
  else fuse(point);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  field.releasePointerCapture?.(event.pointerId);
  pointerSession = null;
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    offer();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

offerControl.addEventListener('click', () => offer());
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
