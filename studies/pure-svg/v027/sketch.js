import {
  MEMORY_LIMIT,
  ROW_COUNT,
  STAGES,
  applyLoad,
  armLoad,
  buildTimeline,
  geometrySignature,
  liftLatestSlip,
  releaseStrata
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const loadControl = document.querySelector('#load-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = ['#d9a75e', '#9fbfae', '#c87554', '#8b7086', '#d6c29e', '#7f9c91'];
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let pointerSession = null;
let notice = '';

const px = (value) => Number(value).toFixed(2);
const pointAttribute = ([x, y]) => `${px(x)},${px(y)}`;
const polygonPath = (top, bottom) => `M ${top.map(pointAttribute).join(' L ')} L ${bottom.slice().reverse().map(pointAttribute).join(' L ')} Z`;

function viewPoint(clientX, clientY) {
  const transform = field.getScreenCTM?.();
  if (transform) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
    return [Math.max(0, Math.min(1000, point.x)), Math.max(0, Math.min(680, point.y))];
  }
  const bounds = field.getBoundingClientRect();
  return [
    Math.max(0, Math.min(1000, ((clientX - bounds.left) / Math.max(1, bounds.width)) * 1000)),
    Math.max(0, Math.min(680, ((clientY - bounds.top) / Math.max(1, bounds.height)) * 680))
  ];
}

function normalizedPoint([x, y]) {
  return { x: Number((x / 1000).toFixed(4)), y: Number((y / 680).toFixed(4)) };
}

function render(frame, state = frame.interaction ?? 'quiet') {
  const latest = frame.memory.at(-1);
  const loadedRows = new Set(latest ? [latest.focusRow, Math.max(0, latest.focusRow - 1), Math.min(ROW_COUNT - 1, latest.focusRow + 1)] : []);
  const stateLabel = state === 'material-slip'
    ? 'SLIP REGISTERED / THE SEAM CHOSE ITSELF'
    : state === 'pressure-armed'
      ? 'PRESSURE HELD / NO SLIP YET'
      : state === 'lifted'
        ? 'LATEST SLIP LIFTED / STRATA RESTORED'
        : state === 'material-memory-full'
          ? 'FOUR SLIPS RETAINED / LIFT OR RELEASE'
          : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const strata = frame.rows.map((row, index) => {
    const classes = ['stratum'];
    if (loadedRows.has(index)) classes.push('stratum--loaded');
    if (latest?.focusRow === index) classes.push('stratum--focused');
    return `<path class="${classes.join(' ')}" data-row="${index}" d="${polygonPath(row.top, row.bottom)}" style="--stratum-colour:${palette[index % palette.length]}"/>`;
  }).join('');
  const fault = latest
    ? `<path class="fault-mark" d="M ${px(74 + latest.seam * 94 + 47)} 48 L ${px(74 + latest.seam * 94 + 47 + (latest.ordinal % 2 ? -18 : 18))} 632"/>`
    : '';
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="638">${stateLabel}</text><text x="958" y="638" text-anchor="end">${ROW_COUNT} STRATA / ${frame.memory.length} SLIPS / ${latest ? `SEAM ${latest.seam + 1}` : 'NO PRESSURE'}</text></g>`;
  const pressure = frame.armed && !blind
    ? `<circle class="pressure-mark" cx="${px(frame.armed.x * 1000)}" cy="${px(frame.armed.y * 680)}" r="22"/>`
    : '';

  field.innerHTML = `<defs>
    <radialGradient id="field-ground" cx="48%" cy="42%" r="86%"><stop offset="0" stop-color="#493429"/><stop offset=".52" stop-color="#241b16"/><stop offset="1" stop-color="#0d0d0c"/></radialGradient>
    <linearGradient id="field-wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3ead7" stop-opacity=".08"/><stop offset=".5" stop-color="#d25c3b" stop-opacity=".025"/><stop offset="1" stop-color="#9fbfae" stop-opacity=".1"/></linearGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".025" numOctaves="2" seed="27" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .12"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" x="0" y="0" width="1000" height="680"/>
  <rect class="field-wash" x="18" y="18" width="964" height="644" rx="18" filter="url(#grain)"/>
  <path class="field-grid" d="M 74 42 V 638 M 286 42 V 638 M 498 42 V 638 M 710 42 V 638 M 922 42 V 638"/>
  <g class="strata-field">${strata}</g>${fault}${pressure}${labels}`;
  stageReadout.textContent = state === 'material-slip'
    ? 'the weakest seam slipped / the stack remembers'
    : state === 'pressure-armed'
      ? 'pressure held / memory remains unchanged'
      : state === 'lifted'
        ? 'latest slip lifted / prior stack restored'
        : state === 'material-memory-full'
          ? 'four slips retained / lift or release'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} slips · ${latest ? `seam ${latest.seam + 1} carries the fault` : 'the material is still'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.rowCount = String(frame.rows.length);
  field.dataset.pathCount = String(frame.rows.length);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.seam = latest ? String(latest.seam) : '';
  field.dataset.notice = notice;
  updateButtons(frame);
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (2600 * timeline.length)) / 2600);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'material-slip');
    requestAnimationFrame(renderCurrent);
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

function armPressure(load) {
  if (staticMode || blind) return;
  interactionFrame = armLoad(interactionBase(), load);
  notice = 'pressure-armed-no-write';
  render(interactionFrame, 'pressure-armed');
}

function commitPressure(load) {
  if (staticMode || blind) return;
  const next = applyLoad(interactionFrame ?? interactionBase(), load);
  interactionFrame = next;
  notice = next.event?.committed ? 'material-slip-registered' : 'material-memory-full';
  render(interactionFrame, next.interaction);
}

function liftLatest() {
  const base = interactionFrame ?? interactionBase();
  if (!base.memory.length || staticMode || blind) return;
  interactionFrame = liftLatestSlip(base);
  notice = 'latest-slip-lifted';
  render(interactionFrame, 'lifted');
}

function release() {
  if (staticMode || blind) return;
  interactionFrame = null;
  pointerSession = null;
  notice = 'strata-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  render(releaseStrata());
  requestAnimationFrame(renderCurrent);
}

function updateButtons(frame = interactionFrame ?? interactionBase()) {
  loadControl.disabled = frame.memory.length >= MEMORY_LIMIT;
  liftControl.disabled = frame.memory.length === 0;
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  const point = viewPoint(event.clientX, event.clientY);
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, load: normalizedPoint(point) };
  armPressure(pointerSession.load);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  field.releasePointerCapture?.(event.pointerId);
  commitPressure(pointerSession.load);
  pointerSession = null;
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  interactionFrame = null;
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitPressure({ x: 0.63, y: 0.48 });
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

loadControl.addEventListener('click', () => commitPressure({ x: 0.63, y: 0.48 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', release);

window._mutineReady = true;
renderCurrent();
