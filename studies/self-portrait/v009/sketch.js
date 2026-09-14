import {
  STAGES,
  applySeam,
  buildTimeline,
  deleteLatestSeam
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const seamControl = document.querySelector('#seam-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4000;
const colors = {
  ground: '#071217',
  deep: '#03070a',
  groundMid: '#10252a',
  groundLight: '#25444a',
  ink: '#eef0df',
  paper: '#d8c58f',
  coral: '#f18f71',
  mint: '#83d7c2',
  violet: '#bfa6ee',
  muted: '#9aaeb0'
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
  const gradient = context.createRadialGradient(.34, .18, .02, .5, .52, .88);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.44, colors.groundMid);
  gradient.addColorStop(1, colors.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const halo = context.createRadialGradient(.77, .78, 0, .77, .78, .72);
  halo.addColorStop(0, 'rgba(241,143,113,.12)');
  halo.addColorStop(.42, 'rgba(191,166,238,.05)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 23; index += 1) {
    const y = .06 + index * .041;
    const drift = Math.sin(index * 1.37 + stage * .14) * .015;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.25, y - drift * .9, .72, y + drift * .65, .965, y - drift * .24);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 430; index += 1) {
    const x = ((index * 83.17 + stage * 6) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 5) % 997) / 997;
    context.fillStyle = index % 9 === 0 ? 'rgba(131,215,194,.075)' : 'rgba(216,197,143,.018)';
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(216,197,143,.4)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.08, .045); context.moveTo(.045, .045); context.lineTo(.045, .08);
  context.moveTo(.955, .955); context.lineTo(.92, .955); context.moveTo(.955, .955); context.lineTo(.955, .92);
  context.stroke();
  context.restore();
}

function drawContour(points, kind, progress) {
  const counter = kind === 'counter';
  context.save();
  context.globalAlpha = counter ? .42 : .9;
  context.fillStyle = counter ? 'rgba(131,215,194,.055)' : 'rgba(238,240,223,.045)';
  context.strokeStyle = counter ? colors.mint : colors.ink;
  context.lineWidth = counter ? .00125 : .0025;
  context.lineJoin = 'round';
  if (counter) context.setLineDash([.006, .011]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = counter ? .22 : .16;
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
  context.bezierCurveTo(-.5, -.85, .55, -.82, 1, 0);
  context.bezierCurveTo(.48, .86, -.5, .82, -1, 0);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, kind, progress) {
  const counter = kind === 'counter';
  context.save();
  aperturePath(aperture);
  context.globalAlpha = counter ? .92 : .97;
  context.fillStyle = counter ? 'rgba(3,9,12,.92)' : 'rgba(2,5,8,.98)';
  context.fill();
  context.strokeStyle = counter ? colors.mint : colors.paper;
  context.lineWidth = counter ? .0016 : .0019;
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = counter ? .86 : .6;
  context.fillStyle = counter ? colors.coral : colors.violet;
  context.beginPath();
  context.ellipse(aperture.pupilX, aperture.pupilY, .014, .021, aperture.rotation, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = .88;
  context.fillStyle = colors.ink;
  context.beginPath();
  context.ellipse(aperture.pupilX + (counter ? -.003 : .002), aperture.pupilY - .003, .0025, .004, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSeamRoutes(frame, progress) {
  frame.seamRoutes.forEach((route, index) => {
    const strength = .28 + ((index + 1) / frame.seamRoutes.length) * .3;
    context.save();
    context.globalAlpha = strength;
    context.strokeStyle = index % 2 ? colors.violet : colors.coral;
    context.lineWidth = .0032 + index * .0002;
    context.lineCap = 'round';
    traceOpen(route.leftRail);
    context.stroke();
    context.globalAlpha = strength * .82;
    context.strokeStyle = colors.mint;
    context.lineWidth = .0022 + index * .00014;
    traceOpen(route.rightRail);
    context.stroke();
    context.restore();

    if (blindMode) return;

    context.save();
    context.globalAlpha = .82;
    context.strokeStyle = colors.paper;
    context.lineWidth = .0014 + index * .0001;
    context.setLineDash([.006, .008]);
    traceOpen(route.thread);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = index % 2 ? colors.mint : colors.coral;
    context.beginPath();
    context.arc(route.crossing.x, route.crossing.y, .0065 + index * .001, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = .7;
    context.strokeStyle = colors.ink;
    context.lineWidth = .0009;
    context.beginPath();
    context.moveTo(route.entry.x - .012, route.entry.y);
    context.lineTo(route.entry.x + .012, route.entry.y);
    context.moveTo(route.exit.x - .012, route.exit.y);
    context.lineTo(route.exit.x + .012, route.exit.y);
    context.stroke();
    context.restore();
  });
}

function drawMarks(frame, state) {
  if (staticPreview) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(238,240,223,.72)';
  context.fillText('SELF / SEAM REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  const label = `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.fillText(label, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} SEAM${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawContour(frame.contour, 'original', progress);
  drawContour(frame.counterContour, 'counter', progress);
  drawAperture(frame.aperture, 'original', progress);
  drawAperture(frame.counterAperture, 'counter', progress);
  drawSeamRoutes(frame, progress);
  drawMarks(frame, state);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-seam'
      ? 'seam registered / paused'
      : state === 'seam-returned'
        ? 'latest seam returned'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} seam${frame.memory.length === 1 ? '' : 's'} carried · ${frame.seamRoutes.length} interior routes`;
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
  return { frame: timeline[currentStage], progress: (withinCycle % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-seam');
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

function markSeam(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = applySeam(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-seam');
}

function returnLatestSeam() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = deleteLatestSeam(base);
  paused = true;
  render(interactionFrame, 1, 'seam-returned');
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
  link.download = 'mutine-self-portrait-v009.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markSeam(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markSeam({ x: .74, y: .4 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') returnLatestSeam();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
seamControl?.addEventListener('click', () => markSeam({ x: .74, y: .4 }));
undoControl?.addEventListener('click', returnLatestSeam);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV009 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      seamRoutes: frame.seamRoutes.length,
      routeSeparation: frame.seamRoutes.reduce((sum, route) => sum + route.separation, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
