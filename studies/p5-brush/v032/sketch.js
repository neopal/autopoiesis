import {
  STAGES,
  CONTROL_RAKES,
  applyRake,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestRake,
  nextControlRake,
  releaseRakes
} from './engine.mjs';

const FIELD_ID = 'weather-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = ['#2e5961', '#a94f38', '#b88943', '#5f7770', '#8e5d68', '#c39454', '#36515b', '#9e6a48'];
const paper = '#ded3be';
const ink = '#182125';

let p5Api;
let canvas;
let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let raking = false;
let pointerId = null;
let startedAt = 0;
let startPoint = { x: 0.5, y: 0.5 };
let currentPoint = { x: 0.5, y: 0.5 };

function fieldNode() {
  return document.getElementById(FIELD_ID);
}

function stateMessage(label) {
  return {
    baseline: 'The paper is holding its current.',
    raking: 'A current is being pulled through the fibres.',
    'rake-committed': 'The local trace vanished; distant fibres kept the weather.',
    'rake-refused-weak': 'The rake was too weak to move the weather.',
    'rake-refused-overheld': 'The paper refused pressure held too long.',
    'rake-refused-still': 'Stillness is not a rake; the field stayed intact.',
    'rake-refused-repeat': 'The same current will not be counted twice.',
    'rake-lifted': 'The latest weather lifted; the preceding field returns.',
    'rake-lift-refused': 'There is no weather to lift.',
    'rakes-released': 'The paper released its remembered current.'
  }[label] || 'The paper is holding its current.';
}

function syncState(label = frame.interaction || 'baseline') {
  const field = fieldNode();
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.stage = String(frame.stage);
  field.dataset.sheared = String(frame.shearedCount);
  field.dataset.thinned = String(frame.thinnedCount);
  field.dataset.swollen = String(frame.swollenCount);
  field.dataset.scored = String(frame.scoredCount);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} rake${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) stateNode.textContent = stateMessage(label);
}

function nextRake() {
  return nextControlRake(frame.controlCursor);
}

function redrawFrame(label) {
  syncState(label);
  if (p5Api) p5Api.redraw();
}

function commit(rake, source = 'keyboard-rake') {
  const nextFrame = applyRake(frame, rake, source);
  if (nextFrame.interaction === 'rake-committed' && Number.isInteger(rake.controlIndex)) {
    nextFrame.controlCursor = (rake.controlIndex + 1) % CONTROL_RAKES.length;
  }
  frame = nextFrame;
  redrawFrame(frame.interaction);
}

function lift() {
  frame = liftLatestRake(frame);
  redrawFrame(frame.interaction);
}

function release() {
  frame = releaseRakes(frame);
  redrawFrame(frame.interaction);
}

function eventPoint(event) {
  const rect = canvas.elt.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0.04, 0.96),
    y: clamp((event.clientY - rect.top) / rect.height, 0.06, 0.94)
  };
}

function drawPaper(p) {
  const ctx = p.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, 1000, 700);
  gradient.addColorStop(0, '#eee3ce');
  gradient.addColorStop(.48, paper);
  gradient.addColorStop(1, '#cfc0a5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 700);
  p.push();
  p.strokeCap(p.ROUND);
  for (let index = 0; index < 520; index += 1) {
    const x = (index * 73 + index * index * 17) % 1000;
    const y = (index * 47 + index * index * 11) % 700;
    const length = 1 + (index % 5) * 1.7;
    p.stroke(index % 4 === 0 ? '#fff4dd' : '#9c8e76');
    p.strokeWeight(index % 7 === 0 ? 0.8 : 0.35);
    p.drawingContext.globalAlpha = index % 4 === 0 ? 0.12 : 0.08;
    p.line(x, y, x + length, y + Math.sin(index) * .7);
  }
  p.pop();
}

function px(point) {
  return { x: point.x * 1000, y: point.y * 700 };
}

function pigmentColor(p, index, alpha) {
  const color = p.color(palette[index % palette.length]);
  color.setAlpha(alpha);
  return color;
}

function drawUnderwash(p, band, index) {
  const center = band.bristles[Math.floor(band.bristles.length / 2)];
  const color = pigmentColor(p, band.pigment ?? index, 32 + band.swelling * 26);
  p.push();
  p.noFill();
  p.stroke(color);
  p.strokeWeight(22 + band.width * 460 + band.swelling * 14);
  p.strokeCap(p.ROUND);
  p.beginShape();
  center.points.forEach((point) => {
    const target = px(point);
    p.vertex(target.x, target.y);
  });
  p.endShape();
  p.pop();
}

function drawBristle(p, bristle, band, bandIndex) {
  p.push();
  p.strokeCap(p.ROUND);
  for (let index = 0; index < bristle.points.length - 1; index += 1) {
    const point = bristle.points[index];
    const next = bristle.points[index + 1];
    if (!point.visible || !next.visible) continue;
    const color = pigmentColor(p, band.pigment ?? bandIndex, 255 * bristle.opacity * point.alpha);
    p.stroke(color);
    p.strokeWeight(Math.max(0.7, point.weight * 1000));
    const a = px(point);
    const b = px(next);
    p.line(a.x, a.y, b.x, b.y);
  }
  p.pop();
}

function drawWeather(p) {
  frame.bands.forEach((band, index) => {
    drawUnderwash(p, band, index);
    band.bristles.forEach((bristle) => drawBristle(p, bristle, band, index));
  });
}

function drawRakeTrace(p) {
  if (!raking) return;
  const a = px(startPoint);
  const b = px(currentPoint);
  p.push();
  p.noFill();
  p.stroke('#293d3f');
  p.strokeWeight(1.4);
  p.drawingContext.setLineDash([7, 9]);
  p.drawingContext.globalAlpha = 0.55;
  p.line(a.x, a.y, b.x, b.y);
  p.drawingContext.setLineDash([]);
  p.noStroke();
  p.fill('#a64f38');
  p.circle(b.x, b.y, 5);
  p.pop();
}

function render(p) {
  drawPaper(p);
  drawWeather(p);
  drawRakeTrace(p);
}

function attachInteraction() {
  const field = fieldNode();
  field.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    raking = true;
    pointerId = event.pointerId;
    startedAt = performance.now();
    startPoint = eventPoint(event);
    currentPoint = startPoint;
    field.setPointerCapture(pointerId);
    syncState('raking');
    if (p5Api) p5Api.redraw();
  });
  field.addEventListener('pointermove', (event) => {
    if (!raking || event.pointerId !== pointerId) return;
    currentPoint = eventPoint(event);
    if (!reducedMotion && p5Api) p5Api.redraw();
  });
  field.addEventListener('pointerup', (event) => {
    if (!raking || event.pointerId !== pointerId) return;
    currentPoint = eventPoint(event);
    const measuredPressure = Number(event.pressure) > 0 ? event.pressure : 0.55 + Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
    const rake = { start: startPoint, end: currentPoint, duration: Math.round(performance.now() - startedAt), pressure: clamp(measuredPressure, 0.2, 1) };
    raking = false;
    pointerId = null;
    commit(rake, 'pointer-rake');
  });
  field.addEventListener('pointercancel', () => { raking = false; pointerId = null; redrawFrame('baseline'); });
  document.getElementById('rake-control').addEventListener('click', () => commit(nextRake(), 'control-rake'));
  document.getElementById('lift-control').addEventListener('click', lift);
  document.getElementById('release-control').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(nextRake(), 'keyboard-rake'); }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
    if (event.key.toLowerCase() === 'r') release();
    if (event.key.toLowerCase() === 's' && p5Api) p5Api.saveCanvas('mutine-brush-v032-bristle-weather', 'png');
  });
}

new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    canvas = p.createCanvas(1000, 700).parent('weather-canvas-holder');
    canvas.elt.id = 'weather-canvas';
    p.noLoop();
    p5Api = p;
    window._p5Ready = true;
    syncState(frame.interaction || 'baseline');
    p.redraw();
  };
  p.draw = () => render(p);
}, 'weather-canvas-holder');

attachInteraction();
