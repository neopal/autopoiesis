import {
  applyCompression,
  beginCompression,
  buildFrame,
  buildTimeline,
  commitCompression,
  continueCompression,
  geometrySignature,
  liftLatest,
  releaseField,
  STAGES
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#clasp-field');
const canvasHost = document.querySelector('#clasp-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;

const KEYBOARD_LEFT = { x: 0.44, y: 0.38 };
const KEYBOARD_RIGHT = { x: 0.56, y: 0.62 };
const PALETTE = {
  ground: '#0b0b0e',
  shadow: '#050507',
  bone: '#e6d9c0',
  rust: '#c87558',
  amber: '#d8a566',
  moss: '#9da787',
  blue: '#779699',
  violet: '#72586f',
  panels: ['#40333c', '#614449', '#805249', '#9b674e', '#6f575d', '#4d6464', '#344d50', '#4e465c', '#795647']
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(500, canvasHost.clientHeight || Math.min(820, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The clasp is quiet. Pressure needs an opposite.',
    'compression-armed-left': 'The left jaw is held. Draw inward, then release.',
    'compression-armed-right': 'The right jaw is held. Draw inward, then release.',
    'compression-preview': 'One jaw is moving. The produced clasp remains exact.',
    'compression-left-set': 'The left jaw has closed. The other side must answer.',
    'compression-right-set': 'The right jaw has closed. The other side must answer.',
    'compression-refused-interior': 'The material only accepts pressure at an outer jaw.',
    'compression-refused-incomplete': 'The jaw stopped before it could carry pressure inward.',
    'compression-refused-no-handle': 'No jaw is carrying pressure.',
    'compression-refused-order': 'The two jaws cannot pass through one another.',
    'compression-committed': 'Opposed pressure made a remote crease load-bearing.',
    lifted: 'The latest crease has been lifted. The prior clasp returns exactly.',
    'lift-refused': 'There is no recent crease to lift.',
    released: 'The clasp releases every remembered compression.',
    timeline: 'Reduced motion holds four remote creases in the material.'
  };
  return messages[interaction] || 'The material is waiting for opposition.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `clasp ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering compression' : 'quiet material'} · ${frame.memory.length} compression${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.04, Math.min(0.96, (event.clientY - rect.top) / rect.height))
  };
}

function mapPoint(point) {
  return { x: point.x * p5Instance.width, y: point.y * p5Instance.height };
}

function translucent(hex, alpha) {
  const value = p5Instance.color(hex);
  value.setAlpha(alpha);
  return value;
}

function drawAtmosphere() {
  const p = p5Instance;
  p.background(PALETTE.ground);
  p.noStroke();
  p.fill(22, 17, 24, 180);
  p.ellipse(p.width * 0.5, p.height * 0.5, p.width * 0.82, p.height * 0.86);
  p.fill(31, 43, 43, 70);
  p.ellipse(p.width * 0.22, p.height * 0.74, p.width * 0.44, p.height * 0.38);
  p.fill(70, 37, 34, 52);
  p.ellipse(p.width * 0.78, p.height * 0.23, p.width * 0.36, p.height * 0.42);
  p.noFill();
  for (let ring = 0; ring < 10; ring += 1) {
    p.stroke(230, 216, 190, 10 + ring * 2);
    p.strokeWeight(0.5);
    p.ellipse(p.width * 0.5, p.height * 0.5, p.width * (0.22 + ring * 0.058), p.height * (0.25 + ring * 0.047));
  }
}

function drawPanel(panel, index) {
  const p = p5Instance;
  p.push();
  p.noStroke();
  p.fill(PALETTE.panels[index % PALETTE.panels.length]);
  p.beginShape();
  panel.vertices.forEach((vertex) => {
    const mapped = mapPoint(vertex);
    p.vertex(mapped.x, mapped.y);
  });
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(index % 3 === 0 ? PALETTE.bone : PALETTE.rust);
  p.strokeWeight(0.8 + Math.min(1.5, panel.memory * 0.14));
  p.beginShape();
  panel.vertices.forEach((vertex) => {
    const mapped = mapPoint(vertex);
    p.vertex(mapped.x, mapped.y);
  });
  p.endShape(p.CLOSE);
  p.pop();
}

function drawClasp() {
  const p = p5Instance;
  p.push();
  p.noStroke();
  p.fill(PALETTE.shadow);
  p.ellipse(p.width * 0.5, p.height * 0.53, p.width * 0.64, p.height * 0.68);
  p.pop();

  frame.body.panels.forEach(drawPanel);

  p.push();
  p.noFill();
  frame.body.seams.forEach((seam, index) => {
    const x = p.width * seam.a;
    const y = p.height * (0.24 + index * 0.063);
    p.stroke(index % 2 ? PALETTE.blue : PALETTE.bone);
    p.strokeWeight(0.45 + seam.weight * 0.32);
    p.beginShape();
    p.vertex(x, y);
    p.bezierVertex(p.width * 0.42, y + p.height * seam.bend, p.width * 0.58, y - p.height * seam.bend, p.width * seam.b, p.height * (0.76 - index * 0.04));
    p.endShape();
  });
  p.pop();

  frame.body.openings.forEach((opening, index) => {
    const point = mapPoint(opening);
    p.push();
    p.translate(point.x, point.y);
    p.rotate(opening.tilt);
    p.noStroke();
    p.fill(PALETTE.shadow);
    p.ellipse(0, 0, opening.rx * p.width * 2.2, opening.ry * p.height * 2.2);
    p.noFill();
    p.stroke(index % 2 ? PALETTE.blue : PALETTE.amber);
    p.strokeWeight(0.65 + opening.open * 0.85);
    p.arc(0, 0, opening.rx * p.width * 2.2, opening.ry * p.height * 2.2, -0.9, 2.2);
    p.pop();
  });

  frame.body.creases.forEach((crease) => {
    const point = mapPoint(crease);
    p.push();
    p.translate(point.x, point.y);
    p.rotate(crease.twist);
    p.stroke(PALETTE.bone);
    p.strokeWeight(0.8 + crease.depth * 1.4);
    p.line(-crease.length * p.width, -crease.length * p.height * 0.22, crease.length * p.width, crease.length * p.height * 0.22);
    p.stroke(PALETTE.rust);
    p.strokeWeight(0.5);
    p.line(-crease.length * p.width * 0.8, crease.length * p.height * 0.42, crease.length * p.width * 0.72, -crease.length * p.height * 0.38);
    p.pop();
  });
}

function drawGuides() {
  if (document.documentElement.classList.contains('blind-mode')) return;
  const p = p5Instance;
  p.push();
  p.stroke(translucent(PALETTE.moss, 90));
  p.strokeWeight(0.75);
  p.line(p.width * 0.08, p.height * 0.14, p.width * 0.08, p.height * 0.86);
  p.line(p.width * 0.92, p.height * 0.14, p.width * 0.92, p.height * 0.86);
  p.stroke(translucent(PALETTE.bone, 30));
  p.line(p.width * 0.34, p.height * 0.12, p.width * 0.34, p.height * 0.88);
  p.line(p.width * 0.66, p.height * 0.12, p.width * 0.66, p.height * 0.88);
  p.noStroke();
  p.fill(translucent(PALETTE.moss, 120));
  p.ellipse(p.width * 0.08, p.height * 0.5, 5, 5);
  p.ellipse(p.width * 0.92, p.height * 0.5, 5, 5);
  if (frame.pending.active && frame.pending.path.length > 1) {
    p.noFill();
    p.stroke(translucent(PALETTE.bone, 160));
    p.strokeWeight(1.2);
    p.beginShape();
    frame.pending.path.forEach((point) => {
      const mapped = mapPoint(point);
      p.vertex(mapped.x, mapped.y);
    });
    p.endShape();
  }
  p.pop();
}

function drawComposition() {
  drawAtmosphere();
  drawClasp();
  drawGuides();
}

function beginPointer(event) {
  if (staticMode) return;
  event.preventDefault();
  tracking = true;
  pointerId = event.pointerId;
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
  renderFrame(beginCompression(frame, normalizedPoint(event)));
}

function movePointer(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  renderFrame(continueCompression(frame, normalizedPoint(event)));
}

function endPointer(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
  renderFrame(commitCompression(frame, normalizedPoint(event), 'visitor-opposing-compression'));
  tracking = false;
  pointerId = null;
}

function cancelPointer() {
  tracking = false;
  pointerId = null;
  renderFrame(frame);
}

function performControlCompression() {
  if (staticMode) return;
  renderFrame(applyCompression(frame, KEYBOARD_LEFT, KEYBOARD_RIGHT, 'control-opposing-compression'));
}

function performKeyboardSide(side) {
  if (staticMode) return;
  const point = side === 'left' ? KEYBOARD_LEFT : KEYBOARD_RIGHT;
  renderFrame(commitCompression(beginCompression(frame, side === 'left' ? { x: 0.08, y: point.y } : { x: 0.92, y: point.y }), point, 'keyboard-opposing-compression'));
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginPointer);
  renderer.elt.addEventListener('pointermove', movePointer);
  renderer.elt.addEventListener('pointerup', endPointer);
  renderer.elt.addEventListener('pointercancel', cancelPointer);
}

function bindControls() {
  document.querySelector('[data-gesture="compress"]')?.addEventListener('click', performControlCompression);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      performKeyboardSide('left');
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      performKeyboardSide('right');
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlCompression();
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
      p5Instance.saveCanvas('mutine-brush-v045', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.RGB, 255, 255, 255, 255);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV045 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      compress: performControlCompression,
      begin: (point) => renderFrame(beginCompression(frame, point)),
      continue: (point) => renderFrame(continueCompression(frame, point)),
      commit: (point) => renderFrame(commitCompression(frame, point, 'probe-opposing-compression')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      panelCount: frame.body.panels.length,
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
