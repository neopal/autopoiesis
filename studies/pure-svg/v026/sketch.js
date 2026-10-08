import {
  FRAGMENT_COUNT,
  MEMORY_LIMIT,
  STAGES,
  applyDeparture,
  attendFragment,
  buildTimeline,
  geometrySignature,
  liftLatestDeparture,
  releaseChoir
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attendControl = document.querySelector('#attend-control');
const departControl = document.querySelector('#depart-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const blind = params.get('blind') === '1';
const frozen = reducedMotion || staticMode;

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = ['#f2e7c9', '#ee7b5c', '#a8d8c8', '#ddb65b', '#8a78c7', '#d9a5bd'];
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;
let selectedFragment = 4;
let pointerSession = null;
let notice = '';

const px = (value) => Number(value).toFixed(2);
const pointsAttribute = (points) => points.map(([x, y]) => `${px(x)},${px(y)}`).join(' ');

function viewPoint(clientX, clientY) {
  const transform = field.getScreenCTM?.();
  if (transform) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(transform.inverse());
    return [point.x, point.y];
  }
  const bounds = field.getBoundingClientRect();
  return [
    ((clientX - bounds.left) / Math.max(1, bounds.width)) * 1000,
    ((clientY - bounds.top) / Math.max(1, bounds.height)) * 680
  ];
}

function nearestFragment(clientX, clientY, frame = interactionBase()) {
  const [x, y] = viewPoint(clientX, clientY);
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  frame.tiles.forEach((tile, index) => {
    const [tx, ty] = tile.centre;
    const distance = (x - tx) ** 2 + (y - ty) ** 2;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = index;
    }
  });
  return nearest;
}

function render(frame, state = frame.interaction ?? 'quiet') {
  const latest = frame.memory.at(-1);
  const stateLabel = state === 'remote-echo'
    ? 'DEPARTURE REGISTERED / DISTANT REPLY'
    : state === 'attend-only'
      ? 'ATTENTION HELD / NO ABSENCE YET'
      : state === 'lifted'
        ? 'LATEST ABSENCE LIFTED / CONSTELLATION RESTORED'
        : state === 'absence-memory-full'
          ? 'FOUR ABSENCES RETAINED / LIFT OR RELEASE'
          : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const fragments = frame.tiles.map((tile, index) => {
    const armedClass = frame.armed === index ? ' fragment--armed' : '';
    const colour = palette[index % palette.length];
    return `<polygon class="fragment fragment--${tile.role}${armedClass}" data-fragment="${index}" points="${pointsAttribute(tile.points)}" style="--fragment-colour:${colour}"/>`;
  }).join('');
  const labels = blind ? '' : `<g class="svg-labels"><text x="42" y="638">${stateLabel}</text><text x="958" y="638" text-anchor="end">${FRAGMENT_COUNT} FRAGMENTS / ${frame.memory.length} DEPARTURES / ${latest ? `${latest.source + 1} ⇢ ${latest.relay + 1}` : 'NO ONE HAS LEFT'}</text></g>`;

  field.innerHTML = `<defs>
    <radialGradient id="field-ground" cx="52%" cy="45%" r="82%"><stop offset="0" stop-color="#263b3a"/><stop offset=".44" stop-color="#172326"/><stop offset="1" stop-color="#080b10"/></radialGradient>
    <linearGradient id="field-wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2e7c9" stop-opacity=".07"/><stop offset=".48" stop-color="#ee7b5c" stop-opacity=".02"/><stop offset="1" stop-color="#a8d8c8" stop-opacity=".1"/></linearGradient>
    <filter id="fragment-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect class="field-ground" x="0" y="0" width="1000" height="680"/>
  <rect class="field-wash" x="18" y="18" width="964" height="644" rx="44"/>
  <g class="fragment-field">${fragments}</g>${labels}`;
  stageReadout.textContent = state === 'remote-echo'
    ? 'departure answered / a distant fragment carries the reply'
    : state === 'attend-only'
      ? 'attention held / memory remains at zero'
      : state === 'lifted'
        ? 'latest absence lifted / prior constellation restored'
        : state === 'absence-memory-full'
          ? 'four departures retained / lift or release'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} departures · ${latest ? `fragment ${latest.source + 1} withdrew / ${latest.relay + 1} answered` : 'the field is quiet'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.absenceCount = String(frame.absenceCount);
  field.dataset.fragmentCount = String(frame.tiles.length);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.armed = frame.armed === null ? '' : String(frame.armed);
  field.dataset.gesture = 'attend-then-depart';
  field.dataset.notice = notice;
  updateButtons(frame);
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (2700 * timeline.length)) / 2700);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'remote-echo');
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

function attend(index = selectedFragment) {
  if (staticMode || blind) return;
  selectedFragment = ((Number(index) % FRAGMENT_COUNT) + FRAGMENT_COUNT) % FRAGMENT_COUNT;
  interactionFrame = attendFragment(interactionBase(), selectedFragment);
  notice = `fragment-${selectedFragment + 1}-attended`;
  render(interactionFrame, 'attend-only');
}

function depart(index = selectedFragment) {
  if (staticMode || blind) return;
  const next = applyDeparture(interactionFrame ?? interactionBase(), index);
  interactionFrame = next;
  selectedFragment = next.departure?.relay ?? selectedFragment;
  notice = next.departure?.committed ? 'departure-registered' : 'absence-memory-full';
  render(interactionFrame, next.interaction);
}

function liftLatest() {
  const base = interactionFrame ?? interactionBase();
  if (!base.memory.length || staticMode || blind) return;
  interactionFrame = { ...liftLatestDeparture(base), interaction: 'lifted', armed: null };
  notice = 'latest-absence-lifted';
  render(interactionFrame, 'lifted');
}

function release() {
  if (staticMode || blind) return;
  interactionFrame = null;
  selectedFragment = 4;
  pointerSession = null;
  notice = 'choir-released';
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  render(releaseChoir());
  requestAnimationFrame(renderCurrent);
}

function updateButtons(frame = interactionFrame ?? interactionBase()) {
  departControl.disabled = frame.memory.length >= MEMORY_LIMIT;
  liftControl.disabled = frame.memory.length === 0;
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  field.setPointerCapture?.(event.pointerId);
  selectedFragment = nearestFragment(event.clientX, event.clientY);
  attend(selectedFragment);
  pointerSession = { pointerId: event.pointerId, fragment: selectedFragment };
});

field.addEventListener('pointerup', (event) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId || staticMode || blind) return;
  field.releasePointerCapture?.(event.pointerId);
  depart(pointerSession.fragment);
  pointerSession = null;
});

field.addEventListener('pointercancel', () => {
  pointerSession = null;
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    attend(Number(event.key) - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    depart();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attendControl.addEventListener('click', () => attend(selectedFragment));
departControl.addEventListener('click', () => depart(selectedFragment));
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', release);

window._mutineReady = true;
renderCurrent();
