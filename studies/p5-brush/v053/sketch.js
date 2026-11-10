import {
  buildFrame,
  buildTimeline,
  commitPass,
  geometrySignature,
  liftLatest,
  releaseMembrane
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#membrane-field');
const canvasHost = document.querySelector('#membrane-canvas');
const stageReadout = document.querySelector('[data-membrane-stage]');
const memoryReadout = document.querySelector('[data-membrane-memory]');
const selectionReadout = document.querySelector('[data-selection]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1';
const blindMode = params.get('blind') === '1';

const PALETTE = {
  night: [276, 34, 9],
  nightGlow: [287, 28, 18],
  ground: [274, 25, 13],
  groundLine: [286, 22, 33],
  ink: [36, 19, 94],
  ochre: [38, 62, 89],
  coral: [13, 63, 90],
  blue: [187, 37, 77],
  sage: [71, 38, 82],
  lime: [71, 42, 88],
  plum: [304, 35, 67],
  shadow: [273, 35, 4],
  quiet: [278, 22, 7]
};
const SEAM_COLORS = [PALETTE.blue, PALETTE.coral, PALETTE.sage, PALETTE.ochre, PALETTE.plum, PALETTE.blue, PALETTE.coral];
const PASS_PLAN = [
  { entry: 'west', exit: 'east', pressure: 0.76, settle: 0.82, arc: 0.28 },
  { entry: 'north', exit: 'south', pressure: 0.64, settle: 0.78, arc: -0.22 },
  { entry: 'east', exit: 'west', pressure: 0.71, settle: 0.88, arc: 0.31 },
  { entry: 'south', exit: 'north', pressure: 0.83, settle: 0.74, arc: -0.18 }
];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let backdrop;
let activePointerId = null;
let pointerStartEdge = null;
let gesturePath = [];
let selectedPass = frame.memory.length % PASS_PLAN.length;
let time = 0;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const height = document.documentElement.classList.contains('preview-mode')
    ? Math.max(420, window.innerHeight)
    : Math.max(520, canvasHost.clientHeight || Math.min(760, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    'dry membrane': 'The membrane is quiet. Cross it, then let the pressure settle.',
    'pass committed': 'The crossing dried into the whole skin. The hand path is gone.',
    'refused / same edge': 'The membrane refuses a passage that returns to the same edge.',
    'refused / pressure did not settle': 'The pressure did not settle. Nothing dried into the skin.',
    'refused / passage was too short': 'That passage did not cross enough material to dry.',
    'refused / incomplete passage': 'Begin near one edge, cross the skin, and release near another.',
    'refused / membrane is dry': 'Four crossings are retained. Lift one before crossing again.',
    'lifted / exact': 'The latest crossing is lifted. The preceding skin returns exactly.',
    'lift refused / membrane is quiet': 'There is no crossing to lift.'
  };
  return messages[interaction] || messages['dry membrane'];
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  const plan = PASS_PLAN[selectedPass];
  if (stageReadout) stageReadout.textContent = `PASS ${String(frame.memory.length).padStart(2, '0')} / 04`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'drying toward pressure' : 'dry membrane'} · ${frame.memory.length} crossing${frame.memory.length === 1 ? '' : 's'} retained`;
  if (selectionReadout) selectionReadout.textContent = `${plan.entry} → ${plan.exit} / ${frame.interaction === 'pass committed' ? 'dried' : 'ready'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function edgeAt(point) {
  const margin = 0.14;
  if (point.x <= margin) return 'west';
  if (point.x >= 1 - margin) return 'east';
  if (point.y <= margin) return 'north';
  if (point.y >= 1 - margin) return 'south';
  return null;
}

function pathLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length;
}

function eventFromGesture(points, entry, exit) {
  const length = pathLength(points);
  const middle = points[Math.floor(points.length / 2)] || { x: 0.5, y: 0.5 };
  let arc = (middle.y - 0.5) * 1.8;
  if (Math.abs(arc) < 0.08) arc = entry === 'west' || entry === 'north' ? 0.16 : -0.16;
  const pressure = Math.max(0.45, Math.min(0.96, 0.53 + length * 0.34));
  return { entry, exit, pressure, settle: points.length > 2 ? 0.82 : 0.7, arc };
}

function commitGesture(event) {
  const result = commitPass(frame, event);
  renderFrame({ ...result.field, selectedEntry: event.entry, selectedExit: event.exit });
}

function commitPlannedPass() {
  commitGesture(PASS_PLAN[selectedPass]);
}

function lift() {
  renderFrame({ ...liftLatest(frame), selectedEntry: PASS_PLAN[selectedPass].entry, selectedExit: PASS_PLAN[selectedPass].exit });
}

function release() {
  renderFrame({ ...releaseMembrane(), selectedEntry: PASS_PLAN[selectedPass].entry, selectedExit: PASS_PLAN[selectedPass].exit });
}

function drawBackdropLayer(g) {
  g.colorMode(g.HSB, 360, 100, 100, 100);
  g.background(...PALETTE.night);
  g.noStroke();
  for (let ring = 0; ring < 28; ring += 1) {
    const amount = ring / 28;
    g.fill(275 + amount * 22, 24 + amount * 16, 8 + amount * 12, 4.2);
    g.ellipse(g.width * (0.48 + Math.sin(ring * 1.7) * 0.04), g.height * (0.5 + Math.cos(ring * 1.31) * 0.04), g.width * (1.34 - amount * 0.62), g.height * (1.28 - amount * 0.56));
  }
  g.stroke(...PALETTE.groundLine, 13);
  g.strokeWeight(0.55);
  for (let index = 0; index < 150; index += 1) {
    const x = g.width * (0.03 + ((index * 0.6180339887) % 0.94));
    const y = g.height * (0.02 + ((index * 0.4142135623) % 0.94));
    const length = 2 + Math.abs(Math.sin(index * 11.31)) * 13;
    g.line(x, y, x + length, y - length * 0.26);
  }
}

function pointToCanvas(point, p, dx = 0, dy = 0) {
  return { x: point.x * p.width + dx, y: point.y * p.height + dy };
}

function drawPolygon(p, nodes, dx = 0, dy = 0) {
  p.beginShape();
  nodes.forEach((node) => {
    const point = pointToCanvas(node, p, dx, dy);
    p.vertex(point.x, point.y);
  });
  p.endShape(p.CLOSE);
}

function drawSeam(p, seam, colour, weight, alpha, phaseOffset = 0) {
  if (!seam.points.length) return;
  p.push();
  p.noFill();
  p.stroke(...colour, alpha);
  p.strokeWeight(weight);
  p.beginShape();
  const points = seam.points;
  p.curveVertex(points[0].x * p.width, points[0].y * p.height);
  points.forEach((point, index) => {
    const sway = Math.sin(time * 0.7 + index * 0.21 + phaseOffset) * (reducedMotion ? 0 : 1.4);
    p.curveVertex(point.x * p.width, point.y * p.height + sway);
  });
  p.curveVertex(points.at(-1).x * p.width, points.at(-1).y * p.height);
  p.endShape();
  p.pop();
}

function drawMembrane(p) {
  const nodes = frame.body.nodes;
  const scale = Math.min(p.width, p.height);
  p.push();
  p.noStroke();
  p.fill(...PALETTE.shadow, 68);
  drawPolygon(p, nodes, scale * 0.021, scale * 0.026);
  p.fill(...PALETTE.blue, 25);
  drawPolygon(p, nodes, -scale * 0.011, scale * 0.009);
  p.fill(...PALETTE.ochre, 92);
  drawPolygon(p, nodes);
  p.fill(...PALETTE.coral, 17 + frame.memory.length * 4);
  drawPolygon(p, nodes, -scale * 0.008, -scale * 0.005);
  p.noFill();
  p.stroke(...PALETTE.ink, 64);
  p.strokeWeight(Math.max(0.8, scale * 0.0012));
  drawPolygon(p, nodes);
  p.pop();

  frame.body.seams.forEach((seam, index) => {
    const colour = SEAM_COLORS[(index + frame.memory.length) % SEAM_COLORS.length];
    drawSeam(p, seam, colour, Math.max(1, scale * (0.0014 + (index % 2) * 0.0007)), 34 + index * 5, index * 0.44);
    if (index % 2 === 0) drawSeam(p, seam, PALETTE.ink, Math.max(0.45, scale * 0.00055), 28, index * 0.44 + 1.4);
  });

  p.push();
  p.noFill();
  p.stroke(...PALETTE.lime, 15 + frame.memory.length * 5);
  p.strokeWeight(Math.max(0.7, scale * 0.0008));
  for (let pass = 0; pass < frame.memory.length; pass += 1) {
    const y = p.height * (0.3 + pass * 0.11);
    p.beginShape();
    for (let step = 0; step <= 20; step += 1) {
      const u = step / 20;
      const x = p.width * (0.22 + u * 0.56);
      const bend = Math.sin(u * Math.PI * 2 + pass * 0.9 + time * 0.15) * p.height * 0.014;
      p.vertex(x, y + bend);
    }
    p.endShape();
  }
  p.pop();

  if (!blindMode && gesturePath.length > 1) {
    p.push();
    p.noFill();
    p.stroke(...PALETTE.lime, 66);
    p.strokeWeight(Math.max(1.2, scale * 0.0015));
    p.beginShape();
    gesturePath.forEach((point) => p.vertex(point.x * p.width, point.y * p.height));
    p.endShape();
    p.pop();
  }
}

function drawFrame(p) {
  p.image(backdrop, 0, 0, p.width, p.height);
  drawMembrane(p);
  if (!reducedMotion && !staticMode) time += 0.016;
}

function attachEvents() {
  const canvas = renderer.elt;
  canvas.addEventListener('pointerdown', (event) => {
    if (staticMode || blindMode) return;
    const point = normalizedPoint(event);
    pointerStartEdge = edgeAt(point);
    gesturePath = pointerStartEdge ? [point] : [];
    activePointerId = pointerStartEdge ? event.pointerId : null;
    if (activePointerId !== null) canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (staticMode || blindMode || event.pointerId !== activePointerId) return;
    gesturePath.push(normalizedPoint(event));
    event.preventDefault();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (staticMode || blindMode || event.pointerId !== activePointerId) return;
    gesturePath.push(normalizedPoint(event));
    const exit = edgeAt(gesturePath.at(-1));
    const eventData = pointerStartEdge && exit ? eventFromGesture(gesturePath, pointerStartEdge, exit) : { entry: pointerStartEdge, exit, pressure: 0, settle: 0, arc: 0 };
    activePointerId = null;
    if (pointerStartEdge && exit) commitGesture(eventData);
    else renderFrame({ ...frame, interaction: 'refused / incomplete passage' });
    pointerStartEdge = null;
    gesturePath = [];
    event.preventDefault();
  });
  canvas.addEventListener('pointercancel', () => {
    activePointerId = null;
    pointerStartEdge = null;
    gesturePath = [];
    renderFrame({ ...frame, interaction: 'refused / incomplete passage' });
  });
  document.querySelectorAll('[data-gesture]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.gesture === 'pass') commitPlannedPass();
      if (button.dataset.gesture === 'lift') lift();
      if (button.dataset.gesture === 'release') release();
    });
  });
}

function handleKey(event) {
  const key = event.key;
  if (['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Delete', 'Backspace', 'Escape'].includes(key)) event.preventDefault();
  if (key === 'ArrowLeft') {
    selectedPass = (selectedPass + PASS_PLAN.length - 1) % PASS_PLAN.length;
    renderFrame({ ...frame, interaction: 'dry membrane' });
  }
  if (key === 'ArrowRight') {
    selectedPass = (selectedPass + 1) % PASS_PLAN.length;
    renderFrame({ ...frame, interaction: 'dry membrane' });
  }
  if (key === 'Enter' || key === ' ') commitPlannedPass();
  if (key === 'Delete' || key === 'Backspace') lift();
  if (key === 'Escape' || key.toLowerCase() === 'r') release();
  if (key.toLowerCase() === 's' && p5Instance) p5Instance.saveCanvas('mutine-brush-v053', 'png');
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.frameRate(reducedMotion ? 20 : 30);
    backdrop = p.createGraphics(size.width, size.height);
    backdrop.pixelDensity(1);
    drawBackdropLayer(backdrop);
    p5Instance = p;
    attachEvents();
    field.addEventListener('keydown', handleKey);
    window._p5Ready = true;
    window.__mutineBrushV053 = {
      ready: true,
      getFrame: () => frame,
      geometrySignature: () => geometrySignature(frame),
      pass: (event = PASS_PLAN[selectedPass]) => { commitGesture(event); return frame; },
      lift: () => { lift(); return frame; },
      release: () => { release(); return frame; }
    };
    if (staticMode) p.noLoop();
    renderFrame(frame);
  };
  p.draw = () => drawFrame(p);
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    backdrop = p.createGraphics(size.width, size.height);
    backdrop.pixelDensity(1);
    drawBackdropLayer(backdrop);
    p.redraw();
  };
};

new p5(sketch);
