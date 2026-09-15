import { STAGES, applyBump, buildTimeline, bumpSignature, deleteLatestBump, layoutForViewport } from './engine.mjs';

const canvas = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const bumpControl = document.querySelector('#bump-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3700;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let viewHeight = 760;
let cssWidth = 1000;
let cssHeight = 760;

function stateSnapshot() {
  const frame = interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage]);
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.scene.bumpRecords.length,
    engineMemory: frame.memory.length,
    structuralMemory: frame.scene.bumpRecords.length,
    approachPoints: frame.scene.route.filter((point) => point.phase === 'approach').length,
    liftPoints: frame.scene.route.filter((point) => point.phase === 'lift').length,
    crestPoints: frame.scene.route.filter((point) => point.phase === 'crest').length,
    descentPoints: frame.scene.route.filter((point) => point.phase === 'descent').length,
    returnPoints: frame.scene.route.filter((point) => point.phase === 'return').length,
    interaction: interactionFrame?.interaction ?? 'sequence',
    bumpSignature: bumpSignature(frame)
  };
}

window.__mutineNaiveV011 = { getState: stateSnapshot };
canvas.dataset.witness = 'route-bump';
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mapPoint = (panel, point) => ({
  x: (panel.x + point.x * panel.w) * 1000,
  y: (panel.y + point.y * panel.h) * viewHeight
});

function fitCanvas() {
  cssWidth = Math.max(1, fieldWrap.clientWidth || 1000);
  cssHeight = Math.max(1, fieldWrap.clientHeight || Math.round(cssWidth * 0.7));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

function path(points, panel, close = false) {
  if (!points?.length) return;
  const mapped = points.map((point) => mapPoint(panel, point));
  ctx.beginPath();
  ctx.moveTo(mapped[0].x, mapped[0].y);
  for (let index = 1; index < mapped.length; index += 1) ctx.lineTo(mapped[index].x, mapped[index].y);
  if (close) ctx.closePath();
}

function stroke(points, panel, color, width, close = false, dash = []) {
  if (!points?.length) return;
  path(points, panel, close);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.restore();
}

function fill(points, panel, color) {
  if (!points?.length) return;
  path(points, panel, true);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPaper() {
  const gradient = ctx.createLinearGradient(0, 0, 1000, viewHeight);
  gradient.addColorStop(0, '#f8eac8');
  gradient.addColorStop(0.46, '#d7b07b');
  gradient.addColorStop(1, '#8e7475');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, viewHeight);
  const glow = ctx.createRadialGradient(164, 92, 4, 164, 92, 300);
  glow.addColorStop(0, 'rgba(255,248,199,.60)');
  glow.addColorStop(1, 'rgba(255,248,199,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1000, viewHeight);
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#4f7b80';
  ctx.lineWidth = 1;
  for (let x = 18; x < 1000; x += 43) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 138, viewHeight); ctx.stroke();
  }
  ctx.globalAlpha = 0.17;
  for (let index = 0; index < 360; index += 1) {
    const x = (index * 83 + 19) % 1000;
    const y = (index * 137 + 31) % viewHeight;
    ctx.fillStyle = index % 3 ? '#6e625a' : '#fff0c5';
    ctx.fillRect(x, y, index % 4 === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function drawSun(sun, panel) {
  const center = mapPoint(panel, sun);
  const radius = sun.radius * Math.min(panel.w * 1000, panel.h * viewHeight);
  ctx.save();
  ctx.strokeStyle = '#b6533e';
  ctx.fillStyle = '#f1aa45';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2;
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(angle) * radius * 1.34, center.y + Math.sin(angle) * radius * 1.34);
    ctx.lineTo(center.x + Math.cos(angle) * radius * 1.72, center.y + Math.sin(angle) * radius * 1.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(tree, panel, ground) {
  stroke([{ x: tree.x, y: tree.y + 0.05 }, { x: tree.x, y: ground }], panel, '#b6533e', 7);
  const crown = [{ x: tree.x, y: tree.y - 0.11 }, { x: tree.x - 0.10, y: tree.y + 0.10 }, { x: tree.x + 0.075, y: tree.y + 0.07 }];
  fill(crown, panel, '#5c7f80');
  stroke(crown, panel, '#2c292b', 2.8, true);
  const top = mapPoint(panel, { x: tree.x, y: tree.y + 0.05 });
  ctx.save(); ctx.fillStyle = '#b6533e'; ctx.beginPath(); ctx.arc(top.x, top.y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawGround(world, panel, draft) {
  if (draft) {
    stroke([{ x: 0.06, y: world.ground.y }, { x: 0.94, y: world.ground.y }], panel, '#5c7f80', 2.8);
    return;
  }
  stroke([world.ground.left, ...(world.ground.bumpLine ?? []), world.ground.right], panel, '#2c292b', 4.3);
  stroke(world.ground.bumpLine, panel, '#b6533e', 1.15);
}

function drawBumpMarks(points, panel) {
  ctx.save();
  ctx.fillStyle = '#f8e6b9';
  ctx.strokeStyle = '#2c292b';
  ctx.lineWidth = 1.7;
  points.filter((point) => ['lift', 'crest', 'return'].includes(point.phase)).forEach((point) => {
    const mapped = mapPoint(panel, point);
    ctx.beginPath(); ctx.arc(mapped.x, mapped.y, point.phase === 'crest' ? 4.5 : 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

function drawHouse(world, panel, draft, progress) {
  const opacity = draft ? 0.86 : 0.35 + progress * 0.65;
  const front = world.house.front;
  const frontPolygon = [front.left, front.right, front.bottomRight, front.bottomLeft];
  const roof = [front.left, world.house.roof.peak, front.right];
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(55,39,43,.24)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 9;
  ctx.shadowOffsetY = 11;
  fill(frontPolygon, panel, draft ? '#f3d7ab' : '#efad52');
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  fill(roof, panel, draft ? '#d27b5e' : '#b6533e');
  stroke(frontPolygon, panel, draft ? '#b6533e' : '#2c292b', 3.2, true, draft ? [14, 12] : []);
  stroke(roof, panel, draft ? '#b6533e' : '#2c292b', 3.2, true, draft ? [14, 12] : []);
  const portal = [{ x: 0.48, y: 0.56 }, { x: 0.48, y: 0.69 }, { x: 0.52, y: 0.69 }, { x: 0.52, y: 0.56 }];
  fill(portal, panel, '#2c292b');
  stroke(portal, panel, '#b6533e', 2.2, true, draft ? [7, 7] : []);
  const window = [{ x: 0.523, y: 0.455 }, { x: 0.587, y: 0.455 }, { x: 0.587, y: 0.525 }, { x: 0.523, y: 0.525 }];
  fill(window, panel, '#4f7b80');
  stroke(window, panel, '#2c292b', 2, true);
  if (!draft && world.house.bumpLine.length) {
    const roofBump = [front.right, ...world.house.bumpLine];
    stroke(roofBump, panel, '#2c292b', 5.5);
    stroke(roofBump, panel, '#b6533e', 1.25);
    if (!staticPreview) drawBumpMarks(world.house.bumpLine, panel);
    stroke([world.house.bumpLine.at(-1), world.house.roof.returnPeak], panel, '#2c292b', 2.2);
  }
  ctx.restore();
}

function drawPanel(frame, panel, kind, progress) {
  const draft = kind === 'proposal';
  const world = draft ? frame.draft : frame.scene;
  const label = draft ? 'PROPOSAL' : 'CONSEQUENCE';
  const topLeft = mapPoint(panel, { x: 0, y: 0 });
  const panelWidth = panel.w * 1000;
  const panelHeight = panel.h * viewHeight;
  ctx.save();
  ctx.fillStyle = draft ? '#ead7ae' : '#fff0c9';
  ctx.strokeStyle = '#7c6c6a';
  ctx.lineWidth = 2;
  ctx.fillRect(topLeft.x, topLeft.y, panelWidth, panelHeight);
  ctx.strokeRect(topLeft.x, topLeft.y, panelWidth, panelHeight);
  ctx.restore();
  drawGround(world, panel, draft);
  drawSun(frame.scene.sun, panel);
  drawTree(frame.scene.tree, panel, draft ? world.ground.y : 0.83);
  stroke(world.route, panel, draft ? '#b6533e' : '#2c292b', draft ? 4.4 : 5.5, false, draft ? [14, 13] : []);
  if (!draft && world.route.some((point) => point.phase === 'crest')) stroke(world.route.filter((point) => point.phase), panel, '#b6533e', 1.0);
  drawHouse(world, panel, draft, progress);
  if (!staticPreview) {
    const a = mapPoint(panel, { x: 0.055, y: 0.075 });
    const b = mapPoint(panel, { x: 0.945, y: 0.075 });
    ctx.save();
    ctx.fillStyle = '#b6533e'; ctx.font = '10px Arial'; ctx.letterSpacing = '1px'; ctx.fillText(label, a.x, a.y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#4f7b80'; ctx.fillText(draft ? 'direct' : `${frame.scene.bumpRecords.length} bumps kept`, b.x, b.y);
    ctx.restore();
  }
}

function drawBridge(layout, frame) {
  const from = mapPoint(layout.panels[0], { x: 0.66, y: 0.44 });
  const to = mapPoint(layout.panels[1], { x: 0.34, y: 0.44 });
  const middle = layout.mode === 'stacked'
    ? { x: (from.x + to.x) / 2, y: (layout.bridge.y1 + layout.bridge.y2) / 2 * viewHeight }
    : { x: (from.x + to.x) / 2, y: from.y - 0.09 * viewHeight };
  ctx.save();
  ctx.globalAlpha = frame.memory.length ? 0.88 : 0.45;
  ctx.strokeStyle = '#b6533e'; ctx.lineCap = 'round'; ctx.lineWidth = 4.5; ctx.setLineDash([4, 12]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.bezierCurveTo(middle.x, from.y, middle.x, to.y, to.x, to.y); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = '#b6533e';
  [from, to].forEach((point) => { ctx.beginPath(); ctx.arc(point.x, point.y, 5, 0, Math.PI * 2); ctx.fill(); });
  ctx.restore();
}

function render(frame, progress = 1, state = 'sequence') {
  const layout = layoutForViewport(cssWidth, cssHeight);
  viewHeight = layout.mode === 'stacked' ? 1560 : 760;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(pixelRatio * cssWidth / 1000, 0, 0, pixelRatio * cssHeight / viewHeight, 0, 0);
  ctx.clearRect(0, 0, 1000, viewHeight);
  drawPaper();
  drawPanel(frame, layout.panels[0], 'proposal', 1);
  drawPanel(frame, layout.panels[1], 'consequence', progress);
  if (!staticPreview) drawBridge(layout, frame);
  const status = `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (!staticPreview) {
    ctx.save(); ctx.fillStyle = '#2c292b'; ctx.font = '10px Arial'; ctx.fillText(status, 46, viewHeight - 36); ctx.textAlign = 'right'; ctx.fillStyle = '#b6533e'; ctx.fillText(`${frame.primitiveCount} SHAPES / ${frame.scene.bumpRecords.length} BUMPS`, 954, viewHeight - 36); ctx.restore();
  }
  stageReadout.textContent = state === 'visitor-bump' ? 'visitor bump / paused' : state === 'bump-lifted' ? 'latest bump undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.bumpRecords.length} bump${frame.scene.bumpRecords.length === 1 ? '' : 's'} retained`;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return { frame: timeline[currentStage], progress: (elapsed % STAGE_MS) / STAGE_MS };
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, 1, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    currentStage = timeline.length - 1;
    render(timeline.at(-1), 1, 'sequence');
    return;
  }
  const current = frameAt(now);
  render(current.frame, current.progress, 'sequence');
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1)), y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1)) };
}

function makeBump(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-bump' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyBump(base, point);
  render(interactionFrame, 1, 'visitor-bump');
}

function undoBump() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestBump(base);
  render(interactionFrame, 1, 'bump-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  started = performance.now();
  currentStage = 0;
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  makeBump(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeBump({ x: 0.78, y: 0.34 });
});
bumpControl.addEventListener('click', () => makeBump({ x: 0.78, y: 0.34 }));
undoControl.addEventListener('click', undoBump);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitCanvas(); renderCurrent(); });

fitCanvas();
renderCurrent();
function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);