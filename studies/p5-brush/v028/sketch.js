import {
  STAGES,
  applyMend,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestMend,
  releaseMends
} from './engine.mjs';

const FIELD_ID = 'mending-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = ['#d87863', '#dbad68', '#9caf83', '#7898b2', '#b88279', '#d2c08b', '#8ca89a', '#c47b64', '#9b8bab'];

let frame;
let interaction = 'baseline';
let drawing = false;
let pointerId = null;
let draftPath = [];

const fieldNode = () => document.getElementById(FIELD_ID);
const svgNode = () => document.getElementById('reservoir-svg');

function normalizedPoint(event) {
  const rect = svgNode().getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height)
  };
}

function nextMend() {
  const gestures = [
    { points: [{ x: 0.16, y: 0.76 }, { x: 0.36, y: 0.57 }, { x: 0.64, y: 0.34 }], pressure: 0.68 },
    { points: [{ x: 0.82, y: 0.75 }, { x: 0.62, y: 0.57 }, { x: 0.38, y: 0.46 }], pressure: 0.52 },
    { points: [{ x: 0.18, y: 0.22 }, { x: 0.43, y: 0.34 }, { x: 0.71, y: 0.23 }], pressure: 0.76 },
    { points: [{ x: 0.76, y: 0.3 }, { x: 0.56, y: 0.44 }, { x: 0.28, y: 0.23 }], pressure: 0.61 }
  ];
  return gestures[frame.memory.length % gestures.length];
}

function pathMarkup(path, index, wound) {
  const opacity = 0.48 + (index % 3) * 0.08;
  const stroke = palette[(index + 2) % palette.length];
  return `<path data-wound="${index}" d="${path}" fill="${palette[index % palette.length]}" fill-opacity="${opacity}" stroke="${stroke}" stroke-opacity="0.76" stroke-width="2.2" fill-rule="evenodd" stroke-linejoin="round"><title>wound ${index + 1}; seal ${wound.seal.toFixed(2)}; opening ${wound.open.toFixed(2)}</title></path>`;
}

function renderDraft() {
  if (!drawing || draftPath.length < 2) return '';
  const points = draftPath.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 1000} ${point.y * 620}`).join(' ');
  return `<path d="${points}" fill="none" stroke="#eee5d4" stroke-opacity="0.78" stroke-width="3" stroke-linecap="round" stroke-dasharray="6 10"/>`;
}

function renderFrame() {
  const field = fieldNode();
  const svg = svgNode();
  const signature = geometrySignature(frame);
  frame.signature = signature;
  svg.innerHTML = `<defs>
    <radialGradient id="reservoir-glow" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#879b86" stop-opacity="0.23"/><stop offset="1" stop-color="#0d0f11" stop-opacity="0"/></radialGradient>
    <filter id="soft-edge" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="1000" height="620" fill="url(#reservoir-glow)"/>
  <path d="${frame.reservoirPath}" fill="#29302b" fill-opacity="0.24" filter="url(#soft-edge)"/>
  ${frame.paths.map((path, index) => pathMarkup(path, index, frame.wounds[index])).join('')}
  ${renderDraft()}`;
  field.dataset.signature = signature;
  field.dataset.memory = String(frame.memory.length);
  field.dataset.woundCount = String(frame.wounds.length);
  field.dataset.sealed = String(frame.sealedCount);
  field.dataset.opened = String(frame.openedCount);
  field.dataset.stage = String(frame.stage);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} mend${frame.memory.length === 1 ? '' : 's'} held`;
  const messages = {
    baseline: 'The reservoir is holding its edges.',
    'mend-committed': 'One edge sealed; another wound opened elsewhere.',
    'mend-refused': 'The material refuses that repeated mend.',
    'mend-refused-short': 'The offered route is too short to carry an edge.',
    'mend-lifted': 'The latest mend lifted; the preceding wounds return.',
    'mends-released': 'The reservoir released its remembered topology.'
  };
  if (stateNode) stateNode.textContent = messages[interaction] || messages.baseline;
}

function setInteraction(nextFrame, label = nextFrame.interaction || 'baseline') {
  frame = nextFrame;
  interaction = label;
  renderFrame();
}

function commitMend(mend, source = 'keyboard-mend') {
  setInteraction(applyMend(frame, mend, source));
}

function lift() {
  setInteraction(liftLatestMend(frame));
}

function release() {
  setInteraction(releaseMends(frame));
}

function exportSvg() {
  const source = new XMLSerializer().serializeToString(svgNode());
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mutine-brush-v028-mending-reservoir.svg';
  anchor.click();
  URL.revokeObjectURL(url);
}

function addDraftPoint(event) {
  const point = normalizedPoint(event);
  const previous = draftPath.at(-1);
  if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.008) {
    draftPath.push(point);
    renderFrame();
  }
}

function finishPointer(event) {
  const eventId = event.pointerId ?? 'mouse';
  if (!drawing || (pointerId !== null && eventId !== pointerId)) return;
  addDraftPoint(event);
  drawing = false;
  pointerId = null;
  const gesture = { points: draftPath, pressure: clamp(0.42 + Math.min(0.46, draftPath.length * 0.06)) };
  draftPath = [];
  if (gesture.points.length > 1 && gesture.points.reduce((sum, point, index) => sum + (index ? Math.hypot(point.x - gesture.points[index - 1].x, point.y - gesture.points[index - 1].y) : 0), 0) > 0.035) {
    commitMend(gesture, 'pointer-mend');
  } else {
    setInteraction({ ...frame, interaction: 'mend-refused-short' }, 'mend-refused-short');
  }
}

function bindPointer() {
  const svg = svgNode();
  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    drawing = true;
    pointerId = event.pointerId ?? 1;
    draftPath = [];
    svg.setPointerCapture?.(pointerId);
    addDraftPoint(event);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!drawing || (pointerId !== null && event.pointerId !== pointerId)) return;
    event.preventDefault();
    addDraftPoint(event);
  });
  svg.addEventListener('pointerup', finishPointer);
  svg.addEventListener('pointercancel', () => { drawing = false; pointerId = null; draftPath = []; renderFrame(); });
}

function bindControls() {
  const field = fieldNode();
  field.querySelector('[data-gesture="mend"]').addEventListener('click', () => commitMend(nextMend(), 'button-mend'));
  field.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
  field.querySelector('[data-gesture="release"]').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitMend(nextMend()); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
    else if (event.key.toLowerCase() === 's') { event.preventDefault(); exportSvg(); }
  });
}

const settled = buildTimeline(STAGES).at(-1);
frame = reducedMotion || staticMode ? settled : buildFrame(0, []);
setInteraction(frame, 'baseline');
bindPointer();
bindControls();

window.__mutineBrushV028 = {
  getState: () => ({
    stage: frame.stage,
    memory: frame.memory.length,
    mends: frame.memory.map((event) => ({ ...event })),
    signature: geometrySignature(frame),
    interaction,
    grammar: frame.grammar,
    woundCount: frame.wounds.length,
    pathCount: frame.paths.length,
    sealedCount: frame.sealedCount,
    openedCount: frame.openedCount,
    lastMend: frame.lastMend
  }),
  getFrame: () => frame
};
window.__mutineBrushV028Ready = true;
