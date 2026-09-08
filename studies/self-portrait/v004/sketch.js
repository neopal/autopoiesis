import {
  STAGES,
  applyRefusal,
  buildTimeline,
  deleteLatestRefusal
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const refusalControl = document.querySelector('#refusal-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4800;
const colors = {
  ink: '#f0e2d2',
  bone: '#d3b9a3',
  rust: '#ca735f',
  violet: '#8778a5',
  ground: '#090a10',
  groundMid: '#17121c',
  groundLight: '#2a202e',
  muted: '#8f8085'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function traceClosed(points) {
  if (!points?.length) return;
  const start = midpoint(points.at(-1), points[0]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  points.forEach((point, index) => {
    const middle = midpoint(point, points[(index + 1) % points.length]);
    context.quadraticCurveTo(point.x, point.y, middle.x, middle.y);
  });
  context.closePath();
}

function traceOpen(points) {
  if (!points?.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const middle = midpoint(previous, point);
    context.quadraticCurveTo(previous.x, previous.y, middle.x, middle.y);
    if (index === points.length - 1) context.quadraticCurveTo(point.x, point.y, point.x, point.y);
  }
}

function syncCanvas() {
  const bounds = canvas.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);
}

function drawBackground(stage) {
  const gradient = context.createRadialGradient(.48, .34, .02, .5, .52, .86);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.42, colors.groundMid);
  gradient.addColorStop(1, colors.ground);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const flare = context.createRadialGradient(.27, .68, 0, .27, .68, .56);
  flare.addColorStop(0, 'rgba(202, 115, 95, .13)');
  flare.addColorStop(.38, 'rgba(135, 120, 165, .07)');
  flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = flare;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = colors.violet;
  context.lineWidth = .00055;
  for (let index = 0; index < 24; index += 1) {
    const y = .055 + index * .039;
    const drift = Math.sin(index * 1.47 + stage * .15) * .02;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.quadraticCurveTo(.45, y - drift * .8, .965, y + drift * .32);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 210; index += 1) {
    const x = ((index * 83.17 + stage * 4) % 991) / 991;
    const y = ((index * 157.31 + 29) % 997) / 997;
    context.fillStyle = `rgba(211, 185, 163, ${.01 + (index % 7) * .0025})`;
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();
}

function drawAxis(axis, progress) {
  context.save();
  context.globalAlpha = .23 + progress * .12;
  context.strokeStyle = colors.ink;
  context.lineWidth = .001;
  context.setLineDash([.006, .015]);
  context.beginPath();
  context.moveTo(axis.start.x, axis.start.y);
  context.quadraticCurveTo(axis.x + axis.wobble * 1.8, axis.y, axis.end.x, axis.end.y);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = .31;
  context.strokeStyle = colors.rust;
  context.lineWidth = .00075;
  context.beginPath();
  context.arc(axis.x, axis.y, .018 + axis.wobble * .12, axis.tilt - 1.45, axis.tilt + 1.7);
  context.stroke();
  context.restore();
}

function drawBody(frame, progress) {
  const bodyGradient = context.createLinearGradient(.16, .08, .82, .9);
  bodyGradient.addColorStop(0, 'rgba(240, 226, 210, .9)');
  bodyGradient.addColorStop(.34, 'rgba(211, 185, 163, .62)');
  bodyGradient.addColorStop(.7, 'rgba(135, 120, 165, .33)');
  bodyGradient.addColorStop(1, 'rgba(48, 35, 49, .22)');

  context.save();
  context.globalAlpha = .3;
  context.strokeStyle = colors.rust;
  context.lineWidth = .001;
  context.setLineDash([.007, .014]);
  traceClosed(frame.draft);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = .95;
  context.fillStyle = bodyGradient;
  context.strokeStyle = colors.ink;
  context.lineWidth = .0025;
  context.lineJoin = 'round';
  traceClosed(frame.contour);
  context.fill();
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = .12 + progress * .08;
  context.strokeStyle = colors.ink;
  context.lineWidth = .014;
  traceClosed(frame.contour);
  context.stroke();
  context.restore();
}

function drawForkRibbon(route, emphasis) {
  context.save();
  context.globalAlpha = .12 + emphasis * .1;
  context.fillStyle = emphasis > .7 ? colors.rust : colors.violet;
  context.beginPath();
  context.moveTo(route.left[0].x, route.left[0].y);
  route.left.slice(1).forEach((point) => context.lineTo(point.x, point.y));
  [...route.right].reverse().forEach((point) => context.lineTo(point.x, point.y));
  context.closePath();
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = .38 + emphasis * .52;
  context.strokeStyle = emphasis > .7 ? colors.rust : colors.violet;
  context.lineWidth = .0014 + emphasis * .0018;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  traceOpen(route.left);
  context.stroke();
  traceOpen(route.right);
  context.stroke();
  context.restore();
}

function drawForkedRoutes(frame, progress) {
  frame.forkedRoutes.forEach((route, index) => {
    const emphasis = frame.forkedRoutes.length === 1 ? 1 : (index + 1) / frame.forkedRoutes.length;
    drawForkRibbon(route, emphasis * (.78 + progress * .22));
  });
}

function aperturePath(aperture, scale = 1) {
  context.save();
  context.translate(aperture.x, aperture.y);
  context.rotate(aperture.rotation);
  context.scale(aperture.rx * scale, aperture.ry * scale);
  context.beginPath();
  context.moveTo(-.16, -.96);
  context.bezierCurveTo(.42, -.72, .55, -.12, .18, .2);
  context.bezierCurveTo(.38, .48, .04, .9, -.32, .72);
  context.bezierCurveTo(-.58, .36, -.54, -.5, -.16, -.96);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, progress) {
  const voidGradient = context.createRadialGradient(aperture.x - .018, aperture.y - .03, 0, aperture.x, aperture.y, aperture.ry * 1.3);
  voidGradient.addColorStop(0, '#030408');
  voidGradient.addColorStop(.64, '#0b0810');
  voidGradient.addColorStop(1, 'rgba(9, 10, 16, .8)');

  context.save();
  aperturePath(aperture);
  context.globalAlpha = .99;
  context.fillStyle = voidGradient;
  context.fill();
  context.globalAlpha = .8;
  context.strokeStyle = colors.bone;
  context.lineWidth = .0018;
  context.stroke();
  aperturePath(aperture, .72 + aperture.opening * .1);
  context.globalAlpha = .18 + progress * .08;
  context.strokeStyle = colors.violet;
  context.lineWidth = .001;
  context.stroke();
  context.restore();
}

function drawMemory(frame) {
  if (staticPreview) return;
  if (interactivePreview || !frame.memory.length) return;
  context.save();
  context.globalAlpha = .11;
  context.strokeStyle = colors.bone;
  context.lineWidth = .00065;
  frame.forkedRoutes.forEach((route) => {
    context.beginPath();
    context.moveTo(route.split.x, route.split.y);
    context.lineTo(route.rejoin.x, route.rejoin.y);
    context.stroke();
  });
  context.restore();
}

function drawMarks(frame, state) {
  if (staticPreview || interactivePreview) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(240, 226, 210, .68)';
  context.fillText('SELF / FORKED NEGATIVE', .045, .065);
  context.fillStyle = colors.rust;
  const label = state === 'visitor-refusal' ? 'REFUSAL REGISTERED' : state === 'refusal-lifted' ? 'REFUSAL LIFTED' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.fillText(label, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} REFUSAL${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawAxis(frame.axis, progress);
  drawBody(frame, progress);
  drawForkedRoutes(frame, progress);
  drawAperture(frame.aperture, progress);
  drawMemory(frame);
  drawMarks(frame, state);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-refusal'
      ? 'visitor refusal / paused'
      : state === 'refusal-lifted'
        ? 'latest refusal lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} refusal${frame.memory.length === 1 ? '' : 's'} carried · ${frame.forkedRoutes.length} fork${frame.forkedRoutes.length === 1 ? '' : 's'}`;
  }
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return { frame: timeline[currentStage], progress: (withinCycle % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-refusal');
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
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .16, .84)
  };
}

function makeRefusal(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyRefusal(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-refusal');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestRefusal(base);
  paused = true;
  render(interactionFrame, 1, 'refusal-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  currentStage = 0;
  startedAt = performance.now();
  paused = false;
  renderCurrent();
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-self-portrait-v004.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  makeRefusal(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    makeRefusal({ x: .72, y: .43 });
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
refusalControl?.addEventListener('click', () => makeRefusal({ x: .72, y: .43 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortrait = {
  getState: () => ({
    stage: interactionFrame?.stage ?? currentStage,
    memory: interactionFrame?.memory.length ?? timeline[currentStage]?.memory.length ?? 0,
    forks: interactionFrame?.forkedRoutes.length ?? timeline[currentStage]?.forkedRoutes.length ?? 0,
    interaction: interactionFrame?.interaction ?? null,
    paused
  })
};
