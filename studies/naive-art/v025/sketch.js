import {
  MEMORY_WINDOW,
  STAGES,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestPressure,
  pressAt,
  releasePressure
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3400;

const field = document.querySelector('#pressure-sheet');
const canvasHost = document.querySelector('#sheet-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const pressControl = document.querySelector('#press-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');

let startedAt = performance.now();
let currentFrame = timeline[0];
let interactionFrame = null;
let lastInteraction = 'sequence';
let pointerDown = null;

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : currentFrame);
}

function setInteraction(value) {
  lastInteraction = value;
  field.dataset.interaction = value;
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.memory.length,
    memoryWindow: MEMORY_WINDOW,
    pressureCount: frame.scene.trace.pressureCount,
    changedPieceCount: frame.scene.trace.changedPieceCount,
    globalCut: frame.scene.trace.globalCut,
    aperture: frame.scene.aperture,
    interaction: interactionFrame?.interaction ?? lastInteraction,
    geometrySignature: geometrySignature(frame),
    p5Canvas2d: true
  };
}

window.__mutineNaiveV025 = { getState: stateSnapshot };
field.dataset.witness = 'global-pressure-cut';
if (staticPreview) {
  field.tabIndex = -1;
  field.removeAttribute('aria-keyshortcuts');
}
if (blindMode) field.setAttribute('aria-label', 'A dense paper construction whose global aperture changes under pressure');

function renderFrame(frame) {
  stageReadout.textContent = `stage ${String(frame.stage).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} pressure cut${frame.memory.length === 1 ? '' : 's'}`;
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.globalCut = String(frame.scene.trace.globalCut);
  field.dataset.changedPieces = String(frame.scene.trace.changedPieceCount);
  field.dataset.geometrySignature = geometrySignature(frame);
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function commit(point = {}, duration = 180) {
  interactionFrame = pressAt(activeFrame(), { ...point, duration });
  setInteraction('pressure-committed');
  renderFrame(interactionFrame);
}

function lift() {
  interactionFrame = liftLatestPressure(activeFrame());
  setInteraction('pressure-lifted');
  renderFrame(interactionFrame);
}

function release() {
  interactionFrame = releasePressure();
  setInteraction('released');
  renderFrame(interactionFrame);
}

function pointerPoint(event) {
  const rect = field.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0.68, y: 0.34 };
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

field.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  pointerDown = { ...pointerPoint(event), at: performance.now(), pointerId: event.pointerId };
  field.setPointerCapture?.(event.pointerId);
});
field.addEventListener('pointerup', (event) => {
  if (!pointerDown) return;
  const duration = performance.now() - pointerDown.at;
  const point = pointerPoint(event);
  if (duration >= 140) commit(point, duration);
  else setInteraction('short-press-refused');
  pointerDown = null;
});
field.addEventListener('pointercancel', () => { pointerDown = null; setInteraction('press-cancelled'); });
pressControl.addEventListener('click', () => commit({ x: 0.68, y: 0.34 }, 220));
undoControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);
field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit({ x: 0.68, y: 0.34 }, 220); }
  if (event.key === 'Delete') { event.preventDefault(); lift(); }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
  if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    const blob = new Blob([JSON.stringify(stateSnapshot(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mutine-naive-v025-state.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }
});

function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawBackground(p) {
  p.noStroke();
  for (let y = 0; y < p.height; y += 4) {
    const t = y / p.height;
    p.fill(p.lerpColor(p.color('#1b2a31'), p.color('#30464a'), t));
    p.rect(0, y, p.width, 4);
  }
  p.fill('rgba(221,181,105,0.10)');
  p.ellipse(p.width * .18, p.height * .18, p.width * .62, p.height * .55);
  p.fill('rgba(52,120,123,0.15)');
  p.ellipse(p.width * .86, p.height * .82, p.width * .72, p.height * .65);
  for (let i = 0; i < 420; i += 1) {
    const x = (i * 83 % 997) / 997 * p.width;
    const y = (i * 47 % 991) / 991 * p.height;
    const alpha = 0.025 + (i % 5) * 0.009;
    p.fill(`rgba(238,222,177,${alpha})`);
    p.circle(x, y, 1 + (i % 3));
  }
}

function toCanvas(p, point) {
  return [(point[0] - .5) * p.width, (point[1] - .5) * p.height];
}

function drawAperture(p, aperture) {
  const [cx, cy] = toCanvas(p, [aperture.x, aperture.y]);
  p.push();
  p.translate(cx, cy);
  p.rotate(aperture.rotation);
  p.noStroke();
  p.fill('#1c2b31');
  p.beginShape();
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    const wobble = 1 + Math.sin(i * 2.7 + aperture.rotation) * .10;
    p.vertex(Math.cos(angle) * aperture.width * p.width * .52 * wobble, Math.sin(angle) * aperture.radius * p.height * .60 * wobble);
  }
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke('rgba(244,211,155,.66)');
  p.strokeWeight(1.2);
  p.beginShape();
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18;
    p.vertex(Math.cos(angle) * aperture.width * p.width * .58, Math.sin(angle) * aperture.radius * p.height * .68);
  }
  p.endShape(p.CLOSE);
  p.pop();
}

function drawCutLine(p, cutLine) {
  const [x, y] = toCanvas(p, [cutLine.x, cutLine.y]);
  p.push();
  p.translate(x, y);
  p.rotate(cutLine.angle);
  p.stroke('rgba(37,51,52,.72)');
  p.strokeWeight(1.4);
  p.drawingContext.setLineDash([8, 11]);
  p.line(0, 0, cutLine.length * p.width, 0);
  p.drawingContext.setLineDash([]);
  p.pop();
}

function drawPiece(p, piece, index) {
  const shadow = piece.points.map(([x, y]) => toCanvas(p, [x + .012, y + .018]));
  p.noStroke();
  p.fill('rgba(8,17,19,.38)');
  p.beginShape();
  shadow.forEach(([x, y]) => p.vertex(x, y));
  p.endShape(p.CLOSE);

  p.stroke('rgba(26,42,43,.76)');
  p.strokeWeight(1.1);
  p.fill(piece.tone);
  p.beginShape();
  piece.points.forEach((point) => { const [x, y] = toCanvas(p, point); p.vertex(x, y); });
  p.endShape(p.CLOSE);

  p.push();
  p.noFill();
  p.stroke(rgba('#fff0c8', .30));
  p.strokeWeight(.9);
  p.beginShape();
  piece.points.slice(0, 4).forEach(([x0, y0], pointIndex) => {
    const inset = .018 + (pointIndex % 2) * .006;
    const x = x0 + (piece.cx - x0) * inset;
    const y = y0 + (piece.cy - y0) * inset;
    const canvasPoint = toCanvas(p, [x, y]);
    p.vertex(canvasPoint[0], canvasPoint[1]);
  });
  p.endShape();
  p.pop();

  const [cx, cy] = toCanvas(p, [piece.cx, piece.cy]);
  p.stroke(rgba('#263b3e', .28));
  p.strokeWeight(1);
  for (let mark = 0; mark < 3; mark += 1) {
    const offset = (mark - 1) * p.width * .018;
    p.line(cx - p.width * .025 + offset, cy + p.height * .025, cx + p.width * .015 + offset, cy - p.height * .012);
  }
  if (index % 3 === 0) {
    p.noStroke();
    p.fill('rgba(255,236,190,.20)');
    p.circle(cx - p.width * .025, cy - p.height * .025, 3 + Math.abs(piece.crease) * p.width * .02);
  }
}

function drawScene(p, frame) {
  drawBackground(p);
  const pieces = [...frame.scene.pieces].sort((a, b) => a.layer - b.layer);
  pieces.forEach((piece, index) => drawPiece(p, piece, index));
  drawCutLine(p, frame.scene.cutLine);
  drawAperture(p, frame.scene.aperture);
}

const sketch = (p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.noiseSeed(0x4e413235);
    const renderer = p.createCanvas(960, 720, p.P2D);
    renderer.parent(canvasHost);
    renderer.id('naive-sheet-stage');
    renderFrame(activeFrame());
  };
  p.draw = () => {
    if (!interactionFrame && !frozen) {
      currentFrame = frameAt(p.millis());
      renderFrame(currentFrame);
    }
    drawScene(p, activeFrame());
  };
  p.windowResized = () => {
    const box = canvasHost.getBoundingClientRect();
    if (box.width && box.height) p.resizeCanvas(Math.max(320, Math.floor(box.width)), Math.max(320, Math.floor(box.height)));
  };
};

if (window.p5) new window.p5(sketch);
else field.dataset.error = 'p5-load-failed';
