import {
  applyControlStroke,
  applyStroke,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  previewStroke,
  releaseMaterial
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#crease-field');
const canvasHost = document.querySelector('#crease-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const blind = params.get('blind') === '1';
const staticMode = params.get('static') === '1' || reducedMotion;

const PALETTE = {
  deep: '#09100d',
  ground: '#111513',
  ink: '#e7dfc8',
  clay: '#a99876',
  clayLight: '#d2c7a7',
  salmon: '#dc826e',
  moss: '#b4c77c',
  blue: '#779792',
  void: '#192c25',
  shadow: '#07100c'
};

let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let renderer;
let p5Instance;
let drawing = false;
let pointerId = null;
let strokePoints = [];
let strokeStartedAt = 0;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, Math.min(760, width * 0.68));
  return { width, height };
}

function alphaColor(hex, alpha) {
  const value = p5Instance.color(hex);
  value.setAlpha(alpha);
  return value;
}

function toPixel(point) {
  return { x: point.x * p5Instance.width, y: point.y * p5Instance.height };
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  const phase = frame.drying?.phase || 'wet';
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / 13`;
  if (memoryReadout) memoryReadout.textContent = `${phase} sheet · ${frame.memory.length} crease${frame.memory.length === 1 ? '' : 's'}`;
  const messages = {
    baseline: 'The sheet is still wet.',
    'stroke-preview': 'The pressure is present, but the sheet has not hardened.',
    'stroke-refused-short': 'The sheet refused that small gesture.',
    'stroke-refused-overheld': 'The pressure held too long and collapsed.',
    'crease-committed': 'The incision hardened where you drew it.',
    lifted: 'The latest incision has been lifted.',
    'lift-refused': 'Nothing is hardened to lift.',
    released: 'The sheet has returned to wet.',
    timeline: 'Reduced motion settles the remembered drying.'
  };
  if (stateReadout) stateReadout.textContent = messages[frame.interaction] || 'The sheet is listening.';
  if (p5Instance) p5Instance.redraw();
}

function drawGradient() {
  const context = p5Instance.drawingContext;
  const gradient = context.createLinearGradient(0, 0, 0, p5Instance.height);
  gradient.addColorStop(0, PALETTE.deep);
  gradient.addColorStop(0.55, PALETTE.ground);
  gradient.addColorStop(1, '#18231d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, p5Instance.width, p5Instance.height);

  p5Instance.noStroke();
  for (let index = 0; index < 160; index += 1) {
    const x = ((index * 83) % 101) / 100 * p5Instance.width;
    const y = ((index * 47 + 13) % 97) / 96 * p5Instance.height;
    const size = 1 + ((index * 19) % 7) * 0.32;
    p5Instance.fill(alphaColor(index % 3 === 0 ? PALETTE.moss : PALETTE.ink, 5 + (index % 4) * 2));
    p5Instance.ellipse(x, y, size, size);
  }
}

function drawBodyShadow() {
  p5Instance.push();
  p5Instance.translate(0, 17);
  p5Instance.fill(alphaColor(PALETTE.shadow, 174));
  p5Instance.noStroke();
  p5Instance.beginShape();
  frame.body.forEach((vertex) => {
    const point = toPixel(vertex);
    p5Instance.vertex(point.x, point.y);
  });
  p5Instance.endShape(p5Instance.CLOSE);
  p5Instance.pop();
}

function drawBody() {
  drawBodyShadow();
  p5Instance.push();
  p5Instance.noStroke();
  p5Instance.fill(alphaColor(PALETTE.clay, 228));
  p5Instance.beginShape();
  frame.body.forEach((vertex) => {
    const point = toPixel(vertex);
    p5Instance.vertex(point.x, point.y);
  });
  p5Instance.endShape(p5Instance.CLOSE);

  p5Instance.noFill();
  p5Instance.stroke(alphaColor(PALETTE.ink, 126));
  p5Instance.strokeWeight(1.25);
  p5Instance.beginShape();
  frame.body.forEach((vertex) => {
    const point = toPixel(vertex);
    p5Instance.vertex(point.x, point.y - vertex.depth * 7);
  });
  p5Instance.endShape(p5Instance.CLOSE);

  frame.body.forEach((vertex, index) => {
    if (vertex.depth <= 0.03) return;
    const point = toPixel(vertex);
    const next = toPixel(frame.body[(index + 1) % frame.body.length]);
    p5Instance.stroke(alphaColor(index % 2 ? PALETTE.salmon : PALETTE.blue, 38 + vertex.depth * 80));
    p5Instance.strokeWeight(1 + vertex.depth * 2.5);
    p5Instance.line(point.x, point.y, next.x, next.y);
  });
  p5Instance.pop();
}

function drawChambers() {
  frame.chambers.forEach((chamber, index) => {
    const point = toPixel(chamber);
    const scale = 1 + chamber.dent * 0.26;
    const width = chamber.rx * p5Instance.width * scale;
    const height = chamber.ry * p5Instance.height * scale;
    const open = Math.min(1, chamber.opening / 1.4);

    p5Instance.push();
    p5Instance.translate(point.x, point.y);
    p5Instance.rotate(chamber.tilt);
    p5Instance.noStroke();
    p5Instance.fill(alphaColor(index % 3 === 0 ? PALETTE.clayLight : PALETTE.blue, 92 + chamber.dry * 34));
    p5Instance.ellipse(0, 0, width, height);
    p5Instance.fill(alphaColor(PALETTE.void, 128 + open * 100));
    p5Instance.ellipse(0, 0, width * (0.42 + open * 0.34), height * (0.38 + open * 0.30));
    if (open > 0.06) {
      p5Instance.noFill();
      p5Instance.stroke(alphaColor(PALETTE.salmon, 110 + open * 80));
      p5Instance.strokeWeight(0.8 + open * 1.4);
      p5Instance.ellipse(0, 0, width * (0.62 + open * 0.30), height * (0.60 + open * 0.28));
      p5Instance.stroke(alphaColor(PALETTE.moss, 78 + chamber.dry * 38));
      p5Instance.strokeWeight(0.7);
      p5Instance.arc(0, 0, width * 1.12, height * 1.10, Math.PI * 0.12, Math.PI * 1.22);
    }
    p5Instance.pop();
  });
}

function drawCreasePath(crease, index) {
  if (!crease.path.length) return;
  p5Instance.push();
  p5Instance.noFill();
  p5Instance.strokeJoin(p5Instance.ROUND);
  p5Instance.strokeCap(p5Instance.ROUND);
  p5Instance.beginShape();
  crease.path.forEach((point) => {
    const pixel = toPixel(point);
    p5Instance.vertex(pixel.x, pixel.y + Math.sin(index * 2.1 + pixel.x * 0.01) * 1.5);
  });
  p5Instance.endShape();
  p5Instance.pop();

  p5Instance.push();
  p5Instance.noFill();
  p5Instance.strokeJoin(p5Instance.ROUND);
  p5Instance.strokeCap(p5Instance.ROUND);
  p5Instance.stroke(alphaColor(PALETTE.shadow, 210));
  p5Instance.strokeWeight(8 + crease.depth * 8);
  p5Instance.beginShape();
  crease.path.forEach((point) => {
    const pixel = toPixel(point);
    p5Instance.vertex(pixel.x, pixel.y);
  });
  p5Instance.endShape();
  p5Instance.stroke(alphaColor(PALETTE.salmon, 148 + crease.dry * 18));
  p5Instance.strokeWeight(2.1 + crease.width * 18);
  p5Instance.beginShape();
  crease.path.forEach((point) => {
    const pixel = toPixel(point);
    p5Instance.vertex(pixel.x, pixel.y);
  });
  p5Instance.endShape();
  p5Instance.pop();
}

function drawDryingFrontier(crease) {
  if (!crease.path.length) return;
  p5Instance.push();
  p5Instance.noFill();
  p5Instance.stroke(alphaColor(PALETTE.moss, 176));
  p5Instance.strokeWeight(1);
  p5Instance.drawingContext.setLineDash([3, 7]);
  p5Instance.beginShape();
  crease.path.forEach((point) => {
    const pixel = toPixel(point);
    p5Instance.vertex(pixel.x, pixel.y - 7);
  });
  p5Instance.endShape();
  p5Instance.drawingContext.setLineDash([]);
  p5Instance.pop();
}

function drawPreview() {
  if (!frame.pending.points || frame.pending.points.length < 2) return;
  p5Instance.push();
  p5Instance.noFill();
  p5Instance.stroke(alphaColor(PALETTE.ink, 190));
  p5Instance.strokeWeight(1.5);
  p5Instance.drawingContext.setLineDash([4, 8]);
  p5Instance.beginShape();
  frame.pending.points.forEach((point) => {
    const pixel = toPixel(point);
    p5Instance.vertex(pixel.x, pixel.y);
  });
  p5Instance.endShape();
  p5Instance.drawingContext.setLineDash([]);
  p5Instance.noStroke();
  frame.pending.points.forEach((point, index) => {
    const pixel = toPixel(point);
    p5Instance.fill(alphaColor(index === frame.pending.points.length - 1 ? PALETTE.salmon : PALETTE.ink, 170));
    p5Instance.ellipse(pixel.x, pixel.y, index === frame.pending.points.length - 1 ? 9 : 4, index === frame.pending.points.length - 1 ? 9 : 4);
  });
  p5Instance.pop();
}

function drawComposition() {
  drawGradient();
  drawBody();
  drawChambers();
  frame.creases.forEach(drawCreasePath);
  if (frame.creases.length) drawDryingFrontier(frame.creases.at(-1));
  drawPreview();
}

function pointFromEvent(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0.05, Math.min(0.95, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.10, Math.min(0.90, (event.clientY - rect.top) / rect.height))
  };
}

function appendPoint(point) {
  const last = strokePoints.at(-1);
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.008) strokePoints.push(point);
}

function commitPointerStroke() {
  const duration = Math.max(1, Date.now() - strokeStartedAt);
  renderFrame(applyStroke(frame, strokePoints, duration, 'visitor-crease'));
  strokePoints = [];
  drawing = false;
  pointerId = null;
}

function releasePointerStroke() {
  strokePoints = [];
  drawing = false;
  pointerId = null;
  renderFrame(frame);
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', (event) => {
    if (staticMode) return;
    event.preventDefault();
    drawing = true;
    pointerId = event.pointerId;
    strokeStartedAt = Date.now();
    strokePoints = [pointFromEvent(event)];
    renderer.elt.setPointerCapture?.(event.pointerId);
    renderFrame(previewStroke(frame, strokePoints));
  });
  renderer.elt.addEventListener('pointermove', (event) => {
    if (!drawing || event.pointerId !== pointerId) return;
    event.preventDefault();
    appendPoint(pointFromEvent(event));
    renderFrame(previewStroke(frame, strokePoints));
  });
  renderer.elt.addEventListener('pointerup', (event) => {
    if (!drawing || event.pointerId !== pointerId) return;
    event.preventDefault();
    appendPoint(pointFromEvent(event));
    commitPointerStroke();
  });
  renderer.elt.addEventListener('pointercancel', releasePointerStroke);
}

function performControlCrease() {
  renderFrame(applyControlStroke(frame, frame.memory.length));
}

function bindControls() {
  document.querySelector('[data-gesture="crease"]')?.addEventListener('click', performControlCrease);
  document.querySelector('[data-gesture="lift"]')?.addEventListener('click', () => renderFrame(liftLatest(frame)));
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => renderFrame(releaseMaterial()));
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlCrease();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      renderFrame(liftLatest(frame));
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      renderFrame(releaseMaterial());
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      p5Instance.saveCanvas('mutine-brush-v037', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV037 = {
      getFrame: () => frame,
      geometrySignature: () => geometrySignature(frame),
      performStroke: (points, duration = 420) => renderFrame(applyStroke(frame, points, duration, 'probe-crease')),
      performCrease: performControlCrease,
      lift: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseMaterial()),
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
