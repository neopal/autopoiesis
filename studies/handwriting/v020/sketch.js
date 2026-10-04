import {
  STAGES,
  buildFrame,
  buildTimeline,
  applyPressureStroke,
  liftLatestStroke,
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

const field = document.querySelector('#pressure-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const pressControl = document.querySelector('#press-type-control');
const liftControl = document.querySelector('#lift-stroke');
const releaseControl = document.querySelector('#release-strokes');

const palette = {
  deep: [236, 22, 8],
  ground: [232, 26, 11],
  paper: [38, 18, 92],
  warm: [28, 48, 91],
  coral: [8, 66, 93],
  gold: [38, 54, 90],
  cyan: [177, 42, 82]
};

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let canvasElement = null;
let pressed = false;
let pressStartedAt = 0;
let pressPath = [];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function pointFromEvent(event) {
  const rect = canvasElement.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp((event.clientY - rect.top) / Math.max(1, rect.height))
  };
}

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function updateReadout(frame, state = 'sequence') {
  const stage = String(frame.stage + 1).padStart(2, '0');
  if (stageReadout) {
    stageReadout.textContent = state === 'pressure-committed'
      ? 'pressure committed / slab changed'
      : state === 'pressure-lifted'
        ? 'latest stroke lifted'
        : state === 'pressure-refused'
          ? 'tap refused / no stroke'
          : `stage ${stage} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure stroke${frame.memory.length === 1 ? '' : 's'} · ${frame.materialResistance.toFixed(2)} resistance`;
  if (interactionState) {
    interactionState.textContent = state === 'pressure-committed'
      ? 'The stroke has changed the letters; the next stroke will meet their resistance.'
      : state === 'pressure-lifted'
        ? 'The latest stroke is gone; the preceding typographic geometry is exact again.'
        : state === 'pressure-refused'
          ? 'A tap is not pressure. The sentence did not move.'
          : 'The type is dry and uncommitted.';
  }
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.resistance = frame.materialResistance.toFixed(3);
    field.dataset.interaction = state;
  }
  if (liftControl) liftControl.disabled = !interactionFrame || interactionFrame.memory.length === 0;
  if (pressControl) pressControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
}

function drawAtmosphere(p, width, height, now) {
  p.background(...palette.deep);
  for (let band = 0; band < 18; band += 1) {
    const amount = band / 17;
    const drift = Math.sin(now * 0.00008 + band * 0.7) * 0.04;
    p.noStroke();
    p.fill(230 + amount * 18, 22 + amount * 20, 7 + amount * 9, 55);
    p.rect(0, amount * height, width, height / 18 + 2);
    p.fill(348, 34, 18, 8);
    p.ellipse(width * (0.78 + drift), height * (0.12 + amount * 0.08), width * 0.36, height * 0.3);
  }
  p.push();
  p.noFill();
  for (let contour = 0; contour < 18; contour += 1) {
    const offset = contour / 18;
    p.stroke(35 + contour * 2, 28, 34, 22);
    p.strokeWeight(Math.max(0.5, width * 0.00045));
    p.beginShape();
    for (let step = 0; step <= 42; step += 1) {
      const x = (step / 42) * width;
      const y = height * (0.08 + offset * 0.84) + Math.sin(step * 0.42 + contour * 0.8 + now * 0.00007) * height * 0.018;
      p.vertex(x, y);
    }
    p.endShape();
  }
  p.pop();
}

function drawPlate(p, width, height, frame) {
  p.push();
  p.translate(width * 0.03, height * 0.07);
  p.noStroke();
  p.fill(225, 24, 10, 62);
  p.beginShape();
  p.vertex(0, height * 0.03);
  p.vertex(width * 0.88, 0);
  p.vertex(width * 0.97, height * 0.12);
  p.vertex(width * 0.94, height * 0.88);
  p.vertex(width * 0.08, height * 0.93);
  p.vertex(0, height * 0.8);
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(38, 38, 80, 26);
  p.strokeWeight(Math.max(0.6, width * 0.001));
  p.beginShape();
  p.vertex(width * 0.02, height * 0.11);
  p.vertex(width * 0.87, height * 0.08);
  p.vertex(width * 0.91, height * 0.82);
  p.vertex(width * 0.1, height * 0.87);
  p.endShape();
  p.pop();

  p.push();
  p.noFill();
  frame.memory.forEach((stroke, index) => {
    const opacity = 24 + index * 9;
    p.stroke(index % 2 ? 177 : 8, index % 2 ? 42 : 58, 75, opacity);
    p.strokeWeight(Math.max(0.7, width * (0.001 + index * 0.0002)));
    p.beginShape();
    stroke.points.forEach((point, pointIndex) => {
      const bend = Math.sin(pointIndex * 1.8 + index) * height * 0.008;
      p.vertex(point.x * width, point.y * height + bend);
    });
    p.endShape();
  });
  p.pop();
}

function drawGlyph(p, glyph, width, height) {
  const size = glyph.size * Math.min(width, height) * 1.35;
  const x = glyph.x * width;
  const y = glyph.y * height;
  const hue = glyph.pressure > 0.08 ? 8 + glyph.pressure * 18 : 38 + glyph.grain * 8;
  const saturation = glyph.pressure > 0.08 ? 68 : 28 + glyph.grain * 22;
  const brightness = glyph.pressure > 0.08 ? 96 : 91;
  p.push();
  p.translate(x, y);
  p.rotate(glyph.angle);
  p.scale(glyph.scaleX, glyph.scaleY);
  p.textAlign(p.CENTER, p.CENTER);
  p.textFont('Georgia');
  p.textStyle(p.BOLD);
  p.textSize(size);
  p.noStroke();
  p.fill(hue, saturation, brightness, 96);
  p.text(glyph.char, 0, 0);
  if (glyph.pressure > 0.14) {
    p.noFill();
    p.stroke(38, 54, 92, 30 + glyph.pressure * 34);
    p.strokeWeight(Math.max(0.5, width * 0.00065));
    p.text(glyph.char, glyph.pressure * 2.2, -glyph.pressure * 1.6);
  }
  p.pop();
}

function drawField(p, frame, now) {
  const width = p.width;
  const height = p.height;
  drawAtmosphere(p, width, height, now);
  drawPlate(p, width, height, frame);

  p.push();
  p.noStroke();
  for (let index = 0; index < 100; index += 1) {
    const x = (Math.sin(index * 12.9898 + 0.7) * 43758.5453) % 1;
    const y = (Math.sin(index * 78.233 + 2.4) * 19341.114) % 1;
    const px = Math.abs(x) * width;
    const py = Math.abs(y) * height;
    p.fill(38, 30, 95, 9 + (index % 4) * 3);
    p.circle(px, py, 0.7 + (index % 3) * 0.45);
  }
  p.pop();

  frame.glyphs.forEach((glyph) => drawGlyph(p, glyph, width, height));

  p.push();
  p.noFill();
  p.stroke(38, 28, 92, 25);
  p.strokeWeight(Math.max(0.7, width * 0.00065));
  p.rect(width * 0.04, height * 0.075, width * 0.9, height * 0.84);
  p.pop();
}

function render(p, frame, state = 'sequence', now = performance.now()) {
  drawField(p, frame, now);
  updateReadout(frame, state);
}

function redrawCurrent(p) {
  currentFrame = activeFrameAt(performance.now());
  render(p, currentFrame, interactionFrame?.interaction ?? 'sequence');
  p.redraw();
}

function commitStroke(p, points, duration, source = 'visitor-drag') {
  if (!interactivePreview && staticPreview) return false;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  const next = applyPressureStroke(baseline, { points, duration, source });
  interactionFrame = next;
  currentFrame = next;
  redrawCurrent(p);
  return next.interaction === 'pressure-committed';
}

function commitDefaultStroke(p) {
  commitStroke(p, [{ x: 0.13, y: 0.44 }, { x: 0.5, y: 0.52 }, { x: 0.86, y: 0.61 }], 760, 'deterministic-control');
}

function liftLatest(p) {
  if (!interactionFrame) return false;
  interactionFrame = liftLatestStroke(interactionFrame);
  currentFrame = interactionFrame;
  redrawCurrent(p);
  return true;
}

function releaseSentence(p) {
  interactionFrame = null;
  startedAt = performance.now();
  currentFrame = timeline[0];
  redrawCurrent(p);
}

function onPointerDown(event) {
  if (staticPreview || (event.button !== undefined && event.button !== 0)) return;
  pressed = true;
  pressStartedAt = performance.now();
  pressPath = [pointFromEvent(event)];
  canvasElement.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerMove(event) {
  if (!pressed) return;
  const point = pointFromEvent(event);
  if (!pressPath.length || distance(pressPath.at(-1), point) > 0.008) pressPath.push(point);
  event.preventDefault();
}

function onPointerUp(event, p) {
  if (!pressed) return;
  pressed = false;
  const point = pointFromEvent(event);
  if (!pressPath.length || distance(pressPath.at(-1), point) > 0.004) pressPath.push(point);
  commitStroke(p, pressPath, performance.now() - pressStartedAt);
  pressPath = [];
  event.preventDefault();
}

function attachInteractions(p) {
  canvasElement = p.canvas;
  canvasElement.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvasElement.addEventListener('pointermove', onPointerMove, { passive: false });
  canvasElement.addEventListener('pointerup', (event) => onPointerUp(event, p), { passive: false });
  canvasElement.addEventListener('pointercancel', (event) => onPointerUp(event, p), { passive: false });
  pressControl?.addEventListener('click', () => commitDefaultStroke(p));
  liftControl?.addEventListener('click', () => liftLatest(p));
  releaseControl?.addEventListener('click', () => releaseSentence(p));
  field?.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitDefaultStroke(p);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      liftLatest(p);
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      releaseSentence(p);
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      p.saveCanvas('mutine-handwriting-v020', 'png');
    }
  });
}

window.__mutineHandwritingV020 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: [...currentFrame.memory],
    resistance: currentFrame.materialResistance,
    interaction: currentFrame.interaction || 'sequence',
    interactive: interactivePreview || !staticPreview,
    blind: blindMode
  }),
  commitStroke: (points, duration = 760) => commitStroke(window.__mutineHandwritingP5, points, duration),
  liftLatest: () => liftLatest(window.__mutineHandwritingP5),
  releaseSentence: () => releaseSentence(window.__mutineHandwritingP5),
  getSignature: () => geometrySignature(currentFrame),
  getField: () => field,
  getCanvas: () => canvasElement
};

window.__mutineHandwritingP5 = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, field?.clientWidth || 900);
    const height = Math.max(260, field?.clientHeight || 570);
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
    p.redraw();
  };
}, field);
