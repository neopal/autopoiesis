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
const STAGE_MS = 3900;
const startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#0b0b0a',
  earth: '#201711',
  earthLight: '#493121',
  wet: '#d9a654',
  wetLight: '#f0d19a',
  olive: '#78806a',
  clay: '#c96847',
  silt: '#786854',
  chalk: '#e8dcc5'
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

function trace(points, offsetX = 0, offsetY = 0) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0].x + offsetX, points[0].y + offsetY);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleX = (previous.x + current.x) / 2 + offsetX;
    const middleY = (previous.y + current.y) / 2 + offsetY;
    context.quadraticCurveTo(previous.x + offsetX, previous.y + offsetY, middleX, middleY);
  }
  const last = points.at(-1);
  context.lineTo(last.x + offsetX, last.y + offsetY);
}

function drawGround(stage) {
  const wash = context.createRadialGradient(.48, .4, .02, .5, .48, .82);
  wash.addColorStop(0, '#2b1c13');
  wash.addColorStop(.44, palette.ground);
  wash.addColorStop(1, '#070807');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = palette.earthLight;
  context.lineWidth = .0008;
  for (let index = 0; index < 31; index += 1) {
    const y = .075 + index * .029;
    const drift = Math.sin(index * 1.37 + stage * .12) * .035;
    context.beginPath();
    context.moveTo(.028 + drift, y);
    context.bezierCurveTo(.22, y - .016, .56, y + Math.sin(index * .77) * .014, .972 - drift, y + .009);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .22;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 132; index += 1) {
    const x = .03 + ((index * 47 + stage * 23) % 937) / 1000;
    const y = .06 + ((index * 71 + stage * 17) % 870) / 1000;
    const radius = .00035 + (index % 5) * .00013;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBasin(basin, index, active = false) {
  if (!basin) return;
  const { point, radius } = basin;
  const scaleY = .58 + (index % 3) * .08;
  const well = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 1.55);
  well.addColorStop(0, active ? 'rgba(5, 6, 5, .9)' : 'rgba(7, 7, 6, .74)');
  well.addColorStop(.5, 'rgba(19, 14, 10, .38)');
  well.addColorStop(1, 'rgba(19, 14, 10, 0)');
  context.save();
  context.fillStyle = well;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.48, radius * scaleY * 1.48, -.16 + index * .11, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let ring = 0; ring < 4; ring += 1) {
    const ringScale = .64 + ring * .18;
    context.globalAlpha = (active ? .7 : .2 + Math.min(index, 4) * .035) * (1 - ring * .13);
    context.strokeStyle = ring === 0 && active ? palette.wet : palette.clay;
    context.lineWidth = ring === 0 ? .0018 : .00075;
    context.setLineDash(ring % 2 ? [.008, .011] : []);
    context.beginPath();
    for (let step = 0; step <= 22; step += 1) {
      const angle = -.72 + step / 22 * 2.82;
      const wobble = 1 + Math.sin(step * 1.9 + index * 2.2) * .09 + Math.cos(step * .63 + ring) * .04;
      const x = point.x + Math.cos(angle) * radius * ringScale * 1.25 * wobble;
      const y = point.y + Math.sin(angle) * radius * ringScale * scaleY * wobble;
      if (step === 0) context.moveTo(x, y); else context.lineTo(x, y);
    }
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = active ? .7 : .22;
  context.strokeStyle = palette.chalk;
  context.lineWidth = .00065;
  for (let bristle = 0; bristle < 5; bristle += 1) {
    const startX = point.x + radius * (1.08 + bristle * .12);
    const startY = point.y - radius * (.55 - bristle * .16);
    context.beginPath();
    context.moveTo(startX, startY);
    context.quadraticCurveTo(startX + radius * .08, startY + radius * .13, startX + radius * (.26 + bristle * .02), startY + radius * .02);
    context.stroke();
  }
  context.restore();
}

function drawPendingMouth(removal, stage) {
  if (!removal) return;
  const radius = removal.radius * (1.1 + Math.sin(stage * .7) * .04);
  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = .0007;
  context.setLineDash([.004, .012]);
  context.beginPath();
  context.arc(removal.point.x, removal.point.y, radius * 1.25, -.4, 2.2);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.olive : palette.silt;
  const absorbedPigment = clamp(stroke.absorbedPigment * 2.6);
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = (.13 + stroke.opacity * .18) * (1 - absorbedPigment * .16);
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 5.4;
  trace(stroke.points, -.003, .003);
  context.stroke();

  context.globalAlpha = (.39 + stroke.opacity * .38) * (1 - absorbedPigment * .2);
  context.strokeStyle = baseColor;
  context.lineWidth = stroke.weight * 1.85;
  trace(stroke.points);
  context.stroke();

  context.globalAlpha = .28 + Math.min(memoryCount, 4) * .035;
  context.strokeStyle = palette.chalk;
  context.lineWidth = stroke.weight * .35;
  context.setLineDash([.0035, .013 + index * .001]);
  trace(stroke.points, .0015, -.0012);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.lineCap = 'round';
  for (let indexPoint = 1; indexPoint < stroke.points.length; indexPoint += 2) {
    const previous = stroke.points[indexPoint - 1];
    const current = stroke.points[indexPoint];
    const pigment = current.pigment;
    if (pigment > .86) continue;
    context.globalAlpha = .16 + (1 - pigment) * .34;
    context.strokeStyle = pigment < .63 ? palette.chalk : palette.clay;
    context.lineWidth = stroke.weight * (.46 + current.width * .32);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(current.x, current.y);
    context.stroke();
  }
  context.restore();
}

function drawMaterialNotation(frame, state) {
  context.save();
  context.globalAlpha = .56;
  context.fillStyle = palette.chalk;
  context.font = `600 ${.0105}px ui-monospace, monospace`;
  context.letterSpacing = `${.0015}px`;
  context.fillText(state === 'sequence' ? 'MATTER / IN MOTION' : state.toUpperCase(), .035, .945);
  context.textAlign = 'right';
  context.fillStyle = palette.clay;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} BASINS`, .965, .945);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  drawGround(frame.stage);
  frame.basins.forEach((basin, index) => drawBasin(basin, index));
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  frame.basins.forEach((basin, index) => drawBasin(basin, index, index === frame.basins.length - 1 && state !== 'sequence'));
  if (state === 'sequence') drawPendingMouth(frame.currentRemoval, frame.stage);
  drawMaterialNotation(frame, state);
  stageReadout.textContent = state === 'visitor-removal'
    ? 'pigment removed / paused'
    : state === 'removal-lifted'
      ? 'latest removal lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} dry basins remembered`;
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
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .11, .89)
  };
}

function removePigment(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks are thinning where pigment was taken.';
  render(interactionFrame, 1, 'visitor-removal');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest basin is lifted; the field has been rebuilt.';
  render(interactionFrame, 1, 'removal-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  paused = false;
  stateReadout.textContent = 'The wet marks are carrying what remains.';
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

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
