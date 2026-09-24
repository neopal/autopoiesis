import {
  STAGES,
  buildTimeline,
  buildFrame,
  registerDeparture,
  liftLatestDeparture
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const witnessControl = document.querySelector('#witness-control');
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
const STAGE_MS = 5200;
const colors = {
  ground: '#120f0d',
  deep: '#070706',
  skin: '#c66543',
  skinLight: '#e2a36c',
  clay: '#873b35',
  blue: '#7ba9af',
  chalk: '#f0e6d4',
  shadow: '#020201',
  hole: '#080605'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let interactionFrame = null;
let armedPoint = null;
let pointerInside = false;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
};

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

function drawBackground(frame) {
  const gradient = context.createRadialGradient(.18, .03, .02, .52, .5, 1.04);
  gradient.addColorStop(0, '#5a3323');
  gradient.addColorStop(.32, '#281914');
  gradient.addColorStop(1, colors.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .15;
  context.strokeStyle = colors.blue;
  context.lineWidth = .00055;
  for (let index = 0; index < 19; index += 1) {
    const y = .1 + index * .047;
    context.beginPath();
    context.moveTo(.04, y + Math.sin(index * .8 + frame.stage * .02) * .018);
    context.bezierCurveTo(.32, y - .04, .67, y + .05, .96, y - .012);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 720; index += 1) {
    const x = ((index * 83.17 + frame.stage * 4.4) % 997) / 997;
    const y = ((index * 157.31 + 23 + frame.stage * 2.1) % 991) / 991;
    context.fillStyle = index % 23 === 0 ? rgba(colors.skinLight, .16) : rgba(colors.chalk, .023);
    context.fillRect(x, y, .00115, .00115);
  }
  context.restore();
}

function surfacePath(surface, inset = 0) {
  context.beginPath();
  surface.forEach((point, index) => {
    const x = clamp(point.x + (point.x - .5) * inset, .02, .98);
    const y = clamp(point.y + (point.y - .5) * inset, .04, .96);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function drawFold(fold, frame) {
  const direction = fold.turn >= 0 ? 1 : -1;
  const x = fold.x;
  const y = fold.y;
  const span = fold.span;
  const depth = fold.depth;
  context.save();
  context.shadowColor = rgba(colors.shadow, .82);
  context.shadowBlur = .024 + depth * .045;
  context.shadowOffsetX = direction * .014;
  context.shadowOffsetY = -.01;
  context.beginPath();
  context.moveTo(x - span * .54, y + .018);
  context.bezierCurveTo(x - span * .24, y - depth * .7, x + span * .21, y - depth, x + span * .56, y - depth * .25);
  context.lineTo(x + span * .48, y + .018);
  context.bezierCurveTo(x + span * .15, y + depth * .5, x - span * .22, y + depth * .46, x - span * .54, y + .018);
  context.closePath();
  const foldGradient = context.createLinearGradient(x - span, y, x + span, y - depth);
  foldGradient.addColorStop(0, rgba(colors.clay, .48 + fold.load * .18));
  foldGradient.addColorStop(.52, rgba(colors.blue, .32 + fold.load * .23));
  foldGradient.addColorStop(1, rgba(colors.skinLight, .58));
  context.fillStyle = foldGradient;
  context.fill();
  context.strokeStyle = rgba(colors.chalk, .18 + fold.crease * .22);
  context.lineWidth = .0011 + fold.crease * .001;
  context.stroke();

  context.globalAlpha = .23 + fold.load * .18;
  context.strokeStyle = colors.chalk;
  context.lineWidth = .0007;
  for (let index = 0; index < 10; index += 1) {
    const offset = (index / 9 - .5) * span;
    context.beginPath();
    context.moveTo(x + offset - span * .18, y - .004);
    context.quadraticCurveTo(x + offset, y - depth * (.6 + (index % 3) * .14), x + offset + span * .17, y - depth * .24);
    context.stroke();
  }
  context.restore();
}

function drawMembrane(frame) {
  const surface = frame.surface;
  context.save();
  context.shadowColor = rgba(colors.shadow, .72);
  context.shadowBlur = .025 + frame.fold.load * .03;
  context.shadowOffsetY = .018;
  surfacePath(surface);
  const fill = context.createLinearGradient(.12, .2, .88, .82);
  fill.addColorStop(0, rgba(colors.skinLight, .74));
  fill.addColorStop(.32, rgba(colors.skin, .9));
  fill.addColorStop(.7, rgba(colors.clay, .84));
  fill.addColorStop(1, rgba(colors.blue, .42));
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = rgba(colors.chalk, .38);
  context.lineWidth = .0014;
  context.stroke();
  context.restore();

  context.save();
  surfacePath(surface, -.015);
  context.clip();
  for (let index = 0; index < 25; index += 1) {
    const y = .28 + index * .021;
    context.globalAlpha = .08 + ((index * 7) % 5) * .018;
    context.strokeStyle = index % 4 === 0 ? colors.chalk : index % 3 === 0 ? colors.blue : colors.clay;
    context.lineWidth = .00055 + (index % 3) * .00018;
    context.beginPath();
    context.moveTo(.04, y + Math.sin(index * 1.17 + frame.stage * .1) * .018);
    context.bezierCurveTo(.29, y - .026, .58, y + .028, .96, y - .012);
    context.stroke();
  }
  context.restore();

  context.save();
  context.beginPath();
  surfacePath(surface);
  frame.apertures.forEach((aperture) => {
    context.save();
    context.translate(aperture.x, aperture.y);
    context.rotate(aperture.rotation);
    context.ellipse(0, 0, aperture.rx, aperture.ry, 0, 0, Math.PI * 2);
    context.restore();
  });
  context.fillStyle = colors.hole;
  context.globalCompositeOperation = 'destination-out';
  context.fill();
  context.restore();

  context.save();
  frame.apertures.forEach((aperture, index) => {
    context.save();
    context.translate(aperture.x, aperture.y);
    context.rotate(aperture.rotation);
    context.strokeStyle = rgba(index % 2 ? colors.blue : colors.skinLight, .34 + aperture.depth * .5);
    context.lineWidth = .0012 + aperture.depth * .002;
    context.beginPath();
    context.ellipse(0, 0, aperture.rx * 1.04, aperture.ry * 1.04, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
  context.restore();

  drawFold(frame.fold, frame);
}

function drawDraft() {
  if (!armedPoint || visualNoFurniture) return;
  context.save();
  context.strokeStyle = rgba(colors.chalk, .72);
  context.lineWidth = .0012;
  context.setLineDash([.006, .009]);
  context.beginPath();
  context.arc(armedPoint.x, armedPoint.y, .022, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = colors.chalk;
  context.globalAlpha = .7;
  context.beginPath();
  context.arc(armedPoint.x, armedPoint.y, .0034, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.font = '0.012px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillStyle = rgba(colors.chalk, .74);
  context.fillText('MATERIAL / DEPARTURE FOLD', .06, .065);
  context.fillStyle = colors.skinLight;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .06, .952);
  context.textAlign = 'right';
  context.fillStyle = colors.blue;
  context.fillText(`${frame.memory.length} DEPARTURE${frame.memory.length === 1 ? '' : 'S'} CARRIED`, .94, .952);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame);
  drawMembrane(frame);
  drawDraft();
  drawMarks(frame);
  if (stageReadout) stageReadout.textContent = state === 'visitor-departure-fold'
    ? 'departure registered / the back has risen'
    : state === 'departure-lifted'
      ? 'latest departure lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} departure${frame.memory.length === 1 ? '' : 's'} carried · ${frame.apertures.length} aperture${frame.apertures.length === 1 ? '' : 's'}`;
  if (interactionState) interactionState.textContent = state === 'visitor-departure-fold'
    ? 'The visitor left; the front opened and the back answered.'
    : state === 'departure-lifted'
      ? 'The latest absence is gone; the prior skin is exact.'
      : pointerInside
        ? 'The skin is holding the witness.'
        : 'The skin is facing forward.';
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.apertures = String(frame.apertures.length);
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-departure-fold');
    return;
  }
  if (frozen) {
    render(timeline.at(-1), 'sequence');
    return;
  }
  render(frameAt(now), 'sequence');
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), .1, .9),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), .15, .85)
  };
}

function commitDeparture(point = armedPoint || { x: .5, y: .5 }) {
  const baseline = interactionFrame || frameAt(performance.now());
  interactionFrame = registerDeparture(baseline, point);
  armedPoint = null;
  renderCurrent();
}

function liftLatest() {
  if (!interactionFrame) return;
  interactionFrame = liftLatestDeparture(interactionFrame);
  renderCurrent();
}

function releaseSequence() {
  interactionFrame = null;
  armedPoint = null;
  startedAt = performance.now();
  renderCurrent();
}

canvas.addEventListener('pointerenter', (event) => {
  pointerInside = true;
  if (!staticPreview) armedPoint = pointFromEvent(event);
  renderCurrent();
});
canvas.addEventListener('pointermove', (event) => {
  if (staticPreview) return;
  armedPoint = pointFromEvent(event);
  renderCurrent();
});
canvas.addEventListener('pointerleave', () => {
  pointerInside = false;
  if (armedPoint && !staticPreview) commitDeparture(armedPoint);
  else renderCurrent();
});
canvas.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  canvas.focus();
  armedPoint = pointFromEvent(event);
  event.preventDefault();
  renderCurrent();
});

witnessControl?.addEventListener('click', () => commitDeparture(armedPoint || { x: .5, y: .5 }));
undoControl?.addEventListener('click', liftLatest);
releaseControl?.addEventListener('click', releaseSequence);

canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeparture(armedPoint || { x: .5, y: .5 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    const link = document.createElement('a');
    link.download = 'mutine-brush-v018.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
});

window.addEventListener('resize', () => renderCurrent());

function tick(now) {
  renderCurrent(now);
  if (!frozen && !interactionFrame) requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
