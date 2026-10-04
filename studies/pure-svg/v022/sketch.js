import {
  FACET_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyAttention,
  buildTimeline,
  geometrySignature,
  releaseAttention,
  removeLatestAttention
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attendControl = document.querySelector('#attend-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2700;
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
  ground: '#181310',
  ink: '#17100d',
  quiet: '#6b4436',
  quietLight: '#95624a',
  turn: '#b7543e',
  answer: '#47737c',
  hinge: '#866d4c',
  gold: '#e6aa68',
  paper: '#e6dbca'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let requestedFacet = 1;
let armedFacet = null;
let pointerDown = null;
let notice = '';

const px = (value) => Number(value).toFixed(2);
const pointAt = ([x, y]) => `${px(x)} ${px(y)}`;
const polygonPath = (points) => `M ${points.map(pointAt).join(' L ')} Z`;
const linePath = (points) => `M ${points.map(pointAt).join(' L ')}`;

function facetAtClient(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  const x = (clientX - bounds.left) / Math.max(1, bounds.width);
  const y = (clientY - bounds.top) / Math.max(1, bounds.height);
  const horizontal = Math.max(0, Math.min(FACET_COUNT - 1, Math.floor(x * 3) + (y > 0.55 ? 3 : 0)));
  return Math.max(0, Math.min(FACET_COUNT - 1, horizontal));
}

function render(frame, state = 'sequence') {
  const latest = frame.memory.at(-1);
  const stateLabel = state === 'edge-exchange'
    ? 'DEPARTURE COMMITTED / EDGE EXCHANGED'
    : state === 'lifted'
      ? 'LATEST DEPARTURE LIFTED / OBJECT RESTORED'
      : state === 'refused'
        ? 'POINTER TAP REFUSED / APPROACH THEN LEAVE'
        : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const faces = frame.facets.map((facet) => `<path class="facet facet--${facet.role}" data-facet="${facet.index}" data-closed="true" d="${polygonPath(facet.points)}"/>`).join('');
  const edgeLines = frame.facets.map((facet) => `<path class="facet-edge" data-edge="${facet.index}" d="${linePath([facet.points[0], facet.points[1], facet.points[2]])}"/><path class="facet-glint" d="${linePath([facet.points[0], facet.points[3]])}"/>`).join('');
  const armMarks = blind || armedFacet === null ? '' : `<g class="arm-marks"><circle class="arm-mark" data-arm="${armedFacet}" cx="${frame.facets[armedFacet].points[1][0]}" cy="${frame.facets[armedFacet].points[1][1]}" r="8"/><path class="exchange-mark" d="${linePath([frame.facets[armedFacet].points[1], frame.facets[(armedFacet + 3) % FACET_COUNT].points[2]])}"/></g>`;
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="632">${stateLabel}</text><text x="958" y="632" text-anchor="end">${FACET_COUNT} FACES / ${frame.memory.length} EXCHANGES / FACE ${latest ? latest.source + 1 : '—'}</text></g>`;
  const centreLabel = blind ? '' : `<text class="centre-label" x="500" y="86" text-anchor="middle">${latest ? 'THE EDGE HAS MOVED' : 'FOLDING OBJECT'}</text>`;

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="52%" cy="42%" r="70%"><stop offset="0" stop-color="#39271f"/><stop offset=".58" stop-color="#1c1512"/><stop offset="1" stop-color="#0e0c0b"/></radialGradient>
    <linearGradient id="facet-quiet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.quietLight}"/><stop offset=".46" stop-color="${palette.quiet}"/><stop offset="1" stop-color="#3d2821"/></linearGradient>
    <linearGradient id="facet-turn" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7c302c"/><stop offset=".5" stop-color="${palette.turn}"/><stop offset="1" stop-color="#e0825a"/></linearGradient>
    <linearGradient id="facet-answer" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ec2bf"/><stop offset=".5" stop-color="${palette.answer}"/><stop offset="1" stop-color="#213d48"/></linearGradient>
    <linearGradient id="facet-hinge" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#4c3c2e"/><stop offset="1" stop-color="${palette.hinge}"/></linearGradient>
    <filter id="object-shadow" x="-30%" y="-30%" width="170%" height="180%"><feGaussianBlur stdDeviation="13"/></filter>
    <pattern id="grain" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 0 37 L 42 5 M -8 18 L 18 -8 M 24 50 L 50 24" fill="none" stroke="#ead7bb" stroke-opacity=".035" stroke-width="1"/></pattern>
  </defs>
  <rect class="object-ground" x="0" y="0" width="1000" height="680"/>
  <rect class="object-grain" x="0" y="0" width="1000" height="680" fill="url(#grain)"/>
  <path class="object-shadow" d="${frame.object.pathSignature.replaceAll('M ', 'M ').replaceAll(' Z', ' Z')}" transform="translate(17 22)"/>
  <g class="object-facets">${faces}</g>
  <g class="object-edges">${edgeLines}</g>
  ${armMarks}
  <path class="registration-mark" d="M 846 100 L 906 100 M 876 70 L 876 130"/>
  ${centreLabel}
  ${labels}`;

  stageReadout.textContent = state === 'edge-exchange'
    ? 'departure traveled / nearest edge turned / distant face answered'
    : state === 'lifted'
      ? 'latest departure lifted / signature restored'
      : state === 'refused'
        ? 'pointer tap refused / approach then leave'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} exchanges · ${latest ? `face ${latest.source + 1} remembers` : 'object quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.exchangeCount = String(frame.exchanges.length);
  field.dataset.facetCount = String(frame.facets.length);
  field.dataset.facet = String(frame.ruleCursor ?? '');
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
    render(interactionFrame, interactionFrame.interaction ?? 'edge-exchange');
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

function commitAttention(source = requestedFacet, force = 0.84) {
  const base = interactionBase();
  if (base.memory.length >= MEMORY_LIMIT) return;
  interactionFrame = applyAttention(base, source, force);
  interactionFrame.interaction = 'edge-exchange';
  notice = 'approach-departure-committed';
  armedFacet = null;
  render(interactionFrame, 'edge-exchange');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...removeLatestAttention(base), interaction: 'lifted' };
  notice = 'latest-edge-exchange-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function releaseObject() {
  interactionFrame = null;
  armedFacet = null;
  notice = 'object-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(releaseAttention()) : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  attendControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v022-folding-object.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  requestedFacet = facetAtClient(event.clientX, event.clientY);
  armedFacet = requestedFacet;
  notice = `face-${requestedFacet + 1}-approached`;
  field.dataset.armedFacet = String(armedFacet);
  render(interactionBase(), 'sequence');
});

field.addEventListener('pointerleave', () => {
  if (staticMode || blind || armedFacet === null) return;
  commitAttention(armedFacet, 0.84);
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerDown = { x: event.clientX, y: event.clientY, facet: requestedFacet };
  notice = 'pointer-tap-armed-but-refused';
});

field.addEventListener('pointerup', (event) => {
  if (!pointerDown || staticMode || blind) return;
  event.preventDefault();
  const travel = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
  pointerDown = null;
  if (travel < 24) {
    notice = 'pointer-tap-refused-use-approach-departure';
    render(interactionBase(), 'refused');
  }
});

field.addEventListener('pointercancel', () => { pointerDown = null; });

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (/^[1-6]$/.test(event.key)) {
    event.preventDefault();
    requestedFacet = Number(event.key) - 1;
    armedFacet = requestedFacet;
    notice = `face-${requestedFacet + 1}-armed`;
    render(interactionBase(), 'sequence');
  }
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    commitAttention(requestedFacet, 0.84);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseObject();
  }
});

attendControl.addEventListener('click', () => commitAttention(requestedFacet, 0.84));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseObject);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
