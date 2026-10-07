import {
  MEMORY_LIMIT,
  STAGES,
  STATION_COUNT,
  applyDrawnSpan,
  armStation,
  buildTimeline,
  geometrySignature,
  liftLatestCut,
  releaseBoundary
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const drawControl = document.querySelector('#draw-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;
const GESTURE = 'drawn-span';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#0e0c18',
  paper: '#f1e8d2',
  line: '#b59cff',
  cyan: '#78d4d0',
  saffron: '#f4ba62',
  vermilion: '#ef7362',
  ink: '#0a0810'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let selectedStation = 1;
let pointerSession = null;
let pointerPoint = null;
let notice = '';

const px = (value) => Number(value).toFixed(2);
const pointAt = ([x, y]) => `${px(x)} ${px(y)}`;

function viewPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  const transform = field.getScreenCTM?.();
  if (transform) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
    return [point.x, point.y];
  }
  return [
    ((clientX - bounds.left) / Math.max(1, bounds.width)) * 1000,
    ((clientY - bounds.top) / Math.max(1, bounds.height)) * 680
  ];
}

function nearestStation(clientX, clientY, frame = interactionBase()) {
  const [x, y] = viewPoint(clientX, clientY);
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  frame.stations.forEach((station, index) => {
    const [sx, sy] = station.position;
    const distance = (x - sx) ** 2 + (y - sy) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

function render(frame, state = 'sequence') {
  const latest = frame.memory.at(-1);
  const stateLabel = state === 'rupture-transfer'
    ? 'SPAN COMMITTED / RUPTURE TRANSFERRED'
    : state === 'lifted'
      ? 'LATEST TRANSFER LIFTED / PRIOR CONTOUR RESTORED'
      : state === 'same-station-refused'
        ? 'SAME STATION REFUSED / DRAW ELSEWHERE'
        : state === 'memory-limit-refused'
          ? 'MEMORY FULL / RELEASE OR LIFT'
          : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const markers = blind ? '' : frame.stations.map((station) => {
    const [x, y] = station.position;
    const armedClass = frame.armed === station.index ? ' station-mark--armed' : '';
    return `<circle class="station-mark station-mark--${station.role}${armedClass}" data-station="${station.index}" cx="${px(x)}" cy="${px(y)}" r="${frame.armed === station.index ? 17 : 12}"/>`;
  }).join('');
  const endpoints = blind ? '' : frame.boundary.endpoints.map((point) => `<circle class="endpoint" cx="${pointAt(point).replace(' ', '" cy="')}" r="4"/>`).join('');
  const gesture = pointerSession && pointerPoint && !blind
    ? `<line class="gesture-line" x1="${px(pointerSession.start[0])}" y1="${px(pointerSession.start[1])}" x2="${px(pointerPoint[0])}" y2="${px(pointerPoint[1])}"/>`
    : '';
  const labels = blind ? '' : `<g class="svg-labels"><text x="40" y="632">${stateLabel}</text><text x="960" y="632" text-anchor="end">${STATION_COUNT} STATIONS / ${frame.memory.length} TRANSFERS / ${latest ? `${latest.source + 1} → ${latest.target + 1} → ${latest.relay + 1}` : 'GAP QUIET'}</text></g>`;
  const centreLabel = blind ? '' : `<text class="centre-label" x="500" y="86" text-anchor="middle">${latest ? 'THE GAP MOVED WITHOUT CLOSING' : 'THE LINE REFUSES CLOSURE'}</text>`;

  field.innerHTML = `<defs>
    <radialGradient id="field-ground" cx="49%" cy="44%" r="76%"><stop offset="0" stop-color="#292252"/><stop offset=".55" stop-color="#141127"/><stop offset="1" stop-color="#07060c"/></radialGradient>
    <linearGradient id="boundary-ink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".38" stop-color="${palette.line}"/><stop offset=".72" stop-color="${palette.cyan}"/><stop offset="1" stop-color="${palette.saffron}"/></linearGradient>
    <filter id="boundary-glow" x="-15%" y="-20%" width="130%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect class="field-ground" x="0" y="0" width="1000" height="680"/>
  <path class="boundary boundary--${frame.memory.length ? 'altered' : 'quiet'}" d="${frame.boundary.pathSignature}"/>
  ${gesture}${endpoints}${markers}${centreLabel}${labels}`;

  stageReadout.textContent = state === 'rupture-transfer'
    ? 'drawn span answered / remote gap moved'
    : state === 'lifted'
      ? 'latest transfer lifted / prior contour restored'
      : state === 'same-station-refused'
        ? 'same place twice / span refused'
        : state === 'memory-limit-refused'
          ? 'three transfers retained / lift or release'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} transfers · ${latest ? `gap at station ${latest.relay + 1}` : 'gap quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.ruptureCount = String(frame.changes.length);
  field.dataset.stationCount = String(frame.stations.length);
  field.dataset.gapAt = String(frame.boundary.gapAt);
  field.dataset.armed = frame.armed === null ? '' : String(frame.armed);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.gesture = GESTURE;
  field.dataset.notice = notice;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (2700 * timeline.length)) / 2700);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'rupture-transfer');
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

function arm(index = selectedStation) {
  if (staticMode || blind) return;
  selectedStation = ((Number(index) % STATION_COUNT) + STATION_COUNT) % STATION_COUNT;
  interactionFrame = armStation(interactionBase(), selectedStation);
  notice = `station-${selectedStation + 1}-armed`;
  render(interactionFrame, 'sequence');
  updateButtons();
}

function deterministicTarget(source, memoryLength) {
  let target = (source + 2 + memoryLength) % STATION_COUNT;
  if (target === source) target = (target + 1) % STATION_COUNT;
  return target;
}

function commit(source, target) {
  const next = applyDrawnSpan(interactionFrame ?? timeline[currentStage], source, target);
  interactionFrame = next;
  selectedStation = target;
  interactionFrame.interaction = next.span.committed ? 'rupture-transfer' : next.interaction;
  notice = next.span.committed ? 'rupture-transfer-committed' : next.interaction;
  if (next.span.committed) interactionFrame.armed = null;
  render(interactionFrame, interactionFrame.interaction);
  updateButtons();
}

function commitDeterministic() {
  const base = interactionFrame ?? timeline[currentStage];
  const source = Number.isInteger(base.armed) ? base.armed : selectedStation;
  commit(source, deterministicTarget(source, base.memory.length));
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...liftLatestCut(base), interaction: 'lifted', armed: null };
  notice = 'latest-transfer-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function release() {
  interactionFrame = null;
  selectedStation = 1;
  pointerSession = null;
  pointerPoint = null;
  notice = 'boundary-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  render(releaseBoundary());
  if (!frozen) requestAnimationFrame(renderCurrent);
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  drawControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v025-broken-contour.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  const frame = interactionBase();
  const source = nearestStation(event.clientX, event.clientY, frame);
  selectedStation = source;
  const [x, y] = viewPoint(event.clientX, event.clientY);
  pointerSession = { source, start: [x, y] };
  pointerPoint = [x, y];
  field.setPointerCapture?.(event.pointerId);
  interactionFrame = armStation(frame, source);
  notice = `station-${source + 1}-armed`;
  render(interactionFrame, 'sequence');
});

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind || !pointerSession) return;
  event.preventDefault();
  pointerPoint = viewPoint(event.clientX, event.clientY);
  render(interactionFrame, 'sequence');
});

field.addEventListener('pointerup', (event) => {
  if (staticMode || blind || !pointerSession) return;
  event.preventDefault();
  const source = pointerSession.source;
  const target = nearestStation(event.clientX, event.clientY, interactionFrame);
  pointerSession = null;
  pointerPoint = null;
  commit(source, target);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  pointerPoint = null;
  render(interactionFrame ?? timeline[currentStage], 'sequence');
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (/^[1-6]$/.test(event.key)) {
    event.preventDefault();
    arm(Number(event.key) - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeterministic();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  } else if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveStill();
  }
});

drawControl.addEventListener('click', commitDeterministic);
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', release);

render(frozen ? timeline.at(-1) : timeline[0]);
updateButtons();
if (!frozen) requestAnimationFrame(renderCurrent);
