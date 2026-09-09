import { PRIMITIVE_BUDGET, STAGES, applyAfterimage, buildTimeline, deleteAfterimage } from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const afterimageControl = document.querySelector('#afterimage-control');
const eraseControl = document.querySelector('#erase-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2800;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticPreview = params.get('static') === '1' || location.hash === '#static';
const staticMode = staticPreview;

if (staticMode) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const frozen = reducedMotion || staticMode;
const palette = {
  ground: '#111328',
  groundDeep: '#090b18',
  groundSoft: '#252a53',
  bone: '#e7e2d0',
  mineral: '#9da4c6',
  lichen: '#6d89a0',
  echo: '#a9e3dc',
  ember: '#f5a36f',
  rust: '#dd6684',
  ink: '#050711'
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
  return `M ${pointAt(limb.joint)} L ${pointAt(limb.knee)} Q ${pointAt(limb.knee)} ${pointAt(limb.foot)}`;
}

function afterimageWitness(afterimage, index, active = false) {
  if (!afterimage) return '';
  const point = afterimage.echoPoint;
  const radius = active ? 26 : 9 + index * 2;
  const opacity = active ? 0.98 : 0.24 + index * 0.09;
  return `<g class="afterimage-witness${active ? ' afterimage-witness--active' : ''}" opacity="${opacity}">
    <circle cx="${px(point.x)}" cy="${py(point.y)}" r="${radius}"/>
    <path d="M ${px(point.x - 0.026)} ${py(point.y)} L ${px(point.x + 0.026)} ${py(point.y)} M ${px(point.x)} ${py(point.y - 0.026)} L ${px(point.x)} ${py(point.y + 0.026)}"/>
  </g>`;
}

function echoThread(afterimage, index, active = false) {
  if (!afterimage) return '';
  const pivot = afterimage.pivot;
  const echo = afterimage.echoPoint;
  const opacity = active ? 0.66 : 0.18 + index * 0.07;
  return `<path class="echo-thread${active ? ' echo-thread--active' : ''}" opacity="${opacity}" d="M ${pointAt(pivot)} Q ${px((pivot.x + echo.x) / 2)} ${py(echo.y - 0.12)} ${pointAt(echo)}"/>`;
}

function dust(stage) {
  return Array.from({ length: 44 }, (_, index) => {
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
  const memory = frame.memory.map((entry, index) => `${echoThread(entry, index)}${afterimageWitness(entry, index)}`).join('');
  const active = `${echoThread(frame.afterimage, frame.memory.length, true)}${afterimageWitness(frame.afterimage, frame.memory.length, true)}`;
  const limbs = frame.limbs.map((limb) => `<g class="route route--${limb.route}" data-route="${limb.id}">
    <path class="route-line" pathLength="1" d="${routePath(limb)}"/>
    <circle class="route-joint" cx="${px(limb.joint.x)}" cy="${py(limb.joint.y)}" r="${limb.route === 'echoed' ? 7 : 4}"/>
    <circle class="route-foot" cx="${px(limb.foot.x)}" cy="${py(limb.foot.y)}" r="3"/>
  </g>`).join('');
  const echo = frame.afterimage?.echoPoint;
  const echoArc = echo
    ? `M ${px(echo.x - 0.08)} ${py(echo.y + 0.015)} Q ${px(echo.x)} ${py(echo.y - 0.10)} ${px(echo.x + 0.08)} ${py(echo.y + 0.015)}`
    : '';
  const progressOffset = Math.max(0, 1 - progress);
  const modeLabel = state === 'visitor-afterimage'
    ? 'VISITOR ECHO / RHYTHM DELAYED'
    : state === 'erased'
      ? 'ECHO ERASED / BODY RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="48%" cy="40%" r="78%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".62" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.lichen}"/><stop offset=".46" stop-color="${palette.bone}"/><stop offset="1" stop-color="${palette.mineral}"/></linearGradient>
    <linearGradient id="echo-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${palette.echo}"/><stop offset="1" stop-color="${palette.ember}"/></linearGradient>
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
  <path class="echo-arc" d="${echoArc}"/>
  <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + .06)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + .15)} ${px(frame.points[8].x)} ${py(frame.points[8].y + .02)}"/>
  <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x)} ${py(frame.points[3].y + .12)} Q ${px(frame.points[6].x)} ${py(frame.points[6].y + .18)} ${px(frame.points[9].x)} ${py(frame.points[9].y + .07)}"/>
  ${memory}${active}
  <path class="horn" d="M ${px(frame.points[4].x)} ${py(frame.points[4].y)} Q ${px(frame.points[4].x - .02)} ${py(frame.points[4].y - .12)} ${px(frame.points[4].x + .06)} ${py(frame.points[4].y - .15)}"/>
  <circle class="eye" cx="${px(frame.points[5].x - .025)}" cy="${py(frame.points[5].y + .045)}" r="5"/>
  <path class="mouth" d="M ${px(frame.points[6].x - .03)} ${py(frame.points[6].y + .02)} Q ${px(frame.points[6].x + .025)} ${py(frame.points[6].y + .04)} ${px(frame.points[6].x + .045)} ${py(frame.points[6].y - .005)}"/>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} MARKS / ${frame.limbs.filter((limb) => limb.route === 'echoed').length} ECHOES</text></g>`;

  stageReadout.textContent = state === 'visitor-afterimage'
    ? 'visitor echo / paused'
    : state === 'erased'
      ? 'echo erased / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered afterimages`;
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

function makeAfterimage(point) {
  const base = interactionFrame?.interaction === 'visitor-afterimage' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyAfterimage(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-afterimage');
}

function eraseLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  const restored = deleteAfterimage(base);
  interactionFrame = { ...restored, interaction: 'erased' };
  paused = true;
  render(interactionFrame, 1, 'erased');
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
  makeAfterimage(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeAfterimage({ x: .72, y: .42 });
});

afterimageControl.addEventListener('click', () => { if (!staticMode) makeAfterimage({ x: .72, y: .42 }); });
eraseControl.addEventListener('click', () => { if (!staticMode) eraseLatest(); });
releaseControl.addEventListener('click', () => { if (!staticMode) releaseBody(); });

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
