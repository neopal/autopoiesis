import {
  PRIMITIVE_BUDGET,
  STAGES,
  applyConstraint,
  buildTimeline,
  deleteConstraint
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const constraintControl = document.querySelector('#constraint-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const frozen = reducedMotion || staticMode;
const blind = params.get('blind') === '1';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#12201f',
  groundDeep: '#071011',
  groundSoft: '#244743',
  paper: '#d9e5d9',
  mint: '#91e1bc',
  amber: '#e7c46a',
  coral: '#e48a66',
  violet: '#a7a4e1',
  ink: '#050909',
  smoke: '#7d9990'
};

let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;
const degrees = (radians) => (radians * 180 / Math.PI).toFixed(2);

function gatePath(gate) {
  const width = gate.width * 1000;
  const height = gate.height * 760;
  if (gate.role === 'blocked') {
    return `M ${(-width).toFixed(2)} ${(-height).toFixed(2)} L 0 ${height.toFixed(2)} L ${width.toFixed(2)} ${(-height).toFixed(2)} M ${(-width * .42).toFixed(2)} ${(-height * .15).toFixed(2)} L ${(width * .42).toFixed(2)} ${(-height * .15).toFixed(2)}`;
  }
  if (gate.role === 'escape') {
    return `M ${(-width).toFixed(2)} ${(-height * .72).toFixed(2)} L 0 0 L ${(width * .75).toFixed(2)} ${(-height * .72).toFixed(2)} M ${(-width * .78).toFixed(2)} ${(height * .72).toFixed(2)} L 0 0 L ${(width * .55).toFixed(2)} ${(height * .72).toFixed(2)}`;
  }
  return `M ${(-width).toFixed(2)} ${(-height).toFixed(2)} L 0 0 L ${width.toFixed(2)} ${(-height).toFixed(2)} M ${(-width * .72).toFixed(2)} ${height.toFixed(2)} L 0 0 L ${(width * .72).toFixed(2)} ${height.toFixed(2)}`;
}

function gateInnerPath(gate) {
  const width = gate.width * 1000;
  const height = gate.height * 760;
  return gate.role === 'blocked'
    ? `M ${(-width * .30).toFixed(2)} ${(height * .44).toFixed(2)} L ${(width * .30).toFixed(2)} ${(height * .44).toFixed(2)}`
    : `M ${(-width * .22).toFixed(2)} ${(-height * .20).toFixed(2)} L ${(width * .22).toFixed(2)} ${(height * .20).toFixed(2)}`;
}

function renderGate(gate) {
  if (!gate.visible) return '';
  return `<g class="gate gate--${gate.role}" data-gate="${gate.id}" data-role="${gate.role}" transform="translate(${px(gate.x)} ${py(gate.y)}) rotate(${degrees(gate.angle)})"><path class="gate-shape" d="${gatePath(gate)}"/><path class="gate-inner" d="${gateInnerPath(gate)}"/></g>`;
}

function lanePath(gates, lane) {
  const points = gates.filter((gate) => gate.lane === lane && gate.visible).map((gate) => ({ x: gate.x, y: gate.y }));
  if (points.length < 2) return '';
  return `M ${pointAt(points[0])} ${points.slice(1).map((point) => `L ${pointAt(point)}`).join(' ')}`;
}

function renderWitness(constraint, index, active = false) {
  if (blind || !constraint) return '';
  const radius = active ? 28 : 10 + index * 4;
  const opacity = active ? 0.9 : 0.12 + index * 0.08;
  const end = { x: constraint.point.x + constraint.normal.x * .12, y: constraint.point.y + constraint.normal.y * .12 };
  return `<g class="constraint-witness${active ? ' constraint-witness--active' : ''}" opacity="${opacity}"><circle cx="${px(constraint.point.x)}" cy="${py(constraint.point.y)}" r="${radius}"/><path d="M ${pointAt(constraint.point)} L ${pointAt(end)}"/></g>`;
}

function renderCuts(memory) {
  if (blind) return '';
  return memory.map((constraint, index) => {
    const size = 20 + index * 4;
    return `<path class="cut-mark" opacity="${0.16 + index * .10}" d="M ${px(constraint.point.x - .018)} ${py(constraint.point.y - size / 760)} L ${px(constraint.point.x + .018)} ${py(constraint.point.y + size / 760)}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const modeLabel = state === 'visitor-constraint'
    ? 'VISITOR CONSTRAINT / PATH REFUSED'
    : state === 'unconstrained'
      ? 'LATEST CONSTRAINT LIFTED / LINE RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const opacity = Math.max(.18, progress);
  const corridors = frame.gates.map((gate, index) => {
    if (!gate.visible) return '';
    return `<path class="corridor corridor--lane-${gate.lane}" d="${lanePath(frame.gates, gate.lane)}"/>`;
  });
  const uniqueCorridors = [...new Set(corridors)].join('');
  const gapMarks = blind ? '' : frame.gates.filter((gate) => !gate.visible).map((gate) => `<circle class="gap-mark" cx="${px(gate.x)}" cy="${py(gate.y)}" r="${(gate.width * 480).toFixed(2)}"/>`).join('');
  const activeWitness = blind ? '' : renderWitness(frame.memory.at(-1), frame.memory.length, true);

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="35%" r="82%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".58" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="lane-glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.mint}"/><stop offset=".52" stop-color="${palette.violet}"/><stop offset="1" stop-color="${palette.coral}"/></linearGradient>
    <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="18"/></filter>
    <pattern id="micro-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="${palette.violet}" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="28" y="32" width="944" height="654"/>
  <path class="frame-line" d="M 70 156 H 930 M 70 380 H 930 M 70 604 H 930"/>
  <path class="field-shadow" d="M 100 178 H 900 M 100 402 H 900 M 100 626 H 900"/>
  <g opacity="${opacity}">${uniqueCorridors}</g>
  ${frame.gates.map(renderGate).join('')}
  ${gapMarks}
  ${renderCuts(frame.memory)}
  ${frame.memory.map((constraint, index) => renderWitness(constraint, index)).join('')}
  ${activeWitness}
  <g class="artwork-label" aria-hidden="true"><text x="48" y="684">${modeLabel}</text><text x="952" y="684" text-anchor="end">${PRIMITIVE_BUDGET} GATES / ${frame.vacancies} GAPS</text></g>
  <g class="count-label" aria-hidden="true"><text x="500" y="388" text-anchor="middle">${frame.blocked ? `${frame.blocked} / ${frame.escapes}` : '—'}</text></g>`;

  stageReadout.textContent = state === 'visitor-constraint'
    ? 'visitor constraint / paused'
    : state === 'unconstrained'
      ? 'latest constraint lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered constraints · ${frame.vacancies} gaps`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.blocked = String(frame.blocked);
  field.dataset.escapes = String(frame.escapes);
  field.dataset.vacancies = String(frame.vacancies);
  field.dataset.cutState = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return { frame: timeline[currentStage], progress: (elapsed % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = frameAt(now);
  if (current.frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = current.frame.stage;
    lastPaint = now;
    render(current.frame, current.progress, 'sequence');
  }
}

function pointerPoint(event) {
  const bounds = field.getBoundingClientRect();
  const scale = Math.min(bounds.width / 1000, bounds.height / 760);
  const drawnWidth = 1000 * scale;
  const drawnHeight = 760 * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return {
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, .08, .92),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, .18, .82)
  };
}

function makeConstraint(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyConstraint(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-constraint');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...deleteConstraint(base), interaction: 'unconstrained' };
  paused = true;
  render(interactionFrame, 1, 'unconstrained');
  updateButtons();
}

function releaseLine() {
  interactionFrame = null;
  paused = frozen;
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v014-refusal.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  makeConstraint(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeConstraint({ x: .78, y: .22 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') releaseLine();
  if (event.key.toLowerCase() === 's') saveStill();
});

constraintControl.addEventListener('click', () => { if (!staticMode) makeConstraint({ x: .78, y: .22 }); });
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseLine);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

window.__mutinePureSvgV014 = {
  getState: () => ({
    stage: currentStage,
    memory: (interactionFrame ?? timeline[currentStage]).memory.length,
    paused,
    blocked: (interactionFrame ?? timeline[currentStage]).blocked,
    escapes: (interactionFrame ?? timeline[currentStage]).escapes,
    vacancies: (interactionFrame ?? timeline[currentStage]).vacancies,
    cutState: field.dataset.cutState
  }),
  getFrameSignature: () => JSON.stringify({
    gates: (interactionFrame ?? timeline[currentStage]).gates,
    memory: (interactionFrame ?? timeline[currentStage]).memory,
    corridors: (interactionFrame ?? timeline[currentStage]).corridors
  }),
  getSVGMarkup: () => field.outerHTML
};

updateButtons();
renderCurrent();
if (!frozen) requestAnimationFrame(frame);
