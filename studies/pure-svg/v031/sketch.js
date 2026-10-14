import {
  JOINT_COUNT,
  MEMORY_WINDOW,
  applyMishearing,
  attendJoint,
  buildFrame,
  geometrySignature,
  jointPoint,
  liftLatestMishearing,
  releaseLine
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attendControl = document.querySelector('#attend-control');
const mishearControl = document.querySelector('#mishear-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
let frame = buildFrame(0, []);
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const fixed = (value) => Number(value).toFixed(2);

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Number(clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1).toFixed(4)),
    y: Number(clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1).toFixed(4))
  };
}

function stateLabel(current) {
  if (current.interaction === 'attention-held') return 'ATTENTION HELD / NO GEOMETRY WRITTEN';
  if (current.interaction === 'line-misheard') return 'LINE MISHEARD / UN-OFFERED WITNESS ROUTED';
  if (current.interaction === 'mishearing-refused-same-joint') return 'SAME JOINT REFUSED / ATTENTION REMAINS OPEN';
  if (current.interaction === 'mishearing-refused-adjacent') return 'ADJACENT JOINT REFUSED / ATTENTION NEEDS DISTANCE';
  if (current.interaction === 'mishearing-lifted') return 'LATEST MISHEARING LIFTED / PRIOR LINE RESTORED';
  if (current.interaction === 'mishearing-memory-full') return 'FOUR MISHEARINGS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'released') return 'LINE RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 12`;
}

function render(current = frame) {
  const latest = current.event?.committed ? current.event : null;
  const rememberedWitnesses = new Set(current.memory.map((event) => event.witness));
  const joints = current.joints.map((joint, index) => {
    const classes = ['joint'];
    if (current.armedJoint === index) classes.push('joint--observer');
    if (latest?.observer === index) classes.push('joint--observer');
    if (latest?.counter === index) classes.push('joint--counter');
    if (latest?.witness === index) classes.push('joint--witness');
    if (rememberedWitnesses.has(index)) classes.push('joint--remembered');
    return `<path class="${classes.join(' ')}" data-joint="${index}" d="${joint.pathSignature}"/>`;
  }).join('');
  const armedMark = !blind && current.armedJoint !== null && current.armedJoint !== undefined
    ? `<circle class="armed-mark" cx="${fixed(current.joints[current.armedJoint].x * 1000)}" cy="${fixed(current.joints[current.armedJoint].y * 680)}" r="27"/>`
    : '';
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="52">${stateLabel(current)}</text><text x="958" y="628" text-anchor="end">${JOINT_COUNT} JOINTS / ${current.memory.length} MISHEARINGS / ROUTE ${current.route.map((id) => id + 1).join('—')}</text></g>`;
  const routeTicks = blind ? '' : current.route.map((id, index) => {
    const point = jointPoint(current, id);
    return `<line class="route-tick" x1="${point.x * 1000}" y1="${point.y * 680 - 16}" x2="${point.x * 1000}" y2="${point.y * 680 - 24}" opacity="${0.18 + index * 0.035}"/>`;
  }).join('');

  field.innerHTML = `<defs>
    <radialGradient id="ground" cx="45%" cy="43%" r="82%"><stop offset="0" stop-color="#252532"/><stop offset=".55" stop-color="#151722"/><stop offset="1" stop-color="#090a10"/></radialGradient>
    <linearGradient id="thread" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6b18a"/><stop offset=".43" stop-color="#d7d0ae"/><stop offset=".7" stop-color="#a9c1d4"/><stop offset="1" stop-color="#c6a8cb"/></linearGradient>
    <filter id="grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="31" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="680"/>
  <path class="field-rim" d="M 92 332 C 176 94 748 52 906 302 C 1004 458 820 634 476 604 C 188 638 42 502 92 332 Z" filter="url(#grain)"/>
  <path class="line-shadow" d="${current.linePath}" transform="translate(9 13)"/>
  <path class="line-echo" d="${current.linePath}" transform="translate(-4 -5)"/>
  <path class="line-core${latest ? ' is-settled' : ''}" d="${current.linePath}"/>
  <g class="route-ticks" aria-hidden="true">${routeTicks}</g>
  <g class="joints" aria-hidden="true">${joints}${armedMark}</g>${labels}`;

  stageReadout.textContent = current.interaction === 'attention-held'
    ? 'first attention held · line unchanged'
    : current.interaction === 'line-misheard'
      ? 'second attention misheard · witness rerouted'
      : current.interaction === 'mishearing-refused-same-joint'
        ? 'same joint refused · no geometry written'
        : current.interaction === 'mishearing-refused-adjacent'
          ? 'adjacent joint refused · distance required'
          : current.interaction === 'mishearing-lifted'
            ? 'latest mishearing lifted · prior line restored'
            : current.interaction === 'mishearing-memory-full'
              ? 'four mishearings retained · lift or release'
              : current.interaction === 'released'
                ? 'line released · seed geometry restored'
                : `stage ${String(current.stage).padStart(2, '0')} / 12`;
  memoryReadout.textContent = `${current.memory.length} mishearings · ${latest ? `joints ${latest.observer + 1} + ${latest.counter + 1} → witness ${latest.witness + 1}` : 'the line is waiting'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.jointCount = String(current.joints.length);
  field.dataset.route = current.route.join(',');
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.observer = latest ? String(latest.observer) : '';
  field.dataset.counter = latest ? String(latest.counter) : '';
  field.dataset.witness = latest ? String(latest.witness) : '';
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  attendControl.disabled = current.memory.length >= MEMORY_WINDOW;
  mishearControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  attendControl.textContent = current.armedJoint === null ? 'attend a joint' : `joint ${current.armedJoint + 1} attended`;
}

function attend(point = { x: 0.18, y: 0.32 }) {
  if (staticMode || blind) return;
  frame = attendJoint(frame, point);
  notice = 'attention-held-no-write';
  render(frame);
}

function mishear(point = { x: 0.79, y: 0.32 }) {
  if (staticMode || blind) return;
  frame = applyMishearing(frame, point);
  notice = frame.event?.committed ? 'line-misheard' : frame.interaction;
  render(frame);
}

function gesture() {
  if (frame.armedJoint === null || frame.armedJoint === undefined) attend();
  else mishear();
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestMishearing(frame);
  notice = 'latest-mishearing-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseLine();
  notice = 'line-released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId };
  attend(normalizedPoint(event.clientX, event.clientY));
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  pointerSession = null;
  mishear(normalizedPoint(event.clientX, event.clientY));
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    gesture();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attendControl.addEventListener('click', () => attend());
mishearControl.addEventListener('click', () => mishear());
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
