import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-hinge-curl');
const liftControl = document.querySelector('#lift-hinge-curl');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash.startsWith('#interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindPreview = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3400;
let startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#0b1112',
  groundGlow: '#203a35',
  earth: '#29403a',
  wet: '#e4ac5c',
  wetLight: '#f4d7a2',
  olive: '#a1ad90',
  rust: '#df7957',
  silt: '#769894',
  hinge: '#111e20',
  chalk: '#eee4d0',
  teal: '#72b6a8'
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
  const wash = context.createRadialGradient(.5, .18, .03, .5, .52, .94);
  wash.addColorStop(0, palette.groundGlow);
  wash.addColorStop(.42, palette.ground);
  wash.addColorStop(1, '#040708');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .18;
  context.strokeStyle = palette.earth;
  context.lineWidth = .00058;
  for (let index = 0; index < 58; index += 1) {
    const y = .018 + index * .017;
    const drift = Math.sin(index * 1.37 + stage * .15 + progress * .28) * .036;
    context.beginPath();
    context.moveTo(.01 + drift, y);
    context.bezierCurveTo(.2, y - .012, .55, y + Math.sin(index * .73) * .014, .99 - drift, y + .007);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .2;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 380; index += 1) {
    const x = .018 + ((index * 47 + stage * 23) % 956) / 1000;
    const y = .018 + ((index * 83 + stage * 31) % 942) / 1000;
    const radius = .00012 + (index % 8) * .00007;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawHinge(hinge, index, active = false, pulse = 0) {
  if (!hinge) return;
  const { point, radius } = hinge;
  context.save();
  context.globalAlpha = active ? .92 : .19 + Math.min(index, 7) * .035;
  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.1);
  halo.addColorStop(0, active ? 'rgba(5, 11, 12, .98)' : 'rgba(7, 13, 14, .92)');
  halo.addColorStop(.42, 'rgba(28, 52, 49, .55)');
  halo.addColorStop(1, 'rgba(28, 52, 49, 0)');
  context.fillStyle = halo;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.32, radius * .72, -.28 + index * .1, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .86 : .28;
  context.strokeStyle = active ? palette.teal : palette.rust;
  context.lineWidth = active ? .0018 : .00068;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * .9, point.y + radius * .16);
  context.bezierCurveTo(point.x - radius * .2, point.y - radius * (.3 + pulse * .08), point.x + radius * .2, point.y + radius * (.3 + pulse * .06), point.x + radius * .9, point.y - radius * .08);
  context.stroke();

  context.globalAlpha = active ? .32 : .1;
  context.strokeStyle = palette.chalk;
  context.lineWidth = .0004;
  context.beginPath();
  context.moveTo(point.x - radius * .34, point.y - radius * .92);
  context.lineTo(point.x + radius * .35, point.y + radius * .92);
  context.stroke();
  context.restore();
}

function drawCurlRibbons(frame) {
  if (blindPreview) return;
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const startX = delta.point.x - delta.radius * 2.3;
    const exitX = Math.min(.96, delta.point.x + delta.curl * .72);
    const span = delta.depth * (1.1 + Math.min(index, 7) * .05);
    context.globalAlpha = .1 + Math.min(index, 6) * .018;
    context.strokeStyle = index % 2 ? palette.rust : palette.teal;
    context.lineWidth = .00045 + index * .00003;
    context.beginPath();
    context.moveTo(startX, delta.point.y - span * .32);
    context.bezierCurveTo(delta.point.x - delta.radius, delta.point.y - span * 1.1, delta.point.x + delta.radius * 1.3, delta.point.y + span * delta.side, exitX, delta.point.y - span * .18);
    context.stroke();
    context.beginPath();
    context.moveTo(startX, delta.point.y + span * .32);
    context.bezierCurveTo(delta.point.x - delta.radius, delta.point.y + span * 1.1, delta.point.x + delta.radius * 1.3, delta.point.y - span * delta.side, exitX, delta.point.y + span * .18);
    context.stroke();
  });
  context.restore();
}

function drawWetPool(point, size, alpha, color) {
  context.save();
  context.globalAlpha = alpha;
  const pool = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 2.4);
  pool.addColorStop(0, color);
  pool.addColorStop(.42, palette.earth);
  pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(point.x, point.y, size * 1.7, size * .46, -.18, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.olive : palette.silt;
  context.save();
  context.globalAlpha = .1 + stroke.opacity * .15;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 6.5;
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
    const hinge = (previous.hinge + point.hinge) * .5;
    const curl = Math.max(previous.curl, point.curl);
    const tail = Math.max(previous.tail, point.tail);
    const wet = Math.max(previous.wet, point.wet);
    const routeColor = tail > .012 ? palette.teal : curl > .016 ? palette.wetLight : baseColor;
    context.globalAlpha = .28 + stroke.opacity * .49 + wet * .18;
    context.strokeStyle = tail > .018 ? palette.teal : curl > .024 ? palette.rust : routeColor;
    context.lineWidth = stroke.weight * (1.42 + hinge * 4.8 + curl * 2.7 + tail * 1.8);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .095 + Math.min(memoryCount, 7) * .019 + stroke.curlMass * .75;
  context.strokeStyle = stroke.tailDrift > stroke.hingeAmplitude ? palette.chalk : palette.teal;
  context.lineWidth = stroke.weight * .29;
  context.setLineDash([.0024, .0075 + index * .00065]);
  trace(stroke.points, (point) => point.y + (point.curl - point.tail) * .14);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  for (let pointIndex = 2; pointIndex < stroke.points.length - 2; pointIndex += 4) {
    const point = stroke.points[pointIndex];
    if (point.curl < .018 && point.tail < .014) continue;
    const poolSize = .003 + point.curl * .026 + point.tail * .014;
    drawWetPool(point, poolSize, .1 + point.wet * .54, point.tail > .018 ? palette.teal : palette.rust);
  }
}

function drawNotation(frame) {
  if (blindPreview) return;
  context.save();
  context.globalAlpha = .58;
  context.fillStyle = palette.chalk;
  context.font = '600 .0105px ui-monospace, monospace';
  context.fillText('MATTER / HINGE-CURL', .032, .946);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} HINGES REMEMBERED`, .968, .946);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawHinge(delta, index, false, pulse));
  drawCurlRibbons(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawHinge(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (!blindPreview && state === 'sequence') drawHinge(frame.currentHinge, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-hinge-curl'
    ? 'hinge made / paused'
    : state === 'hinge-curl-lifted'
      ? 'latest hinge lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} hinges remembered`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-hinge-curl');
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
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .055, .945),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .075, .925)
  };
}

function makeHinge(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks pivot through the hinge, carry the curl, and return to their lanes.';
  render(interactionFrame, 1, 'visitor-hinge-curl');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest hinge is lifted; the pivot, curl, and tail are rebuilt.';
  render(interactionFrame, 1, 'hinge-curl-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  paused = false;
  stateReadout.textContent = 'The wet marks are carrying a turn through the field.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeHinge(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeHinge({ x: .62, y: .51 });
});
makeControl?.addEventListener('click', () => makeHinge({ x: .62, y: .51 }));
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
