import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-seam');
const liftControl = document.querySelector('#lift-seam');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction') && !location.hash.startsWith('#interaction'));
const blindPreview = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3200;
let startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#17100d',
  deep: '#080504',
  umber: '#44251d',
  clay: '#754334',
  ochre: '#e2af68',
  milk: '#f0dfc2',
  reed: '#b7bd94',
  rust: '#df7554',
  mineral: '#8ab3a1',
  teal: '#6dc6ae',
  salt: '#eee3cd'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const memoryLabel = (count) => `${count} ${count === 1 ? 'seam' : 'seams'} carried`;

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

function traceVisible(points, value = (point) => point.y) {
  if (!points.length) return;
  context.beginPath();
  let drawing = false;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous.dry > .38 || current.dry > .38) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      context.moveTo(previous.x, value(previous, index - 1));
      drawing = true;
    }
    const middleX = (previous.x + current.x) / 2;
    const middleY = (value(previous, index - 1) + value(current, index)) / 2;
    context.quadraticCurveTo(previous.x, value(previous, index - 1), middleX, middleY);
    if (index === points.length - 1) context.lineTo(current.x, value(current, index));
  }
}

function drawGround(stage, progress) {
  const wash = context.createRadialGradient(.38, .08, .02, .52, .54, .96);
  wash.addColorStop(0, palette.umber);
  wash.addColorStop(.35, palette.ground);
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .17;
  context.strokeStyle = palette.clay;
  context.lineWidth = .0005;
  for (let index = 0; index < 78; index += 1) {
    const y = .014 + index * .0131;
    const drift = Math.sin(index * 1.31 + stage * .14 + progress * .18) * .032;
    context.beginPath();
    context.moveTo(.01 + drift, y);
    context.bezierCurveTo(.2, y - .010, .52, y + Math.sin(index * .67) * .013, .99 - drift, y + .007);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .13;
  context.fillStyle = palette.salt;
  for (let index = 0; index < 620; index += 1) {
    const x = .012 + ((index * 53 + stage * 31) % 976) / 1000;
    const y = .016 + ((index * 79 + stage * 41) % 944) / 1000;
    const radius = .00008 + (index % 10) * .000045;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalAlpha = .1;
  context.strokeStyle = palette.mineral;
  context.lineWidth = .00034;
  context.setLineDash([.0018, .011]);
  for (let index = 0; index < 11; index += 1) {
    const x = .062 + index * .091 + Math.sin(stage * .13 + index) * .009;
    context.beginPath();
    context.moveTo(x, .024);
    context.bezierCurveTo(x - .022, .26, x + .026, .7, x + Math.sin(index * 1.4) * .016, .978);
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();
}

function drawSeamWitness(delta, index, active = false, pulse = 0) {
  if (!delta || blindPreview) return;
  const { point, radius, gap } = delta;
  context.save();
  context.globalAlpha = active ? .78 : .11 + Math.min(index, 8) * .025;
  const shadow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.4);
  shadow.addColorStop(0, active ? 'rgba(8, 5, 4, .98)' : 'rgba(19, 11, 9, .88)');
  shadow.addColorStop(.46, 'rgba(117, 67, 52, .42)');
  shadow.addColorStop(1, 'rgba(117, 67, 52, 0)');
  context.fillStyle = shadow;
  context.beginPath();
  context.ellipse(point.x, point.y, gap * 1.35, radius * 1.1, -.3, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .66 : .19;
  context.strokeStyle = active ? palette.rust : palette.teal;
  context.lineWidth = active ? .00155 : .0005;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - gap * 1.32, point.y - radius * .58);
  context.bezierCurveTo(point.x - gap * .55, point.y - radius * (.82 + pulse * .12), point.x - gap * .18, point.y - radius * .32, point.x - gap * .52, point.y);
  context.moveTo(point.x + gap * .52, point.y);
  context.bezierCurveTo(point.x + gap * .18, point.y + radius * .32, point.x + gap * .55, point.y + radius * (.82 + pulse * .12), point.x + gap * 1.32, point.y + radius * .58);
  context.stroke();

  context.globalAlpha = active ? .34 : .08;
  context.strokeStyle = palette.salt;
  context.lineWidth = .00032;
  context.beginPath();
  context.moveTo(point.x - gap * .5, point.y - radius * 1.04);
  context.lineTo(point.x - gap * .5, point.y + radius * 1.04);
  context.moveTo(point.x + gap * .5, point.y - radius * 1.04);
  context.lineTo(point.x + gap * .5, point.y + radius * 1.04);
  context.stroke();
  context.restore();
}

function drawReentryWitnesses(frame) {
  if (blindPreview) return;
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const left = Math.max(.025, delta.point.x - delta.reach * .72);
    const right = Math.min(.975, delta.point.x + delta.gap + delta.return * .78);
    const span = delta.compress * (1.05 + Math.min(index, 8) * .045);
    context.globalAlpha = .045 + Math.min(index, 8) * .011;
    context.strokeStyle = index % 2 ? palette.rust : palette.teal;
    context.lineWidth = .00035 + index * .000022;
    context.beginPath();
    context.moveTo(left, delta.point.y - span * .25);
    context.bezierCurveTo(delta.point.x - delta.gap, delta.point.y - span * .86, delta.point.x - delta.gap * .45, delta.point.y - span * .18, delta.point.x - delta.gap * .52, delta.point.y);
    context.bezierCurveTo(delta.point.x + delta.gap * .66, delta.point.y + span * .18, right - delta.return * .2, delta.point.y + span * .6, right, delta.point.y + span * .18);
    context.stroke();
    context.beginPath();
    context.moveTo(left, delta.point.y + span * .25);
    context.bezierCurveTo(delta.point.x - delta.gap, delta.point.y + span * .86, delta.point.x - delta.gap * .45, delta.point.y + span * .18, delta.point.x - delta.gap * .52, delta.point.y);
    context.bezierCurveTo(delta.point.x + delta.gap * .66, delta.point.y - span * .18, right - delta.return * .2, delta.point.y - span * .6, right, delta.point.y - span * .18);
    context.stroke();
  });
  context.restore();
}

function drawWetPool(point, size, alpha, color) {
  context.save();
  context.globalAlpha = alpha;
  const pool = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 2.8);
  pool.addColorStop(0, color);
  pool.addColorStop(.42, palette.clay);
  pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(point.x, point.y, size * 2.1, size * .58, -.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 4 === 0 ? palette.ochre : index % 4 === 1 ? palette.reed : index % 4 === 2 ? palette.mineral : palette.rust;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let pointIndex = 1; pointIndex < stroke.points.length; pointIndex += 1) {
    const previous = stroke.points[pointIndex - 1];
    const point = stroke.points[pointIndex];
    const approach = (previous.approach + point.approach) * .5;
    const bridge = Math.max(previous.bridge, point.bridge);
    const returning = Math.max(previous.return, point.return);
    const dry = Math.max(previous.dry, point.dry);
    if (dry > .38) continue;
    const wet = Math.max(previous.wet, point.wet);
    context.globalAlpha = .2 + stroke.opacity * .48 + wet * .2;
    context.strokeStyle = returning > .018 ? palette.teal : bridge > .018 ? palette.rust : approach > .012 ? palette.milk : baseColor;
    context.lineWidth = stroke.weight * (1.3 + approach * 3.8 + bridge * 3.1 + returning * 2.4) * (1 - dry * .28);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .075 + Math.min(memoryCount, 8) * .014 + stroke.returnMass * .7;
  context.strokeStyle = stroke.returnMass > stroke.approachMass * .7 ? palette.salt : palette.teal;
  context.lineWidth = stroke.weight * .24;
  context.setLineDash([.0018, .006 + index * .00048]);
  traceVisible(stroke.points, (point) => point.y + (point.return - point.approach) * .09);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  for (let pointIndex = 2; pointIndex < stroke.points.length - 2; pointIndex += 4) {
    const point = stroke.points[pointIndex];
    if (point.dry > .38 || (point.approach < .012 && point.bridge < .012 && point.return < .012)) continue;
    const poolSize = .0024 + point.bridge * .024 + point.return * .018;
    const poolColor = point.return > .024 ? palette.teal : point.bridge > .022 ? palette.rust : palette.ochre;
    drawWetPool(point, poolSize, .07 + point.wet * .42, poolColor);
  }
}

function drawNotation(frame) {
  if (blindPreview) return;
  context.save();
  context.globalAlpha = .57;
  context.fillStyle = palette.salt;
  context.font = '600 .0102px ui-monospace, monospace';
  context.fillText('MATTER / DRY-SEAM', .032, .946);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} SEAMS CARRIED`, .968, .946);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawSeamWitness(delta, index, false, pulse));
  drawReentryWitnesses(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawSeamWitness(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (!blindPreview && state === 'sequence') drawSeamWitness(frame.currentSeam, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-dry-seam'
    ? 'seam made / paused'
    : state === 'dry-seam-lifted'
      ? 'latest seam lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = memoryLabel(frame.memory.length);
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-dry-seam');
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

function makeSeam(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks leave a true gap, then re-enter downstream.';
  render(interactionFrame, 1, 'visitor-dry-seam');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest seam is lifted; its banks and re-entry are rebuilt.';
  render(interactionFrame, 1, 'dry-seam-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  paused = false;
  stateReadout.textContent = 'The wet marks are approaching and re-entering through the field.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeSeam(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeSeam({ x: .62, y: .51 });
});
makeControl?.addEventListener('click', () => makeSeam({ x: .62, y: .51 }));
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
