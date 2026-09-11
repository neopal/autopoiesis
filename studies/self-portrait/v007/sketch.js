import {
  STAGES,
  applyCounterGaze,
  buildTimeline,
  deleteLatestCounterGaze
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const gazeControl = document.querySelector('#gaze-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4100;
const colors = {
  ground: '#0b0d15',
  deep: '#05060b',
  groundMid: '#191726',
  groundLight: '#322840',
  ink: '#f2eadb',
  paper: '#d9c5a1',
  coral: '#ef8e70',
  blue: '#78d0ca',
  violet: '#aa92e7',
  muted: '#9b9aab'
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
  const gradient = context.createRadialGradient(.42, .28, .02, .5, .5, .86);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.45, colors.groundMid);
  gradient.addColorStop(1, colors.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const halo = context.createRadialGradient(.76, .18, 0, .76, .18, .72);
  halo.addColorStop(0, 'rgba(120,208,202,.13)');
  halo.addColorStop(.42, 'rgba(170,146,231,.055)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = halo;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 20; index += 1) {
    const y = .07 + index * .046;
    const drift = Math.sin(index * 1.23 + stage * .13) * .017;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.27, y - drift * .8, .68, y + drift * .7, .965, y - drift * .22);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 320; index += 1) {
    const x = ((index * 83.17 + stage * 6) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 5) % 997) / 997;
    context.fillStyle = index % 7 === 0 ? 'rgba(120,208,202,.05)' : 'rgba(217,197,161,.018)';
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(217,197,161,.34)';
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
  context.globalAlpha = counter ? .3 + progress * .16 : .88;
  context.fillStyle = counter ? 'rgba(120,208,202,.075)' : 'rgba(242,234,219,.055)';
  context.strokeStyle = counter ? colors.blue : colors.ink;
  context.lineWidth = counter ? .00125 : .0025;
  context.lineJoin = 'round';
  if (counter) context.setLineDash([.006, .011]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = counter ? .16 + progress * .09 : .16;
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

function drawEye(eye, kind, progress) {
  const counter = kind === 'counter';
  context.save();
  aperturePath(eye);
  context.globalAlpha = counter ? .9 : .96;
  context.fillStyle = counter ? 'rgba(7,9,16,.9)' : 'rgba(4,5,10,.98)';
  context.fill();
  context.strokeStyle = counter ? colors.blue : colors.paper;
  context.lineWidth = counter ? .0016 : .0019;
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = counter ? .86 : .58;
  context.fillStyle = counter ? colors.coral : colors.violet;
  context.beginPath();
  context.ellipse(eye.pupilX, eye.pupilY, .012 + progress * .002, .019 + progress * .002, eye.rotation, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = .85;
  context.fillStyle = colors.ink;
  context.beginPath();
  context.ellipse(eye.pupilX + (counter ? -.003 : .002), eye.pupilY - .003, .0025, .004, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCounterGaze(frame, progress) {
  frame.gazeRoutes.forEach((route, index) => {
    context.save();
    context.globalAlpha = .18 + ((index + 1) / frame.gazeRoutes.length) * (.2 + progress * .12);
    context.strokeStyle = index % 2 ? colors.violet : colors.coral;
    context.lineWidth = .00085 + index * .00013;
    context.lineCap = 'round';
    traceOpen(route.points);
    context.stroke();
    context.restore();

    context.save();
    context.globalAlpha = .24 + progress * .1;
    context.fillStyle = index % 2 ? colors.violet : colors.coral;
    const target = route.points.at(-1);
    context.beginPath();
    context.arc(target.x, target.y, .004 + index * .001, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });
}

function drawMarks(frame, state) {
  if (staticPreview) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(242,234,219,.72)';
  context.fillText('SELF / COUNTER-GAZE REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  const label = state === 'visitor-counter-gaze' ? 'GAZE REGISTERED' : state === 'gaze-returned' ? 'LATEST GAZE RETURNED' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.fillText(label, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} GAZE${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawCounterGaze(frame, progress);
  drawContour(frame.contour, 'original', progress);
  drawContour(frame.counterContour, 'counter', progress);
  drawEye(frame.aperture, 'original', progress);
  drawEye(frame.counterAperture, 'counter', progress);
  drawMarks(frame, state);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-counter-gaze'
      ? 'visitor gaze / paused'
      : state === 'gaze-returned'
        ? 'latest gaze returned'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} counter-gaze${frame.memory.length === 1 ? '' : 's'} carried · ${frame.gazeRoutes.length} sight routes`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-counter-gaze');
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

function markCounterGaze(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyCounterGaze(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-counter-gaze');
}

function returnLatestGaze() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestCounterGaze(base);
  paused = true;
  render(interactionFrame, 1, 'gaze-returned');
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
  link.download = 'mutine-self-portrait-v007.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markCounterGaze(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markCounterGaze({ x: .74, y: .4 });
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
gazeControl?.addEventListener('click', () => markCounterGaze({ x: .74, y: .4 }));
undoControl?.addEventListener('click', returnLatestGaze);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV007 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      gazeRoutes: frame.gazeRoutes.length,
      counterGazePressure: frame.gazeRoutes.reduce((sum, route) => sum + route.pressure, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
