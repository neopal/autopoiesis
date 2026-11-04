import {
  applyAttention,
  buildFrame,
  buildTimeline,
  commitAttention,
  focusAt,
  geometrySignature,
  liftLatest,
  releaseField,
  CELL_COUNT,
  STAGES
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#drying-field');
const canvasHost = document.querySelector('#dry-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1' || reducedMotion;

const PALETTE = {
  paper: [42, 18, 93],
  paperGlow: [37, 24, 98],
  ink: [214, 33, 18],
  navy: [218, 44, 24],
  rust: [15, 68, 68],
  saffron: [38, 72, 82],
  moss: [154, 31, 53],
  blue: [188, 43, 56],
  line: [214, 28, 24],
  dry: [28, 24, 92]
};
const CELL_COLORS = [PALETTE.ink, PALETTE.navy, PALETTE.rust, PALETTE.saffron, PALETTE.moss, PALETTE.blue];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let tracking = false;
let pointerId = null;
let hoverPoint = null;
let keyboardCell = 0;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const preview = document.documentElement.classList.contains('preview-mode');
  const height = preview ? Math.max(460, window.innerHeight) : Math.max(500, canvasHost.clientHeight || Math.min(820, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The field is quiet. Attention must find a patch.',
    'attention-preview': 'The patch has noticed you. Its own skin stays exact.',
    'attention-refused-empty': 'Empty ground cannot answer. Find a patch.',
    'attention-refused-unfocused': 'Attention needs a situated patch before it can be spent.',
    'attention-committed': 'The patch stayed exact. Another skin has dried.',
    lifted: 'The latest response has been lifted. The prior field returns exactly.',
    'lift-refused': 'There is no recent response to lift.',
    released: 'The field releases every remembered response.',
    timeline: 'Reduced motion holds four reciprocal drying responses.'
  };
  return messages[interaction] || 'The field is waiting for situated attention.';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  if (stageReadout) stageReadout.textContent = `DRY ${String(frame.stage + 1).padStart(2, '0')} / ${String(STAGES).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'remembering attention' : 'quiet field'} · ${frame.memory.length} response${frame.memory.length === 1 ? '' : 's'}`;
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

function cellPosition(cell, p) {
  return { x: cell.x * p.width, y: cell.y * p.height };
}

function activeCellId() {
  return Number.isInteger(frame.pending?.sourceCell) ? frame.pending.sourceCell : -1;
}

function drawPaper(p) {
  p.background(...PALETTE.paper);
  p.noStroke();
  for (let ring = 0; ring < 12; ring += 1) {
    const alpha = 3 + ring * 0.7;
    p.fill(...PALETTE.paperGlow, alpha);
    const x = p.width * (0.5 + Math.sin(ring * 1.37) * 0.26);
    const y = p.height * (0.48 + Math.cos(ring * 1.11) * 0.25);
    p.ellipse(x, y, p.width * (0.54 - ring * 0.018), p.height * (0.48 - ring * 0.014));
  }
  p.stroke(...PALETTE.line, 5);
  p.strokeWeight(0.6);
  for (let index = 0; index < 38; index += 1) {
    const x = ((index * 83) % 137) / 137 * p.width;
    const y = ((index * 47 + 19) % 113) / 113 * p.height;
    const r = 2 + ((index * 17) % 9);
    p.arc(x, y, r * 3, r * 2, 0.2 + index * 0.12, 1.2 + index * 0.13);
  }
}

function drawSeams(p) {
  p.noFill();
  frame.body.seams.forEach((seam, index) => {
    const a = frame.body.cells[seam.a];
    const b = frame.body.cells[seam.b];
    const pa = cellPosition(a, p);
    const pb = cellPosition(b, p);
    const bend = (index % 2 ? -1 : 1) * p.width * (0.025 + seam.tension * 0.025);
    p.stroke(...PALETTE.line, 18 + seam.tension * 22);
    p.strokeWeight(0.7 + seam.tension * 0.9);
    p.bezier(pa.x, pa.y, (pa.x + pb.x) * 0.5 + bend, pa.y, (pa.x + pb.x) * 0.5 - bend, pb.y, pb.x, pb.y);
    if (seam.gap < 0.09) {
      p.stroke(...PALETTE.rust, 28);
      p.strokeWeight(2.4);
      p.point((pa.x + pb.x) * 0.5, (pa.y + pb.y) * 0.5);
    }
  });
}

function drawDryFringe(p, cell, center, color) {
  if (!cell.responseCount) return;
  for (let pass = 0; pass < cell.responseCount + 1; pass += 1) {
    p.noFill();
    p.stroke(...color, 38 - pass * 5);
    p.strokeWeight(1.1 + pass * 0.45);
    const radius = cell.radius * p.width * (1.2 + pass * 0.08);
    p.arc(center.x, center.y, radius * 1.95, radius * 1.34, cell.notch * 4.5 + 0.2, cell.notch * 4.5 + 2.1);
  }
}

function drawCell(p, cell, index) {
  const center = cellPosition(cell, p);
  const scale = Math.min(p.width, p.height);
  const radius = cell.radius * scale;
  const focus = activeCellId() === cell.id ? (frame.pending.affinity || 0) : 0;
  const pointerPull = hoverPoint && cell.id === activeCellId() ? 0.06 * focus : 0;
  const color = CELL_COLORS[index % CELL_COLORS.length];
  p.push();
  p.translate(center.x, center.y);
  p.rotate(cell.tilt + pointerPull);
  p.noStroke();
  p.fill(...color, 92);
  p.ellipse(0, 0, radius * 2.02, radius * 1.42);
  p.beginShape();
  const points = 13;
  for (let step = 0; step <= points; step += 1) {
    const angle = (step / points) * Math.PI * 2;
    const jag = 0.86 + 0.12 * Math.sin(index * 1.9 + step * 2.7);
    let distance = radius * jag;
    const notchAngle = cell.notch * Math.PI * 2;
    const delta = Math.abs(Math.atan2(Math.sin(angle - notchAngle), Math.cos(angle - notchAngle)));
    if (delta < 0.48 + cell.responseCount * 0.08) distance *= 0.57 + delta * 0.42;
    p.vertex(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.72);
  }
  p.endShape(p.CLOSE);

  p.fill(...PALETTE.paper, 80 + cell.responseCount * 4);
  p.beginShape();
  p.vertex(0, 0);
  for (let step = -2; step <= 2; step += 1) {
    const angle = cell.notch * Math.PI * 2 + step * 0.13;
    const notchRadius = radius * (0.62 + cell.responseCount * 0.1);
    p.vertex(Math.cos(angle) * notchRadius, Math.sin(angle) * notchRadius * 0.72);
  }
  p.endShape(p.CLOSE);

  p.noFill();
  p.stroke(...PALETTE.dry, 46 + cell.responseCount * 12);
  p.strokeWeight(0.9 + cell.responseCount * 0.55);
  p.arc(0, 0, radius * 1.48, radius * 1.04, cell.notch * Math.PI * 2 + 0.34, cell.notch * Math.PI * 2 + 1.7 + cell.responseCount * 0.16);
  p.stroke(...PALETTE.paperGlow, 26 + focus * 28);
  p.strokeWeight(1.3);
  p.arc(0, 0, radius * 1.72, radius * 1.2, cell.notch * Math.PI * 2 + 2.05, cell.notch * Math.PI * 2 + 4.3);
  p.pop();

  drawDryFringe(p, cell, center, color);
  if (focus > 0) {
    p.noFill();
    p.stroke(...PALETTE.saffron, 42 + focus * 35);
    p.strokeWeight(1.2);
    p.arc(center.x, center.y, radius * 2.8, radius * 1.9, cell.notch * Math.PI * 2 - 0.4, cell.notch * Math.PI * 2 + 1.45);
  }
}

function drawResponses(p) {
  frame.body.responses.forEach((response, index) => {
    const source = frame.body.cells[response.sourceCell];
    const respondent = frame.body.cells[response.responseCell];
    const a = cellPosition(source, p);
    const b = cellPosition(respondent, p);
    p.noFill();
    p.stroke(...PALETTE.rust, 24 + response.intensity * 28);
    p.strokeWeight(1.1 + response.intensity);
    const bend = (index % 2 ? -1 : 1) * p.width * 0.055;
    p.bezier(a.x, a.y, (a.x + b.x) * 0.5 + bend, a.y + bend, (a.x + b.x) * 0.5 - bend, b.y - bend, b.x, b.y);
    p.stroke(...PALETTE.saffron, 44);
    p.strokeWeight(2.2);
    p.point(b.x, b.y);
  });
}

function drawComposition(p) {
  drawPaper(p);
  drawSeams(p);
  drawResponses(p);
  frame.body.cells.forEach((cell, index) => drawCell(p, cell, index));
  if (hoverPoint && !staticMode) {
    p.noFill();
    p.stroke(...PALETTE.saffron, 22);
    p.strokeWeight(0.8);
    p.ellipse(hoverPoint.x * p.width, hoverPoint.y * p.height, 18, 18);
  }
}

function beginPointer(event) {
  if (staticMode) return;
  event.preventDefault();
  tracking = true;
  pointerId = event.pointerId;
  try { renderer.elt.setPointerCapture?.(event.pointerId); } catch {}
  const point = normalizedPoint(event);
  hoverPoint = point;
  renderFrame(focusAt(frame, point));
}

function movePointer(event) {
  if (staticMode) return;
  const point = normalizedPoint(event);
  hoverPoint = point;
  if (!tracking || event.pointerId !== pointerId) {
    renderFrame(focusAt(frame, point));
    return;
  }
  renderFrame(focusAt(frame, point));
}

function endPointer(event) {
  if (!tracking || event.pointerId !== pointerId) return;
  event.preventDefault();
  try { renderer.elt.releasePointerCapture?.(event.pointerId); } catch {}
  const point = normalizedPoint(event);
  hoverPoint = point;
  const focused = focusAt(frame, point);
  renderFrame(commitAttention(focused, 'visitor-attention'));
  tracking = false;
  pointerId = null;
}

function cancelPointer() {
  tracking = false;
  pointerId = null;
  hoverPoint = null;
  renderFrame(frame);
}

function performControlAttention() {
  if (staticMode) return;
  keyboardCell = (keyboardCell + frame.memory.length + 1) % CELL_COUNT;
  renderFrame(applyAttention(frame, keyboardCell, 'control-attention'));
}

function performKeyboardStep(key) {
  if (staticMode) return;
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    keyboardCell = (keyboardCell + 1) % CELL_COUNT;
    const cell = frame.body.cells[keyboardCell];
    renderFrame(focusAt(frame, { x: cell.x, y: cell.y }));
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    keyboardCell = (keyboardCell - 1 + CELL_COUNT) % CELL_COUNT;
    const cell = frame.body.cells[keyboardCell];
    renderFrame(focusAt(frame, { x: cell.x, y: cell.y }));
  }
  if (key === 'Enter' || key === ' ') renderFrame(commitAttention(frame, 'keyboard-attention'));
}

function bindCanvasEvents() {
  renderer.elt.addEventListener('pointerdown', beginPointer);
  renderer.elt.addEventListener('pointermove', movePointer);
  renderer.elt.addEventListener('pointerup', endPointer);
  renderer.elt.addEventListener('pointercancel', cancelPointer);
  renderer.elt.addEventListener('pointerleave', () => { if (!tracking) { hoverPoint = null; renderFrame(frame); } });
}

function bindControls() {
  document.querySelector('[data-gesture="attend"]')?.addEventListener('click', performControlAttention);
  document.querySelector('[data-gesture="latest"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
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
      p5Instance.saveCanvas('mutine-brush-v047', 'png');
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
    window.__mutineBrushV047 = {
      getFrame: () => frame,
      getState: () => ({ memory: frame.memory.length, pending: frame.pending, interaction: frame.interaction }),
      geometrySignature: () => geometrySignature(frame),
      attend: performControlAttention,
      focus: (point) => renderFrame(focusAt(frame, point)),
      commit: () => renderFrame(commitAttention(frame, 'probe-attention')),
      liftLatest: () => renderFrame(liftLatest(frame)),
      release: () => renderFrame(releaseField(frame)),
      cellPoint: (index) => { const cell = frame.body.cells[((index % CELL_COUNT) + CELL_COUNT) % CELL_COUNT]; return { x: cell.x, y: cell.y }; },
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
