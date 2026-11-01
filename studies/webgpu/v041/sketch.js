// pressure-fossil renderer: a singular raster body whose negative space remembers waiting.
import {
  STAGES,
  APERTURE_COUNT,
  HOLD_THRESHOLD_MS,
  buildFrame,
  buildTimeline,
  beginHold,
  updateHold,
  finishHold,
  liftLatestHold,
  releaseArchive,
  defaultHold
} from './engine.mjs';

const frameElement = document.querySelector('.fossil-frame');
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
  raster: null,
  holdPointer: false
};

const palette = {
  ground: [11, 16, 21],
  mineral: [46, 59, 56],
  mineralLight: [116, 128, 103],
  copper: [212, 127, 85],
  mint: [154, 198, 184],
  void: [8, 13, 17],
  dust: [185, 154, 97]
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `cycle ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'fossil' : 'fossils'}`;
  rendererElement.textContent = `P5.JS / CANVAS 2D / PRESSURE FOSSIL${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'hold-started') statusElement.textContent = 'the pause has begun · geometry stays exact';
  else if (action === 'hold-short') statusElement.textContent = 'too brief · the fossil refuses the cut';
  else if (action === 'hold-armed') statusElement.textContent = 'threshold crossed · release to harden elsewhere';
  else if (action === 'hold-committed') statusElement.textContent = 'pause hardened · a remote aperture changed';
  else if (action === 'hold-refused-short') statusElement.textContent = 'the pause was too brief · nothing entered the archive';
  else if (action === 'hold-refused-memory-limit') statusElement.textContent = 'archive full · lift a fossil first';
  else if (action === 'hold-lifted') statusElement.textContent = 'latest hardening lifted · the prior fossil returns';
  else if (action === 'archive-released') statusElement.textContent = 'archive released · the quiet fossil returns';
  else statusElement.textContent = blindMode ? '' : 'press and hold, then release the pause';
};

const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return { x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) };
};

const pointFromP5 = (p) => ({ x: Math.max(0, Math.min(1, p.mouseX / p.width)), y: Math.max(0, Math.min(1, p.mouseY / p.height)) });

const begin = (point) => {
  if (state.frame.memory.length >= 4 || state.holdPointer) return;
  state.holdPointer = true;
  setFrame(beginHold(state.frame, { ...point, time: state.p?.millis() ?? 0 }));
  state.canvas?.focus({ preventScroll: true });
};

const move = (point) => {
  if (!state.holdPointer || !state.frame.gesture) return;
  setFrame(updateHold(state.frame, { ...point, time: state.p?.millis() ?? 0 }));
};

const end = (point) => {
  if (!state.holdPointer) return;
  state.holdPointer = false;
  setFrame(finishHold(state.frame, { ...point, time: state.p?.millis() ?? 0, confirmed: true }));
};

const commitDefaultHold = () => {
  const preset = defaultHold(state.frame);
  if (state.frame.memory.length >= 4) {
    setFrame(finishHold(state.frame, { confirmed: true }));
    return;
  }
  const started = beginHold(state.frame, { x: preset.x, y: preset.y, time: 0 });
  setFrame(finishHold(started, { x: preset.x, y: preset.y, time: preset.durationMs, confirmed: true }));
};

const lift = () => setFrame(liftLatestHold(state.frame));
const release = () => { state.holdPointer = false; setFrame(releaseArchive()); };

const bodyPoints = (p, h, field, t) => {
  const cx = p.width * field.spine.x;
  const bodyWidth = p.width * 0.56;
  const sway = state.motion ? Math.sin(t * 0.00028) * p.width * 0.008 : 0;
  return [
    [cx - bodyWidth * 0.34 + sway, h * 0.06], [cx + bodyWidth * 0.27 + sway, h * 0.035],
    [cx + bodyWidth * 0.4 + sway, h * 0.18], [cx + bodyWidth * 0.29 + sway, h * 0.34],
    [cx + bodyWidth * 0.38 + sway, h * 0.52], [cx + bodyWidth * 0.25 + sway, h * 0.73],
    [cx + bodyWidth * 0.34 + sway, h * 0.94], [cx - bodyWidth * 0.3 + sway, h * 0.97],
    [cx - bodyWidth * 0.41 + sway, h * 0.78], [cx - bodyWidth * 0.28 + sway, h * 0.6],
    [cx - bodyWidth * 0.38 + sway, h * 0.4], [cx - bodyWidth * 0.27 + sway, h * 0.22]
  ];
};

const drawBody = (g, points, fillColor) => {
  g.push();
  g.noStroke();
  g.fill(...fillColor);
  g.beginShape();
  points.forEach(([x, y]) => g.vertex(x, y));
  g.endShape(g.CLOSE);
  g.pop();
};

const drawAperture = (g, aperture, body, index, t) => {
  const x = body.x + (aperture.x - 0.5) * body.w * 1.65;
  const y = body.y + aperture.y * body.h;
  const width = aperture.width * body.w * (1 + aperture.edge * 0.16);
  const height = aperture.height * body.h * (1 + aperture.density * 0.08);
  const rotation = aperture.tilt + (state.motion ? Math.sin(t * 0.0004 + index) * 0.008 : 0);
  g.push();
  g.translate(x, y);
  g.rotate(rotation);
  g.noStroke();
  g.fill(...palette.void);
  g.ellipse(0, 0, width * 1.15, height * 1.12);
  g.fill(17, 27, 29, 235);
  g.beginShape();
  const steps = 10;
  for (let step = 0; step < steps; step += 1) {
    const angle = (Math.PI * 2 * step) / steps;
    const irregular = 1 + Math.sin(step * 4.7 + index * 1.73) * 0.1 * aperture.notch;
    g.vertex(Math.cos(angle) * width * 0.49 * irregular, Math.sin(angle) * height * 0.49 * irregular);
  }
  g.endShape(g.CLOSE);
  g.noFill();
  g.stroke(...(index === body.remoteIndex ? palette.copper : palette.mint), index === body.remoteIndex ? 145 : 64);
  g.strokeWeight(index === body.remoteIndex ? 1.6 : 0.7);
  g.ellipse(0, 0, width * (0.92 + aperture.notch * 0.08), height * (0.9 + aperture.edge * 0.08));
  g.pop();
};

const renderFossil = (p) => {
  const g = state.raster;
  const w = p.width;
  const h = p.height;
  const t = p.millis();
  g.clear();
  g.background(...palette.ground);
  for (let band = 0; band < 18; band += 1) {
    const y = (band / 18) * h;
    g.stroke(28 + band * 2, 38 + band, 39 + band, 110);
    g.strokeWeight(Math.max(1, h * 0.0015));
    g.line(0, y, w, y + Math.sin(band * 1.8) * h * 0.012);
  }
  const field = state.frame.field;
  const body = { x: w * 0.5, y: h * 0.055, w: w * 0.56, h: h * 0.89, remoteIndex: field.remoteIndex };
  const points = bodyPoints(p, body.h, field, t).map(([x, y]) => [x, y]);
  drawBody(g, points, palette.mineral);
  g.push();
  g.noFill();
  g.stroke(...palette.mineralLight, 85);
  g.strokeWeight(Math.max(1, w * 0.003));
  g.beginShape();
  points.forEach(([x, y]) => g.vertex(x + w * 0.005, y));
  g.endShape(g.CLOSE);
  g.stroke(...palette.copper, 110);
  g.strokeWeight(Math.max(1, w * 0.0012));
  g.line(w * field.spine.x, h * 0.1, w * (field.spine.x + field.spine.tension * 0.05), h * 0.91);
  g.pop();
  field.apertures.forEach((aperture, index) => drawAperture(g, aperture, body, index, t));
  g.push();
  for (let grain = 0; grain < 420; grain += 1) {
    const gx = (Math.sin(grain * 17.31 + 2.1) * 0.5 + 0.5) * w;
    const gy = (Math.sin(grain * 7.71 + 1.4) * 0.5 + 0.5) * h;
    const alpha = 16 + ((grain * 13) % 28);
    g.stroke(...(grain % 7 === 0 ? palette.dust : palette.mint), alpha);
    g.strokeWeight(grain % 9 === 0 ? 1.4 : 0.7);
    g.point(gx, gy);
  }
  g.pop();
  p.image(g, 0, 0);
};

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#fossil-field');
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    canvas.id('fossil-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A singular mineral fossil with thirteen dark apertures and a tense central seam');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    placeholder?.replaceWith(canvas.elt);
    p.pixelDensity(1);
    state.raster = p.createGraphics(p.width, p.height);
    state.raster.pixelDensity(1);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV041 = {
      getState: () => ({
        stage: state.frame.stage,
        memory: state.frame.memory.length,
        events: state.frame.memory.map((event) => ({ ...event })),
        signature: state.frame.field.signature,
        gesture: state.frame.gesture ? { ...state.frame.gesture } : null,
        lastAction: state.frame.lastAction,
        kind: state.frame.field.kind,
        apertures: state.frame.field.apertures.map((aperture) => ({ ...aperture })),
        remoteIndex: state.frame.field.remoteIndex,
        spine: { ...state.frame.field.spine },
        gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
        apertureCount: APERTURE_COUNT,
        holdThresholdMs: HOLD_THRESHOLD_MS
      })
    };
  };
  p.draw = () => renderFossil(p);
  p.windowResized = () => {
    if (!frameElement) return;
    p.resizeCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    state.raster?.resizeCanvas(p.width, p.height);
    p.redraw();
  };
  p.mousePressed = () => {
    if (p.mouseEvent?.target && p.mouseEvent.target !== state.canvas) return true;
    begin(pointFromP5(p));
    return false;
  };
  p.mouseDragged = () => { move(pointFromP5(p)); return false; };
  p.mouseReleased = () => { end(pointFromP5(p)); return false; };
  p.touchStarted = () => {
    if (p.touchEvent?.target && p.touchEvent.target !== state.canvas) return true;
    begin(pointFromP5(p));
    return false;
  };
  p.touchMoved = () => {
    if (p.touchEvent?.target && p.touchEvent.target !== state.canvas) return true;
    move(pointFromP5(p));
    return false;
  };
  p.touchEnded = () => {
    if (p.touchEvent?.target && p.touchEvent.target !== state.canvas) return true;
    end(pointFromP5(p));
    return false;
  };
  p.keyPressed = () => {
    if (p.key === 'Enter' || p.key === ' ') commitDefaultHold();
    if (p.key === 'Delete' || p.key === 'Backspace') lift();
    if (p.key === 'Escape' || p.key === 'r' || p.key === 'R') release();
    return false;
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const hardenButton = document.querySelector('[data-gesture="harden"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [hardenButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
hardenButton?.addEventListener('click', commitDefaultHold);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
