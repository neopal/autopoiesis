import { STAGES, buildTimeline, applyCut, removeLatestCut } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const openControl = document.querySelector('#open-cut');
const liftControl = document.querySelector('#lift-cut');
const releaseControl = document.querySelector('#release-sequence');
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || location.hash.startsWith('#interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4100;
const startedAt = performance.now();
let interactionFrame = null;
let paused = staticPreview || reducedMotion;
let activeStage = 0;

if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#0d0d0c',
  groundWarm: '#241a14',
  paper: '#b59b72',
  wet: '#e2b35e',
  wetLight: '#f1d49b',
  moss: '#70806b',
  rust: '#d26a45',
  dry: '#70604d',
  chalk: '#e4d6b9'
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
  context.fillStyle = palette.ground;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);
}

function point(point) {
  return [point.x, point.y];
}

function trace(points, offsetX = 0, offsetY = 0) {
  if (!points.length) return;
  const first = point(points[0]);
  context.beginPath();
  context.moveTo(first[0] + offsetX, first[1] + offsetY);
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
  context.fillStyle = palette.ground;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = palette.paper;
  context.lineWidth = .00065;
  for (let index = 0; index < 34; index += 1) {
    const y = .07 + index * .027;
    const drift = Math.sin(index * 1.43 + stage * .17) * .035;
    context.beginPath();
    context.moveTo(.035 + drift, y);
    context.bezierCurveTo(.28, y - .012, .68, y + Math.sin(index * .81) * .015, .965 - drift, y + .008);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .22;
  context.fillStyle = palette.chalk;
  for (let index = 0; index < 86; index += 1) {
    const x = (.03 + ((index * 37 + stage * 19) % 940) / 1000);
    const y = (.08 + ((index * 71 + stage * 13) % 820) / 1000);
    const radius = .00045 + (index % 4) * .00024;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawChannel(channel, index, active = false) {
  if (!channel) return;
  const { point: start, exit, reentry, side } = channel;
  const endX = reentry;
  const bend = side * (channel.width * .86 + .018);
  context.save();
  context.globalAlpha = active ? .92 : .32 + Math.min(index, 4) * .045;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = palette.ground;
  context.lineWidth = channel.width * 2.2;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.bezierCurveTo(exit, start.y + bend, reentry - .04, start.y + bend, endX, start.y + bend * .48);
  context.stroke();
  context.strokeStyle = active ? palette.rust : palette.dry;
  context.lineWidth = .0012 + channel.width * .07;
  context.setLineDash([.009, .014]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.bezierCurveTo(exit, start.y + bend, reentry - .04, start.y + bend, endX, start.y + bend * .48);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = active ? palette.wet : palette.rust;
  context.beginPath();
  context.arc(start.x, start.y, active ? .008 : .005, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCut(cut, index, active = false) {
  if (!cut) return;
  const radius = .012 + cut.force * .06;
  context.save();
  context.globalAlpha = active ? .92 : .46 + index * .05;
  context.strokeStyle = active ? palette.wet : palette.rust;
  context.lineWidth = .0012;
  context.beginPath();
  context.arc(cut.point.x, cut.point.y, radius, -.9, 1.9);
  context.stroke();
  context.globalAlpha *= .55;
  context.strokeStyle = palette.chalk;
  context.lineWidth = .004;
  context.beginPath();
  context.moveTo(cut.point.x - radius * 1.9, cut.point.y - radius * .4);
  context.quadraticCurveTo(cut.point.x, cut.point.y + radius * .7, cut.point.x + radius * 1.9, cut.point.y + radius * .15);
  context.stroke();
  context.restore();
}

function drawStroke(stroke, index, memoryCount) {
  const baseColor = index % 3 === 0 ? palette.wet : index % 3 === 1 ? palette.moss : palette.paper;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.globalAlpha = .12 + stroke.opacity * .28;
  context.strokeStyle = palette.wetLight;
  context.lineWidth = stroke.weight * 4.4;
  trace(stroke.points, -.004, .003);
  context.stroke();

  context.globalAlpha = .42 + stroke.opacity * .42;
  context.strokeStyle = baseColor;
  context.lineWidth = stroke.weight * 1.85;
  trace(stroke.points);
  context.stroke();

  context.globalAlpha = .33 + Math.min(memoryCount, 4) * .025;
  context.strokeStyle = palette.chalk;
  context.lineWidth = stroke.weight * .42;
  context.setLineDash([.004, .012 + index * .001]);
  trace(stroke.points, .002, -.0015);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawMarks(frame, progress, state) {
  context.save();
  context.globalAlpha = .6 + progress * .22;
  context.fillStyle = palette.chalk;
  context.font = '600 10px ui-monospace, monospace';
  context.letterSpacing = '1.5px';
  context.fillText(state === 'sequence' ? `RETURN ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}` : state.toUpperCase(), .035, .94);
  context.textAlign = 'right';
  context.fillStyle = palette.rust;
  context.fillText(`${String(frame.memory.length).padStart(2, '0')} CHANNELS`, .965, .94);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  resizeCanvas();
  drawGround(frame.stage);
  frame.channels.forEach((channel, index) => drawChannel(channel, index));
  frame.strokes.forEach((stroke, index) => drawStroke(stroke, index, frame.memory.length));
  frame.memory.forEach((cut, index) => drawCut(cut, index));
  drawChannel(frame.channels.at(-1), frame.channels.length, true);
  drawCut(frame.currentCut, frame.memory.length, true);
  drawMarks(frame, progress, state);
  stageReadout.textContent = state === 'visitor-cut'
    ? 'visitor cut / paused'
    : state === 'cut-lifted'
      ? 'latest channel lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} channels remembered`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-cut');
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
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .10, .90)
  };
}

function openCut(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = applyCut(base, point);
  paused = true;
  stateReadout.textContent = 'A new dry passage is forcing the wet mark aside.';
  render(interactionFrame, 1, 'visitor-cut');
}

function liftCut() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[activeStage];
  interactionFrame = removeLatestCut(base);
  paused = true;
  stateReadout.textContent = 'The latest channel is lifted; the stroke has been rebuilt.';
  render(interactionFrame, 1, 'cut-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  activeStage = 0;
  paused = false;
  stateReadout.textContent = 'The wet marks are carrying their channels.';
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  openCut(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  openCut({ x: .62, y: .49 });
});
openControl?.addEventListener('click', () => openCut({ x: .62, y: .49 }));
liftControl?.addEventListener('click', liftCut);
releaseControl?.addEventListener('click', releaseSequence);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!staticPreview && !reducedMotion) requestAnimationFrame(frame);
