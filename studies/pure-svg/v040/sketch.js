import {
  MEMORY_WINDOW,
  PORTAL_COUNT,
  armWitness,
  buildFrame,
  buildTimeline,
  commitResponse,
  geometrySignature,
  liftLatestResponse,
  releaseMass
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const answerControl = document.querySelector('#answer-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_WITNESSES = [1, 5, 0, 4];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function normalizedPoint(clientX, clientY) {
  const bounds = field.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (clientX - bounds.left) / Math.max(1, bounds.width))),
    y: Math.max(0, Math.min(1, (clientY - bounds.top) / Math.max(1, bounds.height)))
  };
}

function nearestPortal(point) {
  let candidate = null;
  let distance = Infinity;
  frame.portals.forEach((portal) => {
    const next = Math.hypot(point.x - portal.x, point.y - portal.y);
    if (next < distance) {
      candidate = portal.id;
      distance = next;
    }
  });
  return distance < 0.115 ? candidate : null;
}

function stateLabel(current) {
  if (current.interaction === 'witness-armed') return `WITNESS ${current.selectedIndex + 1} / THE MASS STAYS EXACT`;
  if (current.interaction === 'response-committed') return 'ANSWER STORED / THE WITNESS WAS NOT THE REPLY';
  if (current.interaction === 'response-refused-unarmed') return 'NO WITNESS / THE MASS REFUSES A BLIND ANSWER';
  if (current.interaction === 'response-refused-memory-full') return 'FOUR ANSWERS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'response-lifted') return 'LATEST ANSWER LIFTED / PRIOR MASS RESTORED';
  if (current.interaction === 'released') return 'MASS RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function markerMarkup(current) {
  if (blind || staticMode) return '';
  return `<g class="portal-markers" aria-hidden="true">${current.portals.map((portal) => {
    const selected = portal.id === current.selectedIndex;
    return `<circle class="portal-marker${selected ? ' is-selected' : ''}" cx="${fixed(portal.x * 1000)}" cy="${fixed(portal.y * 760)}" r="${selected ? 34 : 26}" data-portal-marker="${portal.id}"/>`;
  }).join('')}</g>`;
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels" aria-hidden="true"><text x="46" y="52">${stateLabel(current)}</text><text x="954" y="710" text-anchor="end">SOLID MASS / ${current.memory.length} ANSWERS / ${current.event?.committed ? 'REMOTE' : 'QUIET'}</text></g>`;
  field.innerHTML = `<defs>
    <linearGradient id="field-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a2024"/><stop offset=".46" stop-color="#0d1216"/><stop offset="1" stop-color="#07090b"/></linearGradient>
    <linearGradient id="mass-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7dfc8"/><stop offset=".32" stop-color="#c9c1aa"/><stop offset=".68" stop-color="#a8b5b5"/><stop offset="1" stop-color="#cf9278"/></linearGradient>
    <linearGradient id="mass-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff5d7" stop-opacity=".88"/><stop offset=".52" stop-color="#c6a98f" stop-opacity=".42"/><stop offset="1" stop-color="#809497" stop-opacity=".8"/></linearGradient>
    <radialGradient id="field-haze" cx="52%" cy="46%" r="66%"><stop offset="0" stop-color="#b8c8c5" stop-opacity=".14"/><stop offset=".58" stop-color="#70818a" stop-opacity=".04"/><stop offset="1" stop-color="#020304" stop-opacity="0"/></radialGradient>
    <filter id="mass-shadow" x="-18%" y="-18%" width="140%" height="150%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="mass-tooth" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence baseFrequency=".012" numOctaves="2" seed="40" result="tooth"/><feColorMatrix in="tooth" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .065"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="760"/>
  <ellipse class="field-haze" cx="505" cy="372" rx="470" ry="342"/>
  <path class="mass-shadow" d="${current.mass.pathSignature}" fill-rule="evenodd"/>
  <path class="mass-edge" d="${current.mass.pathSignature}" fill-rule="evenodd"/>
  <path class="mass" data-mass="true" d="${current.mass.pathSignature}" fill-rule="evenodd"/>
  ${markerMarkup(current)}
  ${labels}`;

  if (current.interaction === 'response-committed') stageReadout.textContent = 'answer stored · three remote apertures changed';
  else if (current.interaction === 'witness-armed') stageReadout.textContent = `witness ${current.selectedIndex + 1} held · geometry stayed exact`;
  else if (current.interaction === 'response-refused-unarmed') stageReadout.textContent = 'no witness · choose an aperture first';
  else if (current.interaction === 'response-refused-memory-full') stageReadout.textContent = 'four answers retained · lift or release';
  else if (current.interaction === 'response-lifted') stageReadout.textContent = 'latest answer lifted · prior mass restored';
  else if (current.interaction === 'released') stageReadout.textContent = 'mass released · seed restored';
  else stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;

  memoryReadout.textContent = `${current.memory.length} answers · ${current.event?.committed ? 'the reply is elsewhere' : 'the mass is quiet'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.portalCount = String(current.portals.length);
  field.dataset.massCount = '1';
  field.dataset.pathCount = String(field.querySelectorAll('path[data-mass]').length);
  field.dataset.selectedIndex = current.selectedIndex === null ? '' : String(current.selectedIndex);
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  answerControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  answerControl.textContent = current.selectedIndex === null ? 'answer elsewhere' : 'answer this witness';
}

function select(index) {
  if (staticMode || blind || index === null) return;
  frame = armWitness(frame, index);
  notice = 'witness-armed';
  render(frame);
}

function answer() {
  if (staticMode || blind) return;
  frame = commitResponse(frame);
  notice = frame.interaction;
  render(frame);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestResponse(frame);
  notice = 'response-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseMass();
  notice = 'released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  const index = nearestPortal(normalizedPoint(event.clientX, event.clientY));
  pointerSession = { pointerId: event.pointerId, index };
  if (index !== null) select(index);
  else {
    notice = 'witness-refused';
    render(frame);
  }
}, true);

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
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
    answer();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

answerControl.addEventListener('click', answer);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
