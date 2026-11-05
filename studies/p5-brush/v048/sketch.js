import {
  BAND_COUNT,
  BLOOM_COUNT,
  STAGES,
  applyStroke,
  beginStroke,
  buildFrame,
  buildTimeline,
  finishStroke,
  gatePoint,
  geometrySignature,
  liftLatest,
  moveStroke,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#wash-field');
const canvasHost = document.querySelector('#wash-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;
const blindMode = params.get('blind') === '1';

const PALETTE = {
  deep: [211, 46, 11],
  deepGlow: [193, 31, 17],
  clay: [18, 69, 75],
  ember: [14, 72, 87],
  coral: [11, 64, 86],
  mint: [157, 32, 74],
  saffron: [39, 66, 92],
  lilac: [246, 26, 82],
  line: [43, 20, 92],
  gate: [43, 64, 93],
  pale: [42, 23, 91]
};
const BAND_COLORS = [PALETTE.clay, PALETTE.coral, PALETTE.mint, PALETTE.saffron, PALETTE.lilac];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;
let hoverPoint = null;
let keyboardStep = 0;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(500, canvasHost.clientHeight || Math.min(820, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    quiet: 'The sheet is quiet. Pressure must enter at the first gate.',
    'stroke-started': 'Pressure has entered. Do not leave the sequence early.',
    'stroke-tracing': 'The route is only a probe. Cross the next pressure band.',
    'stroke-refused-start': 'The first gate is elsewhere. Empty ground cannot spend pressure.',
    'stroke-refused-order': 'The wash refuses that order. The gates must be crossed in sequence.',
    'stroke-refused-incomplete': 'The pressure left too soon. No scar, no regrowth.',
    'stroke-committed': 'The route vanished. An untouched bloom has regrown elsewhere.',
    lifted: 'The latest regrowth has been lifted. The prior wash returns exactly.',
    'lift-refused': 'There is no recent regrowth to lift.',
    released: 'The sheet releases every remembered regrowth.',
    timeline: 'Reduced motion holds four remote regrowths.'
  };
  return messages[interaction] || 'The wash is listening for pressure.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `WASH ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering pressure' : 'quiet sheet'} · ${frame.memory.length} regrowth${frame.memory.length === 1 ? '' : 's'}`;
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

function screenPoint(point, p) {
  return { x: point.x * p.width, y: point.y * p.height };
}

function drawBackground(p) {
  p.background(...PALETTE.deep);
  p.noStroke();
  for (let ring = 0; ring < 14; ring += 1) {
    p.fill(...PALETTE.deepGlow, 4 + ring * 0.65);
    const x = p.width * (0.47 + Math.sin(ring * 1.17) * 0.33);
    const y = p.height * (0.52 + Math.cos(ring * 1.43) * 0.28);
    p.ellipse(x, y, p.width * (0.7 - ring * 0.026), p.height * (0.7 - ring * 0.03));
  }
  p.stroke(...PALETTE.line, 12);
  p.strokeWeight(0.6);
  frame.body.grains.forEach((grain, index) => {
    const x = grain.x * p.width;
    const y = grain.y * p.height;
    p.line(x, y, x + Math.cos(grain.angle) * grain.length * p.width, y + Math.sin(grain.angle) * grain.length * p.width);
    if (index % 5 === 0) p.point(x + 4, y - 3);
  });
}

function drawBand(p, band, index) {
  const points = band.path.map((point) => screenPoint(point, p));
  const left = [];
  const right = [];
  for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
    const previous = points[Math.max(0, pointIndex - 1)];
    const next = points[Math.min(points.length - 1, pointIndex + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const magnitude = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / magnitude;
    const ny = dx / magnitude;
    const width = p.height * band.spread * (0.84 + 0.16 * Math.sin(pointIndex * 0.9 + index));
    left.push({ x: points[pointIndex].x + nx * width, y: points[pointIndex].y + ny * width });
    right.push({ x: points[pointIndex].x - nx * width, y: points[pointIndex].y - ny * width });
  }

  const color = BAND_COLORS[index % BAND_COLORS.length];
  p.push();
  p.noStroke();
  p.fill(...color, 38 + band.opacity * 40);
  p.beginShape();
  left.forEach((point) => p.vertex(point.x, point.y));
  [...right].reverse().forEach((point) => p.vertex(point.x, point.y));
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke(...PALETTE.pale, 17 + band.weight * 18);
  p.strokeWeight(0.65 + band.weight * 0.55);
  p.beginShape();
  points.forEach((point) => p.vertex(point.x, point.y));
  p.endShape();
  p.stroke(...color, 34);
  p.strokeWeight(1.1);
  p.beginShape();
  points.forEach((point, pointIndex) => {
    if (pointIndex % 2 === index % 2) p.vertex(point.x + 2, point.y - 1);
  });
  p.endShape();
  p.pop();
}

function drawBloom(p, bloom, index) {
  const center = screenPoint(bloom, p);
  const scale = Math.min(p.width, p.height);
  const rx = bloom.rx * scale;
  const ry = bloom.ry * scale;
  const color = BAND_COLORS[(index + 2) % BAND_COLORS.length];
  p.push();
  p.translate(center.x, center.y);
  p.rotate(bloom.tilt);
  p.noStroke();
  p.fill(...color, 80 + bloom.bloomCount * 5);
  p.beginShape();
  const points = 28;
  for (let step = 0; step < points; step += 1) {
    const angle = step / points * Math.PI * 2;
    const fold = 0.86 + 0.12 * Math.sin(angle * 3 + bloom.fold * 2.5 + index);
    const notch = Math.max(0, Math.cos(angle - bloom.fold * 3.7)) * bloom.bloomCount * 0.045;
    p.vertex(Math.cos(angle) * rx * (fold - notch), Math.sin(angle) * ry * (fold - notch));
  }
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(...PALETTE.pale, 25 + bloom.edge * 24);
  p.strokeWeight(1 + bloom.bloomCount * 0.7);
  p.arc(0, 0, rx * 1.55, ry * 1.5, bloom.fold * 2, bloom.fold * 2 + 3.6);
  p.stroke(...PALETTE.line, 33 + bloom.bloomCount * 12);
  p.strokeWeight(0.8);
  p.arc(0, 0, rx * 1.24, ry * 1.15, bloom.fold * 2 + 2.8, bloom.fold * 2 + 5.2);
  if (bloom.bloomCount > 0) {
    p.noStroke();
    p.fill(...PALETTE.saffron, 28 + bloom.bloomCount * 12);
    for (let petal = 0; petal < bloom.bloomCount + 1; petal += 1) {
      const angle = bloom.fold * 3 + petal * 1.7;
      p.ellipse(Math.cos(angle) * rx * 0.52, Math.sin(angle) * ry * 0.44, rx * 0.2, ry * 0.14);
    }
  }
  p.pop();
}

function drawGates(p) {
  if (blindMode) return;
  frame.body.gates.forEach((gate, index) => {
    const point = screenPoint(gate, p);
    const radius = gate.radius * Math.min(p.width, p.height);
    const active = frame.pending.active && frame.pending.order.includes(index);
    p.push();
    p.noFill();
    p.stroke(...PALETTE.gate, active ? 80 : 34);
    p.strokeWeight(active ? 1.7 : 0.8);
    p.arc(point.x, point.y, radius * 2.1, radius * 1.35, index * 1.7, index * 1.7 + 4.2);
    p.stroke(...PALETTE.ember, active ? 80 : 22);
    p.strokeWeight(0.7);
    p.line(point.x - radius * 0.58, point.y, point.x + radius * 0.58, point.y);
    p.pop();
  });
}

function drawPreview(p) {
  if (!frame.pending.active || frame.pending.points.length < 2 || staticMode) return;
  p.noFill();
  p.stroke(...PALETTE.saffron, 74);
  p.strokeWeight(2.2);
  p.beginShape();
  frame.pending.points.forEach((point) => {
    const screen = screenPoint(point, p);
    p.vertex(screen.x, screen.y);
  });
  p.endShape();
  const last = screenPoint(frame.pending.lastPoint, p);
  p.stroke(...PALETTE.pale, 80);
  p.strokeWeight(1);
  p.ellipse(last.x, last.y, 12, 12);
}

function drawComposition(p) {
  drawBackground(p);
  frame.body.bands.forEach((band, index) => drawBand(p, band, index));
  frame.body.blooms.forEach((bloom, index) => drawBloom(p, bloom, index));
  drawGates(p);
  drawPreview(p);
  if (hoverPoint && !staticMode && !frame.pending.active) {
    const point = screenPoint(hoverPoint, p);
    p.noFill();
    p.stroke(...PALETTE.ember, 28);
    p.strokeWeight(0.8);
    p.ellipse(point.x, point.y, 18, 18);
  }
}

function beginPointer(event) {
  if (staticMode) return;
  event.preventDefault();
  pointerId = event.pointerId;
  const point = normalizedPoint(event);
  const next = beginStroke(frame, point);
  if (!next.pending.active) {
    renderFrame(next);
    pointerId = null;
    return;
  }
  tracking = true;
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
  hoverPoint = point;
  renderFrame(next);
}

function movePointer(event) {
  if (staticMode) return;
  const point = normalizedPoint(event);
  hoverPoint = point;
  if (tracking && event.pointerId === pointerId) renderFrame(moveStroke(frame, point));
  else if (!frame.pending.active) renderFrame(frame);
}

function endPointer(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
  const point = normalizedPoint(event);
  frame = finishStroke(frame, point, 'visitor-stroke');
  tracking = false;
  pointerId = null;
  hoverPoint = point;
  keyboardStep = 0;
  renderFrame(frame);
}

function cancelPointer() {
  tracking = false;
  pointerId = null;
  hoverPoint = null;
  renderFrame(buildFrame(frame.stage, frame.memory));
}

function performControlPress() {
  if (staticMode) return;
  keyboardStep = 0;
  renderFrame(applyStroke(frame, 'control-stroke'));
}

function performKeyboardStep(key) {
  if (staticMode) return;
  if (key === 'ArrowRight') {
    const next = keyboardStep === 0
      ? beginStroke(frame, gatePoint(frame, 0))
      : moveStroke(frame, gatePoint(frame, Math.min(2, keyboardStep)));
    frame = next;
    keyboardStep = Math.min(3, keyboardStep + 1);
    renderFrame(frame);
  }
  if ((key === 'Enter' || key === ' ') && keyboardStep >= 3) {
    frame = finishStroke(frame, { x: 0.94, y: 0.5 }, 'keyboard-stroke');
    keyboardStep = 0;
    renderFrame(frame);
  }
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginPointer);
  renderer.elt.addEventListener('pointermove', movePointer);
  renderer.elt.addEventListener('pointerup', endPointer);
  renderer.elt.addEventListener('pointercancel', cancelPointer);
  renderer.elt.addEventListener('pointerleave', () => { if (!tracking) { hoverPoint = null; renderFrame(frame); } });
}

function bindControls() {
  document.querySelector('[data-gesture="press"]')?.addEventListener('click', performControlPress);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performKeyboardStep(event.key);
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
      p5Instance.saveCanvas('mutine-brush-v048', 'png');
    }
  });
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.setAttributes('antialias', true);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.noLoop();
    bindCanvasEvents();
    bindControls();
    renderFrame(frame);
    window._p5Ready = true;
    window.__mutineBrushV048 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      press: performControlPress,
      begin: (point) => renderFrame(beginStroke(frame, point)),
      move: (point) => renderFrame(moveStroke(frame, point)),
      finish: (point) => renderFrame(finishStroke(frame, point, 'probe-stroke')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      gatePoint: (index) => gatePoint(frame, index),
      ready: true
    };
  };
  p.draw = () => drawComposition(p);
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    p.redraw();
  };
};

p5Instance = new window.p5(sketch, canvasHost);
