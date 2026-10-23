import {
  STATION_COUNT,
  buildFrame,
  commitRoute,
  geometrySignature,
  liftLatestRoute,
  nearestStation,
  releaseRoute,
  traceStation
} from './engine.mjs';

const DEFAULT_ROUTES = [[1, 6, 9], [3, 8, 0], [5, 2, 10], [4, 7, 1]];
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#route-field');
const svg = document.querySelector('#route-svg');
const links = document.querySelector('#route-links');
const stationsRoot = document.querySelector('#route-stations');
const routePreview = document.querySelector('#route-preview');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const traceControl = document.querySelector('#trace-route');
const liftControl = document.querySelector('#lift-route');
const releaseControl = document.querySelector('#release-route');

let currentFrame = staticPreview ? buildFrame(0, DEFAULT_ROUTES) : buildFrame(0, []);
let lastState = staticPreview ? 'route' : 'quiet';
let dragging = false;
let deterministicIndex = 0;

const svgElement = (name, attributes = {}) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
};

function drawGrid() {
  const grid = document.querySelector('.route-grid');
  if (!grid || grid.childElementCount) return;
  for (let index = 1; index < 10; index += 1) {
    const position = index / 10;
    grid.appendChild(svgElement('line', { x1: position, y1: 0, x2: position, y2: 1 }));
    grid.appendChild(svgElement('line', { x1: 0, y1: position, x2: 1, y2: position }));
  }
}

function ensureStations() {
  if (stationsRoot.childElementCount === STATION_COUNT) return;
  stationsRoot.replaceChildren();
  for (let index = 0; index < STATION_COUNT; index += 1) {
    const group = svgElement('g', { class: 'station', 'data-station-id': index });
    group.appendChild(svgElement('circle', { class: 'station-pin', r: '.013' }));
    group.appendChild(svgElement('path', { class: 'station-thread' }));
    const glyph = svgElement('text', { class: 'station-glyph', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    const stationIndex = svgElement('text', { class: 'station-index', 'text-anchor': 'middle' });
    group.append(glyph, stationIndex);
    stationsRoot.appendChild(group);
  }
}

function routePathForStations(stations, route) {
  if (!route.length) return '';
  return route.map((stationId, index) => `${index === 0 ? 'M' : 'L'} ${stations[stationId].x} ${stations[stationId].y}`).join(' ');
}

function renderFrame() {
  links.replaceChildren();
  currentFrame.routePaths.forEach((path) => links.appendChild(svgElement('path', { class: 'route-link', d: path })));
  currentFrame.stations.forEach((station, index) => {
    const group = stationsRoot.children[index];
    if (!group) return;
    group.dataset.role = station.role;
    group.dataset.inheritedFrom = station.inheritedFrom === null ? '' : String(station.inheritedFrom);
    group.classList.toggle('is-traced', currentFrame.route.includes(index));
    group.setAttribute('transform', `rotate(${station.rotation} ${station.x} ${station.y})`);
    const pin = group.querySelector('.station-pin');
    const thread = group.querySelector('.station-thread');
    const glyph = group.querySelector('.station-glyph');
    const stationIndex = group.querySelector('.station-index');
    pin.setAttribute('cx', station.x);
    pin.setAttribute('cy', station.y);
    thread.setAttribute('d', station.path);
    glyph.setAttribute('x', station.x);
    glyph.setAttribute('y', station.y);
    glyph.setAttribute('font-size', roundGlyphSize(station.scale));
    glyph.textContent = station.glyph;
    stationIndex.setAttribute('x', station.x);
    stationIndex.setAttribute('y', station.y + .06);
    stationIndex.textContent = String(index + 1).padStart(2, '0');
  });
  const preview = routePathForStations(currentFrame.stations, currentFrame.route);
  routePreview.setAttribute('d', preview);
  routePreview.classList.toggle('is-visible', currentFrame.route.length > 0);
}

function roundGlyphSize(scale) {
  return Math.max(.075, Math.min(.16, .108 * scale));
}

function updateUi(frame, state = 'quiet') {
  currentFrame = frame;
  lastState = state;
  const load = frame.stations.reduce((sum, station) => sum + station.load, 0);
  const stageLabel = state === 'tracing'
    ? `route / ${frame.route.length} of 3`
    : state === 'route'
      ? `route / committed ${String(frame.history.length).padStart(2, '0')}`
      : state === 'refused'
        ? 'route / refused'
        : state === 'lifted'
          ? 'route / latest lifted'
          : state === 'released'
            ? 'route / released'
            : 'field / quiet';
  if (stageReadout) stageReadout.textContent = stageLabel;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} routes · load ${load.toFixed(1)}`;
  if (interactionState) {
    interactionState.textContent = state === 'tracing'
      ? `${frame.route.length} station${frame.route.length === 1 ? '' : 's'} crossed. The field is still exact.`
      : state === 'route'
        ? 'The route answered at a distance: source, relay, and hinge carry the change.'
        : state === 'refused'
          ? 'The route stayed inert. Three distinct stations are required.'
          : state === 'lifted'
            ? 'The latest route is gone. The preceding field is exact again.'
            : state === 'released'
              ? 'The route memory is released. Every station is quiet again.'
              : 'The route is quiet. No station has been crossed.';
  }
  field.dataset.stage = String(state);
  field.dataset.route = frame.route.join(',');
  field.dataset.memory = String(frame.memory.length);
  field.dataset.signature = geometrySignature(frame);
  liftControl.disabled = staticPreview || frame.memory.length === 0;
  traceControl.disabled = staticPreview;
  releaseControl.disabled = staticPreview;
  renderFrame();
}

function stationAtPoint(event) {
  const svgRect = svg.getBoundingClientRect();
  const points = [...stationsRoot.children].map((group, id) => {
    const rect = group.querySelector('.station-pin').getBoundingClientRect();
    return { id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  return nearestStation(points, { x: event.clientX, y: event.clientY }, Math.max(18, Math.min(svgRect.width, svgRect.height) * .025));
}

function trace(index) {
  if (staticPreview || index < 0) return false;
  const next = traceStation(currentFrame, index);
  updateUi(next, next.lastEvent === 'refused' ? 'refused' : 'tracing');
  return next.lastEvent !== 'refused';
}

function finishRoute() {
  if (staticPreview) return false;
  const next = commitRoute(currentFrame);
  const committed = next.lastEvent === 'route';
  updateUi(next, committed ? 'route' : 'refused');
  return committed;
}

function traceDefault() {
  if (staticPreview) return false;
  currentFrame = { ...currentFrame, route: [] };
  const route = DEFAULT_ROUTES[deterministicIndex % DEFAULT_ROUTES.length];
  deterministicIndex += 1;
  route.forEach((stationId) => { currentFrame = traceStation(currentFrame, stationId); });
  updateUi(currentFrame, 'tracing');
  return finishRoute();
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  updateUi(liftLatestRoute(currentFrame), 'lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  updateUi(releaseRoute(), 'released');
  return true;
}

function handlePointerDown(event) {
  if (staticPreview || event.target.closest('button')) return;
  dragging = true;
  field.focus({ preventScroll: true });
  currentFrame = { ...currentFrame, route: [] };
  const station = stationAtPoint(event);
  if (station >= 0) trace(station);
  field.setPointerCapture?.(event.pointerId);
}

function handlePointerMove(event) {
  if (!dragging || staticPreview) return;
  const station = stationAtPoint(event);
  if (station >= 0 && !currentFrame.route.includes(station)) trace(station);
}

function handlePointerUp(event) {
  if (!dragging) return;
  dragging = false;
  field.releasePointerCapture?.(event.pointerId);
  if (currentFrame.route.length === 3) finishRoute();
}

function handleKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    traceDefault();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
}

drawGrid();
ensureStations();
updateUi(currentFrame, lastState);
field.addEventListener('pointerdown', handlePointerDown);
field.addEventListener('pointermove', handlePointerMove);
field.addEventListener('pointerup', handlePointerUp);
field.addEventListener('pointercancel', handlePointerUp);
field.addEventListener('keydown', handleKey);
traceControl.addEventListener('click', traceDefault);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

window._p5Ready = true;
window.__mutineHandwritingV031 = {
  getState: () => ({
    memory: currentFrame.memory.length,
    route: [...currentFrame.route],
    changedStationIds: [...currentFrame.changedStationIds],
    lastEvent: currentFrame.lastEvent,
    interaction: lastState
  }),
  getSignature: () => geometrySignature(currentFrame),
  traceStation: trace,
  commitDefault: traceDefault,
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
