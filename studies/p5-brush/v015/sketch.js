import { STAGES, buildTimeline, applyBasinMark, removeLatestBasinMark } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-basin');
const liftControl = document.querySelector('#lift-basin');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction') && !location.hash.startsWith('#interaction'));
const blindPreview = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 2800;
let startedAt = performance.now();
let interactionFrame = null;
let activeStage = 0;

const palette = {
  ground: '#171827',
  deep: '#080910',
  peat: '#303454',
  ink: '#eeeadf',
  muted: '#b8b4c8',
  saffron: '#efc66d',
  coral: '#e38d73',
  mint: '#9ed4c0',
  blue: '#87b4d6',
  chalk: '#ded8c7',
  violet: '#b79ad9'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const memoryLabel = (count) => `${count} ${count === 1 ? 'basin' : 'basins'} carried`;

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

function drawGround(stage, progress) {
  const wash = context.createRadialGradient(.26, .04, .02, .58, .62, 1.04);
  wash.addColorStop(0, palette.peat);
  wash.addColorStop(.4, palette.ground);
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .17;
  context.lineCap = 'round';
  for (let index = 0; index < 124; index += 1) {
    const y = .016 + index * .0081;
    const drift = Math.sin(index * 1.31 + stage * .18 + progress * .37) * .025;
    context.strokeStyle = index % 7 === 0 ? palette.violet : palette.ink;
    context.lineWidth = .00026 + (index % 5) * .00007;
    context.beginPath();
    context.moveTo(.01 + drift, y);
    context.bezierCurveTo(.2, y - .009 + Math.sin(index * .9) * .004, .65, y + Math.cos(index * .65) * .009, .99 - drift, y + .005);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .11;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 960; index += 1) {
    const x = .01 + ((index * 47 + stage * 31) % 983) / 1000;
    const y = .012 + ((index * 83 + stage * 41) % 965) / 1000;
    const radius = .00006 + (index % 9) * .000035;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalAlpha = .1;
  context.strokeStyle = palette.blue;
  context.lineWidth = .00024;
  context.setLineDash([.0012, .009 + (stage % 4) * .001]);
  for (let index = 0; index < 14; index += 1) {
    const x = .03 + index * .074 + Math.sin(stage * .13 + index * .7) * .006;
    context.beginPath();
    context.moveTo(x, .02);
    context.bezierCurveTo(x + .024, .3, x - .02, .68, x + Math.sin(index * .8) * .011, .98);
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();
}

function drawBasinWitness(mark, index, active = false, pulse = 0) {
  if (!mark || blindPreview) return;
  const { point, radius } = mark;
  const depth = radius * (1.5 + pulse * .18);
  context.save();
  context.globalAlpha = active ? .72 : .07 + Math.min(index, 7) * .024;
  const halo = context.createRadialGradient(point.x, point.y + depth, 0, point.x, point.y, radius * 3.9);
  halo.addColorStop(0, active ? 'rgba(239,198,109,.8)' : 'rgba(183,154,217,.38)');
  halo.addColorStop(.45, 'rgba(227,141,115,.18)');
  halo.addColorStop(1, 'rgba(8,9,16,0)');
  context.fillStyle = halo;
  context.beginPath();
  context.ellipse(point.x, point.y + depth * .25, radius * 1.8, radius * .86, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .66 : .17;
  context.strokeStyle = active ? palette.saffron : palette.violet;
  context.lineWidth = active ? .0014 : .00042;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * 1.65, point.y - radius * .12);
  context.bezierCurveTo(point.x - radius * .95, point.y + depth * .82, point.x - radius * .44, point.y + depth, point.x, point.y + depth);
  context.bezierCurveTo(point.x + radius * .44, point.y + depth, point.x + radius * .95, point.y + depth * .82, point.x + radius * 1.65, point.y - radius * .12);
  context.stroke();
  context.restore();
}

function drawExitWitnesses(frame) {
  if (blindPreview) return;
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const x = Math.min(.95, delta.point.x + delta.lip * .95);
    const rise = delta.lipHeight * (1 + Math.min(index, 7) * .05);
    context.globalAlpha = .03 + Math.min(index, 7) * .008;
    context.strokeStyle = index % 2 ? palette.blue : palette.coral;
    context.lineWidth = .0003 + index * .000017;
    context.beginPath();
    context.moveTo(Math.max(.025, delta.point.x - delta.bowl * 2.2), delta.point.y - rise * .18);
    context.bezierCurveTo(delta.point.x, delta.point.y + delta.depth, x - delta.lip * .2, delta.point.y + rise * .82, x, delta.point.y - rise * .12);
    context.stroke();
    context.beginPath();
    context.moveTo(Math.max(.025, delta.point.x - delta.bowl * 2.2), delta.point.y + rise * .18);
    context.bezierCurveTo(delta.point.x, delta.point.y + delta.depth * .7, x - delta.lip * .2, delta.point.y - rise * .82, x, delta.point.y + rise * .12);
    context.stroke();
  });
  context.restore();
}

function drawWetBead(point, color, alpha, radius) {
  context.save();
  context.globalAlpha = alpha;
  const bead = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.7);
  bead.addColorStop(0, color);
  bead.addColorStop(.42, palette.chalk);
  bead.addColorStop(1, 'rgba(8,9,16,0)');
  context.fillStyle = bead;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 2.2, radius * .68, -.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 4 === 0 ? palette.saffron : index % 4 === 1 ? palette.mint : index % 4 === 2 ? palette.blue : palette.coral;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
    const previous = stroke.points[pointIndex - 1];
    const point = stroke.points[pointIndex];
    const basin = Math.max(previous.basin, point.basin);
    const floor = Math.max(previous.floor, point.floor);
    const lip = Math.max(previous.lip, point.lip);
    const aftershock = Math.max(previous.aftershock, point.aftershock);
    const color = floor > .06 ? palette.coral : lip > .05 ? palette.blue : basin > .05 ? palette.saffron : aftershock > .04 ? palette.mint : baseColor;
    context.globalAlpha = .22 + stroke.opacity * .52 + (basin + floor + lip) * .08;
    context.strokeStyle = color;
    context.lineWidth = stroke.weight * (1.1 + point.width * .4 + floor * .4);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    if (floor > .3 && pointIndex % 4 === index % 4) {
      drawWetBead(point, color, .08 + floor * .13, .0016 + floor * .003);
    }
  }

  context.globalAlpha = .065 + Math.min(memoryCount, 7) * .014 + stroke.aftershockMass * .36;
  context.strokeStyle = stroke.aftershockMass > stroke.floorMass * .7 ? palette.chalk : palette.violet;
  context.lineWidth = stroke.weight * .2;
  context.setLineDash([.0014, .005 + index * .00036]);
  context.beginPath();
  stroke.points.forEach((point, pointIndex) => {
    const offset = (point.lip - point.floor) * .045;
    if (pointIndex === 0) context.moveTo(point.x, point.y + offset);
    else context.lineTo(point.x, point.y + offset);
  });
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawNotation(frame) {
  if (blindPreview) return;
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.ink;
  context.font = '600 .0102px ui-monospace, monospace';
  context.fillText('MATTER / BASIN MARK', .03, .944);
  context.textAlign = 'right';
  context.fillStyle = palette.saffron;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} BASINS CARRIED`, .97, .944);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  frame.deltas.forEach((delta, index) => drawBasinWitness(delta, index, false, pulse));
  drawExitWitnesses(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  if (!blindPreview && state !== 'sequence' && frame.deltas.length) {
    drawBasinWitness(frame.deltas.at(-1), frame.deltas.length - 1, true, pulse);
  }
  if (!blindPreview && state === 'sequence') drawBasinWitness(frame.currentBasinMark, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-basin-mark'
    ? 'basin made / paused'
    : state === 'basin-mark-lifted'
      ? 'latest basin lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = memoryLabel(frame.memory.length);
  globalThis.__MUTINE_STATE = {
    stage: frame.stage,
    memory: frame.memory.length,
    interaction: frame.interaction ?? 'sequence',
    renderer: 'deterministic Canvas 2D',
    canvasDataUrl: canvas.toDataURL('image/png')
  };
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-basin-mark');
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
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .08, .92)
  };
}

function makeBasin(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyBasinMark(base, point);
  stateReadout.textContent = 'The wet routes descend into a shared floor, then climb the far lip with a changed aftershock.';
  render(interactionFrame, 1, 'visitor-basin-mark');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestBasinMark(base);
  stateReadout.textContent = 'The latest basin is lifted; floor, lip, and aftershock are rebuilt.';
  render(interactionFrame, 1, 'basin-mark-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  stateReadout.textContent = 'The wet routes are descending, settling, and climbing out.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeBasin(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeBasin({ x: .64, y: .52 });
});
makeControl?.addEventListener('click', () => makeBasin({ x: .64, y: .52 }));
liftControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function frame(now) {
  if (!interactionFrame) renderCurrent(now);
  if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
else window.addEventListener('resize', () => renderCurrent());
renderCurrent();
if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
