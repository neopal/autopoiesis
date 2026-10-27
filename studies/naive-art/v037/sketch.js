import {
  MAX_PRESSURE,
  MIN_PRESSURE,
  beginChord,
  buildFrame,
  buildTimeline,
  commitChord,
  geometrySignature,
  liftLatestChord,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#print-field');
const mount = document.querySelector('#print-canvas-mount');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const pendingEl = document.querySelector('[data-pending]');
const timeline = buildTimeline();
let state = buildFrame();
let pendingAnchors = [];
let sketch;

function settledFrame() {
  let frame = buildFrame();
  for (const chord of timeline) frame = commitChord(beginChord(frame, chord), chord);
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'tap three marks to misread them',
  'chord-armed': 'the relation is waiting for a third mark',
  'chord-refused-incomplete': 'the print needs three distinct marks',
  'chord-refused-invalid': 'the print keeps its registration',
  'chord-refused-light': 'the pressure was too light',
  'chord-refused-heavy': 'the pressure overloaded the print',
  'chord-committed': 'the print hardened the wrong edge',
  'chord-lifted': 'the last error was lifted',
  'memory-released': 'the print is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!stageEl) return;
  stageEl.textContent = `misread ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = pendingAnchors.length
    ? `${pendingAnchors.length} mark${pendingAnchors.length === 1 ? '' : 's'} offered`
    : statusText();
  field?.setAttribute('data-memory-count', String(state.memory.length));
  field?.setAttribute('data-pending-count', String(pendingAnchors.length));
}

function updatePendingDots() {
  if (!pendingEl || !sketch) return;
  pendingEl.replaceChildren();
  const stamps = state.scene.stamps;
  const rect = field.getBoundingClientRect();
  pendingAnchors.forEach((index) => {
    const stamp = stamps[index];
    const dot = document.createElement('span');
    dot.className = 'pending-dot';
    dot.style.left = `${stamp.x * rect.width}px`;
    dot.style.top = `${stamp.y * rect.height}px`;
    pendingEl.append(dot);
  });
}

function updateState(next) {
  state = next;
  sketch?.redraw();
  updateReadout();
  updatePendingDots();
  field?.focus({ preventScroll: true });
}

function clearPending() {
  pendingAnchors = [];
  updateReadout();
  updatePendingDots();
}

function pressureForCount(count) {
  return Math.min(MAX_PRESSURE, Math.max(MIN_PRESSURE, 0.36 + count * 0.08));
}

function commitDeterministicChord() {
  const chord = timeline[state.memory.length % timeline.length];
  pendingAnchors = [];
  updateState(commitChord(beginChord(state, chord), chord));
}

function commitPointerChord() {
  const anchors = [...pendingAnchors];
  pendingAnchors = [];
  const chord = { anchors, pressure: pressureForCount(anchors.length) };
  updateState(commitChord(beginChord(state, chord), chord));
}

function chooseAnchor(clientX, clientY) {
  const rect = field.getBoundingClientRect();
  const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
  let best = 0;
  let bestDistance = Infinity;
  state.scene.stamps.forEach((stamp, index) => {
    const distance = Math.hypot(stamp.x - x, stamp.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

function tapAt(clientX, clientY) {
  if (staticMode) return;
  const anchor = chooseAnchor(clientX, clientY);
  if (pendingAnchors.includes(anchor)) {
    updateState(beginChord(state, { anchors: pendingAnchors }));
    return;
  }
  pendingAnchors = [...pendingAnchors, anchor];
  if (pendingAnchors.length === 3) commitPointerChord();
  else {
    updateReadout();
    updatePendingDots();
  }
}

field?.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  tapAt(event.clientX, event.clientY);
});
field?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeterministicChord();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    clearPending();
    updateState(liftLatestChord(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    clearPending();
    updateState(releaseMemory(state));
  }
});

document.querySelector('[data-action="misread"]')?.addEventListener('click', commitDeterministicChord);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => {
  clearPending();
  updateState(liftLatestChord(state));
});
document.querySelector('[data-action="release"]')?.addEventListener('click', () => {
  clearPending();
  updateState(releaseMemory(state));
});

function paletteFor(p, role, index) {
  const quiet = [p.color(36, 74, 67), p.color(16, 88, 78), p.color(30, 52, 88), p.color(9, 66, 73)];
  if (role === 'false-imprint') return p.color(11, 70, 89);
  if (role === 'vacancy') return p.color(215, 24, 15);
  if (role === 'pressure-ridge') return p.color(42, 64, 88);
  if (role === 'misread-source') return p.color(31, 38, 57);
  return quiet[index % quiet.length];
}

function drawStamp(p, stamp, index, width, height) {
  const x = stamp.x * width;
  const y = stamp.y * height;
  const radius = stamp.scale * Math.min(width, height);
  p.push();
  p.translate(x, y);
  p.rotate(p.radians(stamp.rotation));
  p.noStroke();
  p.fill(210, 20, 10, 13);
  p.ellipse(radius * 0.11, radius * 0.15, radius * 1.72, radius * 1.36);
  p.fill(paletteFor(p, stamp.role, index));
  p.beginShape();
  for (let step = 0; step < 9; step += 1) {
    const angle = (Math.PI * 2 * step) / 9;
    const wobble = 0.84 + 0.16 * Math.sin(step * 2.17 + index * 1.7 + stamp.tilt * 4);
    const px = Math.cos(angle) * radius * wobble;
    const py = Math.sin(angle) * radius * (0.72 + stamp.tilt * 0.35) * wobble;
    p.vertex(px, py);
  }
  p.endShape(p.CLOSE);

  p.stroke(45, 25, 92, stamp.role === 'vacancy' ? 58 : 30);
  p.strokeWeight(Math.max(0.7, radius * 0.025));
  p.noFill();
  p.beginShape();
  for (let step = 0; step < 7; step += 1) {
    const angle = (Math.PI * 2 * step) / 7 + 0.18;
    const wobble = 0.6 + 0.12 * Math.cos(step * 1.9 + stamp.depth * 3);
    p.vertex(Math.cos(angle) * radius * wobble, Math.sin(angle) * radius * wobble * 0.7);
  }
  p.endShape(p.CLOSE);

  if (stamp.role === 'vacancy') {
    p.drawingContext.globalCompositeOperation = 'destination-out';
    p.noStroke();
    p.fill(0, 0, 0, 100);
    p.ellipse(radius * 0.05, radius * 0.02, radius * 0.75, radius * 0.46);
    p.drawingContext.globalCompositeOperation = 'source-over';
  } else if (stamp.role === 'pressure-ridge') {
    p.stroke(42, 45, 94, 80);
    p.strokeWeight(Math.max(1, radius * 0.06));
    p.line(-radius * 0.72, radius * 0.28, radius * 0.72, -radius * 0.2);
  } else if (stamp.role === 'false-imprint') {
    p.stroke(14, 15, 94, 76);
    p.strokeWeight(Math.max(1, radius * 0.045));
    p.line(-radius * 0.52, -radius * 0.24, radius * 0.55, radius * 0.3);
    p.line(-radius * 0.42, radius * 0.33, radius * 0.46, -radius * 0.3);
  }
  p.pop();
}

function drawBoard(p) {
  const width = p.width;
  const height = p.height;
  p.background(210, 24, 12);
  for (let band = 0; band < 20; band += 1) {
    const hue = 188 + band * 1.4;
    p.noStroke();
    p.fill(hue, 24 - band * 0.45, 14 + band * 0.7, 100);
    p.rect(0, (band / 20) * height, width, height / 20 + 2);
  }
  p.push();
  p.translate(width * 0.5, height * 0.5);
  p.rotate(-0.055);
  p.noFill();
  p.stroke(42, 22, 80, 34);
  p.strokeWeight(Math.max(1, width * 0.0012));
  p.beginShape();
  p.vertex(-width * 0.405, -height * 0.38);
  p.vertex(width * 0.38, -height * 0.42);
  p.vertex(width * 0.43, height * 0.34);
  p.vertex(-width * 0.37, height * 0.4);
  p.endShape(p.CLOSE);
  p.stroke(13, 68, 73, 20);
  p.beginShape();
  p.vertex(-width * 0.39, -height * 0.35);
  p.vertex(width * 0.40, -height * 0.39);
  p.vertex(width * 0.46, height * 0.37);
  p.vertex(-width * 0.34, height * 0.43);
  p.endShape(p.CLOSE);
  p.pop();

  p.noStroke();
  for (let dot = 0; dot < 92; dot += 1) {
    const x = p.random(width);
    const y = p.random(height);
    p.fill(42, 20, 78, p.random(3, 12));
    p.circle(x, y, p.random(0.4, 1.8));
  }
}

sketch = new p5((p) => {
  p.setup = () => {
    const rect = field.getBoundingClientRect();
    p.pixelDensity(1);
    p.createCanvas(Math.max(320, Math.floor(rect.width)), Math.max(260, Math.floor(rect.height))).parent(mount);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.randomSeed(0x4e413337);
    p.noiseSeed(0x4e413337);
    p.noLoop();
    window._p5Ready = true;
    p.redraw();
  };
  p.draw = () => {
    p.randomSeed(0x4e413337);
    drawBoard(p);
    state.scene.stamps.forEach((stamp, index) => drawStamp(p, stamp, index, p.width, p.height));
    p.noStroke();
    p.fill(42, 18, 94, 42);
    p.circle(p.width * 0.52, p.height * 0.53, Math.min(p.width, p.height) * 0.012);
  };
  p.windowResized = () => {
    const rect = field.getBoundingClientRect();
    p.resizeCanvas(Math.max(320, Math.floor(rect.width)), Math.max(260, Math.floor(rect.height)));
    p.redraw();
    updatePendingDots();
  };
});

updateReadout();
window.__mutineNaiveV037 = {
  getState: () => state,
  tapAt,
  misread: commitDeterministicChord,
  lift: () => updateState(liftLatestChord(state)),
  release: () => updateState(releaseMemory(state)),
  geometrySignature,
  settledFrame
};
