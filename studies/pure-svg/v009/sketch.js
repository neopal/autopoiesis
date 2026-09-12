import { PRIMITIVE_BUDGET, STAGES, applyFold, buildTimeline, deleteFold } from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const foldControl = document.querySelector('#fold-control');
const unfoldControl = document.querySelector('#unfold-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2700;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const frozen = reducedMotion || staticMode;

if (staticMode) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#132021',
  groundDeep: '#081112',
  groundSoft: '#264245',
  parchment: '#f1e3c5',
  clay: '#c28a6b',
  ash: '#9aa8a0',
  fold: '#e1b96d',
  lichen: '#91b59e',
  ember: '#e78061',
  ink: '#071011'
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

function pointAt(point) {
  return `${px(point.x)} ${py(point.y)}`;
}

function closedPath(points) {
  const first = points[0];
  const last = points.at(-1);
  const start = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 };
  let path = `M ${pointAt(start)}`;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    path += ` Q ${pointAt(point)} ${pointAt(midpoint)}`;
  });
  return `${path} Z`;
}

function openPath(points) {
  return `M ${pointAt(points[0])} ${points.slice(1).map((point) => `L ${pointAt(point)}`).join(' ')}`;
}

function routePath(limb) {
  return `M ${pointAt(limb.joint)} L ${pointAt(limb.knee)} Q ${pointAt(limb.knee)} ${pointAt(limb.foot)}`;
}

function pocketWitness(fold, index, active = false) {
  if (!fold) return '';
  const radius = active ? 26 : 8 + index * 2;
  const opacity = active ? 0.98 : 0.18 + index * 0.08;
  return `<g class="fold-witness${active ? ' fold-witness--active' : ''}" opacity="${opacity}">
    <circle class="fold-origin" cx="${px(fold.pivot.x)}" cy="${py(fold.pivot.y)}" r="${radius}"/>
    <circle class="fold-seam" cx="${px(fold.seam.x)}" cy="${py(fold.seam.y)}" r="${Math.max(6, radius * .56)}"/>
    <path d="M ${px(fold.pivot.x - .022)} ${py(fold.pivot.y)} L ${px(fold.pivot.x + .022)} ${py(fold.pivot.y)} M ${px(fold.pivot.x)} ${py(fold.pivot.y - .022)} L ${px(fold.pivot.x)} ${py(fold.pivot.y + .022)}"/>
  </g>`;
}

function foldThread(fold, index, active = false) {
  if (!fold) return '';
  const bend = {
    x: (fold.pivot.x + fold.seam.x) / 2 + fold.foldVector.x * (active ? 1.5 : 1),
    y: (fold.pivot.y + fold.seam.y) / 2 + fold.foldVector.y * (active ? 1.5 : 1)
  };
  return `<path class="fold-thread${active ? ' fold-thread--active' : ''}" opacity="${active ? .78 : .15 + index * .06}" d="M ${pointAt(fold.pivot)} Q ${pointAt(bend)} ${pointAt(fold.seam)}"/>`;
}

function pocketCut(fold, active = false) {
  if (!fold) return '';
  return `<path class="pocket-cut${active ? ' pocket-cut--active' : ''}" d="${closedPath(fold.opening)}"/>`;
}

function dust(stage) {
  return Array.from({ length: 54 }, (_, index) => {
    const x = 28 + ((index * 179 + stage * 21) % 942);
    const y = 54 + ((index * 117 + stage * 27) % 630);
    const length = 4 + (index % 4) * 7;
    const tilt = (index % 3) - 1;
    return `<path class="dust" d="M ${x} ${y} l ${length} ${tilt}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const body = closedPath(frame.points);
  const draft = openPath(frame.draft);
  const activeFold = frame.fold;
  const allWitnesses = frame.memory.map((entry, index) => `${foldThread(entry, index)}${pocketWitness(entry, index)}`).join('');
  const active = `${foldThread(activeFold, frame.memory.length, true)}${pocketWitness(activeFold, frame.memory.length, true)}`;
  const limbs = frame.limbs.map((limb) => `<g class="route route--${limb.route} gait--${limb.gaitSide ?? 'direct'}" data-route="${limb.id}" data-gait-side="${limb.gaitSide ?? 'direct'}">
    <path class="route-line" pathLength="1" d="${routePath(limb)}"/>
    <circle class="route-joint" cx="${px(limb.joint.x)}" cy="${py(limb.joint.y)}" r="${limb.route === 'folded' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(limb.foot.x)}" cy="${py(limb.foot.y)}" r="3"/>
  </g>`).join('');
  const modeLabel = state === 'visitor-fold'
    ? 'VISITOR FOLD / POCKET OPENED'
    : state === 'unfolded'
      ? 'LATEST FOLD REMOVED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const progressOffset = Math.max(0, 1 - progress);
  const pocket = activeFold ? closedPath(activeFold.opening) : '';

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="40%" r="78%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".62" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.lichen}"/><stop offset=".46" stop-color="${palette.parchment}"/><stop offset="1" stop-color="${palette.ash}"/></linearGradient>
    <linearGradient id="fold-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.fold}"/><stop offset="1" stop-color="${palette.ember}"/></linearGradient>
    <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="micro-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="${palette.ash}" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="25" y="25" width="950" height="680"/>
  <g aria-hidden="true">${dust(frame.stage)}</g>
  <path class="orbit" d="M 76 164 Q 496 26 924 154"/>
  <path class="ground-line" d="M 65 660 Q 310 630 512 664 T 944 646"/>
  <path class="animal-shadow" d="${body}"/>
  <path class="draft" pathLength="1" d="${draft}"/>
  ${limbs}
  <path class="animal-glow" d="${body}"/>
  <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" fill-rule="evenodd" d="${body}${pocket ? ` ${pocket}` : ''}"/>
  ${pocketCut(activeFold, true)}
  <path class="pocket-seam" d="${pocket}"/>
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .15)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[6].x)} ${py(frame.points[6].y + .18)} ${px(frame.points[9].x)} ${py(frame.points[9].y + .07)}"/>
  ${allWitnesses}${active}
  <path class="horn" d="M ${px(frame.points[4].x)} ${py(frame.points[4].y)} Q ${px(frame.points[4].x - .02)} ${py(frame.points[4].y - .12)} ${px(frame.points[4].x + .06)} ${py(frame.points[4].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[5].x - .025)}" cy="${py(frame.points[5].y + .045)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[6].x - .03)} ${py(frame.points[6].y + .02)} Q ${px(frame.points[6].x + .025)} ${py(frame.points[6].y + .04)} ${px(frame.points[6].x + .045)} ${py(frame.points[6].y - .005)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${frame.insideRoutes} INSIDE ROUTES</text></g>`;

  stageReadout.textContent = state === 'visitor-fold'
    ? 'visitor fold / paused'
    : state === 'unfolded'
      ? 'latest fold removed / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered folds`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.foldState = state;
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
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, .06, .94),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, .16, .84)
  };
}

function makeFold(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyFold(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-fold');
}

function unfoldLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  const restored = deleteFold(base);
  interactionFrame = { ...restored, interaction: 'unfolded' };
  paused = true;
  render(interactionFrame, 1, 'unfolded');
}

function releaseBody() {
  interactionFrame = null;
  paused = frozen;
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  renderCurrent();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  makeFold(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeFold({ x: .72, y: .42 });
});

foldControl.addEventListener('click', () => { if (!staticMode) makeFold({ x: .72, y: .42 }); });
unfoldControl.addEventListener('click', () => { if (!staticMode) unfoldLatest(); });
releaseControl.addEventListener('click', () => { if (!staticMode) releaseBody(); });

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
