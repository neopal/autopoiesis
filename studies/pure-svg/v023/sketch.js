import {
  CHAMBER_COUNT,
  HOLD_THRESHOLD,
  MEMORY_LIMIT,
  STAGES,
  applyDryingHold,
  buildTimeline,
  geometrySignature,
  liftLatestDrying,
  releaseDrying
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const dryControl = document.querySelector('#dry-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES); // press-and-hold is the only committing visitor gesture.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#151311',
  sheet: '#d6b98e',
  sheetLight: '#f0d5a8',
  sheetDark: '#765644',
  sealed: '#b8664c',
  opened: '#7da6a4',
  bridge: '#d0a266',
  ink: '#16110e',
  paper: '#eadcc9',
  muted: '#ae9d86'
};

const chamberCenters = [
  [248, 255], [433, 190], [664, 211], [342, 380], [654, 391]
];

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let selectedChamber = 2;
let pointerSession = null;
let notice = '';

const px = (value) => Number(value).toFixed(2);
const pointAt = ([x, y]) => `${px(x)} ${px(y)}`;
const polygonPath = (points) => `M ${points.map(pointAt).join(' L ')} Z`;
const centroid = (points) => points.reduce(([x, y], [pxValue, pyValue]) => [x + pxValue / points.length, y + pyValue / points.length], [0, 0]);

function chamberAtClient(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  const x = ((clientX - bounds.left) / Math.max(1, bounds.width)) * 1000;
  const y = ((clientY - bounds.top) / Math.max(1, bounds.height)) * 680;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  chamberCenters.forEach(([cx, cy], index) => {
    const distance = (x - cx) ** 2 + (y - cy) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

function render(frame, state = 'sequence') {
  const latest = frame.memory.at(-1);
  const stateLabel = state === 'topology-threshold'
    ? 'DWELL COMMITTED / VOID SEALED / VOID OPENED'
    : state === 'lifted'
      ? 'LATEST DWELL LIFTED / SHEET RESTORED'
      : state === 'refused'
        ? 'QUICK TOUCH REFUSED / STAY LONGER'
        : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const chambers = frame.chambers.map((chamber) => `<path class="chamber chamber--${chamber.role}" data-chamber="${chamber.index}" d="${polygonPath(chamber.points)}"/>`).join('');
  const marks = blind || selectedChamber === null ? '' : `<g class="hold-mark"><circle cx="${chamberCenters[selectedChamber][0]}" cy="${chamberCenters[selectedChamber][1]}" r="10"/><circle cx="${chamberCenters[selectedChamber][0]}" cy="${chamberCenters[selectedChamber][1]}" r="17"/></g>`;
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="632">${stateLabel}</text><text x="958" y="632" text-anchor="end">${CHAMBER_COUNT} VOIDS / ${frame.memory.length} DRYINGS / VOID ${latest ? latest.source + 1 : '—'}</text></g>`;
  const centreLabel = blind ? '' : `<text class="centre-label" x="500" y="86" text-anchor="middle">${latest ? 'THE SHEET HAS SET' : 'DWELLING MATERIAL'}</text>`;

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="50%" cy="40%" r="74%"><stop offset="0" stop-color="#34271f"/><stop offset=".6" stop-color="#191513"/><stop offset="1" stop-color="#0b0a09"/></radialGradient>
    <linearGradient id="sheet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.sheetLight}"/><stop offset=".42" stop-color="${palette.sheet}"/><stop offset="1" stop-color="${palette.sheetDark}"/></linearGradient>
    <linearGradient id="sheet-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c8" stop-opacity=".82"/><stop offset="1" stop-color="#6d4b3b" stop-opacity=".2"/></linearGradient>
    <filter id="sheet-shadow" x="-25%" y="-25%" width="160%" height="170%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="grain" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M -8 26 L 26 -8 M 7 40 L 40 7" fill="none" stroke="#fff1cf" stroke-opacity=".08" stroke-width="1"/></pattern>
    <clipPath id="outer-clip"><path d="${frame.sheet.outerPath}"/></clipPath>
  </defs>
  <rect class="sheet-ground" x="0" y="0" width="1000" height="680"/>
  <path class="sheet-shadow" d="${frame.sheet.pathSignature}" fill-rule="evenodd" transform="translate(18 24)"/>
  <path class="sheet" d="${frame.sheet.pathSignature}" fill-rule="evenodd"/>
  <rect class="sheet-grain" x="0" y="0" width="1000" height="680" clip-path="url(#outer-clip)"/>
  <path class="sheet-outline" d="${frame.sheet.outerPath}"/>
  <g class="chambers">${chambers}</g>
  ${marks}
  ${centreLabel}
  ${labels}`;

  stageReadout.textContent = state === 'topology-threshold'
    ? 'hold crossed threshold / one void sealed / one void opened'
    : state === 'lifted'
      ? 'latest drying lifted / prior signature restored'
      : state === 'refused'
        ? 'short touch refused / material needs duration'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} dryings · ${latest ? `void ${latest.source + 1} remembers` : 'sheet quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.dryingCount = String(frame.changes.length);
  field.dataset.chamberCount = String(frame.chambers.length);
  field.dataset.chamber = String(frame.ruleCursor ?? '');
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.notice = notice;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (2700 * timeline.length)) / 2700);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'topology-threshold');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1));
    return;
  }
  const frame = frameAt(now);
  if (frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = frame.stage;
    lastPaint = now;
    render(frame);
  }
  requestAnimationFrame(renderCurrent);
}

function interactionBase() {
  return interactionFrame ?? timeline[currentStage];
}

function commitDrying(source = selectedChamber, dwell = 620) {
  const base = interactionBase();
  if (base.memory.length >= MEMORY_LIMIT) return;
  const next = applyDryingHold(base, source, dwell);
  interactionFrame = next;
  if (next.drying.committed) {
    interactionFrame.interaction = 'topology-threshold';
    notice = 'dwell-threshold-committed';
  } else {
    interactionFrame.interaction = 'refused';
    notice = 'hold-too-short';
  }
  render(interactionFrame, interactionFrame.interaction);
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...liftLatestDrying(base), interaction: 'lifted' };
  notice = 'latest-drying-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function releaseSheet() {
  interactionFrame = null;
  selectedChamber = 2;
  notice = 'sheet-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  render(releaseDrying());
  if (!frozen) requestAnimationFrame(renderCurrent);
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  dryControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v023-drying-sheet.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  selectedChamber = chamberAtClient(event.clientX, event.clientY);
  field.dataset.selectedChamber = String(selectedChamber);
  render(interactionBase(), interactionFrame?.interaction ?? 'sequence');
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  selectedChamber = chamberAtClient(event.clientX, event.clientY);
  pointerSession = { pointerId: event.pointerId, chamber: selectedChamber, startedAt: performance.now() };
  notice = 'hold-started';
  field.dataset.notice = notice;
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || staticMode || blind) return;
  event.preventDefault();
  const session = pointerSession;
  pointerSession = null;
  const dwell = performance.now() - session.startedAt;
  commitDrying(session.chamber, dwell);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  notice = 'hold-cancelled';
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (/^[1-5]$/.test(event.key)) {
    event.preventDefault();
    selectedChamber = Number(event.key) - 1;
    notice = `void-${selectedChamber + 1}-selected`;
    render(interactionBase(), interactionFrame?.interaction ?? 'sequence');
  }
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    commitDrying(selectedChamber, 620);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseSheet();
  }
});

dryControl.addEventListener('click', () => commitDrying(selectedChamber, 620));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseSheet);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
