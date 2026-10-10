import {
  STAGES,
  MIN_DWELL_MS,
  applyDwell,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestDwell,
  releaseDwells
} from './engine.mjs';

const FIELD_ID = 'sediment-field';
const CANVAS_ID = 'sediment-canvas';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = ['#d87863', '#d3af68', '#97b394', '#7f9daf', '#c4925c', '#b98078', '#829b84', '#d0bf88', '#8e9ab0', '#b76d5d', '#9ea889'];
const rgbCache = new Map();

let canvas;
let context;
let frame;
let interaction = 'baseline';
let holding = false;
let pointerId = null;
let dwellStartedAt = 0;
let dwellPoint = { x: 0.5, y: 0.5 };
let lastPoint = { x: 0.5, y: 0.5 };

function fieldNode() {
  return document.getElementById(FIELD_ID);
}

function canvasNode() {
  return document.getElementById(CANVAS_ID);
}

function rgb(hex) {
  if (!rgbCache.has(hex)) {
    const value = hex.slice(1);
    rgbCache.set(hex, [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]);
  }
  return rgbCache.get(hex);
}

function color(hex, alpha = 1) {
  const [red, green, blue] = rgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizedPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0.03, 0.97),
    y: clamp((event.clientY - rect.top) / rect.height, 0.04, 0.96)
  };
}

function nextDwell() {
  const dwells = [
    { point: { x: 0.22, y: 0.72 }, duration: 880 },
    { point: { x: 0.78, y: 0.38 }, duration: 1240 },
    { point: { x: 0.26, y: 0.27 }, duration: 760 },
    { point: { x: 0.72, y: 0.68 }, duration: 1600 }
  ];
  return dwells[frame.memory.length % dwells.length];
}

function setInteraction(nextFrame, label = nextFrame.interaction || 'baseline') {
  frame = nextFrame;
  interaction = label;
  render();
}

function commitDwell(dwell, source = 'keyboard-dwell') {
  setInteraction(applyDwell(frame, dwell, source));
}

function lift() {
  setInteraction(liftLatestDwell(frame));
}

function release() {
  setInteraction(releaseDwells(frame));
}

function exportCanvas() {
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = 'mutine-brush-v029-radial-sediment.png';
  anchor.click();
}

function pointToCanvas(point) {
  return { x: point.x * canvas.width, y: point.y * canvas.height };
}

function polygon(points) {
  context.beginPath();
  points.forEach((point, index) => {
    const pixel = pointToCanvas(point);
    if (index === 0) context.moveTo(pixel.x, pixel.y);
    else context.lineTo(pixel.x, pixel.y);
  });
  context.closePath();
}

function drawAtmosphere() {
  const gradient = context.createRadialGradient(500, 310, 40, 500, 310, 570);
  gradient.addColorStop(0, '#27332d');
  gradient.addColorStop(0.48, '#141d1e');
  gradient.addColorStop(1, '#090e10');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const rustGlow = context.createRadialGradient(175, 470, 8, 175, 470, 330);
  rustGlow.addColorStop(0, color('#d87863', 0.14));
  rustGlow.addColorStop(1, color('#d87863', 0));
  context.fillStyle = rustGlow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const blueGlow = context.createRadialGradient(820, 160, 12, 820, 160, 310);
  blueGlow.addColorStop(0, color('#7f9daf', 0.12));
  blueGlow.addColorStop(1, color('#7f9daf', 0));
  context.fillStyle = blueGlow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.globalAlpha = 0.13;
  for (let index = 0; index < 180; index += 1) {
    const x = (index * 83 + index * index * 7) % 1000;
    const y = (index * 47 + index * index * 3) % 620;
    const size = 0.6 + (index % 5) * 0.35;
    context.fillStyle = index % 3 === 0 ? '#e4d5b8' : '#81968a';
    context.fillRect(x, y, size, size);
  }
  context.restore();
}

function drawPool(frameState) {
  const center = pointToCanvas(frameState.center);
  const pulse = 1 + frameState.swelledCount * 0.018;
  const pool = context.createRadialGradient(center.x - 34, center.y - 24, 16, center.x, center.y, 220 * pulse);
  pool.addColorStop(0, color('#d3af68', 0.3));
  pool.addColorStop(0.34, color('#97b394', 0.19));
  pool.addColorStop(0.72, color('#7f9daf', 0.09));
  pool.addColorStop(1, color('#10161a', 0));
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(center.x, center.y, 226 * pulse, 168 * pulse, -0.14, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.translate(center.x, center.y);
  context.rotate(-0.18 + frameState.driftedCount * 0.012);
  context.beginPath();
  for (let index = 0; index < 28; index += 1) {
    const angle = index / 28 * Math.PI * 2;
    const radius = 66 + Math.sin(angle * 3 + 0.6) * 8 + (index % 4) * 3;
    const x = Math.cos(angle) * radius * 1.44;
    const y = Math.sin(angle) * radius * 0.78;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  const core = context.createLinearGradient(-120, -80, 130, 100);
  core.addColorStop(0, color('#d3af68', 0.46));
  core.addColorStop(0.46, color('#829b84', 0.34));
  core.addColorStop(1, color('#7f9daf', 0.28));
  context.fillStyle = core;
  context.fill();
  context.strokeStyle = color('#eee7d6', 0.2);
  context.lineWidth = 1.4;
  context.stroke();
  context.restore();
}

function drawTongue(tongue, index) {
  const fill = palette[index % palette.length];
  const under = palette[(index + 3) % palette.length];
  polygon(tongue.points);
  context.save();
  context.shadowColor = color('#050809', 0.65);
  context.shadowBlur = 18 + tongue.swell * 8;
  context.shadowOffsetY = 9;
  context.fillStyle = color(under, 0.26 + tongue.pigment * 0.06);
  context.fill();
  context.restore();

  polygon(tongue.points);
  const bounds = tongue.points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x * canvas.width),
    maxX: Math.max(box.maxX, point.x * canvas.width),
    minY: Math.min(box.minY, point.y * canvas.height),
    maxY: Math.max(box.maxY, point.y * canvas.height)
  }), { minX: canvas.width, maxX: 0, minY: canvas.height, maxY: 0 });
  const gradient = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  gradient.addColorStop(0, color(fill, 0.54 + Math.min(0.24, tongue.pigment * 0.16)));
  gradient.addColorStop(0.58, color(fill, 0.76));
  gradient.addColorStop(1, color(under, 0.52));
  context.fillStyle = gradient;
  context.fill();

  polygon(tongue.points);
  context.strokeStyle = color('#eee7d6', 0.16 + tongue.swell * 0.04);
  context.lineWidth = 1.15 + tongue.swell * 0.55;
  context.stroke();

  context.save();
  context.globalAlpha = 0.2 + tongue.swell * 0.05;
  context.strokeStyle = color('#f1dcc0', 1);
  context.lineWidth = 1;
  context.beginPath();
  const accentStart = tongue.points[Math.floor(tongue.points.length * 0.48)];
  const accentEnd = tongue.points[Math.floor(tongue.points.length * 0.62)];
  context.moveTo(accentStart.x * canvas.width, accentStart.y * canvas.height);
  context.lineTo(accentEnd.x * canvas.width, accentEnd.y * canvas.height);
  context.stroke();
  context.restore();
}

function drawWaitingState() {
  if (!holding) return;
  const point = pointToCanvas(dwellPoint);
  const elapsed = Math.max(0, performance.now() - dwellStartedAt);
  const progress = Math.min(1.25, elapsed / MIN_DWELL_MS);
  context.save();
  context.strokeStyle = color('#eee7d6', 0.68);
  context.lineWidth = 2;
  context.setLineDash([4, 7]);
  context.beginPath();
  context.arc(point.x, point.y, 22 + progress * 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, progress));
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = color('#eee7d6', 0.14);
  context.beginPath();
  context.arc(point.x, point.y, 8 + progress * 7, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function stateMessage(label) {
  return {
    baseline: 'The sediment is still wet.',
    waiting: 'Stillness is loading the mass.',
    restless: 'Movement sheds the waiting pressure.',
    'dwell-committed': 'One tongue swelled; another settled elsewhere.',
    'dwell-refused-short': 'The visit left before the material could settle.',
    'dwell-refused': 'The material refuses that repeated wait.',
    'dwell-lifted': 'The latest settling lifted; the prior mass returns.',
    'dwell-lift-refused': 'There is no settling to lift.',
    'dwells-released': 'The sediment released its remembered pressure.'
  }[label] || 'The sediment is still wet.';
}

function render() {
  if (!context) return;
  drawAtmosphere();
  const order = [...frame.tongues].sort((a, b) => a.length - b.length);
  drawPool(frame);
  order.forEach((tongue) => drawTongue(tongue, tongue.id));
  drawPool(frame);
  drawWaitingState();

  const field = fieldNode();
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.tongueCount = String(frame.tongues.length);
  field.dataset.swelled = String(frame.swelledCount);
  field.dataset.settled = String(frame.settledCount);
  field.dataset.stage = String(frame.stage);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} dwell${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) stateNode.textContent = stateMessage(interaction);
}

function finishPointer(event) {
  const eventId = event.pointerId ?? 'mouse';
  if (!holding || (pointerId !== null && eventId !== pointerId)) return;
  event.preventDefault();
  const point = normalizedPoint(event);
  if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 0.045) dwellPoint = point;
  const duration = Math.round(performance.now() - dwellStartedAt);
  holding = false;
  pointerId = null;
  setInteraction(applyDwell(frame, { point: dwellPoint, duration }, 'pointer-dwell'));
}

function beginPointer(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  holding = true;
  pointerId = event.pointerId ?? 'mouse';
  dwellStartedAt = performance.now();
  dwellPoint = normalizedPoint(event);
  lastPoint = dwellPoint;
  canvas.setPointerCapture?.(pointerId);
  interaction = 'waiting';
  render();
}

function movePointer(event) {
  if (!holding || (pointerId !== null && event.pointerId !== pointerId)) return;
  event.preventDefault();
  const point = normalizedPoint(event);
  if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 0.045) {
    dwellPoint = point;
    dwellStartedAt = performance.now();
    interaction = 'restless';
  }
  lastPoint = point;
  render();
}

function bindPointer() {
  canvas.addEventListener('pointerdown', beginPointer);
  canvas.addEventListener('pointermove', movePointer);
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', () => { holding = false; pointerId = null; interaction = 'baseline'; render(); });
}

function bindControls() {
  const field = fieldNode();
  field.querySelector('[data-gesture="dwell"]').addEventListener('click', () => commitDwell(nextDwell(), 'button-dwell'));
  field.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
  field.querySelector('[data-gesture="release"]').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitDwell(nextDwell());
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      release();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      exportCanvas();
    }
  });
}

function setup() {
  canvas = canvasNode();
  context = canvas.getContext('2d');
  const settled = buildTimeline().at(-1);
  frame = reducedMotion || staticMode ? settled : buildFrame(0, []);
  setInteraction(frame, 'baseline');
  bindPointer();
  bindControls();
  window.__mutineBrushV029Ready = true;
}

setup();

window.__mutineBrushV029 = {
  getState: () => ({
    stage: frame.stage,
    memory: frame.memory.length,
    dwells: frame.memory.map((event) => ({ ...event })),
    signature: geometrySignature(frame),
    interaction,
    grammar: frame.grammar,
    tongueCount: frame.tongues.length,
    swelledCount: frame.swelledCount,
    settledCount: frame.settledCount,
    driftedCount: frame.driftedCount,
    lastDwell: frame.lastDwell
  }),
  getFrame: () => frame
};
