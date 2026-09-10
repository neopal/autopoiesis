import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-membrane');
const liftControl = document.querySelector('#lift-membrane');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash.startsWith('#interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3400;
let startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#0b1012',
  groundGlow: '#1c2a27',
  earth: '#273b36',
  wet: '#e4ad62',
  wetLight: '#f3d6a2',
  olive: '#8e9a7d',
  rust: '#d77555',
  silt: '#758885',
  membrane: '#172125',
  chalk: '#e6e0cc',
  teal: '#6ea9a1'
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
  const wash = context.createRadialGradient(.51, .25, .02, .5, .52, .92);
  wash.addColorStop(0, palette.groundGlow);
  wash.addColorStop(.46, palette.ground);
  wash.addColorStop(1, '#050708');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .18;
  context.strokeStyle = palette.earth;
  context.lineWidth = .00065;
  for (let index = 0; index < 47; index += 1) {
    const y = .035 + index * .021;
    const drift = Math.sin(index * 1.37 + stage * .19 + progress * .36) * .04;
    context.beginPath();
    context.moveTo(.012 + drift, y);
    context.bezierCurveTo(.19, y - .012, .54, y + Math.sin(index * .71) * .017, .988 - drift, y + .008);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .22;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 270; index += 1) {
    const x = .02 + ((index * 47 + stage * 19) % 950) / 1000;
    const y = .03 + ((index * 83 + stage * 29) % 925) / 1000;
    const radius = .00016 + (index % 6) * .00009;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawMembrane(membrane, index, active = false, pulse = 0) {
  if (!membrane) return;
  const { point, radius } = membrane;
  context.save();
  context.globalAlpha = active ? .86 : .24 + Math.min(index, 6) * .035;
  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2.35);
  halo.addColorStop(0, active ? 'rgba(8, 12, 13, .98)' : 'rgba(8, 12, 13, .9)');
  halo.addColorStop(.42, 'rgba(20, 32, 34, .55)');
  halo.addColorStop(1, 'rgba(20, 32, 34, 0)');
  context.fillStyle = halo;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.32, radius * .72, -.17 + index * .12, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .83 : .26;
  context.strokeStyle = active ? palette.teal : palette.rust;
  context.lineWidth = active ? .0017 : .0007;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * .8, point.y - radius * .12);
  context.bezierCurveTo(point.x - radius * .24, point.y + radius * (.28 + pulse * .09), point.x + radius * .21, point.y - radius * (.26 + pulse * .06), point.x + radius * .9, point.y + radius * .06);
  context.stroke();

  context.globalAlpha = active ? .34 : .1;
  context.strokeStyle = palette.chalk;
  context.lineWidth = .00045;
  context.beginPath();
  context.moveTo(point.x - radius * .32, point.y - radius * .92);
  context.lineTo(point.x + radius * .32, point.y + radius * .92);
  context.stroke();
  context.restore();
}

function drawPool(point, size, alpha, color) {
  context.save();
  context.globalAlpha = alpha;
  const pool = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 1.9);
  pool.addColorStop(0, color);
  pool.addColorStop(.45, palette.earth);
  pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(point.x, point.y, size * 1.55, size * .54, -.18, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.olive : palette.silt;
  context.save();
  context.globalAlpha = .1 + stroke.opacity * .16;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 5.9;
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
    const transfer = (previous.transfer + point.transfer) * .5;
    const exchange = Math.max(previous.exchange, point.exchange);
    const wet = Math.max(previous.wet, point.wet);
    const transferColor = transfer > .001 ? palette.wetLight : transfer < -.001 ? palette.teal : baseColor;
    context.globalAlpha = .34 + stroke.opacity * .47 + wet * .2;
    context.strokeStyle = exchange > .018 ? transferColor : baseColor;
    context.lineWidth = stroke.weight * (1.55 + exchange * 4.6 + Math.abs(transfer) * 2.4);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .1 + Math.min(memoryCount, 6) * .022 + Math.min(Math.abs(stroke.transferDelta), .18) * .7;
  context.strokeStyle = stroke.transferDelta >= 0 ? palette.chalk : palette.teal;
  context.lineWidth = stroke.weight * .33;
  context.setLineDash([.0028, .009 + index * .0008]);
  trace(stroke.points, (point) => point.y + point.transfer * .2);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  for (let pointIndex = 2; pointIndex < stroke.points.length - 2; pointIndex += 4) {
    const point = stroke.points[pointIndex];
    if (point.exchange < .02 && point.wet < .015) continue;
    const poolSize = .0042 + point.exchange * .026 + Math.abs(point.transfer) * .016;
    drawPool(point, poolSize, .1 + point.exchange * .8, point.transfer >= 0 ? palette.wet : palette.teal);
  }
}

function strokeAtLane(strokes, lane) {
  const bounded = Math.max(0, Math.min(strokes.length - 1, lane));
  return strokes[bounded]?.baseY ?? .5;
}

function drawExchangeBridges(frame) {
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const y = delta.point.y;
    const upper = strokeAtLane(frame.strokes, Math.floor(delta.point.y * 10) - 1);
    const lower = strokeAtLane(frame.strokes, Math.floor(delta.point.y * 10) + 1);
    const bridgeY = (upper + lower) * .5;
    const span = delta.radius * (2.5 + Math.min(index, 5) * .12);
    context.globalAlpha = .11 + Math.min(index, 5) * .018;
    context.strokeStyle = index % 2 ? palette.rust : palette.teal;
    context.lineWidth = .00055 + index * .000035;
    context.beginPath();
    context.moveTo(delta.point.x - span, bridgeY - .011);
    context.bezierCurveTo(delta.point.x - span * .3, y, delta.point.x + span * .25, y, delta.point.x + span, bridgeY + .011);
    context.stroke();
  });
  context.restore();
}

function drawNotation(frame) {
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.chalk;
  context.font = '600 .0105px ui-monospace, monospace';
  context.fillText('MATTER / POROUS EXCHANGE', .032, .946);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} MEMBRANES`, .968, .946);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  frame.deltas.forEach((delta, index) => drawMembrane(delta, index, false, pulse));
  drawExchangeBridges(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  frame.deltas.forEach((delta, index) => drawMembrane(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (state === 'sequence') drawMembrane(frame.currentMembrane, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-membrane'
    ? 'membrane made / paused'
    : state === 'membrane-lifted'
      ? 'latest membrane lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} membranes remembered`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-membrane');
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

function makeMembrane(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (staticPreview || reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks exchange pigment sideways through the membrane.';
  render(interactionFrame, 1, 'visitor-membrane');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (staticPreview || reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest membrane is lifted; the exchange is rebuilt.';
  render(interactionFrame, 1, 'membrane-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  paused = false;
  stateReadout.textContent = 'The wet marks are sharing the remembered absence.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeMembrane(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeMembrane({ x: .62, y: .51 });
});
makeControl?.addEventListener('click', () => makeMembrane({ x: .62, y: .51 }));
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
