import {
  PRIMITIVE_BUDGET,
  STAGES,
  applyThreshold,
  buildTimeline,
  deleteThreshold
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const thresholdControl = document.querySelector('#threshold-control');
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
  ground: '#282319',
  groundDeep: '#100e0b',
  groundSoft: '#5d4b36',
  bone: '#eee1c8',
  copper: '#c7794c',
  mist: '#b4c1b5',
  threshold: '#efb668',
  moss: '#879d85',
  rose: '#d36357',
  ink: '#0b0a09',
  blue: '#829ab0'
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
  let path = `M ${pointAt(points[0])}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const midpoint = {
      x: (points[index].x + points[index + 1].x) / 2,
      y: (points[index].y + points[index + 1].y) / 2
    };
    path += ` Q ${pointAt(points[index])} ${pointAt(midpoint)}`;
  }
  path += ` L ${pointAt(points.at(-1))}`;
  return path;
}

function polygonPath(points) {
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${pointAt(point)}`).join(' ')} Z`;
}

function routePath(route) {
  return `M ${pointAt(route.joint)} L ${pointAt(route.queue)} Q ${pointAt(route.knee)} ${pointAt(route.knee)} L ${pointAt(route.pass)} Q ${pointAt(route.pass)} ${pointAt(route.foot)}`;
}

function drawDust(stage) {
  return Array.from({ length: 72 }, (_, index) => {
    const x = 28 + ((index * 173 + stage * 23) % 940);
    const y = 48 + ((index * 127 + stage * 17) % 630);
    const length = 4 + (index % 5) * 6;
    const tilt = (index % 3) - 1;
    return `<path class="dust" d="M ${x} ${y} l ${length} ${tilt}"/>`;
  }).join('');
}

function thresholdWitness(threshold, index, active = false) {
  if (!threshold) return '';
  const opacity = active ? 0.98 : 0.17 + index * 0.06;
  const radius = active ? 24 : 8 + index * 2;
  return `<g class="threshold-witness${active ? ' threshold-witness--active' : ''}" opacity="${opacity}">
    <circle class="threshold-pin" cx="${px(threshold.point.x)}" cy="${py(threshold.point.y)}" r="${radius}"/>
    <path d="${openPath(threshold.thresholdPath)}"/>
    <path class="threshold-gate" d="${polygonPath(threshold.aperture)}"/>
  </g>`;
}

function thresholdThread(threshold, index, active = false) {
  if (!threshold) return '';
  return `<path class="threshold-thread${active ? ' threshold-thread--active' : ''}" opacity="${active ? .88 : .14 + index * .06}" d="${openPath(threshold.thresholdPath)}"/>`;
}

function render(frame, progress = 1, state = 'sequence') {
  const body = closedPath(frame.points);
  const draft = openPath(frame.draft);
  const activeThreshold = frame.threshold;
  const aperture = activeThreshold ? polygonPath(activeThreshold.aperture) : '';
  const witnesses = blind ? '' : frame.memory.map((entry, index) => `${thresholdThread(entry, index)}${thresholdWitness(entry, index)}`).join('');
  const activeWitness = blind ? '' : thresholdWitness(activeThreshold, frame.memory.length, true);
  const routes = frame.routes.map((route) => `<g class="route route--${route.route} posture--${route.posture}" data-route="${route.id}" data-posture="${route.posture}">
    <path class="route-line" pathLength="1" d="${routePath(route)}"/>
    <circle class="route-joint" cx="${px(route.joint.x)}" cy="${py(route.joint.y)}" r="${route.route === 'thresholded' ? 7 : 4}"/>
    <circle class="route-pass" cx="${px(route.pass.x)}" cy="${py(route.pass.y)}" r="${route.posture === 'crossing' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(route.foot.x)}" cy="${py(route.foot.y)}" r="3"/>
  </g>`).join('');
  const modeLabel = state === 'visitor-threshold'
    ? 'VISITOR THRESHOLD / CROSSING HELD'
    : state === 'unthresholded'
      ? 'LATEST THRESHOLD LIFTED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const progressOffset = Math.max(0, 1 - progress);
  const activeSpine = activeThreshold ? `<path class="threshold-spine" d="${openPath(activeThreshold.thresholdPath)}"/>` : '';
  const notch = activeThreshold ? `<path class="animal-notch" d="M ${px(activeThreshold.aperture[0].x)} ${py(activeThreshold.aperture[0].y)} Q ${px(activeThreshold.center.x)} ${py(activeThreshold.center.y)} ${px(activeThreshold.aperture[2].x)} ${py(activeThreshold.aperture[2].y)}"/>` : '';

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="36%" r="82%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".58" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.moss}"/><stop offset=".40" stop-color="${palette.bone}"/><stop offset="1" stop-color="${palette.mist}"/></linearGradient>
    <linearGradient id="threshold-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.threshold}"/><stop offset="1" stop-color="${palette.rose}"/></linearGradient>
    <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%"><feGaussianBlur stdDeviation="17"/></filter>
    <pattern id="micro-grid" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M 46 0 L 0 0 0 46" fill="none" stroke="${palette.mist}" stroke-opacity=".12" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="25" y="25" width="950" height="680"/>
  <g aria-hidden="true">${drawDust(frame.stage)}</g>
  <path class="orbit" d="M 74 164 Q 495 30 926 154"/>
  <path class="ground-line" d="M 58 662 Q 310 630 516 665 T 948 646"/>
  <path class="animal-shadow" d="${body}"/>
  <path class="draft" pathLength="1" d="${draft}"/>
  ${routes}
  <path class="animal-glow" d="${body}"/>
  <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" fill-rule="evenodd" d="${body} ${aperture}"/>
  ${activeSpine}
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .14)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[7].x)} ${py(frame.points[7].y + .18)} ${px(frame.points[10].x)} ${py(frame.points[10].y + .07)}"/>
  <path class="threshold-aperture" d="${aperture}"/>
  ${notch}${witnesses}${activeWitness}
  <path class="horn" d="M ${px(frame.points[6].x)} ${py(frame.points[6].y)} Q ${px(frame.points[6].x - .018)} ${py(frame.points[6].y - .12)} ${px(frame.points[6].x + .064)} ${py(frame.points[6].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[7].x - .034)}" cy="${py(frame.points[7].y + .042)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[8].x - .035)} ${py(frame.points[8].y + .018)} Q ${px(frame.points[8].x + .022)} ${py(frame.points[8].y + .036)} ${px(frame.points[8].x + .046)} ${py(frame.points[8].y - .006)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${frame.clearedRoutes} CLEARED</text></g>`;

  stageReadout.textContent = state === 'visitor-threshold'
    ? 'visitor threshold / paused'
    : state === 'unthresholded'
      ? 'latest threshold lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered thresholds`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.thresholdState = state;
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

function makeThreshold(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyThreshold(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-threshold');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...deleteThreshold(base), interaction: 'unthresholded' };
  paused = true;
  render(interactionFrame, 1, 'unthresholded');
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
  link.download = 'mutine-pure-svg-v012-threshold.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  makeThreshold(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeThreshold({ x: .72, y: .42 });
  }
  if (event.key.toLowerCase() === 'r') releaseBody();
  if (event.key.toLowerCase() === 's') saveStill();
});

thresholdControl.addEventListener('click', () => { if (!staticMode) makeThreshold({ x: .72, y: .42 }); });
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseBody);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

window.__mutinePureSvgV012 = {
  getState: () => ({
    stage: currentStage,
    memory: (interactionFrame ?? timeline[currentStage]).memory.length,
    paused,
    postures: (interactionFrame ?? timeline[currentStage]).routes.map((route) => route.posture),
    thresholdState: field.dataset.thresholdState
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
