import {
  applyLift,
  buildFrame,
  buildTimeline,
  commitLift,
  geometrySignature,
  liftLatest,
  previewLift,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#settling-field');
const canvasHost = document.querySelector('#settling-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;

const PALETTE = {
  deep: '#0a0d10',
  ground: '#171313',
  ink: '#f0e2c7',
  clay: '#b59b72',
  coral: '#e28a69',
  moss: '#b8c681',
  blue: '#809aa0',
  plum: '#9a7d90',
  ochre: '#d2b46d',
  shadow: '#07090b'
};
const TONES = [PALETTE.clay, PALETTE.ochre, PALETTE.blue, PALETTE.plum, PALETTE.coral, '#7c8d72'];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let renderer;
let p5Instance;
let dragging = false;
let pointerId = null;
let liftStart = null;
let liftExit = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(460, canvasHost.clientHeight || Math.min(760, width * 0.68));
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

function messageFor(interaction) {
  const messages = {
    baseline: 'The fragments are suspended in their quiet weight.',
    'lift-preview': 'The fragment is lifted only in thought. The archive remains exact.',
    'lift-refused-miss': 'Nothing was held. The archive refuses an empty lift.',
    'lift-refused-direction': 'The fragment did not leave upward. No absence was made.',
    'lift-refused-spent': 'That fragment has already been lifted from this archive.',
    'absence-committed': 'A fragment is gone. The remaining mass is settling through it.',
    lifted: 'The latest absence has been lifted. The earlier weight returns exactly.',
    'lift-refused': 'Nothing is absent enough to lift.',
    released: 'The archive returns to its quiet suspended weight.',
    timeline: 'Reduced motion settles the remembered absences.'
  };
  return messages[interaction] || 'The material is listening for an upward lift.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / 13`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'settling archive' : 'quiet archive'} · ${frame.memory.length} absence${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function drawBackground() {
  const context = p5Instance.drawingContext;
  const gradient = context.createLinearGradient(0, 0, p5Instance.width, p5Instance.height);
  gradient.addColorStop(0, PALETTE.deep);
  gradient.addColorStop(.46, PALETTE.ground);
  gradient.addColorStop(1, '#241512');
  context.fillStyle = gradient;
  context.fillRect(0, 0, p5Instance.width, p5Instance.height);

  p5Instance.noStroke();
  for (let index = 0; index < 180; index += 1) {
    const x = ((index * 83 + 17) % 101) / 100 * p5Instance.width;
    const y = ((index * 47 + 29) % 97) / 96 * p5Instance.height;
    const size = .8 + ((index * 19) % 6) * .35;
    p5Instance.fill(alphaColor(index % 4 === 0 ? PALETTE.moss : PALETTE.ink, 4 + (index % 4) * 2));
    p5Instance.ellipse(x, y, size, size);
  }

  p5Instance.noFill();
  p5Instance.stroke(alphaColor(PALETTE.ink, 22));
  p5Instance.strokeWeight(1);
  p5Instance.beginShape();
  p5Instance.vertex(p5Instance.width * .12, p5Instance.height * .86);
  p5Instance.bezierVertex(p5Instance.width * .34, p5Instance.height * .72, p5Instance.width * .61, p5Instance.height * .93, p5Instance.width * .89, p5Instance.height * .69);
  p5Instance.endShape();
}

function fragmentPoints(fragment, offsetX = 0, offsetY = 0, scale = 1) {
  const points = [];
  const radians = fragment.angle * Math.PI / 180;
  for (let index = 0; index < 9; index += 1) {
    const theta = (Math.PI * 2 * index) / 9;
    const wobble = .84 + ((fragment.id * 17 + index * 23) % 11) / 100;
    const notch = index === (fragment.id % 7) ? 0.75 + fragment.notch * .22 : 1;
    const localX = Math.cos(theta) * fragment.width * .5 * wobble * notch * scale;
    const localY = Math.sin(theta) * fragment.height * .5 * (0.82 + ((fragment.id + index * 5) % 8) / 50) * scale;
    const x = fragment.x + offsetX + (localX * Math.cos(radians) - localY * Math.sin(radians)) / 1;
    const y = fragment.y + offsetY + (localX * Math.sin(radians) + localY * Math.cos(radians)) / 1;
    points.push(toPixel({ x, y }));
  }
  return points;
}

function drawPolygon(points, fill, stroke = null, weight = 1) {
  p5Instance.fill(fill);
  if (stroke) {
    p5Instance.stroke(stroke);
    p5Instance.strokeWeight(weight);
  } else p5Instance.noStroke();
  p5Instance.beginShape();
  points.forEach((point) => p5Instance.vertex(point.x, point.y));
  p5Instance.endShape(p5Instance.CLOSE);
}

function drawCavity(fragment) {
  const shadow = fragmentPoints(fragment, .008, .018, 1.05);
  drawPolygon(shadow, alphaColor(PALETTE.shadow, 180));
  const cavity = fragmentPoints(fragment, 0, 0, .92);
  drawPolygon(cavity, alphaColor(PALETTE.deep, 230), alphaColor(PALETTE.coral, 190), 1.4);
  const inner = fragmentPoints(fragment, -.004, -.004, .54);
  drawPolygon(inner, alphaColor(PALETTE.blue, 28), alphaColor(PALETTE.moss, 112), .9);
}

function drawFragment(fragment) {
  if (fragment.removed) {
    drawCavity(fragment);
    return;
  }
  const shadowOffset = .018 + fragment.settle * .06;
  drawPolygon(fragmentPoints(fragment, .012, shadowOffset, 1.08), alphaColor(PALETTE.shadow, 180));
  drawPolygon(fragmentPoints(fragment, 0, 0, 1), alphaColor(TONES[fragment.tone], 226), alphaColor(PALETTE.ink, 128), 1.05);

  const facet = fragmentPoints(fragment, -.012, -.012, .64);
  drawPolygon(facet, alphaColor(fragment.id % 2 ? PALETTE.ink : PALETTE.blue, 34), null);
  const slash = fragmentPoints(fragment, .006, -.008, .78);
  p5Instance.noFill();
  p5Instance.stroke(alphaColor(fragment.dry > .02 ? PALETTE.coral : PALETTE.ink, 70 + fragment.dry * 90));
  p5Instance.strokeWeight(.7 + fragment.dry * 1.3);
  p5Instance.beginShape();
  slash.slice(1, 6).forEach((point) => p5Instance.vertex(point.x, point.y));
  p5Instance.endShape();

  if (fragment.settle > .004) {
    const edge = fragmentPoints(fragment, 0, -.006, 1.03);
    p5Instance.noFill();
    p5Instance.stroke(alphaColor(PALETTE.moss, 92 + fragment.settle * 280));
    p5Instance.strokeWeight(1.1);
    p5Instance.beginShape();
    edge.slice(2, 7).forEach((point) => p5Instance.vertex(point.x, point.y));
    p5Instance.endShape();
  }
}

function drawPreview() {
  if (!frame.pending?.start || !frame.pending?.exit) return;
  const start = toPixel(frame.pending.start);
  const exit = toPixel(frame.pending.exit);
  p5Instance.push();
  p5Instance.noFill();
  p5Instance.stroke(alphaColor(PALETTE.ink, 190));
  p5Instance.strokeWeight(1.2);
  p5Instance.drawingContext.setLineDash([4, 8]);
  p5Instance.line(start.x, start.y, exit.x, exit.y);
  p5Instance.drawingContext.setLineDash([]);
  p5Instance.fill(alphaColor(PALETTE.coral, 180));
  p5Instance.noStroke();
  p5Instance.ellipse(start.x, start.y, 9, 9);
  p5Instance.fill(alphaColor(PALETTE.moss, 150));
  p5Instance.ellipse(exit.x, exit.y, 7, 7);
  p5Instance.pop();
}

function drawComposition() {
  drawBackground();
  frame.fragments.slice().sort((a, b) => a.y - b.y).forEach(drawFragment);
  drawPreview();
}

function pointFromEvent(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(.02, Math.min(.98, (event.clientX - rect.left) / rect.width)),
    y: Math.max(.02, Math.min(.98, (event.clientY - rect.top) / rect.height))
  };
}

function commitPointerLift() {
  if (!liftStart || !liftExit) return;
  renderFrame(commitLift(frame, liftStart, liftExit, 'visitor-upward-lift'));
  dragging = false;
  pointerId = null;
  liftStart = null;
  liftExit = null;
}

function cancelPointerLift() {
  dragging = false;
  pointerId = null;
  liftStart = null;
  liftExit = null;
  renderFrame(frame);
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', (event) => {
    if (staticMode) return;
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    liftStart = pointFromEvent(event);
    liftExit = liftStart;
    renderer.elt.setPointerCapture?.(event.pointerId);
    renderFrame(previewLift(frame, liftStart, liftExit));
  });
  renderer.elt.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();
    liftExit = pointFromEvent(event);
    renderFrame(previewLift(frame, liftStart, liftExit));
  });
  renderer.elt.addEventListener('pointerup', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    event.preventDefault();
    liftExit = pointFromEvent(event);
    renderer.elt.releasePointerCapture?.(event.pointerId);
    commitPointerLift();
  });
  renderer.elt.addEventListener('pointercancel', cancelPointerLift);
}

function performControlLift() {
  if (!staticMode) renderFrame(applyLift(frame, 5, 'control-lift'));
}

function bindControls() {
  document.querySelector('[data-gesture="lift"]')?.addEventListener('click', performControlLift);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlLift();
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
      p5Instance.saveCanvas('mutine-brush-v040', 'png');
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
    window.__mutineBrushV040 = {
      getFrame: () => frame,
      geometrySignature: () => geometrySignature(frame),
      preview: (start, exit) => renderFrame(previewLift(frame, start, exit)),
      commit: (start, exit) => renderFrame(commitLift(frame, start, exit, 'probe-upward-lift')),
      lift: performControlLift,
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
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
