import {
  CELL_COUNT,
  buildFrame,
  buildTimeline,
  commitPressure,
  geometrySignature,
  liftLatest,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#pressure-field');
const svg = document.querySelector('#pressure-svg');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = staticMode ? buildTimeline().at(-1) : buildFrame();
let focusIndex = 0;
let gesture = null;
let tracePath = '';
let ambient;

const statusText = () => ({
  idle: 'push against the field, then release',
  'pressure-refused-weak': 'the pressure is too light',
  'pressure-refused-unopposed': 'the model cannot find resistance',
  'pressure-refused-unsettled': 'the field did not hold',
  'pressure-refused-straight': 'a straight answer is refused',
  'pressure-fold-committed': 'the model kneads the missing answer',
  'lifted / exact': 'the last seam was lifted exactly',
  'memory-released': 'the topology has forgotten the pressure'
}[state.interaction] || state.interaction);

function setStatus(next) {
  state = next;
  updateReadout();
  renderSvg();
}

function updateReadout() {
  if (!stageEl || !memoryEl || !statusEl) return;
  stageEl.textContent = `fold ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  field.dataset.memoryCount = String(state.memory.length);
  field.dataset.joinCount = String(state.body.joins.length);
  field.dataset.cellCount = String(state.body.cells.length);
}

function rotatePoint(x, y, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [x * cosine - y * sine, x * sine + y * cosine];
}

function cellPath(cell) {
  const notch = cell.notch * 0.18;
  const local = [
    [-0.52, -0.46], [-0.14, -0.53], [0.08, -0.38 - notch], [0.5, -0.43],
    [0.55, 0.22], [0.18 + notch, 0.5], [-0.46, 0.48], [-0.56, 0.04]
  ];
  const points = local.map(([x, y]) => {
    const [rx, ry] = rotatePoint(x * cell.width * cell.scale, y * cell.height * cell.scale, cell.angle);
    return [cell.x + rx, cell.y + ry];
  });
  return `${points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(4)} ${y.toFixed(4)}`).join(' ')} Z`;
}

function cellCentre(cell) {
  return `${cell.x.toFixed(4)},${cell.y.toFixed(4)}`;
}

function aperturePath(aperture) {
  const [x, y, width, height] = [aperture.x, aperture.y, aperture.width, aperture.height];
  const local = [[-0.56, -0.32], [0.1, -0.5], [0.56, -0.06], [0.2, 0.5], [-0.5, 0.26]];
  const points = local.map(([px, py]) => {
    const [rx, ry] = rotatePoint(px * width, py * height, aperture.angle);
    return [x + rx, y + ry];
  });
  return `${points.map(([px, py], index) => `${index ? 'L' : 'M'} ${px.toFixed(4)} ${py.toFixed(4)}`).join(' ')} Z`;
}

function renderSvg() {
  if (!svg) return;
  const cellMarkup = state.body.cells.map((cell) => {
    const tone = 28 + (cell.id % 4) * 9 + state.stage * 2;
    const fill = cell.role === 'folded-cell' ? '#f0a36b' : `hsl(${tone} 36% ${62 + (cell.id % 3) * 4}%)`;
    const stroke = cell.role === 'folded-cell' ? '#19131f' : '#302131';
    return `<g class="pressure-cell ${cell.role}" data-cell-id="${cell.id}"${cell.id === focusIndex ? ' data-focused="true"' : ''}><path d="${cellPath(cell)}" fill="${fill}" stroke="${stroke}" stroke-width="0.009"></path><path d="M ${cell.x - cell.width * 0.18} ${cell.y + cell.height * 0.08} L ${cell.x + cell.width * 0.22} ${cell.y - cell.height * 0.05}" fill="none" stroke="#fff1c9" stroke-opacity="0.38" stroke-width="0.006"></path></g>`;
  }).join('');
  const apertures = state.body.apertures.map((aperture) => `<path class="pressure-aperture" d="${aperturePath(aperture)}" fill="#15121d" stroke="#efbd82" stroke-opacity="0.5" stroke-width="0.008"></path>`).join('');
  const joins = state.body.joins.map((join) => {
    const first = state.body.cells[join.a];
    const second = state.body.cells[join.b];
    return `<path class="pressure-join" d="M ${cellCentre(first)} C ${(first.x + second.x) / 2} ${(first.y + second.y) / 2 - join.depth} ${second.x} ${second.y} ${cellCentre(second)}" fill="none" stroke="#f5c08b" stroke-opacity="0.72" stroke-width="0.014"></path>`;
  }).join('');
  const trace = tracePath ? `<path class="pressure-trace" d="${tracePath}" fill="none" stroke="#ffe4a5" stroke-width="0.012" stroke-linecap="round" stroke-dasharray="0.025 0.018"></path>` : '';
  svg.innerHTML = `<g class="pressure-shadow">${cellMarkup}</g><g class="pressure-apertures">${apertures}</g><g class="pressure-joins">${joins}</g>${trace}`;
  updateReadout();
}

function normalizedPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: ((event.clientY - rect.top) / rect.height) * 2 - 1
  };
}

function appendPoint(point) {
  if (!gesture) return;
  const last = gesture.points.at(-1);
  if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.012) {
    gesture.points.push(point);
    if (last) {
      const angle = Math.atan2(point.y - last.y, point.x - last.x);
      if (gesture.lastAngle !== null) {
        const delta = Math.atan2(Math.sin(angle - gesture.lastAngle), Math.cos(angle - gesture.lastAngle));
        if (Math.abs(delta) > 0.58) gesture.turns += 1;
      }
      gesture.lastAngle = angle;
    }
    tracePath = gesture.points.map((entry, index) => `${index ? 'L' : 'M'} ${entry.x.toFixed(4)} ${entry.y.toFixed(4)}`).join(' ');
    renderSvg();
  }
}

function gestureValues() {
  const points = gesture?.points ?? [];
  if (points.length < 2) return null;
  const first = points[0];
  const last = points.at(-1);
  let travel = 0;
  for (let index = 1; index < points.length; index += 1) travel += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  const direction = Math.atan2(last.y - first.y, last.x - first.x);
  const opposition = Math.min(1, 0.35 + gesture.turns * 0.16 + Math.max(0, travel - Math.hypot(last.x - first.x, last.y - first.y)) * 0.7);
  return {
    direction,
    opposition,
    pressure: Math.min(1, travel * 0.78),
    resistance: Math.min(1, 0.44 + points.length * 0.024 + travel * 0.22),
    turns: gesture.turns
  };
}

function completeDeterministicFold() {
  if (staticMode) return;
  const plans = [
    { direction: -0.92, opposition: 0.82, pressure: 0.78, resistance: 0.74, turns: 3 },
    { direction: 0.38, opposition: 0.75, pressure: 0.68, resistance: 0.8, turns: 4 },
    { direction: 1.42, opposition: 0.88, pressure: 0.73, resistance: 0.67, turns: 5 },
    { direction: -1.78, opposition: 0.7, pressure: 0.64, resistance: 0.84, turns: 3 }
  ];
  const result = commitPressure(state, plans[state.memory.length % plans.length]);
  setStatus(result.field);
}

function finishGesture() {
  const values = gestureValues();
  gesture = null;
  if (values) setStatus(commitPressure(state, values).field);
  tracePath = '';
  renderSvg();
}

field?.addEventListener('pointerdown', (event) => {
  if (staticMode) return;
  event.preventDefault();
  const point = normalizedPoint(event);
  gesture = { points: [point], turns: 0, lastAngle: null, pointerId: event.pointerId };
  field.setPointerCapture?.(event.pointerId);
  tracePath = `M ${point.x.toFixed(4)} ${point.y.toFixed(4)}`;
  renderSvg();
}, { passive: false });

field?.addEventListener('pointermove', (event) => {
  if (!gesture || gesture.pointerId !== event.pointerId || staticMode) return;
  event.preventDefault();
  appendPoint(normalizedPoint(event));
}, { passive: false });

field?.addEventListener('pointerup', (event) => {
  if (!gesture || gesture.pointerId !== event.pointerId || staticMode) return;
  event.preventDefault();
  field.releasePointerCapture?.(event.pointerId);
  finishGesture();
}, { passive: false });

field?.addEventListener('pointercancel', () => {
  gesture = null;
  tracePath = '';
  renderSvg();
});

field?.addEventListener('keydown', (event) => {
  if (staticMode) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    focusIndex = (focusIndex + 1) % CELL_COUNT;
    renderSvg();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    focusIndex = (focusIndex + CELL_COUNT - 1) % CELL_COUNT;
    renderSvg();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    completeDeterministicFold();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    setStatus(liftLatest(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    setStatus(releaseMemory());
  }
});

document.querySelector('[data-action="fold"]')?.addEventListener('click', completeDeterministicFold);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => { if (!staticMode) setStatus(liftLatest(state)); });
document.querySelector('[data-action="release"]')?.addEventListener('click', () => { if (!staticMode) setStatus(releaseMemory()); });

const ambientSketch = (p) => {
  p.setup = () => {
    const width = Math.max(240, field?.clientWidth ?? 760);
    const height = Math.max(260, field?.clientHeight ?? 560);
    p.createCanvas(width, height);
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.noStroke();
    if (staticMode) p.noLoop();
    window._p5Ready = true;
  };
  p.draw = () => {
    p.clear();
    for (let index = 0; index < 12; index += 1) {
      const x = p.width * (0.08 + ((index * 37) % 83) / 100);
      const y = p.height * (0.12 + ((index * 53) % 71) / 100);
      const radius = Math.min(p.width, p.height) * (0.12 + (index % 4) * 0.035);
      p.fill(278 + index * 3, 35, 24 + index * 2, 0.04);
      p.ellipse(x, y, radius, radius * 0.7);
    }
    p.stroke(35, 55, 88, reducedMotion ? 0.08 : 0.13);
    p.strokeWeight(0.6);
    for (let index = 0; index < 11; index += 1) {
      const y = p.height * (0.1 + index * 0.08);
      p.line(p.width * 0.06, y, p.width * 0.94, y + Math.sin(index) * 12);
    }
  };
  p.windowResized = () => {
    if (!field) return;
    p.resizeCanvas(Math.max(240, field.clientWidth), Math.max(260, field.clientHeight));
    p.redraw();
  };
};

ambient = new window.p5(ambientSketch, 'pressure-ambient');
renderSvg();
window.__mutineNaiveV049 = {
  getState: () => state,
  buildFrame,
  buildTimeline,
  commitPressure,
  geometrySignature: () => geometrySignature(state),
  liftLatest,
  releaseMemory,
  renderSignature: () => geometrySignature(state)
};
