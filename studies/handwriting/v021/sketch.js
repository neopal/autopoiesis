import {
  STAGES,
  buildTimeline,
  armWitness,
  buildFrame,
  commitWitness,
  liftLatestWitness,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3600;
const field = document.querySelector('#listening-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const turnControl = document.querySelector('#turn-toward-control');
const liftControl = document.querySelector('#lift-glance');
const releaseControl = document.querySelector('#release-glances');

const palette = {
  deep: [236, 29, 9],
  band: [228, 34, 14],
  void: [224, 40, 5],
  ink: [42, 28, 94],
  gold: [39, 64, 95],
  coral: [8, 72, 96],
  cyan: [178, 54, 90],
  violet: [258, 38, 72]
};

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let canvasElement = null;
let haloLayer = null;
let grainLayer = null;
let armedAt = 0;
let pointerPosition = { x: 0.5, y: 0.5 };

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pointFromEvent(event) {
  const rect = canvasElement.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / Math.max(1, rect.width)), y: clamp((event.clientY - rect.top) / Math.max(1, rect.height)) };
}

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function updateReadout(frame, state = 'sequence') {
  if (stageReadout) stageReadout.textContent = state === 'witness-committed'
    ? 'glance returned / syntax changed'
    : state === 'witness-lifted'
      ? 'latest glance lifted'
      : state === 'witness-armed'
        ? 'witness armed / departure pending'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} reciprocal glance${frame.memory.length === 1 ? '' : 's'} · ${frame.attentionDebt.toFixed(2)} attention debt`;
  if (interactionState) interactionState.textContent = state === 'witness-committed'
    ? 'The letter has turned; another letter carries the answer.'
    : state === 'witness-lifted'
      ? 'The latest return is gone; the preceding sentence is exact again.'
      : state === 'witness-armed'
        ? 'Nearness is only an invitation. Leave the field to make it answer.'
        : 'The sentence is unobserved.';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.debt = frame.attentionDebt.toFixed(3);
    field.dataset.armed = frame.armedIndex == null ? '' : String(frame.armedIndex);
    field.dataset.interaction = state;
  }
  if (liftControl) liftControl.disabled = !interactionFrame || interactionFrame.memory.length === 0;
  if (turnControl) turnControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
}

function drawAtmosphere(p, width, height, now) {
  p.background(...palette.deep);
  for (let band = 0; band < 22; band += 1) {
    const amount = band / 21;
    const breathing = Math.sin(now * 0.00008 + band * 0.41) * 0.018;
    p.noStroke();
    p.fill(226 + amount * 24, 25 + amount * 24, 7 + amount * 12, 38);
    p.rect(0, amount * height, width, height / 21 + 2);
    p.fill(258, 34, 18, 7);
    p.ellipse(width * (0.2 + amount * 0.64), height * (0.46 + breathing), width * 0.48, height * 0.42);
  }
  if (!grainLayer || grainLayer.width !== width || grainLayer.height !== height) grainLayer = p.createGraphics(width, height);
  grainLayer.clear();
  grainLayer.colorMode(p.HSB, 360, 100, 100, 100);
  grainLayer.noStroke();
  for (let index = 0; index < 170; index += 1) {
    const x = Math.abs((Math.sin(index * 12.9898 + 0.7) * 43758.5453) % 1) * width;
    const y = Math.abs((Math.sin(index * 78.233 + 2.4) * 19341.114) % 1) * height;
    grainLayer.fill(index % 3 === 0 ? palette.gold[0] : palette.cyan[0], 26, 86, 7 + (index % 5));
    grainLayer.circle(x, y, 0.7 + (index % 3) * 0.55);
  }
  p.image(grainLayer, 0, 0);
}

function drawVoid(p, width, height, now, frame) {
  const cx = width * 0.5;
  const cy = height * 0.505;
  const pulse = 1 + Math.sin(now * 0.0012) * (frozen ? 0 : 0.018);
  if (!haloLayer || haloLayer.width !== width || haloLayer.height !== height) haloLayer = p.createGraphics(width, height);
  haloLayer.clear();
  haloLayer.colorMode(p.HSB, 360, 100, 100, 100);
  haloLayer.noStroke();
  haloLayer.fill(palette.violet[0], 36, 34, 18);
  haloLayer.ellipse(cx, cy, width * 0.42 * pulse, height * 0.38 * pulse);
  haloLayer.fill(palette.deep[0], 55, 11, 82);
  haloLayer.ellipse(cx, cy, width * 0.23, height * 0.28);
  p.image(haloLayer, 0, 0);
  p.push();
  p.noFill();
  for (let orbit = 0; orbit < 4; orbit += 1) {
    p.stroke(orbit === 1 ? palette.cyan[0] : palette.gold[0], 22 + orbit * 4, 62 + orbit * 6, 34 - orbit * 4);
    p.strokeWeight(Math.max(0.55, width * (0.0007 + orbit * 0.00015)));
    p.ellipse(cx, cy, width * (0.38 + orbit * 0.085), height * (0.32 + orbit * 0.07));
  }
  p.stroke(palette.ink[0], 18, 82, 34 + frame.memory.length * 4);
  p.strokeWeight(Math.max(0.6, width * 0.0009));
  p.ellipse(cx, cy, width * 0.22, height * 0.27);
  p.pop();
}

function drawReplyBridges(p, frame, width, height) {
  const points = frame.glyphs.map((glyph) => ({ x: glyph.x * width, y: glyph.y * height }));
  p.push();
  frame.glyphs.forEach((glyph, index) => {
    if (glyph.replyTo == null || glyph.replyTo === index) return;
    const other = points[glyph.replyTo];
    if (!other) return;
    p.noFill();
    p.stroke(glyph.role === 'reply' ? palette.cyan[0] : palette.coral[0], 56, 92, 44);
    p.strokeWeight(Math.max(0.7, width * 0.0011));
    p.beginShape();
    p.vertex(points[index].x, points[index].y);
    p.bezierVertex(width * 0.5, height * 0.5, width * 0.5, height * 0.5, other.x, other.y);
    p.endShape();
  });
  p.pop();
}

function drawGlyph(p, glyph, index, width, height) {
  const x = glyph.x * width;
  const y = glyph.y * height;
  const base = Math.min(width, height);
  const size = base * (0.085 + glyph.weight * 0.025);
  const depthLight = clamp((glyph.depth + 1) * 0.5);
  const isArmed = index === currentFrame.armedIndex;
  const hue = glyph.role === 'reply' ? palette.cyan[0] : glyph.role === 'witness' ? palette.coral[0] : palette.gold[0] + depthLight * 8;
  p.push();
  p.translate(x, y);
  p.rotate(glyph.angle);
  p.scale(glyph.scaleX, glyph.scaleY);
  p.textAlign(p.CENTER, p.CENTER);
  p.textFont('Georgia');
  p.textStyle(p.BOLD);
  p.textSize(size);
  p.noStroke();
  p.fill(hue, glyph.role === 'quiet' ? 34 : 70, 92, 94);
  p.text(glyph.char, 0, 0);
  p.noFill();
  p.stroke(hue, 52, 98, glyph.role === 'quiet' ? 18 : 56);
  p.strokeWeight(Math.max(0.55, width * 0.0008));
  p.text(glyph.char, 0, 0);
  if (isArmed) {
    p.stroke(palette.ink[0], 20, 100, 82);
    p.strokeWeight(Math.max(1.2, width * 0.002));
    p.ellipse(0, 0, size * 1.4, size * 1.4);
  }
  p.pop();
}

function drawField(p, frame, now) {
  const width = p.width;
  const height = p.height;
  drawAtmosphere(p, width, height, now);
  drawVoid(p, width, height, now, frame);
  drawReplyBridges(p, frame, width, height);
  frame.glyphs.forEach((glyph, index) => drawGlyph(p, glyph, index, width, height));
  p.push();
  p.noFill();
  p.stroke(palette.ink[0], 16, 85, 22);
  p.strokeWeight(Math.max(0.65, width * 0.00065));
  p.rect(width * 0.025, height * 0.05, width * 0.95, height * 0.9);
  p.pop();
}

function render(p, frame, state = 'sequence', now = performance.now()) {
  drawField(p, frame, now);
  updateReadout(frame, state);
}

function nearestWitness(point, frame) {
  let nearest = { index: 0, distance: Infinity };
  frame.glyphs.forEach((glyph, index) => {
    const current = distance(point, { x: glyph.x, y: glyph.y });
    if (current < nearest.distance) nearest = { index, distance: current };
  });
  return nearest;
}

function redrawCurrent(p) {
  currentFrame = activeFrameAt(performance.now());
  render(p, currentFrame, interactionFrame?.interaction ?? 'sequence');
  p.redraw();
}

function arm(point, p) {
  if (staticPreview) return;
  const nearest = nearestWitness(point, currentFrame);
  if (nearest.distance > 0.13 || nearest.index === currentFrame.armedIndex) return;
  interactionFrame = armWitness(currentFrame, nearest.index);
  currentFrame = interactionFrame;
  armedAt = performance.now();
  pointerPosition = point;
  redrawCurrent(p);
}

function commit(p, witnessIndex = currentFrame.armedIndex ?? 4, direction = pointerPosition.x >= 0.5 ? 1 : -1) {
  if (staticPreview) return false;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  const next = commitWitness(baseline, { witnessIndex, direction, dwell: Math.max(520, performance.now() - armedAt) });
  interactionFrame = next;
  currentFrame = next;
  redrawCurrent(p);
  return true;
}

function lift(p) {
  if (!interactionFrame || interactionFrame.memory.length === 0) return false;
  interactionFrame = liftLatestWitness(interactionFrame);
  currentFrame = interactionFrame;
  redrawCurrent(p);
  return true;
}

function release(p) {
  interactionFrame = null;
  startedAt = performance.now();
  currentFrame = timeline[0];
  redrawCurrent(p);
}

function onPointerMove(event, p) {
  if (staticPreview) return;
  pointerPosition = pointFromEvent(event);
  arm(pointerPosition, p);
  event.preventDefault();
}

function onPointerLeave(event, p) {
  if (staticPreview || currentFrame.armedIndex == null) return;
  const direction = pointerPosition.x >= 0.5 ? 1 : -1;
  commit(p, currentFrame.armedIndex, direction);
  event.preventDefault();
}

function attachInteractions(p) {
  canvasElement = p.canvas;
  canvasElement.addEventListener('pointermove', (event) => onPointerMove(event, p), { passive: false });
  canvasElement.addEventListener('pointerleave', (event) => onPointerLeave(event, p), { passive: false });
  canvasElement.addEventListener('pointerdown', (event) => event.preventDefault(), { passive: false });
  turnControl?.addEventListener('click', () => commit(p));
  liftControl?.addEventListener('click', () => lift(p));
  releaseControl?.addEventListener('click', () => release(p));
  field?.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(p);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift(p);
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      release(p);
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      p.saveCanvas('mutine-handwriting-v021', 'png');
    }
  });
}

window.__mutineHandwritingV021 = {
  getState: () => ({ stage: currentFrame.stage, memory: [...currentFrame.memory], debt: currentFrame.attentionDebt, armedIndex: currentFrame.armedIndex, interaction: currentFrame.interaction || 'sequence', blind: blindMode }),
  armWitness: (index) => { interactionFrame = armWitness(currentFrame, index); currentFrame = interactionFrame; redrawCurrent(window.__mutineHandwritingP5); },
  commitWitness: (index = currentFrame.armedIndex ?? 4, direction = 1, dwell = 760) => { const next = commitWitness(interactionFrame || currentFrame, { witnessIndex: index, direction, dwell }); interactionFrame = next; currentFrame = next; redrawCurrent(window.__mutineHandwritingP5); },
  liftLatest: () => lift(window.__mutineHandwritingP5),
  releaseGlances: () => release(window.__mutineHandwritingP5),
  getSignature: () => geometrySignature(currentFrame),
  getField: () => field,
  getCanvas: () => canvasElement
};

window.__mutineHandwritingP5 = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, field?.clientWidth || 900);
    const height = Math.max(260, field?.clientHeight || 620);
    p.pixelDensity(1);
    p.createCanvas(width, height, p.P2D);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.textFont('Georgia');
    p.noLoop();
    attachInteractions(p);
    window._p5Ready = true;
    render(p, activeFrameAt(), 'sequence');
    const tick = () => {
      if (!frozen && !interactionFrame) p.redraw();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  p.draw = () => {
    currentFrame = activeFrameAt(performance.now());
    render(p, currentFrame, interactionFrame?.interaction ?? 'sequence');
  };
  p.windowResized = () => {
    if (!field) return;
    p.resizeCanvas(Math.max(320, field.clientWidth), Math.max(260, field.clientHeight));
    haloLayer = null;
    grainLayer = null;
    p.redraw();
  };
}, field);
