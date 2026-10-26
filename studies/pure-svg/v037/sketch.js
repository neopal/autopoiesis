import {
  CELL_COUNT,
  MEMORY_WINDOW,
  applyTour,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestTour,
  releaseField
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const tourControl = document.querySelector('#tour-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const DEFAULT_TOURS = [
  { points: [{ x: 0.14, y: 0.22 }, { x: 0.29, y: 0.17 }, { x: 0.44, y: 0.25 }, { x: 0.61, y: 0.16 }] },
  { points: [{ x: 0.80, y: 0.25 }, { x: 0.59, y: 0.46 }, { x: 0.39, y: 0.56 }, { x: 0.19, y: 0.48 }] },
  { points: [{ x: 0.31, y: 0.78 }, { x: 0.39, y: 0.56 }, { x: 0.59, y: 0.46 }, { x: 0.67, y: 0.78 }] },
  { points: [{ x: 0.14, y: 0.22 }, { x: 0.19, y: 0.48 }, { x: 0.31, y: 0.78 }, { x: 0.67, y: 0.78 }] }
];

let frame = staticMode || blind ? buildTimeline().at(-1) : buildFrame();
let pointerSession = null;
let notice = '';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const fixed = (value) => Number(value).toFixed(2);

function centerForCell(cell, current) {
  const drift = (cell.id % 2 ? -1 : 1) * current.state.driftX;
  return {
    x: Math.max(0.08, Math.min(0.92, cell.x + cell.shiftX + drift * 0.62)),
    y: Math.max(0.09, Math.min(0.91, cell.y + cell.shiftY + current.state.driftY * (cell.id % 3 === 0 ? 0.8 : -0.35)))
  };
}

function stateLabel(current) {
  if (current.interaction === 'tour-committed') return 'TOUR ABSORBED / VACANCY MOVED ELSEWHERE';
  if (current.interaction === 'tour-refused-short') return 'FLICKER REFUSED / FIELD UNCHANGED';
  if (current.interaction === 'tour-refused-single-cell') return 'ONE PLACE REFUSED / FIELD UNCHANGED';
  if (current.interaction === 'tour-refused-sprawling') return 'SPRAWLING TOUR REFUSED / FIELD UNCHANGED';
  if (current.interaction === 'tour-memory-full') return 'FOUR VACANCIES RETAINED / LIFT OR RELEASE';
  if (current.interaction === 'tour-lifted') return 'LATEST VACANCY LIFTED / PRIOR FIELD RESTORED';
  if (current.interaction === 'released') return 'FIELD RELEASED / SEED RESTORED';
  return `STAGE ${String(current.stage).padStart(2, '0')} / 16`;
}

function cellClasses(cell, current) {
  const remembered = new Set(current.memory.flatMap((event) => [
    ...event.route,
    event.witnessCell,
    event.vacancyCell,
    event.relayCell
  ]));
  const classes = ['field-cell', `field-cell--${cell.role}`];
  if (remembered.has(cell.id)) classes.push('field-cell--remembered');
  return classes.join(' ');
}

function gesturePath(points) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${fixed(point.x * 1000)} ${fixed(point.y * 760)}`).join(' ');
}

function render(current = frame) {
  const labels = blind ? '' : `<g class="field-labels"><text x="42" y="48">${stateLabel(current)}</text><text x="958" y="714" text-anchor="end">${CELL_COUNT} CELLS / ${current.memory.length} TOURS / ${current.event?.committed ? `VACANCY ${current.event.vacancyCell + 1}` : 'QUIET'}</text></g>`;
  const cells = current.cells.map((cell) => `<path class="${cellClasses(cell, current)}" data-cell="${cell.id}" d="${cell.pathSignature}" fill-rule="evenodd"/>`).join('');
  const cellEdges = current.cells.map((cell) => `<path class="field-cell-edge" d="${cell.pathSignature}" fill-rule="evenodd"/>`).join('');
  const markers = current.cells.filter((cell) => cell.role !== 'quiet').map((cell) => {
    const center = centerForCell(cell, current);
    return `<circle class="field-mark field-mark--${cell.role}" cx="${fixed(center.x * 1000)}" cy="${fixed(center.y * 760)}" r="${cell.role === 'vacancy' ? 7 : 4}"/>`;
  }).join('');
  const offer = pointerSession?.points?.length > 1 ? `<path class="tour-offer" d="${gesturePath(pointerSession.points)}"/>` : '';

  field.innerHTML = `<defs>
    <linearGradient id="field-ground" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b1d2b"/><stop offset=".5" stop-color="#10121d"/><stop offset="1" stop-color="#080910"/></linearGradient>
    <linearGradient id="cell-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4dfc9"/><stop offset=".38" stop-color="#c8d8ba"/><stop offset=".72" stop-color="#b9b2d1"/><stop offset="1" stop-color="#dfad91"/></linearGradient>
    <linearGradient id="cell-vacancy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d5a7"/><stop offset=".55" stop-color="#db9d8b"/><stop offset="1" stop-color="#b996c5"/></linearGradient>
    <radialGradient id="field-haze" cx="48%" cy="44%" r="64%"><stop offset="0" stop-color="#aebfdb" stop-opacity=".13"/><stop offset=".7" stop-color="#777a9c" stop-opacity=".04"/><stop offset="1" stop-color="#05060b" stop-opacity="0"/></radialGradient>
    <filter id="field-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="field-grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence baseFrequency=".018" numOctaves="2" seed="37" result="grain"/><feColorMatrix in="grain" type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer><feBlend in="SourceGraphic" mode="screen"/></filter>
  </defs>
  <rect class="field-ground" width="1000" height="760"/>
  <ellipse class="field-haze" cx="500" cy="380" rx="455" ry="330"/>
  <path class="field-ghost" d="M 94 626 C 218 574 286 614 388 564 S 604 520 904 592"/>
  <path class="field-ghost field-ghost--second" d="M 118 112 C 288 174 382 92 548 142 S 762 198 912 124"/>
  <g class="field-cell-shadows" aria-hidden="true">${cells.replaceAll('field-cell', 'field-cell-shadow')}</g>
  <g class="field-cells" filter="url(#field-grain)">${cells}</g>
  <g class="field-cell-edges" aria-hidden="true">${cellEdges}</g>
  <g class="field-markers" aria-hidden="true">${markers}</g>
  ${offer}
  ${labels}`;

  if (current.interaction === 'tour-committed') stageReadout.textContent = 'tour accepted · witnessed cell contracted · vacancy opened remotely';
  else if (current.interaction === 'tour-refused-short') stageReadout.textContent = 'flicker refused · the field stayed exact';
  else if (current.interaction === 'tour-refused-single-cell') stageReadout.textContent = 'one place refused · visit at least three cells';
  else if (current.interaction === 'tour-refused-sprawling') stageReadout.textContent = 'sprawling tour refused · the field stayed exact';
  else if (current.interaction === 'tour-memory-full') stageReadout.textContent = 'four vacancies retained · lift or release';
  else if (current.interaction === 'tour-lifted') stageReadout.textContent = 'latest vacancy lifted · prior field restored';
  else if (current.interaction === 'released') stageReadout.textContent = 'field released · seed restored';
  else if (pointerSession !== null) stageReadout.textContent = 'proximity tour in progress · visit another cell';
  else stageReadout.textContent = `stage ${String(current.stage).padStart(2, '0')} / 16`;

  memoryReadout.textContent = `${current.memory.length} tours · ${current.event?.committed ? `witness ${current.event.witnessCell + 1} / vacancy ${current.event.vacancyCell + 1}` : 'the field is uncommitted'}`;
  field.dataset.stage = String(current.stage);
  field.dataset.memory = String(current.memory.length);
  field.dataset.signature = geometrySignature(current);
  field.dataset.interaction = current.interaction;
  field.dataset.cellCount = String(current.cells.length);
  field.dataset.vacancyCount = String(current.state.vacancyCount);
  field.dataset.notice = notice;
  updateButtons(current);
}

function updateButtons(current) {
  tourControl.disabled = current.memory.length >= MEMORY_WINDOW;
  liftControl.disabled = current.memory.length === 0;
  tourControl.textContent = current.memory.length ? 'walk again' : 'walk the field';
}

function commitTour(tour) {
  if (staticMode || blind) return;
  frame = applyTour(frame, tour);
  notice = frame.event?.committed ? 'tour-committed' : frame.interaction;
  render(frame);
}

function deterministicTour() {
  commitTour(DEFAULT_TOURS[frame.memory.length % DEFAULT_TOURS.length]);
}

function lift() {
  if (staticMode || blind || !frame.memory.length) return;
  frame = liftLatestTour(frame);
  notice = 'tour-lifted';
  render(frame);
}

function release() {
  if (staticMode || blind) return;
  pointerSession = null;
  frame = releaseField();
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
  const tour = { points: pointerSession.points };
  pointerSession = null;
  commitTour(tour);
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
  render(frame);
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicTour();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

tourControl.addEventListener('click', deterministicTour);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

render(frame);
window._mutineReady = true;
