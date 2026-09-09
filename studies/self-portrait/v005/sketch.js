import {
  STAGES,
  applyDecision,
  buildTimeline,
  deleteLatestDecision
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const decisionControl = document.querySelector('#decision-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4300;
const colors = {
  ground: '#0c1014',
  groundMid: '#152027',
  groundLight: '#23333a',
  ink: '#e8e1d3',
  paper: '#d5cbb8',
  coral: '#ed8066',
  blue: '#69c4c5',
  muted: '#8e9a9c'
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
  const gradient = context.createRadialGradient(.54, .36, .02, .5, .5, .86);
  gradient.addColorStop(0, colors.groundLight);
  gradient.addColorStop(.45, colors.groundMid);
  gradient.addColorStop(1, colors.ground);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  const wash = context.createRadialGradient(.76, .2, 0, .76, .2, .62);
  wash.addColorStop(0, 'rgba(105, 196, 197, .12)');
  wash.addColorStop(.5, 'rgba(237, 128, 102, .035)');
  wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .17;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 19; index += 1) {
    const y = .08 + index * .047;
    const drift = Math.sin(index * 1.31 + stage * .14) * .016;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.quadraticCurveTo(.5, y - drift * .7, .965, y + drift * .32);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 260; index += 1) {
    const x = ((index * 83.17 + stage * 7) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 3) % 997) / 997;
    context.fillStyle = index % 5 === 0 ? 'rgba(105,196,197,.04)' : 'rgba(213,203,184,.018)';
    context.fillRect(x, y, .0012, .0012);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(213,203,184,.34)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.08, .045); context.moveTo(.045, .045); context.lineTo(.045, .08);
  context.moveTo(.955, .955); context.lineTo(.92, .955); context.moveTo(.955, .955); context.lineTo(.955, .92);
  context.stroke();
  context.restore();
}

function drawPlate(points, progress, kind) {
  context.save();
  const isRegistration = kind === 'registration';
  context.globalAlpha = isRegistration ? .25 + progress * .1 : .9;
  context.fillStyle = isRegistration ? 'rgba(105,196,197,.08)' : 'rgba(232,225,211,.08)';
  context.strokeStyle = isRegistration ? colors.blue : colors.ink;
  context.lineWidth = isRegistration ? .00125 : .0023;
  context.lineJoin = 'round';
  if (isRegistration) context.setLineDash([.006, .009]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = isRegistration ? .11 + progress * .07 : .15;
  context.strokeStyle = isRegistration ? colors.blue : colors.coral;
  context.lineWidth = .011;
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
  context.moveTo(-.2, -.98);
  context.bezierCurveTo(.5, -.7, .6, -.06, .18, .25);
  context.bezierCurveTo(.38, .62, -.05, .9, -.38, .64);
  context.bezierCurveTo(-.62, .28, -.56, -.5, -.2, -.98);
  context.closePath();
  context.restore();
}

function drawAperture(aperture, registeredAperture, progress) {
  context.save();
  aperturePath(registeredAperture);
  context.globalAlpha = .86;
  context.fillStyle = 'rgba(4,7,9,.94)';
  context.fill();
  context.strokeStyle = colors.blue;
  context.lineWidth = .0014;
  context.stroke();
  context.restore();

  context.save();
  aperturePath(aperture);
  context.globalAlpha = .96;
  context.fillStyle = 'rgba(5,8,10,.98)';
  context.fill();
  context.strokeStyle = colors.paper;
  context.lineWidth = .0018;
  context.stroke();
  aperturePath(aperture, .73 + progress * .06);
  context.globalAlpha = .18;
  context.strokeStyle = colors.coral;
  context.lineWidth = .001;
  context.stroke();
  context.restore();
}

function drawRegistration(frame, progress) {
  context.save();
  context.globalAlpha = .15 + Math.min(frame.registration.pressure, 5) * .015;
  context.strokeStyle = colors.coral;
  context.lineWidth = .00065;
  context.setLineDash([.003, .012]);
  frame.contacts.forEach((route) => {
    traceOpen(route);
    context.stroke();
  });
  context.setLineDash([]);
  context.restore();

  frame.contacts.forEach((route, index) => {
    context.save();
    const emphasis = (index + 1) / frame.contacts.length;
    context.globalAlpha = .25 + emphasis * (.25 + progress * .18);
    context.strokeStyle = index % 2 ? colors.blue : colors.coral;
    context.lineWidth = .001 + emphasis * .0008;
    context.lineCap = 'round';
    traceOpen(route);
    context.stroke();
    context.restore();
  });

  context.save();
  context.globalAlpha = .2 + progress * .12;
  context.strokeStyle = colors.blue;
  context.lineWidth = .00065;
  context.setLineDash([.008, .016]);
  context.beginPath();
  context.moveTo(frame.registration.pivot.x - .08, frame.registration.pivot.y);
  context.lineTo(frame.registration.pivot.x + .08, frame.registration.pivot.y);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawMarks(frame, state) {
  if (staticPreview) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(232,225,211,.68)';
  context.fillText('SELF / DOUBLE PLATE', .045, .065);
  context.fillStyle = colors.coral;
  const label = state === 'visitor-decision' ? 'DECISION REGISTERED' : state === 'decision-lifted' ? 'LATEST MARK LIFTED' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  context.fillText(label, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} DECISION${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawPlate(frame.contour, progress, 'original');
  drawPlate(frame.registeredContour, progress, 'registration');
  drawRegistration(frame, progress);
  drawAperture(frame.aperture, frame.registeredAperture, progress);
  drawMarks(frame, state);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-decision'
      ? 'visitor decision / paused'
      : state === 'decision-lifted'
        ? 'latest decision lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) {
    memoryReadout.textContent = `${frame.memory.length} decision${frame.memory.length === 1 ? '' : 's'} carried · ${frame.contacts.length} contact bridges`;
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
    render(interactionFrame, 1, interactionFrame.interaction ?? 'visitor-decision');
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

function markDecision(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = applyDecision(base, point);
  paused = true;
  render(interactionFrame, 1, 'visitor-decision');
}

function liftLatest() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestDecision(base);
  paused = true;
  render(interactionFrame, 1, 'decision-lifted');
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
  link.download = 'mutine-self-portrait-v005.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markDecision(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markDecision({ x: .74, y: .41 });
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
decisionControl?.addEventListener('click', () => markDecision({ x: .74, y: .41 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV005 = {
  getState: () => {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      contacts: frame.contacts.length,
      registrationAngle: frame.registration.angle,
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
