import {
  STAGES,
  MIN_PRESS_MS,
  MAX_PRESS_MS,
  applyPulse,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestPulse,
  releasePulses
} from './engine.mjs';

const FIELD_ID = 'pressure-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = ['#c9785d', '#d6b16e', '#9bb28c', '#738e94', '#b98b62', '#9b6e67', '#7c9b83', '#c7a878', '#798b9e'];
const dark = '#171312';
const paper = '#e9dfca';

let p5Api;
let canvas;
let frame;
let interaction = 'baseline';
let pressing = false;
let pointerId = null;
let pressStartedAt = 0;
let pressPoint = { x: 0.5, y: 0.5 };
let lastPoint = { x: 0.5, y: 0.5 };

function fieldNode() {
  return document.getElementById(FIELD_ID);
}

function stateMessage(label) {
  return {
    baseline: 'The sheet is carrying its own weight.',
    charging: 'Pressure is entering the underside.',
    displaced: 'The pressure is sliding across the sheet.',
    'pulse-committed': 'One fold buckled; another lifted beyond the touch.',
    'pulse-refused-weak': 'The pulse was too weak to enter the material.',
    'pulse-refused-overheld': 'The sheet refused pressure held too long.',
    'pulse-refused-repeat': 'The same pressure debt will not be counted twice.',
    'pulse-lifted': 'The latest debt lifted; the preceding sheet returns.',
    'pulse-lift-refused': 'There is no pressure debt to lift.',
    'pulses-released': 'The sheet released its remembered pressure.'
  }[label] || 'The sheet is carrying its own weight.';
}

function syncState(label = frame.interaction || 'baseline') {
  interaction = label;
  const field = fieldNode();
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.pulseCount = String(frame.pulses.length);
  field.dataset.stage = String(frame.stage);
  field.dataset.buckled = String(frame.buckledCount);
  field.dataset.lifted = String(frame.liftedCount);
  field.dataset.scarred = String(frame.scarredCount);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} pulse${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) stateNode.textContent = stateMessage(label);
}

function nextPulse() {
  const pulses = [
    { point: { x: 0.22, y: 0.68 }, duration: 260 },
    { point: { x: 0.78, y: 0.31 }, duration: 420 },
    { point: { x: 0.18, y: 0.3 }, duration: 180 },
    { point: { x: 0.84, y: 0.62 }, duration: 510 }
  ];
  return pulses[frame.memory.length % pulses.length];
}

function commitPulse(pulse, source = 'keyboard-pulse') {
  frame = applyPulse(frame, pulse, source);
  syncState(frame.interaction);
  render();
}

function lift() {
  frame = liftLatestPulse(frame);
  syncState(frame.interaction);
  render();
}

function release() {
  frame = releasePulses(frame);
  syncState(frame.interaction);
  render();
}

function exportCanvas() {
  const node = document.getElementById('pressure-canvas');
  const anchor = document.createElement('a');
  anchor.href = node.toDataURL('image/png');
  anchor.download = 'mutine-brush-v030-pressure-register.png';
  anchor.click();
}

function pointFromEvent(event) {
  const rect = canvas.elt.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0.03, 0.97),
    y: clamp((event.clientY - rect.top) / rect.height, 0.04, 0.96)
  };
}

function px(point) {
  return { x: point.x * 1000, y: point.y * 700 };
}

function drawBackground(p) {
  const ctx = p.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, 1000, 700);
  gradient.addColorStop(0, '#211b18');
  gradient.addColorStop(0.48, '#171313');
  gradient.addColorStop(1, '#0c0b0b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 700);

  ctx.save();
  ctx.globalAlpha = 0.15;
  for (let index = 0; index < 220; index += 1) {
    const x = (index * 71 + index * index * 11) % 1000;
    const y = (index * 43 + index * index * 5) % 700;
    const size = 0.5 + (index % 4) * 0.35;
    ctx.fillStyle = index % 4 === 0 ? paper : '#8e9b86';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawUnderside(p, frameState) {
  p.push();
  p.noStroke();
  p.fill(8, 7, 7, 220);
  p.beginShape();
  p.vertex(95, 92);
  p.vertex(910, 112);
  p.vertex(935, 614);
  p.vertex(92, 632);
  p.endShape(p.CLOSE);
  p.pop();

  p.push();
  p.noFill();
  p.stroke('#d6b16e');
  p.strokeWeight(1.4);
  p.beginShape();
  for (let index = 0; index < 34; index += 1) {
    const t = index / 33;
    p.vertex(102 + t * 800, 603 + Math.sin(t * Math.PI * 4 + frameState.underside) * 8 + frameState.underside * 3);
  }
  p.endShape();
  p.pop();
}

function drawFold(p, fold, index) {
  const points = fold.points.map(px);
  const fill = p.color(palette[index % palette.length]);
  fill.setAlpha(224);
  p.push();
  p.drawingContext.shadowColor = 'rgba(0,0,0,.58)';
  p.drawingContext.shadowBlur = 22 + fold.lift * 7;
  p.drawingContext.shadowOffsetX = 7 + fold.lift * 3;
  p.drawingContext.shadowOffsetY = 10;
  p.fill(fill);
  p.stroke('#f1e4ca');
  p.strokeWeight(1.3 + fold.buckle * 0.35);
  p.beginShape();
  points.forEach((point) => p.vertex(point.x, point.y));
  p.endShape(p.CLOSE);
  p.pop();

  p.push();
  p.noFill();
  p.stroke('#f7e9cf');
  p.strokeWeight(1);
  p.beginShape();
  for (let step = 0; step <= 18; step += 1) {
    const t = step / 18;
    const left = points[step];
    const right = points[points.length - 1 - step];
    const edge = step % 2 ? left : right;
    p.vertex(edge.x + 4, edge.y);
  }
  p.endShape();
  p.pop();

  if (fold.buckle > 0.01 || fold.lift > 0.01 || fold.scar > 0.01) {
    p.push();
    p.noFill();
    p.stroke('#241a16');
    p.strokeWeight(2.2 + fold.buckle * 0.8);
    p.beginShape();
    for (let step = 0; step <= 12; step += 1) {
      const t = step / 12;
      const y = 125 + t * 450;
      const x = fold.x * 1000 + Math.sin(t * Math.PI * 2 + fold.id) * (4 + fold.scar * 7) + fold.buckle * 9;
      p.vertex(x, y);
    }
    p.endShape();
    p.pop();
  }
}

function drawRegister(p, frameState) {
  drawUnderside(p, frameState);
  frameState.folds.slice().sort((a, b) => a.x - b.x).forEach((fold) => drawFold(p, fold, fold.id));

  p.push();
  p.noFill();
  p.stroke('#f0ddbd');
  p.strokeWeight(1);
  p.line(92, 90, 910, 108);
  p.line(92, 632, 935, 614);
  p.stroke('#b98b62');
  p.strokeWeight(3);
  p.line(106, 96, 900, 114);
  p.pop();
}

function drawPressure(p) {
  if (!pressing) return;
  const point = px(pressPoint);
  const elapsed = Math.max(0, performance.now() - pressStartedAt);
  const progress = clamp(elapsed / MAX_PRESS_MS, 0, 1);
  p.push();
  p.noFill();
  p.stroke('#f2e6d2');
  p.strokeWeight(2);
  p.drawingContext.setLineDash([5, 8]);
  p.arc(point.x, point.y, 42 + progress * 48, 42 + progress * 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  p.drawingContext.setLineDash([]);
  p.fill('#f2e6d2');
  p.noStroke();
  p.circle(point.x, point.y, 9 + progress * 11);
  p.pop();
}

function render() {
  if (!p5Api || !frame) return;
  p5Api.clear();
  drawBackground(p5Api);
  drawRegister(p5Api, frame);
  drawPressure(p5Api);
}

function beginPointer(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  pressing = true;
  pointerId = event.pointerId ?? 'mouse';
  pressStartedAt = performance.now();
  pressPoint = pointFromEvent(event);
  lastPoint = pressPoint;
  canvas.elt.setPointerCapture?.(pointerId);
  interaction = 'charging';
  syncState(interaction);
  render();
}

function movePointer(event) {
  if (!pressing || (pointerId !== null && event.pointerId !== pointerId)) return;
  event.preventDefault();
  const point = pointFromEvent(event);
  if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) > 0.06) interaction = 'displaced';
  lastPoint = point;
  syncState(interaction);
  render();
}

function finishPointer(event) {
  const eventId = event.pointerId ?? 'mouse';
  if (!pressing || (pointerId !== null && eventId !== pointerId)) return;
  event.preventDefault();
  const duration = Math.round(performance.now() - pressStartedAt);
  pressing = false;
  pointerId = null;
  commitPulse({ point: pressPoint, duration }, 'pointer-pulse');
}

function bindPointer() {
  canvas.elt.addEventListener('pointerdown', beginPointer);
  canvas.elt.addEventListener('pointermove', movePointer);
  canvas.elt.addEventListener('pointerup', finishPointer);
  canvas.elt.addEventListener('pointercancel', () => { pressing = false; pointerId = null; syncState('baseline'); render(); });
}

function bindControls() {
  const field = fieldNode();
  field.querySelector('[data-gesture="pulse"]').addEventListener('click', () => commitPulse(nextPulse(), 'button-pulse'));
  field.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
  field.querySelector('[data-gesture="release"]').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitPulse(nextPulse());
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      release();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      exportCanvas();
    }
  });
}

function setup() {
  const holder = document.getElementById('pressure-canvas-holder');
  const settled = buildTimeline().at(-1);
  frame = reducedMotion || staticMode ? settled : buildFrame(0, []);
  new p5((p) => {
    p5Api = p;
    p.setup = () => {
      canvas = p.createCanvas(1000, 700);
      canvas.parent(holder);
      canvas.id('pressure-canvas');
      p.pixelDensity(1);
      p.noLoop();
      syncState('baseline');
      render();
      bindControls();
      window.__mutineBrushV030Ready = true;
      bindPointer();
    };
  });
}

setup();

window.__mutineBrushV030 = {
  getState: () => ({
    stage: frame.stage,
    memory: frame.memory.length,
    pulses: frame.memory.map((event) => ({ ...event })),
    signature: geometrySignature(frame),
    interaction,
    grammar: frame.grammar,
    foldCount: frame.folds.length,
    buckledCount: frame.buckledCount,
    liftedCount: frame.liftedCount,
    scarredCount: frame.scarredCount,
    lastPulse: frame.lastPulse
  }),
  getFrame: () => frame
};

void MIN_PRESS_MS;
void MAX_PRESS_MS;
