import {
  STAGES,
  applyBraid,
  buildTimeline,
  deleteLatestBraid
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const braidControl = document.querySelector('#braid-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3850;
const colors = {
  ground: '#13111e',
  deep: '#090812',
  mid: '#211d39',
  light: '#40345e',
  ink: '#f1e7d2',
  paper: '#dbbd85',
  coral: '#ff9278',
  mint: '#76dfbf',
  violet: '#c5a6ff',
  blue: '#76a9ff',
  muted: '#a8a1bd'
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
  const wash = context.createRadialGradient(.25, .08, .02, .5, .53, .92);
  wash.addColorStop(0, colors.light);
  wash.addColorStop(.38, colors.mid);
  wash.addColorStop(1, colors.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const dusk = context.createRadialGradient(.81, .82, 0, .81, .82, .72);
  dusk.addColorStop(0, 'rgba(255,146,120,.15)');
  dusk.addColorStop(.42, 'rgba(197,166,255,.06)');
  dusk.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = dusk;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .14;
  context.strokeStyle = colors.paper;
  context.lineWidth = .00055;
  for (let index = 0; index < 31; index += 1) {
    const y = .045 + index * .032;
    const drift = Math.sin(index * 1.37 + stage * .12) * .012;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.27, y - drift, .72, y + drift * .7, .965, y - drift * .24);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 680; index += 1) {
    const x = ((index * 83.17 + stage * 4.5) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 3.2) % 997) / 997;
    context.fillStyle = index % 13 === 0 ? 'rgba(118,223,191,.095)' : 'rgba(219,189,133,.022)';
    context.fillRect(x, y, .001, .001);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(219,189,133,.48)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.082, .045); context.moveTo(.045, .045); context.lineTo(.045, .082);
  context.moveTo(.955, .955); context.lineTo(.918, .955); context.moveTo(.955, .955); context.lineTo(.955, .918);
  context.stroke();
  context.restore();
}

function drawContour(points, counter = false) {
  context.save();
  context.globalAlpha = counter ? .46 : .9;
  context.fillStyle = counter ? 'rgba(118,223,191,.05)' : 'rgba(241,231,210,.038)';
  context.strokeStyle = counter ? colors.mint : colors.ink;
  context.lineWidth = counter ? .00125 : .00245;
  context.lineJoin = 'round';
  if (counter) context.setLineDash([.005, .012]);
  traceClosed(points);
  context.fill();
  context.stroke();
  context.setLineDash([]);
  context.restore();

  context.save();
  context.globalAlpha = counter ? .22 : .15;
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
  context.globalAlpha = counter ? .9 : .97;
  context.fillStyle = counter ? 'rgba(9,8,18,.9)' : 'rgba(4,4,12,.98)';
  context.fill();
  context.strokeStyle = counter ? colors.mint : colors.paper;
  context.lineWidth = counter ? .0017 : .0019;
  context.stroke();
  context.restore();

  context.save();
  context.globalAlpha = counter ? .92 : .65;
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

function drawBraidRoutes(frame) {
  frame.braidRoutes.forEach((route, index) => {
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = .36 + index * .08;
    context.strokeStyle = index % 2 ? colors.violet : colors.coral;
    context.lineWidth = .007 + index * .0003;
    traceOpen(route.trunk);
    context.stroke();

    route.lanes.forEach((lane, laneIndex) => {
      context.globalAlpha = .54 + index * .04;
      context.strokeStyle = laneIndex === 0 ? colors.mint : colors.blue;
      context.lineWidth = .0045 + index * .0002;
      traceOpen(lane);
      context.stroke();
      context.globalAlpha = .17;
      context.lineWidth = .017;
      traceOpen(lane);
      context.stroke();
    });

    context.globalAlpha = .4;
    context.strokeStyle = colors.paper;
    context.lineWidth = .0032;
    traceOpen(route.resolution);
    context.stroke();
    context.restore();

    if (blindMode) return;
    context.save();
    context.globalAlpha = .88;
    context.setLineDash([.006, .009]);
    context.strokeStyle = colors.paper;
    context.lineWidth = .0013 + index * .0001;
    route.lanes.forEach((lane) => { traceOpen(lane); context.stroke(); });
    context.setLineDash([]);
    const crossingColor = route.crossing.kind === 'lane-exchange' ? colors.ink : colors.paper;
    context.fillStyle = colors.coral;
    context.beginPath(); context.arc(route.split.x, route.split.y, .008 + index * .001, 0, Math.PI * 2); context.fill();
    context.fillStyle = crossingColor;
    context.beginPath(); context.arc(route.crossing.x, route.crossing.y, .005, 0, Math.PI * 2); context.fill();
    context.fillStyle = colors.mint;
    context.beginPath(); context.arc(route.merge.x, route.merge.y, .0045, 0, Math.PI * 2); context.fill();
    context.strokeStyle = colors.muted;
    context.lineWidth = .0009;
    [route.entry, route.exit, route.resolutionTarget].forEach((point) => {
      context.beginPath(); context.arc(point.x, point.y, .005, 0, Math.PI * 2); context.stroke();
    });
    context.restore();
  });
}

function drawMarks(frame) {
  if (staticPreview || blindMode) return;
  context.save();
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = 'rgba(241,231,210,.76)';
  context.fillText('SELF / BRAID REGISTER', .045, .065);
  context.fillStyle = colors.coral;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.muted;
  context.fillText(`${frame.memory.length} BRAID${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawContour(frame.contour);
  drawContour(frame.counterContour, true);
  drawAperture(frame.aperture);
  drawAperture(frame.counterAperture, true);
  drawBraidRoutes(frame);
  drawMarks(frame);

  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-braid'
      ? 'braid registered / paused'
      : state === 'braid-returned'
        ? 'latest braid returned'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} braid${frame.memory.length === 1 ? '' : 's'} carried · ${frame.braidRoutes.length} lane exchanges`;
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-braid');
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

function markBraid(point) {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = applyBraid(base, point);
  paused = true;
  render(interactionFrame, 'visitor-braid');
}

function returnLatestBraid() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = deleteLatestBraid(base);
  paused = true;
  render(interactionFrame, 'braid-returned');
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
  link.download = 'mutine-self-portrait-v011.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  markBraid(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    markBraid({ x: .74, y: .42 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') returnLatestBraid();
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
braidControl?.addEventListener('click', () => markBraid({ x: .74, y: .42 }));
undoControl?.addEventListener('click', returnLatestBraid);
releaseControl?.addEventListener('click', releaseSequence);

function animate(now) {
  if (!paused) renderCurrent(now);
  if (!frozen) window.requestAnimationFrame(animate);
}

if ('ResizeObserver' in window) new ResizeObserver(() => renderCurrent()).observe(canvas);
renderCurrent();
if (!frozen) window.requestAnimationFrame(animate);

window.__mutinePortraitV011 = {
  getState: () => {
    const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1));
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      braidRoutes: frame.braidRoutes.length,
      exchange: frame.braidRoutes.reduce((sum, route) => sum + route.exchange, 0),
      interaction: interactionFrame?.interaction ?? null,
      paused
    };
  }
};
