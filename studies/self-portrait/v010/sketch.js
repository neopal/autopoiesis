import {
  STAGES,
  applyFork,
  buildTimeline,
  deleteLatestFork
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const forkControl = document.querySelector('#fork-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3900;
const colors = {
  ground: '#111326',
  deep: '#070812',
  groundMid: '#1a1e3a',
  groundLight: '#30365b',
  ink: '#f4eddc',
  paper: '#e1c58d',
  coral: '#ff8d74',
  mint: '#77dbc4',
  violet: '#c6adff',
  blue: '#79a8ff',
  muted: '#abb2cc'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

if (interactivePreview) canvas.dataset.interactive = 'true';
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
  const gradient = context.createRadialGradient(.28, .12, .02, .5, .52, .9);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.45, colors.groundMid);
  gradient.addColorStop(1, colors.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const blush = context.createRadialGradient(.79, .77, 0, .79, .77, .7);
  blush.addColorStop(0, 'rgba(255,141,116,.14)');
  blush.addColorStop(.42, 'rgba(198,173,255,.055)');
  blush.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = blush;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 27; index += 1) {
    const y = .055 + index * .036;
    const drift = Math.sin(index * 1.21 + stage * .13) * .014;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.26, y - drift * .75, .7, y + drift * .55, .965, y - drift * .2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 520; index += 1) {
    const x = ((index * 83.17 + stage * 5) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 4) % 997) / 997;
    context.fillStyle = index % 11 === 0 ? 'rgba(119,219,196,.08)' : 'rgba(225,197,141,.02)';
    context.fillRect(x, y, .00105, .00105);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(225,197,141,.45)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.08, .045); context.moveTo(.045, .045); context.lineTo(.045, .08);
  context.moveTo(.955, .955); context.lineTo(.92, .955); context.moveTo(.955, .955); context.lineTo(.955, .92);
  context.stroke();
  context.restore();
}

function drawContour(points, kind) {
  const counter = kind === 'counter';
  context.save();
  context.globalAlpha = counter ? .46 : .91;
  context.fillStyle = counter ? 'rgba(119,219,196,.052)' : 'rgba(244,237,220,.042)';
  context.strokeStyle = counter ? colors.mint : colors.ink;
  context.lineWidth = counter ? .0013 : .0025;
  context.lineJoin = 'round';
  if (counter) context.setLineDash([.005, .012]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = counter ? .25 : .15;
  context.strokeStyle = counter ? colors.violet : colors.coral;
  context.lineWidth = .009;
  traceClosed(points);
  context.stroke();
  context.restore();
}

function aperturePath(aperture, scale = 1) {
  context.save();
  context.translate(aperture.x, aperture.y);
  context.rotate(aperture.rotation);
  context.scale(aperture.rx * scale, aperture.ry * scale);
  context.beginPath();
  context.moveTo(-1, 0);
  context.bezierCurveTo(-.52, -.84, .52, -.84, 1, 0);
  context.bezierCurveTo(.5, .86, -.5, .86, -1, 0);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, kind) {
  const counter = kind === 'counter';
  context.save();
  aperturePath(aperture);
  context.globalAlpha = counter ? .92 : .97;
  context.fillStyle = counter ? 'rgba(7,8,18,.93)' : 'rgba(4,5,12,.98)';
  context.fill();
  context.strokeStyle = counter ? colors.mint : colors.paper;
  context.lineWidth = counter ? .0017 : .0019;
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = counter ? .9 : .6;
  context.fillStyle = counter ? colors.coral : colors.violet;
  context.beginPath();
  context.ellipse(aperture.pupilX, aperture.pupilY, .014, .021, aperture.rotation, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = .9;
  context.fillStyle = colors.ink;
  context.beginPath();
  context.ellipse(aperture.pupilX + (counter ? -.003 : .002), aperture.pupilY - .003, .0025, .004, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawForkRoutes(frame) {
  frame.forkRoutes.forEach((route, index) => {
    context.save();
    context.globalAlpha = .28 + ((index + 1) / frame.forkRoutes.length) * .25;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = index % 2 ? colors.violet : colors.coral;
    context.lineWidth = .006 + index * .00025;
    traceOpen(route.trunk);
    context.stroke();
    context.globalAlpha = .48 + ((index + 1) / frame.forkRoutes.length) * .17;
    context.strokeStyle = index % 2 ? colors.blue : colors.mint;
    context.lineWidth = .0042 + index * .00018;
    route.branches.forEach((branch) => {
      traceOpen(branch);
      context.stroke();
    });
    context.globalAlpha = .32;
    context.strokeStyle = colors.paper;
    context.lineWidth = .003;
    traceOpen(route.resolution);
    context.stroke();
    context.restore();

    if (blindMode) return;

    context.save();
    context.globalAlpha = .88;
    context.setLineDash([.006, .009]);
    context.strokeStyle = colors.paper;
    context.lineWidth = .0013 + index * .0001;
    route.branches.forEach((branch) => {
      traceOpen(branch);
      context.stroke();
    });
    context.setLineDash([]);
    context.fillStyle = index % 2 ? colors.violet : colors.coral;
    context.beginPath();
    context.arc(route.split.x, route.split.y, .008 + index * .001, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = colors.ink;
    context.beginPath();
    context.arc(route.merge.x, route.merge.y, .0045, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = colors.muted;
    context.lineWidth = .0009;
    [route.leftAnchor, route.rightAnchor, route.resolutionTarget].forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, .005, 0, Math.PI * 2);
      context.stroke();
    });
    context.restore();
  });
}

function drawMarks(frame) {
  if (staticPreview || blindMode) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(244,237,220,.74)';
  context.fillText('SELF / FORK REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} FORK${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawContour(frame.contour, 'original');
  drawContour(frame.counterContour, 'counter');
  drawAperture(frame.aperture, 'original');
  drawAperture(frame.counterAperture, 'counter');
  drawForkRoutes(frame);
  drawMarks(frame);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-fork'
      ? 'fork registered / paused'
      : state === 'fork-returned'
        ? 'latest fork returned'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} fork${frame.memory.length === 1 ? '' : 's'} carried · ${frame.forkRoutes.length} branching routes`;
  }
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.interaction = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-fork');
    return;
  }
  const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
  if (frozen) {
    render(frame, 'sequence');
    return;
  }
  render(frameAt(now), 'sequence');
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .08, .92),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .16, .84)
  };
}

function markFork(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = applyFork(base, point);
  paused = true;
  render(interactionFrame, 'visitor-fork');
}

function returnLatestFork() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = deleteLatestFork(base);
  paused = true;
  render(interactionFrame, 'fork-returned');
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
  link.download = 'mutine-self-portrait-v010.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markFork(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markFork({ x: .74, y: .4 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') returnLatestFork();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
forkControl?.addEventListener('click', () => markFork({ x: .74, y: .4 }));
undoControl?.addEventListener('click', returnLatestFork);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV010 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      forkRoutes: frame.forkRoutes.length,
      branchSeparation: frame.forkRoutes.reduce((sum, route) => sum + route.branchSeparation, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
