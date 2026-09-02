import { STAGES, buildTimeline } from './engine.mjs';

const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = new URLSearchParams(location.search).get('static') === '1';
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const stageDuration = 4400;
const startedAt = performance.now();

function drawPath(points, gapStart = -1, gapLength = 0, close = false) {
  if (!points.length) return;
  const count = points.length;
  const isGap = (index) => gapStart >= 0 && ((index - gapStart + count) % count) < gapLength;
  context.beginPath();
  points.forEach((point, index) => {
    if (isGap(index)) return;
    const previous = points[(index - 1 + count) % count];
    if (index === 0 || isGap((index - 1 + count) % count)) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
    if (close && index === count - 1 && !isGap(0) && !isGap(index)) context.closePath();
    void previous;
  });
  context.stroke();
}

function drawScar(spot, index) {
  context.save();
  context.translate(spot.x, spot.y);
  context.rotate(-0.55 + index * 0.42);
  context.beginPath();
  context.moveTo(-0.021, -0.004);
  context.quadraticCurveTo(0, 0.018, 0.023, 0.004);
  context.stroke();
  context.restore();
}

function render(frame, progress = 1) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(height * pixelRatio));
  context.setTransform(canvas.width, 0, 0, canvas.height, 0, 0);
  context.clearRect(0, 0, 1, 1);

  const gradient = context.createRadialGradient(0.47, 0.42, 0.04, 0.5, 0.5, 0.78);
  gradient.addColorStop(0, '#27221f');
  gradient.addColorStop(1, '#0f0e0d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = '#d8b895';
  context.lineWidth = 0.00055;
  for (let index = 0; index < 22; index += 1) {
    const y = 0.08 + index * 0.039;
    context.beginPath();
    context.moveTo(0.08 + Math.sin(index * 1.7) * 0.04, y);
    context.quadraticCurveTo(0.49, y + Math.sin(index * 0.73) * 0.012, 0.92 + Math.cos(index) * 0.03, y + 0.006);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = 0.28;
  context.strokeStyle = '#d15c43';
  context.lineWidth = 0.0011;
  context.setLineDash([0.008, 0.012]);
  drawPath(frame.draft, -1, 0, true);
  context.restore();

  context.save();
  context.globalAlpha = 0.96;
  context.strokeStyle = '#e9dec8';
  context.lineWidth = 0.0022;
  context.lineCap = 'round';
  drawPath(frame.contour, frame.gapStart, frame.gapLength, false);
  context.restore();

  context.save();
  context.strokeStyle = '#d68a55';
  context.lineWidth = 0.0015;
  context.globalAlpha = 0.86;
  context.beginPath();
  context.arc(frame.blindSpot.x, frame.blindSpot.y, frame.blindSpot.radius * (0.75 + progress * 0.25), -1.2, 1.65);
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = '#e9dec8';
  context.fillStyle = '#d68a55';
  context.lineWidth = 0.00135;
  context.globalAlpha = 0.74;
  context.setLineDash([0.004, 0.009]);
  context.beginPath();
  frame.decisionNodes.forEach((node, index) => {
    if (index === 0) context.moveTo(node.x, node.y);
    else context.lineTo(node.x, node.y);
  });
  context.stroke();
  context.setLineDash([]);
  frame.decisionNodes.forEach((node, index) => {
    context.save();
    context.translate(node.x, node.y);
    context.rotate(-0.25 + index * 0.31);
    context.beginPath();
    context.moveTo(0, -0.012);
    context.lineTo(0.012, 0);
    context.lineTo(0, 0.012);
    context.lineTo(-0.012, 0);
    context.closePath();
    context.fill();
    context.restore();
  });
  context.restore();

  context.save();
  context.strokeStyle = '#b74e3a';
  context.lineWidth = 0.00125;
  context.globalAlpha = 0.82;
  frame.memory.forEach(drawScar);
  context.restore();

  if (stageReadout) stageReadout.textContent = String(frame.stage + 1).padStart(2, '0');
  if (memoryReadout) memoryReadout.textContent = String(frame.memory.length).padStart(2, '0');
}

function resize() {
  render(timeline[frozen ? timeline.length - 1 : 0]);
}

function frame(now) {
  const cycle = stageDuration * timeline.length;
  const elapsed = (now - startedAt) % cycle;
  const stage = Math.max(0, Math.min(timeline.length - 1, Math.floor(elapsed / stageDuration)));
  const progress = (elapsed % stageDuration) / stageDuration;
  render(timeline[stage], progress);
  if (!frozen) requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(canvas);
resize();
if (!frozen) requestAnimationFrame(frame);
