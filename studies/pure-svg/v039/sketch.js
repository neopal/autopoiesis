import {
  CONTOUR_COUNT,
  MEMORY_WINDOW,
  applyClosureAttempt,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestAttempt,
  releaseContour
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attemptControl = document.querySelector('#attempt-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_SWEEPS = [
  { points: [{ x: 0.22, y: 0.56 }, { x: 0.30, y: 0.26 }, { x: 0.62, y: 0.18 }, { x: 0.78, y: 0.25 }] },
  { points: [{ x: 0.76, y: 0.50 }, { x: 0.68, y: 0.22 }, { x: 0.42, y: 0.16 }, { x: 0.34, y: 0.21 }] },
  { points: [{ x: 0.27, y: 0.25 }, { x: 0.33, y: 0.55 }, { x: 0.62, y: 0.60 }, { x: 0.73, y: 0.58 }] },
  { points: [{ x: 0.70, y: 0.22 }, { x: 0.61, y: 0.48 }, { x: 0.37, y: 0.58 }, { x: 0.29, y: 0.56 }] }
];

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

function appendPoint(point) {
  const last = pointerSession?.points.at(-1);
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.012) {
    pointerSession.points.push(point);
  }
  if (pointerSession.points.length > 18) pointerSession.points.shift();
}

function stateLabel(current) {
  if (current.interaction === 'attempt-committed') return 'TURN STORED / THE CONTOUR DID NOT CLOSE';
  if (current.interaction === 'attempt-refused-flat') return 'FLAT OFFER REFUSED / TURN THROUGH THE BODY';
  if (current.interaction === 'attempt-refused-short') return 'SHORT TURN REFUSED / TOO LITTLE PRESSURE';
  if (current.interaction === 'attempt-refused-long') return 'LONG TURN REFUSED / CONTOUR STAYS QUIET';
  if (current.interaction === 'attempt-refused-incomplete') return 'INCOMPLETE TURN / KEEP MOVING';
  if (current.interaction === 'attempt-memory-full') return 'FOUR TURNS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'attempt-lifted') return 'LATEST TURN LIFTED / PRIOR WINDING RESTORED';
  if (current.interaction === 'released') return 'CONTOUR RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function previewPath(points) {
  if (!points || points.length < 2) return '';
  return `M ${points.map((point) => `${fixed(point.x * 1000)} ${fixed(point.y * 760)}`).join(' L ')}`;
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels" aria-hidden="true"><text x="44" y="52">${stateLabel(current)}</text><text x="956" y="710" text-anchor="end">ONE CONTOUR / ${current.memory.length} TURNS / ${current.event?.committed ? `GAP ${current.state.gapIndex + 1}` : 'QUIET'}</text></g>`;
  const preview = pointerSession ? `<path class="turn-preview" d="${previewPath(pointerSession.points)}"/>` : '';
  const contour = current.contours[0];
  field.innerHTML = `<defs>
    <linearGradient id="field-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1d26"/><stop offset=".48" stop-color="#0e1118"/><stop offset="1" stop-color="#07080c"/></linearGradient>
    <linearGradient id="contour-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eee6d4"/><stop offset=".33" stop-color="#d3d0bd"/><stop offset=".64" stop-color="#c0b1cb"/><stop offset="1" stop-color="#d59e87"/></linearGradient>
    <linearGradient id="contour-edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6dd" stop-opacity=".92"/><stop offset=".52" stop-color="#d5bfaa" stop-opacity=".48"/><stop offset="1" stop-color="#8e7082" stop-opacity=".76"/></linearGradient>
    <radialGradient id="field-haze" cx="50%" cy="48%" r="68%"><stop offset="0" stop-color="#b7bfcc" stop-opacity=".15"/><stop offset=".58" stop-color="#7e819b" stop-opacity=".05"/><stop offset="1" stop-color="#040509" stop-opacity="0"/></radialGradient>
    <filter id="contour-shadow" x="-25%" y="-25%" width="150%" height="165%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="contour-grain" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence baseFrequency=".014" numOctaves="2" seed="39" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="760"/>
  <ellipse class="field-haze" cx="500" cy="380" rx="470" ry="342"/>
  <circle class="field-ring" cx="500" cy="380" r="290"/>
  <circle class="field-ring field-ring--inner" cx="500" cy="380" r="204"/>
  <path class="contour-shadow" d="${contour.pathSignature}" fill-rule="evenodd"/>
  <path class="contour" data-contour="0" d="${contour.pathSignature}" fill-rule="evenodd"/>
  <path class="contour-edge" d="${contour.pathSignature}" fill-rule="evenodd"/>
  ${preview}
  ${labels}`;

  if (current.interaction === 'attempt-committed') stageReadout.textContent = 'turn stored · the contour kept one body and opened elsewhere';
  else if (current.interaction === 'attempt-refused-flat') stageReadout.textContent = 'flat offer refused · turn through the body';
  else if (current.interaction === 'attempt-refused-short') stageReadout.textContent = 'short turn refused · the contour stayed exact';
  else if (current.interaction === 'attempt-refused-long') stageReadout.textContent = 'long turn refused · the contour stayed exact';
  else if (current.interaction === 'attempt-refused-incomplete') stageReadout.textContent = 'incomplete turn · keep moving before release';
  else if (current.interaction === 'attempt-memory-full') stageReadout.textContent = 'four turns retained · lift or release';
  else if (current.interaction === 'attempt-lifted') stageReadout.textContent = 'latest turn lifted · prior winding restored';
  else if (current.interaction === 'released') stageReadout.textContent = 'contour released · seed restored';
  else if (pointerSession !== null) stageReadout.textContent = 'turn in progress · the gesture is temporary';
  else stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;

  memoryReadout.textContent = `${current.memory.length} turns · ${current.event?.committed ? `winding ${current.state.winding > 0 ? '+' : ''}${current.state.winding} / gap ${current.state.gapIndex + 1}` : 'the contour is quiet'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.contourCount = String(current.contours.length);
  field.dataset.winding = String(current.state.winding);
  field.dataset.gapIndex = String(current.state.gapIndex);
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  attemptControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  attemptControl.textContent = current.memory.length ? 'turn again' : 'try a turn';
}

function commitAttempt(attempt) {
  if (staticMode || blind) return;
  frame = applyClosureAttempt(frame, attempt);
  notice = frame.interaction;
  render(frame);
}

function deterministicAttempt() {
  commitAttempt(DEFAULT_SWEEPS[frame.memory.length % DEFAULT_SWEEPS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestAttempt(frame);
  notice = 'attempt-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseContour();
  notice = 'released';
  render(frame);
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  field.setPointerCapture?.(event.pointerId);
  pointerSession = { pointerId: event.pointerId, points: [normalizedPoint(event.clientX, event.clientY)] };
  render(frame);
}, true);

field.addEventListener('pointermove', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  appendPoint(normalizedPoint(event.clientX, event.clientY));
  render(frame);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  appendPoint(normalizedPoint(event.clientX, event.clientY));
  field.releasePointerCapture?.(event.pointerId);
  const attempt = { points: pointerSession.points };
  pointerSession = null;
  commitAttempt(attempt);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicAttempt();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attemptControl.addEventListener('click', deterministicAttempt);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
