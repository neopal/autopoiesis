import {
  PRIMITIVE_BUDGET,
  STAGES,
  applyCounterweight,
  buildTimeline,
  deleteCounterweight
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const weightControl = document.querySelector('#weight-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2850;
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
  ground: '#15252a',
  groundDeep: '#071216',
  groundSoft: '#2d5556',
  parchment: '#efe4c9',
  clay: '#bd8168',
  ash: '#9bb0ad',
  weight: '#e1b46c',
  lichen: '#90b99f',
  ember: '#e87e61',
  ink: '#071014',
  teal: '#6fb7b2'
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
  if (!points?.length) return '';
  return `M ${pointAt(points[0])} ${points.slice(1).map((point) => `L ${pointAt(point)}`).join(' ')}`;
}

function routePath(limb) {
  return `M ${pointAt(limb.joint)} L ${pointAt(limb.knee)} Q ${pointAt(limb.knee)} ${pointAt(limb.foot)}`;
}

function spinePath(points) {
  if (!points?.length) return '';
  if (points.length === 1) return `M ${pointAt(points[0])}`;
  return `M ${pointAt(points[0])} Q ${pointAt(points[1])} ${pointAt(points[1])} T ${pointAt(points.at(-1))}`;
}

function weightWitness(weight, index, active = false) {
  if (!weight) return '';
  const point = weight.point;
  const pivot = weight.pivot;
  const balance = weight.balancePoint;
  const radius = active ? 27 : 9 + index * 2;
  const opacity = active ? 0.98 : 0.17 + index * 0.07;
  return `<g class="counterweight-witness${active ? ' counterweight-witness--active' : ''}" opacity="${opacity}">
    <circle class="weight-origin" cx="${px(point.x)}" cy="${py(point.y)}" r="${radius}"/>
    <circle class="weight-balance" cx="${px(balance.x)}" cy="${py(balance.y)}" r="${Math.max(7, radius * .52)}"/>
    <path class="weight-vector" d="M ${pointAt(pivot)} L ${pointAt(balance)} M ${px(pivot.x - .018)} ${py(pivot.y)} L ${px(pivot.x + .018)} ${py(pivot.y)} M ${px(pivot.x)} ${py(pivot.y - .018)} L ${px(pivot.x)} ${py(pivot.y + .018)}"/>
  </g>`;
}

function weightThread(weight, index, active = false) {
  if (!weight) return '';
  const spine = spinePath(weight.spine);
  return `<path class="counterweight-thread${active ? ' counterweight-thread--active' : ''}" opacity="${active ? .82 : .13 + index * .06}" d="${spine}"/>`;
}

function drawDust(stage) {
  return Array.from({ length: 58 }, (_, index) => {
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
  const activeWeight = frame.counterweight;
  const witnesses = blind ? '' : frame.memory.map((entry, index) => `${weightThread(entry, index)}${weightWitness(entry, index)}`).join('');
  const activeWitness = blind ? '' : `${weightThread(activeWeight, frame.memory.length, true)}${weightWitness(activeWeight, frame.memory.length, true)}`;
  const limbs = frame.limbs.map((limb) => `<g class="route route--${limb.route} posture--${limb.posture}" data-route="${limb.id}" data-posture="${limb.posture}">
    <path class="route-line" pathLength="1" d="${routePath(limb)}"/>
    <circle class="route-joint" cx="${px(limb.joint.x)}" cy="${py(limb.joint.y)}" r="${limb.route === 'weighted' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(limb.foot.x)}" cy="${py(limb.foot.y)}" r="3"/>
  </g>`).join('');
  const modeLabel = state === 'visitor-counterweight'
    ? 'VISITOR WEIGHT / BALANCE MOVED'
    : state === 'unweighted'
      ? 'LATEST WEIGHT LIFTED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const progressOffset = Math.max(0, 1 - progress);
  const loaded = frame.limbs.filter((limb) => limb.posture === 'loaded').length;

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="40%" r="78%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".62" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.lichen}"/><stop offset=".44" stop-color="${palette.parchment}"/><stop offset="1" stop-color="${palette.ash}"/></linearGradient>
    <linearGradient id="weight-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.weight}"/><stop offset="1" stop-color="${palette.ember}"/></linearGradient>
    <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="micro-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="${palette.ash}" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="25" y="25" width="950" height="680"/>
  <g aria-hidden="true">${drawDust(frame.stage)}</g>
  <path class="orbit" d="M 76 164 Q 496 26 924 154"/>
  <path class="ground-line" d="M 65 660 Q 310 630 512 664 T 944 646"/>
  <path class="animal-shadow" d="${body}"/>
  <path class="draft" pathLength="1" d="${draft}"/>
  ${limbs}
  <path class="animal-glow" d="${body}"/>
  <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" fill-rule="evenodd" d="${body}"/>
  ${frame.memory.map((entry) => `<path class="spine-shadow" d="${spinePath(entry.spine)}"/>`).join('')}
  ${activeWeight ? `<path class="counterweight-spine" d="${spinePath(activeWeight.spine)}"/>` : ''}
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .15)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[6].x)} ${py(frame.points[6].y + .18)} ${px(frame.points[9].x)} ${py(frame.points[9].y + .07)}"/>
  ${witnesses}${activeWitness}
  <path class="horn" d="M ${px(frame.points[4].x)} ${py(frame.points[4].y)} Q ${px(frame.points[4].x - .02)} ${py(frame.points[4].y - .12)} ${px(frame.points[4].x + .06)} ${py(frame.points[4].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[5].x - .025)}" cy="${py(frame.points[5].y + .045)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[6].x - .03)} ${py(frame.points[6].y + .02)} Q ${px(frame.points[6].x + .025)} ${py(frame.points[6].y + .04)} ${px(frame.points[6].x + .045)} ${py(frame.points[6].y - .005)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${loaded} LOADED ROUTES</text></g>`;

  stageReadout.textContent = state === 'visitor-counterweight'
    ? 'visitor weight / paused'
    : state === 'unweighted'
      ? 'latest weight lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered weights`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.weightState = state;
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

function makeWeight(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyCounterweight(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-counterweight');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  const restored = deleteCounterweight(base);
  interactionFrame = { ...restored, interaction: 'unweighted' };
  paused = true;
  render(interactionFrame, 1, 'unweighted');
  updateButtons();
}

function releaseBody() {
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
  link.download = 'mutine-pure-svg-v010-counterweight.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  makeWeight(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeWeight({ x: .72, y: .42 });
  }
  if (event.key.toLowerCase() === 'r') releaseBody();
  if (event.key.toLowerCase() === 's') saveStill();
});

weightControl.addEventListener('click', () => { if (!staticMode) makeWeight({ x: .72, y: .42 }); });
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseBody);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

window.__mutinePureSvgV010 = {
  getState: () => ({
    stage: currentStage,
    memory: (interactionFrame ?? timeline[currentStage]).memory.length,
    paused,
    weightedRoutes: (interactionFrame ?? timeline[currentStage]).limbs.filter((limb) => limb.route === 'weighted').length,
    postures: (interactionFrame ?? timeline[currentStage]).limbs.map((limb) => limb.posture)
  }),
  getFrameSignature: () => JSON.stringify((interactionFrame ?? timeline[currentStage]).points),
  getCanvasMarkup: () => field.outerHTML
};

updateButtons();
renderCurrent();
if (!frozen) requestAnimationFrame(frame);
