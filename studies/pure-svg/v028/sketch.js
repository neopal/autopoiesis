import {
  MEMORY_WINDOW,
  PLATE_COUNT,
  applyDeparture,
  armPlate,
  buildFrame,
  geometrySignature,
  liftLatestDeparture,
  releaseArray
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const departControl = document.querySelector('#depart-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const palette = ['#e5a36d', '#9cc8bf', '#bd91aa', '#d7c186', '#83a9c4', '#e0c8aa', '#a4b8a2'];
let frame = buildFrame(0, []);
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fixed = (value) => Number(value).toFixed(2);

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Number(clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1).toFixed(4)),
    y: Number(clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1).toFixed(4))
  };
}

function splitSignature(signature) {
  const separator = signature.indexOf('|');
  return {
    d: signature.slice(0, separator),
    transform: signature.slice(separator + 1)
  };
}

function stateLabel(current) {
  if (current.interaction === 'attention-armed') return 'ATTENTION HELD / NO DEPARTURE YET';
  if (current.interaction === 'departure-relay') return 'DEPARTURE REGISTERED / OPENING RELAYED';
  if (current.interaction === 'departure-lifted') return 'LATEST DEPARTURE LIFTED / ARRAY RESTORED';
  if (current.interaction === 'departure-memory-full') return 'FOUR DEPARTURES RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'released') return 'ARRAY RELEASED / OPENINGS AT SEED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 12`;
}

function render(current = frame) {
  const latest = current.memory.at(-1);
  const armed = current.armedSource;
  const active = new Set(latest ? [latest.source, latest.target, latest.relay] : []);
  const plates = current.plates.map((plate, index) => {
    const { d, transform } = splitSignature(plate.pathSignature);
    const classes = ['plate'];
    if (index === armed) classes.push('plate--armed');
    if (latest?.source === index) classes.push('plate--source');
    if (latest?.target === index) classes.push('plate--target');
    if (latest?.relay === index) classes.push('plate--relay');
    const colour = palette[index % palette.length];
    return `<g class="plate-group ${classes.join(' ')}" data-plate="${index}">
      <path class="plate-shadow" d="${d}" transform="${transform} translate(8 11)" fill="#000" fill-opacity=".42" fill-rule="evenodd"/>
      <path class="plate" data-plate-path="${index}" d="${d}" transform="${transform}" fill="${colour}" fill-rule="evenodd"/>
      <path class="plate-echo" d="${d}" transform="${transform}" fill="none"/>
    </g>`;
  }).join('');
  const relayLines = latest ? `<g class="relay-lines" aria-hidden="true">
    <path d="M ${fixed(current.plates[latest.source].x * 1000)} ${fixed(current.plates[latest.source].y * 680)} C 330 340 420 340 ${fixed(current.plates[latest.target].x * 1000)} ${fixed(current.plates[latest.target].y * 680)}"/>
    <path d="M ${fixed(current.plates[latest.target].x * 1000)} ${fixed(current.plates[latest.target].y * 680)} C 650 380 700 380 ${fixed(current.plates[latest.relay].x * 1000)} ${fixed(current.plates[latest.relay].y * 680)}"/>
  </g>` : '';
  const labels = blind ? '' : `<g class="field-labels">
    <text x="42" y="52">${stateLabel(current)}</text>
    <text x="958" y="638" text-anchor="end">${PLATE_COUNT} PLATES / ${current.memory.length} DEPARTURES / ${latest ? `RELAY ${latest.relay + 1}` : 'NO OPENING MOVES'}</text>
  </g>`;
  const focus = !blind && (armed !== null && armed !== undefined)
    ? `<circle class="attention-mark" cx="${fixed(current.plates[armed].x * 1000)}" cy="${fixed(current.plates[armed].y * 680)}" r="${fixed(46 + current.plates[armed].w * 100)}"/>`
    : '';

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="47%" cy="38%" r="90%"><stop offset="0" stop-color="#26353a"/><stop offset=".5" stop-color="#121b1e"/><stop offset="1" stop-color="#080b0c"/></radialGradient>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e5a36d" stop-opacity=".13"/><stop offset=".47" stop-color="#9cc8bf" stop-opacity=".025"/><stop offset="1" stop-color="#bd91aa" stop-opacity=".1"/></linearGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="28" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .1"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <rect class="field-wash" x="18" y="18" width="964" height="644" rx="8" filter="url(#grain)"/>
  <path class="field-axis" d="M 64 340 H 936 M 500 54 V 626"/>
  <g class="plate-field">${relayLines}${plates}${focus}</g>${labels}`;

  stageReadout.textContent = current.interaction === 'attention-armed'
    ? 'attention held · memory remains unchanged'
    : current.interaction === 'departure-relay'
      ? 'departure made the opening travel'
      : current.interaction === 'departure-lifted'
        ? 'latest departure lifted · prior array restored'
        : current.interaction === 'departure-memory-full'
          ? 'four departures retained · lift or release'
          : current.interaction === 'released'
            ? 'array released · seed geometry restored'
            : `stage ${String(current.stage).padStart(2, '0')} / 12`;
  memoryReadout.textContent = `${current.memory.length} departures · ${latest ? `plate ${latest.source + 1} → ${latest.target + 1} → ${latest.relay + 1}` : 'the plates are quiet'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.plateCount = String(current.plates.length);
  field.dataset.pathCount = String(current.plates.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.source = latest ? String(latest.source) : '';
  field.dataset.target = latest ? String(latest.target) : '';
  field.dataset.relay = latest ? String(latest.relay) : '';
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  departControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
}

function interactionBase() {
  return frame;
}

function arm(point) {
  if (staticMode || blind) return;
  frame = armPlate(interactionBase(), point);
  notice = 'attention-armed-no-write';
  render(frame);
}

function depart(point) {
  if (staticMode || blind) return;
  frame = applyDeparture(interactionBase(), point);
  notice = frame.event?.committed ? 'departure-relay-registered' : 'departure-memory-full';
  render(frame);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestDeparture(frame);
  notice = 'latest-departure-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseArray();
  notice = 'array-released';
  render(frame);
}

field.addEventListener('pointermove', (event) => {
  if (!pointerSession && !staticMode && !blind) arm(normalizedPoint(event.clientX, event.clientY));
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  const point = normalizedPoint(event.clientX, event.clientY);
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, point };
  arm(point);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  field.releasePointerCapture?.(event.pointerId);
  depart(pointerSession.point);
  pointerSession = null;
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  frame = buildFrame(frame.stage, frame.memory);
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    depart({ x: 0.5, y: 0.28 });
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

departControl.addEventListener('click', () => depart({ x: 0.5, y: 0.28 }));
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
