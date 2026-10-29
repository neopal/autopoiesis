// signal-lattice renderer: a flat plate whose archive is produced by remote cell state.
import {
  STAGES,
  GRID_COLS,
  GRID_ROWS,
  buildFrame,
  buildTimeline,
  beginSignal,
  aimSignal,
  finishSignal,
  liftLatestSignal,
  releaseArchive,
  defaultSignal
} from './engine.mjs';

const frameElement = document.querySelector('.signal-frame');
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
  p: null
};
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const pseudo = (value) => {
  const raw = Math.sin(value * 14.731 + 1.91) * 43758.5453;
  return raw - Math.floor(raw);
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

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const startProbe = (point, at = performance.now()) => {
  state.frame = beginSignal(state.frame, { ...point, armedAt: at });
  updateReadout();
  state.p?.redraw();
};

const aimProbe = (point) => {
  if (!state.frame.attention) return;
  state.frame = aimSignal(state.frame, point);
  updateReadout();
  state.p?.redraw();
};

const finishProbe = (point, at = performance.now()) => {
  if (!state.frame.attention) return;
  setFrame(finishSignal(state.frame, { ...point, confirmedAt: at, confirmed: true }));
};

const commitDefaultSignal = () => {
  const signal = defaultSignal(state.frame);
  const armed = beginSignal(state.frame, { ...signal.source, armedAt: 0 });
  setFrame(finishSignal(armed, { ...signal.target, confirmedAt: 240, confirmed: true }));
};

const lift = () => setFrame(liftLatestSignal(state.frame));
const release = () => setFrame(releaseArchive());

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `cycle ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'signal' : 'signals'}`;
  rendererElement.textContent = `P5.JS / CANVAS 2D / SIGNAL LATTICE${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  if (state.frame.lastAction === 'signal-committed') statusElement.textContent = 'released · a remote consensus wakes';
  else if (state.frame.lastAction === 'probe-armed' || state.frame.lastAction === 'probe-aimed') statusElement.textContent = 'probe only · release to let the lattice decide';
  else if (state.frame.lastAction === 'signal-refused-unconfirmed') statusElement.textContent = 'the archive refuses · confirm the signal';
  else if (state.frame.lastAction === 'signal-refused-no-probe') statusElement.textContent = 'no probe offered · the plate stays quiet';
  else if (state.frame.lastAction === 'signal-lifted') statusElement.textContent = 'latest consensus lifted · the prior plate returns';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift a signal before releasing again';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive cleared · the quiet plate returns';
  else statusElement.textContent = 'move near a cell, then release one signal';
};

const drawBackdrop = (p, width, height, time) => {
  p.background(198, 46, 7);
  p.noStroke();
  for (let index = 0; index < 32; index += 1) {
    const y = (index / 31) * height;
    const warmth = Math.sin(index * 0.31 + time * 0.00008) * 4;
    p.fill(178 + warmth, 42, 7 + index * 0.18, 0.25);
    p.rect(0, y, width, height / 30 + 1);
  }
  p.stroke(177, 26, 34, 0.12);
  p.strokeWeight(1);
  for (let index = 0; index < 18; index += 1) {
    const x = (index + 0.5) * width / 18;
    p.line(x, 0, x + height * 0.2, height);
  }
};

const drawPlateFrame = (p, x, y, width, height) => {
  p.push();
  p.noStroke();
  p.fill(195, 38, 5, 0.56);
  p.rect(x + 7, y + 10, width, height, 2);
  p.fill(194, 42, 8, 0.98);
  p.rect(x, y, width, height, 2);
  p.stroke(169, 29, 38, 0.6);
  p.strokeWeight(1);
  p.noFill();
  p.rect(x + 8, y + 8, width - 16, height - 16, 1);
  p.stroke(177, 23, 48, 0.28);
  p.line(x + width * 0.06, y + height * 0.14, x + width * 0.94, y + height * 0.14);
  p.line(x + width * 0.06, y + height * 0.86, x + width * 0.94, y + height * 0.86);
  p.pop();
};

const drawCell = (p, cell, x, y, width, height, time, index) => {
  const livePulse = state.motion ? Math.sin(time * 0.00125 + cell.phase * TAU + cell.row * 0.08) * 0.035 : 0;
  const load = clamp(cell.load + livePulse, 0.04, 0.98);
  const hasVoid = cell.gap > 0.42;
  const hue = (167 - load * 142 + cell.col * 0.32 + (cell.row % 3) * 5 + 360) % 360;
  const brightness = 19 + load * 65;
  const saturation = 34 + load * 52;
  const skew = cell.tilt * width * 0.38;
  const inset = Math.max(1.1, Math.min(width, height) * 0.14);
  const left = x + inset;
  const right = x + width - inset;
  const top = y + inset;
  const bottom = y + height - inset;

  p.push();
  p.noStroke();
  p.fill(hue, saturation, brightness, hasVoid ? 0.46 : 0.84);
  p.beginShape();
  p.vertex(left + skew, top);
  p.vertex(right + skew * 0.35, top + height * 0.04);
  p.vertex(right - skew * 0.48, bottom);
  p.vertex(left - skew * 0.18, bottom - height * 0.02);
  p.endShape(p.CLOSE);

  if (hasVoid) {
    p.fill(194, 42, 8, 0.92);
    p.beginShape();
    p.vertex(left + width * 0.28, top + height * 0.16);
    p.vertex(right - width * 0.18, top + height * 0.14);
    p.vertex(right - width * 0.3, bottom - height * 0.15);
    p.vertex(left + width * 0.12, bottom - height * 0.2);
    p.endShape(p.CLOSE);
  } else {
    p.stroke((hue + 34) % 360, 33, 92, 0.52);
    p.strokeWeight(Math.max(0.45, width * 0.035));
    const notch = mix(left, right, 0.24 + cell.phase * 0.52);
    p.line(notch, top + height * 0.16, notch + skew * 0.26, bottom - height * 0.16);
    if (cell.grain > 0.62) {
      p.stroke((hue + 175) % 360, 26, 88, 0.26);
      p.line(left + width * 0.18, bottom - height * 0.18, right - width * 0.15, top + height * 0.2);
    }
  }
  p.pop();

  if (index % 29 === 0 && !blindMode) {
    p.push();
    p.stroke(173, 28, 90, 0.18);
    p.strokeWeight(0.6);
    p.line(x + width * 0.06, y + height * 0.5, x + width * 0.94, y + height * 0.5);
    p.pop();
  }
};

const drawProbe = (p, x, y, width, height) => {
  if (!state.frame.attention || blindMode) return;
  const point = state.frame.attention.current;
  const px = x + point.x * width;
  const py = y + point.y * height;
  p.push();
  p.noFill();
  p.stroke(53, 28, 96, 0.9);
  p.strokeWeight(1.2);
  p.circle(px, py, Math.max(14, Math.min(width, height) * 0.04));
  p.stroke(23, 28, 94, 0.62);
  p.line(px - 12, py, px + 12, py);
  p.line(px, py - 12, px, py + 12);
  p.pop();
};

const render = (p) => {
  const width = p.width;
  const height = p.height;
  const time = performance.now();
  drawBackdrop(p, width, height, time);

  const plateWidth = Math.min(width * 0.86, height * 1.48);
  const plateHeight = Math.min(height * 0.68, plateWidth * 0.56);
  const plateX = (width - plateWidth) * 0.5;
  const plateY = height * 0.18;
  drawPlateFrame(p, plateX, plateY, plateWidth, plateHeight);

  const cellWidth = plateWidth / GRID_COLS;
  const cellHeight = plateHeight / GRID_ROWS;
  state.frame.field.cells.forEach((cell, index) => {
    const rowShift = (cell.row % 2) * cellWidth * 0.18;
    const x = plateX + cell.col * cellWidth + rowShift;
    const y = plateY + cell.row * cellHeight;
    drawCell(p, cell, x, y, cellWidth, cellHeight, time, index);
  });

  p.push();
  p.noFill();
  p.stroke(48, 23, 95, 0.54);
  p.strokeWeight(Math.max(0.7, Math.min(width, height) * 0.0012));
  p.rect(plateX - 12, plateY - 12, plateWidth + 24, plateHeight + 24, 2);
  p.stroke(28, 28, 86, 0.38);
  p.line(plateX - 24, plateY + plateHeight + 28, plateX + plateWidth * 0.42, plateY + plateHeight + 28);
  p.pop();
  drawProbe(p, plateX, plateY, plateWidth, plateHeight);
};

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#signal-field');
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    canvas.id('signal-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A computational signal lattice with remote consensus memories');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    placeholder?.replaceWith(canvas.elt);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.frameRate(30);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV038 = {
      getState: () => ({
        stage: state.frame.stage,
        memory: state.frame.memory.length,
        signature: state.frame.field.signature,
        attention: Boolean(state.frame.attention),
        lastAction: state.frame.lastAction,
        kind: state.frame.field.kind,
        cells: state.frame.field.cells.map((cell) => ({ id: cell.id, load: cell.load, phase: cell.phase, gap: cell.gap, tilt: cell.tilt })),
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
    if (p.mouseEvent?.target && p.mouseEvent.target !== state.canvas) return true;
    startProbe(pointFromP5(p), performance.now());
    state.canvas?.focus({ preventScroll: true });
    return false;
  };
  p.mouseMoved = () => {
    aimProbe(pointFromP5(p));
    return false;
  };
  p.mouseReleased = () => {
    if (p.mouseEvent?.target && p.mouseEvent.target !== state.canvas) return true;
    finishProbe(pointFromP5(p), performance.now());
    return false;
  };
  p.touchStarted = () => {
    startProbe(pointFromP5(p), performance.now());
    state.canvas?.focus({ preventScroll: true });
    return false;
  };
  p.touchMoved = () => {
    aimProbe(pointFromClient(p.touches?.[0]?.x ?? p.mouseX, p.touches?.[0]?.y ?? p.mouseY));
    return false;
  };
  p.touchEnded = () => {
    finishProbe(pointFromClient(p.mouseX, p.mouseY), performance.now());
    return false;
  };
  p.keyPressed = () => {
    if (p.key === 'Enter' || p.key === ' ') commitDefaultSignal();
    if (p.key === 'Delete' || p.key === 'Backspace') lift();
    if (p.key === 'Escape' || p.key === 'r' || p.key === 'R') release();
    return false;
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const broadcastButton = document.querySelector('[data-gesture="broadcast"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [broadcastButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
}
broadcastButton?.addEventListener('click', commitDefaultSignal);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
