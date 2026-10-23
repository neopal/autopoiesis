import {
  STAGES,
  BAND_COUNT,
  MEMORY_LIMIT,
  MIN_PRESSURE_MS,
  MAX_PRESSURE_MS,
  buildFrame,
  buildTimeline,
  geometrySignature,
  probe,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;

const stage = document.querySelector('[data-checksum-membrane]');
const canvasMount = document.querySelector('#checksum-canvas');
const actionButtons = [...document.querySelectorAll('[data-action]')];
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const loadReadout = document.querySelector('[data-load]');
const hint = document.querySelector('[data-hint]');
const stateReadout = document.querySelector('[data-interaction-state]');
const timeline = buildTimeline();
const PULSE_MS = 4600;
const PALETTE = {
  void: [7, 10, 16],
  deep: [12, 18, 30],
  paper: [238, 231, 213],
  coral: [228, 131, 108],
  mint: [118, 199, 186],
  gold: [231, 189, 114],
  violet: [156, 169, 221]
};
let sketch;
let canvas;
let currentFrame = timeline[0];
let interactionFrame = null;
let startedAt = performance.now();
let lastSignature = '';
let pointerDown = null;

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (PULSE_MS * timeline.length)) / PULSE_MS)];
}

function fieldSize() {
  const width = Math.max(320, canvasMount.clientWidth || 960);
  const height = Math.max(440, canvasMount.clientHeight || Math.min(780, width * 0.66));
  return { width, height };
}

function colorWithAlpha(p, rgb, alpha) {
  return p.color(rgb[0], rgb[1], rgb[2], alpha);
}

function roleColor(band) {
  if (band.state === 'opened') return PALETTE.coral;
  if (band.state === 'inherited') return PALETTE.mint;
  if (band.state === 'shed') return PALETTE.violet;
  return PALETTE.paper;
}

function drawBand(p, band, width, height, field) {
  const x = field.left + band.x * field.width;
  const centerY = field.top + band.y * field.height;
  const bandWidth = Math.max(18, band.width * field.width);
  const bandHeight = Math.max(100, band.height * field.height);
  const bend = band.bend * field.width * 0.24;
  const tone = roleColor(band);
  const layers = 2 + Math.round(band.density * 2);

  for (let layer = 0; layer < layers; layer += 1) {
    const inset = layer * 2.4;
    const alpha = 18 + band.density * 30 - layer * 6;
    p.fill(colorWithAlpha(p, tone, alpha));
    p.stroke(colorWithAlpha(p, tone, 38 + band.density * 34 - layer * 5));
    p.strokeWeight(layer === 0 ? 1.25 : 0.55);
    p.beginShape();
    for (let step = 0; step <= 8; step += 1) {
      const t = step / 8;
      const y = centerY - bandHeight / 2 + inset + t * (bandHeight - inset * 2);
      const wave = Math.sin(t * Math.PI * 2 + band.phase) * bend * (0.25 + t * 0.75);
      p.vertex(x - bandWidth / 2 + wave + inset, y);
    }
    for (let step = 8; step >= 0; step -= 1) {
      const t = step / 8;
      const y = centerY - bandHeight / 2 + inset + t * (bandHeight - inset * 2);
      const wave = Math.sin(t * Math.PI * 2 + band.phase) * bend * (0.25 + t * 0.75);
      p.vertex(x + bandWidth / 2 + wave - inset, y);
    }
    p.endShape(p.CLOSE);
  }

  const gapHeight = Math.max(7, bandHeight * band.gap);
  const gapY = centerY + Math.sin(band.phase) * bandHeight * 0.14;
  p.noStroke();
  p.fill(colorWithAlpha(p, PALETTE.void, 225));
  p.rect(x - bandWidth * 0.68, gapY - gapHeight / 2, bandWidth * 1.36, gapHeight, 1);

  p.noFill();
  p.stroke(colorWithAlpha(p, tone, 112));
  p.strokeWeight(0.8 + band.density * 0.9);
  p.beginShape();
  for (let step = 0; step <= 10; step += 1) {
    const t = step / 10;
    const y = centerY - bandHeight * 0.36 + t * bandHeight * 0.72;
    const wave = Math.sin(t * Math.PI * 2 + band.phase) * bend * (0.2 + t * 0.8);
    p.vertex(x + wave, y);
  }
  p.endShape();

  if (band.state !== 'quiet') {
    const notch = band.state === 'opened' ? bandWidth * 0.8 : bandWidth * 0.58;
    p.stroke(colorWithAlpha(p, tone, 170));
    p.strokeWeight(1.2);
    p.line(x - notch, gapY, x + notch, gapY + (band.state === 'shed' ? bandHeight * 0.11 : -bandHeight * 0.1));
  }
}

function drawMembrane(p, frame) {
  const { width, height } = fieldSize();
  const field = { left: width * 0.08, top: height * 0.1, width: width * 0.84, height: height * 0.78 };
  p.background(...PALETTE.void);

  for (let y = 0; y < height; y += 4) {
    const blend = y / height;
    const r = Math.round(PALETTE.deep[0] * (1 - blend) + PALETTE.void[0] * blend);
    const g = Math.round(PALETTE.deep[1] * (1 - blend) + PALETTE.void[1] * blend);
    const b = Math.round(PALETTE.deep[2] * (1 - blend) + PALETTE.void[2] * blend);
    p.stroke(r, g, b, 80);
    p.line(0, y, width, y);
  }

  p.push();
  p.translate(width * 0.012, 0);
  p.rotate(-0.018);
  p.noFill();
  p.stroke(colorWithAlpha(p, PALETTE.paper, 25));
  p.strokeWeight(1);
  p.rect(field.left, field.top, field.width, field.height, 3);
  p.stroke(colorWithAlpha(p, PALETTE.mint, 18));
  p.line(field.left, field.top + field.height * 0.5, field.left + field.width, field.top + field.height * 0.5);

  p.stroke(colorWithAlpha(p, PALETTE.gold, 42));
  p.strokeWeight(0.7);
  p.beginShape();
  frame.bands.forEach((band) => p.vertex(field.left + band.x * field.width, field.top + band.y * field.height));
  p.endShape();

  frame.bands.forEach((band) => drawBand(p, band, width, height, field));

  const loadWidth = field.width * frame.load;
  p.noStroke();
  p.fill(colorWithAlpha(p, PALETTE.gold, 105));
  p.rect(field.left, field.top + field.height + 20, loadWidth, 2);
  p.fill(colorWithAlpha(p, PALETTE.paper, 42));
  p.rect(field.left + loadWidth, field.top + field.height + 20, field.width - loadWidth, 2);
  p.pop();
}

function renderReadout(frame) {
  stage.dataset.memory = String(frame.memory.length);
  stage.dataset.stage = String(frame.stage);
  stageReadout.textContent = frame.memory.length ? `revision ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}` : `quiet membrane / ${String(frame.stage).padStart(2, '0')}`;
  memoryReadout.textContent = `${frame.memory.length} revision${frame.memory.length === 1 ? '' : 's'} held`;
  loadReadout.textContent = `load ${String(Math.round(frame.load * 100)).padStart(2, '0')}%`;
  if (frame.interaction === 'committed') hint.textContent = 'the gap moved elsewhere; the membrane remembers pressure';
  else if (frame.interaction === 'lifted') hint.textContent = 'latest probe lifted; the preceding membrane is exact';
  else if (frame.interaction === 'refused') hint.textContent = 'pressure refused; the calibration window remains intact';
  else hint.textContent = 'hold, then release inside the calibration window';
}

function drawFrame(frame) {
  const signature = geometrySignature(frame);
  if (signature !== lastSignature) {
    drawMembrane(sketch, frame);
    lastSignature = signature;
  }
  renderReadout(frame);
}

function updateState(message) {
  if (stateReadout) stateReadout.textContent = message;
}

function setInteraction(next, message) {
  interactionFrame = next;
  currentFrame = next;
  lastSignature = '';
  drawFrame(next);
  updateState(message);
}

function commitProbe(duration = 260, targetIndex = 3) {
  const source = interactionFrame ?? currentFrame;
  const result = probe(source, { duration, targetIndex });
  setInteraction(result.frame, result.accepted
    ? `Pressure revised bands ${result.event.donorIndex + 1}, ${result.event.relayIndex + 1}, and ${result.event.targetIndex + 1}; the probe site stayed local.`
    : 'Pressure refused; only a bounded calibration hold can revise the membrane.');
}

function lift() {
  const next = liftLatest(interactionFrame ?? currentFrame);
  setInteraction(next, next.interaction === 'lifted' ? 'Latest probe lifted; the preceding raster geometry is exact.' : 'Nothing to lift yet.');
}

function release() {
  setInteraction(releaseField(0), 'The checksum released its memory and returned to the quiet seed.');
}

function targetFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(0.999, (event.clientX - rect.left) / rect.width));
  return Math.floor(ratio * BAND_COUNT);
}

function onPointerDown(event) {
  if (event.target.closest('button')) return;
  pointerDown = { pointerId: event.pointerId, at: performance.now(), targetIndex: targetFromEvent(event) };
  stage.focus({ preventScroll: true });
  canvas.setPointerCapture?.(event.pointerId);
}

function onPointerUp(event) {
  if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;
  const duration = performance.now() - pointerDown.at;
  const targetIndex = pointerDown.targetIndex;
  pointerDown = null;
  commitProbe(Math.round(duration), targetIndex);
}

function setupInteraction() {
  canvas = document.querySelector('#checksum-canvas canvas');
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { pointerDown = null; });
  actionButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'probe') commitProbe();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  }));
  stage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitProbe(); }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
    if (event.key.toLowerCase() === 'r' || event.key === 'Escape') { event.preventDefault(); release(); }
  });
}

function resizeCanvas() {
  if (!sketch || !canvasMount.clientWidth) return;
  const { width, height } = fieldSize();
  sketch.resizeCanvas(width, height);
  lastSignature = '';
  drawFrame(currentFrame);
}

sketch = new p5((p) => {
  p.setup = () => {
    const { width, height } = fieldSize();
    canvas = p.createCanvas(width, height).parent(canvasMount).elt;
    p.pixelDensity(1);
    p.frameRate(30);
    p.noSmooth();
    drawFrame(activeFrameAt());
    setupInteraction();
    window.__mutinePortraitV031 = {
      getState: () => ({ frame: currentFrame, geometry: geometrySignature(currentFrame) }),
      probe: (duration = 260, targetIndex = 3) => commitProbe(duration, targetIndex),
      lift,
      release,
      buildFrame,
      geometrySignature,
      minPressure: MIN_PRESSURE_MS,
      maxPressure: MAX_PRESSURE_MS,
      bandCount: BAND_COUNT,
      blindMode
    };
    if (!frozen) p.loop(); else p.noLoop();
  };
  p.draw = () => {
    const next = activeFrameAt();
    if (!interactionFrame && next !== currentFrame) {
      currentFrame = next;
      lastSignature = '';
    }
    drawFrame(next);
  };
  p.windowResized = resizeCanvas;
}, canvasMount);

if (frozen) {
  currentFrame = timeline.at(-1);
}
