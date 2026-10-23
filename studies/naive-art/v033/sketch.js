import {
  armToken,
  buildFrame,
  buildTimeline,
  commitWitness,
  geometrySignature,
  liftLatestWitness,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const proofField = document.querySelector('#proof-sheet');
const stageEl = document.querySelector('[data-stage]');
const pendingEl = document.querySelector('[data-pending]');
const statusEl = document.querySelector('[data-status]');
const canvasWrap = document.querySelector('#proof-canvas-wrap');
let state = buildFrame();
let sketch;

function settledFrame() {
  let frame = buildFrame();
  for (const witness of buildTimeline()) {
    for (const token of witness) frame = armToken(frame, { token });
    frame = commitWitness(frame);
  }
  return frame;
}

if (params.get('static') === '1') state = settledFrame();

function copyState(value) {
  return JSON.parse(JSON.stringify(value));
}

function statusText() {
  return {
    idle: 'the proof is quiet',
    'token-armed': 'the proof is listening',
    'token-refused': 'that witness is refused',
    'witness-refused': 'the proof stays exact',
    'witness-committed': 'the proof misheard itself',
    'witness-lifted': 'the last error was lifted',
    'memory-released': 'the proof is released'
  }[state.interaction] || state.interaction;
}

function updateUi() {
  if (!stageEl) return;
  stageEl.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  pendingEl.textContent = `listening: ${state.pending.length ? state.pending.map((token) => token + 1).join(' · ') : '—'}`;
  statusEl.textContent = statusText();
  document.querySelectorAll('[data-token]').forEach((button) => {
    button.dataset.armed = state.pending.includes(Number(button.dataset.token)) ? 'true' : 'false';
  });
}

function updateState(next) {
  state = next;
  updateUi();
  if (sketch) sketch.redraw();
}

function chooseToken(token) {
  updateState(armToken(state, { token }));
  proofField?.focus({ preventScroll: true });
}

function commit() {
  updateState(commitWitness(state));
  proofField?.focus({ preventScroll: true });
}

function lift() {
  updateState(liftLatestWitness(state));
  proofField?.focus({ preventScroll: true });
}

function release() {
  updateState(releaseMemory(state));
  proofField?.focus({ preventScroll: true });
}

document.querySelectorAll('[data-token]').forEach((button) => {
  button.addEventListener('click', () => chooseToken(Number(button.dataset.token)));
});
document.querySelector('[data-action="witness"]')?.addEventListener('click', commit);
document.querySelector('[data-action="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-action="release"]')?.addEventListener('click', release);
proofField?.addEventListener('pointerdown', () => proofField.focus({ preventScroll: true }));
proofField?.addEventListener('keydown', (event) => {
  if (/^[1-6]$/.test(event.key)) {
    event.preventDefault();
    chooseToken(Number(event.key) - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

const GLYPH_LINES = [
  [[-0.55, 0.7], [-0.3, -0.75], [0.1, 0.4], [0.52, -0.7]],
  [[-0.56, -0.52], [0.08, -0.7], [0.52, -0.28], [-0.2, 0.06], [0.56, 0.7]],
  [[-0.5, -0.56], [0.5, -0.56], [-0.18, 0.04], [0.48, 0.62]],
  [[-0.52, -0.7], [-0.52, 0.7], [0.48, 0.42], [-0.2, 0.02], [0.5, -0.5]],
  [[-0.5, 0.62], [0.5, 0.62], [-0.44, -0.58], [0.44, -0.58]],
  [[-0.5, -0.55], [0.46, -0.55], [-0.42, 0.08], [0.48, 0.7]]
];

function renderSketch(p) {
  const width = p.width;
  const height = p.height;
  p.noStroke();
  for (let y = 0; y < height; y += 4) {
    const ratio = y / Math.max(1, height - 1);
    p.fill(p.lerpColor(p.color('#08111f'), p.color('#142842'), ratio));
    p.rect(0, y, width, 5);
  }

  p.stroke(114, 225, 209, 20);
  p.strokeWeight(1);
  for (let x = 0; x < width; x += Math.max(22, width * 0.035)) p.line(x, 0, x + height * 0.08, height);
  for (let y = height * 0.12; y < height; y += Math.max(28, height * 0.08)) p.line(0, y, width, y);

  const left = width * 0.065;
  const right = width * 0.935;
  const top = height * 0.22;
  const bottom = height * 0.82;
  p.push();
  p.translate(0, height * 0.012);
  p.noStroke();
  p.fill(0, 0, 0, 85);
  p.beginShape();
  p.vertex(left + 12, top + 22);
  p.vertex(right + 10, top + 4);
  p.vertex(right - 6, bottom + 24);
  p.vertex(left - 10, bottom + 12);
  p.endShape(p.CLOSE);
  p.pop();

  p.noStroke();
  p.fill('#d9e6dc');
  p.beginShape();
  p.vertex(left, top + 4);
  p.vertex(width * 0.31, top - 5);
  p.vertex(width * 0.66, top + 7);
  p.vertex(right, top - 1);
  p.vertex(right - 8, bottom - 5);
  p.vertex(width * 0.65, bottom + 7);
  p.vertex(width * 0.3, bottom - 4);
  p.vertex(left + 9, bottom + 3);
  p.endShape(p.CLOSE);

  p.stroke(16, 35, 52, 75);
  p.strokeWeight(Math.max(1, width * 0.001));
  p.noFill();
  for (let x = left + 16; x < right; x += Math.max(24, width * 0.036)) {
    p.ellipse(x, top + 7, 5, 5);
    p.ellipse(x + 4, bottom - 7, 5, 5);
  }

  const lineY = height * 0.57;
  p.stroke('#6f8b8c');
  p.strokeWeight(Math.max(1.5, width * 0.002));
  let cursor = left + 26;
  const breaks = state.lineBreaks.map((line) => width * (0.5 + line.x * 0.42)).sort((a, b) => a - b);
  for (const breakX of breaks) {
    p.line(cursor, lineY, breakX - width * 0.018, lineY);
    cursor = breakX + width * 0.018;
  }
  p.line(cursor, lineY, right - 25, lineY);

  for (const glyph of state.glyphs) {
    drawGlyph(p, glyph, width * (0.5 + glyph.x * 0.42), height * (0.57 + glyph.y * 0.16), width * 0.045);
  }

  p.noStroke();
  p.fill(114, 225, 209, 95);
  p.rect(left, height * 0.88, width * 0.16, 2);
  p.fill(255, 128, 110, 105);
  p.rect(right - width * 0.16, height * 0.88, width * 0.16, 2);
}

function drawGlyph(p, glyph, x, y, unit) {
  p.push();
  p.translate(x, y);
  p.rotate(glyph.slant);
  p.scale(glyph.scale);
  if (glyph.state === 'blank') {
    p.noStroke();
    p.fill('#0b1727');
    p.ellipse(0, 0, unit * 1.35, unit * 2.2);
    p.noFill();
    p.stroke('#ff806e');
    p.strokeWeight(Math.max(1.5, unit * 0.055));
    p.arc(0, 0, unit * 1.45, unit * 2.25, -0.8, 1.2);
    p.pop();
    return;
  }
  const line = GLYPH_LINES[glyph.shape];
  const colour = glyph.state === 'misheard' ? '#ff806e' : glyph.state === 'echo' ? '#f2d477' : glyph.state === 'witness' ? '#72e1d1' : '#102334';
  p.noFill();
  p.stroke(colour);
  p.strokeWeight(Math.max(2, unit * 0.09));
  p.strokeCap(p.SQUARE);
  p.beginShape();
  line.forEach(([px, py]) => p.vertex(px * unit, py * unit));
  p.endShape();
  p.strokeWeight(Math.max(1, unit * 0.026));
  p.stroke(255, 255, 255, glyph.state === 'quiet' ? 35 : 75);
  p.beginShape();
  line.forEach(([px, py]) => p.vertex(px * unit + unit * 0.08, py * unit + unit * 0.06));
  p.endShape();
  p.pop();
}

sketch = new window.p5((p) => {
  p.setup = () => {
    window.p5.disableFriendlyErrors = true;
    const width = Math.max(320, canvasWrap?.clientWidth || 900);
    const height = Math.max(180, Math.round(width * 780 / 1400));
    p.pixelDensity(1);
    p.createCanvas(width, height);
    p.noLoop();
    p.frameRate(30);
    p.redraw();
  };
  p.draw = () => renderSketch(p);
  p.mousePressed = () => {
    if (params.get('blind') === '1' || params.get('static') === '1') return false;
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      const token = Math.min(5, Math.max(0, Math.floor((p.mouseX / p.width) * 6)));
      chooseToken(token);
    }
    return false;
  };
  p.windowResized = () => {
    const width = Math.max(320, canvasWrap?.clientWidth || 900);
    p.resizeCanvas(width, Math.max(180, Math.round(width * 780 / 1400)));
    p.redraw();
  };
}, canvasWrap);

window.__mutineNaiveV033 = {
  getState: () => copyState(state),
  geometrySignature: () => geometrySignature(state),
  chooseToken,
  commit,
  lift,
  release
};
updateUi();
