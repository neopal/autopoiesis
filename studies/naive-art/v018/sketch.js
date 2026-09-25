import {
  PANEL_LAYOUT,
  STAGES,
  applyFold,
  buildTimeline,
  deleteLatestFold,
  foldSignature
} from './engine.mjs';

const canvas = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const ctx = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const foldControl = document.querySelector('#fold-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3800;
const DRAG_THRESHOLD = 0.22;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
const palette = {
  night: '#101b2d',
  nightLight: '#1e314b',
  paper: '#f3ebd8',
  ink: '#172334',
  coral: '#e26d5a',
  lemon: '#f3c85b',
  green: '#7ea89b',
  lilac: '#a88ab7',
  sky: '#5d91aa',
  tan: '#d8a36b',
  brass: '#cfad66',
  mist: 'rgba(243,235,216,.18)'
};
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let dragStart = null;
let dragPoint = null;
let dragging = false;
let cssWidth = 1000;
let cssHeight = 800;
let dpr = 1;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage]);
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.scene.foldRecords.length,
    engineMemory: frame.memory.length,
    folds: frame.scene.materialTrace.foldCount,
    unhingedJoints: frame.scene.materialTrace.unhingedCount,
    wrongHinges: frame.scene.materialTrace.wrongHingeCount,
    pointerOnlyChanges: frame.scene.materialTrace.pointerOnlyChanges,
    dragChanges: frame.scene.materialTrace.dragChanges,
    interaction: interactionFrame?.interaction ?? 'sequence',
    dragging,
    foldSignature: foldSignature(frame)
  };
}

window.__mutineNaiveV018 = { getState: stateSnapshot };
canvas.dataset.witness = 'misremembered-hinge';
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

function fitCanvas() {
  cssWidth = Math.max(1, fieldWrap.clientWidth || 1000);
  cssHeight = Math.max(1, fieldWrap.clientHeight || Math.round(cssWidth * 0.8));
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
}

function panelCenter(panel) {
  const bend = panel.drift * 0.10;
  return {
    x: (panel.x + panel.shift.x + bend) * cssWidth,
    y: (panel.y + panel.shift.y - panel.drift * 0.024) * cssHeight
  };
}

function polygon(points, fill, stroke = null, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, cssWidth, cssHeight);
  gradient.addColorStop(0, palette.nightLight);
  gradient.addColorStop(0.48, palette.night);
  gradient.addColorStop(1, '#0b1321');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = palette.mist;
  ctx.lineWidth = 1;
  for (let index = 0; index < 12; index += 1) {
    const x = cssWidth * (0.04 + index * 0.085);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + cssWidth * 0.10, cssHeight * 0.28, x - cssWidth * 0.06, cssHeight * 0.72, x + cssWidth * 0.06, cssHeight);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.34;
  for (let index = 0; index < 180; index += 1) {
    const x = (index * 113 + 23) % Math.max(cssWidth, 1);
    const y = (index * 197 + 41) % Math.max(cssHeight, 1);
    const size = index % 9 === 0 ? 2 : 1;
    ctx.fillStyle = index % 4 === 0 ? palette.lemon : palette.green;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function sculptureSilhouette(frame) {
  const visible = frame.scene.panels.map(panelCenter);
  const left = Math.min(...visible.map((point) => point.x)) - cssWidth * 0.13;
  const right = Math.max(...visible.map((point) => point.x)) + cssWidth * 0.13;
  const top = Math.min(...visible.map((point) => point.y)) - cssHeight * 0.18;
  const bottom = Math.max(...visible.map((point) => point.y)) + cssHeight * 0.18;
  return [
    [left + cssWidth * 0.06, top],
    [right - cssWidth * 0.04, top + cssHeight * 0.03],
    [right, top + cssHeight * 0.22],
    [right - cssWidth * 0.04, bottom - cssHeight * 0.05],
    [left + cssWidth * 0.08, bottom],
    [left, bottom - cssHeight * 0.24]
  ];
}

function drawSculptureGround(frame) {
  ctx.save();
  ctx.translate(cssWidth * 0.012, cssHeight * 0.026);
  polygon(sculptureSilhouette(frame), 'rgba(4,8,16,.56)');
  ctx.restore();
  ctx.save();
  polygon(sculptureSilhouette(frame), 'rgba(243,235,216,.07)', 'rgba(243,235,216,.18)', 1);
  ctx.restore();
}

function irregularPanel(width, height, fold) {
  const w = width * 0.5;
  const h = height * 0.5;
  const notch = Math.min(width * 0.10, 20) * (0.7 + fold);
  return [
    [-w * 0.92, -h * 0.78],
    [-w * 0.23, -h],
    [w * 0.79, -h * 0.86],
    [w, -h * 0.14],
    [w * 0.76, h * 0.84],
    [0, h],
    [-w * 0.78, h * 0.72],
    [-w, -h * 0.02],
    [-w * 0.62, -h * 0.22],
    [-w * 0.58, -h * 0.50 - notch * 0.03]
  ];
}

function drawMotif(kind, color, scale = 1, offset = 0, rotation = 0) {
  ctx.save();
  ctx.translate(offset, 0);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, Math.min(4, cssWidth * 0.004));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'sun') {
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
    for (let index = 0; index < 8; index += 1) { const angle = index * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * 19, Math.sin(angle) * 19); ctx.lineTo(Math.cos(angle) * 26, Math.sin(angle) * 26); ctx.stroke(); }
  } else if (kind === 'ladder') {
    ctx.beginPath(); ctx.moveTo(-17, -15); ctx.lineTo(-17, 15); ctx.moveTo(17, -15); ctx.lineTo(17, 15); for (let index = -1; index <= 1; index += 1) { ctx.moveTo(-17, index * 12); ctx.lineTo(17, index * 12); } ctx.stroke();
  } else if (kind === 'knot') {
    ctx.beginPath(); ctx.moveTo(-21, -14); ctx.bezierCurveTo(-2, -30, 2, 30, 21, 14); ctx.moveTo(-21, 14); ctx.bezierCurveTo(-2, 30, 2, -30, 21, -14); ctx.stroke();
  } else if (kind === 'cup') {
    ctx.beginPath(); ctx.moveTo(-18, -12); ctx.lineTo(-11, 14); ctx.lineTo(11, 14); ctx.lineTo(18, -12); ctx.stroke(); ctx.beginPath(); ctx.arc(19, -2, 8, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  } else if (kind === 'eyelet') {
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-19, 14); ctx.lineTo(19, -14); ctx.moveTo(-10, 18); ctx.lineTo(12, -18); ctx.stroke();
  }
  ctx.restore();
}

function drawJoint(joint, panels) {
  const a = panelCenter(panels[joint.a]);
  const b = panelCenter(panels[joint.b]);
  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle);
  if (joint.state === 'unhinged') {
    ctx.strokeStyle = palette.coral;
    ctx.lineWidth = Math.max(3, cssWidth * 0.006);
    ctx.setLineDash([7, 8]);
    ctx.beginPath(); ctx.moveTo(-length * 0.34 - joint.gap * cssWidth, -joint.gap * cssHeight); ctx.lineTo(-joint.gap * cssWidth, joint.gap * cssHeight); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(226,109,90,.25)';
    ctx.beginPath(); ctx.moveTo(-joint.gap * cssWidth, -joint.gap * cssHeight); ctx.lineTo(joint.gap * cssWidth, 0); ctx.lineTo(-joint.gap * cssWidth, joint.gap * cssHeight); ctx.closePath(); ctx.fill();
  } else if (joint.state === 'wrong-hinge') {
    ctx.strokeStyle = palette.brass;
    ctx.lineWidth = Math.max(3, cssWidth * 0.007);
    ctx.beginPath(); ctx.moveTo(-length * 0.38, 0); ctx.quadraticCurveTo(0, -joint.bridge * cssHeight * 1.8, length * 0.38, 0); ctx.stroke();
    ctx.fillStyle = palette.lemon;
    ctx.beginPath(); ctx.arc(0, -joint.bridge * cssHeight * 1.8, Math.max(4, cssWidth * 0.009), 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(207,173,102,.46)';
    ctx.lineWidth = Math.max(2, cssWidth * 0.004);
    ctx.beginPath(); ctx.moveTo(-length * 0.36, 0); ctx.lineTo(length * 0.36, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(243,235,216,.74)';
    ctx.beginPath(); ctx.arc(0, 0, Math.max(3, cssWidth * 0.006), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPanel(panel, index) {
  const center = panelCenter(panel);
  const width = panel.w * cssWidth;
  const height = panel.h * cssHeight;
  const body = irregularPanel(width, height, panel.fold);
  const depth = Math.max(8, Math.min(24, height * 0.12));
  const side = body.map(([x, y]) => [x, y + depth]);

  ctx.save();
  ctx.translate(center.x + width * 0.035, center.y + height * 0.045);
  ctx.rotate(panel.angle + panel.drift * 0.03);
  polygon(side, 'rgba(4,8,16,.65)');
  ctx.restore();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(panel.angle + panel.drift * 0.03);
  polygon(side, 'rgba(207,173,102,.18)', palette.ink, 1);
  polygon(body, panel.color, palette.paper, 1.5);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(body[0][0], body[0][1]); for (const point of body.slice(1)) ctx.lineTo(point[0], point[1]); ctx.closePath(); ctx.clip();
  const base = panel.seams.find((seam) => seam.kind === panel.motif) ?? { offset: 0 };
  drawMotif(panel.motif, palette.paper, 0.72, base.offset * width, 0);
  for (const mark of panel.borrowedMarks) {
    ctx.save();
    ctx.translate(mark.offset * width, -height * 0.05);
    ctx.rotate(mark.rotation);
    ctx.fillStyle = 'rgba(243,235,216,.22)';
    ctx.fillRect(-width * 0.20, -height * 0.17, width * 0.40, height * 0.34);
    drawMotif(mark.from, palette.ink, 0.44, 0, 0);
    ctx.restore();
  }
  for (const seam of panel.seams.filter((entry) => entry.kind === 'misremembered-edge')) {
    ctx.strokeStyle = palette.coral;
    ctx.lineWidth = Math.max(2, cssWidth * 0.004);
    ctx.beginPath(); ctx.moveTo(seam.offset * width - width * 0.18, -height * 0.42); ctx.lineTo(seam.offset * width + width * 0.12, height * 0.39); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(23,35,52,.55)';
  ctx.lineWidth = Math.max(1, cssWidth * 0.002);
  ctx.beginPath(); ctx.moveTo(-width * 0.32, -height * 0.34); ctx.lineTo(width * 0.26, -height * 0.40); ctx.stroke();
  ctx.restore();

  if (index % 2 === 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(243,235,216,.55)';
    ctx.translate(center.x - width * 0.20, center.y - height * 0.24);
    ctx.rotate(panel.angle - 0.20);
    ctx.fillRect(0, 0, width * 0.18, Math.max(1, height * 0.025));
    ctx.restore();
  }
}

function drawDragGuide() {
  if (!dragging || !dragStart || !dragPoint) return;
  const startX = dragStart.x * cssWidth;
  const startY = dragStart.y * cssHeight;
  const endX = dragPoint.x * cssWidth;
  const endY = dragPoint.y * cssHeight;
  ctx.save();
  ctx.strokeStyle = palette.lemon;
  ctx.lineWidth = Math.max(2, cssWidth * 0.004);
  ctx.setLineDash([8, 10]);
  ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = palette.lemon;
  ctx.beginPath(); ctx.arc(endX, endY, Math.max(4, cssWidth * 0.008), 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function render(frame, state = 'sequence') {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawBackground();
  drawSculptureGround(frame);
  frame.scene.joints.forEach((joint) => drawJoint(joint, frame.scene.panels));
  const sorted = [...frame.scene.panels].sort((a, b) => (a.y - a.drift * 0.024) - (b.y - b.drift * 0.024));
  sorted.forEach((panel) => drawPanel(panel, PANEL_LAYOUT.findIndex((entry) => entry.id === panel.id)));
  drawDragGuide();
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.scene.foldRecords.length);
  canvas.dataset.unhinged = String(frame.scene.materialTrace.unhingedCount);
  canvas.dataset.wrongHinges = String(frame.scene.materialTrace.wrongHingeCount);
  stageReadout.textContent = state === 'visitor-drag' ? 'wrong hinge remembered' : state === 'fold-lifted' ? 'latest hinge undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.foldRecords.length} fold${frame.scene.foldRecords.length === 1 ? '' : 's'} remembered`;
  undoControl.disabled = frame.memory.length === 0;
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'sequence');
    return;
  }
  if (frozen) {
    render(timeline.at(-1));
    return;
  }
  render(frameAt(now));
}

function pointerPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1)),
    y: clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1))
  };
}

function makeFold(start, end) {
  if (staticPreview) return;
  const safeStart = start ?? { x: 0.26, y: 0.40 };
  const safeEnd = end ?? { x: 0.76, y: 0.55 };
  const distance = Math.hypot(safeEnd.x - safeStart.x, safeEnd.y - safeStart.y);
  if (distance < DRAG_THRESHOLD) return;
  const base = interactionFrame?.interaction === 'visitor-drag' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyFold(base, { start: safeStart, end: safeEnd, distance });
  render(interactionFrame, 'visitor-drag');
}

function undoFold() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestFold(base);
  render(interactionFrame, 'fold-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  interactionFrame = null;
  dragStart = null;
  dragPoint = null;
  dragging = false;
  started = performance.now();
  currentStage = 0;
  renderCurrent();
}

canvas.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  dragStart = pointerPoint(event);
  dragPoint = dragStart;
  dragging = true;
  renderCurrent();
});
canvas.addEventListener('pointermove', (event) => {
  if (staticPreview || !dragging) return;
  dragPoint = pointerPoint(event);
  renderCurrent();
});
canvas.addEventListener('pointerup', (event) => {
  if (staticPreview || !dragging) return;
  dragPoint = pointerPoint(event);
  const start = dragStart;
  const end = dragPoint;
  dragging = false;
  dragStart = null;
  dragPoint = null;
  makeFold(start, end);
  renderCurrent();
});
canvas.addEventListener('pointercancel', () => {
  dragging = false;
  dragStart = null;
  dragPoint = null;
  renderCurrent();
});
canvas.addEventListener('keydown', (event) => {
  if (staticPreview) return;
  if (event.key === 'Delete') {
    event.preventDefault();
    undoFold();
    return;
  }
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeFold({ x: 0.26, y: 0.40 }, { x: 0.76, y: 0.55 });
});
foldControl.addEventListener('click', () => makeFold({ x: 0.26, y: 0.40 }, { x: 0.76, y: 0.55 }));
undoControl.addEventListener('click', undoFold);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitCanvas(); renderCurrent(); });

fitCanvas();
renderCurrent();

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);
