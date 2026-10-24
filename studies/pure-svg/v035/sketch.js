import {
  MEMORY_WINDOW,
  applyAttention,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAttention,
  releaseTopology
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attentionControl = document.querySelector('#attention-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_OFFERS = [
  { point: { x: 0.5, y: 0.18 }, duration: 420 },
  { point: { x: 0.8, y: 0.42 }, duration: 760 },
  { point: { x: 0.52, y: 0.8 }, duration: 540 },
  { point: { x: 0.18, y: 0.46 }, duration: 980 }
];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function pointForPort(port) {
  const radians = port.angle * Math.PI / 180;
  return { x: 0.5 + Math.cos(radians) * port.radius, y: 0.5 + Math.sin(radians) * port.radius * 0.78 };
}

function stateLabel(current) {
  if (current.interaction === 'attention-rewired') return 'ATTENTION REWIRED / UNOBSERVED OPENING';
  if (current.interaction === 'attention-refused-flicker') return 'FLICKER REFUSED / BODY UNCHANGED';
  if (current.interaction === 'attention-refused-overheld') return 'OVER-HELD REFUSED / BODY CLOSED';
  if (current.interaction === 'attention-memory-full') return 'FOUR OPENINGS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'attention-lifted') return 'LATEST OPENING LIFTED / PRIOR BODY RESTORED';
  if (current.interaction === 'released') return 'TOPOLOGY RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function portClasses(port, current) {
  const remembered = new Set(current.memory.flatMap((event) => [event.watchedPort, event.unobservedPort, event.seamPort]));
  const classes = ['topology-port', `topology-port--${port.role}`];
  if (remembered.has(port.id)) classes.push('topology-port--remembered');
  return classes.join(' ');
}

function pointPath(point) {
  return `${fixed(point.x * 1000)},${fixed(point.y * 760)}`;
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="48">${stateLabel(current)}</text><text x="958" y="714" text-anchor="end">${current.ports.length} THRESHOLDS / ${current.memory.length} REWIRES / ${current.event?.committed ? `${current.event.band.toUpperCase()} DWELL` : 'CLOSED'}</text></g>`;
  const ports = current.ports.map((port) => `<path class="${portClasses(port, current)}" data-port="${port.id}" d="${port.pathSignature}"/>`).join('');
  const threads = current.ports.map((port) => {
    const point = pointForPort(port);
    return `<path class="topology-thread" d="M ${pointPath(point)} L 500 380"/>`;
  }).join('');
  const cuts = current.state.cuts.map((index) => {
    const point = pointForPort(current.ports[index]);
    return `<path class="topology-cut" d="M ${pointPath(point)} L ${fixed((0.5 + (point.x - 0.5) * 1.45) * 1000)} ${fixed((0.5 + (point.y - 0.5) * 1.45) * 760)}"/>`;
  }).join('');

  field.innerHTML = `<defs>
    <linearGradient id="topology-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#171a24"/><stop offset=".52" stop-color="#0d1017"/><stop offset="1" stop-color="#07080d"/></linearGradient>
    <linearGradient id="topology-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7d8be"/><stop offset=".34" stop-color="#b9d0c0"/><stop offset=".7" stop-color="#afabc5"/><stop offset="1" stop-color="#d29f93"/></linearGradient>
    <radialGradient id="topology-haze" cx="50%" cy="48%" r="54%"><stop offset="0" stop-color="#c7e2c9" stop-opacity=".22"/><stop offset=".65" stop-color="#7e748f" stop-opacity=".08"/><stop offset="1" stop-color="#07080d" stop-opacity="0"/></radialGradient>
    <filter id="topology-shadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="19"/></filter>
    <filter id="topology-grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence baseFrequency=".015" numOctaves="2" seed="35" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="topology-ground" width="1000" height="760"/>
  <ellipse class="topology-haze" cx="500" cy="380" rx="430" ry="300"/>
  <path class="topology-body" d="${current.bodyPath}" fill-rule="evenodd" filter="url(#topology-grain)"/>
  <path class="topology-edge" d="${current.bodyPath}" fill-rule="evenodd"/>
  <g aria-hidden="true">${threads}</g>
  <g aria-hidden="true">${cuts}</g>
  <g aria-hidden="true">${ports}</g>
  ${labels}`;

  if (current.interaction === 'attention-rewired') {
    stageReadout.textContent = 'dwell accepted · the unobserved threshold opened elsewhere';
  } else if (current.interaction === 'attention-refused-flicker') {
    stageReadout.textContent = 'flicker refused · the body stayed exact';
  } else if (current.interaction === 'attention-refused-overheld') {
    stageReadout.textContent = 'over-held attention refused · the body stayed closed';
  } else if (current.interaction === 'attention-memory-full') {
    stageReadout.textContent = 'four openings retained · lift or release';
  } else if (current.interaction === 'attention-lifted') {
    stageReadout.textContent = 'latest opening lifted · prior body restored';
  } else if (current.interaction === 'released') {
    stageReadout.textContent = 'topology released · seed body restored';
  } else if (pointerSession !== null) {
    stageReadout.textContent = 'attention held · waiting for release';
  } else {
    stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;
  }
  memoryReadout.textContent = `${current.memory.length} rewires · ${current.event?.committed ? `watched ${current.event.watchedPort + 1} / open ${current.event.unobservedPort + 1}` : 'the body is closed'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.portCount = String(current.ports.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.openings = String(current.state.cuts.length);
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  attentionControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  attentionControl.textContent = current.memory.length ? 'offer again' : 'offer attention';
}

function commitAttention(offer) {
  if (staticMode || blind) return;
  frame = applyAttention(frame, offer);
  notice = frame.event?.committed ? 'attention-rewired' : frame.interaction;
  render(frame);
}

function deterministicAttention() {
  commitAttention(DEFAULT_OFFERS[frame.memory.length % DEFAULT_OFFERS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestAttention(frame);
  notice = 'attention-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseTopology();
  notice = 'released';
  render(frame);
}

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)))
  };
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, startedAt: performance.now(), point: normalizedPoint(event.clientX, event.clientY) };
  render(frame);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  const duration = Math.round(performance.now() - pointerSession.startedAt);
  commitAttention({ point: pointerSession.point, duration });
  pointerSession = null;
  render(frame);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicAttention();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attentionControl.addEventListener('click', deterministicAttention);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
