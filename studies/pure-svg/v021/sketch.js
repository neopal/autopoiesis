import {
  MEMORY_LIMIT,
  STAGES,
  STATION_COUNT,
  applyPressure,
  buildTimeline,
  geometrySignature,
  releasePressure,
  removeLatestPressure
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressureControl = document.querySelector('#pressure-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2450;
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
  ground: '#e6e2d8',
  paper: '#f5f1e8',
  ink: '#1e2631',
  blue: '#315d72',
  rust: '#c85b43',
  ochre: '#c79d57',
  quiet: '#b4b2a7'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let requestedStation = 3;
let notice = '';
let drag = null;

const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 680).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;

function polygonPath(points) {
  return `M ${points.map(pointAt).join(' L ')} Z`;
}

function centerlinePath(stations) {
  return `M ${stations.map(pointAt).join(' L ')}`;
}

function stationAtClientX(clientX) {
  const bounds = field.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width)));
  return Math.max(0, Math.min(STATION_COUNT - 1, Math.round(fraction * (STATION_COUNT - 1))));
}

function travelDistance(start, current) {
  return Math.hypot(current.x - start.x, current.y - start.y);
}

function render(frame, state = 'sequence') {
  const latest = frame.memory.at(-1);
  const stateLabel = state === 'material-crease'
    ? 'PRESSURE HELD / MATERIAL CHANGED'
    : state === 'lifted'
      ? 'LATEST PRESSURE LIFTED / RIBBON RESTORED'
      : state === 'refused'
        ? 'SHORT TOUCH REFUSED / TRAVEL TO PRESS'
        : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const ribbonPath = polygonPath(frame.ribbon.points);
  const centrePath = centerlinePath(frame.stations);
  const stationMarks = blind ? '' : frame.stations.map((station) => {
    const color = station.role === 'crease' ? palette.rust : station.role === 'binder' ? palette.blue : palette.quiet;
    return `<circle class="station-mark station-mark--${station.role}" data-station="${station.index}" cx="${px(station.x)}" cy="${py(station.y)}" r="${station.role === 'quiet' ? 5 : 8}" fill="${color}"/>`;
  }).join('');
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="632">${stateLabel}</text><text x="958" y="632" text-anchor="end">${frame.stations.length} STATIONS / ${frame.memory.length} PRESSURES / STATION ${latest ? latest.station + 1 : '—'}</text></g>`;
  const centreLabel = blind ? '' : `<text class="centre-label" x="500" y="86" text-anchor="middle">${latest ? 'FORCE REMAINS' : 'PRESSURE RIBBON'}</text>`;

  field.innerHTML = `<defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".56" stop-color="${palette.ground}"/><stop offset="1" stop-color="#d1cdc1"/></linearGradient>
    <linearGradient id="ribbon-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.ink}"/><stop offset=".54" stop-color="#283e4a"/><stop offset="1" stop-color="${palette.blue}"/></linearGradient>
    <filter id="ribbon-shadow" x="-20%" y="-30%" width="150%" height="170%"><feGaussianBlur stdDeviation="9"/></filter>
    <pattern id="grain" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 0 39 L 40 1 M -9 19 L 19 -9 M 21 49 L 49 21" fill="none" stroke="${palette.ink}" stroke-opacity=".035" stroke-width="1"/></pattern>
  </defs>
  <rect class="ground" x="0" y="0" width="1000" height="680"/>
  <rect class="grain" x="0" y="0" width="1000" height="680"/>
  <path class="ribbon-shadow" d="${ribbonPath}" transform="translate(10 14)"/>
  <path class="ribbon ribbon--${latest ? 'pressed' : 'quiet'}" data-ribbon="material" data-closed="true" data-crease-count="${frame.creases.length}" fill-rule="nonzero" d="${ribbonPath}"/>
  <path class="ribbon-seam" data-seam="centerline" d="${centrePath}"/>
  <g class="station-marks">${stationMarks}</g>
  <path class="registration-mark" d="M 846 100 L 906 100 M 876 70 L 876 130"/>
  ${centreLabel}
  ${labels}`;

  stageReadout.textContent = state === 'material-crease'
    ? 'pressure traveled / source pinched / remote binder changed'
    : state === 'lifted'
      ? 'latest pressure lifted / signature restored'
      : state === 'refused'
        ? 'short touch refused / travel across the ribbon'
        : frozen
          ? `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} pressures · ${latest ? `station ${latest.station + 1} remembers` : 'ribbon quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.pressures = String(frame.pressureCount);
  field.dataset.creaseCount = String(frame.creases.length);
  field.dataset.station = String(frame.ruleCursor ?? '');
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.notice = notice;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'material-crease');
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

function commitPressure(station = requestedStation, force = 0.82) {
  const base = interactionBase();
  if (base.memory.length >= MEMORY_LIMIT) return;
  interactionFrame = applyPressure(base, station, force);
  interactionFrame.interaction = 'material-crease';
  notice = 'traveled-pressure-committed';
  render(interactionFrame, 'material-crease');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...removeLatestPressure(base), interaction: 'lifted' };
  notice = 'latest-pressure-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function releaseRibbon() {
  interactionFrame = null;
  notice = 'ribbon-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(releasePressure()) : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  pressureControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v021-ribbon.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

function pointerPoint(event) {
  return { x: event.clientX, y: event.clientY };
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  drag = { start: pointerPoint(event), current: pointerPoint(event), travel: 0 };
  notice = 'pressure-travel-started';
  field.dataset.dragTravel = '0';
});

field.addEventListener('pointermove', (event) => {
  if (!drag || staticMode || blind) return;
  event.preventDefault();
  drag.current = pointerPoint(event);
  drag.travel = travelDistance(drag.start, drag.current);
  field.dataset.dragTravel = drag.travel.toFixed(2);
  stageReadout.textContent = drag.travel >= 64 ? 'pressure traveling / release to bind the ribbon' : 'travel farther / a tap is refused';
});

field.addEventListener('pointerup', (event) => {
  if (!drag || staticMode || blind) return;
  event.preventDefault();
  const finished = drag;
  drag = null;
  const travel = finished.travel;
  if (travel < 64) {
    notice = 'short-touch-refused';
    render(interactionBase(), 'refused');
    return;
  }
  requestedStation = stationAtClientX(event.clientX);
  commitPressure(requestedStation, Math.min(1, 0.58 + travel / 340));
});

field.addEventListener('pointercancel', () => { drag = null; });

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (/^[1-7]$/.test(event.key)) {
    event.preventDefault();
    requestedStation = Number(event.key) - 1;
    notice = `station-${requestedStation + 1}-armed`;
    render(interactionBase(), 'sequence');
  }
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    commitPressure(requestedStation, 0.82);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseRibbon();
  }
});

pressureControl.addEventListener('click', () => commitPressure(requestedStation, 0.82));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseRibbon);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
