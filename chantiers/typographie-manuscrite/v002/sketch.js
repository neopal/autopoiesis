import { MASTER_SEED, makeRoutes, buildStage } from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAGE_MS = 9000;
let width = 0;
let height = 0;
let ratio = 1;
let startedAt = performance.now();

function pointAt(route, index, progress) {
  const from = route.points[index];
  const to = route.points[index + 1];
  const amount = Math.max(0, Math.min(1, progress * route.points.length - index));
  return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
}

function drawRoute(route, progress, alpha, stage) {
  const maxSegment = Math.min(route.points.length - 2, Math.floor(progress * route.points.length));
  ctx.beginPath();
  ctx.moveTo(route.points[0].x * width, route.points[0].y * height);
  for (let segment = 0; segment <= maxSegment; segment += 1) {
    const point = segment === maxSegment && progress < 1
      ? pointAt(route, segment, progress)
      : route.points[segment + 1];
    ctx.lineTo(point.x * width, point.y * height);
  }
  ctx.strokeStyle = `rgba(21, 21, 20, ${alpha})`;
  ctx.lineWidth = route.weight + (stage % 3 === 0 ? .25 : 0);
  ctx.stroke();
  if (route.failed && route.failureSegment <= maxSegment + 1) {
    const start = route.points[route.failureSegment];
    const end = route.points[Math.min(route.failureSegment + 1, route.points.length - 1)];
    ctx.save();
    ctx.setLineDash([3, 8]);
    ctx.strokeStyle = `rgba(185, 60, 46, ${Math.min(.8, alpha + .25)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(start.x * width, start.y * height);
    ctx.lineTo(end.x * width, end.y * height);
    ctx.stroke();
    ctx.restore();
  }
}

function render(now) {
  const elapsed = reduced ? STAGE_MS * 3.2 : Math.max(0, now - startedAt);
  const stage = Math.floor(elapsed / STAGE_MS);
  const local = reduced ? 1 : (elapsed % STAGE_MS) / STAGE_MS;
  const current = buildStage(stage);
  const previous = buildStage(Math.max(0, stage - 1));
  ctx.fillStyle = '#e9e4d6';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(21, 21, 20, .08)';
  ctx.lineWidth = .5;
  for (let x = .08; x < 1; x += .14) {
    ctx.beginPath();
    ctx.moveTo(x * width, .08 * height);
    ctx.lineTo(x * width, .92 * height);
    ctx.stroke();
  }

  current.memory.forEach((scar, index) => {
    ctx.strokeStyle = `rgba(185, 60, 46, ${.18 + index / current.memory.length * .28})`;
    ctx.lineWidth = index === current.memory.length - 1 ? 1.4 : .7;
    ctx.beginPath();
    ctx.arc(scar.x * width, scar.y * height, 5 + index * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(scar.x * width - 12, scar.y * height);
    ctx.lineTo(scar.x * width + 12, scar.y * height);
    ctx.stroke();
  });

  previous.routes.forEach((route) => drawRoute(route, 1, .12, Math.max(0, stage - 1)));
  current.routes.forEach((route, index) => {
    const progress = Math.min(1, local * 1.7 + (index % 5) * .035);
    drawRoute(route, progress, route.failed ? .48 : .28, stage);
  });

  const refusalCount = current.routes.filter((route) => route.failed).length;
  ctx.fillStyle = 'rgba(21, 21, 20, .62)';
  ctx.font = '10px ui-monospace, monospace';
  ctx.fillText(`ROUTE MEMORY / STAGE ${String(stage).padStart(2, '0')}`, 18, 24);
  ctx.fillStyle = 'rgba(185, 60, 46, .76)';
  ctx.fillText(`REFUSED SEGMENTS / ${String(refusalCount).padStart(2, '0')}`, 18, height - 20);
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  render(performance.now());
}

function frame(now) {
  render(now);
  if (!reduced) requestAnimationFrame(frame);
}

new ResizeObserver(resize).observe(canvas);
resize();
requestAnimationFrame(frame);
