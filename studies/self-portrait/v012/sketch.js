import {
  STAGES,
  applyThreshold,
  buildTimeline,
  deleteLatestThreshold
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const thresholdControl = document.querySelector('#threshold-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3800;
const colors = {
  ground: '#10161c',
  deep: '#080d12',
  mid: '#17242c',
  light: '#2b4650',
  ink: '#e8eee8',
  paper: '#d9bf8b',
  coral: '#f18168',
  mint: '#7de2c0',
  violet: '#a9b7ff',
  blue: '#76b8d7',
  muted: '#9eafb0'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
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
  const wash = context.createRadialGradient(.23, .05, .02, .52, .55, .95);
  wash.addColorStop(0, colors.light);
  wash.addColorStop(.36, colors.mid);
  wash.addColorStop(1, colors.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const ember = context.createRadialGradient(.82, .78, 0, .82, .78, .7);
  ember.addColorStop(0, 'rgba(241,129,104,.14)');
  ember.addColorStop(.42, 'rgba(169,183,255,.055)');
  ember.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = ember;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .13;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 28; index += 1) {
    const y = .04 + index * .034;
    const drift = Math.sin(index * 1.41 + stage * .11) * .012;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.25, y - drift, .72, y + drift * .72, .965, y - drift * .18);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .22;
  context.strokeStyle = colors.mint;
  context.lineWidth = .00065;
  for (let index = 0; index < 7; index += 1) {
    const x = .29 + index * .07 + Math.sin(stage * .12 + index) * .004;
    context.beginPath();
    context.moveTo(x, .17);
    context.lineTo(x + Math.sin(index * 1.7) * .035, .84);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 720; index += 1) {
    const x = ((index * 83.17 + stage * 4.5) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 3.2) % 997) / 997;
    context.fillStyle = index % 17 === 0 ? 'rgba(125,226,192,.095)' : 'rgba(217,191,139,.022)';
    context.fillRect(x, y, .001, .001);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(217,191,139,.48)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.082, .045); context.moveTo(.045, .045); context.lineTo(.045, .082);
  context.moveTo(.955, .955); context.lineTo(.918, .955); context.moveTo(.955, .955); context.lineTo(.955, .918);
  context.stroke();
  context.restore();
}

function drawContour(points, counter = false) {
  context.save();
  context.globalAlpha = counter ? .5 : .92;
  context.fillStyle = counter ? 'rgba(125,226,192,.045)' : 'rgba(232,238,232,.035)';
  context.strokeStyle = counter ? colors.mint : colors.ink;
  context.lineWidth = counter ? .0012 : .0024;
  context.lineJoin = 'round';
  if (counter) context.setLineDash([.005, .012]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = counter ? .2 : .16;
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
  context.bezierCurveTo(-.54, -.84, .5, -.84, 1, 0);
  context.bezierCurveTo(.5, .86, -.5, .86, -1, 0);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, counter = false) {
  context.save();
  aperturePath(aperture);
  context.globalAlpha = counter ? .9 : .98;
  context.fillStyle = counter ? 'rgba(8,13,18,.9)' : 'rgba(4,9,14,.98)';
  context.fill();
  context.strokeStyle = counter ? colors.mint : colors.paper;
  context.lineWidth = counter ? .0017 : .0019;
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = counter ? .92 : .68;
  context.fillStyle = counter ? colors.coral : colors.violet;
  context.beginPath();
  context.ellipse(aperture.pupilX, aperture.pupilY, .0145, .021, aperture.rotation, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = .92;
  context.fillStyle = colors.ink;
  context.beginPath();
  context.ellipse(aperture.pupilX + (counter ? -.003 : .002), aperture.pupilY - .003, .0025, .004, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawRoute(points, color, widthValue, alpha = .7, glow = false) {
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = widthValue;
  if (glow) {
    context.globalAlpha = alpha * .16;
    context.lineWidth = widthValue * 4.8;
    traceOpen(points);
    context.stroke();
    context.globalAlpha = alpha;
    context.lineWidth = widthValue;
  }
  traceOpen(points);
  context.stroke();
  context.restore();
}

function drawThresholdRoutes(frame) {
  frame.thresholdRoutes.forEach((route, index) => {
    if (route.threshold.kind !== 'boundary-crossing') return;
    const fade = .38 + index * .1;
    drawRoute(route.approach, colors.coral, .0062 + index * .00025, fade, true);
    drawRoute(route.boundary, colors.paper, .0042 + index * .00018, fade + .08, false);
    drawRoute(route.crossing, colors.mint, .0072 + index * .00025, .72 + index * .045, true);
    drawRoute(route.interior, colors.violet, .0052 + index * .0002, .62 + index * .04, true);
    drawRoute(route.departure, colors.blue, .006 + index * .00025, .56 + index * .05, false);

    if (blindMode) return;
    context.save();
    context.globalAlpha = .64;
    context.setLineDash([.007, .011]);
    context.strokeStyle = colors.paper;
    context.lineWidth = .0011;
    context.beginPath();
    context.moveTo(route.threshold.x, route.threshold.y - .115);
    context.lineTo(route.threshold.x, route.threshold.y + .19);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = colors.coral;
    context.beginPath(); context.arc(route.approach.at(-1).x, route.approach.at(-1).y, .006, 0, Math.PI * 2); context.fill();
    context.fillStyle = colors.mint;
    context.beginPath(); context.arc(route.crossing[Math.floor(route.crossing.length / 2)].x, route.crossing[Math.floor(route.crossing.length / 2)].y, .005, 0, Math.PI * 2); context.fill();
    context.fillStyle = colors.paper;
    context.beginPath(); context.arc(route.departure.at(-1).x, route.departure.at(-1).y, .0045, 0, Math.PI * 2); context.fill();
    context.restore();
  });
}

function drawMarks(frame) {
  if (staticPreview || blindMode) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(232,238,232,.76)';
  context.fillText('SELF / THRESHOLD REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} THRESHOLD${frame.memory.length === 1 ? '' : 'S'} HELD`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawContour(frame.contour);
  drawContour(frame.counterContour, true);
  drawAperture(frame.aperture);
  drawAperture(frame.counterAperture, true);
  drawThresholdRoutes(frame);
  drawMarks(frame);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-threshold'
      ? 'threshold registered / paused'
      : state === 'threshold-returned'
        ? 'latest threshold returned'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} threshold${frame.memory.length === 1 ? '' : 's'} held · ${frame.thresholdRoutes.length} crossings`;
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-threshold');
    return;
  }
  const frame = frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1);
  if (frozen) {
    render(frame, 'sequence');
    return;
  }
  render(frameAt(now) ?? frame, 'sequence');
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .08, .92),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .16, .84)
  };
}

function markThreshold(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = applyThreshold(base, point);
  paused = true;
  render(interactionFrame, 'visitor-threshold');
}

function returnLatestThreshold() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = deleteLatestThreshold(base);
  paused = true;
  render(interactionFrame, 'threshold-returned');
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
  link.download = 'mutine-self-portrait-v012.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markThreshold(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markThreshold({ x: .74, y: .42 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') returnLatestThreshold();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
thresholdControl?.addEventListener('click', () => markThreshold({ x: .74, y: .42 }));
undoControl?.addEventListener('click', returnLatestThreshold);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV012 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      thresholdRoutes: frame.thresholdRoutes.length,
      crossingDistance: frame.thresholdRoutes.reduce((sum, route) => sum + route.threshold.crossingDistance, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
