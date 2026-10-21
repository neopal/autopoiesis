import {
  STAGES,
  STATION_COUNT,
  buildFrame,
  visitStation,
  commitQuorum,
  liftLatest,
  releaseField,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;

const stage = document.querySelector('[data-delegation-stage]');
const mount = document.querySelector('#delegation-svg');
const stationButtons = [...document.querySelectorAll('[data-station]')];
const actionButtons = [...document.querySelectorAll('[data-action]')];
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const WIDTH = 1200;
const HEIGHT = 760;
const timeline = buildTimeline();
const STAGE_MS = 4200;
let currentFrame = timeline[0];
let interactionFrame = null;
let startedAt = performance.now();
let lastSignature = '';
let pointerDown = null;
let suppressClick = false;

function buildTimeline() {
  let frame = buildFrame(0);
  const frames = [frame];
  for (const indices of [[0, 2, 4], [1, 2, 3], [0, 1, 3], [1, 3, 4]]) {
    for (const index of indices) frame = visitStation(frame, index);
    frame = commitQuorum(frame);
    frames.push(frame);
  }
  return frames;
}

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function pointFor(index, frame) {
  const base = [
    [270, 160], [515, 92], [828, 125], [1020, 315],
    [893, 588], [589, 680], [260, 570], [145, 330]
  ][index];
  const stationIndex = [4, 0, 0, 1, 2, 2, 3, 4][index];
  const station = frame.stations[stationIndex];
  const drift = station.edge * 62;
  const curl = station.cut * 18;
  return {
    x: base[0] + station.radialX * drift - station.radialY * curl,
    y: base[1] + station.radialY * drift + station.radialX * curl
  };
}

function midpoint(a, b) {
  return { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
}

function smoothClosedPath(points) {
  const start = midpoint(points.at(-1), points[0]);
  let path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} `;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const middle = midpoint(point, next);
    path += `Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${middle.x.toFixed(2)} ${middle.y.toFixed(2)} `;
  });
  return `${path}Z`;
}

function rotatedEllipse(cx, cy, rx, ry, angle, segments = 12) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const theta = (Math.PI * 2 * index) / segments;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    points.push({
      x: cx + (cos * rx * Math.cos(angle) - sin * ry * Math.sin(angle)),
      y: cy + (cos * rx * Math.sin(angle) + sin * ry * Math.cos(angle))
    });
  }
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')} Z`;
}

function compoundGeometry(frame) {
  const outer = smoothClosedPath(Array.from({ length: 8 }, (_, index) => pointFor(index, frame)));
  const donor = frame.stations.find((station) => station.state === 'donor') ?? frame.stations[0];
  const receiver = frame.stations.find((station) => station.state === 'receiver') ?? frame.stations[1];
  const cut = frame.stations.find((station) => station.state === 'cut') ?? frame.stations[2];
  const mainHole = rotatedEllipse(
    568 + receiver.edge * 68,
    342 + donor.edge * 26,
    118 + Math.max(0, cut.cut) * 36,
    204 + Math.max(0, receiver.edge) * 30,
    -0.42 + donor.tilt
  );
  const smallHole = rotatedEllipse(
    760 + cut.edge * 46,
    505 + receiver.edge * 22,
    42 + cut.cut * 22,
    78 + donor.edge * 16,
    0.62 + cut.tilt,
    10
  );
  return { outer, mainHole, smallHole };
}

function svgMarkup(frame, now) {
  const { outer, mainHole, smallHole } = compoundGeometry(frame);
  const seconds = now * 0.001;
  const breathing = frozen ? 0 : Math.sin(seconds * 0.34) * 1.5;
  const activeRoles = frame.stations.filter((station) => station.state !== 'quiet');
  const rolePaths = activeRoles.map((station) => {
    const p = pointFor([4, 0, 0, 1, 2, 2, 3, 4].findIndex((value) => value === station.index), frame);
    return `<path class="role-mark role-${station.state}" d="M ${p.x.toFixed(1)} ${p.y.toFixed(1)} l ${(station.radialX * 42).toFixed(1)} ${(station.radialY * 42).toFixed(1)}"/>`;
  }).join('');

  return `<svg id="delegation-art" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="A single compound shell with a cut interior and a displaced edge" preserveAspectRatio="xMidYMid meet">
    <defs>
      <radialGradient id="v029-atmosphere" cx="22%" cy="14%" r="92%">
        <stop offset="0" stop-color="#363344"/>
        <stop offset=".42" stop-color="#171722"/>
        <stop offset="1" stop-color="#08090f"/>
      </radialGradient>
      <linearGradient id="v029-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e9ddbf"/>
        <stop offset=".38" stop-color="#c7b38e"/>
        <stop offset=".7" stop-color="#7d6a6d"/>
        <stop offset="1" stop-color="#394451"/>
      </linearGradient>
      <linearGradient id="v029-edge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f0c58c"/>
        <stop offset=".52" stop-color="#9bd1c6"/>
        <stop offset="1" stop-color="#d77e74"/>
      </linearGradient>
      <filter id="v029-shadow" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="18"/>
      </filter>
      <pattern id="v029-hatch" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">
        <path d="M -4 20 L 20 -4 M 8 32 L 32 8" stroke="#171722" stroke-opacity=".12" stroke-width="2"/>
      </pattern>
      <clipPath id="v029-body-clip"><path d="${outer} ${mainHole} ${smallHole}" fill-rule="evenodd"/></clipPath>
    </defs>
    <rect width="1200" height="760" fill="url(#v029-atmosphere)"/>
    <path class="ghost-shell" d="${outer}" transform="translate(10 18)"/>
    <path class="shell-shadow" d="${outer}" transform="translate(0 22)"/>
    <path class="compound-body" d="${outer} ${mainHole} ${smallHole}" fill="url(#v029-body)" fill-rule="evenodd" transform="translate(0 ${breathing.toFixed(2)})"/>
    <path class="compound-hatch" d="${outer}" fill="url(#v029-hatch)" clip-path="url(#v029-body-clip)"/>
    <path class="inner-rim" d="${mainHole} ${smallHole}" fill="none" stroke="#161722" stroke-opacity=".7" stroke-width="4"/>
    <path class="body-edge" d="${outer}"/>
    <path class="body-edge-highlight" d="${outer}" transform="translate(-2 -3)"/>
    ${rolePaths}
    <path class="quiet-axis" d="M 214 330 Q 527 226 937 366"/>
    <path class="quiet-axis quiet-axis--second" d="M 337 563 Q 555 500 851 220"/>
    <g class="micro-constellation" aria-hidden="true">${Array.from({ length: 30 }, (_, index) => {
      const x = 90 + ((index * 137) % 1010);
      const y = 70 + ((index * 83) % 600);
      return `<circle cx="${x}" cy="${y}" r="${index % 5 === 0 ? 2.2 : 1}"/>`;
    }).join('')}</g>
  </svg>`;
}

function stationPoint(index) {
  const layout = [
    [33, 18], [70, 23], [83, 56], [50, 82], [17, 53]
  ][index];
  return layout;
}

function render(frame = activeFrameAt()) {
  const now = performance.now();
  const signature = geometrySignature(frame);
  if (signature !== lastSignature) {
    mount.innerHTML = svgMarkup(frame, now);
    lastSignature = signature;
  }
  stationButtons.forEach((button, index) => {
    const [x, y] = stationPoint(index);
    button.style.setProperty('--x', `${x}%`);
    button.style.setProperty('--y', `${y}%`);
    button.classList.toggle('is-pending', frame.pendingStations.includes(index));
    button.classList.toggle('is-donor', frame.stations[index].state === 'donor');
    button.classList.toggle('is-receiver', frame.stations[index].state === 'receiver');
    button.classList.toggle('is-cut', frame.stations[index].state === 'cut');
  });
  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} delegations held`;
  if (frame.interaction === 'quorum-armed') hint.textContent = 'three stations have noticed you; release the edge';
  else if (frame.interaction === 'needs-quorum') hint.textContent = 'the shell needs three distinct stations';
  else if (frame.interaction === 'committed') hint.textContent = 'the edge was given away; the shell remembers';
  else hint.textContent = 'visit three boundary stations; the shell will answer elsewhere';
}

function updateState(message) {
  if (stateReadout) stateReadout.textContent = message;
}

function setInteraction(next, message) {
  interactionFrame = next;
  currentFrame = next;
  render(next);
  updateState(message);
}

function visit(index) {
  const next = visitStation(interactionFrame ?? currentFrame, index);
  const count = next.pendingStations.length;
  setInteraction(next, count >= 3 ? 'Three boundary stations are holding a quorum.' : `${count} boundary station${count === 1 ? '' : 's'} noticed.`);
}

function commit() {
  const source = interactionFrame ?? currentFrame;
  const prepared = source.pendingStations.length >= 3
    ? source
    : [0, 2, 4].reduce((frame, index) => visitStation(frame, index), source);
  const next = commitQuorum(prepared);
  if (next.interaction === 'needs-quorum') {
    setInteraction(next, 'The shell refuses a partial quorum. Visit three distinct stations.');
    return;
  }
  setInteraction(next, `Delegation committed: edge ${next.memory.at(-1).donorIndex + 1} gave to ${next.memory.at(-1).receiverIndex + 1}.`);
}

function lift() {
  const next = liftLatest(interactionFrame ?? currentFrame);
  setInteraction(next, next.interaction === 'lifted' ? 'Latest delegation lifted; the prior shell is exact.' : 'Nothing to lift yet.');
}

function release() {
  setInteraction(releaseField(0), 'Attention released. The shell is quiet again.');
}

stationButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    pointerDown = { index: Number(button.dataset.station), time: performance.now(), pointerId: event.pointerId };
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointerup', (event) => {
    if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;
    const { index } = pointerDown;
    pointerDown = null;
    suppressClick = true;
    visit(index);
  });
  button.addEventListener('pointercancel', () => { pointerDown = null; });
  button.addEventListener('click', () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    visit(Number(button.dataset.station));
  });
});

actionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'commit') commit();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  });
});

stage.addEventListener('pointerdown', () => { stage.focus({ preventScroll: true }); });
stage.addEventListener('pointerup', () => { updateState('The shell is listening; choose three boundary stations.'); });
stage.addEventListener('keydown', (event) => {
  if (/^[1-5]$/.test(event.key)) {
    event.preventDefault();
    visit(Number(event.key) - 1);
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
});

function tick(now) {
  if (!interactionFrame) {
    const next = activeFrameAt(now);
    if (next !== currentFrame) {
      currentFrame = next;
      lastSignature = '';
    }
    render(next);
  } else {
    render(interactionFrame);
  }
  if (!frozen) requestAnimationFrame(tick);
}

render(activeFrameAt());
if (!frozen) requestAnimationFrame(tick);

window.__mutinePortraitV029 = {
  getState: () => ({ frame: currentFrame, geometry: geometrySignature(currentFrame) }),
  visitStation: visit,
  commit,
  lift,
  release,
  buildFrame,
  geometrySignature
};
