import {
  buildFrame,
  buildTimeline,
  commitRelay,
  geometrySignature,
  liftLatest,
  releaseLedger
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#relay-field');
const svg = document.querySelector('[data-relay-svg]');
const stageReadout = document.querySelector('[data-relay-stage]');
const memoryReadout = document.querySelector('[data-relay-memory]');
const selectionReadout = document.querySelector('[data-selection]');
const stateReadout = document.querySelector('[data-interaction-state]');
const staticMode = params.get('static') === '1';
const blindMode = params.get('blind') === '1';

const PALETTE = {
  night: '#16111d',
  nightDeep: '#0a0710',
  ink: '#f2e9d8',
  apricot: '#ef9a69',
  lime: '#cbd77a',
  blue: '#7ab8c0',
  violet: '#8f74b9',
  shadow: '#08050d'
};

const RELAY_PLAN = [
  { source: 'west', receiver: 'east', pressure: 0.76, counterpressure: 0.82, shear: 0.28 },
  { source: 'north', receiver: 'south', pressure: 0.64, counterpressure: 0.78, shear: -0.22 },
  { source: 'east', receiver: 'north', pressure: 0.71, counterpressure: 0.88, shear: 0.31 },
  { source: 'south', receiver: 'west', pressure: 0.83, counterpressure: 0.74, shear: -0.18 }
];
const STATIONS = {
  north: [0.50, 0.035],
  east: [0.965, 0.50],
  south: [0.50, 0.965],
  west: [0.035, 0.50]
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let selectedRelay = frame.memory.length % RELAY_PLAN.length;
let pointerId = null;
let pointerStart = null;
let gesturePath = [];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function messageFor(interaction) {
  const messages = {
    'quiet ledger': 'The ledger is quiet. Give the pressure somewhere else to go.',
    'relay committed': 'The pressure crossed hands. Every deposit remembers the transfer.',
    'refused / incomplete relay': 'The ledger refuses: use two different seams and bend the pressure.',
    'refused / ledger is full': 'Four transfers are retained. Lift one before making another.',
    'lifted / exact': 'The latest transfer is lifted. The preceding ledger returns exactly.',
    'lift refused / ledger is quiet': 'There is no transfer to lift.',
    'dry ledger': 'The ledger is dry. No transfer remains.'
  };
  return messages[interaction] || messages['quiet ledger'];
}

function pathFor(points) {
  if (!points.length) return '';
  const first = points[0];
  const commands = [`M ${(first.x * 1000).toFixed(2)} ${(first.y * 700).toFixed(2)}`];
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${(points[index].x * 1000).toFixed(2)} ${(points[index].y * 700).toFixed(2)}`);
  }
  return `${commands.join(' ')} Z`;
}

function relayPath(relay) {
  return `M ${(relay.start.x * 1000).toFixed(2)} ${(relay.start.y * 700).toFixed(2)} Q ${(relay.control.x * 1000).toFixed(2)} ${(relay.control.y * 700).toFixed(2)} ${(relay.end.x * 1000).toFixed(2)} ${(relay.end.y * 700).toFixed(2)}`;
}

function renderSvg() {
  const relayColours = [PALETTE.apricot, PALETTE.blue, PALETTE.lime, PALETTE.violet];
  const backgroundMarks = Array.from({ length: 19 }, (_, index) => {
    const x = 80 + ((index * 137) % 840);
    const y = 92 + ((index * 89) % 510);
    const length = 38 + (index % 4) * 13;
    return `<path d="M ${x} ${y} l ${length} ${index % 2 ? 9 : -7}" stroke="${PALETTE.ink}" stroke-opacity=".065" stroke-width="1"/>`;
  }).join('');
  const relays = frame.body.relays.map((relay, index) => `<path class="relay-line" d="${relayPath(relay)}" stroke="${relayColours[index % relayColours.length]}" stroke-opacity="${0.2 + index * 0.06}" stroke-width="${(relay.width * 1000).toFixed(2)}" stroke-dasharray="${index % 2 ? '2 9' : '1 12'}"/>`).join('');
  const deposits = frame.body.deposits.map((deposit, index) => {
    const d = pathFor(deposit.points);
    const inner = deposit.points.map((point) => ({ x: deposit.x + (point.x - deposit.x) * 0.78, y: deposit.y + (point.y - deposit.y) * 0.72 }));
    const innerPath = pathFor(inner);
    const colour = index % 3 === 0 ? PALETTE.apricot : index % 3 === 1 ? PALETTE.ink : PALETTE.blue;
    const shadow = deposit.points.map((point) => ({ x: point.x + 0.012, y: point.y + 0.018 }));
    return `<g class="deposit" data-deposit="${index}">
      <path d="${pathFor(shadow)}" fill="${PALETTE.shadow}" fill-opacity=".74"/>
      <path d="${d}" fill="${colour}" fill-opacity=".94" stroke="${PALETTE.ink}" stroke-opacity=".42" stroke-width="2"/>
      <path d="${innerPath}" fill="none" stroke="${PALETTE.night}" stroke-opacity=".28" stroke-width="2"/>
      <circle cx="${(deposit.x * 1000).toFixed(2)}" cy="${(deposit.y * 700).toFixed(2)}" r="2.3" fill="${PALETTE.lime}" fill-opacity=".${index % 2 ? '24' : '16'}"/>
    </g>`;
  }).join('');
  svg.innerHTML = `<defs>
    <radialGradient id="relay-ground" cx="52%" cy="40%" r="76%"><stop offset="0" stop-color="#33233d"/><stop offset=".58" stop-color="${PALETTE.night}"/><stop offset="1" stop-color="${PALETTE.nightDeep}"/></radialGradient>
    <filter id="relay-grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="2" seed="54"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect width="1000" height="700" fill="url(#relay-ground)"/>
  <ellipse class="field-glow" cx="510" cy="350" rx="350" ry="260" fill="${PALETTE.violet}" fill-opacity=".06" filter="url(#relay-grain)"/>
  <g aria-hidden="true">${backgroundMarks}</g>
  <g aria-hidden="true">${relays}</g>
  <g>${deposits}</g>`;
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  const plan = RELAY_PLAN[selectedRelay];
  if (stageReadout) stageReadout.textContent = `RELAY ${String(frame.memory.length).padStart(2, '0')} / 04`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'transfer retained' : 'quiet ledger'} · ${frame.memory.length} relay${frame.memory.length === 1 ? '' : 's'} stored`;
  if (selectionReadout) selectionReadout.textContent = `${plan.source} → ${plan.receiver} / ${frame.interaction === 'relay committed' ? 'remembered' : 'ready'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  renderSvg();
}

function normalizedPoint(event) {
  const rect = svg.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
}

function stationAt(point) {
  const margin = 0.14;
  if (point.x <= margin) return 'west';
  if (point.x >= 1 - margin) return 'east';
  if (point.y <= margin) return 'north';
  if (point.y >= 1 - margin) return 'south';
  return null;
}

function pathLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  return length;
}

function gestureShear(points, source, receiver) {
  const start = STATIONS[source];
  const end = STATIONS[receiver];
  const middle = points[Math.floor(points.length / 2)] || { x: .5, y: .5 };
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const distance = Math.hypot(dx, dy) || 1;
  return ((middle.x - start[0]) * dy - (middle.y - start[1]) * dx) / distance;
}

function eventFromGesture(points, source, receiver) {
  const length = pathLength(points);
  const shear = gestureShear(points, source, receiver);
  return {
    source,
    receiver,
    pressure: clamp(.44 + length * .54, 0, 1),
    counterpressure: clamp(.52 + Math.abs(shear) * .82 + Math.min(.12, points.length * .01), 0, 1),
    shear: clamp(shear * 2.2, -1, 1)
  };
}

function commitPlannedRelay() {
  const result = commitRelay(frame, RELAY_PLAN[selectedRelay]);
  renderFrame({ ...result.field, selectedSource: RELAY_PLAN[selectedRelay].source, selectedReceiver: RELAY_PLAN[selectedRelay].receiver });
}

function lift() {
  renderFrame(liftLatest(frame));
}

function release() {
  renderFrame(releaseLedger());
}

function downloadSvg() {
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mutine-brush-v054-relay-ledger.svg';
  anchor.click();
  URL.revokeObjectURL(url);
}

function attachEvents() {
  if (staticMode || blindMode) return;
  svg.addEventListener('pointerdown', (event) => {
    const point = normalizedPoint(event);
    pointerStart = stationAt(point);
    gesturePath = pointerStart ? [point] : [];
    pointerId = pointerStart ? event.pointerId : null;
    if (pointerId !== null) svg.setPointerCapture?.(pointerId);
    event.preventDefault();
  });
  svg.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    gesturePath.push(normalizedPoint(event));
    event.preventDefault();
  });
  svg.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointerId) return;
    gesturePath.push(normalizedPoint(event));
    const receiver = stationAt(gesturePath.at(-1));
    const next = pointerStart && receiver ? commitRelay(frame, eventFromGesture(gesturePath, pointerStart, receiver)).field : { ...frame, interaction: 'refused / incomplete relay' };
    renderFrame(next);
    pointerId = null;
    pointerStart = null;
    gesturePath = [];
    event.preventDefault();
  });
  svg.addEventListener('pointercancel', () => {
    pointerId = null;
    pointerStart = null;
    gesturePath = [];
    renderFrame({ ...frame, interaction: 'refused / incomplete relay' });
  });
  document.querySelectorAll('[data-gesture]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.gesture === 'relay') commitPlannedRelay();
      if (button.dataset.gesture === 'lift') lift();
      if (button.dataset.gesture === 'release') release();
    });
  });
}

function handleKey(event) {
  const key = event.key;
  if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Delete', 'Backspace', 'Escape'].includes(key)) event.preventDefault();
  if (key === 'ArrowLeft') {
    selectedRelay = (selectedRelay + RELAY_PLAN.length - 1) % RELAY_PLAN.length;
    renderFrame({ ...frame, interaction: 'quiet ledger' });
  }
  if (key === 'ArrowRight') {
    selectedRelay = (selectedRelay + 1) % RELAY_PLAN.length;
    renderFrame({ ...frame, interaction: 'quiet ledger' });
  }
  if (key === 'Enter' || key === ' ') commitPlannedRelay();
  if (key === 'Delete' || key === 'Backspace') lift();
  if (key === 'Escape' || key.toLowerCase() === 'r') release();
  if (key.toLowerCase() === 's') downloadSvg();
}

window._p5Ready = true;
window.__mutineBrushV054 = {
  ready: true,
  getFrame: () => frame,
  geometrySignature: () => geometrySignature(frame),
  relay: (event = RELAY_PLAN[selectedRelay]) => { const result = commitRelay(frame, event); renderFrame(result.field); return frame; },
  lift: () => { lift(); return frame; },
  release: () => { release(); return frame; }
};

attachEvents();
field.addEventListener('keydown', handleKey);
renderFrame(frame);
