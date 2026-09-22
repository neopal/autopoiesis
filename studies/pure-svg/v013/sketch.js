import {
  PRIMITIVE_BUDGET,
  STAGES,
  applyGaze,
  buildTimeline,
  deleteGaze
} from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const gazeControl = document.querySelector('#gaze-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3200;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || location.hash === '#static';
const frozen = reducedMotion || staticMode;
const blind = params.get('blind') === '1';

if (staticMode || blind) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#161323',
  groundDeep: '#090812',
  groundSoft: '#3c3150',
  bone: '#f1eadb',
  mint: '#a5d6c0',
  amber: '#e6b36a',
  coral: '#db7f70',
  lilac: '#a9a2d4',
  ink: '#08070f',
  smoke: '#7b778d'
};

let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let lastRenderedStage = -1;
let lastPaint = 0;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const px = (value) => (value * 1000).toFixed(2);
const py = (value) => (value * 760).toFixed(2);
const pointAt = (point) => `${px(point.x)} ${py(point.y)}`;
const degrees = (radians) => (radians * 180 / Math.PI).toFixed(2);

function nodePath(node) {
  const size = node.size * 1000;
  const width = size * (node.role === 'looking' ? 0.95 : 0.72);
  const height = size * (node.role === 'answering' ? 0.68 : 0.82);
  if (node.role === 'looking') {
    return `M 0 ${(-height).toFixed(2)} L ${width.toFixed(2)} 0 L 0 ${height.toFixed(2)} L ${(-width * 0.34).toFixed(2)} 0 Z`;
  }
  if (node.role === 'answering') {
    return `M ${(-width).toFixed(2)} 0 L 0 ${(-height).toFixed(2)} L ${width.toFixed(2)} 0 L 0 ${height.toFixed(2)} Z`;
  }
  return `M 0 ${(-height).toFixed(2)} L ${width.toFixed(2)} 0 L 0 ${height.toFixed(2)} L ${(-width).toFixed(2)} 0 Z`;
}

function nodeInnerPath(node) {
  const size = node.size * 1000;
  if (node.role === 'looking') {
    return `M ${(-size * 0.42).toFixed(2)} 0 L ${(size * 0.38).toFixed(2)} 0`;
  }
  if (node.role === 'answering') {
    return `M 0 ${(-size * 0.34).toFixed(2)} L 0 ${(size * 0.34).toFixed(2)}`;
  }
  return `M ${(-size * 0.24).toFixed(2)} 0 L ${(size * 0.24).toFixed(2)} 0`;
}

function renderNode(node) {
  if (!node.visible) return '';
  const fill = node.role === 'looking' ? palette.mint : node.role === 'answering' ? palette.amber : palette.bone;
  const stroke = node.role === 'looking' ? palette.mint : node.role === 'answering' ? palette.coral : palette.lilac;
  return `<g class="node node--${node.role}" data-node="${node.id}" data-role="${node.role}" transform="translate(${px(node.x)} ${py(node.y)}) rotate(${degrees(node.angle)})">
    <path class="node-shell" d="${nodePath(node)}" fill="${fill}" stroke="${stroke}"/>
    <path class="node-inner" d="${nodeInnerPath(node)}"/>
  </g>`;
}

function renderWitness(gaze, index, active = false) {
  if (blind || !gaze) return '';
  const opacity = active ? 0.88 : 0.12 + index * 0.055;
  const radius = active ? 30 : 12 + index * 3;
  return `<g class="node-witness${active ? ' node-witness--active' : ''}" opacity="${opacity}">
    <circle cx="${px(gaze.point.x)}" cy="${py(gaze.point.y)}" r="${radius}"/>
    <path d="M ${pointAt(gaze.point)} L ${pointAt({ x: gaze.point.x + gaze.vector.x * .10, y: gaze.point.y + gaze.vector.y * .10 })}"/>
  </g>`;
}

function renderMemory(memory) {
  return blind ? '' : memory.map((gaze, index) => renderWitness(gaze, index)).join('');
}

function render(frame, progress = 1, state = 'sequence') {
  const modeLabel = state === 'visitor-gaze'
    ? 'VISITOR GAZE / QUORUM FORMED'
    : state === 'ungazed'
      ? 'LATEST GAZE LIFTED / FIELD RESTORED'
      : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const nodes = frame.nodes.map(renderNode).join('');
  const activeWitness = blind ? '' : renderWitness(frame.gaze, frame.memory.length, true);
  const looking = frame.looking;
  const answering = frame.answering;
  const progressOpacity = Math.max(0.18, progress);

  field.innerHTML = `<defs>
    <radialGradient id="ground-glow" cx="50%" cy="46%" r="74%"><stop offset="0" stop-color="${palette.groundSoft}"/><stop offset=".62" stop-color="${palette.ground}"/><stop offset="1" stop-color="${palette.groundDeep}"/></radialGradient>
    <linearGradient id="ring-glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.mint}"/><stop offset=".56" stop-color="${palette.lilac}"/><stop offset="1" stop-color="${palette.coral}"/></linearGradient>
    <filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="18"/></filter>
    <filter id="node-glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>
    <pattern id="micro-grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 42 0 L 0 0 0 42" fill="none" stroke="${palette.lilac}" stroke-opacity=".11" stroke-width="1"/></pattern>
  </defs>
  <rect class="paper" x="0" y="0" width="1000" height="760"/>
  <rect class="micro-grid" x="28" y="26" width="944" height="676"/>
  <ellipse class="field-shadow" cx="500" cy="395" rx="350" ry="190"/>
  <ellipse class="orbit orbit--outer" cx="500" cy="365" rx="350" ry="245"/>
  <ellipse class="orbit orbit--inner" cx="500" cy="365" rx="225" ry="150"/>
  <circle class="hollow" cx="500" cy="365" r="66"/>
  <path class="crosshair" d="M 500 274 L 500 456 M 409 365 L 591 365"/>
  ${renderMemory(frame.memory)}
  ${activeWitness}
  <g class="nodes" opacity="${progressOpacity}">${nodes}</g>
  <g class="artwork-label" aria-hidden="true"><text x="48" y="682">${modeLabel}</text><text x="952" y="682" text-anchor="end">${PRIMITIVE_BUDGET} CELLS / ${frame.vacancies} ABSENT</text></g>
  <g class="count-label" aria-hidden="true"><text x="500" y="372" text-anchor="middle">${frame.memory.length ? `${looking} / ${answering}` : '—'}</text></g>`;

  stageReadout.textContent = state === 'visitor-gaze'
    ? 'visitor gaze / paused'
    : state === 'ungazed'
      ? 'latest gaze lifted / paused'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} remembered gazes · ${frame.vacancies} vacancies`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.looking = String(looking);
  field.dataset.answering = String(answering);
  field.dataset.vacancies = String(frame.vacancies);
  field.dataset.vacancy = String(frame.vacancies);
  field.dataset.gazeState = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return { frame: timeline[currentStage], progress: (elapsed % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = frameAt(now);
  if (current.frame.stage !== lastRenderedStage || now - lastPaint > 34) {
    lastRenderedStage = current.frame.stage;
    lastPaint = now;
    render(current.frame, current.progress, 'sequence');
  }
}

function pointerPoint(event) {
  const bounds = field.getBoundingClientRect();
  const scale = Math.min(bounds.width / 1000, bounds.height / 760);
  const drawnWidth = 1000 * scale;
  const drawnHeight = 760 * scale;
  const offsetX = (bounds.width - drawnWidth) / 2;
  const offsetY = (bounds.height - drawnHeight) / 2;
  return {
    x: clamp((event.clientX - bounds.left - offsetX) / drawnWidth, .06, .94),
    y: clamp((event.clientY - bounds.top - offsetY) / drawnHeight, .16, .84)
  };
}

function makeGaze(point) {
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyGaze(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-gaze');
  updateButtons();
}

function liftLatest() {
  const base = interactionFrame ?? timeline[currentStage];
  if (!base.memory.length) return;
  interactionFrame = { ...deleteGaze(base), interaction: 'ungazed' };
  paused = true;
  render(interactionFrame, 1, 'ungazed');
  updateButtons();
}

function releaseField() {
  interactionFrame = null;
  paused = frozen;
  started = performance.now();
  currentStage = 0;
  lastRenderedStage = -1;
  renderCurrent();
  updateButtons();
}

function updateButtons() {
  liftControl.disabled = staticMode || !(interactionFrame?.memory.length);
  releaseControl.disabled = staticMode;
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-pure-svg-v013-gaze.svg';
  link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(field.outerHTML)}`;
  link.click();
}

field.addEventListener('pointerdown', (event) => {
  if (staticMode || blind) return;
  event.preventDefault();
  makeGaze(pointerPoint(event));
});

field.addEventListener('keydown', (event) => {
  if (staticMode || blind) return;
  if (['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    makeGaze({ x: .74, y: .28 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') releaseField();
  if (event.key.toLowerCase() === 's') saveStill();
});

gazeControl.addEventListener('click', () => { if (!staticMode) makeGaze({ x: .74, y: .28 }); });
liftControl.addEventListener('click', liftLatest);
releaseControl.addEventListener('click', releaseField);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

window.__mutinePureSvgV013 = {
  getState: () => ({
    stage: currentStage,
    memory: (interactionFrame ?? timeline[currentStage]).memory.length,
    paused,
    looking: (interactionFrame ?? timeline[currentStage]).looking,
    answering: (interactionFrame ?? timeline[currentStage]).answering,
    vacancies: (interactionFrame ?? timeline[currentStage]).vacancies,
    gazeState: field.dataset.gazeState
  }),
  getFrameSignature: () => JSON.stringify({
    nodes: (interactionFrame ?? timeline[currentStage]).nodes,
    memory: (interactionFrame ?? timeline[currentStage]).memory
  }),
  getSVGMarkup: () => field.outerHTML
};

updateButtons();
renderCurrent();
if (!frozen) requestAnimationFrame(frame);
