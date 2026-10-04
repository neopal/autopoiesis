import {
  CLAUSE_COUNT,
  MEMORY_LIMIT,
  PRIMITIVE_BUDGET,
  STAGES,
  applyConstraint,
  buildTimeline,
  geometrySignature,
  releaseConstraint,
  removeLatestConstraint
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const clauseControl = document.querySelector('#clause-control');
const constraintControl = document.querySelector('#constraint-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2650;
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
  ground: '#eee8dc',
  paper: '#f8f4eb',
  ink: '#202832',
  orange: '#ed6244',
  blue: '#165daf',
  pale: '#d7cec0'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let requestedClause = 0;
let notice = '';

const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;

function polygonPath(points) {
  return `M ${points.map(pointAt).join(' L ')} Z`;
}

function compoundPath(frame) {
  return [polygonPath(frame.contour.points), ...frame.pockets.map((pocket) => polygonPath(pocket.points))].join(' ');
}

function render(frame, state = 'sequence') {
  const latest = frame.memory.at(-1);
  const contourRole = latest ? 'contour-reply' : 'quiet';
  const stateLabel = state === 'contour-reply'
    ? 'RULE CHANGED / SECOND MOUTH'
    : state === 'lifted'
      ? 'LATEST RULE LIFTED / CONTOUR RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const path = compoundPath(frame);
  const echo = polygonPath(frame.contour.points);
  const pockets = frame.pockets.map((pocket) => `<path class="pocket" data-pocket-clause="${pocket.sourceClause}" d="${polygonPath(pocket.points)}"/>`).join('');
  const marks = frame.clauses.map((clause, index) => {
    const point = frame.contour.points[(index * 2 + 1) % frame.contour.points.length];
    return `<circle class="clause-mark clause-mark--${clause.role}" data-clause="${index}" cx="${px(point.x)}" cy="${py(point.y)}" r="${clause.role === 'quiet' ? 5 : 8}"/>`;
  }).join('');
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="708">${stateLabel}</text><text x="958" y="708" text-anchor="end">${PRIMITIVE_BUDGET} PARTS / ${frame.pockets.length} POCKETS / CLAUSE ${latest ? latest.clauseIndex + 1 : '—'}</text></g>`;
  const centre = blind ? '' : `<text class="centre-label" x="500" y="382" text-anchor="middle">${latest ? 'ANSWER / ELSEWHERE' : 'CONSTRAINT CONTOUR'}</text>`;

  field.innerHTML = `<defs>
    <linearGradient id="paper-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".5" stop-color="${palette.ground}"/><stop offset="1" stop-color="#dcd2c1"/></linearGradient>
    <pattern id="paper-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="${palette.ink}" stroke-opacity=".05" stroke-width="1"/></pattern>
    <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect class="paper-ground" x="0" y="0" width="1000" height="760"/>
  <rect class="paper-grid" x="0" y="0" width="1000" height="760"/>
  <path class="contour-shadow" d="${echo}" transform="translate(9 12)"/>
  <path class="contour contour--${contourRole}" data-contour="main" data-closed="true" data-pocket-count="${frame.pockets.length}" fill-rule="evenodd" d="${path}"/>
  <path class="contour-echo" d="${echo}"/>
  <g class="pocket-group">${pockets}</g>
  <g class="clause-marks">${marks}</g>
  <path class="crossing-mark" d="M 782 96 L 882 96 M 832 46 L 832 146"/>
  ${centre}
  ${labels}`;

  stageReadout.textContent = state === 'contour-reply'
    ? 'constraint committed / contour answered elsewhere'
    : state === 'lifted'
      ? 'latest constraint lifted / signature restored'
      : state === 'refused'
        ? 'pointer tap refused / choose a clause'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} constraints · ${frame.pockets.length} pockets · ${latest ? `clause ${latest.clauseIndex + 1}` : 'contour quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.constraints = String(frame.constraintCount);
  field.dataset.pockets = String(frame.pockets.length);
  field.dataset.clause = String(frame.ruleCursor ?? '');
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
    render(interactionFrame, interactionFrame.interaction ?? 'contour-reply');
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

function commitConstraint(clauseIndex = Number(clauseControl.value)) {
  const base = interactionBase();
  if (base.memory.length >= MEMORY_LIMIT) return;
  interactionFrame = applyConstraint(base, clauseIndex);
  interactionFrame.interaction = 'contour-reply';
  notice = 'contour-reply-committed';
  render(interactionFrame, 'contour-reply');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...removeLatestConstraint(base), interaction: 'lifted' };
  notice = 'latest-constraint-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function releaseContour() {
  interactionFrame = null;
  notice = 'contour-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(releaseConstraint()) : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  constraintControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
  clauseControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v020-contour.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  notice = 'pointer-tap-refused-choose-clause';
  render(interactionBase(), 'refused');
});

field.addEventListener('pointerup', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  notice = 'pointer-tap-refused-choose-clause';
  render(interactionBase(), 'refused');
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' ', 'c', 'C'].includes(event.key)) {
    event.preventDefault();
    commitConstraint(requestedClause);
  }
  if (/^[1-6]$/.test(event.key)) {
    event.preventDefault();
    requestedClause = Number(event.key) - 1;
    clauseControl.value = String(requestedClause);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseContour();
  }
});

clauseControl.addEventListener('change', () => {
  requestedClause = Number(clauseControl.value);
});
constraintControl.addEventListener('click', () => commitConstraint());
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseContour);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
