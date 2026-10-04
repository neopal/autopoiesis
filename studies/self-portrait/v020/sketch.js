import {
  STAGES,
  RIB_COUNT,
  buildTimeline,
  defaultCue,
  armPressure,
  commitPressure,
  liftLatestYield,
  releasePressures,
  geometrySignature
} from './engine.mjs';

const canvas = document.querySelector('#yield-field');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressControl = document.querySelector('#press-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 2500;
const HOLD_MS = 620;
const TRAVEL_THRESHOLD = 44;

let startedAt = performance.now();
let currentStage = 0;
let interactionFrame = null;
let lastInteraction = 'sequence';
let pointerPress = null;
let keyPress = null;
let canvasWidth = 1200;
let canvasHeight = 840;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvasWidth = Math.max(1, rect.width);
  canvasHeight = Math.max(1, rect.height);
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvasWidth * density);
  canvas.height = Math.round(canvasHeight * density);
  context.setTransform(density, 0, 0, density, 0, 0);
  renderCurrent();
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return timeline[currentStage];
}

function roundedPath(points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
  context.closePath();
}

function drawPolygon(points, fill, stroke = null, lineWidth = 1) {
  roundedPath(points);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = lineWidth;
    context.stroke();
  }
}

function ribGeometry(rib) {
  const x = canvasWidth * rib.x;
  const y = canvasHeight * rib.y;
  const width = canvasWidth * rib.width;
  const height = canvasHeight * rib.height;
  const skew = canvasWidth * rib.skew * 0.26;
  const lean = canvasWidth * rib.lean * 0.15;
  const depthX = canvasWidth * rib.depth * 0.035;
  const depthY = canvasHeight * rib.depth * 0.04;
  return { x, y, width, height, skew, lean, depthX, depthY };
}

function drawRib(rib, now) {
  const geo = ribGeometry(rib);
  const split = rib.gap > 0 ? Math.min(geo.width * 0.34, geo.width * rib.gap * 0.8) : 0;
  const gapStart = geo.x + geo.width * 0.43 - split / 2;
  const gapEnd = geo.x + geo.width * 0.57 + split / 2;
  const glow = rib.status === 'yielded' ? 'rgba(239, 141, 97, .26)' : rib.status === 'loaded' ? 'rgba(134, 185, 200, .12)' : 'rgba(255,255,255,.04)';

  context.save();
  context.shadowColor = glow;
  context.shadowBlur = rib.status === 'yielded' ? 28 : 12;

  const sections = split ? [
    [geo.x, gapStart],
    [gapEnd, geo.x + geo.width]
  ] : [[geo.x, geo.x + geo.width]];

  sections.forEach(([from, to], sectionIndex) => {
    if (to - from < 3) return;
    const localPhase = sectionIndex ? 1 : 0;
    const topLeft = [from + geo.skew + geo.lean * localPhase, geo.y];
    const topRight = [to + geo.skew + geo.lean * (1 - localPhase), geo.y - geo.height * rib.depth * 0.22];
    const bottomRight = [to - geo.skew * 0.36 + geo.lean * (1 - localPhase), geo.y + geo.height];
    const bottomLeft = [from - geo.skew * 0.36 + geo.lean * localPhase, geo.y + geo.height];

    const side = [[topRight[0], topRight[1]], [bottomRight[0], bottomRight[1]], [bottomRight[0] + geo.depthX, bottomRight[1] + geo.depthY], [topRight[0] + geo.depthX, topRight[1] + geo.depthY]];
    const lower = [[bottomLeft[0], bottomLeft[1]], [bottomRight[0], bottomRight[1]], [bottomRight[0] + geo.depthX, bottomRight[1] + geo.depthY], [bottomLeft[0] + geo.depthX, bottomLeft[1] + geo.depthY]];
    drawPolygon(side, rib.status === 'yielded' ? 'rgba(120, 50, 47, .88)' : 'rgba(20, 42, 53, .9)');
    drawPolygon(lower, rib.status === 'yielded' ? 'rgba(183, 87, 60, .68)' : 'rgba(57, 89, 101, .64)');

    const gradient = context.createLinearGradient(from, geo.y, to, geo.y + geo.height);
    if (rib.status === 'yielded') {
      gradient.addColorStop(0, '#f0a57c');
      gradient.addColorStop(.44, '#b95c4f');
      gradient.addColorStop(1, '#4a2730');
    } else if (rib.status === 'loaded') {
      gradient.addColorStop(0, '#c8e2d1');
      gradient.addColorStop(.38, '#6b9da8');
      gradient.addColorStop(1, '#263c4f');
    } else {
      gradient.addColorStop(0, '#c8bca5');
      gradient.addColorStop(.35, '#718494');
      gradient.addColorStop(1, '#1c2835');
    }
    drawPolygon([topLeft, topRight, bottomRight, bottomLeft], gradient, 'rgba(231, 223, 207, .28)', 1);

    context.save();
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = rib.status === 'yielded' ? .42 : .16;
    context.strokeStyle = rib.status === 'yielded' ? '#ffd0a5' : '#c7e9e0';
    context.lineWidth = 1;
    const grainCount = 5 + (rib.index % 4);
    for (let grain = 0; grain < grainCount; grain += 1) {
      const gx = from + (to - from) * ((grain + 1) / (grainCount + 1));
      const gy = geo.y + geo.height * (.2 + (grain % 3) * .23);
      context.beginPath();
      context.moveTo(gx, gy);
      context.lineTo(gx + geo.depthX * .6, gy + geo.height * (.08 + Math.sin(rib.index + grain) * .025));
      context.stroke();
    }
    context.restore();
  });

  if (rib.gap > 0) {
    context.save();
    context.globalCompositeOperation = 'source-over';
    const voidGradient = context.createLinearGradient(gapStart, geo.y, gapEnd, geo.y + geo.height);
    voidGradient.addColorStop(0, 'rgba(4, 7, 10, .86)');
    voidGradient.addColorStop(.5, 'rgba(239, 141, 97, .12)');
    voidGradient.addColorStop(1, 'rgba(4, 7, 10, .95)');
    drawPolygon([[gapStart, geo.y - 1], [gapEnd, geo.y - 1], [gapEnd + geo.depthX, geo.y + geo.height + geo.depthY], [gapStart + geo.depthX, geo.y + geo.height + geo.depthY]], voidGradient, 'rgba(239, 141, 97, .65)', 1);
    context.restore();
  }

  if (rib.status === 'yielded') {
    context.save();
    context.globalAlpha = .7;
    context.strokeStyle = '#c4e59b';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(geo.x + geo.width * .2, geo.y + geo.height * .28 + Math.sin(now * .001 + rib.index) * 2);
    context.lineTo(geo.x + geo.width * .36, geo.y + geo.height * .7);
    context.stroke();
    context.restore();
  }
  context.restore();
}

function drawBackground(frame, now) {
  context.fillStyle = '#070b10';
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  const halo = context.createRadialGradient(canvasWidth * .42, canvasHeight * .42, 0, canvasWidth * .42, canvasHeight * .42, canvasWidth * .7);
  halo.addColorStop(0, 'rgba(51, 80, 91, .32)');
  halo.addColorStop(.48, 'rgba(20, 35, 45, .16)');
  halo.addColorStop(1, 'rgba(3, 6, 9, .92)');
  context.fillStyle = halo;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = '#89aab0';
  context.lineWidth = 1;
  for (let index = -4; index < 18; index += 1) {
    const x = canvasWidth * (.07 + index * .074) + Math.sin(now * .00012 + index) * 3;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x - canvasHeight * .2, canvasHeight);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .12;
  for (let index = 0; index < 120; index += 1) {
    const x = ((index * 83 + 17) % 997) / 997 * canvasWidth;
    const y = ((index * 47 + frame.stage * 3) % 991) / 991 * canvasHeight;
    context.fillStyle = index % 3 === 0 ? '#ef8d61' : '#c4e59b';
    context.fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
  }
  context.restore();
}

function renderCanvas(frame, now = performance.now()) {
  drawBackground(frame, now);
  const shadow = [[canvasWidth * .12, canvasHeight * .84], [canvasWidth * .28, canvasHeight * .18], [canvasWidth * .82, canvasHeight * .13], [canvasWidth * .91, canvasHeight * .8]];
  drawPolygon(shadow, 'rgba(0, 0, 0, .46)');

  context.save();
  context.translate(Math.sin(now * .00013) * 2, frozen ? 0 : Math.cos(now * .00016) * 1.5);
  [...frame.ribs].sort((a, b) => a.index - b.index).forEach((rib) => drawRib(rib, now));
  context.restore();

  context.save();
  context.globalAlpha = .65;
  context.strokeStyle = '#c4e59b';
  context.lineWidth = 1;
  context.setLineDash([2, 14]);
  context.beginPath();
  context.moveTo(canvasWidth * (.15 + frame.axis * .015), canvasHeight * .12);
  context.lineTo(canvasWidth * (.83 + frame.axis * .01), canvasHeight * .88);
  context.stroke();
  context.restore();
}

function render(frame, interaction = lastInteraction, now = performance.now()) {
  renderCanvas(frame, now);
  if (stageReadout) {
    stageReadout.textContent = interaction === 'yield-committed'
      ? 'yield opened / load redistributed'
      : interaction === 'yield-lifted'
        ? 'latest yield lifted'
        : interaction === 'pointer-tap-refused'
          ? 'short pressure refused / hold longer'
          : interaction === 'pressure-armed'
            ? 'pressure accumulating / release to yield'
            : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} yield${frame.memory.length === 1 ? '' : 's'} held · ${frame.ribs.filter((rib) => rib.gap > 0).length} open`;
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.yields = String(frame.ribs.filter((rib) => rib.gap > 0).length);
  canvas.dataset.interaction = interaction;
  canvas.dataset.signature = geometrySignature(frame);
  lastInteraction = interaction;
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, lastInteraction, now);
    return;
  }
  render(frozen ? timeline.at(-1) : frameAt(now), 'sequence', now);
  if (!frozen) requestAnimationFrame(renderCurrent);
}

function baselineFrame() {
  return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
}

function arm(pressure = 0) {
  interactionFrame = armPressure(baselineFrame(), pressure);
  render(interactionFrame, 'pressure-armed');
}

function commit(pressure = null) {
  const baseline = interactionFrame ?? baselineFrame();
  const cue = pressure == null ? defaultCue(baseline.memory.length) : { pressure };
  interactionFrame = commitPressure(baseline, cue);
  render(interactionFrame, 'yield-committed');
}

function lift() {
  const baseline = interactionFrame ?? baselineFrame();
  if (!baseline.memory.length) return;
  interactionFrame = liftLatestYield(baseline);
  render(interactionFrame, 'yield-lifted');
}

function release() {
  interactionFrame = frozen ? releasePressures(0) : null;
  currentStage = 0;
  startedAt = performance.now();
  lastInteraction = 'sequence';
  renderCurrent();
}

function pointerPressure(event) {
  if (!pointerPress) return 0;
  const duration = performance.now() - pointerPress.startedAt;
  const travel = Math.hypot(event.clientX - pointerPress.x, event.clientY - pointerPress.y);
  return Math.max(0.26, Math.min(1.25, duration / 1050 + travel / 260));
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  pointerPress = { startedAt: performance.now(), x: event.clientX, y: event.clientY };
  arm(0);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointerPress) return;
  const pressure = pointerPressure(event);
  arm(pressure);
});

canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  if (!pointerPress) return;
  const duration = performance.now() - pointerPress.startedAt;
  const travel = Math.hypot(event.clientX - pointerPress.x, event.clientY - pointerPress.y);
  const pressure = pointerPressure(event);
  pointerPress = null;
  if (duration >= HOLD_MS || travel >= TRAVEL_THRESHOLD) commit(pressure);
  else render(baselineFrame(), 'pointer-tap-refused');
});

canvas.addEventListener('pointercancel', () => { pointerPress = null; });

canvas.addEventListener('keydown', (event) => {
  if (event.key === ' ' && !keyPress) {
    event.preventDefault();
    keyPress = performance.now();
    arm(0.35);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    commit(defaultCue(baselineFrame().memory.length).pressure);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

canvas.addEventListener('keyup', (event) => {
  if (event.key !== ' ' || !keyPress) return;
  event.preventDefault();
  const duration = performance.now() - keyPress;
  keyPress = null;
  if (duration >= HOLD_MS) commit(Math.min(1.25, .48 + duration / 1200));
  else render(baselineFrame(), 'pointer-tap-refused');
});

pressControl?.addEventListener('click', () => commit(defaultCue(baselineFrame().memory.length).pressure));
liftControl?.addEventListener('click', lift);
releaseControl?.addEventListener('click', release);
window.addEventListener('resize', resizeCanvas);

window.__mutinePortraitV020 = {
  getState() {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      yields: frame.ribs.filter((rib) => rib.gap > 0).length,
      load: Number(frame.totalLoad.toFixed(4)),
      interaction: lastInteraction,
      signature: geometrySignature(frame)
    };
  },
  getFrame() { return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1); },
  getDiagnostics() { return { seed: '0x53504640', ribs: RIB_COUNT, holdMs: HOLD_MS }; },
  arm,
  commit,
  lift,
  release
};

resizeCanvas();
renderCurrent();
