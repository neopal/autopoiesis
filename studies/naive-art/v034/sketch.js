import {
  FACET_COUNT,
  MIN_DWELL,
  armFacet,
  buildFrame,
  buildTimeline,
  commitObservation,
  geometrySignature,
  liftLatestObservation,
  releaseMemory
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const reliefField = document.querySelector('#relief-field');
const canvasWrap = document.querySelector('#relief-canvas-wrap');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
let state = buildFrame();
let sketch;
let pointerStart = null;

function settledFrame() {
  let frame = buildFrame();
  for (const facet of buildTimeline()) {
    frame = armFacet(frame, { facet });
    frame = commitObservation(frame, { dwell: MIN_DWELL + 220 });
  }
  return frame;
}

if (params.get('static') === '1') state = settledFrame();

function copyState(value) {
  return JSON.parse(JSON.stringify(value));
}

function statusText() {
  return {
    idle: 'choose a facet · hold to look',
    'facet-armed': 'the model is listening',
    'facet-refused': 'that look is refused',
    'observation-refused': 'the model stays exact',
    'observation-committed': 'the model filled the missing side',
    'observation-lifted': 'the last reconstruction was lifted',
    'memory-released': 'the model is released'
  }[state.interaction] || state.interaction;
}

function updateUi() {
  if (!stageEl) return;
  stageEl.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = statusText();
  document.querySelectorAll('[data-facet]').forEach((button) => {
    button.dataset.armed = state.pending.includes(Number(button.dataset.facet)) ? 'true' : 'false';
  });
}

function updateState(next) {
  state = next;
  updateUi();
  if (sketch) sketch.redraw();
}

function chooseFacet(facet) {
  updateState(armFacet(state, { facet }));
  reliefField?.focus({ preventScroll: true });
}

function observe(dwell = MIN_DWELL + 220) {
  updateState(commitObservation(state, { dwell }));
  reliefField?.focus({ preventScroll: true });
}

function lift() {
  updateState(liftLatestObservation(state));
  reliefField?.focus({ preventScroll: true });
}

function release() {
  updateState(releaseMemory(state));
  reliefField?.focus({ preventScroll: true });
}

function facetAt(clientX, clientY) {
  const rect = sketch?.canvas?.elt?.getBoundingClientRect();
  if (!rect) return 4;
  const x = Math.max(0, Math.min(0.999, (clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height));
  const col = Math.min(2, Math.floor(x * 3));
  const row = Math.min(2, Math.floor(y * 3));
  return row * 3 + col;
}

document.querySelectorAll('[data-facet]').forEach((button) => {
  button.addEventListener('click', () => chooseFacet(Number(button.dataset.facet)));
});
document.querySelector('[data-action="observe"]')?.addEventListener('click', () => observe());
document.querySelector('[data-action="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-action="release"]')?.addEventListener('click', release);
reliefField?.addEventListener('pointerdown', (event) => {
  if (params.get('blind') === '1' || params.get('static') === '1') return;
  reliefField.focus({ preventScroll: true });
  const facet = facetAt(event.clientX, event.clientY);
  chooseFacet(facet);
  pointerStart = performance.now();
  reliefField.setPointerCapture?.(event.pointerId);
});
reliefField?.addEventListener('pointerup', (event) => {
  if (params.get('blind') === '1' || params.get('static') === '1' || pointerStart === null) return;
  const dwell = performance.now() - pointerStart;
  pointerStart = null;
  observe(dwell);
  reliefField.releasePointerCapture?.(event.pointerId);
});
reliefField?.addEventListener('pointercancel', () => {
  pointerStart = null;
  updateState(commitObservation(state, { dwell: 0 }));
});
reliefField?.addEventListener('keydown', (event) => {
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    chooseFacet(Number(event.key) - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    observe();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

const PALETTE = {
  quiet: ['#d9cfb0', '#b9aa83', '#866f53'],
  observed: ['#dd9970', '#b96c54', '#764a40'],
  'false-copy': ['#a4c3bb', '#6e9b95', '#3c615e'],
  missing: ['#282a24', '#171b18', '#0d1110'],
  remembering: ['#e6c96d', '#bd9850', '#71552f']
};

function facetColour(facet, side = 0) {
  const colours = PALETTE[facet.state] || PALETTE.quiet;
  return colours[Math.min(colours.length - 1, side)];
}

function polygonFor(width, depth, notch) {
  const n = Math.min(0.38, notch * 0.34);
  return [
    [-width * 0.5, -depth * 0.5],
    [width * (0.08 - n), -depth * 0.5],
    [width * 0.5, -depth * 0.34],
    [width * 0.43, depth * 0.5],
    [-width * 0.28, depth * 0.48],
    [-width * 0.5, depth * (0.18 + n * 0.24)]
  ];
}

function drawPrism(p, points, height, topColour, sideColour) {
  p.push();
  p.noStroke();
  p.fill(topColour);
  p.beginShape(p.TRIANGLE_FAN);
  points.forEach(([x, y]) => p.vertex(x, y, height));
  p.endShape();
  p.fill(sideColour);
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    const current = points[index];
    p.beginShape(p.QUADS);
    p.vertex(current[0], current[1], 0);
    p.vertex(next[0], next[1], 0);
    p.vertex(next[0], next[1], height);
    p.vertex(current[0], current[1], height);
    p.endShape();
  }
  p.pop();
}

function drawFacet(p, facet, unit) {
  const x = facet.x * unit * 0.86;
  const y = facet.y * unit * 0.78;
  const width = facet.width * unit * 0.88;
  const depth = facet.depth * unit * 0.82;
  const height = Math.max(6, facet.height * unit * 0.72);
  p.push();
  p.translate(x, y + unit * 0.08, facet.z * unit);
  p.rotateZ(facet.twist);
  p.rotateX(facet.tilt);
  const points = polygonFor(width, depth, facet.notch);
  drawPrism(p, points, height, facetColour(facet, 0), facetColour(facet, 1));

  if (facet.state === 'missing') {
    p.noFill();
    p.stroke('#dc8c63');
    p.strokeWeight(Math.max(1.2, unit * 0.008));
    p.beginShape(p.LINE_LOOP);
    points.forEach(([px, py]) => p.vertex(px, py, height + 1));
    p.endShape();
  } else {
    const inset = facet.relief * 0.18;
    p.translate(-width * 0.04, depth * 0.02, height + 2);
    p.rotateZ(facet.relief * 0.35);
    drawPrism(p, polygonFor(width * (0.34 + inset), depth * 0.24, facet.notch * 0.3), Math.max(2, height * 0.08), facetColour(facet, 1), facetColour(facet, 2));
  }
  p.pop();
}

function render(p) {
  p.background('#111613');
  const unit = Math.min(p.width, p.height) * 0.82;
  p.push();
  p.translate(0, 20, -10);
  p.rotateX(-0.78);
  p.rotateZ(0.035);
  p.ambientLight(70, 78, 70);
  p.directionalLight(235, 216, 167, -0.45, -0.7, -1);
  p.directionalLight(75, 116, 112, 0.6, 0.4, -0.5);
  p.noStroke();
  p.fill('#262d27');
  p.box(unit * 1.75, unit * 1.18, 12);
  p.translate(0, 0, 10);
  for (const facet of state.facets) drawFacet(p, facet, unit);
  p.pop();

  p.push();
  p.noStroke();
  p.fill(228, 198, 108, 32);
  p.translate(-p.width * 0.36, p.height * 0.38, 0);
  p.rotateZ(-0.16);
  p.rect(0, 0, p.width * 0.22, 2);
  p.fill(143, 182, 174, 28);
  p.translate(p.width * 1.28, -p.height * 0.04);
  p.rotateZ(0.24);
  p.rect(0, 0, p.width * 0.18, 2);
  p.pop();
}

sketch = new window.p5((p) => {
  p.setup = () => {
    window.p5.disableFriendlyErrors = true;
    const width = Math.max(320, canvasWrap?.clientWidth || 900);
    const height = Math.max(220, Math.round(width * 820 / 1400));
    p.pixelDensity(1);
    const canvas = p.createCanvas(width, height, p.WEBGL);
    canvas.id('relief-canvas');
    p.noLoop();
    p.frameRate(30);
    p.redraw();
  };
  p.draw = () => render(p);
  p.windowResized = () => {
    const width = Math.max(320, canvasWrap?.clientWidth || 900);
    p.resizeCanvas(width, Math.max(220, Math.round(width * 820 / 1400)));
    p.redraw();
  };
}, canvasWrap);

window.__mutineNaiveV034 = {
  getState: () => copyState(state),
  geometrySignature: () => geometrySignature(state),
  chooseFacet,
  observe,
  lift,
  release
};
updateUi();
