// pressure-scar is a material event, not an annotation.
import {
  STAGES,
  buildTimeline,
  buildFrame,
  registerPressure,
  liftLatestPressure,
  geometrySignature
} from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressureControl = document.querySelector('#pressure-control');
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
const STAGE_MS = 3600;

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
const colors = {
  ground: '#0b1015',
  deep: '#05080b',
  membrane: '#d4b47c',
  membraneLight: '#f2e8d2',
  rust: '#ed886c',
  mint: '#7fd1c0',
  violet: '#b29cff',
  blue: '#83bde2',
  muted: '#9aa6ab'
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

function traceClosed(points) {
  if (!points?.length) return;
  const start = midpoint(points.at(-1), points[0]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const middle = midpoint(point, next);
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
  }
  const last = points.at(-1);
  context.lineTo(last.x, last.y);
}

function drawBackground(stage) {
  const wash = context.createRadialGradient(.78, .03, .02, .46, .54, .94);
  wash.addColorStop(0, '#344b55');
  wash.addColorStop(.32, '#1b2931');
  wash.addColorStop(1, colors.deep);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const ember = context.createRadialGradient(.16, .82, 0, .16, .82, .7);
  ember.addColorStop(0, 'rgba(237,136,108,.13)');
  ember.addColorStop(.45, 'rgba(178,156,255,.04)');
  ember.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = ember;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .13;
  context.strokeStyle = colors.membrane;
  context.lineWidth = .00055;
  for (let index = 0; index < 28; index += 1) {
    const y = .06 + index * .033;
    const drift = Math.sin(index * 1.47 + stage * .08) * .012;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.28, y - drift, .7, y + drift * .68, .965, y - drift * .2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 760; index += 1) {
    const x = ((index * 83.17 + stage * 4.1) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 3.1) % 997) / 997;
    context.fillStyle = index % 17 === 0 ? 'rgba(127,209,192,.13)' : 'rgba(212,180,124,.026)';
    context.fillRect(x, y, .0011, .0011);
  }
  context.restore();

  context.save();
  context.strokeStyle = 'rgba(242,232,210,.42)';
  context.lineWidth = .0007;
  context.beginPath();
  context.moveTo(.045, .045); context.lineTo(.082, .045); context.moveTo(.045, .045); context.lineTo(.045, .082);
  context.moveTo(.955, .955); context.lineTo(.918, .955); context.moveTo(.955, .955); context.lineTo(.955, .918);
  context.stroke();
  context.restore();
}

function drawMembrane(frame) {
  const { membrane } = frame;
  context.save();
  context.globalAlpha = .34;
  context.translate(.012, .018);
  context.fillStyle = '#020406';
  traceClosed(membrane.outline);
  context.fill();
  context.restore();

  const fill = context.createLinearGradient(.2, .14, .8, .88);
  fill.addColorStop(0, '#f0d39b');
  fill.addColorStop(.28, colors.membrane);
  fill.addColorStop(.6, '#9e7f5c');
  fill.addColorStop(1, '#473d3a');
  context.save();
  context.globalAlpha = .96;
  context.fillStyle = fill;
  traceClosed(membrane.outline);
  context.fill();
  context.restore();

  context.save();
  traceClosed(membrane.outline);
  context.clip();
  context.globalAlpha = .32;
  membrane.fibers.forEach((fiber, index) => {
    context.strokeStyle = index % 3 === 0 ? colors.mint : index % 3 === 1 ? colors.violet : colors.rust;
    context.lineWidth = index % 3 === 0 ? .0024 : .0012;
    traceOpen(fiber);
    context.stroke();
  });
  membrane.grain.forEach((grain) => {
    context.fillStyle = `rgba(255,239,198,${grain.alpha})`;
    context.fillRect(grain.x, grain.y, grain.size, grain.size);
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.globalAlpha = .92;
  traceClosed(membrane.aperture);
  context.fill();
  frame.scars.forEach((scar) => {
    traceClosed(scar.gap);
    context.fill();
  });
  context.restore();

  context.save();
  context.globalAlpha = .48;
  context.strokeStyle = '#071017';
  context.lineWidth = .003;
  traceClosed(membrane.aperture);
  context.stroke();
  context.restore();

  frame.scars.forEach((scar, index) => {
    context.save();
    context.globalAlpha = .88;
    context.strokeStyle = index % 2 ? colors.mint : colors.rust;
    context.lineWidth = .0022;
    context.lineCap = 'round';
    traceOpen(scar.bankA);
    context.stroke();
    traceOpen(scar.bankB);
    context.stroke();
    context.restore();

    context.save();
    context.globalAlpha = .78;
    context.fillStyle = index % 2 ? '#80b9aa' : '#c77f62';
    context.strokeStyle = colors.membraneLight;
    context.lineWidth = .0012;
    traceClosed(scar.flap);
    context.fill();
    context.stroke();
    context.restore();
  });

  context.save();
  context.globalAlpha = .72;
  context.strokeStyle = colors.membraneLight;
  context.lineWidth = .0021;
  traceClosed(membrane.outline);
  context.stroke();
  context.restore();
}

function drawMarks(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.fillStyle = 'rgba(243,234,216,.82)';
  context.font = '0.013px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('SELF / PRESSURE REGISTER', .045, .065);
  context.fillStyle = colors.rust;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .045, .93);
  context.textAlign = 'right';
  context.fillStyle = colors.mint;
  context.fillText(`${frame.scars.length} SCAR${frame.scars.length === 1 ? '' : 'S'} HELD`, .955, .93);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawMembrane(frame);
  drawMarks(frame);
  if (stageReadout) {
    stageReadout.textContent = state === 'visitor-pressure'
      ? 'pressure registered / paused'
      : state === 'pressure-lifted'
        ? 'latest scar lifted'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.scars.length} scar${frame.scars.length === 1 ? '' : 's'} held · ${frame.membrane.resistance.filter((value) => value > .5).length} resistant sectors`;
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.scars = String(frame.scars.length);
  canvas.dataset.resistantSectors = String(frame.membrane.resistance.filter((value) => value > .5).length);
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
    render(interactionFrame, interactionFrame.interaction ?? 'visitor-pressure');
    return;
  }
  const frame = frozen ? timeline.at(-1) : timeline[currentStage] ?? timeline.at(-1);
  if (frozen) {
    render(frame, 'sequence');
    return;
  }
  render(frame, 'sequence');
  if (!frozen && !paused) {
    requestAnimationFrame(renderCurrent);
  }
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, .14, .86),
    y: clamp((event.clientY - bounds.top) / bounds.height, .16, .84),
    pressure: event.pressure > 0 ? event.pressure : .82
  };
}

function press(point) {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = registerPressure(baseline, point);
  paused = true;
  render(interactionFrame, interactionFrame.interaction);
}

function lift() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  if (!baseline.memory.length) return;
  interactionFrame = liftLatestPressure(baseline);
  render(interactionFrame, interactionFrame.interaction);
}

function release() {
  interactionFrame = null;
  paused = false;
  currentStage = 0;
  startedAt = performance.now();
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  press(pointFromEvent(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    press({ x: .72, y: .34, pressure: .86 });
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});
pressureControl?.addEventListener('click', () => press({ x: .72, y: .34, pressure: .86 }));
undoControl?.addEventListener('click', lift);
releaseControl?.addEventListener('click', release);
window.addEventListener('resize', () => renderCurrent());

window.__mutinePortraitV015 = {
  getState() {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      scars: frame.scars.length,
      resistantSectors: frame.membrane.resistance.filter((value) => value > .5).length,
      signature: geometrySignature(frame),
      interaction: interactionFrame?.interaction ?? 'sequence'
    };
  },
  getFrame() {
    return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  }
};

renderCurrent();
