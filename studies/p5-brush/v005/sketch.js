import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const removeControl = document.querySelector('#remove-pigment');
const liftControl = document.querySelector('#lift-removal');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash.startsWith('#interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3600;
const startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#090908',
  groundGlow: '#2a1d13',
  earth: '#4a3020',
  wet: '#d9a453',
  wetLight: '#f0d4a2',
  olive: '#85836d',
  clay: '#c86547',
  silt: '#847361',
  chalk: '#eee0c6'
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
  const wash = context.createRadialGradient(.49, .36, .02, .5, .5, .84);
  wash.addColorStop(0, palette.groundGlow);
  wash.addColorStop(.42, palette.ground);
  wash.addColorStop(1, '#050605');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .13;
  context.strokeStyle = palette.earth;
  context.lineWidth = .00075;
  for (let index = 0; index < 34; index += 1) {
    const y = .065 + index * .027;
    const drift = Math.sin(index * 1.49 + stage * .16 + progress * .5) * .034;
    context.beginPath();
    context.moveTo(.022 + drift, y);
    context.bezierCurveTo(.26, y - .015, .56, y + Math.sin(index * .71) * .017, .978 - drift, y + .008);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .2;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 158; index += 1) {
    const x = .025 + ((index * 53 + stage * 17) % 951) / 1000;
    const y = .045 + ((index * 79 + stage * 23) % 898) / 1000;
    const radius = .00025 + (index % 5) * .00011;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawDelta(delta, index, active = false, pulse = 0) {
  if (!delta) return;
  const { point, radius } = delta;
  context.save();
  context.globalAlpha = active ? .76 : .24 + Math.min(index, 4) * .035;
  const mouth = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 1.7);
  mouth.addColorStop(0, active ? 'rgba(3, 4, 3, .96)' : 'rgba(5, 5, 4, .82)');
  mouth.addColorStop(.52, 'rgba(24, 17, 12, .44)');
  mouth.addColorStop(1, 'rgba(24, 17, 12, 0)');
  context.fillStyle = mouth;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.33, radius * .7, -.21 + index * .16, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .8 : .25;
  context.strokeStyle = active ? palette.wet : palette.clay;
  context.lineWidth = active ? .0018 : .00075;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * .68, point.y - radius * .08);
  context.quadraticCurveTo(point.x, point.y + radius * (.24 + pulse * .08), point.x + radius * .84, point.y + radius * .02);
  context.stroke();
  context.restore();
}

function drawBank(stroke, bank, color, opacity, widthFactor) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = opacity;
  context.strokeStyle = color;
  context.lineWidth = stroke.weight * widthFactor;
  trace(stroke.points, (point) => point.y + (bank === 'upper' ? -point.split : point.split));
  context.stroke();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.olive : palette.silt;
  context.save();
  context.globalAlpha = .12 + stroke.opacity * .18;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 5.4;
  trace(stroke.points);
  context.stroke();
  context.restore();

  const bankOpacity = .42 + stroke.opacity * .34;
  const upperDensity = clamp(1 + stroke.pigmentDelta * 1.8, .6, 1.35);
  const lowerDensity = clamp(1 - stroke.pigmentDelta * 1.8, .6, 1.35);
  drawBank(stroke, 'upper', baseColor, bankOpacity, 1.45 * upperDensity);
  drawBank(stroke, 'lower', baseColor, bankOpacity, 1.45 * lowerDensity);
  drawBank(stroke, 'upper', palette.wetLight, .23 + memoryCount * .025, .32);
  drawBank(stroke, 'lower', palette.wetLight, .23 + memoryCount * .025, .32);

  context.save();
  context.globalAlpha = .12 + Math.min(memoryCount, 4) * .03;
  context.strokeStyle = palette.chalk;
  context.lineWidth = stroke.weight * .38;
  context.setLineDash([.0035, .012 + index * .001]);
  trace(stroke.points, (point) => point.y + (point.split > .008 ? -point.split * .42 : 0));
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.lineCap = 'round';
  for (let pointIndex = 3; pointIndex < stroke.points.length - 2; pointIndex += 5) {
    const point = stroke.points[pointIndex];
    if (point.split < .018) continue;
    context.globalAlpha = .1 + point.split * 1.6;
    context.strokeStyle = point.upperPigment > point.lowerPigment ? palette.wetLight : palette.clay;
    context.lineWidth = stroke.weight * (.34 + point.split * 4);
    context.beginPath();
    context.moveTo(point.x, point.y - point.split);
    context.lineTo(point.x, point.y + point.split);
    context.stroke();
  }
  context.restore();
}

function drawMaterialNotation(frame, state) {
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.chalk;
  context.font = '600 .0105px ui-monospace, monospace';
  context.fillText(state === 'sequence' ? 'MATTER / DIVIDING' : state.toUpperCase(), .035, .945);
  context.textAlign = 'right';
  context.fillStyle = palette.clay;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} DELTAS`, .965, .945);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  frame.deltas.forEach((delta, index) => drawDelta(delta, index, false, pulse));
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  frame.deltas.forEach((delta, index) => drawDelta(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (state === 'sequence') drawDelta(frame.currentRemoval, frame.memory.length, false, pulse);
  drawMaterialNotation(frame, state);
  stageReadout.textContent = state === 'visitor-removal'
    ? 'pigment removed / paused'
    : state === 'removal-lifted'
      ? 'latest removal lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} split deltas remembered`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-removal');
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

function removePigment(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The banks are carrying the missing pigment.';
  render(interactionFrame, 1, 'visitor-removal');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest delta is lifted; the field has been rebuilt.';
  render(interactionFrame, 1, 'removal-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  paused = false;
  stateReadout.textContent = 'The wet marks are still carrying the exchange.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  removePigment(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  removePigment({ x: .62, y: .51 });
});
removeControl?.addEventListener('click', () => removePigment({ x: .62, y: .51 }));
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
