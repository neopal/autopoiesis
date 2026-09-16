import { STAGES, buildTimeline, applyTideMark, removeLatestTideMark } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-tide');
const liftControl = document.querySelector('#lift-tide');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction') && !location.hash.startsWith('#interaction'));
const blindPreview = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3000;
let startedAt = performance.now();
let interactionFrame = null;
let activeStage = 0;
let lastFrame = null;

const palette = {
  ground: '#15201a',
  deep: '#050908',
  peat: '#263b2d',
  ink: '#e7ead9',
  muted: '#a9b9a8',
  saffron: '#e8b968',
  coral: '#df8066',
  mint: '#8bc9a8',
  blue: '#82adc4',
  chalk: '#d8dec8'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const memoryLabel = (count) => `${count} ${count === 1 ? 'mark' : 'marks'} carried`;

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
  const wash = context.createRadialGradient(.3, .04, .02, .55, .58, 1.04);
  wash.addColorStop(0, palette.peat);
  wash.addColorStop(.38, palette.ground);
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .18;
  context.lineCap = 'round';
  for (let index = 0; index < 116; index += 1) {
    const y = .018 + index * .0085;
    const drift = Math.sin(index * 1.47 + stage * .16 + progress * .42) * .028;
    context.strokeStyle = index % 5 === 0 ? palette.mint : palette.ink;
    context.lineWidth = .00028 + (index % 4) * .00008;
    context.beginPath();
    context.moveTo(.01 + drift, y);
    context.bezierCurveTo(.22, y - .008 + Math.sin(index) * .004, .64, y + Math.cos(index * .7) * .009, .99 - drift, y + .005);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .12;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 900; index += 1) {
    const x = .01 + ((index * 47 + stage * 29) % 983) / 1000;
    const y = .012 + ((index * 83 + stage * 37) % 965) / 1000;
    const radius = .00006 + (index % 9) * .000035;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalAlpha = .11;
  context.strokeStyle = palette.blue;
  context.lineWidth = .00025;
  context.setLineDash([.0014, .009 + (stage % 3) * .001]);
  for (let index = 0; index < 13; index += 1) {
    const x = .035 + index * .078 + Math.sin(stage * .11 + index * .8) * .007;
    context.beginPath();
    context.moveTo(x, .018);
    context.bezierCurveTo(x + .02, .32, x - .022, .66, x + Math.sin(index) * .012, .982);
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();
}

function drawMarkWitness(mark, index, active = false, pulse = 0) {
  if (!mark || blindPreview) return;
  const { point, radius } = mark;
  context.save();
  context.globalAlpha = active ? .76 : .08 + Math.min(index, 7) * .026;
  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.6);
  halo.addColorStop(0, active ? 'rgba(232,185,105,.9)' : 'rgba(139,201,168,.45)');
  halo.addColorStop(.38, 'rgba(223,128,102,.24)');
  halo.addColorStop(1, 'rgba(5,9,8,0)');
  context.fillStyle = halo;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.75, radius * .72, -.16, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .58 : .18;
  context.strokeStyle = active ? palette.saffron : palette.mint;
  context.lineWidth = active ? .0014 : .00042;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * 1.55, point.y);
  context.bezierCurveTo(point.x - radius * .74, point.y - radius * (.9 + pulse * .13), point.x - radius * .22, point.y - radius * .28, point.x, point.y);
  context.bezierCurveTo(point.x + radius * .22, point.y + radius * .28, point.x + radius * .74, point.y + radius * (.9 + pulse * .13), point.x + radius * 1.55, point.y);
  context.stroke();
  context.restore();
}

function drawTailWitnesses(frame) {
  if (blindPreview) return;
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const x = Math.min(.94, delta.point.x + delta.spill * .88);
    const span = delta.shear * (1 + Math.min(index, 7) * .06);
    context.globalAlpha = .035 + Math.min(index, 7) * .009;
    context.strokeStyle = index % 2 ? palette.coral : palette.blue;
    context.lineWidth = .00032 + index * .000018;
    context.beginPath();
    context.moveTo(Math.max(.03, delta.point.x - delta.hold * 2), delta.point.y - span * .28);
    context.bezierCurveTo(delta.point.x, delta.point.y - span, x - delta.spill * .18, delta.point.y + span * .86, x, delta.point.y + span * .16);
    context.stroke();
    context.beginPath();
    context.moveTo(Math.max(.03, delta.point.x - delta.hold * 2), delta.point.y + span * .28);
    context.bezierCurveTo(delta.point.x, delta.point.y + span, x - delta.spill * .18, delta.point.y - span * .86, x, delta.point.y - span * .16);
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
  bead.addColorStop(1, 'rgba(5,9,8,0)');
  context.fillStyle = bead;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 2.2, radius * .65, -.2, 0, Math.PI * 2);
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
    const pool = Math.max(previous.pool, point.pool);
    const spill = Math.max(previous.spill, point.spill);
    const delay = Math.max(previous.delay, point.delay);
    const tide = Math.max(previous.tide, point.tide);
    const color = delay > .04 ? palette.blue : spill > .04 ? palette.coral : pool > .04 ? palette.saffron : baseColor;
    context.globalAlpha = .22 + stroke.opacity * .52 + tide * .13;
    context.strokeStyle = color;
    context.lineWidth = stroke.weight * (1.12 + point.width * .38 + tide * .5);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();

    if (tide > .28 && pointIndex % 4 === index % 4) {
      drawWetBead(point, color, .08 + tide * .12, .0016 + tide * .0028);
    }
  }

  context.globalAlpha = .07 + Math.min(memoryCount, 7) * .013 + stroke.delayMass * .4;
  context.strokeStyle = stroke.delayMass > stroke.poolMass * .7 ? palette.chalk : palette.mint;
  context.lineWidth = stroke.weight * .22;
  context.setLineDash([.0015, .005 + index * .0004]);
  context.beginPath();
  let drawing = false;
  stroke.points.forEach((point, pointIndex) => {
    if (!drawing) {
      context.moveTo(point.x, point.y + (point.delay - point.pool) * .05);
      drawing = true;
    } else {
      context.lineTo(point.x, point.y + (point.delay - point.pool) * .05);
    }
    if (pointIndex === stroke.points.length - 1) context.stroke();
  });
  context.setLineDash([]);
  context.restore();
}

function drawNotation(frame) {
  if (blindPreview) return;
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.ink;
  context.font = '600 .0102px ui-monospace, monospace';
  context.fillText('MATTER / TIDE MARK', .03, .944);
  context.textAlign = 'right';
  context.fillStyle = palette.saffron;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} MARKS CARRIED`, .97, .944);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  frame.deltas.forEach((delta, index) => drawMarkWitness(delta, index, false, pulse));
  drawTailWitnesses(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  if (!blindPreview && state !== 'sequence' && frame.deltas.length) {
    drawMarkWitness(frame.deltas.at(-1), frame.deltas.length - 1, true, pulse);
  }
  if (!blindPreview && state === 'sequence') drawMarkWitness(frame.currentTideMark, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-tide-mark'
    ? 'mark made / paused'
    : state === 'tide-mark-lifted'
      ? 'latest mark lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = memoryLabel(frame.memory.length);
  lastFrame = frame;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-tide-mark');
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

function makeTide(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyTideMark(base, point);
  stateReadout.textContent = 'The pooled crest spills sideways, then drags a delayed tail downstream.';
  render(interactionFrame, 1, 'visitor-tide-mark');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestTideMark(base);
  stateReadout.textContent = 'The latest mark is lifted; pool, spill, and tail are rebuilt.';
  render(interactionFrame, 1, 'tide-mark-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  stateReadout.textContent = 'The wet routes are gathering, cresting, and shedding their load.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeTide(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeTide({ x: .64, y: .52 });
});
makeControl?.addEventListener('click', () => makeTide({ x: .64, y: .52 }));
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
