import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-capillary');
const liftControl = document.querySelector('#lift-capillary');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash.startsWith('#interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3600;
let startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#090a08',
  groundGlow: '#2e2417',
  earth: '#523924',
  wet: '#e1a94f',
  wetLight: '#f0d3a0',
  olive: '#858a70',
  rust: '#c96647',
  silt: '#817360',
  chalk: '#eee1c7'
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
  const wash = context.createRadialGradient(.47, .31, .02, .5, .52, .86);
  wash.addColorStop(0, palette.groundGlow);
  wash.addColorStop(.43, palette.ground);
  wash.addColorStop(1, '#040504');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .14;
  context.strokeStyle = palette.earth;
  context.lineWidth = .0007;
  for (let index = 0; index < 41; index += 1) {
    const y = .047 + index * .025;
    const drift = Math.sin(index * 1.41 + stage * .18 + progress * .4) * .034;
    context.beginPath();
    context.moveTo(.015 + drift, y);
    context.bezierCurveTo(.22, y - .014, .58, y + Math.sin(index * .69) * .018, .985 - drift, y + .009);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .18;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 214; index += 1) {
    const x = .018 + ((index * 53 + stage * 17) % 957) / 1000;
    const y = .036 + ((index * 79 + stage * 23) % 915) / 1000;
    const radius = .00022 + (index % 5) * .0001;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawSeam(seam, index, active = false, pulse = 0) {
  if (!seam) return;
  const { point, radius } = seam;
  context.save();
  context.globalAlpha = active ? .82 : .26 + Math.min(index, 5) * .035;
  const mouth = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.05);
  mouth.addColorStop(0, active ? 'rgba(2, 3, 2, .97)' : 'rgba(4, 5, 4, .86)');
  mouth.addColorStop(.46, 'rgba(29, 20, 13, .5)');
  mouth.addColorStop(1, 'rgba(29, 20, 13, 0)');
  context.fillStyle = mouth;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.28, radius * .68, -.24 + index * .14, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .86 : .23;
  context.strokeStyle = active ? palette.wet : palette.rust;
  context.lineWidth = active ? .0018 : .00072;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * .72, point.y - radius * .1);
  context.quadraticCurveTo(point.x, point.y + radius * (.2 + pulse * .08), point.x + radius * .92, point.y + radius * .03);
  context.stroke();
  context.restore();
}

function drawWetPool(point, size, alpha, hot = false) {
  context.save();
  context.globalAlpha = alpha;
  const pool = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 1.8);
  pool.addColorStop(0, hot ? palette.wetLight : palette.rust);
  pool.addColorStop(.44, hot ? palette.wet : palette.earth);
  pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(point.x, point.y, size * 1.55, size * .58, -.18, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.olive : palette.silt;
  context.save();
  context.globalAlpha = .1 + stroke.opacity * .17;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 5.6;
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
    const wetting = Math.max(previous.stain, point.stain);
    const drawIn = Math.max(previous.absorption, point.absorption);
    const wake = Math.max(previous.wake, point.wake);
    context.globalAlpha = .38 + stroke.opacity * .42 + wetting * .24;
    context.strokeStyle = wetting > .02 || wake > .018 ? palette.wetLight : baseColor;
    context.lineWidth = stroke.weight * (1.65 + drawIn * 4.4 + wetting * 4.6);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();

  context.save();
  const absorption = stroke.absorptionDelta;
  context.globalAlpha = .11 + Math.min(memoryCount, 5) * .026 + Math.min(Math.abs(stroke.wakeShift), .16) * .25 + absorption * .16;
  context.strokeStyle = palette.chalk;
  context.lineWidth = stroke.weight * .35;
  context.setLineDash([.003, .011 + index * .001]);
  trace(stroke.points, (point) => point.y + point.wake * .14 - point.absorption * .04);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  for (let pointIndex = 3; pointIndex < stroke.points.length - 2; pointIndex += 4) {
    const point = stroke.points[pointIndex];
    if (point.stain < .018 && point.wake < .02) continue;
    const poolSize = .0055 + point.stain * .041 + point.wake * .018;
    drawWetPool(point, poolSize, .12 + point.stain * 1.25 + point.wake * .24, point.wake > .035);
  }
}

function drawNotation(frame, state) {
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.chalk;
  context.font = '600 .0105px ui-monospace, monospace';
  context.fillText(state === 'sequence' ? 'MATTER / CAPILLARY' : state.toUpperCase(), .035, .945);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} SEAMS`, .965, .945);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  frame.deltas.forEach((delta, index) => drawSeam(delta, index, false, pulse));
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  frame.deltas.forEach((delta, index) => drawSeam(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (state === 'sequence') drawSeam(frame.currentSeam, frame.memory.length, false, pulse);
  drawNotation(frame, state);
  stageReadout.textContent = state === 'visitor-capillary'
    ? 'seam made / paused'
    : state === 'capillary-lifted'
      ? 'latest seam lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} capillary seams remembered`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-capillary');
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
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .07, .93),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .1, .9)
  };
}

function makeCapillary(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks draw in, then release a shared wake downstream.';
  render(interactionFrame, 1, 'visitor-capillary');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest seam is lifted; draw-in and wake are rebuilt.';
  render(interactionFrame, 1, 'capillary-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  paused = false;
  stateReadout.textContent = 'The wet marks are drawing toward and releasing the remembered wound.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeCapillary(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeCapillary({ x: .62, y: .51 });
});
makeControl?.addEventListener('click', () => makeCapillary({ x: .62, y: .51 }));
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
