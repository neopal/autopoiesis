import { STAGES, buildTimeline, layoutForViewport } from './engine.mjs';

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
  paper: '#f2e7d1',
  paperShadow: '#e5d5b9',
  ink: '#1d3340',
  vermilion: '#c9583d',
  yellow: '#e8ae45',
  blue: '#447b89',
  green: '#758b61',
  orange: '#d8783e'
};

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const bounds = field.getBoundingClientRect();
  field.width = Math.max(1, Math.floor(bounds.width * ratio));
  field.height = Math.max(1, Math.floor(bounds.height * ratio));
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  render(frozen ? timeline[timeline.length - 1] : timeline[0], frozen ? 1 : 0);
}

function px(value, width) {
  return value * width;
}

function py(value, height) {
  return value * height;
}

function line(points, color, width, dashed = false, alpha = 1) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.globalAlpha = alpha;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (dashed) context.setLineDash([8, 10]);
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.restore();
}

function panelBox(panel, width, height) {
  const boxWidth = panel.w * width;
  const boxHeight = panel.h * height;
  return {
    left: panel.x * width,
    top: panel.y * height,
    width: boxWidth,
    height: boxHeight,
    minimum: Math.min(boxWidth, boxHeight)
  };
}

function panelX(panel, value, width) {
  return (panel.x + value * panel.w) * width;
}

function panelY(panel, value, height) {
  return (panel.y + value * panel.h) * height;
}

function panelLine(points, panel, width, height, color, strokeWidth, dashed = false, alpha = 1) {
  line(points.map(([x, y]) => [panelX(panel, x, width), panelY(panel, y, height)]), color, strokeWidth, dashed, alpha);
}

function drawSun(sun, panel, width, height) {
  const box = panelBox(panel, width, height);
  const x = panelX(panel, sun.x, width);
  const y = panelY(panel, sun.y, height);
  const radius = sun.radius * box.minimum;
  const strokeWidth = Math.max(1.5, box.minimum * 0.015);
  context.save();
  context.strokeStyle = palette.vermilion;
  context.fillStyle = palette.yellow;
  context.lineWidth = strokeWidth;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    panelLine([[sun.x + Math.cos(angle) * sun.radius * 1.35, sun.y + Math.sin(angle) * sun.radius * 1.35], [sun.x + Math.cos(angle) * sun.radius * 1.72, sun.y + Math.sin(angle) * sun.radius * 1.72]], panel, width, height, palette.vermilion, strokeWidth * 0.7);
  }
  context.restore();
}

function drawTree(tree, panel, width, height) {
  const box = panelBox(panel, width, height);
  const x = panelX(panel, tree.x, width);
  const base = panelY(panel, 0.77, height);
  const trunkTop = panelY(panel, tree.y + 0.06, height);
  const strokeWidth = Math.max(1.5, box.minimum * 0.015);
  context.save();
  context.fillStyle = palette.vermilion;
  context.strokeStyle = palette.ink;
  context.lineWidth = strokeWidth;
  context.beginPath();
  context.rect(x - box.width * 0.014, trunkTop, box.width * 0.028, base - trunkTop);
  context.fill();
  context.stroke();
  context.fillStyle = palette.green;
  context.beginPath();
  context.moveTo(x, panelY(panel, tree.y - 0.10, height));
  context.lineTo(panelX(panel, tree.x - 0.095, width), panelY(panel, tree.y + 0.09, height));
  context.lineTo(panelX(panel, tree.x + 0.065, width), panelY(panel, tree.y + 0.06, height));
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawHouse(scene, panel, width, height, color, alpha = 1, dashed = false) {
  const box = panelBox(panel, width, height);
  const left = panelX(panel, scene.houseX - scene.houseWidth / 2, width);
  const right = panelX(panel, scene.houseX + scene.houseWidth / 2, width);
  const top = panelY(panel, scene.houseY, height);
  const bottom = panelY(panel, scene.houseY + scene.houseHeight, height);
  const roofPeak = [panelX(panel, scene.houseX - 0.015, width), panelY(panel, scene.houseY - 0.13, height)];
  const roofLeft = [left - box.width * 0.025, top + box.height * 0.005];
  const roofRight = [right + box.width * 0.022, top + box.height * 0.012];
  const doorWidth = box.width * 0.052;
  const doorHeight = box.height * 0.105;
  const doorX = panelX(panel, scene.door.x, width);
  const doorY = panelY(panel, scene.door.y, height);

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = palette.paperShadow;
  context.strokeStyle = color;
  context.lineWidth = Math.max(1.8, box.minimum * 0.018);
  if (dashed) context.setLineDash([box.minimum * 0.045, box.minimum * 0.055]);
  context.beginPath();
  context.rect(left, top, right - left, bottom - top);
  context.fill();
  context.stroke();
  context.fillStyle = palette.vermilion;
  context.beginPath();
  context.moveTo(...roofLeft);
  context.lineTo(...roofPeak);
  context.lineTo(...roofRight);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = palette.blue;
  context.beginPath();
  context.rect(doorX - doorWidth / 2, doorY, doorWidth, doorHeight);
  context.fill();
  context.stroke();
  context.restore();
}

function drawPath(scene, panel, width, height, color, alpha = 1, dashed = false) {
  const doorX = panelX(panel, scene.door.x, width);
  const doorY = panelY(panel, scene.door.y + 0.105, height);
  const strokeWidth = Math.max(1.8, panelBox(panel, width, height).minimum * 0.018);
  panelLine([[scene.door.x, scene.door.y + 0.105], [scene.pathBend, 0.85], [0.54, 1]], panel, width, height, color, strokeWidth, dashed, alpha);
}

function drawMemory(memory, panel, width, height) {
  const box = panelBox(panel, width, height);
  memory.forEach((mistake, index) => {
    const x = panelX(panel, 0.5 + mistake.doorOffset * 2.1, width);
    const y = panelY(panel, 0.72 - index * 0.028, height);
    context.save();
    context.globalAlpha = 0.3 + index / Math.max(1, memory.length) * 0.45;
    context.strokeStyle = palette.orange;
    context.lineWidth = Math.max(1.5, box.minimum * 0.012);
    context.beginPath();
    context.arc(x, y, box.minimum * (0.018 + index * 0.004), Math.PI * 0.12, Math.PI * 1.78);
    context.stroke();
    context.restore();
  });
}

function drawPanel(frame, panel, width, height, kind, progress) {
  const box = panelBox(panel, width, height);
  const draft = kind === 'refused';
  const world = draft ? frame.draft : frame.scene;
  context.save();
  context.fillStyle = draft ? '#eadcc3' : '#f5ecd9';
  context.globalAlpha = draft ? 0.92 : 1;
  context.fillRect(box.left, box.top, box.width, box.height);
  context.globalAlpha = 1;
  context.strokeStyle = draft ? palette.vermilion : palette.ink;
  context.lineWidth = Math.max(1, box.minimum * 0.009);
  context.strokeRect(box.left, box.top, box.width, box.height);
  context.restore();

  drawSun(frame.scene.sun, panel, width, height);
  panelLine([[0, 0.78], [1, 0.78]], panel, width, height, palette.ink, Math.max(1.2, box.minimum * 0.009), false, 0.62);
  drawTree(frame.scene.tree, panel, width, height);
  drawPath(world, panel, width, height, draft ? palette.vermilion : palette.ink, draft ? 0.85 : 0.38 + progress * 0.62, draft);
  drawHouse(world, panel, width, height, draft ? palette.vermilion : palette.ink, draft ? 0.92 : 0.42 + progress * 0.58, draft);
  if (!draft) drawMemory(frame.memory, panel, width, height);

  context.save();
  context.fillStyle = draft ? palette.vermilion : palette.ink;
  context.font = `600 ${Math.max(9, box.minimum * 0.035)}px Arial, sans-serif`;
  context.letterSpacing = '1.5px';
  context.fillText(draft ? 'REFUSED DRAFT' : 'KEPT DECISION', box.left + box.width * 0.06, box.top + box.height * 0.09);
  context.restore();
}

function drawDecisionBridge(layout, width, height, retained) {
  const bridge = layout.bridge;
  context.save();
  context.strokeStyle = palette.orange;
  context.fillStyle = palette.orange;
  context.globalAlpha = retained ? 0.92 : 0.64;
  context.lineWidth = Math.max(2, Math.min(width, height) * 0.009);
  context.setLineDash([Math.max(4, Math.min(width, height) * 0.02), Math.max(5, Math.min(width, height) * 0.026)]);
  context.beginPath();
  context.moveTo(bridge.x1 * width, bridge.y1 * height);
  context.lineTo(bridge.x2 * width, bridge.y2 * height);
  context.stroke();
  context.setLineDash([]);
  [0, 1].forEach((index) => {
    const x = index === 0 ? bridge.x1 * width : bridge.x2 * width;
    const y = index === 0 ? bridge.y1 * height : bridge.y2 * height;
    context.beginPath();
    context.arc(x, y, Math.max(3, Math.min(width, height) * 0.018), 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function render(frame, progress) {
  const width = field.clientWidth;
  const height = field.clientHeight;
  const layout = layoutForViewport(width, height);
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.paper;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 16; index += 1) {
    const x = width * (0.04 + (index % 3) * 0.25);
    const y = height * (0.05 + index * 0.055);
    line([[x, y], [x + width * 0.05, y - Math.min(4, height * 0.01)]], palette.paperShadow, 1.5, false, 0.65);
  }

  drawPanel(frame, layout.panels[0], width, height, 'refused', 1);
  drawPanel(frame, layout.panels[1], width, height, 'kept', progress);
  drawDecisionBridge(layout, width, height, frame.memory.length > 0);

  context.save();
  context.fillStyle = palette.ink;
  context.font = '600 11px Arial, sans-serif';
  context.letterSpacing = '2px';
  const stageLabel = `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  const memoryLabel = `MISTAKES KEPT ${String(frame.memory.length).padStart(2, '0')}`;
  const stageWidth = context.measureText(stageLabel).width;
  const memoryWidth = context.measureText(memoryLabel).width;
  const bottomY = height - 16;
  if (18 + stageWidth + 18 + memoryWidth + 18 <= width) {
    context.fillText(stageLabel, 18, bottomY);
    context.fillStyle = palette.orange;
    context.fillText(memoryLabel, width - memoryWidth - 18, bottomY);
  }
  context.restore();
  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.memory.length} retained mistakes`;
}

function frame(now) {
  const cycle = STAGE_MS * timeline.length;
  const elapsed = (now - started) % cycle;
  const stage = Math.max(0, Math.min(timeline.length - 1, Math.floor(elapsed / STAGE_MS)));
  const progress = (elapsed % STAGE_MS) / STAGE_MS;
  render(timeline[stage], progress);
  if (!frozen) requestAnimationFrame(frame);
}

const observer = new ResizeObserver(resize);
observer.observe(field);
resize();
if (!frozen) requestAnimationFrame(frame);
