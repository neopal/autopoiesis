import {
  PRIMITIVE_BUDGET,
  STAGES,
  applyHinge,
  buildTimeline,
  deleteHinge
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const hingeControl = document.querySelector('#hinge-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2700;
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
  ground: '#202044',
  groundDeep: '#0e0d1d',
  groundSoft: '#47466f',
  bone: '#eee6d0',
  copper: '#cb876a',
  mist: '#aeb9c3',
  hinge: '#e2b56e',
  moss: '#91b49e',
  rose: '#d8756f',
  ink: '#0b0a17',
  violet: '#8c88c9'
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
  if (points.length === 1) return `M ${pointAt(points[0])}`;
  if (points.length === 2) return `M ${pointAt(points[0])} L ${pointAt(points[1])}`;
  return `M ${pointAt(points[0])} Q ${pointAt(points[1])} ${pointAt(points[1])} T ${pointAt(points.at(-1))}`;
}

function routePath(route) {
  return `M ${pointAt(route.joint)} L ${pointAt(route.knee)} Q ${pointAt(route.knee)} ${pointAt(route.foot)}`;
}

function witnessPath(hinge, index, active = false) {
  if (!hinge) return '';
  const radius = active ? 28 : 9 + index * 2;
  const opacity = active ? 0.96 : 0.18 + index * 0.06;
  return `<g class="hinge-witness${active ? ' hinge-witness--active' : ''}" opacity="${opacity}">
    <circle cx="${px(hinge.point.x)}" cy="${py(hinge.point.y)}" r="${radius}"/>
    <path d="M ${pointAt(hinge.pivot)} L ${pointAt(hinge.gate)} L ${pointAt(hinge.exit)}"/>
    <path d="M ${px(hinge.crease.x - .018)} ${py(hinge.crease.y)} L ${px(hinge.crease.x + .018)} ${py(hinge.crease.y)} M ${px(hinge.crease.x)} ${py(hinge.crease.y - .018)} L ${px(hinge.crease.x)} ${py(hinge.crease.y + .018)}"/>
  </g>`;
}

function hingeThread(hinge, index, active = false) {
  if (!hinge) return '';
  return `<path class="hinge-thread${active ? ' hinge-thread--active' : ''}" opacity="${active ? .86 : .13 + index * .06}" d="${openPath(hinge.hingePath)}"/>`;
}

function drawDust(stage) {
  return Array.from({ length: 64 }, (_, index) => {
    const x = 30 + ((index * 173 + stage * 19) % 936);
    const y = 52 + ((index * 121 + stage * 23) % 632);
    const length = 4 + (index % 4) * 7;
    const tilt = (index % 3) - 1;
    return `<path class="dust" d="M ${x} ${y} l ${length} ${tilt}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const body = closedPath(frame.points);
  const draft = openPath(frame.draft);
  const activeHinge = frame.hinge;
  const witnesses = blind ? '' : frame.memory.map((entry, index) => `${hingeThread(entry, index)}${witnessPath(entry, index)}`).join('');
  const activeWitness = blind ? '' : `${hingeThread(activeHinge, frame.memory.length, true)}${witnessPath(activeHinge, frame.memory.length, true)}`;
  const routes = frame.routes.map((route) => `<g class="route route--${route.route} posture--${route.posture}" data-route="${route.id}" data-posture="${route.posture}">
    <path class="route-line" pathLength="1" d="${routePath(route)}"/>
    <circle class="route-joint" cx="${px(route.joint.x)}" cy="${py(route.joint.y)}" r="${route.route === 'hinged' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(route.foot.x)}" cy="${py(route.foot.y)}" r="3"/>
  </g>`).join('');
  const folded = frame.routes.filter((route) => route.posture === 'folded').length;
  const modeLabel = state === 'visitor-hinge'
    ? 'VISITOR HINGE / GATE OPEN'
    : state === 'unhinged'
      ? 'LATEST HINGE LIFTED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const progressOffset = Math.max(0, 1 - progress);
  const hingeSpines = frame.memory.map((hinge, index) => `<path class="hinge-spine-highlight" opacity="${.12 + index * .04}" d="${openPath(hinge.hingePath)}"/>`).join('');
  const activeSpine = activeHinge ? `<path class="hinge-spine" d="${openPath(activeHinge.hingePath)}"/>` : '';
  const notch = activeHinge ? `<path class="animal-notch" d="M ${px(activeHinge.gate.x - .022)} ${py(activeHinge.gate.y - .035)} Q ${px(activeHinge.gate.x)} ${py(activeHinge.gate.y + .014)} ${px(activeHinge.gate.x + .028)} ${py(activeHinge.gate.y - .028)}"/>` : '';

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="38%" r="78%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".62" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.moss}"/><stop offset=".42" stop-color="${palette.bone}"/><stop offset="1" stop-color="${palette.mist}"/></linearGradient>
    <linearGradient id="hinge-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.hinge}"/><stop offset="1" stop-color="${palette.rose}"/></linearGradient>
    <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="micro-grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M 44 0 L 0 0 0 44" fill="none" stroke="${palette.mist}" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="25" y="25" width="950" height="680"/>
  <g aria-hidden="true">${drawDust(frame.stage)}</g>
  <path class="orbit" d="M 76 164 Q 496 28 924 154"/>
  <path class="ground-line" d="M 60 662 Q 310 630 512 664 T 946 646"/>
  <path class="animal-shadow" d="${body}"/>
  <path class="draft" pathLength="1" d="${draft}"/>
  ${routes}
  <path class="animal-glow" d="${body}"/>
  <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" fill-rule="evenodd" d="${body}"/>
  ${hingeSpines}
  ${activeSpine}
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .14)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[6].x)} ${py(frame.points[6].y + .18)} ${px(frame.points[10].x)} ${py(frame.points[10].y + .07)}"/>
  ${notch}${witnesses}${activeWitness}
  <path class="horn" d="M ${px(frame.points[6].x)} ${py(frame.points[6].y)} Q ${px(frame.points[6].x - .018)} ${py(frame.points[6].y - .12)} ${px(frame.points[6].x + .064)} ${py(frame.points[6].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[7].x - .034)}" cy="${py(frame.points[7].y + .042)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[8].x - .035)} ${py(frame.points[8].y + .018)} Q ${px(frame.points[8].x + .022)} ${py(frame.points[8].y + .036)} ${px(frame.points[8].x + .046)} ${py(frame.points[8].y - .006)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${folded} FOLDED ROUTES</text></g>`;

  stageReadout.textContent = state === 'visitor-hinge'
    ? 'visitor hinge / paused'
    : state === 'unhinged'
      ? 'latest hinge lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered hinges`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.hingeState = state;
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

function makeHinge(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyHinge(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-hinge');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  const restored = deleteHinge(base);
  interactionFrame = { ...restored, interaction: 'unhinged' };
  paused = true;
  render(interactionFrame, 1, 'unhinged');
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
  link.download = 'mutine-pure-svg-v011-hinge.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  makeHinge(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeHinge({ x: .72, y: .42 });
  }
  if (event.key.toLowerCase() === 'r') releaseBody();
  if (event.key.toLowerCase() === 's') saveStill();
});

hingeControl.addEventListener('click', () => { if (!staticMode) makeHinge({ x: .72, y: .42 }); });
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseBody);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

window.__mutinePureSvgV011 = {
  getState: () => ({
    stage: currentStage,
    memory: (interactionFrame ?? timeline[currentStage]).memory.length,
    paused,
    foldedRoutes: (interactionFrame ?? timeline[currentStage]).routes.filter((route) => route.posture === 'folded').length,
    postures: (interactionFrame ?? timeline[currentStage]).routes.map((route) => route.posture)
  }),
  getFrameSignature: () => JSON.stringify({
    points: (interactionFrame ?? timeline[currentStage]).points,
    routes: (interactionFrame ?? timeline[currentStage]).routes
  }),
  getSVGMarkup: () => field.outerHTML
};

updateButtons();
renderCurrent();
if (!frozen) requestAnimationFrame(frame);
