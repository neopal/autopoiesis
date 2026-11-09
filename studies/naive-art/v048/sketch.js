import {
  AGENT_COUNT,
  ATTENTION_THRESHOLD,
  buildFrame,
  buildTimeline,
  commitLookBack,
  geometrySignature,
  liftLatest,
  noticeAgent,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#attention-field');
const canvasMount = document.querySelector('#attention-canvas');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const timeline = buildTimeline();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = staticMode ? timeline.at(-1) : buildFrame();
let focusIndex = 0;
let pointer = null;
let pointerActive = false;
let lastNoticed = -1;
let renderer;
let backgroundLayer;

const statusText = () => ({
  idle: 'move through the witnesses, then look back',
  'attention-noticed': 'the witness is looking back',
  'attention-repeated': 'the witness has already seen you',
  'attention-refused-target': 'the field refuses that witness',
  'look-back-refused-incomplete': 'the model needs three different witnesses',
  'look-back-committed': 'the model remembers the wrong stare',
  'backcast-lifted': 'the last backcast was lifted',
  'memory-released': 'the field has forgotten its stare'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!field || !stageEl || !memoryEl || !statusEl) return;
  stageEl.textContent = `backcast ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.seamCount = String(state.body.seams.length);
  field.dataset.visitedCount = String(state.pending?.visited?.length ?? 0);
  field.dataset.agentCount = String(state.body.agents.length);
}

function rebuildBackground(p) {
  backgroundLayer = p.createGraphics(p.width, p.height);
  backgroundLayer.pixelDensity(1);
  backgroundLayer.colorMode(p.HSB, 360, 100, 100, 1);
  backgroundLayer.background(221, 30, 7, 1);
  backgroundLayer.noStroke();
  for (let index = 0; index < 18; index += 1) {
    const size = Math.max(p.width, p.height) * (1.25 - index * 0.042);
    backgroundLayer.fill(205 + index * 2.8, 32 - index * 0.7, 9 + index * 0.68, 0.045);
    backgroundLayer.ellipse(p.width * 0.18, p.height * 0.62, size, size * 0.62);
  }
  backgroundLayer.stroke(195, 22, 92, 0.11);
  backgroundLayer.strokeWeight(0.55);
  for (let index = 0; index < 18; index += 1) {
    const y = p.height * (0.08 + index * 0.052);
    backgroundLayer.line(p.width * 0.07, y, p.width * 0.92, y + p.width * 0.018);
  }
  backgroundLayer.stroke(36, 70, 95, 0.16);
  backgroundLayer.strokeWeight(0.7);
  for (let index = 0; index < 9; index += 1) {
    const x = p.width * (0.1 + index * 0.1);
    backgroundLayer.line(x, p.height * 0.08, x + p.width * 0.08, p.height * 0.9);
  }
  backgroundLayer.noStroke();
  for (let index = 0; index < 65; index += 1) {
    const x = ((index * 83) % 997) / 997 * p.width;
    const y = ((index * 47 + 31) % 991) / 991 * p.height;
    const radius = 0.5 + (index % 3) * 0.45;
    backgroundLayer.fill(44 + (index % 4) * 12, 28, 93, 0.22);
    backgroundLayer.ellipse(x, y, radius, radius);
  }
}

function localPoint(event) {
  const rect = field.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function normalizedPoint(point, width, height) {
  return {
    x: (point.x - width * 0.5) / (width * 0.43),
    y: (point.y - height * 0.5) / (height * 0.43)
  };
}

function agentPoint(agent, p) {
  return {
    x: p.width * 0.5 + agent.x * p.width * 0.43,
    y: p.height * 0.5 + agent.y * p.height * 0.43
  };
}

function nearestAgent(point, p) {
  const normalized = normalizedPoint(point, p.width, p.height);
  let best = 0;
  let bestDistance = Infinity;
  state.body.agents.forEach((agent, index) => {
    const distance = Math.hypot(normalized.x - agent.x, normalized.y - agent.y);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function angleToPointer(agent, p) {
  if (!pointer || staticMode) return agent.angle;
  const target = agentPoint(agent, p);
  return Math.atan2(pointer.y - target.y, pointer.x - target.x);
}

function angleBlend(from, to, amount) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * amount;
}

function drawSeam(p, seam) {
  const points = seam.visited.map((id) => agentPoint(state.body.agents[id], p));
  const centre = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
  const radius = Math.min(p.width, p.height) * (0.055 + seam.weight * 0.015);
  p.push();
  p.translate(centre.x, centre.y);
  p.rotate(seam.angle * 0.22);
  p.noStroke();
  p.fill(42 + seam.id * 9, 74, 96, 0.13);
  p.beginShape();
  p.vertex(-radius * 1.7, -radius * 0.24);
  p.vertex(-radius * 0.15, -radius * 0.7);
  p.vertex(radius * 1.75, radius * 0.08);
  p.vertex(radius * 0.16, radius * 0.72);
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(42 + seam.id * 9, 64, 96, 0.52);
  p.strokeWeight(0.8 + seam.id * 0.13);
  p.beginShape();
  points.forEach((point) => p.vertex(point.x - centre.x, point.y - centre.y));
  p.endShape();
  p.pop();
}

function drawAgent(p, agent, index) {
  const point = agentPoint(agent, p);
  const shortest = Math.min(p.width, p.height);
  const liveTarget = angleToPointer(agent, p);
  const distance = pointer ? Math.hypot(pointer.x - point.x, pointer.y - point.y) / shortest : 1;
  const turnAmount = pointer && !staticMode ? Math.max(0, Math.min(0.76, 1 - distance * 4.2)) : 0;
  const angle = angleBlend(agent.angle, liveTarget, turnAmount);
  const pulse = reducedMotion || staticMode ? 0 : Math.sin(performance.now() * 0.00055 + agent.phase * 8) * 0.012;
  const width = shortest * agent.width * (1 + pulse + agent.backcastDepth * 0.12);
  const height = shortest * agent.height * (1 - pulse * 0.6 + agent.backcastDepth * 0.06);
  const hue = agent.role === 'backcast-witness' ? 20 + index * 2.6 : 190 + index * 3.1;
  const saturation = agent.role === 'backcast-witness' ? 66 : 24 + (index % 4) * 5;
  const brightness = agent.role === 'backcast-witness' ? 97 : 72 + (index % 5) * 4;
  const near = turnAmount > 0.18;

  p.push();
  p.translate(point.x, point.y);
  p.rotate(angle);
  p.noStroke();
  p.fill(hue, saturation, brightness, 0.11);
  p.beginShape();
  p.vertex(-width * 0.65, -height * 0.1);
  p.vertex(-width * 0.08, -height * 0.74);
  p.vertex(width * 0.76, -height * 0.32);
  p.vertex(width * 0.67, height * 0.36);
  p.vertex(-width * 0.14, height * 0.74);
  p.vertex(-width * 0.7, height * 0.18);
  p.endShape(p.CLOSE);
  p.fill(hue, saturation, brightness, 0.94);
  p.beginShape();
  p.vertex(-width * 0.5, -height * 0.18);
  p.vertex(-width * 0.04, -height * 0.56);
  p.vertex(width * 0.58, -height * 0.27);
  p.vertex(width * 0.48, height * 0.3);
  p.vertex(-width * 0.12, height * 0.56);
  p.vertex(-width * 0.54, height * 0.14);
  p.endShape(p.CLOSE);
  p.fill(220, 32, 10, 0.86);
  p.beginShape();
  p.vertex(width * (0.04 + agent.notch * 0.08), -height * 0.32);
  p.vertex(width * 0.42, -height * 0.07);
  p.vertex(width * (0.06 + agent.notch * 0.12), height * 0.2);
  p.vertex(width * (-0.06 + agent.notch * 0.02), height * 0.04);
  p.endShape(p.CLOSE);
  p.noFill();
  p.stroke(hue, Math.min(92, saturation + 16), 100, near ? 0.98 : 0.64);
  p.strokeWeight(near ? 1.45 : 0.75);
  p.beginShape();
  p.vertex(-width * 0.5, -height * 0.18);
  p.vertex(-width * 0.04, -height * 0.56);
  p.vertex(width * 0.58, -height * 0.27);
  p.vertex(width * 0.48, height * 0.3);
  p.vertex(-width * 0.12, height * 0.56);
  p.vertex(-width * 0.54, height * 0.14);
  p.endShape(p.CLOSE);
  p.stroke(220, 20, 94, 0.56);
  p.strokeWeight(0.55);
  p.line(-width * 0.28, height * 0.28, width * 0.34, height * 0.06);
  if (near && !staticMode) {
    p.stroke(hue, 45, 98, 0.46);
    p.strokeWeight(0.8);
    p.line(width * 0.48, 0, width * 0.95, 0);
  }
  p.pop();
}

function drawField(p) {
  if (backgroundLayer) p.image(backgroundLayer, 0, 0);
  else p.background(221, 30, 7);
  p.noStroke();
  p.fill(42, 62, 96, 0.06);
  p.ellipse(p.width * 0.5, p.height * 0.5, p.width * 0.76, p.height * 0.8);
  state.body.seams.forEach((seam) => drawSeam(p, seam));
  state.body.agents.forEach((agent, index) => drawAgent(p, agent, index));
  if (pointer && !staticMode) {
    p.push();
    p.noFill();
    p.stroke(40, 50, 98, pointerActive ? 0.82 : 0.38);
    p.strokeWeight(pointerActive ? 1.4 : 0.75);
    p.ellipse(pointer.x, pointer.y, pointerActive ? 18 : 12, pointerActive ? 18 : 12);
    p.line(pointer.x - 10, pointer.y, pointer.x + 10, pointer.y);
    p.line(pointer.x, pointer.y - 10, pointer.x, pointer.y + 10);
    p.pop();
  }
}

function updateState(next) {
  state = next;
  updateReadout();
  renderer?.redraw();
}

function completeDeterministicLook() {
  if (staticMode) return;
  const plans = [
    [1, 7, 13],
    [3, 9, 14],
    [0, 5, 10],
    [2, 6, 11]
  ];
  const visited = plans[state.memory.length % plans.length];
  const angle = [-0.9, 0.3, 1.7, -1.5][state.memory.length % 4];
  let next = state;
  for (const agentIndex of visited) next = noticeAgent(next, agentIndex, angle);
  updateState(commitLookBack(next, angle));
}

function performLookBack() {
  if (staticMode) return;
  if (state.pending?.visited?.length >= ATTENTION_THRESHOLD) updateState(commitLookBack(state));
  else completeDeterministicLook();
}

function focusStep(delta) {
  focusIndex = (focusIndex + AGENT_COUNT + delta) % AGENT_COUNT;
  updateReadout();
  renderer?.redraw();
}

field?.addEventListener('pointermove', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointer = localPoint(event);
  const index = nearestAgent(pointer, renderer);
  const rect = field.getBoundingClientRect();
  const point = normalizedPoint(pointer, rect.width, rect.height);
  const angle = Math.atan2(point.y, point.x);
  if (index !== lastNoticed || pointerActive) {
    lastNoticed = index;
    updateState(noticeAgent(state, index, angle));
  } else renderer?.redraw();
}, { passive: false });

field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointerActive = true;
  pointer = localPoint(event);
  const index = nearestAgent(pointer, renderer);
  const rect = field.getBoundingClientRect();
  const point = normalizedPoint(pointer, rect.width, rect.height);
  lastNoticed = index;
  updateState(noticeAgent(state, index, Math.atan2(point.y, point.x)));
  field.setPointerCapture?.(event.pointerId);
}, { passive: false });

field?.addEventListener('pointerup', (event) => {
  if (staticMode) return;
  event.preventDefault();
  pointerActive = false;
  field.releasePointerCapture?.(event.pointerId);
  renderer?.redraw();
}, { passive: false });

field?.addEventListener('pointercancel', () => {
  pointerActive = false;
  pointer = null;
  renderer?.redraw();
});

field?.addEventListener('pointerleave', () => {
  if (!pointerActive) {
    pointer = null;
    renderer?.redraw();
  }
});

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusStep(1);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusStep(-1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    performLookBack();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    updateState(liftLatest(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    updateState(releaseMemory());
  }
});

document.querySelector('[data-action="look-back"]')?.addEventListener('click', performLookBack);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => { if (!staticMode) updateState(liftLatest(state)); });
document.querySelector('[data-action="release"]')?.addEventListener('click', () => { if (!staticMode) updateState(releaseMemory()); });

const sketch = (p) => {
  p.setup = () => {
    const width = Math.max(240, field?.clientWidth ?? 720);
    const height = Math.max(260, field?.clientHeight ?? 520);
    const canvas = p.createCanvas(width, height);
    canvas.parent(canvasMount);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noStroke();
    rebuildBackground(p);
    updateReadout();
    window._p5Ready = true;
    if (staticMode) p.noLoop();
  };
  p.draw = () => {
    drawField(p);
  };
  p.windowResized = () => {
    if (!field) return;
    p.resizeCanvas(Math.max(240, field.clientWidth), Math.max(260, field.clientHeight));
    rebuildBackground(p);
    p.redraw();
  };
};

renderer = new window.p5(sketch);
window.__mutineNaiveV048 = {
  getState: () => state,
  buildFrame,
  buildTimeline,
  commitLookBack,
  geometrySignature: () => geometrySignature(state),
  noticeAgent,
  liftLatest,
  releaseMemory,
  renderSignature: () => geometrySignature(state)
};
