import {
  STAGES,
  buildFrame,
  buildTimeline,
  beginTurn,
  turnVolume,
  finishTurn,
  liftLatestTurn,
  releaseArchive,
  defaultTurn
} from './engine.mjs';

const frameElement = document.querySelector('.mass-frame');
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
  drag: null,
  previewYaw: 0,
  previewPitch: 0,
  motion: !(staticMode || reducedMotion),
  renderer: 'P5.JS / WEBGL / MATERIAL PRISM',
  canvas: null,
  p: null
};
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pseudo = (value) => {
  const raw = Math.sin(value * 13.713 + 2.37) * 43758.5453;
  return raw - Math.floor(raw);
};
const mix = (a, b, amount) => a + (b - a) * amount;

const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1)
  };
};
const pointFromP5 = (p) => pointFromClient(p.mouseX + state.canvas.getBoundingClientRect().left, p.mouseY + state.canvas.getBoundingClientRect().top);
const setFrame = (frame) => {
  state.frame = frame;
  state.drag = null;
  state.previewYaw = 0;
  state.previewPitch = 0;
  updateReadout();
  state.p?.redraw();
};
const startTurn = (point, at = performance.now()) => {
  state.frame = beginTurn(state.frame, { ...point, at });
  state.drag = { start: point, current: point, at };
  updateReadout();
};
const moveTurn = (point, at = performance.now()) => {
  if (!state.drag) return;
  state.drag.current = point;
  state.frame = turnVolume(state.frame, { ...point, at });
  state.previewYaw = (point.x - state.drag.start.x) * 1.8;
  state.previewPitch = (point.y - state.drag.start.y) * -0.9;
  updateReadout();
  state.p?.redraw();
};
const endTurn = (point, at = performance.now()) => {
  if (!state.drag) return;
  state.frame = finishTurn(state.frame, { ...point, finishedAt: at });
  state.drag = null;
  state.previewYaw = 0;
  state.previewPitch = 0;
  updateReadout();
  state.p?.redraw();
};
const commitDefaultTurn = () => {
  const turn = defaultTurn(state.frame);
  const armed = beginTurn(state.frame, { ...turn.start, at: 0 });
  setFrame(finishTurn(armed, { ...turn.end, finishedAt: 420 }));
};
const lift = () => setFrame(liftLatestTurn(state.frame));
const release = () => setFrame(releaseArchive());

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `turn ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'shear' : 'shears'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'turn-committed') statusElement.textContent = 'turn committed · a remote seam carries the load';
  else if (state.frame.lastAction === 'turn-armed' || state.frame.lastAction === 'turn-preview') statusElement.textContent = 'preview only · complete the sweep to load the prism';
  else if (state.frame.lastAction === 'turn-refused-bounds') statusElement.textContent = 'the material refuses · turn farther, but not through the whole body';
  else if (state.frame.lastAction === 'turn-refused-no-arm') statusElement.textContent = 'no turn offered · the prism stays quiet';
  else if (state.frame.lastAction === 'turn-lifted') statusElement.textContent = 'latest shear lifted · the prior volume returns';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'material full · lift a shear before turning again';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'mass released · the quiet volume returns';
  else statusElement.textContent = 'turn the mass through a complete sweep';
};

const drawAtmosphere = (p, width, height) => {
  const span = Math.min(width, height);
  p.push();
  p.translate(0, 0, -span * 0.62);
  p.strokeWeight(1);
  for (let index = 0; index < 180; index += 1) {
    const x = (pseudo(index + 4) - 0.5) * width * 1.7;
    const y = (pseudo(index * 2.7 + 11) - 0.5) * height * 1.7;
    const z = (pseudo(index * 5.1 + 19) - 0.5) * span * 0.25;
    const size = 0.4 + pseudo(index * 1.9 + 31) * 1.6;
    p.stroke(index % 7 === 0 ? [42, 53, 71, 0.42] : [145, 175, 157, 0.18]);
    p.point(x, y, z + span * 0.1);
    if (size > 1.35) p.point(x + size, y - size * 0.4, z);
  }
  p.pop();
};

const drawSeam = (p, layer, width, depth, span, index) => {
  const ridge = clamp(Math.abs(layer.shear) * 0.85 + layer.cut * 0.55, 0, 1);
  const seamColor = index % 3 === 0 ? [36, 18, 25, 0.82] : [190, 28, 72, 0.6];
  p.push();
  p.stroke(...seamColor);
  p.strokeWeight(Math.max(0.7, span * (0.0012 + ridge * 0.0022)));
  const z = depth * 0.51 + span * 0.006;
  const left = -width * 0.5 + width * layer.cut * 0.16;
  const right = width * 0.5 - width * layer.cut * 0.08;
  const kink = layer.shear * span * 0.055;
  p.line(left, -layer.thickness * span * 0.18, z, kink, layer.thickness * span * 0.22, z);
  p.line(kink, layer.thickness * span * 0.22, z, right, -layer.thickness * span * 0.15, z);
  p.pop();
};

const drawPrism = (p, width, height, time) => {
  const span = Math.min(width, height);
  const layers = state.frame.field.layers;
  const baseYaw = -0.38 + state.previewYaw + (state.motion ? Math.sin(time * 0.00011) * 0.012 : 0);
  const basePitch = -0.22 + state.previewPitch + (state.motion ? Math.sin(time * 0.000083) * 0.008 : 0);
  p.push();
  p.translate(0, span * 0.02, span * 0.04);
  p.rotateX(basePitch);
  p.rotateY(baseYaw);
  p.rotateZ(-0.11);

  p.push();
  p.translate(span * 0.035, span * 0.045, -span * 0.08);
  p.noStroke();
  p.fill(210, 20, 8, 0.42);
  p.box(span * 0.92, span * 0.98, span * 0.34);
  p.pop();

  layers.forEach((layer, index) => {
    const y = layer.y * span * 0.86;
    const blockWidth = span * (0.82 + layer.mass * 0.15);
    const blockHeight = span * (0.048 + layer.thickness * 0.26);
    const blockDepth = span * (0.20 + layer.depth * 0.28);
    const x = layer.offset * span * 0.68;
    const z = layer.shear * span * 0.2;
    const hue = mix(150, 35, index / (layers.length - 1)) + layer.shear * 18;
    const saturation = 34 + layer.cut * 34;
    const brightness = 62 + layer.depth * 23 - Math.abs(layer.shear) * 14;

    p.push();
    p.translate(x, y, z);
    p.rotateZ(layer.shear * 0.18);
    p.noStroke();
    p.fill((hue + 360) % 360, saturation, brightness, 0.95);
    p.box(blockWidth, blockHeight, blockDepth);
    p.fill(208, 20, 7, 0.46);
    p.translate(0, 0, blockDepth * 0.48);
    p.box(blockWidth * (0.12 + layer.cut * 0.42), blockHeight * 0.7, span * 0.012);
    drawSeam(p, layer, blockWidth, blockDepth, span, index);
    p.pop();
  });

  p.push();
  p.noFill();
  p.stroke(142, 20, 80, 0.5);
  p.strokeWeight(Math.max(0.8, span * 0.0014));
  p.translate(0, 0, span * 0.19);
  p.box(span * 0.92, span * 0.98, span * 0.02);
  p.pop();
  p.pop();
};

const render = (p) => {
  const width = p.width;
  const height = p.height;
  const now = performance.now();
  p.background(190, 34, 6);
  drawAtmosphere(p, width, height);
  drawPrism(p, width, height, now);
};

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#mass-field');
    placeholder?.remove();
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight), p.WEBGL);
    canvas.id('mass-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A three-dimensional sediment prism with fourteen stacked material layers and one internal cut');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.frameRate(30);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV037 = {
      getState: () => ({
        stage: state.frame.stage,
        memory: state.frame.memory.length,
        signature: state.frame.field.signature,
        attention: Boolean(state.frame.attention),
        lastAction: state.frame.lastAction,
        kind: state.frame.field.kind,
        layers: state.frame.field.layers.map((layer) => ({ id: layer.id, offset: layer.offset, shear: layer.shear, depth: layer.depth, cut: layer.cut })),
        gpuAvailable: Boolean(window.__mutineWebGPUAvailable)
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
    const point = pointFromP5(p);
    startTurn(point, performance.now());
    state.canvas?.focus({ preventScroll: true });
    state.p?.redraw();
    return false;
  };
  p.mouseDragged = () => {
    moveTurn(pointFromP5(p), performance.now());
    return false;
  };
  p.mouseReleased = () => {
    endTurn(pointFromP5(p), performance.now());
    return false;
  };
  p.touchMoved = () => {
    moveTurn(pointFromClient(p.touches?.[0]?.x ?? p.mouseX + frameElement.getBoundingClientRect().left, p.touches?.[0]?.y ?? p.mouseY + frameElement.getBoundingClientRect().top), performance.now());
    return false;
  };
  p.keyPressed = () => {
    if (p.key === 'ArrowRight' || p.key === 'ArrowLeft' || p.key === 'ArrowUp' || p.key === 'ArrowDown') {
      const signX = p.key === 'ArrowLeft' ? -1 : p.key === 'ArrowRight' ? 1 : 0;
      const signY = p.key === 'ArrowUp' ? -1 : p.key === 'ArrowDown' ? 1 : 0;
      const start = state.frame.attention?.start ?? { x: 0.22, y: 0.48 };
      const current = { x: clamp(start.x + signX * 0.28, 0, 1), y: clamp(start.y + signY * 0.28, 0, 1) };
      state.frame = beginTurn(state.frame, { ...start, at: 0 });
      state.frame = turnVolume(state.frame, { ...current, at: 300 });
      state.previewYaw = signX * 0.26;
      state.previewPitch = -signY * 0.18;
      updateReadout();
      state.p?.redraw();
      return false;
    }
    if (p.key === 'Enter' || p.key === ' ') {
      if (state.frame.attention) {
        const current = state.frame.attention.current;
        state.frame = finishTurn(state.frame, { ...current, finishedAt: 420 });
        state.frame = { ...state.frame, attention: null };
        state.previewYaw = 0;
        state.previewPitch = 0;
        updateReadout();
        state.p?.redraw();
      } else commitDefaultTurn();
      return false;
    }
    if (p.key === 'Delete' || p.keyCode === 8) { lift(); return false; }
    if (p.key === 'Escape' || p.key === 'r' || p.key === 'R') { release(); return false; }
    return true;
  };
};

new window.p5(p5Sketch);

document.querySelectorAll('[data-gesture]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.gesture === 'turn') commitDefaultTurn();
    if (button.dataset.gesture === 'lift') lift();
    if (button.dataset.gesture === 'release') release();
  });
});

updateReadout();
