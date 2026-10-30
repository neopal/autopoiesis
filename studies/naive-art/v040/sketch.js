import {
  beginPress,
  buildFrame,
  buildTimeline,
  commitPress,
  geometrySignature,
  layerSignature,
  liftLatestPress,
  releaseMemory,
  LAYER_COUNT,
  MAX_SWEEP,
  MIN_SWEEP
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const field = document.querySelector('#mould-field');
const mount = document.querySelector('#mould-canvas-mount');
const stageEl = document.querySelector('[data-stage]');
const memoryEl = document.querySelector('[data-memory]');
const statusEl = document.querySelector('[data-status]');
const pendingEl = document.querySelector('[data-pending]');
const timeline = buildTimeline();
let state = buildFrame();
let pendingLayer = null;
let drag = null;
let sketch;
let backdrop;
let relief;
let grain;

function settledFrame() {
  let frame = buildFrame();
  for (const press of timeline) frame = commitPress(beginPress(frame, press), press);
  return frame;
}

if (staticMode) state = settledFrame();

const statusText = () => ({
  idle: 'press a band, then cross the mould',
  'press-armed': 'pressure is held; cross before release',
  'press-refused-invalid': 'the mould has no band there',
  'press-refused-light': 'the pressure did not take',
  'press-refused-heavy': 'the pressure set too hard',
  'press-refused-short': 'the cast was too brief',
  'press-refused-wide': 'the cast ran past the mould',
  'press-committed': 'the wrong cast hardened elsewhere',
  'press-lifted': 'the last cast was lifted',
  'memory-released': 'the form is released'
}[state.interaction] || state.interaction);

function updateReadout() {
  if (!stageEl) return;
  stageEl.textContent = `cast ${String(state.stage).padStart(2, '0')} / 04`;
  memoryEl.textContent = `${state.memory.length} retained`;
  statusEl.textContent = pendingLayer === null ? statusText() : `band ${pendingLayer + 1} held`;
  field?.setAttribute('data-memory-count', String(state.memory.length));
  field?.setAttribute('data-pending-layer', pendingLayer === null ? '' : String(pendingLayer));
}

function updatePending() {
  if (!pendingEl || !field) return;
  pendingEl.replaceChildren();
  if (pendingLayer === null) return;
  const rect = field.getBoundingClientRect();
  const top = ((0.09 + pendingLayer * 0.082) / 1.0) * rect.height;
  const mark = document.createElement('span');
  mark.className = 'pending-mark';
  mark.style.left = `${rect.width * (0.5 + Math.sin(pendingLayer * 1.7) * 0.045)}px`;
  mark.style.top = `${top}px`;
  pendingEl.append(mark);
}

function updateState(next) {
  state = next;
  sketch?.redraw();
  updateReadout();
  updatePending();
  field?.focus({ preventScroll: true });
}

function deterministicPress() {
  return timeline[state.memory.length % timeline.length];
}

function commitDeterministicPress() {
  if (staticMode) return;
  const press = pendingLayer === null ? deterministicPress() : { layer: pendingLayer, pressure: 0.62, sweep: 0.48 };
  pendingLayer = null;
  drag = null;
  updateState(commitPress(beginPress(state, press), press));
}

function chooseLayer(clientY) {
  const rect = field.getBoundingClientRect();
  const normalized = Math.max(0, Math.min(0.999999, (clientY - rect.top) / rect.height));
  return Math.max(0, Math.min(LAYER_COUNT - 1, Math.floor((normalized - 0.07) / 0.86 * LAYER_COUNT)));
}

function normalizedSweep() {
  if (!drag) return 0;
  return Math.min(1.2, drag.distance / Math.max(1, field.getBoundingClientRect().width));
}

function markPointer(event) {
  if (staticMode) return;
  pendingLayer = chooseLayer(event.clientY);
  drag = { layer: pendingLayer, lastX: event.clientX, lastY: event.clientY, distance: 0 };
  updateState(beginPress(state, { layer: pendingLayer }));
  field.setPointerCapture?.(event.pointerId);
}

function movePointer(event) {
  if (staticMode || !drag) return;
  drag.distance += Math.hypot(event.clientX - drag.lastX, event.clientY - drag.lastY);
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  updateReadout();
}

function releasePointer(event) {
  if (staticMode || !drag) return;
  const sweep = normalizedSweep();
  const pressure = Number.isFinite(event.pressure) && event.pressure > 0 ? Math.min(0.92, event.pressure * 1.12) : 0.62;
  const press = { layer: drag.layer, pressure, sweep: Math.min(MAX_SWEEP, sweep) };
  pendingLayer = null;
  drag = null;
  updateState(commitPress(state, press));
  field.releasePointerCapture?.(event.pointerId);
}

field?.addEventListener('pointerdown', markPointer);
field?.addEventListener('pointermove', movePointer);
field?.addEventListener('pointerup', releasePointer);
field?.addEventListener('pointercancel', () => { pendingLayer = null; drag = null; updateReadout(); updatePending(); });
field?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commitDeterministicPress();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    pendingLayer = null;
    drag = null;
    updateState(liftLatestPress(state));
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    pendingLayer = null;
    drag = null;
    updateState(releaseMemory(state));
  } else if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    const current = pendingLayer ?? deterministicPress().layer;
    pendingLayer = Math.max(0, Math.min(LAYER_COUNT - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
    updateState(beginPress(state, { layer: pendingLayer }));
  }
});

document.querySelector('[data-action="cast"]')?.addEventListener('click', commitDeterministicPress);
document.querySelector('[data-action="lift"]')?.addEventListener('click', () => {
  pendingLayer = null;
  drag = null;
  updateState(liftLatestPress(state));
});
document.querySelector('[data-action="release"]')?.addEventListener('click', () => {
  pendingLayer = null;
  drag = null;
  updateState(releaseMemory(state));
});

const PALETTE = [
  [18, 58, 24],
  [31, 70, 34],
  [47, 62, 48],
  [205, 54, 69],
  [328, 56, 64],
  [74, 42, 55]
];

function drawBackdrop(g, width, height) {
  g.clear();
  for (let y = 0; y < height; y += 1) {
    const mix = y / height;
    g.stroke(18 + mix * 18, 38 + mix * 12, 16 + mix * 16, 100);
    g.line(0, y, width, y);
  }
  g.noStroke();
  g.fill(44, 52, 18, 28);
  g.beginShape();
  g.vertex(width * .04, height * .8);
  g.bezierVertex(width * .18, height * .22, width * .42, height * .12, width * .84, height * .2);
  g.bezierVertex(width * .98, height * .58, width * .8, height * .92, width * .22, height * .97);
  g.endShape(g.CLOSE);
  g.fill(214, 34, 26, 15);
  g.beginShape();
  g.vertex(width * .08, height * .14);
  g.bezierVertex(width * .39, height * .03, width * .72, height * .1, width * .95, height * .44);
  g.bezierVertex(width * .76, height * .25, width * .43, height * .32, width * .08, height * .14);
  g.endShape(g.CLOSE);
}

function hsb(g, value, alpha = 100) { g.fill(value[0], value[1], value[2], alpha); }

function drawSupport(g, width, height) {
  g.noStroke();
  g.fill(12, 36, 11, 34);
  g.beginShape();
  g.vertex(width * .13, height * .88);
  g.bezierVertex(width * .3, height * .73, width * .7, height * .74, width * .91, height * .88);
  g.bezierVertex(width * .69, height * .98, width * .29, height * .99, width * .13, height * .88);
  g.endShape(g.CLOSE);
  g.noFill();
  g.stroke(34, 34, 22, 46);
  g.strokeWeight(Math.max(1, width * .0014));
  g.beginShape();
  g.vertex(width * .16, height * .88);
  g.bezierVertex(width * .37, height * .77, width * .65, height * .78, width * .87, height * .88);
  g.endShape();
}

function layerGeometry(layer, width, height, shadow = false) {
  const cx = width * (layer.x + layer.offsetX + (shadow ? 0.018 : 0));
  const cy = height * (0.06 + layer.y * 0.88 + layer.offsetY + (shadow ? 0.022 : 0));
  const breadth = width * layer.span * 0.48;
  const depth = height * layer.depth * 0.62;
  const bend = width * layer.bend * 0.12;
  return { cx, cy, breadth, depth, bend };
}

function drawLayer(g, layer, width, height) {
  const shape = layerGeometry(layer, width, height, true);
  g.push();
  g.translate(shape.cx, shape.cy);
  g.rotate(layer.tilt);
  g.noStroke();
  g.fill(9, 38, 8, 36);
  g.beginShape();
  g.vertex(-shape.breadth * .98, -shape.depth * .38);
  g.vertex(shape.breadth * .82 + shape.bend, -shape.depth * .31);
  g.vertex(shape.breadth * .99 + shape.bend, shape.depth * .42);
  g.vertex(-shape.breadth * .82, shape.depth * .5);
  g.endShape(g.CLOSE);
  g.pop();

  const main = layerGeometry(layer, width, height);
  g.push();
  g.translate(main.cx, main.cy);
  g.rotate(layer.tilt);
  const color = layer.role === 'overcast' ? [191, 66, 73] : layer.role === 'underformed' ? [23, 29, 29] : layer.role === 'memory-ridge' ? [39, 78, 77] : PALETTE[layer.tone % PALETTE.length];
  const alpha = layer.role === 'underformed' ? 88 : 96;
  hsb(g, color, alpha);
  g.noStroke();
  g.beginShape();
  g.vertex(-main.breadth, -main.depth * .37);
  g.vertex(-main.breadth * .34 + main.bend, -main.depth * .59);
  g.vertex(main.breadth * .68 + main.bend, -main.depth * .45);
  g.vertex(main.breadth, -main.depth * .08);
  g.vertex(main.breadth * .86 + main.bend, main.depth * .56);
  g.vertex(-main.breadth * .6, main.depth * .64);
  g.vertex(-main.breadth * (.9 - layer.notch * .14), main.depth * .1);
  g.endShape(g.CLOSE);

  g.noFill();
  g.stroke(layer.role === 'overcast' ? 8 : 34, layer.role === 'underformed' ? 25 : 48, layer.role === 'memory-ridge' ? 95 : 78, 72);
  g.strokeWeight(Math.max(1, width * (.0012 + layer.hardness * .0014)));
  g.beginShape();
  g.vertex(-main.breadth * .72, -main.depth * .2);
  g.bezierVertex(-main.breadth * .2 + main.bend, main.depth * (.1 + layer.phase * .12), main.breadth * .26 + main.bend, -main.depth * (.1 + layer.phase * .08), main.breadth * .75, main.depth * .24);
  g.endShape();

  const marks = 2 + Math.floor(layer.hardness * 4);
  for (let index = 0; index < marks; index += 1) {
    const progress = (index + 1) / (marks + 1);
    const x = -main.breadth * .74 + progress * main.breadth * 1.4;
    g.stroke(44, 24, 94, layer.role === 'underformed' ? 24 : 34);
    g.line(x, -main.depth * .25, x + main.bend * .12, main.depth * .29);
  }

  if (layer.role === 'overcast') {
    g.stroke(48, 28, 98, 90);
    g.strokeWeight(Math.max(1.2, width * .002));
    g.line(-main.breadth * .47, main.depth * .48, main.breadth * .62, -main.depth * .44);
  } else if (layer.role === 'underformed') {
    g.stroke(14, 65, 83, 74);
    g.strokeWeight(Math.max(1, width * .0015));
    g.line(-main.breadth * .48, -main.depth * .38, main.breadth * .48, main.depth * .4);
  } else if (layer.role === 'memory-ridge') {
    g.stroke(43, 77, 93, 82);
    g.strokeWeight(Math.max(1.2, width * .0018));
    g.line(-main.breadth * .82, main.depth * .43, main.breadth * .76, -main.depth * .39);
  }
  g.pop();
}

function drawRelief(g, currentState, width, height) {
  g.clear();
  g.image(backdrop, 0, 0);
  drawSupport(g, width, height);
  g.noStroke();
  g.fill(7, 24, 9, 26);
  g.beginShape();
  g.vertex(width * .27, height * .08);
  g.bezierVertex(width * .17, height * .38, width * .23, height * .71, width * .35, height * .91);
  g.bezierVertex(width * .58, height * .98, width * .76, height * .8, width * .77, height * .13);
  g.bezierVertex(width * .61, height * .05, width * .42, height * .04, width * .27, height * .08);
  g.endShape(g.CLOSE);
  currentState.scene.layers.forEach((layer) => drawLayer(g, layer, width, height));
  g.noFill();
  g.stroke(23, 30, 20, 46);
  g.strokeWeight(Math.max(1, width * .001));
  g.beginShape();
  g.vertex(width * .2, height * .1);
  g.bezierVertex(width * .41, height * .01, width * .62, height * .17, width * .83, height * .08);
  g.endShape();
}

function drawGrain(g, width, height) {
  g.clear();
  g.randomSeed(430);
  g.strokeWeight(1);
  for (let index = 0; index < Math.floor(width * height / 1350); index += 1) {
    g.stroke(36 + g.random(28), 26, 24 + g.random(20), g.random(4, 13));
    const x = g.random(width);
    const y = g.random(height);
    g.point(x, y);
    if (index % 13 === 0) g.line(x, y, x + g.random(-4, 4), y + g.random(-2, 2));
  }
}

function render(p) {
  if (!backdrop || !relief || !grain) return;
  const width = p.width;
  const height = p.height;
  drawBackdrop(backdrop, width, height);
  drawRelief(relief, state, width, height);
  drawGrain(grain, width, height);
  p.clear();
  p.image(relief, 0, 0);
  p.image(grain, 0, 0);
  p.noFill();
  p.stroke(26, 26, 20, 56);
  p.strokeWeight(Math.max(1, width * .001));
  p.rect(width * .018, height * .02, width * .964, height * .96);
}

function resizeLayers(width, height) {
  backdrop?.remove();
  relief?.remove();
  grain?.remove();
  backdrop = sketch.createGraphics(width, height);
  relief = sketch.createGraphics(width, height);
  grain = sketch.createGraphics(width, height);
  [backdrop, relief, grain].forEach((layer) => {
    layer.pixelDensity(1);
    layer.colorMode(sketch.HSB, 360, 100, 100, 100);
  });
}

sketch = new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    const width = Math.max(1, mount?.clientWidth || 900);
    const height = Math.max(1, mount?.clientHeight || 680);
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

window.__mutineNaiveV040 = {
  getState: () => JSON.parse(JSON.stringify(state)),
  buildFrame,
  beginPress,
  buildTimeline,
  commitPress,
  geometrySignature,
  layerSignature,
  liftLatestPress,
  releaseMemory,
  renderSignature: () => geometrySignature(state),
  normalizedSweep,
  constants: { LAYER_COUNT, MIN_SWEEP, MAX_SWEEP }
};

updateReadout();
updatePending();
