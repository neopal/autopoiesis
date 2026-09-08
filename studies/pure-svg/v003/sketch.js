import { STAGES, applyRefusal, buildFrame, buildTimeline, deleteRefusal } from './engine.mjs';

const field = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const refuseControl = document.querySelector('#refuse-control');
const deleteControl = document.querySelector('#delete-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3400;
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
let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;

const palette = {
  ground: '#0d1110',
  groundDeep: '#080b0a',
  groundSoft: '#1c2925',
  bone: '#e8dfc9',
  mineral: '#b5c4ad',
  lichen: '#708b73',
  copper: '#da815d',
  ember: '#efb166',
  ink: '#050807'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);

function closedPath(points) {
  const first = points[0];
  const last = points.at(-1);
  const start = { x: (last.x + first.x) / 2, y: (last.y + first.y) / 2 };
  let d = `M ${px(start.x)} ${py(start.y)}`;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const midpoint = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
    d += ` Q ${px(point.x)} ${py(point.y)} ${px(midpoint.x)} ${py(midpoint.y)}`;
  });
  return `${d} Z`;
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

function crossPath(point, size) {
  return `M ${px(point.x - size)} ${py(point.y - size)} L ${px(point.x + size)} ${py(point.y + size)} M ${px(point.x + size)} ${py(point.y - size)} L ${px(point.x - size)} ${py(point.y + size)}`;
}

function dust(stage) {
  return Array.from({ length: 30 }, (_, index) => {
    const x = 38 + ((index * 173 + stage * 19) % 930);
    const y = 72 + ((index * 97 + stage * 31) % 610);
    const length = 5 + (index % 5) * 8;
    const lift = (index % 3) * 2 - 1;
    return `<path class="dust" d="M ${x} ${y} l ${length} ${lift}"/>`;
  }).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const body = closedPath(frame.points);
  const draft = openPath(frame.draft);
  const memory = frame.memory.map((refusal, index) => `
    <g class="memory-refusal" opacity="${0.2 + index * 0.11}">
      <circle cx="${px(refusal.point.x)}" cy="${py(refusal.point.y)}" r="${8 + index * 1.5}"/>
      <path d="${crossPath(refusal.point, 0.014 + index * 0.002)}"/>
    </g>`).join('');
  const active = frame.refusal ? `
    <g class="active-refusal">
      <circle cx="${px(frame.refusal.point.x)}" cy="${py(frame.refusal.point.y)}" r="18"/>
      <path d="${crossPath(frame.refusal.point, 0.036)}"/>
    </g>` : '';
  const limbs = frame.limbs.map((limb) => `
    <g class="route route--${limb.route}" data-route="${limb.id}">
      <path class="route-line" pathLength="1" d="${routePath(limb)}"/>
      <circle class="route-joint" cx="${px(limb.joint.x)}" cy="${py(limb.joint.y)}" r="${limb.route === 'detour' ? 6 : 4}"/>
      <circle class="route-foot" cx="${px(limb.foot.x)}" cy="${py(limb.foot.y)}" r="3"/>
    </g>`).join('');
  const progressOffset = Math.max(0, 1 - progress);
  const modeLabel = state === 'visitor-refusal'
    ? 'VISITOR REFUSAL / ROUTES REBUILT'
    : state === 'deleted'
      ? 'REFUSAL REMOVED / ROUTE RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;

  field.innerHTML = `
    <defs>
      <radialGradient id="ground-glow" cx="52%" cy="43%" r="78%">
        <stop offset="0" stop-color="${palette.groundSoft}"/>
        <stop offset="0.62" stop-color="${palette.ground}"/>
        <stop offset="1" stop-color="${palette.groundDeep}"/>
      </radialGradient>
      <linearGradient id="animal-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette.lichen}"/>
        <stop offset="0.48" stop-color="${palette.bone}"/>
        <stop offset="1" stop-color="${palette.mineral}"/>
      </linearGradient>
      <linearGradient id="route-fill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${palette.copper}"/>
        <stop offset="1" stop-color="${palette.ember}"/>
      </linearGradient>
      <filter id="body-shadow" x="-24%" y="-24%" width="150%" height="165%">
        <feGaussianBlur stdDeviation="16"/>
      </filter>
      <pattern id="micro-grid" width="42" height="42" patternUnits="userSpaceOnUse">
        <path d="M 42 0 L 0 0 0 42" fill="none" stroke="#6c8979" stroke-opacity=".11" stroke-width="1"/>
      </pattern>
    </defs>
    <rect class="paper" x="0" y="0" width="1000" height="760"/>
    <rect class="micro-grid" x="24" y="24" width="952" height="680"/>
    <g aria-hidden="true">${dust(frame.stage)}</g>
    <path class="ground-line" d="M 70 650 Q 300 626 520 658 T 940 642"/>
    <path class="animal-shadow" d="${body}"/>
    <path class="draft" pathLength="1" d="${draft}"/>
    ${limbs}
    <path class="animal-glow" d="${body}"/>
    <path class="animal" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${progressOffset}" d="${body}"/>
    <path class="animal-rib" d="M ${px(frame.points[2].x)} ${py(frame.points[2].y + 0.055)} Q ${px(frame.points[4].x - 0.02)} ${py(frame.points[4].y + 0.13)} ${px(frame.points[7].x)} ${py(frame.points[7].y + 0.015)}"/>
    <path class="animal-rib animal-rib--low" d="M ${px(frame.points[3].x - 0.01)} ${py(frame.points[3].y + 0.105)} Q ${px(frame.points[5].x)} ${py(frame.points[5].y + 0.17)} ${px(frame.points[8].x - 0.01)} ${py(frame.points[8].y + 0.07)}"/>
    ${memory}
    ${active}
    <path class="horn" d="M ${px(frame.points[4].x)} ${py(frame.points[4].y)} Q ${px(frame.points[4].x - 0.025)} ${py(frame.points[4].y - 0.115)} ${px(frame.points[4].x + 0.055)} ${py(frame.points[4].y - 0.15)}"/>
    <circle class="eye" cx="${px(frame.points[5].x - 0.026)}" cy="${py(frame.points[5].y + 0.045)}" r="5"/>
    <path class="mouth" d="M ${px(frame.points[6].x - 0.03)} ${py(frame.points[6].y + 0.02)} Q ${px(frame.points[6].x + 0.03)} ${py(frame.points[6].y + 0.042)} ${px(frame.points[6].x + 0.048)} ${py(frame.points[6].y - 0.006)}"/>
    <g class="artwork-label" aria-hidden="true">
      <text x="48" y="680">${modeLabel}</text>
      <text x="952" y="680" text-anchor="end">${PRIMITIVE_LABEL(frame)}</text>
    </g>`;
  stageReadout.textContent = state === 'visitor-refusal'
    ? 'visitor refusal / paused'
    : state === 'deleted'
      ? 'refusal removed / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered refusals`;
}

function PRIMITIVE_LABEL(frame) {
  return `16 MARKS / ${frame.limbs.filter((limb) => limb.route === 'detour').length} DETOURS`;
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
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight)
  };
}

function refuse(point) {
  const base = interactionFrame?.interaction === 'visitor-refusal' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyRefusal(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-refusal');
}

function deleteLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  const next = base.refusal?.source === 'visitor-refusal' || !base.refusal
    ? deleteRefusal(base)
    : buildFrame(base.stage, base.memory);
  interactionFrame = { ...next, interaction: 'deleted', refusal: null };
  paused = true;
  render(interactionFrame, 1, 'deleted');
}

function releaseSequence() {
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
  refuse(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  refuse({ x: 0.72, y: 0.42 });
});

refuseControl.addEventListener('click', () => {
  if (!staticMode) refuse({ x: 0.72, y: 0.42 });
});
deleteControl.addEventListener('click', () => {
  if (!staticMode) deleteLatest();
});
releaseControl.addEventListener('click', () => {
  if (!staticMode) releaseSequence();
});

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

renderCurrent();
if (!frozen) requestAnimationFrame(frame);
