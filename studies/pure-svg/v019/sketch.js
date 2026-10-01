import {
  CHANNEL_COUNT,
  MEMORY_LIMIT,
  PRIMITIVE_BUDGET,
  STAGES,
  applyPressure,
  buildTimeline,
  geometrySignature,
  releasePressure,
  removeLatestPressure
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressureControl = document.querySelector('#pressure-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 2850;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#10151a',
  groundDeep: '#070b0f',
  teal: '#8fe0c0',
  acid: '#d7ef70',
  rust: '#ff8a5b',
  blue: '#73a9ff',
  ink: '#e9f1eb'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let notice = '';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;

function radialPoint(radius, angle, bend = 0) {
  return {
    x: 0.5 + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * bend,
    y: 0.5 + Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * bend
  };
}

function channelPoints(channel) {
  const angle = channel.angle;
  const tangent = angle + Math.PI / 2;
  const inner = radialPoint(0.075, angle, channel.bend * 0.18);
  const near = radialPoint(channel.radius * 0.48, angle, channel.bend * 0.42);
  const far = radialPoint(channel.radius, angle, channel.bend);
  const leftNear = radialPoint(channel.radius * 0.42, angle, channel.bend * 0.42 + channel.width);
  const rightNear = radialPoint(channel.radius * 0.42, angle, channel.bend * 0.42 - channel.width);
  const leftFar = radialPoint(channel.radius, angle, channel.bend + channel.width * 0.64);
  const rightFar = radialPoint(channel.radius, angle, channel.bend - channel.width * 0.64);
  const leftInner = radialPoint(0.075, angle, channel.bend * 0.18 + channel.width * 0.72);
  const rightInner = radialPoint(0.075, angle, channel.bend * 0.18 - channel.width * 0.72);
  return [inner, leftInner, leftNear, leftFar, far, rightFar, rightNear, rightInner];
}

function closedPath(points) {
  return `M ${points.map(pointAt).join(' ')} Z`;
}

function aperturePath(channel) {
  const center = radialPoint(channel.radius * 0.62, channel.angle, channel.bend);
  const radius = channel.width * channel.innerScale;
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = channel.rotation + (index / 6) * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
  return closedPath(points);
}

function channelPath(channel) {
  const outer = closedPath(channelPoints(channel));
  return channel.aperture ? `${outer} ${aperturePath(channel)}` : outer;
}

function channelMark(channel) {
  const center = radialPoint(channel.radius * 0.58, channel.angle, channel.bend);
  const left = { x: center.x - Math.cos(channel.angle) * 0.016, y: center.y - Math.sin(channel.angle) * 0.016 };
  const right = { x: center.x + Math.cos(channel.angle) * 0.016, y: center.y + Math.sin(channel.angle) * 0.016 };
  return `M ${pointAt(left)} L ${pointAt(right)}`;
}

function render(frame, state = 'sequence') {
  const orderedChannels = frame.paintOrder.map((index) => frame.channels[index]);
  const stateLabel = state === 'order-inversion'
    ? 'PRESSURE / FRONT ORDER INVERTED'
    : state === 'lifted'
      ? 'LATEST PRESSURE LIFTED / ORDER RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const channels = orderedChannels.map((channel) => {
    const path = channelPath(channel);
    return `<path class="channel channel--${channel.role}" data-channel="${channel.index}" data-role="${channel.role}" data-aperture="${channel.aperture}" fill-rule="evenodd" d="${path}"/>
      <path class="channel-mark" data-mark="${channel.index}" d="${channelMark(channel)}"/>`;
  }).join('');
  const centerLabel = blind ? '' : `<text class="center-label" x="500" y="384" text-anchor="middle">${frame.memory.length ? `${frame.pressureCount} PRESSURE / ${frame.channels.filter((channel) => channel.aperture).length} APERTURES` : 'PRESSURE VALVE'}</text>`;
  const footer = blind ? '' : `<g class="svg-labels"><text x="42" y="708">${stateLabel}</text><text x="958" y="708" text-anchor="end">${PRIMITIVE_BUDGET} PARTS / ${CHANNEL_COUNT} CHANNELS / ORDER ${frame.paintOrder.map((index) => index + 1).join('·')}</text></g>`;

  field.innerHTML = `<defs>
    <radialGradient id="valve-ground" cx="50%" cy="46%" r="74%"><stop offset="0" stop-color="#294344"/><stop offset=".54" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="channel-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9f1eb"/><stop offset=".44" stop-color="#73a9ff"/><stop offset="1" stop-color="#355b78"/></linearGradient>
    <linearGradient id="flip-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff8a5b"/><stop offset=".5" stop-color="#d85d6b"/><stop offset="1" stop-color="#ffe19a"/></linearGradient>
    <linearGradient id="aperture-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fe0c0"/><stop offset=".5" stop-color="#d7ef70"/><stop offset="1" stop-color="#397d72"/></linearGradient>
  </defs>
  <rect class="valve-ground" x="0" y="0" width="1000" height="760"/>
  <circle class="valve-glow" cx="500" cy="380" r="255"/>
  <circle class="valve-glow" cx="500" cy="380" r="220"/>
  <g class="channel-layer">${channels}</g>
  <circle class="valve-core" cx="500" cy="380" r="58"/>
  <circle class="valve-core-ring" cx="500" cy="380" r="70"/>
  ${centerLabel}
  ${footer}`;

  stageReadout.textContent = state === 'order-inversion'
    ? 'pressure committed / occlusion changed'
    : state === 'lifted'
      ? 'latest pressure lifted / restored'
      : state === 'refused'
        ? 'pointer tap refused / use pressure'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} pressure events · ${frame.channels.filter((channel) => channel.aperture).length} apertures · order ${frame.paintOrder.map((index) => index + 1).join('·')}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.pressures = String(frame.pressureCount);
  field.dataset.apertures = String(frame.channels.filter((channel) => channel.aperture).length);
  field.dataset.order = frame.paintOrder.join(',');
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.notice = notice;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'order-inversion');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1));
    return;
  }
  const frame = frameAt(now);
  if (frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = frame.stage;
    lastPaint = now;
    render(frame);
  }
  requestAnimationFrame(renderCurrent);
}

function interactionBase() {
  return interactionFrame ?? timeline[currentStage];
}

function commitPressure() {
  const base = interactionBase();
  interactionFrame = applyPressure(base);
  interactionFrame.interaction = 'order-inversion';
  notice = 'order-inversion-committed';
  render(interactionFrame, 'order-inversion');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...removeLatestPressure(base), interaction: 'lifted' };
  notice = 'latest-pressure-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function releaseValve() {
  interactionFrame = null;
  notice = 'valve-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  frozen ? render(releasePressure()) : renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  pressureControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v019-pressure-valve.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  notice = 'pointer-tap-refused-use-pressure';
  render(interactionBase(), 'refused');
});

field.addEventListener('pointerup', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  notice = 'pointer-tap-refused-use-pressure';
  render(interactionBase(), 'refused');
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' ', 'p', 'P'].includes(event.key)) {
    event.preventDefault();
    commitPressure();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseValve();
  }
});

pressureControl.addEventListener('click', commitPressure);
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseValve);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
