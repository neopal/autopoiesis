import { STAGES, buildTimeline, applyRemoval, removeLatestRemoval } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { willReadFrequently: true });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const makeControl = document.querySelector('#make-siphon');
const liftControl = document.querySelector('#lift-siphon');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction') && !location.hash.startsWith('#interaction'));
const blindPreview = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline();
const STAGE_MS = 3600;
let startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

const palette = {
  ground: '#071214',
  deep: '#030708',
  algae: '#173c37',
  earth: '#2b4841',
  ochre: '#e1a85c',
  milk: '#f4dfb5',
  reed: '#a9b692',
  rust: '#d86f52',
  mineral: '#75a59b',
  teal: '#63c4ad',
  salt: '#ece5d2'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const memoryLabel = (count) => `${count} ${count === 1 ? 'siphon' : 'siphons'} remembered`;

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
  const wash = context.createRadialGradient(.42, .18, .02, .5, .5, .92);
  wash.addColorStop(0, palette.algae);
  wash.addColorStop(.34, palette.ground);
  wash.addColorStop(1, palette.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = palette.earth;
  context.lineWidth = .00055;
  for (let index = 0; index < 66; index += 1) {
    const y = .018 + index * .0154;
    const drift = Math.sin(index * 1.51 + stage * .17 + progress * .25) * .03;
    context.beginPath();
    context.moveTo(.01 + drift, y);
    context.bezierCurveTo(.2, y - .011, .53, y + Math.sin(index * .71) * .012, .99 - drift, y + .007);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .17;
  context.fillStyle = palette.salt;
  for (let index = 0; index < 520; index += 1) {
    const x = .014 + ((index * 53 + stage * 29) % 972) / 1000;
    const y = .018 + ((index * 79 + stage * 37) % 942) / 1000;
    const radius = .00009 + (index % 9) * .000055;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalAlpha = .14;
  context.strokeStyle = palette.mineral;
  context.lineWidth = .00038;
  context.setLineDash([.002, .012]);
  for (let index = 0; index < 9; index += 1) {
    const x = .08 + index * .105 + Math.sin(stage * .11 + index) * .008;
    context.beginPath();
    context.moveTo(x, .03);
    context.bezierCurveTo(x - .025, .28, x + .025, .68, x + Math.sin(index) * .018, .97);
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();
}

function drawSiphonWitness(delta, index, active = false, pulse = 0) {
  if (!delta || blindPreview) return;
  const { point, radius } = delta;
  context.save();
  context.globalAlpha = active ? .82 : .14 + Math.min(index, 8) * .028;
  const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.6);
  halo.addColorStop(0, active ? 'rgba(2, 7, 8, .98)' : 'rgba(3, 9, 10, .94)');
  halo.addColorStop(.38, 'rgba(26, 69, 61, .52)');
  halo.addColorStop(1, 'rgba(26, 69, 61, 0)');
  context.fillStyle = halo;
  context.beginPath();
  context.ellipse(point.x, point.y, radius * 1.4, radius * .78, -.22 + index * .08, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = active ? .72 : .24;
  context.strokeStyle = active ? palette.teal : palette.rust;
  context.lineWidth = active ? .0017 : .00062;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(point.x - radius * 2.8, point.y - radius * .18);
  context.bezierCurveTo(point.x - radius * 1.2, point.y - radius * (.5 + pulse * .1), point.x - radius * .55, point.y - radius * .17, point.x, point.y);
  context.bezierCurveTo(point.x + radius * .75, point.y + radius * (.3 + pulse * .08), point.x + radius * 1.45, point.y - radius * .18, point.x + radius * 2.4, point.y + radius * .04);
  context.stroke();

  context.globalAlpha = active ? .35 : .09;
  context.strokeStyle = palette.salt;
  context.lineWidth = .00036;
  context.beginPath();
  context.moveTo(point.x - radius * .34, point.y - radius * 1.05);
  context.lineTo(point.x + radius * .38, point.y + radius * 1.05);
  context.stroke();
  context.restore();
}

function drawCapillaryWitnesses(frame) {
  if (blindPreview) return;
  context.save();
  context.lineCap = 'round';
  frame.deltas.forEach((delta, index) => {
    const approachX = Math.max(.02, delta.point.x - delta.reach * .75);
    const releaseX = Math.min(.98, delta.point.x + delta.release * .78);
    const span = delta.depth * (1.05 + Math.min(index, 8) * .045);
    context.globalAlpha = .055 + Math.min(index, 7) * .012;
    context.strokeStyle = index % 2 ? palette.rust : palette.teal;
    context.lineWidth = .0004 + index * .000025;
    context.beginPath();
    context.moveTo(approachX, delta.point.y - span * .56);
    context.bezierCurveTo(delta.point.x - delta.radius, delta.point.y - span * .76, delta.point.x - delta.radius * .4, delta.point.y - span * .08, delta.point.x, delta.point.y);
    context.bezierCurveTo(delta.point.x + delta.radius * .6, delta.point.y + span * .08, delta.point.x + delta.radius * 1.2, delta.point.y + span * .76 * delta.side, releaseX, delta.point.y + span * .2);
    context.stroke();
    context.beginPath();
    context.moveTo(approachX, delta.point.y + span * .56);
    context.bezierCurveTo(delta.point.x - delta.radius, delta.point.y + span * .76, delta.point.x - delta.radius * .4, delta.point.y + span * .08, delta.point.x, delta.point.y);
    context.bezierCurveTo(delta.point.x + delta.radius * .6, delta.point.y - span * .08, delta.point.x + delta.radius * 1.2, delta.point.y - span * .76 * delta.side, releaseX, delta.point.y - span * .2);
    context.stroke();
  });
  context.restore();
}

function drawWetPool(point, size, alpha, color) {
  context.save();
  context.globalAlpha = alpha;
  const pool = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, size * 2.6);
  pool.addColorStop(0, color);
  pool.addColorStop(.4, palette.earth);
  pool.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = pool;
  context.beginPath();
  context.ellipse(point.x, point.y, size * 1.9, size * .5, -.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 4 === 0 ? palette.ochre : index % 4 === 1 ? palette.reed : index % 4 === 2 ? palette.mineral : palette.rust;
  context.save();
  context.globalAlpha = .08 + stroke.opacity * .14;
  context.strokeStyle = palette.milk;
  context.lineWidth = stroke.weight * 7.2;
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
    const siphon = (previous.siphon + point.siphon) * .5;
    const throat = Math.max(previous.throat, point.throat);
    const release = Math.max(previous.release, point.release);
    const wet = Math.max(previous.wet, point.wet);
    context.globalAlpha = .24 + stroke.opacity * .48 + wet * .2;
    context.strokeStyle = release > .02 ? palette.teal : throat > .022 ? palette.rust : siphon > .012 ? palette.milk : baseColor;
    context.lineWidth = stroke.weight * (1.32 + siphon * 4.6 + throat * 3.1 + release * 2.2);
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .07 + Math.min(memoryCount, 8) * .016 + stroke.throatMass * .68;
  context.strokeStyle = stroke.releaseMass > stroke.siphonMass * .65 ? palette.salt : palette.teal;
  context.lineWidth = stroke.weight * .25;
  context.setLineDash([.002, .0065 + index * .00055]);
  trace(stroke.points, (point) => point.y + (point.throat - point.release) * .1);
  context.stroke();
  context.setLineDash([]);
  context.restore();

  for (let pointIndex = 2; pointIndex < stroke.points.length - 2; pointIndex += 4) {
    const point = stroke.points[pointIndex];
    if (point.siphon < .014 && point.throat < .014 && point.release < .014) continue;
    const poolSize = .0026 + point.throat * .025 + point.release * .016;
    const poolColor = point.release > .02 ? palette.teal : point.throat > .02 ? palette.rust : palette.ochre;
    drawWetPool(point, poolSize, .08 + point.wet * .5, poolColor);
  }
}

function drawNotation(frame) {
  if (blindPreview) return;
  context.save();
  context.globalAlpha = .56;
  context.fillStyle = palette.salt;
  context.font = '600 .0105px ui-monospace, monospace';
  context.fillText('MATTER / SIPHON-RELEASE', .032, .946);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} SIPHONS REMEMBERED`, .968, .946);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  const pulse = Math.sin(progress * Math.PI * 2) * .5 + .5;
  drawGround(frame.stage, progress);
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawSiphonWitness(delta, index, false, pulse));
  drawCapillaryWitnesses(frame);
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  if (!blindPreview) frame.deltas.forEach((delta, index) => drawSiphonWitness(delta, index, index === frame.deltas.length - 1 && state !== 'sequence', pulse));
  if (!blindPreview && state === 'sequence') drawSiphonWitness(frame.currentSiphon, frame.memory.length, false, pulse);
  drawNotation(frame);
  stageReadout.textContent = state === 'visitor-siphon'
    ? 'siphon made / paused'
    : state === 'siphon-release-lifted'
      ? 'latest siphon lifted'
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-siphon');
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

function makeSiphon(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = applyRemoval(base, point);
  paused = true;
  stateReadout.textContent = 'The wet marks gather into a throat, then fan back out downstream.';
  render(interactionFrame, 1, 'visitor-siphon');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? (reducedMotion ? timeline.at(-1) : timeline[activeStage]);
  interactionFrame = removeLatestRemoval(base);
  paused = true;
  stateReadout.textContent = 'The latest siphon is lifted; its throat and release are rebuilt.';
  render(interactionFrame, 1, 'siphon-release-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  startedAt = performance.now();
  paused = false;
  stateReadout.textContent = 'The wet marks are gathering and releasing through the field.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  makeSiphon(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeSiphon({ x: .62, y: .51 });
});
makeControl?.addEventListener('click', () => makeSiphon({ x: .62, y: .51 }));
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
