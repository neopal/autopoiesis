import {
  beginRead,
  buildFrame,
  buildTimeline,
  cellSignature,
  commitRead,
  geometrySignature,
  liftLatestRead,
  releaseMemory,
  COLS,
  ROWS
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#miscount-field');
const mount = document.querySelector('#miscount-canvas-mount');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const pendingEl = document.querySelector('[data-pending]');
const timeline = buildTimeline();
let state = buildFrame();
let pendingCell = null;
let sketch;
let backdrop;
let plate;
let grain;

function settledFrame() {
  let frame = buildFrame();
  for (const reading of timeline) frame = commitRead(beginRead(frame, reading), reading);
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'mark one quiet cell, then commit',
  'read-armed': 'the cell is marked; ask the model',
  'read-refused-invalid': 'the plate cannot count that cell',
  'read-refused-light': 'the reading was too faint to keep',
  'read-refused-heavy': 'the reading was too certain to keep',
  'read-committed': 'the wrong patch has been counted',
  'read-lifted': 'the last miscount was lifted',
  'memory-released': 'the plate is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!stageEl) return;
  stageEl.textContent = `miscount ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = pendingCell === null ? statusText() : `cell ${pendingCell + 1} marked`;
  field?.setAttribute('data-memory-count', String(state.memory.length));
  field?.setAttribute('data-pending-cell', pendingCell === null ? '' : String(pendingCell));
}

function updatePending() {
  if (!pendingEl || !field) return;
  pendingEl.replaceChildren();
  if (pendingCell === null) return;
  const rect = field.getBoundingClientRect();
  const col = pendingCell % COLS;
  const row = Math.floor(pendingCell / COLS);
  const mark = document.createElement('span');
  mark.className = 'pending-mark';
  mark.style.left = `${((col + 0.5) / COLS) * rect.width}px`;
  mark.style.top = `${((row + 0.5) / ROWS) * rect.height}px`;
  pendingEl.append(mark);
}

function updateState(next) {
  state = next;
  sketch?.redraw();
  updateReadout();
  updatePending();
  field?.focus({ preventScroll: true });
}

function deterministicReading() {
  return timeline[state.memory.length % timeline.length];
}

function commitDeterministicRead() {
  if (staticMode) return;
  const reading = pendingCell === null ? deterministicReading() : { cell: pendingCell, confidence: 0.68 };
  pendingCell = null;
  updateState(commitRead(beginRead(state, reading), reading));
}

function chooseCell(clientX, clientY) {
  const rect = field.getBoundingClientRect();
  const x = Math.max(0, Math.min(0.999999, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(0.999999, (clientY - rect.top) / rect.height));
  return Math.floor(y * ROWS) * COLS + Math.floor(x * COLS);
}

function markPointer(event) {
  if (staticMode) return;
  pendingCell = chooseCell(event.clientX, event.clientY);
  updateState(beginRead(state, { cell: pendingCell }));
  field.setPointerCapture?.(event.pointerId);
}

function releasePointer(event) {
  if (staticMode) return;
  updateReadout();
  updatePending();
  field.releasePointerCapture?.(event.pointerId);
}

field?.addEventListener('pointerdown', markPointer);
field?.addEventListener('pointerup', releasePointer);
field?.addEventListener('pointercancel', () => { pendingCell = null; updateReadout(); updatePending(); });
field?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeterministicRead();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    pendingCell = null;
    updateState(liftLatestRead(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pendingCell = null;
    updateState(releaseMemory(state));
  } else if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const current = pendingCell ?? deterministicReading().cell;
    const row = Math.floor(current / COLS);
    const col = current % COLS;
    const nextRow = Math.max(0, Math.min(ROWS - 1, row + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
    const nextCol = Math.max(0, Math.min(COLS - 1, col + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
    pendingCell = nextRow * COLS + nextCol;
    updateState(beginRead(state, { cell: pendingCell }));
  }
});

document.querySelector('[data-action="miscount"]')?.addEventListener('click', commitDeterministicRead);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => {
  pendingCell = null;
  updateState(liftLatestRead(state));
});
document.querySelector('[data-action="release"]')?.addEventListener('click', () => {
  pendingCell = null;
  updateState(releaseMemory(state));
});

const PALETTE = [
  [12, 66, 44],
  [28, 76, 55],
  [46, 77, 68],
  [207, 42, 56],
  [330, 48, 55],
  [74, 38, 48]
];

function drawBackdrop(g, width, height) {
  g.clear();
  for (let y = 0; y < height; y += 1) {
    const mix = y / height;
    g.stroke(38 + mix * 10, 34, 91 - mix * 12, 100);
    g.line(0, y, width, y);
  }
  g.noStroke();
  g.fill(24, 52, 19, 11);
  g.beginShape();
  g.vertex(width * .02, height * .72);
  g.vertex(width * .28, height * .1);
  g.vertex(width * .96, height * .24);
  g.vertex(width * .78, height * .94);
  g.vertex(width * .18, height * .84);
  g.endShape(g.CLOSE);
  g.fill(6, 45, 10, 12);
  g.beginShape();
  g.vertex(width * .05, height * .18);
  g.vertex(width * .62, height * .03);
  g.vertex(width * .92, height * .62);
  g.vertex(width * .34, height * .9);
  g.endShape(g.CLOSE);
}

function rgbaHsb(g, hsb, alpha = 100) {
  g.fill(hsb[0], hsb[1], hsb[2], alpha);
}

function drawCell(g, cell, width, height) {
  const cellW = width / COLS;
  const cellH = height / ROWS;
  const cx = (cell.col + 0.5 + cell.offsetX) * cellW;
  const cy = (cell.row + 0.5 + cell.offsetY) * cellH;
  const breadth = cellW * (0.62 + cell.weight * 0.2 + cell.value * 0.018);
  const depth = cellH * (0.52 + cell.weight * 0.18 + cell.value * 0.027);
  const lean = ((cell.phase - 0.5) * 0.14) + ((cell.col % 3) - 1) * 0.02;
  const role = cell.role;
  const base = PALETTE[cell.tone % PALETTE.length];
  const color = role === 'wrong-patch' ? [4, 82, 83] : role === 'false-void' ? [18, 37, 15] : role === 'remembering-edge' ? [214, 55, 62] : role === 'miscount-ripple' ? [44, 78, 73] : base;
  const alpha = role === 'false-void' ? 92 : role === 'quiet' && cell.value === 0 ? 24 : 90;

  g.push();
  g.translate(cx, cy);
  g.rotate(lean);
  g.noStroke();
  g.fill(14, 36, 13, 18);
  g.beginShape();
  g.vertex(-breadth * .5 + cellW * .07, -depth * .46 + cellH * .08);
  g.vertex(breadth * .5 + cellW * .07, -depth * .38 + cellH * .08);
  g.vertex(breadth * .46 + cellW * .07, depth * .5 + cellH * .08);
  g.vertex(-breadth * .48 + cellW * .07, depth * .44 + cellH * .08);
  g.endShape(g.CLOSE);

  rgbaHsb(g, color, alpha);
  g.beginShape();
  g.vertex(-breadth * .5, -depth * .5);
  g.vertex(breadth * .34, -depth * (.48 - cell.value * .012));
  g.vertex(breadth * .5, -depth * .18);
  g.vertex(breadth * .43, depth * .5);
  g.vertex(-breadth * .42, depth * .42);
  g.vertex(-breadth * (.5 + cell.notch * .08), -depth * .04);
  g.endShape(g.CLOSE);

  if (role === 'wrong-patch') {
    g.noFill();
    g.stroke(9, 60, 95, 84);
    g.strokeWeight(Math.max(1, width * .0014));
    g.rect(-breadth * .34, -depth * .33, breadth * .75, depth * .68);
    g.stroke(38, 25, 93, 66);
    g.line(-breadth * .22, depth * .42, breadth * .34, -depth * .42);
  } else if (role === 'false-void') {
    g.noFill();
    g.stroke(8, 56, 93, 78);
    g.strokeWeight(Math.max(1, width * .0012));
    g.rect(-breadth * .34, -depth * .31, breadth * .66, depth * .62);
    g.line(-breadth * .28, -depth * .27, breadth * .3, depth * .25);
  } else if (role === 'remembering-edge') {
    g.noFill();
    g.stroke(45, 80, 92, 88);
    g.strokeWeight(Math.max(1.2, width * .0018));
    g.line(-breadth * .44, depth * .38, breadth * .42, -depth * .34);
  } else if (cell.value > 2) {
    g.noFill();
    g.stroke(40, 18, 94, 28);
    g.strokeWeight(Math.max(.7, width * .0008));
    g.line(-breadth * .32, -depth * .22, breadth * .29, depth * .16);
  }
  g.pop();
}

function drawPlate(g, currentState, width, height) {
  g.clear();
  g.image(backdrop, 0, 0);
  g.noStroke();
  g.fill(42, 35, 12, 24);
  g.beginShape();
  g.vertex(width * .04, height * .62);
  g.bezierVertex(width * .22, height * .24, width * .47, height * .39, width * .94, height * .16);
  g.bezierVertex(width * .78, height * .56, width * .62, height * .76, width * .12, height * .9);
  g.endShape(g.CLOSE);

  currentState.scene.cells.forEach((cell) => drawCell(g, cell, width, height));

  g.noFill();
  g.stroke(25, 26, 20, 38);
  g.strokeWeight(Math.max(1, width * .001));
  g.beginShape();
  g.vertex(width * .04, height * .15);
  g.bezierVertex(width * .3, height * .03, width * .62, height * .17, width * .96, height * .07);
  g.endShape();
  g.stroke(6, 30, 12, 46);
  g.beginShape();
  g.vertex(width * .06, height * .91);
  g.bezierVertex(width * .38, height * .74, width * .62, height * .97, width * .94, height * .78);
  g.endShape();
}

function drawGrain(g, width, height) {
  g.clear();
  g.randomSeed(339);
  g.strokeWeight(1);
  for (let index = 0; index < Math.floor(width * height / 1300); index += 1) {
    g.stroke(32 + g.random(30), 28, 22 + g.random(20), g.random(4, 14));
    const x = g.random(width);
    const y = g.random(height);
    g.point(x, y);
    if (index % 11 === 0) g.line(x, y, x + g.random(-3, 3), y + g.random(-2, 2));
  }
}

function render(p) {
  if (!backdrop || !plate || !grain) return;
  const width = p.width;
  const height = p.height;
  drawBackdrop(backdrop, width, height);
  drawPlate(plate, state, width, height);
  drawGrain(grain, width, height);
  p.clear();
  p.image(plate, 0, 0);
  p.image(grain, 0, 0);
  p.noFill();
  p.stroke(27, 25, 20, 58);
  p.strokeWeight(Math.max(1, width * .001));
  p.rect(width * .018, height * .02, width * .964, height * .96);
}

function resizeLayers(width, height) {
  backdrop?.remove();
  plate?.remove();
  grain?.remove();
  backdrop = sketch.createGraphics(width, height);
  plate = sketch.createGraphics(width, height);
  grain = sketch.createGraphics(width, height);
  [backdrop, plate, grain].forEach((layer) => {
    layer.pixelDensity(1);
    layer.colorMode(sketch.HSB, 360, 100, 100, 100);
  });
}

sketch = new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    const width = Math.max(1, mount?.clientWidth || 900);
    const height = Math.max(1, mount?.clientHeight || 580);
    p.createCanvas(width, height).parent(mount);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    resizeLayers(width, height);
    p.noLoop();
    render(p);
    p.redraw();
    window._p5Ready = true;
  };
  p.draw = () => render(p);
  p.windowResized = () => {
    const width = Math.max(1, mount?.clientWidth || p.width);
    const height = Math.max(1, mount?.clientHeight || p.height);
    p.resizeCanvas(width, height);
    resizeLayers(width, height);
    p.redraw();
  };
});

window.__mutineNaiveV039 = {
  getState: () => JSON.parse(JSON.stringify(state)),
  buildFrame,
  beginRead,
  buildTimeline,
  cellSignature,
  commitRead,
  geometrySignature,
  liftLatestRead,
  releaseMemory,
  chooseCell,
  renderSignature: () => geometrySignature(state)
};

updateReadout();
updatePending();
