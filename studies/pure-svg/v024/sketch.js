import {
  MEMORY_LIMIT,
  PORT_CENTERS,
  PORT_COUNT,
  STAGES,
  applyWitnessPair,
  armWitness,
  buildTimeline,
  geometrySignature,
  liftLatestWitness,
  releaseWitness
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const spliceControl = document.querySelector('#splice-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;
const GESTURE = 'two-witness-click';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#10151b',
  knotLight: '#e0e9d3',
  knot: '#c8d7bd',
  knotDeep: '#607a70',
  coral: '#ef836f',
  blue: '#7fb6bc',
  amber: '#d6b06c',
  paper: '#dce6d2',
  ink: '#0c1015'
};

let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let selectedPort = 2;
let pointerSession = null;
let notice = '';

const px = (value) => Number(value).toFixed(2);
const pointAt = ([x, y]) => `${px(x)} ${px(y)}`;
const polygonPath = (points) => `M ${points.map(pointAt).join(' L ')} Z`;
const centroid = (points) => points.reduce(([x, y], [pxValue, pyValue]) => [x + pxValue / points.length, y + pyValue / points.length], [0, 0]);

function portAtClient(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  const x = ((clientX - bounds.left) / Math.max(1, bounds.width)) * 1000;
  const y = ((clientY - bounds.top) / Math.max(1, bounds.height)) * 680;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  PORT_CENTERS.forEach(([cx, cy], index) => {
    const distance = (x - cx) ** 2 + (y - cy) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

function render(frame, state = 'sequence') {
  const latest = frame.memory.at(-1);
  const stateLabel = state === 'topological-splice'
    ? 'SPLICE COMMITTED / SOURCE SEALED / REMOTE OPENED'
    : state === 'lifted'
      ? 'LATEST SPLICE LIFTED / KNOT RESTORED'
      : state === 'same-witness-refused'
        ? 'SAME WITNESS REFUSED / FIND ANOTHER PLACE'
        : state === 'memory-limit-refused'
          ? 'MEMORY FULL / RELEASE OR LIFT'
          : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const marks = blind || frame.armed === null
    ? ''
    : frame.ports.map((port) => {
      const [x, y] = centroid(port.points);
      const armedClass = frame.armed === port.index ? ' port-mark--armed' : '';
      return `<circle class="port-mark port-mark--${port.role}${armedClass}" data-port="${port.index}" cx="${px(x)}" cy="${px(y)}" r="${frame.armed === port.index ? 17 : 11}"/>`;
    }).join('');
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="632">${stateLabel}</text><text x="958" y="632" text-anchor="end">${PORT_COUNT} PORTS / ${frame.memory.length} SPLICES / ${latest ? `${latest.source + 1} → ${latest.remote + 1}` : 'QUIET'}</text></g>`;
  const centreLabel = blind ? '' : `<text class="centre-label" x="500" y="86" text-anchor="middle">${latest ? 'THE SECOND PLACE ANSWERED' : 'WITNESS THE GAP'}</text>`;

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="50%" cy="40%" r="74%"><stop offset="0" stop-color="#2b3a40"/><stop offset=".58" stop-color="#151e25"/><stop offset="1" stop-color="#080b10"/></radialGradient>
    <linearGradient id="knot-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.knotLight}"/><stop offset=".42" stop-color="${palette.knot}"/><stop offset="1" stop-color="${palette.knotDeep}"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6f0d9"/><stop offset=".5" stop-color="#7fb6bc"/><stop offset="1" stop-color="#ef836f"/></linearGradient>
    <filter id="knot-shadow" x="-25%" y="-25%" width="170%" height="180%"><feGaussianBlur stdDeviation="18"/></filter>
    <pattern id="knot-grain" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M -8 24 L 24 -8 M 6 36 L 36 6" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="1"/></pattern>
  </defs>
  <rect class="knot-ground" x="0" y="0" width="1000" height="680"/>
  <path class="knot-shadow" d="${frame.knot.pathSignature}" fill-rule="evenodd"/>
  <path class="knot" d="${frame.knot.pathSignature}" fill-rule="evenodd"/>
  <path class="knot-edge" d="${frame.knot.outerPath}"/>
  <path class="knot-grain" d="${frame.knot.outerPath}" fill="url(#knot-grain)" opacity=".35"/>
  ${marks}
  ${centreLabel}
  ${labels}`;

  stageReadout.textContent = state === 'topological-splice'
    ? 'second witness answered / three mouths changed'
    : state === 'lifted'
      ? 'latest relation lifted / prior signature restored'
      : state === 'same-witness-refused'
        ? 'same place twice / relation refused'
        : state === 'memory-limit-refused'
          ? 'four relations retained / lift or release'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} splices · ${latest ? `port ${latest.source + 1} remembers` : 'knot quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.spliceCount = String(frame.changes.length);
  field.dataset.portCount = String(frame.ports.length);
  field.dataset.armed = frame.armed === null ? '' : String(frame.armed);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.gesture = GESTURE;
  field.dataset.notice = notice;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (2700 * timeline.length)) / 2700);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'topological-splice');
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

function armPort(port = selectedPort) {
  if (staticMode || blind) return;
  selectedPort = ((Number(port) % PORT_COUNT) + PORT_COUNT) % PORT_COUNT;
  interactionFrame = armWitness(interactionBase(), selectedPort);
  notice = `witness-${selectedPort + 1}-armed`;
  render(interactionFrame, 'sequence');
  updateButtons();
}

function deterministicPartner(source, memoryLength) {
  let partner = (source + 2 + memoryLength) % PORT_COUNT;
  if (partner === source) partner = (partner + 1) % PORT_COUNT;
  return partner;
}

function commitPair(first, second) {
  const base = interactionFrame ?? timeline[currentStage];
  const next = applyWitnessPair(base, first, second);
  interactionFrame = next;
  selectedPort = second;
  if (next.witness.committed) {
    interactionFrame.interaction = 'topological-splice';
    notice = 'topological-splice-committed';
  } else {
    interactionFrame.interaction = next.interaction;
    notice = next.interaction;
  }
  if (next.witness.committed) interactionFrame.armed = null;
  render(interactionFrame, interactionFrame.interaction);
  updateButtons();
}

function commitDeterministicPair() {
  const base = interactionFrame ?? timeline[currentStage];
  const source = Number.isInteger(base.armed) ? base.armed : selectedPort;
  const remote = deterministicPartner(source, base.memory.length);
  commitPair(source, remote);
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...liftLatestWitness(base), interaction: 'lifted', armed: null };
  notice = 'latest-splice-lifted';
  render(interactionFrame, 'lifted');
  updateButtons();
}

function releaseKnot() {
  interactionFrame = null;
  selectedPort = 2;
  notice = 'knot-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  render(releaseWitness());
  if (!frozen) requestAnimationFrame(renderCurrent);
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
  spliceControl.disabled = staticMode || interactionFrame?.memory.length >= MEMORY_LIMIT;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v024-witness-knot.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointermove', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  selectedPort = portAtClient(event.clientX, event.clientY);
});

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, port: portAtClient(event.clientX, event.clientY) };
  notice = 'witness-touch-started';
  field.dataset.notice = notice;
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || staticMode || blind) return;
  event.preventDefault();
  const session = pointerSession;
  pointerSession = null;
  const releasedPort = portAtClient(event.clientX, event.clientY);
  if (interactionBase().armed === null) armPort(session.port);
  else commitPair(interactionBase().armed, releasedPort);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  notice = 'witness-touch-cancelled';
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (/^[1-7]$/.test(event.key)) {
    event.preventDefault();
    armPort(Number(event.key) - 1);
  }
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    commitDeterministicPair();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    releaseKnot();
  }
});

spliceControl.addEventListener('click', commitDeterministicPair);
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseKnot);
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 's') saveStill();
});

renderCurrent();
updateButtons();
window._mutineReady = true;
