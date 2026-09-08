import {
  STAGES,
  applyAbsence,
  buildTimeline,
  deleteLatestAbsence
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const absenceControl = document.querySelector('#absence-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 5600;
const colors = {
  ink: '#f0e2d2',
  bone: '#d3b9a3',
  rust: '#ca735f',
  violet: '#8778a5',
  violetDim: 'rgba(135, 120, 165, .22)',
  ground: '#090a10',
  groundMid: '#17121c',
  groundLight: '#28202b',
  muted: '#8f8085'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;

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
  const gradient = context.createRadialGradient(.5, .37, .02, .5, .5, .82);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.4, colors.groundMid);
  gradient.addColorStop(1, colors.ground);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const glow = context.createRadialGradient(.29, .64, 0, .29, .64, .55);
  glow.addColorStop(0, 'rgba(202, 115, 95, .12)');
  glow.addColorStop(.38, 'rgba(135, 120, 165, .06)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .18;
  context.strokeStyle = colors.violet;
  context.lineWidth = .00055;
  for (let index = 0; index < 20; index += 1) {
    const y = .08 + index * .043;
    const drift = Math.sin(index * 1.71 + stage * .16) * .018;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.quadraticCurveTo(.5, y - drift * .8, .965, y + drift * .4);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 180; index += 1) {
    const x = ((index * 83.17 + stage * 4) % 991) / 991;
    const y = ((index * 157.31 + 29) % 997) / 997;
    context.fillStyle = `rgba(211, 185, 163, ${.012 + (index % 7) * .003})`;
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();
}

function drawAxis(axis, progress) {
  context.save();
  context.globalAlpha = .24 + progress * .12;
  context.strokeStyle = colors.ink;
  context.lineWidth = .0011;
  context.setLineDash([.006, .015]);
  context.beginPath();
  context.moveTo(axis.start.x, axis.start.y);
  context.quadraticCurveTo(axis.x + axis.wobble * 1.7, axis.y, axis.end.x, axis.end.y);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = .32;
  context.strokeStyle = colors.rust;
  context.lineWidth = .0007;
  context.beginPath();
  context.arc(axis.x, axis.y, .018 + axis.wobble * .12, axis.tilt - 1.5, axis.tilt + 1.6);
  context.stroke();
  context.restore();
}

function aperturePath(aperture, scale = 1) {
  context.save();
  context.translate(aperture.x, aperture.y);
  context.rotate(aperture.rotation);
  context.scale(aperture.rx * scale, aperture.ry * scale);
  context.beginPath();
  context.moveTo(0, -1);
  context.bezierCurveTo(.72, -.62, .82, .52, 0, 1);
  context.bezierCurveTo(-.82, .52, -.72, -.62, 0, -1);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, progress) {
  const voidGradient = context.createRadialGradient(aperture.x - .018, aperture.y - .03, 0, aperture.x, aperture.y, aperture.ry * 1.3);
  voidGradient.addColorStop(0, '#030408');
  voidGradient.addColorStop(.64, '#0b0810');
  voidGradient.addColorStop(1, 'rgba(9, 10, 16, .82)');

  context.save();
  aperturePath(aperture);
  context.globalAlpha = .98;
  context.fillStyle = voidGradient;
  context.fill();
  context.globalAlpha = .82;
  context.strokeStyle = colors.bone;
  context.lineWidth = .0018;
  context.stroke();

  aperturePath(aperture, .72 + aperture.opening * .1);
  context.globalAlpha = .2 + progress * .08;
  context.strokeStyle = colors.violet;
  context.lineWidth = .001;
  context.stroke();
  context.restore();
}

function drawContour(frame, progress) {
  const bodyGradient = context.createLinearGradient(.18, .12, .78, .88);
  bodyGradient.addColorStop(0, 'rgba(240, 226, 210, .88)');
  bodyGradient.addColorStop(.38, 'rgba(211, 185, 163, .58)');
  bodyGradient.addColorStop(.75, 'rgba(135, 120, 165, .35)');
  bodyGradient.addColorStop(1, 'rgba(48, 35, 49, .25)');

  context.save();
  context.globalAlpha = .28;
  context.strokeStyle = colors.rust;
  context.lineWidth = .0011;
  context.setLineDash([.007, .014]);
  traceClosed(frame.draft);
  context.stroke();
  context.setLineDash([]);

  context.globalAlpha = .12;
  context.strokeStyle = colors.ink;
  context.lineWidth = .018;
  traceClosed(frame.contour);
  context.stroke();

  context.globalAlpha = .93;
  context.fillStyle = bodyGradient;
  context.strokeStyle = colors.ink;
  context.lineWidth = .0026;
  context.lineJoin = 'round';
  traceClosed(frame.contour);
  context.fill();
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = .22 + progress * .12;
  context.strokeStyle = colors.violet;
  context.lineWidth = .001;
  for (let index = 0; index < 5; index += 1) {
    const offset = (index - 2) * .032;
    context.beginPath();
    context.moveTo(frame.center.x + offset, .22 + index * .08);
    context.quadraticCurveTo(frame.axis.x + offset * .45, .5, frame.center.x - offset * .7, .78 - index * .05);
    context.stroke();
  }
  context.restore();
}

function drawMemory(frame) {
  if (staticPreview) return;
  if (!frame.memory.length) return;
  const aperture = frame.aperture;
  context.save();
  context.globalAlpha = interactivePreview ? .2 : .1;
  context.strokeStyle = colors.rust;
  context.lineWidth = .0008;
  context.setLineDash([.003, .012]);
  context.beginPath();
  context.arc(aperture.x, aperture.y, aperture.ry * 1.28, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawMarks(frame, state) {
  if (staticPreview) return;
  context.save();
  context.font = `${Math.max(.009, Math.min(.014, .013 * 1.1))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.fillStyle = 'rgba(240, 226, 210, .68)';
  context.fillText('SELF / NEGATIVE FIELD', .045, .065);
  context.fillStyle = colors.rust;
  const label = state === 'visitor-absence' ? 'ABSENCE REGISTERED' : state === 'absence-lifted' ? 'ABSENCE LIFTED' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.fillText(label, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} ABSENCE${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawAxis(frame.axis, progress);
  drawContour(frame, progress);
  drawAperture(frame.aperture, progress);
  drawMemory(frame);
  drawMarks(frame, state);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-absence'
      ? 'visitor absence / paused'
      : state === 'absence-lifted'
        ? 'latest absence lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} absence${frame.memory.length === 1 ? '' : 's'} carried`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-absence');
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

function makeAbsence(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyAbsence(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-absence');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestAbsence(base);
  paused = true;
  render(interactionFrame, 1, 'absence-lifted');
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
  link.download = 'mutine-self-portrait-v003.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  makeAbsence(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    makeAbsence({ x: .72, y: .43 });
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
absenceControl?.addEventListener('click', () => makeAbsence({ x: .72, y: .43 }));
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
    interaction: interactionFrame?.interaction ?? null,
    paused
  })
};
