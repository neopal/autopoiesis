import {
  STAGES,
  registerAttention,
  buildTimeline,
  liftLatestAttention
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attentionControl = document.querySelector('#attention-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3800;
const colors = {
  ground: '#11101a',
  deep: '#07070d',
  mid: '#201b2b',
  light: '#3b2c42',
  ink: '#f0e9df',
  paper: '#e7c79b',
  coral: '#ff8c74',
  mint: '#83d8c0',
  violet: '#b9a7ff',
  blue: '#81bfe2',
  muted: '#a7a1b6'
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
  const wash = context.createRadialGradient(.79, .03, .02, .48, .55, .95);
  wash.addColorStop(0, colors.light);
  wash.addColorStop(.34, colors.mid);
  wash.addColorStop(1, colors.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const ember = context.createRadialGradient(.19, .77, 0, .19, .77, .72);
  ember.addColorStop(0, 'rgba(255,140,116,.13)');
  ember.addColorStop(.44, 'rgba(185,167,255,.05)');
  ember.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = ember;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 31; index += 1) {
    const y = .035 + index * .032;
    const drift = Math.sin(index * 1.31 + stage * .1) * .012;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.27, y - drift, .71, y + drift * .66, .965, y - drift * .19);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .2;
  context.strokeStyle = colors.violet;
  context.lineWidth = .0006;
  for (let index = 0; index < 8; index += 1) {
    const x = .23 + index * .075 + Math.sin(stage * .1 + index) * .004;
    context.beginPath();
    context.moveTo(x, .12);
    context.bezierCurveTo(x + .025, .34, x - .024, .63, x + Math.sin(index * 1.7) * .032, .88);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 820; index += 1) {
    const x = ((index * 83.17 + stage * 4.1) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 3.1) % 997) / 997;
    context.fillStyle = index % 19 === 0 ? 'rgba(131,216,192,.11)' : 'rgba(231,199,155,.024)';
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(231,199,155,.52)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.082, .045); context.moveTo(.045, .045); context.lineTo(.045, .082);
  context.moveTo(.955, .955); context.lineTo(.918, .955); context.moveTo(.955, .955); context.lineTo(.955, .918);
  context.stroke();
  context.restore();
}

function drawContour(points, counter = false) {
  context.save();
  context.globalAlpha = counter ? .54 : .92;
  context.fillStyle = counter ? 'rgba(131,216,192,.048)' : 'rgba(240,233,223,.034)';
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
  context.globalAlpha = counter ? .2 : .15;
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
  context.fillStyle = counter ? 'rgba(7,7,13,.9)' : 'rgba(4,4,9,.98)';
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
    context.globalAlpha = alpha * .15;
    context.lineWidth = widthValue * 4.7;
    traceOpen(points);
    context.stroke();
    context.globalAlpha = alpha;
    context.lineWidth = widthValue;
  }
  traceOpen(points);
  context.stroke();
  context.restore();
}

function drawAttentionRoutes(frame) {
  frame.attentionRoutes.forEach((route, index) => {
    if (route.attention.kind !== 'attention-fold') return;
    const fade = .38 + index * .1;
    drawRoute(route.approach, colors.coral, .0062 + index * .00025, fade, true);
    drawRoute(route.compression, colors.paper, .0052 + index * .0002, fade + .08, true);
    drawRoute(route.fold, colors.mint, .0076 + index * .00025, .74 + index * .045, true);
    drawRoute(route.release, colors.violet, .0054 + index * .0002, .64 + index * .04, true);
    drawRoute(route.departure, colors.blue, .006 + index * .00025, .58 + index * .05, false);

    if (visualNoFurniture) return;
    context.save();
    context.globalAlpha = .65;
    context.setLineDash([.007, .011]);
    context.strokeStyle = colors.paper;
    context.lineWidth = .0011;
    context.beginPath();
    context.moveTo(route.attention.hingeX, route.attention.hingeY - .14);
    context.lineTo(route.attention.hingeX, route.attention.hingeY + .22);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = colors.coral;
    context.beginPath(); context.arc(route.compression.at(-1).x, route.compression.at(-1).y, .006, 0, Math.PI * 2); context.fill();
    context.fillStyle = colors.mint;
    context.beginPath(); context.arc(route.fold[Math.floor(route.fold.length / 2)].x, route.fold[Math.floor(route.fold.length / 2)].y, .005, 0, Math.PI * 2); context.fill();
    context.fillStyle = colors.paper;
    context.beginPath(); context.arc(route.departure.at(-1).x, route.departure.at(-1).y, .0045, 0, Math.PI * 2); context.fill();
    context.restore();
  });
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(240,233,223,.76)';
  context.fillText('SELF / ATTENTION REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} FOLD${frame.memory.length === 1 ? '' : 'S'} HELD`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawContour(frame.contour);
  drawContour(frame.counterContour, true);
  drawAperture(frame.aperture);
  drawAperture(frame.counterAperture, true);
  drawAttentionRoutes(frame);
  drawMarks(frame);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-attention'
      ? 'attention registered / paused'
      : state === 'attention-lifted'
        ? 'latest fold lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} attention fold${frame.memory.length === 1 ? '' : 's'} held · ${frame.attentionRoutes.length} routes`;
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-attention');
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

function markAttention(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = registerAttention(base, point);
  paused = true;
  render(interactionFrame, 'visitor-attention');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = liftLatestAttention(base);
  paused = true;
  render(interactionFrame, 'attention-lifted');
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
  link.download = 'mutine-self-portrait-v013.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markAttention(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markAttention({ x: .74, y: .42 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') liftLatest();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
attentionControl?.addEventListener('click', () => markAttention({ x: .74, y: .42 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV013 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      attentionRoutes: frame.attentionRoutes.length,
      foldDistance: frame.attentionRoutes.reduce((sum, route) => sum + route.attention.foldDistance, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
