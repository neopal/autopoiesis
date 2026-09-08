import { PRIMITIVE_BUDGET, STAGES, applyHinge, buildFrame, buildTimeline, deleteHinge } from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const hingeControl = document.querySelector('#hinge-control');
const unhingeControl = document.querySelector('#unhinge-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3200;
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
  ground: '#101728',
  groundDeep: '#090e1b',
  groundSoft: '#1c2b46',
  bone: '#eee8d3',
  mineral: '#aabbd0',
  lichen: '#6d91a3',
  hinge: '#c9df62',
  ember: '#efb56e',
  rust: '#d8795d',
  ink: '#060914'
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

function hingeWitness(hinge, index, active = false) {
  if (!hinge) return '';
  const radius = active ? 21 : 10 + index * 2;
  const opacity = active ? 0.96 : 0.25 + index * 0.1;
  const x = px(hinge.point.x);
  const y = py(hinge.point.y);
  return `<g class="hinge-witness${active ? ' hinge-witness--active' : ''}" opacity="${opacity}">
    <circle cx="${x}" cy="${y}" r="${radius}"/>
    <path d="M ${px(hinge.point.x - 0.022)} ${py(hinge.point.y)} L ${px(hinge.point.x + 0.022)} ${py(hinge.point.y)} M ${px(hinge.point.x)} ${py(hinge.point.y - 0.022)} L ${px(hinge.point.x)} ${py(hinge.point.y + 0.022)}"/>
  </g>`;
}

function dust(stage) {
  return Array.from({ length: 34 }, (_, index) => {
    const x = 34 + ((index * 181 + stage * 23) % 930);
    const y = 60 + ((index * 113 + stage * 29) % 616);
    const length = 4 + (index % 4) * 7;
    const tilt = (index % 3) - 1;
    return `<path class="dust" d="M ${x} ${y} l ${length} ${tilt}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const body = closedPath(frame.points);
  const draft = openPath(frame.draft);
  const memory = frame.memory.map((hinge, index) => hingeWitness(hinge, index)).join('');
  const active = hingeWitness(frame.refusal, frame.memory.length, true);
  const limbs = frame.limbs.map((limb) => `<g class="route route--${limb.route}" data-route="${limb.id}">
    <path class="route-line" pathLength="1" d="${routePath(limb)}"/>
    <circle class="route-joint" cx="${px(limb.joint.x)}" cy="${py(limb.joint.y)}" r="${limb.route === 'folded' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(limb.foot.x)}" cy="${py(limb.foot.y)}" r="3"/>
  </g>`).join('');
  const hinge = frame.hinge;
  const hingePoint = hinge ? `M ${px(hinge.point.x - 0.09)} ${py(hinge.point.y + 0.06)} Q ${px(hinge.point.x)} ${py(hinge.point.y - 0.10)} ${px(hinge.point.x + 0.10)} ${py(hinge.point.y + 0.03)}` : '';
  const progressOffset = Math.max(0, 1 - progress);
  const modeLabel = state === 'visitor-hinge'
    ? 'VISITOR HINGE / AXIS REBUILT'
    : state === 'deleted'
      ? 'HINGE REMOVED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="40%" r="78%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".64" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.lichen}"/><stop offset=".48" stop-color="${palette.bone}"/><stop offset="1" stop-color="${palette.mineral}"/></linearGradient>
    <linearGradient id="fold-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.hinge}"/><stop offset="1" stop-color="${palette.ember}"/></linearGradient>
    <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="micro-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="${palette.mineral}" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="25" y="25" width="950" height="680"/>
  <g aria-hidden="true">${dust(frame.stage)}</g>
  <path class="orbit" d="M 86 166 Q 496 28 918 160"/>
  <path class="ground-line" d="M 65 660 Q 310 630 512 664 T 944 646"/>
  <path class="animal-shadow" d="${body}"/>
  <path class="draft" pathLength="1" d="${draft}"/>
  ${limbs}
  <path class="animal-glow" d="${body}"/>
  <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" d="${body}"/>
  <path class="fold-line" d="${hingePoint}"/>
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[4].x)} ${py(frame.points[4].y + .15)} ${px(frame.points[7].x)} ${py(frame.points[7].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .18)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .07)}"/>
  ${memory}${active}
  <path class="horn" d="M ${px(frame.points[4].x)} ${py(frame.points[4].y)} Q ${px(frame.points[4].x - .02)} ${py(frame.points[4].y - .12)} ${px(frame.points[4].x + .06)} ${py(frame.points[4].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[5].x - .025)}" cy="${py(frame.points[5].y + .045)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[6].x - .03)} ${py(frame.points[6].y + .02)} Q ${px(frame.points[6].x + .025)} ${py(frame.points[6].y + .04)} ${px(frame.points[6].x + .045)} ${py(frame.points[6].y - .005)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${frame.limbs.filter((limb) => limb.route === 'folded').length} FOLDS</text></g>`;

  stageReadout.textContent = state === 'visitor-hinge'
    ? 'visitor hinge / paused'
    : state === 'deleted'
      ? 'hinge removed / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered hinges`;
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

function makeHinge(point) {
  const base = interactionFrame?.interaction === 'visitor-hinge' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyHinge(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-hinge');
}

function unhingeLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  const restored = deleteHinge(base);
  interactionFrame = { ...restored, interaction: 'deleted', hinge: restored.memory.at(-1) ?? null, refusal: null };
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
  makeHinge(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeHinge({ x: .72, y: .42 });
});

hingeControl.addEventListener('click', () => { if (!staticMode) makeHinge({ x: .72, y: .42 }); });
unhingeControl.addEventListener('click', () => { if (!staticMode) unhingeLatest(); });
releaseControl.addEventListener('click', () => { if (!staticMode) releaseBody(); });

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
