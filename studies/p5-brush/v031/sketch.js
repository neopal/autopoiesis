import {
  STAGES,
  applyStroke,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestStroke,
  releaseStrokes
} from './engine.mjs';

const FIELD_ID = 'negative-field';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const palette = ['#d6c7a9', '#c97158', '#7d9c98', '#b79b66', '#917583', '#a7b0a0', '#bd805e'];
const ink = '#101518';
const paper = '#e8dfcd';

let p5Api;
let canvas;
let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let pressing = false;
let pointerId = null;
let startedAt = 0;
let startPoint = { x: 0.5, y: 0.5 };
let currentPoint = { x: 0.5, y: 0.5 };

const fieldNode = () => document.getElementById(FIELD_ID);
const stateMessage = (label) => ({
  baseline: 'The loop is holding its refusal.',
  offering: 'The mark is being offered to the material.',
  'stroke-committed': 'The mark was refused here; an absence moved elsewhere.',
  'stroke-refused-weak': 'The offer was too weak to leave the field.',
  'stroke-refused-overheld': 'The material refused pressure held too long.',
  'stroke-refused-still': 'Stillness is not a stroke; the loop stayed closed.',
  'stroke-refused-repeat': 'The same absence will not be counted twice.',
  'stroke-lifted': 'The latest absence lifted; the preceding ribbon returns.',
  'stroke-lift-refused': 'There is no absence to lift.',
  'strokes-released': 'The loop released what it had refused.'
}[label] || 'The loop is holding its refusal.');

function syncState(label = frame.interaction || 'baseline') {
  const field = fieldNode();
  field.dataset.signature = geometrySignature(frame);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.stage = String(frame.stage);
  field.dataset.eroded = String(frame.erodedCount);
  field.dataset.swollen = String(frame.swollenCount);
  field.dataset.scarred = String(frame.scarredCount);
  const stageNode = field.querySelector('[data-stage]');
  const memoryNode = field.querySelector('[data-memory]');
  const stateNode = document.querySelector('[data-interaction-state]');
  if (stageNode) stageNode.textContent = `stage ${String((frame.stage || 0) + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryNode) memoryNode.textContent = `${frame.memory.length} absence${frame.memory.length === 1 ? '' : 's'} held`;
  if (stateNode) stateNode.textContent = stateMessage(label);
}

function nextOffer() {
  const offers = [
    { start: { x: 0.19, y: 0.72 }, end: { x: 0.41, y: 0.35 }, duration: 260 },
    { start: { x: 0.78, y: 0.31 }, end: { x: 0.53, y: 0.72 }, duration: 420 },
    { start: { x: 0.18, y: 0.28 }, end: { x: 0.45, y: 0.52 }, duration: 180 },
    { start: { x: 0.82, y: 0.66 }, end: { x: 0.57, y: 0.35 }, duration: 510 }
  ];
  return offers[frame.memory.length % offers.length];
}

function redrawFrame(label) {
  syncState(label);
  if (p5Api) p5Api.redraw();
}

function commit(stroke, source = 'keyboard-stroke') {
  frame = applyStroke(frame, stroke, source);
  redrawFrame(frame.interaction);
}

function lift() {
  frame = liftLatestStroke(frame);
  redrawFrame(frame.interaction);
}

function release() {
  frame = releaseStrokes(frame);
  redrawFrame(frame.interaction);
}

function eventPoint(event) {
  const rect = canvas.elt.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0.04, 0.96),
    y: clamp((event.clientY - rect.top) / rect.height, 0.06, 0.94)
  };
}

function px(point) {
  return { x: point.x * 1000, y: point.y * 700 };
}

function drawBackground(p) {
  const ctx = p.drawingContext;
  const gradient = ctx.createRadialGradient(520, 310, 80, 500, 350, 690);
  gradient.addColorStop(0, '#243237');
  gradient.addColorStop(0.55, '#172227');
  gradient.addColorStop(1, '#0b1012');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, 700);
  p.push();
  p.noStroke();
  for (let index = 0; index < 260; index += 1) {
    const x = (index * 71 + index * index * 13) % 1000;
    const y = (index * 43 + index * index * 7) % 700;
    const size = 0.4 + (index % 5) * 0.28;
    p.fill(index % 4 === 0 ? 232 : 125, index % 4 === 0 ? 223 : 156, index % 4 === 0 ? 205 : 148, 18 + (index % 5) * 4);
    p.rect(x, y, size, size);
  }
  p.pop();
}

function drawInnerDust(p) {
  p.push();
  p.noStroke();
  for (let index = 0; index < 80; index += 1) {
    const angle = (index / 80) * Math.PI * 2;
    const radius = 118 + (index % 7) * 7;
    const x = 500 + Math.cos(angle) * radius;
    const y = 350 + Math.sin(angle) * radius * 0.82;
    p.fill(232, 223, 205, 12 + (index % 4) * 5);
    p.circle(x, y, 1 + (index % 3));
  }
  p.pop();
}

function drawSegment(p, segment, index) {
  const points = segment.points.map(px);
  const tone = p.color(palette[index % palette.length]);
  tone.setAlpha(218);
  p.push();
  p.drawingContext.shadowColor = 'rgba(0,0,0,.52)';
  p.drawingContext.shadowBlur = 24 + (segment.swelling || 0) * 7;
  p.drawingContext.shadowOffsetX = 5 + (segment.scar || 0) * 2;
  p.drawingContext.shadowOffsetY = 10;
  p.fill(tone);
  p.stroke(paper);
  p.strokeWeight(1.15 + (segment.erosion || 0) * 0.25);
  p.beginShape();
  points.forEach((point) => p.vertex(point.x, point.y));
  p.endShape(p.CLOSE);
  p.pop();

  const first = points[0];
  const second = points[1];
  const third = points[2];
  p.push();
  p.noFill();
  p.stroke(ink);
  p.strokeWeight(0.8 + (segment.scar || 0) * 0.25);
  p.drawingContext.globalAlpha = 0.34;
  p.beginShape();
  p.vertex((first.x + third.x) / 2, (first.y + third.y) / 2);
  p.vertex((second.x + third.x) / 2, (second.y + third.y) / 2);
  p.endShape();
  p.pop();
}

function drawLoop(p) {
  p.push();
  p.noFill();
  p.stroke('#edf0df');
  p.strokeWeight(0.65);
  p.drawingContext.globalAlpha = 0.22;
  p.ellipse(500, 350, 462, 505);
  p.pop();
  frame.segments.forEach((segment, index) => drawSegment(p, segment, index));
}

function drawOfferTrace(p) {
  if (!pressing) return;
  const a = px(startPoint);
  const b = px(currentPoint);
  p.push();
  p.noFill();
  p.stroke('#e6d3a5');
  p.strokeWeight(1);
  p.drawingContext.setLineDash([5, 8]);
  p.drawingContext.globalAlpha = 0.52;
  p.line(a.x, a.y, b.x, b.y);
  p.drawingContext.setLineDash([]);
  p.noStroke();
  p.fill('#e6d3a5');
  p.circle(b.x, b.y, 5);
  p.pop();
}

function render(p) {
  drawBackground(p);
  drawInnerDust(p);
  drawLoop(p);
  drawOfferTrace(p);
}

function attachInteraction() {
  const field = fieldNode();
  field.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    pressing = true;
    pointerId = event.pointerId;
    startedAt = performance.now();
    startPoint = eventPoint(event);
    currentPoint = startPoint;
    field.setPointerCapture(pointerId);
    syncState('offering');
    if (p5Api) p5Api.redraw();
  });
  field.addEventListener('pointermove', (event) => {
    if (!pressing || event.pointerId !== pointerId) return;
    currentPoint = eventPoint(event);
    if (!reducedMotion && p5Api) p5Api.redraw();
  });
  field.addEventListener('pointerup', (event) => {
    if (!pressing || event.pointerId !== pointerId) return;
    currentPoint = eventPoint(event);
    const stroke = { start: startPoint, end: currentPoint, duration: Math.round(performance.now() - startedAt) };
    pressing = false;
    pointerId = null;
    commit(stroke, 'pointer-stroke');
  });
  field.addEventListener('pointercancel', () => { pressing = false; pointerId = null; redrawFrame('baseline'); });
  document.getElementById('offer-control').addEventListener('click', () => commit(nextOffer(), 'control-stroke'));
  document.getElementById('lift-control').addEventListener('click', lift);
  document.getElementById('release-control').addEventListener('click', release);
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(nextOffer(), 'keyboard-stroke'); }
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
    if (event.key.toLowerCase() === 'r') release();
    if (event.key.toLowerCase() === 's' && p5Api) p5Api.saveCanvas('mutine-brush-v031-negative-ribbon', 'png');
  });
}

new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(1000, 700).parent('negative-canvas-holder');
    canvas = p.createCanvas ? { elt: document.getElementById('negative-canvas') || document.querySelector('#negative-canvas-holder canvas') } : null;
    if (canvas?.elt) canvas.elt.id = 'negative-canvas';
    p.noLoop();
    p5Api = p;
    window._p5Ready = true;
    syncState(frame.interaction || 'baseline');
    p.redraw();
  };
  p.draw = () => render(p);
}, 'negative-canvas-holder');

attachInteraction();
