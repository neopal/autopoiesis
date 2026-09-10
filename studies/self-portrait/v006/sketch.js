import {
  STAGES,
  applyFold,
  buildTimeline,
  deleteLatestFold
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const foldControl = document.querySelector('#fold-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3900;
const colors = {
  ground: '#0d1018',
  deep: '#070912',
  groundMid: '#171b2a',
  groundLight: '#29233d',
  ink: '#f0e8d6',
  paper: '#d8c6a6',
  coral: '#ef8a68',
  blue: '#73c8c4',
  violet: '#9b8de8',
  muted: '#96a0af'
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
  const gradient = context.createRadialGradient(.43, .3, .02, .5, .5, .86);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.46, colors.groundMid);
  gradient.addColorStop(1, colors.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const halo = context.createRadialGradient(.76, .16, 0, .76, .16, .7);
  halo.addColorStop(0, 'rgba(115,200,196,.13)');
  halo.addColorStop(.38, 'rgba(155,141,232,.055)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .14;
  context.strokeStyle = colors.paper;
  context.lineWidth = .0005;
  for (let index = 0; index < 18; index += 1) {
    const y = .08 + index * .049;
    const drift = Math.sin(index * 1.37 + stage * .12) * .018;
    context.beginPath();
    context.moveTo(.04, y + drift);
    context.bezierCurveTo(.28, y - drift * .7, .68, y + drift * .8, .96, y - drift * .22);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 300; index += 1) {
    const x = ((index * 83.17 + stage * 5) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 7) % 997) / 997;
    context.fillStyle = index % 7 === 0 ? 'rgba(115,200,196,.045)' : 'rgba(216,198,166,.018)';
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(216,198,166,.3)';
  context.lineWidth = .00065;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.08, .045); context.moveTo(.045, .045); context.lineTo(.045, .08);
  context.moveTo(.955, .955); context.lineTo(.92, .955); context.moveTo(.955, .955); context.lineTo(.955, .92);
  context.stroke();
  context.restore();
}

function drawContour(points, kind, progress) {
  const folded = kind === 'folded';
  context.save();
  context.globalAlpha = folded ? .23 + progress * .13 : .88;
  context.fillStyle = folded ? 'rgba(115,200,196,.07)' : 'rgba(240,232,214,.06)';
  context.strokeStyle = folded ? colors.blue : colors.ink;
  context.lineWidth = folded ? .0012 : .0024;
  context.lineJoin = 'round';
  if (folded) context.setLineDash([.006, .01]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = folded ? .15 + progress * .08 : .16;
  context.strokeStyle = folded ? colors.violet : colors.coral;
  context.lineWidth = .0095;
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
  context.moveTo(-.18, -.98);
  context.bezierCurveTo(.48, -.72, .62, -.12, .16, .24);
  context.bezierCurveTo(.39, .64, -.02, .93, -.4, .62);
  context.bezierCurveTo(-.63, .24, -.55, -.5, -.18, -.98);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, foldedAperture, progress) {
  context.save();
  aperturePath(foldedAperture);
  context.globalAlpha = .78;
  context.fillStyle = 'rgba(3,5,10,.92)';
  context.fill();
  context.strokeStyle = colors.blue;
  context.lineWidth = .0013;
  context.stroke();
  context.restore();

  context.save();
  aperturePath(aperture);
  context.globalAlpha = .97;
  context.fillStyle = 'rgba(4,6,12,.98)';
  context.fill();
  context.strokeStyle = colors.paper;
  context.lineWidth = .0018;
  context.stroke();
  aperturePath(aperture, .7 + progress * .08);
  context.globalAlpha = .16;
  context.strokeStyle = colors.coral;
  context.lineWidth = .001;
  context.stroke();
  context.restore();
}

function drawFold(frame, progress) {
  if (!frame.folds.length) return;

  frame.foldRoutes.forEach((route, index) => {
    context.save();
    context.globalAlpha = .18 + ((index + 1) / frame.foldRoutes.length) * (.18 + progress * .12);
    context.strokeStyle = index % 2 ? colors.violet : colors.coral;
    context.lineWidth = .0009 + index * .00012;
    context.lineCap = 'round';
    traceOpen(route.points);
    context.stroke();
    context.restore();
  });

  frame.folds.forEach((crease, index) => {
    const tangent = { x: Math.cos(crease.angle), y: Math.sin(crease.angle) };
    context.save();
    context.globalAlpha = .2 + progress * .1;
    context.strokeStyle = index % 2 ? colors.blue : colors.paper;
    context.lineWidth = .00062;
    context.setLineDash([.008, .014]);
    context.beginPath();
    context.moveTo(crease.pivot.x - tangent.x * crease.span, crease.pivot.y - tangent.y * crease.span);
    context.lineTo(crease.pivot.x + tangent.x * crease.span, crease.pivot.y + tangent.y * crease.span);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  });
}

function drawMarks(frame, state) {
  if (staticPreview) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(240,232,214,.7)';
  context.fillText('SELF / FOLD REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  const label = state === 'visitor-fold' ? 'FOLD REGISTERED' : state === 'fold-lifted' ? 'LATEST FOLD LIFTED' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.fillText(label, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} FOLD${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawContour(frame.contour, 'original', progress);
  drawContour(frame.foldedContour, 'folded', progress);
  drawFold(frame, progress);
  drawAperture(frame.aperture, frame.foldedAperture, progress);
  drawMarks(frame, state);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-fold'
      ? 'visitor fold / paused'
      : state === 'fold-lifted'
        ? 'latest fold lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} fold${frame.memory.length === 1 ? '' : 's'} carried · ${frame.foldRoutes.length} crease routes`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-fold');
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

function markFold(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyFold(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-fold');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestFold(base);
  paused = true;
  render(interactionFrame, 1, 'fold-lifted');
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
  link.download = 'mutine-self-portrait-v006.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markFold(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markFold({ x: .74, y: .41 });
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
foldControl?.addEventListener('click', () => markFold({ x: .74, y: .41 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV006 = {
  getState: () => {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      folds: frame.folds.length,
      creaseRoutes: frame.foldRoutes.length,
      foldDepth: frame.folds.reduce((sum, crease) => sum + crease.depth, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
