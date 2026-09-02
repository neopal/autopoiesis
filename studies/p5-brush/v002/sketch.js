import { STAGES, buildTimeline, stageIndexAt } from './engine.mjs';

const field = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const context = field.getContext('2d');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3900;
const started = performance.now();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = new URLSearchParams(location.search).get('static') === '1';
const frozen = reducedMotion || staticPreview;

const palette = {
  paper: '#ded8c8',
  paperShadow: '#c8c0ae',
  ink: '#172322',
  green: '#3e5c53',
  red: '#b84c36',
  orange: '#d57945',
  pale: '#eee8d9'
};

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = field.getBoundingClientRect();
  field.width = Math.max(1, Math.floor(bounds.width * ratio));
  field.height = Math.max(1, Math.floor(bounds.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  render(frozen ? timeline[timeline.length - 1] : timeline[0], frozen ? 1 : 0);
}

function point(point, width, height) {
  return [point.x * width, point.y * height];
}

function drawPath(points, width, height, color, strokeWidth, alpha = 1, dashed = false, offset = 0) {
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = Math.max(1.5, strokeWidth * Math.min(width, height));
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (dashed) context.setLineDash([9, 13]);
  context.beginPath();
  points.forEach((rawPoint, index) => {
    const [x, y] = point(rawPoint, width, height);
    if (index === 0) context.moveTo(x + offset, y + offset * 0.35);
    else context.lineTo(x + offset, y + offset * 0.35);
  });
  context.stroke();
  context.restore();
}

function drawPaper(width, height, stage) {
  context.fillStyle = palette.paper;
  context.fillRect(0, 0, width, height);
  for (let index = 0; index < 26; index += 1) {
    const x = (0.04 + ((index * 0.173 + stage * 0.009) % 0.9)) * width;
    const y = (0.08 + ((index * 0.071) % 0.8)) * height;
    drawPath([{ x: x / width, y: y / height }, { x: (x + 26 + (index % 4) * 9) / width, y: (y - 3) / height }], width, height, palette.paperShadow, 0.002, 0.52);
  }
}

function drawWound(wound, width, height, index, active = false) {
  const [x, y] = point(wound, width, height);
  const radius = wound.radius * Math.min(width, height);
  context.save();
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = palette.pale;
  context.lineWidth = radius * 0.72;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x - radius * 1.35, y - radius * 0.55);
  context.quadraticCurveTo(x, y + radius * 0.82, x + radius * 1.42, y + radius * 0.24);
  context.stroke();
  context.strokeStyle = active ? palette.orange : palette.red;
  context.lineWidth = Math.max(2, radius * 0.12);
  context.beginPath();
  context.arc(x, y, radius * (active ? 1.05 : 0.86), -0.8, 1.8);
  context.stroke();
  context.fillStyle = palette.orange;
  context.globalAlpha = active ? 0.92 : 0.56;
  context.beginPath();
  context.arc(x + radius * 1.08, y + radius * 0.24, Math.max(2.5, radius * 0.11), 0, Math.PI * 2);
  context.fill();
  context.restore();
  if (active) {
    context.save();
    context.fillStyle = palette.red;
    context.font = '600 10px Arial, sans-serif';
    context.letterSpacing = '1.5px';
    context.fillText('RETURN / CUT', x + radius * 1.3, y - radius * 0.9);
    context.restore();
  }
}

function render(frame, progress) {
  const width = field.clientWidth;
  const height = field.clientHeight;
  context.clearRect(0, 0, width, height);
  drawPaper(width, height, frame.stage);

  frame.draftStrokes.forEach((stroke) => drawPath(stroke.points, width, height, palette.red, stroke.width * 0.74, 0.4, true));
  frame.strokes.forEach((stroke) => {
    drawPath(stroke.points, width, height, palette.green, stroke.width * 1.8, (0.12 + progress * 0.18) * stroke.opacity, false, 2);
    drawPath(stroke.points, width, height, palette.ink, stroke.width, (0.42 + progress * 0.5) * stroke.opacity);
    drawPath(stroke.points, width, height, palette.ink, stroke.width * 0.34, (0.2 + progress * 0.3) * stroke.opacity, false, -2);
  });
  frame.memory.forEach((wound, index) => drawWound(wound, width, height, index));
  drawWound(frame.wound, width, height, frame.memory.length, true);

  context.save();
  context.fillStyle = palette.ink;
  context.font = '600 11px Arial, sans-serif';
  context.letterSpacing = '2px';
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, 24, height - 24);
  context.fillStyle = palette.red;
  context.fillText(`WOUNDS KEPT ${String(frame.memory.length).padStart(2, '0')}`, width - 126, height - 24);
  context.restore();
  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} autonomous wounds`;
}

function frame(now) {
  const stage = stageIndexAt(now, started, STAGE_MS, timeline.length);
  const progress = ((Math.max(0, now - started)) % STAGE_MS) / STAGE_MS;
  render(timeline[stage], progress);
  if (!frozen) requestAnimationFrame(frame);
}

const observer = new ResizeObserver(resize);
observer.observe(field);
resize();
if (!frozen) requestAnimationFrame(frame);
