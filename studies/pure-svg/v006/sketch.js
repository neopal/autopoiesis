import { PRIMITIVE_BUDGET, STAGES, applyCounterweight, buildFrame, buildTimeline, deleteCounterweight } from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const counterweightControl = document.querySelector('#counterweight-control');
const unweightControl = document.querySelector('#unweight-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3000;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash === '#interaction' || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1';
const staticMode = staticPreview || location.hash === '#static';

if (staticMode) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const frozen = reducedMotion || staticMode;
const palette = {
  ground: '#17130f',
  groundDeep: '#0d0b09',
  groundSoft: '#302117',
  bone: '#eee5d0',
  mineral: '#bba98c',
  lichen: '#7d8f7b',
  weight: '#d7df70',
  ember: '#efab6e',
  rust: '#d26c52',
  ink: '#080706'
};

let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);

function closedPath(points) {
  const first = points[0];
  const last = points.at(-1);
  const start = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 };
  let path = `M ${px(start.x)} ${py(start.y)}`;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    path += ` Q ${px(point.x)} ${py(point.y)} ${px(midpoint.x)} ${py(midpoint.y)}`;
  });
  return `${path} Z`;
}

function openPath(points) {
  return `M ${px(points[0].x)} ${py(points[0].y)} ${points.slice(1).map((point) => `L ${px(point.x)} ${py(point.y)}`).join(' ')}`;
}

function pointAt(point) {
  return `${px(point.x)} ${py(point.y)}`;
}

function routePath(limb) {
  return `M ${pointAt(limb.joint)} L ${pointAt(limb.knee)} Q ${pointAt(limb.knee)} ${pointAt(limb.foot)} ${pointAt(limb.foot)}`;
}

function counterweightWitness(counterweight, index, active = false) {
  if (!counterweight) return '';
  const point = counterweight.balancePoint;
  const radius = active ? 24 : 9 + index * 2;
  const opacity = active ? 0.98 : 0.24 + index * 0.09;
  return `<g class="counterweight-witness${active ? ' counterweight-witness--active' : ''}" opacity="${opacity}">
    <circle cx="${px(point.x)}" cy="${py(point.y)}" r="${radius}"/>
    <path d="M ${px(point.x - 0.026)} ${py(point.y)} L ${px(point.x + 0.026)} ${py(point.y)} M ${px(point.x)} ${py(point.y - 0.026)} L ${px(point.x)} ${py(point.y + 0.026)}"/>
  </g>`;
}

function massThreads(counterweight, index, active = false) {
  if (!counterweight) return '';
  const pivot = counterweight.pivot;
  const balance = counterweight.balancePoint;
  const opacity = active ? 0.64 : 0.18 + index * 0.06;
  return `<path class="mass-thread${active ? ' mass-thread--active' : ''}" opacity="${opacity}" d="M ${pointAt(pivot)} Q ${px((pivot.x + balance.x) / 2)} ${py(balance.y - 0.12)} ${pointAt(balance)}"/>`;
}

function dust(stage) {
  return Array.from({ length: 38 }, (_, index) => {
    const x = 30 + ((index * 179 + stage * 21) % 940);
    const y = 56 + ((index * 117 + stage * 27) % 628);
    const length = 4 + (index % 4) * 7;
    const tilt = (index % 3) - 1;
    return `<path class="dust" d="M ${x} ${y} l ${length} ${tilt}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const body = closedPath(frame.points);
  const draft = openPath(frame.draft);
  const memory = frame.memory.map((entry, index) => `${massThreads(entry, index)}${counterweightWitness(entry, index)}`).join('');
  const active = `${massThreads(frame.counterweight, frame.memory.length, true)}${counterweightWitness(frame.counterweight, frame.memory.length, true)}`;
  const limbs = frame.limbs.map((limb) => `<g class="route route--${limb.route}" data-route="${limb.id}">
    <path class="route-line" pathLength="1" d="${routePath(limb)}"/>
    <circle class="route-joint" cx="${px(limb.joint.x)}" cy="${py(limb.joint.y)}" r="${limb.route === 'weighted' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(limb.foot.x)}" cy="${py(limb.foot.y)}" r="3"/>
  </g>`).join('');
  const balance = frame.counterweight?.balancePoint;
  const loadArc = balance
    ? `M ${px(balance.x - 0.08)} ${py(balance.y + 0.015)} Q ${px(balance.x)} ${py(balance.y - 0.10)} ${px(balance.x + 0.08)} ${py(balance.y + 0.015)}`
    : '';
  const progressOffset = Math.max(0, 1 - progress);
  const modeLabel = state === 'visitor-counterweight'
    ? 'VISITOR LOAD / MASS REDISTRIBUTED'
    : state === 'deleted'
      ? 'LOAD REMOVED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="40%" r="78%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".62" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.lichen}"/><stop offset=".46" stop-color="${palette.bone}"/><stop offset="1" stop-color="${palette.mineral}"/></linearGradient>
    <linearGradient id="load-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.weight}"/><stop offset="1" stop-color="${palette.ember}"/></linearGradient>
    <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="micro-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="${palette.mineral}" stroke-opacity=".12" stroke-width="1"/></pattern>
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
  <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" d="${body}"/>
  <path class="mass-arc" d="${loadArc}"/>
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .15)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[6].x)} ${py(frame.points[6].y + .18)} ${px(frame.points[9].x)} ${py(frame.points[9].y + .07)}"/>
  ${memory}${active}
  <path class="horn" d="M ${px(frame.points[4].x)} ${py(frame.points[4].y)} Q ${px(frame.points[4].x - .02)} ${py(frame.points[4].y - .12)} ${px(frame.points[4].x + .06)} ${py(frame.points[4].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[5].x - .025)}" cy="${py(frame.points[5].y + .045)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[6].x - .03)} ${py(frame.points[6].y + .02)} Q ${px(frame.points[6].x + .025)} ${py(frame.points[6].y + .04)} ${px(frame.points[6].x + .045)} ${py(frame.points[6].y - .005)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${frame.limbs.filter((limb) => limb.route === 'weighted').length} LOADS</text></g>`;

  stageReadout.textContent = state === 'visitor-counterweight'
    ? 'visitor load / paused'
    : state === 'deleted'
      ? 'load removed / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered counterweights`;
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
  if (current.frame.stage !== lastRenderedStage) {
    lastRenderedStage = current.frame.stage;
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
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, .04, .96),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, .12, .88)
  };
}

function makeCounterweight(point) {
  const base = interactionFrame?.interaction === 'visitor-counterweight' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyCounterweight(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-counterweight');
}

function unweightLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  const restored = deleteCounterweight(base);
  interactionFrame = { ...restored, interaction: 'deleted' };
  paused = true;
  render(interactionFrame, 1, 'deleted');
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
  makeCounterweight(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeCounterweight({ x: .72, y: .42 });
});

counterweightControl.addEventListener('click', () => { if (!staticMode) makeCounterweight({ x: .72, y: .42 }); });
unweightControl.addEventListener('click', () => { if (!staticMode) unweightLatest(); });
releaseControl.addEventListener('click', () => { if (!staticMode) releaseBody(); });

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
