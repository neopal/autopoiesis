import {
  CELL_COUNT,
  COLS,
  ROWS,
  buildFrame,
  buildTimeline,
  cutCell,
  geometrySignature,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#register-field');
const canvasHost = document.querySelector('#register-canvas');
const stageReadout = document.querySelector('[data-register-stage]');
const memoryReadout = document.querySelector('[data-register-memory]');
const selectionReadout = document.querySelector('[data-selection]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = params.get('static') === '1';
const blindMode = params.get('blind') === '1';

const PALETTE = {
  night: [215, 38, 9],
  substrate: [207, 33, 13],
  substrateEdge: [192, 28, 25],
  ink: [62, 10, 93],
  coral: [13, 64, 89],
  acid: [72, 45, 86],
  cyan: [181, 45, 78],
  blue: [202, 48, 70],
  amber: [39, 58, 88],
  clay: [21, 53, 82],
  moss: [91, 30, 69],
  void: [214, 35, 7]
};
const PLATE_COLORS = [PALETTE.coral, PALETTE.cyan, PALETTE.amber, PALETTE.clay, PALETTE.moss, PALETTE.blue, PALETTE.ink];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame();
let renderer;
let p5Instance;
let backdrop;
let activePointerId = null;
let pointerIndex = null;

function canvasSize() {
  const width = Math.max(320, canvasHost.clientWidth || 960);
  const height = document.documentElement.classList.contains('preview-mode')
    ? Math.max(420, window.innerHeight)
    : Math.max(520, canvasHost.clientHeight || Math.min(760, width * 0.68));
  return { width, height };
}

function messageFor(interaction) {
  const messages = {
    'quiet substrate': 'The substrate is quiet. Choose one occupied plate.',
    'cut committed': 'The vacancy is real. The remaining plates have re-packed around it.',
    'refused / outside register': 'That cut landed outside the register.',
    'refused / vacancy already cut': 'That place is already empty. The register refuses a repeat cut.',
    'refused / register is full': 'Four vacancies are retained. Lift one before cutting again.',
    'refused / pointer left plate': 'The cut was not sealed on the same occupied plate.',
    'lifted / exact': 'The latest vacancy is lifted. The preceding register returns exactly.',
    'lift refused / register is quiet': 'There is no vacancy to lift.'
  };
  return messages[interaction] || messages['quiet substrate'];
}

function formatIndex(index) {
  return String(index + 1).padStart(2, '0');
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  const selected = frame.body.cells[frame.selectedIndex] || frame.body.cells[0];
  if (stageReadout) stageReadout.textContent = `CUT ${String(frame.memory.length).padStart(2, '0')} / 04`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 're-counting the substrate' : 'quiet substrate'} · ${frame.memory.length} vacanc${frame.memory.length === 1 ? 'y' : 'ies'} retained`;
  if (selectionReadout) selectionReadout.textContent = `cell ${formatIndex(selected.index)} / ${selected.present ? 'occupied' : 'vacant'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  if (p5Instance) p5Instance.redraw();
}

function normalizedPoint(point, p) {
  return { x: point.x * p.width, y: point.y * p.height };
}

function pointerPoint(event) {
  const rect = renderer.elt.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const crosses = ((yi > point.y) !== (yj > point.y)) && point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function nearestCell(point) {
  let nearest = null;
  let best = Infinity;
  for (const cell of frame.body.cells) {
    if (cell.present || !cell.baseW) continue;
    const distance = Math.hypot(point.x - cell.baseX, point.y - cell.baseY);
    const radius = Math.max(cell.baseW, cell.baseH) * 0.52;
    if (distance <= radius) return cell.index;
  }
  for (const cell of frame.body.cells) {
    if (!cell.present || !cell.points?.length) continue;
    if (pointInPolygon(point, cell.points)) return cell.index;
    const distance = Math.hypot(point.x - cell.x, point.y - cell.y);
    if (distance < best) {
      best = distance;
      nearest = cell.index;
    }
  }
  return best < 0.18 ? nearest : null;
}

function selectCell(index) {
  if (!Number.isInteger(index)) return;
  frame = { ...frame, selectedIndex: Math.max(0, Math.min(CELL_COUNT - 1, index)), interaction: frame.interaction };
  renderFrame(frame);
}

function commitCut(index = frame.selectedIndex) {
  const result = cutCell(frame, index);
  const next = { ...result.field, selectedIndex: index };
  renderFrame(next);
}

function lift() {
  renderFrame({ ...liftLatest(frame), selectedIndex: frame.selectedIndex });
}

function release() {
  renderFrame({ ...releaseField(), selectedIndex: frame.selectedIndex });
}

function moveSelection(dx, dy) {
  const current = frame.selectedIndex;
  const row = Math.floor(current / COLS);
  const column = current % COLS;
  const nextRow = Math.max(0, Math.min(ROWS - 1, row + dy));
  const nextColumn = Math.max(0, Math.min(COLS - 1, column + dx));
  selectCell(nextRow * COLS + nextColumn);
}

function drawBackdropLayer(g) {
  g.colorMode(g.HSB, 360, 100, 100, 100);
  g.background(...PALETTE.night);
  g.noStroke();
  for (let ring = 0; ring < 22; ring += 1) {
    const amount = ring / 22;
    g.fill(187 + amount * 30, 30 + amount * 22, 8 + amount * 10, 3.2);
    g.ellipse(g.width * (0.52 + Math.sin(ring * 1.37) * 0.04), g.height * (0.46 + Math.cos(ring * 1.11) * 0.05), g.width * (1.3 - amount * 0.58), g.height * (1.24 - amount * 0.5));
  }
  g.stroke(...PALETTE.substrateEdge, 13);
  g.strokeWeight(0.55);
  for (let index = 0; index < 110; index += 1) {
    const x = g.width * (0.035 + ((index * 0.6180339887) % 0.93));
    const y = g.height * (0.04 + ((index * 0.4142135623) % 0.9));
    const length = 2 + Math.abs(Math.sin(index * 17.17)) * 12;
    g.line(x, y, x + length, y - length * 0.22);
  }
}

function drawPolygon(p, points, dx = 0, dy = 0) {
  p.beginShape();
  points.forEach((point) => p.vertex(point.x * p.width + dx, point.y * p.height + dy));
  p.endShape(p.CLOSE);
}

function drawSubstrate(p) {
  const left = p.width * 0.075;
  const right = p.width * 0.925;
  const top = p.height * 0.105;
  const bottom = p.height * 0.9;
  p.push();
  p.noStroke();
  p.fill(...PALETTE.substrate, 94);
  p.beginShape();
  p.vertex(left, top + p.height * 0.018);
  p.vertex(right - p.width * 0.012, top);
  p.vertex(right, bottom - p.height * 0.03);
  p.vertex(left + p.width * 0.018, bottom);
  p.endShape(p.CLOSE);
  p.stroke(...PALETTE.substrateEdge, 35);
  p.strokeWeight(0.8);
  p.noFill();
  p.beginShape();
  p.vertex(left, top + p.height * 0.018);
  p.vertex(right - p.width * 0.012, top);
  p.vertex(right, bottom - p.height * 0.03);
  p.vertex(left + p.width * 0.018, bottom);
  p.endShape(p.CLOSE);
  for (let line = 0; line < 12; line += 1) {
    const y = top + (bottom - top) * (line + 0.5) / 12;
    p.stroke(...PALETTE.substrateEdge, 11 + (line % 3) * 4);
    p.line(left + p.width * 0.018, y, right - p.width * 0.02, y + Math.sin(line * 1.7) * p.height * 0.006);
  }
  p.pop();
}

function drawVacancy(p, cell) {
  const x = cell.baseX * p.width;
  const y = cell.baseY * p.height;
  const w = cell.baseW * p.width;
  const h = cell.baseH * p.height;
  p.push();
  p.noStroke();
  p.fill(...PALETTE.void, 70);
  p.rect(x - w * 0.42, y - h * 0.4, w * 0.84, h * 0.8);
  p.noFill();
  p.stroke(...PALETTE.coral, blindMode ? 26 : 54);
  p.strokeWeight(0.7);
  p.line(x - w * 0.37, y - h * 0.34, x - w * 0.19, y - h * 0.34);
  p.line(x - w * 0.37, y - h * 0.34, x - w * 0.37, y - h * 0.13);
  p.line(x + w * 0.37, y + h * 0.34, x + w * 0.19, y + h * 0.34);
  p.line(x + w * 0.37, y + h * 0.34, x + w * 0.37, y + h * 0.13);
  p.pop();
}

function drawPlate(p, cell) {
  const points = cell.points;
  const color = PLATE_COLORS[cell.tone % PLATE_COLORS.length];
  const shadowOffset = Math.min(p.width, p.height) * 0.012;
  p.push();
  p.noStroke();
  p.fill(214, 36, 3, 60);
  drawPolygon(p, points, shadowOffset, shadowOffset * 1.4);
  p.fill(...color, 88);
  drawPolygon(p, points);
  p.noFill();
  p.stroke(...PALETTE.ink, 72);
  p.strokeWeight(0.8);
  drawPolygon(p, points);
  const a = points[0];
  const b = points[1];
  const c = points[2];
  p.stroke(...PALETTE.acid, 20 + (cell.index % 4) * 8);
  p.strokeWeight(0.55);
  p.line(a.x * p.width + (b.x - a.x) * p.width * 0.18, a.y * p.height + (b.y - a.y) * p.height * 0.18, c.x * p.width - (c.x - b.x) * p.width * 0.14, c.y * p.height - (c.y - b.y) * p.height * 0.14);
  p.stroke(...PALETTE.ink, 38);
  p.strokeWeight(0.45);
  const inset = 0.16 + (cell.index % 3) * 0.035;
  const ix = a.x + (c.x - a.x) * inset;
  const iy = a.y + (c.y - a.y) * inset;
  const jx = b.x + (points[3].x - b.x) * inset;
  const jy = b.y + (points[3].y - b.y) * inset;
  p.line(ix * p.width, iy * p.height, jx * p.width, jy * p.height);
  p.pop();
}

function drawSelected(p) {
  if (blindMode) return;
  const selected = frame.body.cells[frame.selectedIndex];
  if (!selected?.present || !selected.points?.length) return;
  p.push();
  p.noFill();
  p.stroke(...PALETTE.acid, 86);
  p.strokeWeight(1.6);
  drawPolygon(p, selected.points);
  p.stroke(...PALETTE.coral, 58);
  p.strokeWeight(0.7);
  const center = normalizedPoint({ x: selected.x, y: selected.y }, p);
  p.line(center.x - 7, center.y, center.x + 7, center.y);
  p.line(center.x, center.y - 7, center.x, center.y + 7);
  p.pop();
}

function drawRegister(p) {
  drawSubstrate(p);
  frame.body.cells.filter((cell) => !cell.present).forEach((cell) => drawVacancy(p, cell));
  frame.body.cells.filter((cell) => cell.present).forEach((cell) => drawPlate(p, cell));
  drawSelected(p);
  if (!blindMode) {
    p.push();
    p.noFill();
    p.stroke(...PALETTE.coral, 34);
    p.strokeWeight(0.6);
    p.line(p.width * 0.075, p.height * 0.94, p.width * 0.22, p.height * 0.94);
    p.line(p.width * 0.78, p.height * 0.06, p.width * 0.925, p.height * 0.06);
    p.pop();
  }
}

function drawFrame(p) {
  p.image(backdrop, 0, 0, p.width, p.height);
  drawRegister(p);
}

function attachEvents() {
  const canvas = renderer.elt;
  canvas.addEventListener('pointerdown', (event) => {
    if (staticMode || blindMode) return;
    const point = pointerPoint(event);
    const index = nearestCell(point);
    if (index === null) return;
    pointerIndex = index;
    activePointerId = event.pointerId;
    selectCell(index);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  canvas.addEventListener('pointerup', (event) => {
    if (staticMode || blindMode || event.pointerId !== activePointerId) return;
    const index = nearestCell(pointerPoint(event));
    activePointerId = null;
    if (index === pointerIndex) commitCut(index);
    else renderFrame({ ...frame, interaction: 'refused / pointer left plate' });
    pointerIndex = null;
    event.preventDefault();
  });
  canvas.addEventListener('pointercancel', () => {
    activePointerId = null;
    pointerIndex = null;
    renderFrame({ ...frame, interaction: 'refused / pointer left plate' });
  });
  document.querySelectorAll('[data-gesture]').forEach((button) => {
    button.addEventListener('click', () => {
      const gesture = button.dataset.gesture;
      if (gesture === 'cut') commitCut(frame.selectedIndex);
      if (gesture === 'lift') lift();
      if (gesture === 'release') release();
    });
  });
}

function handleKey(event) {
  const key = event.key;
  if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', ' ', 'Enter', 'Delete', 'Backspace', 'Escape'].includes(key)) event.preventDefault();
  if (key === 'ArrowLeft') moveSelection(-1, 0);
  if (key === 'ArrowRight') moveSelection(1, 0);
  if (key === 'ArrowUp') moveSelection(0, -1);
  if (key === 'ArrowDown') moveSelection(0, 1);
  if (key === 'Enter' || key === ' ') commitCut(frame.selectedIndex);
  if (key === 'Delete' || key === 'Backspace') lift();
  if (key === 'Escape' || key.toLowerCase() === 'r') release();
  if (key.toLowerCase() === 's' && p5Instance) p5Instance.saveCanvas('mutine-brush-v052', 'png');
}

const sketch = (p) => {
  p.setup = () => {
    const size = canvasSize();
    p.pixelDensity(1);
    renderer = p.createCanvas(size.width, size.height);
    renderer.parent(canvasHost);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.frameRate(reducedMotion ? 20 : 30);
    backdrop = p.createGraphics(size.width, size.height);
    backdrop.pixelDensity(1);
    drawBackdropLayer(backdrop);
    p5Instance = p;
    attachEvents();
    document.addEventListener('keydown', handleKey);
    window._p5Ready = true;
    window.__mutineBrushV052 = {
      ready: true,
      getFrame: () => frame,
      geometrySignature: () => geometrySignature(frame),
      cut: (index = frame.selectedIndex) => { commitCut(index); return frame; },
      lift: () => { lift(); return frame; },
      release: () => { release(); return frame; }
    };
    if (staticMode) p.noLoop();
    renderFrame(frame);
  };
  p.draw = () => {
    drawFrame(p);
  };
  p.windowResized = () => {
    const size = canvasSize();
    p.resizeCanvas(size.width, size.height);
    backdrop = p.createGraphics(size.width, size.height);
    backdrop.pixelDensity(1);
    drawBackdropLayer(backdrop);
    p.redraw();
  };
};

new p5(sketch);
