import {
  COMMIT_THRESHOLD,
  PRIMITIVE_BUDGET,
  STAGES,
  applyAttention,
  buildTimeline,
  deleteAttention,
  releaseAttention
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const witnessControl = document.querySelector('#witness-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2800;
const HELD_GAZE = 'held-gaze';
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
  ground: '#10101a',
  groundDeep: '#07070d',
  groundSoft: '#34365d',
  paper: '#ece8d8',
  acid: '#d9ef77',
  rose: '#ef8d9b',
  lilac: '#aaa8e8',
  gold: '#e8bc70',
  ink: '#07070d',
  smoke: '#77799b'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let armedPoint = null;
let holdStarted = 0;
let holding = false;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;

function rotate(value, angle) {
  return {
    x: value.x * Math.cos(angle) - value.y * Math.sin(angle),
    y: value.x * Math.sin(angle) + value.y * Math.cos(angle)
  };
}

function localPoint(center, local, angle) {
  const rotated = rotate(local, angle);
  return { x: center.x + rotated.x, y: center.y + rotated.y };
}

function segmentPath(segment) {
  const dx = segment.b.x - segment.a.x;
  const dy = segment.b.y - segment.a.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  const half = segment.width;
  const points = [
    { x: segment.a.x + normal.x * half, y: segment.a.y + normal.y * half },
    { x: segment.b.x + normal.x * half, y: segment.b.y + normal.y * half },
    { x: segment.b.x - normal.x * half, y: segment.b.y - normal.y * half },
    { x: segment.a.x - normal.x * half, y: segment.a.y - normal.y * half }
  ];
  return `M ${pointAt(points[0])} ${points.slice(1).map(pointAt).join(' ')} Z`;
}

function jointPath(joint) {
  const l = joint.length;
  const w = joint.width;
  const local = [
    { x: -l * 0.68, y: -w * 0.58 },
    { x: -l * 0.20, y: -w * 1.58 },
    { x: l * 0.56, y: -w * 0.92 },
    { x: l * 0.78, y: w * 0.36 },
    { x: l * 0.12, y: w * 1.62 },
    { x: -l * 0.66, y: w * 0.78 }
  ];
  const points = local.map((value) => localPoint(joint.center, value, joint.angle));
  return `M ${pointAt(points[0])} ${points.slice(1).map(pointAt).join(' ')} Z`;
}

function echoPath(echo) {
  const l = echo.length;
  const w = echo.width;
  const local = [
    { x: -l * 0.72, y: -w },
    { x: -l * 0.22, y: -w * 1.62 },
    { x: l * 0.74, y: -w * 0.35 },
    { x: l * 0.48, y: w * 1.10 },
    { x: -l * 0.48, y: w * 1.42 }
  ];
  const points = local.map((value) => localPoint(echo.center, value, echo.rotation));
  return `M ${pointAt(points[0])} ${points.slice(1).map(pointAt).join(' ')} Z`;
}

function armedMark(point, active = false) {
  if (blind || !point) return '';
  return `<circle class="${active ? 'hold-ring' : 'armed'}" cx="${px(point.x)}" cy="${py(point.y)}" r="${active ? 54 : 34}"/>`;
}

function render(frame, state = 'sequence', point = armedPoint) {
  const modeLabel = state === HELD_GAZE
    ? 'HELD GAZE / JOINT INHERITED'
    : state === 'lifted'
      ? 'LATEST GAZE LIFTED / BODY RESTORED'
      : state === 'holding'
        ? 'HOLDING GAZE / DO NOT RELEASE'
        : state === 'armed'
          ? 'WITNESS ARMED / HOLD TO COMMIT'
          : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const missing = frame.segments.filter((segment) => !segment.visible).length;
  const segments = frame.segments.filter((segment) => segment.visible).map((segment) => (
    `<path class="segment segment--${segment.role}" data-segment="${segment.id}" d="${segmentPath(segment)}"/>`
  )).join('');
  const joints = frame.joints.map((joint) => (
    `<path class="joint joint--${joint.role}" data-joint="${joint.id}" data-role="${joint.role}" d="${jointPath(joint)}"/>`
  )).join('');
  const echoes = frame.echoes.filter((echo) => echo.visible).map((echo) => (
    `<path class="echo echo--${echo.role.replace('joint', '').replace('-', '') || 'inherited'}" data-echo="${echo.id}" d="${echoPath(echo)}"/>`
  )).join('');

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="50%" cy="46%" r="82%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".58" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="body-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.paper}"/><stop offset=".52" stop-color="${palette.lilac}"/><stop offset="1" stop-color="${palette.smoke}"/></linearGradient>
    <linearGradient id="echo-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${palette.rose}"/><stop offset=".5" stop-color="${palette.gold}"/><stop offset="1" stop-color="${palette.acid}"/></linearGradient>
    <filter id="body-shadow" x="-30%" y="-40%" width="170%" height="190%"><feGaussianBlur stdDeviation="14"/></filter>
    <pattern id="grain-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M 38 0 L 0 0 0 38" fill="none" stroke="${palette.lilac}" stroke-opacity=".10" stroke-width="1"/></pattern>
  </defs>
  <rect class="art-ground" x="0" y="0" width="1000" height="760"/>
  <rect x="26" y="28" width="948" height="660" fill="url(#grain-grid)" opacity=".52"/>
  <path class="orbit" d="M 112 382 C 168 170 364 76 600 104 C 826 132 912 298 852 470 C 794 636 588 706 370 674 C 184 646 78 544 112 382 Z"/>
  <path class="orbit orbit--echo" d="M 190 390 C 232 238 378 156 572 170 C 752 182 824 304 772 440 C 722 570 568 626 396 600 C 260 580 168 504 190 390 Z"/>
  <g class="body-shadow" opacity=".74">${frame.segments.filter((segment) => segment.visible).map((segment) => `<path d="${segmentPath(segment)}" transform="translate(0 15)"/>`).join('')} ${frame.joints.map((joint) => `<path d="${jointPath(joint)}" transform="translate(0 15)"/>`).join('')}</g>
  <g class="body-layer">${segments}${joints}</g>
  <g class="echo-layer">${echoes}</g>
  ${armedMark(point, state === 'holding')}
  <g class="body-label" aria-hidden="true"><text x="44" y="688">${modeLabel}</text><text x="956" y="688" text-anchor="end">${PRIMITIVE_BUDGET} PRIMITIVES / ${missing} MISSING JOINTS</text></g>
  <text class="count-label" x="500" y="392" text-anchor="middle" aria-hidden="true">${missing ? `${missing} → ${frame.inheritedEchoes}` : '—'}</text>`;

  stageReadout.textContent = state === HELD_GAZE
    ? 'held gaze / joint inherited'
    : state === 'lifted'
      ? 'latest gaze lifted / body restored'
      : state === 'holding'
        ? 'holding gaze / release to commit'
        : state === 'armed'
          ? 'witness armed / hold to commit'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} held gazes · ${missing} missing joints`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.missing = String(missing);
  field.dataset.echoes = String(frame.inheritedEchoes);
  field.dataset.signature = frame.bodySignature;
  field.dataset.interaction = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return { frame: timeline[currentStage], progress: (elapsed % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? HELD_GAZE);
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 'sequence', armedPoint);
    return;
  }
  const current = frameAt(now);
  if (current.frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = current.frame.stage;
    lastPaint = now;
    render(current.frame, 'sequence', armedPoint);
  }
  requestAnimationFrame(renderCurrent);
}

function pointerPoint(event) {
  const bounds = field.getBoundingClientRect();
  const scale = Math.min(bounds.width / 1000, bounds.height / 760);
  const drawnWidth = 1000 * scale;
  const drawnHeight = 760 * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return {
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, .14, .86),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, .18, .82)
  };
}

function makeAttention(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyAttention(base, point);
  interactionFrame.interaction = HELD_GAZE;
  armedPoint = point;
  holding = false;
  render(interactionFrame, HELD_GAZE, point);
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...deleteAttention(base), interaction: 'lifted' };
  holding = false;
  render(interactionFrame, 'lifted', armedPoint);
  updateButtons();
}

function releaseBody() {
  interactionFrame = null;
  armedPoint = null;
  holding = false;
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(timeline[0], 'sequence') : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v016-held-gaze.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  armedPoint = pointerPoint(event);
  if (!holding) {
    const base = interactionFrame ?? timeline[currentStage];
    render(base, 'armed', armedPoint);
  }
});

field.addEventListener('pointerleave', () => {
  if (holding) return;
  armedPoint = null;
  field.dataset.proximity = 'away';
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  armedPoint = pointerPoint(event);
  holdStarted = performance.now();
  holding = true;
  field.dataset.proximity = 'holding';
  render(interactionFrame ?? timeline[currentStage], 'holding', armedPoint);
});

field.addEventListener('pointerup', (event) => {
  if (!holding || staticMode || blind) return;
  const duration = performance.now() - holdStarted;
  field.releasePointerCapture?.(event.pointerId);
  holding = false;
  if (duration >= COMMIT_THRESHOLD * 1000) {
    makeAttention(armedPoint ?? pointerPoint(event));
  } else {
    field.dataset.commit = 'refused-short-hold';
    render(interactionFrame ?? timeline[currentStage], 'armed', armedPoint);
  }
});

field.addEventListener('pointercancel', () => {
  holding = false;
  render(interactionFrame ?? timeline[currentStage], armedPoint ? 'armed' : 'sequence', armedPoint);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeAttention({ x: .82, y: .24 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseBody();
  }
});

witnessControl.addEventListener('click', () => makeAttention({ x: .82, y: .24 }));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseBody);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
