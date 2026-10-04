import {
  STAGES,
  STATION_COUNT,
  buildFrame,
  buildTimeline,
  applyWitnessDeparture,
  liftLatestWitness,
  geometrySignature,
  stationPoints
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;

const field = document.querySelector('#witness-field');
const svg = document.querySelector('#paint-svg');
const washLayer = document.querySelector('#wash-layer');
const seamLayer = document.querySelector('#seam-layer');
const markLayer = document.querySelector('#station-marks');
const labelLayer = document.querySelector('#station-labels');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const watchControl = document.querySelector('#watch-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');

const timeline = buildTimeline(STAGES);
let currentFrame = frozen ? timeline.at(-1) : timeline[0];
let activeStation = null;
let interactionStateName = 'sequence';
let visitorHasTakenOver = false;
let startedAt = performance.now();
let lastStage = currentFrame.stage;

const palette = ['#d78362', '#e1b05f', '#72bbb4', '#8e8ad4', '#bb769a', '#d6a65e', '#6da8cb'];
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const pointString = (points) => points.map((point) => `${(point.x * 1000).toFixed(2)},${(point.y * 650).toFixed(2)}`).join(' ');
const polygonPath = (points) => `M ${pointString(points)} Z`;
const innerPoints = (points, station) => points.map((point) => ({
  x: station.x + (point.x - station.x) * 0.73,
  y: station.y + (point.y - station.y) * 0.73
}));

function safeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function seamPath(previous, next, index) {
  const x1 = previous.x * 1000;
  const y1 = previous.y * 650;
  const x2 = next.x * 1000;
  const y2 = next.y * 650;
  const lift = Math.sin(index * 1.8 + next.seam * 3.2) * 34;
  const c1x = x1 + (x2 - x1) * 0.38;
  const c2x = x1 + (x2 - x1) * 0.68;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} C ${c1x.toFixed(2)} ${(y1 + lift).toFixed(2)}, ${c2x.toFixed(2)} ${(y2 - lift).toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function stationAt(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const x = clamp((clientX - rect.left) / rect.width);
  const y = clamp((clientY - rect.top) / rect.height);
  let nearest = 0;
  let distance = Infinity;
  currentFrame.stations.forEach((station, index) => {
    const dx = station.x - x;
    const dy = station.y - y;
    const nextDistance = dx * dx + dy * dy;
    if (nextDistance < distance) {
      distance = nextDistance;
      nearest = index;
    }
  });
  return nearest;
}

function render(frame = currentFrame, state = interactionStateName) {
  currentFrame = frame;
  interactionStateName = state;
  const stations = frame.stations;
  const wash = [];
  const seams = [];
  const marks = [];
  const labels = [];

  stations.forEach((station, index) => {
    const points = stationPoints(station, index);
    const fill = palette[index % palette.length];
    const cut = innerPoints(points, station);
    const armed = activeStation === index;
    wash.push(`<path data-paint-station="${index}" class="paint-station${armed ? ' armed' : ''}" d="${polygonPath(points)}" fill="${fill}" fill-opacity="${(0.68 + station.mass * 0.2).toFixed(3)}"><title>pigment station ${index + 1}</title></path>`);
    wash.push(`<path data-paint-inner="${index}" class="paint-inner" d="${polygonPath(cut)}" fill="none" stroke="rgba(9,13,24,.23)" stroke-width="${(2.4 + station.grain * 3).toFixed(2)}"/>`);
    if (index < stations.length - 1) {
      seams.push(`<path data-wet-seam="${index}" class="wet-seam${activeStation === index || activeStation === index + 1 ? ' highlight' : ''}" d="${seamPath(station, stations[index + 1], index)}"/>`);
    }
    const markRadius = 42 + station.notch * 24;
    marks.push(`<ellipse class="station-mark${armed ? ' armed' : ''}" cx="${(station.x * 1000).toFixed(2)}" cy="${(station.y * 650).toFixed(2)}" rx="${markRadius.toFixed(2)}" ry="${(markRadius * 0.72).toFixed(2)}" transform="rotate(${(station.tilt * 57.3).toFixed(2)} ${(station.x * 1000).toFixed(2)} ${(station.y * 650).toFixed(2)})"/>`);
    labels.push(`<text class="station-label" x="${(station.x * 1000).toFixed(2)}" y="${(station.y * 650 + 5).toFixed(2)}" text-anchor="middle">${safeText(String(index + 1).padStart(2, '0'))}</text>`);
  });

  washLayer.innerHTML = wash.join('');
  seamLayer.innerHTML = seams.join('');
  markLayer.innerHTML = marks.join('');
  labelLayer.innerHTML = labels.join('');

  const stageLabel = state === 'witness-departed'
    ? 'departure registered / the paint turned'
    : state === 'witness-refused'
      ? 'the paint refuses a repeated witness'
      : state === 'witness-lifted'
        ? 'latest witness lifted'
        : state === 'field-released'
          ? 'field released / first body restored'
          : activeStation === null
            ? `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`
            : `station ${String(activeStation + 1).padStart(2, '0')} is listening`;
  const memoryLabel = `${frame.memory.length} departure${frame.memory.length === 1 ? '' : 's'} held`;
  if (stageReadout) stageReadout.textContent = stageLabel;
  if (memoryReadout) memoryReadout.textContent = memoryLabel;
  if (interactionState) {
    interactionState.textContent = state === 'witness-departed'
      ? 'The witness left; the station turned and the later seam inherited its refusal.'
      : state === 'witness-refused'
        ? 'That station has already turned away. Approach another seam.'
        : state === 'witness-lifted'
          ? 'The latest departure is gone; the previous SVG body is exact.'
          : state === 'field-released'
            ? 'All witnesses released. The first connected body is restored.'
            : activeStation === null
              ? 'The paint has not been witnessed.'
              : `Station ${activeStation + 1} is armed. Leave the field to commit.`;
  }
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.stationCount = String(frame.stations.length);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.interaction = state;
  field.dataset.armed = activeStation === null ? '' : String(activeStation);
}

function commitStation(station, source = 'visitor-departure') {
  const next = applyWitnessDeparture(currentFrame, { station, source });
  visitorHasTakenOver = true;
  activeStation = null;
  render(next, next.interaction);
}

function defaultStation() {
  const last = currentFrame.memory.at(-1)?.station;
  return last === undefined ? 2 : (last + 2) % STATION_COUNT;
}

function releaseField() {
  visitorHasTakenOver = true;
  activeStation = null;
  render(buildFrame(0, []), 'field-released');
}

function saveSvg() {
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-brush-v023.svg';
  link.click();
  URL.revokeObjectURL(link.href);
}

field.addEventListener('pointermove', (event) => {
  if (event.target.closest('button')) return;
  const nextStation = stationAt(event.clientX, event.clientY);
  if (nextStation !== activeStation) {
    activeStation = nextStation;
    render(currentFrame, 'witness-armed');
  }
});

field.addEventListener('pointerleave', () => {
  if (activeStation !== null) commitStation(activeStation, 'visitor-departure');
});

field.addEventListener('click', (event) => {
  if (event.target.closest('button')) return;
  render(currentFrame, 'witness-refused');
});

field.addEventListener('keydown', (event) => {
  if (event.target.closest('button')) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitStation(activeStation ?? defaultStation(), 'keyboard-witness');
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    activeStation = null;
    visitorHasTakenOver = true;
    render(liftLatestWitness(currentFrame), 'witness-lifted');
  } else if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    releaseField();
  } else if (event.key === 's' || event.key === 'S') {
    event.preventDefault();
    saveSvg();
  }
});

watchControl.addEventListener('click', () => commitStation(activeStation ?? defaultStation(), 'watch-control'));
liftControl.addEventListener('click', () => {
  activeStation = null;
  visitorHasTakenOver = true;
  render(liftLatestWitness(currentFrame), 'witness-lifted');
});
releaseControl.addEventListener('click', releaseField);

function animate(now) {
  if (!frozen && !visitorHasTakenOver) {
    const nextStage = Math.min(STAGES - 1, Math.floor((now - startedAt) / 3100));
    if (nextStage !== lastStage) {
      lastStage = nextStage;
      render(timeline[nextStage], 'sequence');
    }
  }
  requestAnimationFrame(animate);
}

render(currentFrame, frozen ? 'sequence' : 'sequence');
window.__mutineBrushV023 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    stationCount: currentFrame.stations.length,
    signature: geometrySignature(currentFrame),
    interaction: interactionStateName,
    armed: activeStation
  })
};
window._p5Ready = true;
window._mutineReady = true;
requestAnimationFrame(animate);
