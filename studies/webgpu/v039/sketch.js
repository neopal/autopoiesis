// pressure-reservoir renderer: a collective body whose memory is made in the spaces between bodies.
import {
  STAGES,
  RESERVOIR_COUNT,
  buildFrame,
  buildTimeline,
  beginPair,
  finishPair,
  liftLatestPair,
  releaseArchive,
  defaultPair,
  aimPair
} from './engine.mjs';

const frameElement = document.querySelector('.reservoir-frame');
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  motion: !(staticMode || reducedMotion),
  canvas: null,
  p: null,
  lastTouchAt: 0
};
const TAU = Math.PI * 2;
const BG = { hue: 218, saturation: 36, brightness: 6 };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `cycle ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'compression' : 'compressions'}`;
  rendererElement.textContent = `P5.JS / CANVAS 2D / PRESSURE RESERVOIR${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  if (state.frame.lastAction === 'pair-source-chosen') statusElement.textContent = 'one body held · choose a second body';
  else if (state.frame.lastAction === 'pair-target-chosen' || state.frame.lastAction === 'pair-target-aimed') statusElement.textContent = 'pair held · compress to route the pressure elsewhere';
  else if (state.frame.lastAction === 'pair-compressed') statusElement.textContent = 'compressed · the answer was produced between other bodies';
  else if (state.frame.lastAction === 'pair-refused-incomplete') statusElement.textContent = 'the archive refuses · choose two distinct bodies';
  else if (state.frame.lastAction === 'pair-refused-same-body') statusElement.textContent = 'the same body cannot make a pressure pair';
  else if (state.frame.lastAction === 'pair-refused-memory-limit') statusElement.textContent = 'archive full · lift a compression before adding another';
  else if (state.frame.lastAction === 'pair-lifted') statusElement.textContent = 'latest pressure lifted · the prior body returns';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the quiet collective returns';
  else statusElement.textContent = 'choose two bodies, then compress the pair';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1)
  };
};

const pointFromP5 = (p) => pointFromClient(p.mouseX + state.canvas.getBoundingClientRect().left, p.mouseY + state.canvas.getBoundingClientRect().top);

const choosePair = (point) => {
  state.frame = beginPair(state.frame, point);
  updateReadout();
  state.p?.redraw();
};

const commitDefaultPair = () => {
  if (state.frame.pair && state.frame.pair.targetIndex == null) {
    setFrame(finishPair(state.frame, { confirmed: true, pressure: 0.72 }));
    return;
  }
  if (!state.frame.pair) {
    const pair = defaultPair(state.frame);
    const chosen = beginPair(state.frame, pair.source);
    const aimed = aimPair(chosen, pair.target);
    setFrame(finishPair(aimed, { confirmed: true, pressure: pair.pressure }));
    return;
  }
  setFrame(finishPair(state.frame, { confirmed: true, pressure: 0.72 }));
};

const lift = () => setFrame(liftLatestPair(state.frame));
const release = () => setFrame(releaseArchive());

const bodyCenter = (body, x, y, width, height) => ({ x: x + body.x * width, y: y + body.y * height });
const toCanvasPoint = (point, x, y, width, height) => ({ x: x + point.x * width, y: y + point.y * height });

const drawPolygon = (p, points) => {
  p.beginShape();
  points.forEach((point) => p.vertex(point.x, point.y));
  p.endShape(p.CLOSE);
};

const drawBackground = (p, width, height, time) => {
  p.background(BG.hue, BG.saturation, BG.brightness);
  p.noStroke();
  for (let band = 0; band < 34; band += 1) {
    const y = (band / 33) * height;
    const warmth = Math.sin(band * 0.48 + time * 0.00005) * 2.8;
    p.fill(215 + warmth, 29, 6.2 + band * 0.14, 0.32);
    p.rect(0, y, width, height / 31 + 1);
  }
  p.fill(34, 22, 92, 0.04);
  p.ellipse(width * 0.78, height * 0.34, width * 0.62, height * 0.78);
  p.fill(8, 30, 94, 0.035);
  p.ellipse(width * 0.2, height * 0.7, width * 0.54, height * 0.46);
};

const drawVoid = (p, voidState, x, y, width, height, time) => {
  const points = voidState.points.map((point) => toCanvasPoint(point, x, y, width, height));
  const center = toCanvasPoint(voidState.center, x, y, width, height);
  p.push();
  p.noStroke();
  p.fill(BG.hue, BG.saturation + 3, BG.brightness + 1.4, 0.98);
  drawPolygon(p, points);
  p.noFill();
  p.stroke(39, 17, 88, 0.54);
  p.strokeWeight(Math.max(0.8, Math.min(width, height) * 0.0012));
  drawPolygon(p, points);
  p.stroke(41, 18, 74, 0.22);
  p.strokeWeight(0.6);
  const pulse = state.motion ? Math.sin(time * 0.0007) * 0.015 : 0;
  p.ellipse(center.x, center.y, width * (0.14 + voidState.aperture * 0.016 + pulse), height * 0.06);
  p.pop();
};

const drawBody = (p, body, x, y, width, height, time, index) => {
  const points = body.vertices.map((point) => toCanvasPoint(point, x, y, width, height));
  const center = bodyCenter(body, x, y, width, height);
  const breath = state.motion ? Math.sin(time * 0.00055 + index * 0.63) * 0.012 : 0;
  const baseHue = (body.hue + 8 + index * 2.3) % 360;
  const mass = clamp(body.pressure + breath, 0.04, 0.98);
  const shadowPoints = points.map((point) => ({ x: point.x + width * 0.008, y: point.y + height * 0.012 }));

  p.push();
  p.noStroke();
  p.fill(218, 28, 2.8, 0.54);
  drawPolygon(p, shadowPoints);
  p.fill(baseHue, 48 + mass * 28, 26 + mass * 52, 0.94);
  drawPolygon(p, points);

  const inner = points.map((point) => ({
    x: mix(center.x, point.x, 0.66),
    y: mix(center.y, point.y, 0.66)
  }));
  p.fill((baseHue + 9) % 360, 42 + mass * 30, 12 + mass * 34, 0.92);
  drawPolygon(p, inner);

  const notchAngle = body.notchAngle;
  const notchLength = Math.min(width, height) * (0.05 + body.notch * 0.11);
  const notch = {
    x: center.x + Math.cos(notchAngle) * notchLength,
    y: center.y + Math.sin(notchAngle) * notchLength
  };
  p.fill(BG.hue, BG.saturation + 3, BG.brightness + 1.4, 0.98);
  p.beginShape();
  p.vertex(center.x, center.y);
  p.vertex(notch.x - Math.sin(notchAngle) * notchLength * 0.35, notch.y + Math.cos(notchAngle) * notchLength * 0.35);
  p.vertex(notch.x + Math.sin(notchAngle) * notchLength * 0.35, notch.y - Math.cos(notchAngle) * notchLength * 0.35);
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke((baseHue + 28) % 360, 30, 91, 0.42);
  p.strokeWeight(Math.max(0.55, Math.min(width, height) * 0.0011));
  p.beginShape();
  points.forEach((point, pointIndex) => {
    if (pointIndex % 2 === 0) p.vertex(mix(center.x, point.x, 0.82), mix(center.y, point.y, 0.82));
  });
  p.endShape();

  if (index % 3 === 0) {
    p.stroke((baseHue + 180) % 360, 20, 92, 0.24);
    p.strokeWeight(0.55);
    p.line(center.x - width * 0.015, center.y, center.x + width * 0.02, center.y - height * 0.008);
  }
  p.pop();
};

const drawSelection = (p, frame, x, y, width, height) => {
  if (!frame.pair || blindMode) return;
  const selected = [frame.pair.sourceIndex, frame.pair.targetIndex].filter((index) => Number.isInteger(index));
  selected.forEach((index, order) => {
    const body = frame.field.bodies[index];
    if (!body) return;
    const center = bodyCenter(body, x, y, width, height);
    p.push();
    p.noFill();
    p.stroke(order === 0 ? 43 : 12, 30, 96, 0.92);
    p.strokeWeight(1.15);
    p.circle(center.x, center.y, Math.max(18, Math.min(width, height) * 0.04));
    p.line(center.x - 10, center.y, center.x + 10, center.y);
    p.line(center.x, center.y - 10, center.x, center.y + 10);
    p.pop();
  });
};

const render = (p) => {
  const width = p.width;
  const height = p.height;
  const time = performance.now();
  drawBackground(p, width, height, time);

  const fieldWidth = Math.min(width * 0.82, height * 1.08);
  const fieldHeight = Math.min(height * 0.73, fieldWidth * 0.86);
  const fieldX = (width - fieldWidth) * 0.5;
  const fieldY = height * 0.115;

  p.push();
  p.noFill();
  p.stroke(42, 18, 42, 0.28);
  p.strokeWeight(Math.max(0.7, Math.min(width, height) * 0.001));
  p.rect(fieldX - width * 0.025, fieldY - height * 0.025, fieldWidth + width * 0.05, fieldHeight + height * 0.05, 3);
  p.pop();

  state.frame.field.bodies.forEach((body, index) => drawBody(p, body, fieldX, fieldY, fieldWidth, fieldHeight, time, index));
  drawVoid(p, state.frame.field.void, fieldX, fieldY, fieldWidth, fieldHeight, time);
  drawSelection(p, state.frame, fieldX, fieldY, fieldWidth, fieldHeight);
};

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#reservoir-field');
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    canvas.id('reservoir-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'An asymmetrical collective body of pressure reservoirs around a changing central void');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    placeholder?.replaceWith(canvas.elt);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.frameRate(30);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV039 = {
      getState: () => ({
        stage: state.frame.stage,
        memory: state.frame.memory.length,
        signature: state.frame.field.signature,
        voidSignature: state.frame.field.voidSignature,
        attention: Boolean(state.frame.pair),
        pair: state.frame.pair ? { ...state.frame.pair } : null,
        lastAction: state.frame.lastAction,
        kind: state.frame.field.kind,
        bodies: state.frame.field.bodies.map((body) => ({ id: body.id, scale: body.scale, aspect: body.aspect, rotation: body.rotation, notch: body.notch, pressure: body.pressure, vertices: body.vertices })),
        void: state.frame.field.void.points,
        gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
        reservoirCount: RESERVOIR_COUNT
      })
    };
  };
  p.draw = () => render(p);
  p.windowResized = () => {
    if (!frameElement) return;
    p.resizeCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    p.redraw();
  };
  p.mousePressed = () => {
    if (p.mouseEvent?.target && p.mouseEvent.target !== state.canvas) return true;
    if (performance.now() - state.lastTouchAt < 450) return false;
    choosePair(pointFromP5(p));
    state.canvas?.focus({ preventScroll: true });
    return false;
  };
  p.touchStarted = () => {
    state.lastTouchAt = performance.now();
    choosePair(pointFromP5(p));
    state.canvas?.focus({ preventScroll: true });
    return false;
  };
  p.keyPressed = () => {
    if (p.key === 'Enter' || p.key === ' ') commitDefaultPair();
    if (p.key === 'Delete' || p.key === 'Backspace') lift();
    if (p.key === 'Escape' || p.key === 'r' || p.key === 'R') release();
    return false;
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const compressButton = document.querySelector('[data-gesture="compress"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [compressButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
}
compressButton?.addEventListener('click', commitDefaultPair);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
