import {
  MEMORY_WINDOW,
  applyStroke,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestStroke,
  releaseGrowth
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const strokeControl = document.querySelector('#stroke-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_STROKES = [
  { points: [{ x: 0.12, y: 0.7 }, { x: 0.23, y: 0.62 }, { x: 0.34, y: 0.5 }] },
  { points: [{ x: 0.38, y: 0.28 }, { x: 0.47, y: 0.36 }, { x: 0.59, y: 0.52 }, { x: 0.68, y: 0.6 }] },
  { points: [{ x: 0.72, y: 0.72 }, { x: 0.78, y: 0.58 }, { x: 0.86, y: 0.46 }] },
  { points: [{ x: 0.48, y: 0.74 }, { x: 0.39, y: 0.62 }, { x: 0.31, y: 0.48 }] }
];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function pointForFilament(filament) {
  return { x: filament.anchor, y: 0.532 + filament.offset * 0.24 };
}

function endpointForFilament(filament) {
  const point = pointForFilament(filament);
  const reach = filament.reach + filament.id % 2 * 0.02;
  return { x: Math.min(0.98, point.x + reach), y: Math.max(0.08, Math.min(0.92, point.y + filament.bend * .06 + filament.lift * .05)) };
}

function pointPath(point) {
  return `${fixed(point.x * 1000)} ${fixed(point.y * 760)}`;
}

function stateLabel(current) {
  if (current.interaction === 'stroke-grown') return 'STROKE ABSORBED / REMOTE ORGAN GROWN';
  if (current.interaction === 'stroke-refused-short') return 'SHORT STROKE REFUSED / ORGAN UNCHANGED';
  if (current.interaction === 'stroke-refused-sprawling') return 'SPRAWLING STROKE REFUSED / ORGAN UNCHANGED';
  if (current.interaction === 'growth-memory-full') return 'FOUR GROWTHS RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'stroke-lifted') return 'LATEST GROWTH LIFTED / PRIOR ORGAN RESTORED';
  if (current.interaction === 'released') return 'GROWTH RELEASED / SEED ORGAN RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function filamentClasses(filament, current) {
  const remembered = new Set(current.memory.flatMap((event) => [event.sourceFilament, event.remoteFilament, event.counterFilament]));
  const classes = ['field-filament', `field-filament--${filament.role}`];
  if (remembered.has(filament.id)) classes.push('field-filament--remembered');
  return classes.join(' ');
}

function gesturePath(points) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${pointPath(point)}`).join(' ');
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="48">${stateLabel(current)}</text><text x="958" y="714" text-anchor="end">${current.filaments.length} FILAMENTS / ${current.memory.length} GROWTHS / ${current.event?.committed ? `${current.event.length.toFixed(2)} FIELD` : 'QUIET'}</text></g>`;
  const filaments = current.filaments.map((filament) => `<path class="${filamentClasses(filament, current)}" data-filament="${filament.id}" d="${filament.pathSignature}"/>`).join('');
  const knots = current.filaments.map((filament) => {
    const start = pointForFilament(filament);
    const end = endpointForFilament(filament);
    return `<circle class="field-knot field-knot--${filament.role}" data-knot="${filament.id}" cx="${fixed(start.x * 1000)}" cy="${fixed(start.y * 760)}" r="5"/><circle class="field-knot field-knot--${filament.role}" cx="${fixed(end.x * 1000)}" cy="${fixed(end.y * 760)}" r="3.4"/>`;
  }).join('');
  const offer = pointerSession?.points?.length > 1 ? `<path class="gesture-offer" d="${gesturePath(pointerSession.points)}"/>` : '';

  field.innerHTML = `<defs>
    <linearGradient id="field-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#202122"/><stop offset=".52" stop-color="#111719"/><stop offset="1" stop-color="#090b0d"/></linearGradient>
    <linearGradient id="field-spine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7c29c"/><stop offset=".38" stop-color="#d7e2ba"/><stop offset=".72" stop-color="#b4d0c7"/><stop offset="1" stop-color="#c8a4c3"/></linearGradient>
    <radialGradient id="field-vignette" cx="48%" cy="46%" r="62%"><stop offset="0" stop-color="#b6d6bd" stop-opacity=".16"/><stop offset=".62" stop-color="#9c8299" stop-opacity=".05"/><stop offset="1" stop-color="#050607" stop-opacity="0"/></radialGradient>
    <pattern id="field-grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#d4d8ca" stroke-opacity=".08" stroke-width="1"/></pattern>
    <filter id="soft-shadow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="11"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="760"/>
  <rect class="field-grid" width="1000" height="760"/>
  <ellipse class="field-vignette" cx="505" cy="372" rx="470" ry="340"/>
  <path class="field-spine-shadow" d="${current.spinePath}"/>
  <path class="field-spine" d="${current.spinePath}"/>
  <path class="field-spine-highlight" d="${current.spinePath}"/>
  <g aria-hidden="true">${filaments}</g>
  <g aria-hidden="true">${knots}</g>
  ${offer}
  ${labels}`;

  if (current.interaction === 'stroke-grown') stageReadout.textContent = 'stroke absorbed · remote filament grown · counter-strand loosened';
  else if (current.interaction === 'stroke-refused-short') stageReadout.textContent = 'short stroke refused · geometry stayed exact';
  else if (current.interaction === 'stroke-refused-sprawling') stageReadout.textContent = 'sprawling stroke refused · geometry stayed exact';
  else if (current.interaction === 'growth-memory-full') stageReadout.textContent = 'four growths retained · lift or release';
  else if (current.interaction === 'stroke-lifted') stageReadout.textContent = 'latest growth lifted · prior organism restored';
  else if (current.interaction === 'released') stageReadout.textContent = 'growth released · seed organism restored';
  else if (pointerSession !== null) stageReadout.textContent = 'field accepting a stroke · release to grow';
  else stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;

  memoryReadout.textContent = `${current.memory.length} growths · ${current.event?.committed ? `source ${current.event.sourceFilament + 1} / remote ${current.event.remoteFilament + 1}` : 'the filament is quiet'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.filamentCount = String(current.filaments.length);
  field.dataset.grownCount = String(current.filaments.filter((filament) => filament.role === 'grown').length);
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  strokeControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  strokeControl.textContent = current.memory.length ? 'feed another stroke' : 'feed a stroke';
}

function commitStroke(stroke) {
  if (staticMode || blind) return;
  frame = applyStroke(frame, stroke);
  notice = frame.event?.committed ? 'stroke-grown' : frame.interaction;
  render(frame);
}

function deterministicStroke() {
  commitStroke(DEFAULT_STROKES[frame.memory.length % DEFAULT_STROKES.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestStroke(frame);
  notice = 'stroke-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseGrowth();
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

function addPointerPoint(event) {
  const point = normalizedPoint(event.clientX, event.clientY);
  const previous = pointerSession?.points.at(-1);
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.008) pointerSession?.points.push(point);
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
  addPointerPoint(event);
  render(frame);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  event.preventDefault();
  addPointerPoint(event);
  field.releasePointerCapture?.(event.pointerId);
  const stroke = { points: pointerSession.points };
  pointerSession = null;
  commitStroke(stroke);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicStroke();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

strokeControl.addEventListener('click', deterministicStroke);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
