import {
  PATCH_COUNT,
  buildFrame,
  buildTimeline,
  armPatch,
  changedPatchIds,
  commitGesture,
  geometrySignature,
  liftLatestGesture,
  releaseMemory
} from './engine.mjs';

const canvas = document.querySelector('#junction-canvas');
const field = document.querySelector('#junction-field');
const ctx = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const statusReadout = document.querySelector('[data-status]');
const controls = [...document.querySelectorAll('[data-gesture]')];
const staticMode = document.documentElement.classList.contains('static-mode');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const PALETTE = {
  paper: '#efe5ce',
  paperShadow: '#d3c19e',
  ink: '#213333',
  ochre: '#c49a50',
  clay: '#c8694d',
  lichen: '#7e9c7e',
  rust: '#a54f43',
  plum: '#655a7b',
  chalk: '#f8f1dd'
};

let state = buildFrame();
let gesture = null;

function settledFrame() {
  let next = buildFrame();
  for (const item of buildTimeline().gestures) next = commitGesture(next, item);
  return next;
}

if (staticMode) state = settledFrame();

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function tone(toneName) { return PALETTE[toneName] ?? PALETTE.ink; }
function normalizedPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
  };
}
function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function nearestPatch(point) {
  let best = 0;
  let bestDistance = Infinity;
  state.scene.patches.forEach((patch) => {
    const d = distance(point, { x: patch.x, y: patch.y });
    if (d < bestDistance) { bestDistance = d; best = patch.id; }
  });
  return best;
}
function seamSide(x) {
  if (x < 0.43) return -1;
  if (x > 0.57) return 1;
  return null;
}

function beginGesture(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  const point = normalizedPoint(event);
  const first = nearestPatch(point);
  gesture = {
    first,
    second: first,
    points: [point],
    crossings: 0,
    travel: 0,
    directionChanges: 0,
    started: performance.now(),
    lastPoint: point,
    lastSide: seamSide(point.x)
  };
  state = armPatch(state, first);
  field.dataset.interaction = state.interaction;
  render();
  canvas.setPointerCapture?.(event.pointerId);
}

function moveGesture(event) {
  if (!gesture) return;
  event.preventDefault();
  const point = normalizedPoint(event);
  gesture.travel += distance(point, gesture.lastPoint);
  gesture.lastPoint = point;
  gesture.points.push(point);
  gesture.second = nearestPatch(point);
  const side = seamSide(point.x);
  if (side !== null && gesture.lastSide !== null && side !== gesture.lastSide) {
    gesture.crossings += 1;
    gesture.directionChanges += 1;
  }
  if (side !== null) gesture.lastSide = side;
  field.dataset.interaction = 'gesture-drawing';
  render();
}

function endGesture(event) {
  if (!gesture) return;
  event.preventDefault();
  const finished = {
    first: gesture.first,
    second: gesture.second,
    crossings: gesture.crossings,
    travel: gesture.travel,
    directionChanges: gesture.directionChanges,
    duration: performance.now() - gesture.started,
    points: gesture.points
  };
  gesture = null;
  state = commitGesture(state, finished);
  render();
}

function deterministicCommit() {
  const item = buildTimeline().gestures[state.memory.length % buildTimeline().gestures.length];
  state = commitGesture(state, item);
  render();
}
function lift() {
  state = liftLatestGesture(state);
  render();
}
function release() {
  state = releaseMemory(state);
  render();
}

function drawPolygon(points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawPaperGrain() {
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let index = 0; index < 420; index += 1) {
    const x = (index * 83 + 19) % canvas.width;
    const y = (index * 47 + 31) % canvas.height;
    const size = 0.45 + ((index * 13) % 7) * 0.12;
    ctx.fillStyle = index % 3 === 0 ? PALETTE.ink : PALETTE.paperShadow;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawPatch(patch) {
  const x = patch.x * canvas.width;
  const y = patch.y * canvas.height;
  const width = patch.width * canvas.width * patch.scale;
  const height = patch.height * canvas.height * patch.scale;
  const notch = patch.notch;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(patch.tilt);
  ctx.transform(1, 0, patch.shear, 1, 0, 0);
  ctx.shadowColor = 'rgba(22, 36, 36, 0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 8;
  const points = [
    [-width * 0.56, -height * (0.42 + notch * 0.24)],
    [-width * 0.09, -height * 0.56],
    [width * (0.46 - notch * 0.35), -height * 0.39],
    [width * 0.58, -height * 0.04],
    [width * (0.40 + notch * 0.18), height * 0.49],
    [-width * 0.06, height * 0.56],
    [-width * 0.57, height * (0.27 - notch * 0.3)]
  ];
  drawPolygon(points, tone(patch.tone));
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = patch.role === 'quiet' ? 'rgba(33,51,51,0.36)' : PALETTE.accent;
  ctx.lineWidth = patch.role === 'quiet' ? 2 : 4;
  ctx.stroke();

  ctx.globalAlpha = patch.role === 'quiet' ? 0.35 : 0.6;
  ctx.strokeStyle = PALETTE.chalk;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-width * 0.26, -height * 0.12);
  ctx.lineTo(width * 0.26, -height * 0.18 + patch.notch * height);
  ctx.moveTo(-width * 0.16, height * 0.18);
  ctx.lineTo(width * 0.14, height * 0.12);
  ctx.stroke();

  if (patch.role !== 'quiet') {
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = patch.role === 'relay' ? PALETTE.chalk : PALETTE.ink;
    ctx.beginPath();
    ctx.arc(width * 0.22, -height * 0.18, Math.max(3, width * 0.035), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.38;
    ctx.fillRect(-width * 0.28, height * 0.27, width * 0.42, Math.max(2, height * 0.035));
  }
  ctx.restore();
}

function drawPicture() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, PALETTE.paper);
  gradient.addColorStop(0.52, '#e7d8b9');
  gradient.addColorStop(1, '#d2c29f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPaperGrain();

  ctx.save();
  ctx.globalAlpha = 0.22;
  drawPolygon([
    [canvas.width * 0.08, canvas.height * 0.52],
    [canvas.width * 0.26, canvas.height * 0.15],
    [canvas.width * 0.65, canvas.height * 0.10],
    [canvas.width * 0.91, canvas.height * 0.42],
    [canvas.width * 0.78, canvas.height * 0.88],
    [canvas.width * 0.25, canvas.height * 0.92]
  ], PALETTE.chalk, PALETTE.ink, 2);
  ctx.restore();

  const sorted = [...state.scene.patches].sort((a, b) => a.y - b.y || a.id - b.id);
  sorted.forEach(drawPatch);

  ctx.save();
  ctx.strokeStyle = 'rgba(33,51,51,0.38)';
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 14]);
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.5, canvas.height * 0.09);
  ctx.lineTo(canvas.width * 0.49, canvas.height * 0.91);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(33,51,51,0.6)';
  ctx.lineWidth = 5;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.strokeStyle = 'rgba(248,241,221,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);
  ctx.restore();
}

function render() {
  drawPicture();
  stageReadout.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryReadout.textContent = `${state.memory.length} retained`;
  statusReadout.textContent = state.interaction === 'gesture-refused-shallow'
    ? 'shallow join refused'
    : state.interaction === 'gesture-committed'
      ? 'the picture joined the wrong parts'
      : state.interaction === 'gesture-lifted'
        ? 'latest false join lifted'
        : state.interaction === 'memory-released'
          ? 'memory released'
          : state.interaction === 'gesture-armed'
            ? 'armed — cross the seam and keep moving'
            : state.interaction === 'gesture-drawing'
              ? 'hesitating across the seam'
              : 'cross the seam, hesitate, and release';
  field.dataset.interaction = state.interaction;
  field.dataset.changedPatches = String(changedPatchIds(state).length);
  field.dataset.geometrySignature = geometrySignature(state);
}

canvas.addEventListener('pointerdown', beginGesture);
canvas.addEventListener('pointermove', moveGesture);
canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', endGesture);
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicCommit();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});
controls.forEach((control) => control.addEventListener('click', () => {
  if (control.dataset.gesture === 'misjoin') deterministicCommit();
  if (control.dataset.gesture === 'lift') lift();
  if (control.dataset.gesture === 'release') release();
}));

window.__mutineNaiveV029 = {
  getState: () => ({ ...state, geometrySignature: geometrySignature(state) }),
  commit: deterministicCommit,
  lift,
  release,
  arm: (index) => { state = armPatch(state, index); render(); },
  buildTimeline
};

render();
