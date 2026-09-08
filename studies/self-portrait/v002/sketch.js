import { STAGES, applyHinge, buildTimeline, deleteLatestHinge } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const hingeControl = document.querySelector('#hinge-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4200;
let started = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function trace(points) {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(midpoint(points.at(-1), points[0]).x, midpoint(points.at(-1), points[0]).y);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const middle = midpoint(point, next);
    context.quadraticCurveTo(point.x, point.y, middle.x, middle.y);
  });
  context.closePath();
}

function axisPoint(axis, distance) {
  return {
    x: axis.x - Math.sin(axis.tilt) * distance,
    y: axis.y - Math.cos(axis.tilt) * distance
  };
}

function setType(size, weight = 400) {
  const width = Math.max(1, canvas.clientWidth);
  context.font = `${weight} ${Math.max(size / width, 0.008)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
}

function syncCanvas() {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.floor(width * ratio));
  const pixelHeight = Math.max(1, Math.floor(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);
}

function drawField(stage) {
  const gradient = context.createRadialGradient(.48, .38, .03, .5, .52, .85);
  gradient.addColorStop(0, '#33251f');
  gradient.addColorStop(.46, '#1c1512');
  gradient.addColorStop(1, '#0b0b0a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .22;
  context.strokeStyle = '#bd8d73';
  context.lineWidth = .00055;
  for (let index = 0; index < 28; index += 1) {
    const y = .06 + index * .033;
    const drift = Math.sin(index * 1.37 + stage * .19) * .024;
    context.beginPath();
    context.moveTo(.04 + drift, y);
    context.quadraticCurveTo(.48, y + Math.sin(index * .71) * .012, .96 - drift, y + .006);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .28;
  context.fillStyle = '#e3b38d';
  for (let index = 0; index < 46; index += 1) {
    const x = .05 + ((index * 37 + stage * 13) % 890) / 1000;
    const y = .08 + ((index * 71 + stage * 19) % 800) / 1000;
    const radius = .0008 + (index % 3) * .0005;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawAxis(axis, progress) {
  const start = axisPoint(axis, -.34);
  const end = axis.end;
  const control = {
    x: axis.x + axis.wobble * 1.35 + Math.sin(axis.tilt) * .06,
    y: (start.y + end.y) / 2
  };
  context.save();
  context.globalAlpha = .26 + progress * .16;
  context.strokeStyle = '#ecdcc4';
  context.lineWidth = .0011;
  context.setLineDash([.006, .014]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.quadraticCurveTo(control.x, control.y, end.x, end.y);
  context.stroke();
  context.setLineDash([]);

  context.globalAlpha = .48;
  context.fillStyle = '#d47557';
  context.beginPath();
  context.arc(control.x, control.y, .006 + axis.wobble * .035, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawContour(points, style, width, alpha, fill = null) {
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = style;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  trace(points);
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  context.stroke();
  context.restore();
}

function drawDecisionPlanes(frame) {
  const anchorIndices = [2, 6, 10, 14, 18, 22];
  context.save();
  context.strokeStyle = '#d7bda5';
  context.lineWidth = .0008;
  context.globalAlpha = .34;
  anchorIndices.forEach((index, planeIndex) => {
    const point = frame.contour[index];
    const y = .28 + planeIndex * .088;
    const target = { x: frame.axis.x + frame.axis.wobble * Math.sin(planeIndex * 1.4) * .7, y };
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.quadraticCurveTo((point.x + target.x) / 2, y + .02, target.x, target.y);
    context.stroke();
  });
  context.restore();
}

function drawMemory(frame) {
  frame.memory.forEach((hinge, index) => {
    const target = { x: frame.axis.x + frame.axis.wobble * .45, y: .27 + index * .14 };
    context.save();
    context.globalAlpha = .48 + index * .09;
    context.strokeStyle = '#d47557';
    context.lineWidth = .0012;
    context.beginPath();
    context.moveTo(hinge.point.x, hinge.point.y);
    context.quadraticCurveTo((hinge.point.x + target.x) / 2 + hinge.side * .035, target.y, target.x, target.y);
    context.stroke();
    context.beginPath();
    context.arc(hinge.point.x, hinge.point.y, .009 + index * .002, -.7, 4.7);
    context.stroke();
    context.restore();
  });
}

function drawRefusal(frame) {
  if (!frame.refused) return;
  const count = frame.draft.length;
  const segment = frame.draft.slice(0, count);
  context.save();
  context.globalAlpha = .68;
  context.strokeStyle = '#d47557';
  context.lineWidth = .0014;
  context.setLineDash([.008, .012]);
  trace(segment);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = .85;
  context.beginPath();
  context.arc(frame.hinge.point.x, frame.hinge.point.y, .018, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawMarks(frame, state) {
  if (interactivePreview) return;
  context.save();
  context.fillStyle = '#c9b39b';
  setType(11, 500);
  context.fillText('SELF / AXIS STUDY', .052, .065);
  context.fillStyle = '#d47557';
  context.fillText(state === 'sequence' ? `STATE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}` : state.toUpperCase(), .052, .94);
  context.textAlign = 'right';
  context.fillStyle = '#9b8879';
  context.fillText(`${frame.memory.length} HINGE${frame.memory.length === 1 ? '' : 'S'} KEPT`, .948, .94);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawField(frame.stage);
  drawAxis(frame.axis, progress);

  const silhouette = context.createLinearGradient(.18, .12, .82, .88);
  silhouette.addColorStop(0, 'rgba(222, 196, 166, .82)');
  silhouette.addColorStop(.45, 'rgba(195, 155, 126, .52)');
  silhouette.addColorStop(1, 'rgba(92, 65, 53, .2)');
  drawContour(frame.draft, '#d47557', .0012, .28, null);
  drawContour(frame.contour, '#f0dfc6', .0026, .96, silhouette);

  context.save();
  context.globalAlpha = .11;
  context.strokeStyle = '#fff0d7';
  context.lineWidth = .014;
  trace(frame.contour);
  context.stroke();
  context.restore();

  drawDecisionPlanes(frame);
  drawMemory(frame);
  drawRefusal(frame);
  drawMarks(frame, state);

  if (stageReadout) stageReadout.textContent = state === 'visitor-hinge'
    ? 'visitor hinge / paused'
    : state === 'hinge-deleted'
      ? 'latest hinge lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} hinge${frame.memory.length === 1 ? '' : 's'} remembered`;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return { frame: timeline[currentStage], progress: (withinCycle % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-hinge');
    return;
  }
  if (frozen) {
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = frameAt(now);
  render(current.frame, current.progress, 'sequence');
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .08, .92),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .12, .88)
  };
}

function makeHinge(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyHinge(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-hinge');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestHinge(base);
  paused = true;
  render(interactionFrame, 1, 'hinge-deleted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  currentStage = 0;
  started = performance.now();
  paused = false;
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  makeHinge(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeHinge({ x: .72, y: .44 });
});
hingeControl?.addEventListener('click', () => makeHinge({ x: .72, y: .44 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function frame(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) requestAnimationFrame(frame);
