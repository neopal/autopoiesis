import {
  GATE_COUNT,
  STAGES,
  applyExchange,
  buildFrame,
  buildTimeline,
  commitTouch,
  geometrySignature,
  liftLatest,
  previewTouch,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#witness-field');
const canvasHost = document.querySelector('#witness-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;
const CALL_POINT = { x: 0.18, y: 0.28 };
const REPLY_POINT = { x: 0.82, y: 0.68 };

const PALETTE = {
  void: '#0e0c0e',
  deep: '#171215',
  ink: '#3c2b2a',
  warm: '#b86f59',
  ochre: '#d2a16d',
  bone: '#e5d9c2',
  sage: '#9ba58c',
  blue: '#778995',
  shadow: '#080609'
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, canvasHost.clientHeight || Math.min(760, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The body is sealed. It is waiting for a call.',
    'call-preview': 'A witness is near. The body remains exact.',
    'call-refused-miss': 'No edge witness answered. The body stays sealed.',
    'call-armed': 'The call is held in the body. Answer from another edge.',
    'reply-refused-self': 'The first witness cannot answer itself.',
    'reply-refused-near': 'The second witness is too near. Find a different edge.',
    'exchange-committed': 'Two witnesses closed one fold inside the body.',
    lifted: 'The latest fold has been lifted. The prior body returns exactly.',
    'lift-refused': 'There is no recent fold to lift.',
    released: 'The body releases every remembered exchange.',
    timeline: 'Reduced motion holds four witness folds in the body.'
  };
  return messages[interaction] || 'The material is waiting for another witness.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `plate ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering body' : 'sealed body'} · ${frame.memory.length} fold${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.02, Math.min(0.98, (event.clientY - rect.top) / rect.height))
  };
}

function mapPoint(point) {
  return { x: point.x * p5Instance.width, y: point.y * p5Instance.height };
}

function drawAtmosphere() {
  p5Instance.noStroke();
  p5Instance.fill(14, 12, 14, 255);
  p5Instance.rect(0, 0, p5Instance.width, p5Instance.height);
  for (let ring = 6; ring >= 0; ring -= 1) {
    p5Instance.fill(20 + ring * 2, 22, 22, 5 + ring * 2);
    p5Instance.ellipse(p5Instance.width * 0.5, p5Instance.height * 0.5, p5Instance.width * (0.58 + ring * 0.075), p5Instance.height * (0.68 + ring * 0.045));
  }
  p5Instance.stroke(229, 217, 194, 16);
  p5Instance.strokeWeight(0.7);
  for (let line = 0; line < 9; line += 1) {
    const y = p5Instance.height * (0.12 + line * 0.095);
    p5Instance.line(p5Instance.width * 0.08, y, p5Instance.width * 0.92, y + p5Instance.height * 0.025);
  }
}

function drawShadow() {
  p5Instance.push();
  p5Instance.noStroke();
  p5Instance.fill(8, 6, 9, 180);
  p5Instance.ellipse(p5Instance.width * 0.5, p5Instance.height * 0.53, p5Instance.width * 0.38, p5Instance.height * 0.79);
  p5Instance.fill(8, 6, 9, 90);
  p5Instance.ellipse(p5Instance.width * 0.54, p5Instance.height * 0.56, p5Instance.width * 0.48, p5Instance.height * 0.24);
  p5Instance.pop();
}

function drawShell() {
  const shell = frame.body.shell;
  p5Instance.push();
  p5Instance.translate(p5Instance.width * 0.008, p5Instance.height * 0.012);
  p5Instance.noStroke();
  p5Instance.fill(13, 10, 12, 210);
  p5Instance.beginShape();
  shell.forEach((point) => p5Instance.vertex(point.x * p5Instance.width, point.y * p5Instance.height));
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.pop();

  p5Instance.push();
  p5Instance.noStroke();
  p5Instance.fill(16, 36, 31, 245);
  p5Instance.beginShape();
  shell.forEach((point) => p5Instance.vertex(point.x * p5Instance.width, point.y * p5Instance.height));
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.noFill();
  p5Instance.stroke(34, 53, 45, 220);
  p5Instance.strokeWeight(Math.max(1, p5Instance.width * 0.0011));
  p5Instance.beginShape();
  shell.forEach((point) => p5Instance.vertex(point.x * p5Instance.width, point.y * p5Instance.height));
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.pop();
}

function drawBodyRibs() {
  p5Instance.push();
  p5Instance.noFill();
  for (let rib = 0; rib < 24; rib += 1) {
    const x = p5Instance.width * (0.365 + rib * 0.011);
    const top = p5Instance.height * (0.2 + Math.sin(rib * 0.7) * 0.025);
    const bottom = p5Instance.height * (0.78 + Math.cos(rib * 0.44) * 0.02);
    p5Instance.stroke(178, 112, 83, 12 + (rib % 4) * 4);
    p5Instance.strokeWeight(0.55 + (rib % 3) * 0.32);
    p5Instance.beginShape();
    p5Instance.vertex(x, top);
    p5Instance.bezierVertex(x - 22, p5Instance.height * 0.38, x + 18, p5Instance.height * 0.57, x + Math.sin(rib) * 12, bottom);
    p5Instance.endShape();
  }
  p5Instance.pop();
}

function drawVoids() {
  frame.body.voids.forEach((hole, index) => {
    p5Instance.push();
    p5Instance.translate(hole.x * p5Instance.width, hole.y * p5Instance.height);
    p5Instance.rotate(hole.tilt);
    const swell = 1 + hole.opening * 0.25;
    p5Instance.noStroke();
    p5Instance.fill(7, 6, 9, 235);
    p5Instance.ellipse(0, 0, hole.rx * p5Instance.width * 2.0 * swell, hole.ry * p5Instance.height * 2.0 * swell);
    p5Instance.noFill();
    p5Instance.stroke(200, 142, 95, 42 + hole.opening * 75);
    p5Instance.strokeWeight(1.1 + hole.opening * 1.1);
    p5Instance.ellipse(0, 0, hole.rx * p5Instance.width * 2.22 * swell, hole.ry * p5Instance.height * 2.22 * swell);
    p5Instance.stroke(229, 217, 194, 22 + index * 5);
    p5Instance.strokeWeight(0.65);
    p5Instance.arc(0, 0, hole.rx * p5Instance.width * 2.7 * swell, hole.ry * p5Instance.height * 2.7 * swell, -0.8, 1.65);
    p5Instance.pop();
  });
}

function drawFolds() {
  frame.body.folds.forEach((fold) => {
    p5Instance.push();
    p5Instance.noFill();
    p5Instance.stroke(8, 6, 9, 210);
    p5Instance.strokeWeight(Math.max(2.8, p5Instance.width * (0.009 + fold.depth * 0.008)));
    p5Instance.beginShape();
    fold.points.forEach((point) => p5Instance.vertex(point.x * p5Instance.width, point.y * p5Instance.height));
    p5Instance.endShape();
    p5Instance.stroke(193, 121, 87, 105 + fold.depth * 80);
    p5Instance.strokeWeight(Math.max(0.7, p5Instance.width * 0.0017));
    p5Instance.beginShape();
    fold.points.forEach((point) => p5Instance.vertex(point.x * p5Instance.width, point.y * p5Instance.height - point.width * p5Instance.height));
    p5Instance.endShape();
    p5Instance.stroke(229, 217, 194, 28);
    p5Instance.strokeWeight(0.7);
    for (let echo = 1; echo < 4; echo += 1) {
      p5Instance.beginShape();
      fold.points.forEach((point, pointIndex) => {
        const offset = Math.sin((pointIndex / 12) * Math.PI) * echo * 2.2;
        p5Instance.vertex(point.x * p5Instance.width, point.y * p5Instance.height + offset);
      });
      p5Instance.endShape();
    }
    p5Instance.pop();
  });
}

function drawGates() {
  frame.gates.forEach((gate, index) => {
    const point = mapPoint(gate);
    const angle = Math.atan2(gate.y - 0.5, gate.x - 0.5);
    const attention = gate.attention;
    p5Instance.push();
    p5Instance.translate(point.x, point.y);
    p5Instance.rotate(angle);
    p5Instance.noFill();
    p5Instance.stroke(226, 184, 128, 75 + attention * 80);
    p5Instance.strokeWeight(1.15 + attention * 1.2);
    p5Instance.arc(0, 0, 18 + attention * 12, 12 + attention * 8, -0.95, 0.95);
    p5Instance.stroke(229, 217, 194, 42);
    p5Instance.strokeWeight(0.7);
    p5Instance.line(-14, 0, 15, 0);
    p5Instance.pop();
    const highlightedGate = frame.pending.latent ? frame.pending.previewGate : frame.pending.gate;
    if (highlightedGate === index && (frame.pending.previewPoint || frame.pending.point)) {
      p5Instance.push();
      p5Instance.noFill();
      p5Instance.stroke(155, 165, 140, 185);
      p5Instance.strokeWeight(1.4);
      p5Instance.ellipse(point.x, point.y, 33 + Math.sin(p5Instance.frameCount * 0.05) * 2, 33 + Math.sin(p5Instance.frameCount * 0.05) * 2);
      p5Instance.pop();
    }
  });
}

function drawComposition() {
  drawAtmosphere();
  drawShadow();
  drawShell();
  drawBodyRibs();
  drawVoids();
  drawFolds();
  drawGates();
}

function beginTouch(event) {
  if (staticMode) return;
  event.preventDefault();
  tracking = true;
  pointerId = event.pointerId;
  renderer.elt.setPointerCapture?.(event.pointerId);
  renderFrame(previewTouch(frame, normalizedPoint(event)));
}

function moveTouch(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  renderFrame(previewTouch(frame, normalizedPoint(event)));
}

function endTouch(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  renderer.elt.releasePointerCapture?.(event.pointerId);
  renderFrame(commitTouch(frame, normalizedPoint(event), 'visitor-witness'));
  tracking = false;
  pointerId = null;
}

function cancelTouch() {
  tracking = false;
  pointerId = null;
  renderFrame(frame);
}

function performControlCall() {
  if (staticMode) return;
  let next = frame;
  if (next.pending.gate === null) next = commitTouch(next, CALL_POINT, 'control-call');
  if (next.pending.gate !== null) next = commitTouch(next, REPLY_POINT, 'control-reply');
  renderFrame(next);
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginTouch);
  renderer.elt.addEventListener('pointermove', moveTouch);
  renderer.elt.addEventListener('pointerup', endTouch);
  renderer.elt.addEventListener('pointercancel', cancelTouch);
}

function bindControls() {
  document.querySelector('[data-gesture="call"]')?.addEventListener('click', performControlCall);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlCall();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!staticMode) renderFrame(liftLatest(frame));
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      if (!staticMode) renderFrame(releaseField(frame));
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      p5Instance.saveCanvas('mutine-brush-v043', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 255);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV043 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      preview: (point) => renderFrame(previewTouch(frame, point)),
      touch: (point) => renderFrame(commitTouch(frame, point, 'probe-witness')),
      exchange: performControlCall,
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      gateCount: GATE_COUNT,
      ready: true
    };
  };
  p.draw = drawComposition;
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    p.redraw();
  };
};

p5Instance = new window.p5(sketch, canvasHost);
