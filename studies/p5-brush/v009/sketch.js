import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-braid-gate');
const liftControl = document.querySelector('#lift-braid-gate');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash.startsWith('#interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindPreview = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3600;
let startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#0b1112',
  groundGlow: '#203432',
  earth: '#263d38',
  wet: '#e2a957',
  wetLight: '#f4d19a',
  olive: '#99a58a',
  rust: '#dc7656',
  silt: '#78928d',
  gate: '#121c1f',
  chalk: '#e9e1ce',
  teal: '#71afa5'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function resizeCanvas() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.floor(width * ratio));
  const pixelHeight = Math.max(1, Math.floor(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);
}

function trace(points, value = (point) => point.y) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0].x, value(points[0], 0));
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleX = (previous.x + current.x) / 2;
    const middleY = (value(previous, index - 1) + value(current, index)) / 2;
    context.quadraticCurveTo(previous.x, value(previous, index - 1), middleX, middleY);
  }
  const last = points.at(-1);
  context.lineTo(last.x, value(last, points.length - 1));
}

function drawGround(stage, progress) {
  const wash = context.createRadialGradient(.52, .18, .04, .5, .54, .95);
  wash.addColorStop(0, palette.groundGlow);
  wash.addColorStop(.43, palette.ground);
  wash.addColorStop(1, '#040708');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .19;
  context.strokeStyle = palette.earth;
  context.lineWidth = .00062;
  for (let index = 0; index < 54; index += 1) {
    const y = .025 + index * .019;
    const drift = Math.sin(index * 1.41 + stage * .17 + progress * .3) * .035;
    context.beginPath();
    context.moveTo(.012 + drift, y);
    context.bezierCurveTo(.17, y - .011, .55, y + Math.sin(index * .77) * .015, .988 - drift, y + .008);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .24;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 320; index += 1) {
    const x = .02 + ((index * 47 + stage * 19) % 950) / 1000;
    const y = .02 + ((index * 83 + stage * 29) % 935) / 1000;
    const radius = .00014 + (index % 7) * .00008;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawGate(gate, index, active = false, pulse = 0) {
  if (!gate) return;
  const { point, radius } = gate;
  context.save();
  context.globalAlpha = active ? .88 : .2 + Math.min(index, 7) * .035;
  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.6);
  halo.addColorStop(0, active ? 'rgba(7, 12, 13, .98)' : 'rgba(7, 12, 13, .9)');
  halo.addColorStop(.4, 'rgba(22, 37, 38, .56)');
  halo.addColorStop(1, 'rgba(22, 37, 38, 0)');
  context.fillStyle = halo;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.4, radius * .68, -.2 + index * .11, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .84 : .26;
  context.strokeStyle = active ? palette.teal : palette.rust;
  context.lineWidth = active ? .0017 : .0007;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * .82, point.y - radius * .1);
  context.bezierCurveTo(point.x - radius * .26, point.y + radius * (.25 + pulse * .08), point.x + radius * .2, point.y - radius * (.28 + pulse * .05), point.x + radius * .88, point.y + radius * .04);
  context.stroke();

  context.globalAlpha = active ? .32 : .1;
  context.strokeStyle = palette.chalk;
  context.lineWidth = .00042;
  context.beginPath();
  context.moveTo(point.x - radius * .33, point.y - radius * .91);
  context.lineTo(point.x + radius * .34, point.y + radius * .91);
  context.stroke();
  context.restore();
}

function drawDeposit(point, size, alpha, color) {
  context.save();
  context.globalAlpha = alpha;
  const pool = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 2.1);
  pool.addColorStop(0, color);
  pool.addColorStop(.42, palette.earth);
  pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(point.x, point.y, size * 1.8, size * .48, -.15, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.olive : palette.silt;
  context.save();
  context.globalAlpha = .1 + stroke.opacity * .16;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 6.3;
  context.lineCap = 'round';
  trace(stroke.points);
  context.stroke();
  context.restore();

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
    const previous = stroke.points[pointIndex - 1];
    const point = stroke.points[pointIndex];
    const split = (previous.split + point.split) * .5;
    const settle = Math.max(previous.settle, point.settle);
    const deposit = Math.max(previous.deposit, point.deposit);
    const routeColor = settle > .02 ? palette.teal : split > .018 ? palette.wetLight : baseColor;
    context.globalAlpha = .31 + stroke.opacity * .5 + deposit * .24;
    context.strokeStyle = deposit > .024 ? palette.rust : routeColor;
    context.lineWidth = stroke.weight * (1.48 + split * 4.4 + settle * 2.6 + deposit * 2.3);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .1 + Math.min(memoryCount, 7) * .021 + stroke.settleMass * .8;
  context.strokeStyle = stroke.routeShift >= 0 ? palette.chalk : palette.teal;
  context.lineWidth = stroke.weight * .3;
  context.setLineDash([.0028, .008 + index * .0007]);
  trace(stroke.points, (point) => point.y + (point.split - point.settle) * .18);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  for (let pointIndex = 2; pointIndex < stroke.points.length - 2; pointIndex += 4) {
    const point = stroke.points[pointIndex];
    if (point.deposit < .018 && point.settle < .016) continue;
    const poolSize = .0038 + point.deposit * .03 + point.settle * .014;
    drawDeposit(point, poolSize, .11 + point.deposit * .78, point.deposit > .02 ? palette.rust : palette.teal);
  }
}

function drawBraidThreads(frame) {
  if (blindPreview) return;
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const y = delta.point.y;
    const settleX = Math.min(.94, delta.point.x + delta.settle);
    const span = delta.radius * (2.6 + Math.min(index, 7) * .12);
    context.globalAlpha = .1 + Math.min(index, 6) * .018;
    context.strokeStyle = index % 2 ? palette.rust : palette.teal;
    context.lineWidth = .00052 + index * .000034;
    context.beginPath();
    context.moveTo(delta.point.x - span, y - .012);
    context.bezierCurveTo(delta.point.x - span * .28, y + .03 * delta.side, settleX - span * .35, y - .03 * delta.side, settleX + span, y);
    context.stroke();
    context.beginPath();
    context.moveTo(delta.point.x - span, y + .012);
    context.bezierCurveTo(delta.point.x - span * .28, y - .03 * delta.side, settleX - span * .35, y + .03 * delta.side, settleX + span, y);
    context.stroke();
  });
  context.restore();
}

function drawNotation(frame) {
  if (blindPreview) return;
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.chalk;
  context.font = '600 .0105px ui-monospace, monospace';
  context.fillText('MATTER / SPLIT-SETTLE BRAID', .032, .946);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} GATES REMEMBERED`, .968, .946);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawGate(delta, index, false, pulse));
  drawBraidThreads(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawGate(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (!blindPreview && state === 'sequence') drawGate(frame.currentGate, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-braid-gate'
    ? 'braid gate made / paused'
    : state === 'braid-gate-lifted'
      ? 'latest braid gate lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} braid gates remembered`;
}

function sequenceFrame(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  activeStage = Math.floor(withinCycle / STAGE_MS);
  return { frame: timeline[activeStage], progress: (withinCycle % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-braid-gate');
    return;
  }
  if (staticPreview || reducedMotion) {
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = sequenceFrame(now);
  render(current.frame, current.progress, 'sequence');
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .06, .94),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .09, .91)
  };
}

function makeBraidGate(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks split around the absence, then settle back into one deposited braid.';
  render(interactionFrame, 1, 'visitor-braid-gate');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest braid gate is lifted; the split and settlement are rebuilt.';
  render(interactionFrame, 1, 'braid-gate-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  paused = false;
  stateReadout.textContent = 'The wet marks are splitting around what has been removed.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeBraidGate(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeBraidGate({ x: .62, y: .51 });
});
makeControl?.addEventListener('click', () => makeBraidGate({ x: .62, y: .51 }));
liftControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
else window.addEventListener('resize', () => renderCurrent());
renderCurrent();
if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
