import {
  FIELD_COLUMNS,
  FIELD_ROWS,
  STAGES,
  buildFrame,
  buildTimeline,
  applyPressureDwell,
  liftLatestDwell
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4200;

const field = document.querySelector('#pigment-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const coagulateControl = document.querySelector('#coagulate-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let fieldLayer;
let pixelLayer;
let pixelLayerContext;
let canvasElement;
let pressStartedAt = 0;
let pressPoint = null;
let pressed = false;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = {
  deep: '#090a12',
  ink: '#e2d8ce',
  coral: '#f07a61',
  gold: '#e5bd72',
  cyan: '#67c7c6'
};

function hsvToRgb(hue, saturation, value) {
  const h = ((hue % 360) + 360) % 360 / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = value * (1 - saturation);
  const q = value * (1 - saturation * f);
  const t = value * (1 - saturation * (1 - f));
  const channels = [[value, t, p], [q, value, p], [p, value, t], [p, q, value], [t, p, value], [value, p, q]][i % 6];
  return channels.map((channel) => Math.round(channel * 255));
}

function sampleAt(frame, x, y) {
  const fx = clamp(x) * (FIELD_COLUMNS - 1);
  const fy = clamp(y) * (FIELD_ROWS - 1);
  const left = Math.floor(fx);
  const top = Math.floor(fy);
  const right = Math.min(FIELD_COLUMNS - 1, left + 1);
  const bottom = Math.min(FIELD_ROWS - 1, top + 1);
  const amountX = fx - left;
  const amountY = fy - top;
  const at = (column, row) => frame.pigment[row * FIELD_COLUMNS + column];
  const a = at(left, top);
  const b = at(right, top);
  const c = at(left, bottom);
  const d = at(right, bottom);
  const mix = (key) => {
    const topValue = a[key] * (1 - amountX) + b[key] * amountX;
    const bottomValue = c[key] * (1 - amountX) + d[key] * amountX;
    return topValue * (1 - amountY) + bottomValue * amountY;
  };
  return {
    density: mix('density'),
    binder: mix('binder'),
    grain: mix('grain'),
    hue: mix('hue'),
    cusp: mix('cusp'),
    shear: mix('shear'),
    heat: mix('heat')
  };
}

function buildLayer(p) {
  const layerWidth = Math.max(280, Math.min(640, Math.round(p.width * 0.72)));
  const layerHeight = Math.max(220, Math.round(layerWidth * 0.65));
  fieldLayer = p.createGraphics(layerWidth, layerHeight);
  fieldLayer.pixelDensity(1);
  fieldLayer.canvas.style.display = 'none';
  fieldLayer.noSmooth();
  pixelLayer = document.createElement('canvas');
  pixelLayer.width = layerWidth;
  pixelLayer.height = layerHeight;
  pixelLayerContext = pixelLayer.getContext('2d', { willReadFrequently: true });
}

function renderPigmentLayer(frame, now) {
  const imageData = pixelLayerContext.createImageData(pixelLayer.width, pixelLayer.height);
  const pixels = imageData.data;
  const width = pixelLayer.width;
  const height = pixelLayer.height;
  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const sample = sampleAt(frame, u, v);
      const breathing = Math.sin(now * 0.00018 + u * 11.0 - v * 8.0) * 0.018;
      const grain = Math.sin(u * 180 + v * 97 + sample.grain * 30) * 0.028;
      const hue = sample.hue + sample.heat * 42 + sample.cusp * 126 + breathing * 100;
      const saturation = clamp(0.44 + sample.binder * 0.4 + sample.cusp * 0.16, 0.35, 0.96);
      const value = clamp(0.06 + sample.density * 0.52 + sample.binder * 0.16 + sample.cusp * 0.28 + grain, 0.035, 0.94);
      const [red, green, blue] = hsvToRgb(hue, saturation, value);
      const index = 4 * (y * width + x);
      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
      pixels[index + 3] = 255;
    }
  }
  pixelLayerContext.putImageData(imageData, 0, 0);
  fieldLayer.clear();
  fieldLayer.drawingContext.drawImage(pixelLayer, 0, 0);
}

function drawCuspContours(p, frame, now) {
  p.push();
  p.noFill();
  frame.memory.forEach((event, eventIndex) => {
    const x = event.point.x * p.width;
    const y = event.point.y * p.height;
    const radius = (0.095 + event.load * 0.11) * Math.min(p.width, p.height);
    for (let ring = 0; ring < 4; ring += 1) {
      const amount = (ring + 1) / 4;
      const wobble = 1 + Math.sin(now * 0.00012 + ring + eventIndex) * 0.018;
      p.stroke(p.color(8 + eventIndex * 25, 210 - ring * 13, 212, 34 - ring * 5));
      p.strokeWeight(Math.max(0.55, p.width * (0.0005 - ring * 0.00006)));
      p.beginShape();
      for (let step = 0; step <= 28; step += 1) {
        const angle = (step / 28) * Math.PI * 2;
        const pinch = 1 + Math.sin(angle * 3 + eventIndex) * 0.09 + Math.cos(angle * 5 - now * 0.0001) * 0.035;
        p.vertex(x + Math.cos(angle) * radius * amount * pinch * wobble, y + Math.sin(angle) * radius * amount * (0.68 + event.load * 0.2) * pinch);
      }
      p.endShape(p.CLOSE);
    }
  });
  p.pop();
}

function drawField(p, frame, now) {
  p.background(palette.deep);
  p.image(fieldLayer, 0, 0, p.width, p.height);
  drawCuspContours(p, frame, now);
  p.push();
  p.noFill();
  p.stroke(p.color(226, 216, 206, 13));
  p.strokeWeight(Math.max(0.5, p.width * 0.00055));
  p.rect(p.width * 0.018, p.height * 0.026, p.width * 0.964, p.height * 0.948);
  p.pop();
}

function pointFromEvent(event) {
  const rect = canvasElement.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp((event.clientY - rect.top) / Math.max(1, rect.height))
  };
}

function updateReadout(frame, state) {
  if (stageReadout) stageReadout.textContent = state === 'pressure-coagulated'
    ? 'pressure held / cusp sealed'
    : state === 'pressure-lifted'
      ? 'latest cusp lifted'
      : state === 'pressure-refused'
        ? 'tap refused / no dwell'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure hold${frame.memory.length === 1 ? '' : 's'} · ${Math.round(frame.coagulatedMass)} binder mass`;
  if (interactionState) interactionState.textContent = state === 'pressure-coagulated'
    ? 'The held pressure has sealed a cusp; the next hold will meet altered material.'
    : state === 'pressure-lifted'
      ? 'The latest cusp is gone; the prior wet field is exact.'
      : state === 'pressure-refused'
        ? 'A tap is not pressure. The field did not coagulate.'
        : 'The pigment is wet and uncommitted.';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.coagulated = String(Math.round(frame.coagulatedMass));
    field.dataset.interaction = state;
  }
}

function render(p, frame, state = 'sequence', now = performance.now()) {
  renderPigmentLayer(frame, now);
  drawField(p, frame, now);
  updateReadout(frame, state);
}

function currentFrameAt(now) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function redrawCurrent(p) {
  currentFrame = currentFrameAt(performance.now());
  render(p, currentFrame, interactionFrame?.interaction ?? 'sequence');
  p.redraw();
}

function commitDwell(p, point, duration) {
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = applyPressureDwell(baseline, { point, duration });
  redrawCurrent(p);
}

function commitDefaultDwell(p) {
  commitDwell(p, { x: 0.37, y: 0.55 }, 760);
}

function liftLatest(p) {
  if (!interactionFrame) return;
  interactionFrame = liftLatestDwell(interactionFrame);
  redrawCurrent(p);
}

function releaseField(p) {
  interactionFrame = null;
  startedAt = performance.now();
  redrawCurrent(p);
}

function onPointerDown(event) {
  if (event.target.closest('button')) return;
  if (event.button !== undefined && event.button !== 0) return;
  pressed = true;
  pressStartedAt = performance.now();
  pressPoint = pointFromEvent(event);
  canvasElement.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function onPointerUp(event, p) {
  if (!pressed) return;
  pressed = false;
  const duration = performance.now() - pressStartedAt;
  commitDwell(p, pressPoint || pointFromEvent(event), duration);
  pressPoint = null;
  event.preventDefault();
}

function attachInteractions(p) {
  canvasElement = p.canvas;
  canvasElement.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvasElement.addEventListener('pointerup', (event) => onPointerUp(event, p), { passive: false });
  canvasElement.addEventListener('pointercancel', (event) => onPointerUp(event, p), { passive: false });
  coagulateControl?.addEventListener('click', () => commitDefaultDwell(p));
  liftControl?.addEventListener('click', () => liftLatest(p));
  releaseControl?.addEventListener('click', () => releaseField(p));
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitDefaultDwell(p);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      liftLatest(p);
    } else if (event.key === 'r' || event.key === 'R') {
      releaseField(p);
    } else if (event.key === 's' || event.key === 'S') {
      p.saveCanvas('mutine-brush-v022', 'png');
    }
  });
}

new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, field?.clientWidth || 900);
    const height = Math.max(260, field?.clientHeight || 590);
    p.pixelDensity(1);
    p.createCanvas(width, height, p.P2D);
    buildLayer(p);
    attachInteractions(p);
    p.noLoop();
    window._p5Ready = true;
    p.redraw();
    const tick = () => {
      if (!frozen) p.redraw();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  p.draw = () => {
    render(p, currentFrameAt(performance.now()), interactionFrame?.interaction ?? 'sequence');
  };

  p.windowResized = () => {
    if (!field) return;
    p.resizeCanvas(Math.max(320, field.clientWidth), Math.max(260, field.clientHeight));
    buildLayer(p);
    p.redraw();
  };
}, field);
