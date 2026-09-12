import { STAGES, applyKnot, buildTimeline, deleteLatestKnot, knotSignature, layoutForViewport } from './engine.mjs';

const canvas = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const knotControl = document.querySelector('#knot-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const ctx = canvas.getContext('2d');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3900;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
const ROUTE_WITNESS = 'route-knot';
let started = performance.now() - STAGE_MS * 2;
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
    memory: frame.memory.length,
    structuralMemory: frame.scene.knotRecords.length,
    crossPoints: frame.scene.route.filter((point) => point.phase === 'cross').length,
    loopPoints: frame.scene.route.filter((point) => point.phase === 'loop').length,
    rejoinPoints: frame.scene.route.filter((point) => point.phase === 'rejoin').length,
    interaction: interactionFrame?.interaction ?? 'sequence',
    knotSignature: knotSignature(frame)
  };
}

window.__mutineNaiveV008 = { getState: stateSnapshot };
canvas.dataset.witness = ROUTE_WITNESS;
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
  gradient.addColorStop(0, '#ead59d');
  gradient.addColorStop(.52, '#c2ad78');
  gradient.addColorStop(1, '#9c895e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, viewHeight);
  const glow = ctx.createRadialGradient(170, 95, 4, 170, 95, 300);
  glow.addColorStop(0, 'rgba(255,231,156,.42)');
  glow.addColorStop(1, 'rgba(255,231,156,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1000, viewHeight);
  ctx.save();
  ctx.globalAlpha = .13;
  ctx.strokeStyle = '#594f3b';
  ctx.lineWidth = 1;
  for (let x = 28; x < 1000; x += 46) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 110, viewHeight); ctx.stroke(); }
  ctx.globalAlpha = .20;
  for (let i = 0; i < 280; i += 1) {
    const x = (i * 83 + 19) % 1000;
    const y = (i * 137 + 31) % viewHeight;
    ctx.fillStyle = i % 3 ? '#6e6046' : '#f4dfaa';
    ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function drawSun(sun, panel) {
  const center = mapPoint(panel, sun);
  const radius = sun.radius * Math.min(panel.w * 1000, panel.h * viewHeight);
  ctx.save();
  ctx.strokeStyle = '#c14d35';
  ctx.fillStyle = '#efaa46';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const angle = i * Math.PI / 4;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(angle) * radius * 1.34, center.y + Math.sin(angle) * radius * 1.34);
    ctx.lineTo(center.x + Math.cos(angle) * radius * 1.72, center.y + Math.sin(angle) * radius * 1.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(tree, panel, ground) {
  const top = mapPoint(panel, { x: tree.x, y: tree.y + .05 });
  const bottom = mapPoint(panel, { x: tree.x, y: ground });
  const crown = [{ x: tree.x, y: tree.y - .11 }, { x: tree.x - .10, y: tree.y + .10 }, { x: tree.x + .075, y: tree.y + .07 }];
  stroke([{ x: tree.x, y: tree.y + .05 }, { x: tree.x, y: ground }], panel, '#c14d35', 7);
  fill(crown, panel, '#708467');
  stroke(crown, panel, '#211a14', 2.8, true);
  ctx.save();
  ctx.fillStyle = '#c14d35';
  ctx.beginPath(); ctx.arc(top.x, top.y, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  void bottom;
}

function drawGround(world, panel, draft) {
  if (draft) {
    stroke([{ x: .06, y: world.ground.y }, { x: .94, y: world.ground.y }], panel, '#708467', 2.8);
    return;
  }
  stroke([world.ground.left, ...(world.ground.knotLine ?? []), world.ground.right], panel, '#708467', 3.2);
}

function drawHouse(world, panel, draft, progress, blind) {
  const opacity = draft ? .86 : .35 + progress * .65;
  const front = world.house.front;
  const frontPolygon = [front.left, front.right, front.bottomRight, front.bottomLeft];
  const roof = [front.left, world.house.roof.peak, front.right];
  const body = draft ? '#f0ddb0' : '#efb149';
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.shadowColor = 'rgba(77,55,27,.24)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetX = 9;
  ctx.shadowOffsetY = 11;
  fill(frontPolygon, panel, body);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  fill(roof, panel, draft ? '#d88b56' : '#c14d35');
  stroke(frontPolygon, panel, draft ? '#c14d35' : '#211a14', 3.2, true, draft ? [14, 12] : []);
  stroke(roof, panel, draft ? '#c14d35' : '#211a14', 3.2, true, draft ? [14, 12] : []);
  const portal = [{ x: .48, y: .56 }, { x: .48, y: .69 }, { x: .52, y: .69 }, { x: .52, y: .56 }];
  fill(portal, panel, '#211a14');
  stroke(portal, panel, '#c14d35', 2.2, true, draft ? [7, 7] : []);
  fill([{ x: .523, y: .455 }, { x: .587, y: .455 }, { x: .587, y: .525 }, { x: .523, y: .525 }], panel, '#4e7e85');
  stroke([{ x: .523, y: .455 }, { x: .587, y: .455 }, { x: .587, y: .525 }, { x: .523, y: .525 }], panel, '#211a14', 2, true);
  if (!draft && world.house.knotLine.length) {
    // The same ink carries the knot through the roof edge; it is not a witness-only overlay.
    stroke(world.house.knotLine, panel, '#211a14', 4.8);
    stroke(world.house.knotLine, panel, '#c14d35', 1.15);
    if (!blind) drawKnotDots(world.house.knotLine, panel);
    const returnPeak = world.house.roof.returnPeak;
    stroke([front.right, returnPeak], panel, '#211a14', 2.2);
  }
  ctx.restore();
}

function drawKnotDots(points, panel) {
  ctx.save();
  ctx.fillStyle = '#f3dfb0';
  ctx.strokeStyle = '#211a14';
  ctx.lineWidth = 1.7;
  points.filter((point) => point.phase === 'rejoin').forEach((point) => {
    const mapped = mapPoint(panel, point);
    ctx.beginPath(); ctx.arc(mapped.x, mapped.y, 4.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

function drawPanel(frame, panel, kind, progress, blind) {
  const draft = kind === 'proposal';
  const world = draft ? frame.draft : frame.scene;
  const label = draft ? 'PROPOSAL' : 'CONSEQUENCE';
  const topLeft = mapPoint(panel, { x: 0, y: 0 });
  const panelWidth = panel.w * 1000;
  const panelHeight = panel.h * viewHeight;
  ctx.save();
  ctx.fillStyle = draft ? '#e9d3a1' : '#f7e8bb';
  ctx.strokeStyle = '#806d4d';
  ctx.lineWidth = 2;
  ctx.fillRect(topLeft.x, topLeft.y, panelWidth, panelHeight);
  ctx.strokeRect(topLeft.x, topLeft.y, panelWidth, panelHeight);
  ctx.restore();
  drawGround(world, panel, draft);
  drawSun(frame.scene.sun, panel);
  drawTree(frame.scene.tree, panel, draft ? world.ground.y : .83);
  stroke(world.route, panel, draft ? '#c14d35' : '#211a14', draft ? 4.4 : 5.4, false, draft ? [14, 13] : []);
  drawHouse(world, panel, draft, progress, blind);
  if (!blind) {
    const a = mapPoint(panel, { x: .055, y: .075 });
    const b = mapPoint(panel, { x: .945, y: .075 });
    ctx.save();
    ctx.fillStyle = '#c14d35';
    ctx.font = '10px Arial';
    ctx.letterSpacing = '1px';
    ctx.fillText(label, a.x, a.y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3f6e73';
    ctx.fillText(draft ? 'direct' : `${frame.scene.knotRecords.length} knots kept`, b.x, b.y);
    ctx.restore();
    if (!draft && frame.scene.knotRecords.length) drawKnotDots(world.route, panel);
  }
}

function drawBridge(layout, frame) {
  const from = mapPoint(layout.panels[0], { x: .66, y: .44 });
  const to = mapPoint(layout.panels[1], { x: .34, y: .44 });
  const middle = layout.mode === 'stacked'
    ? { x: (from.x + to.x) / 2, y: (layout.bridge.y1 + layout.bridge.y2) / 2 * viewHeight }
    : { x: (from.x + to.x) / 2, y: from.y - .09 * viewHeight };
  ctx.save();
  ctx.globalAlpha = frame.memory.length ? .88 : .45;
  ctx.strokeStyle = '#c14d35';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  ctx.setLineDash([4, 12]);
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.bezierCurveTo(middle.x, from.y, middle.x, to.y, to.x, to.y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#c14d35';
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
  drawPanel(frame, layout.panels[0], 'proposal', 1, staticPreview);
  drawPanel(frame, layout.panels[1], 'consequence', progress, staticPreview);
  if (!staticPreview) drawBridge(layout, frame);
  const status = state === 'visitor-knot' ? 'VISITOR KNOT / PAUSED' : state === 'knot-lifted' ? 'LATEST KNOT UNDONE' : `STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (!staticPreview) {
    ctx.save();
    ctx.fillStyle = '#211a14';
    ctx.font = '10px Arial';
    ctx.fillText(status, 46, viewHeight - 36);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c14d35';
    ctx.fillText(`${frame.primitiveCount} SHAPES / ${frame.scene.knotRecords.length} KNOTS`, 954, viewHeight - 36);
    ctx.restore();
  }
  stageReadout.textContent = state === 'visitor-knot' ? 'visitor knot / paused' : state === 'knot-lifted' ? 'latest knot undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.knotRecords.length} knots retained`;
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
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1)),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1))
  };
}

function makeKnot(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-knot' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyKnot(base, point);
  render(interactionFrame, 1, 'visitor-knot');
}

function undoKnot() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestKnot(base);
  render(interactionFrame, 1, 'knot-lifted');
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
  makeKnot(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeKnot({ x: .78, y: .34 });
});
knotControl.addEventListener('click', () => makeKnot({ x: .78, y: .34 }));
undoControl.addEventListener('click', undoKnot);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitCanvas(); renderCurrent(); });

fitCanvas();
renderCurrent();
function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);
