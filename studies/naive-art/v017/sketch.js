import {
  BLOCK_LAYOUT,
  STAGES,
  applyAttention,
  attentionSignature,
  buildTimeline,
  deleteLatestAttention,
  layoutForViewport
} from './engine.mjs';

const canvas = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const ctx = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attentionControl = document.querySelector('#attention-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3600;
const HOLD_MS = 640;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
const palette = {
  paper: '#e9e4d6',
  paperLight: '#fffaf0',
  ink: '#173247',
  coral: '#d85d4c',
  lemon: '#e6b949',
  green: '#6f8f80',
  lilac: '#a58ab0',
  sky: '#77aeb0',
  shadow: 'rgba(23,50,71,.18)',
  rust: '#8e5d57'
};
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let pendingPoint = null;
let holdTimer = null;
let holdStarted = 0;
let holding = false;
let committedHold = false;
let cssWidth = 1000;
let cssHeight = 800;
let dpr = 1;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fixed = (value) => Number(value).toFixed(4);

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage]);
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.scene.attentionRecords.length,
    engineMemory: frame.memory.length,
    immediatePresenceChanges: frame.scene.materialTrace.immediatePresenceChanges,
    sustainedAttentionChanges: frame.scene.materialTrace.sustainedAttentionChanges,
    falseFaces: frame.scene.materialTrace.falseFaceCount,
    inheritedFaces: frame.scene.materialTrace.inheritedFaceCount,
    gaps: frame.scene.materialTrace.gapCount,
    interaction: interactionFrame?.interaction ?? 'sequence',
    armed: Boolean(pendingPoint),
    holding,
    committedHold,
    attentionSignature: attentionSignature(frame)
  };
}

window.__mutineNaiveV017 = { getState: stateSnapshot };
canvas.dataset.witness = 'sustained-misaddress';
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

function blockCenter(block) {
  return {
    x: (block.x + block.shift.x) * cssWidth,
    y: (block.y + block.shift.y - block.lift) * cssHeight
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
  gradient.addColorStop(0, palette.paperLight);
  gradient.addColorStop(0.52, palette.paper);
  gradient.addColorStop(1, '#d6e1db');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.save();
  ctx.globalAlpha = 0.20;
  ctx.lineWidth = 1;
  for (let index = 0; index < 18; index += 1) {
    const x = 22 + index * (cssWidth / 17);
    ctx.strokeStyle = index % 3 === 0 ? palette.coral : palette.green;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 26, cssHeight * 0.26, x - 18, cssHeight * 0.68, x + 24, cssHeight);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  for (let index = 0; index < 220; index += 1) {
    const x = (index * 97 + 31) % Math.max(cssWidth, 1);
    const y = (index * 149 + 47) % Math.max(cssHeight, 1);
    const size = index % 7 === 0 ? 2 : 1;
    ctx.fillStyle = index % 4 === 0 ? palette.ink : palette.green;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function irregularBody(block, width, height) {
  const w = width * 0.5;
  const h = height * 0.5;
  return [
    [-w * 0.94, -h * 0.76],
    [-w * 0.22, -h],
    [w * 0.86, -h * 0.82],
    [w, h * 0.16],
    [w * 0.46, h * 0.88],
    [-w * 0.55, h],
    [-w, h * 0.35]
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
  if (kind === 'loop') {
    ctx.beginPath(); ctx.arc(0, 0, 15, 0.3, Math.PI * 1.72); ctx.stroke();
  } else if (kind === 'ladder') {
    ctx.beginPath(); ctx.moveTo(-19, -13); ctx.lineTo(-19, 13); ctx.moveTo(0, -17); ctx.lineTo(0, 17); ctx.moveTo(19, -13); ctx.lineTo(19, 13); ctx.moveTo(-19, -6); ctx.lineTo(19, -6); ctx.moveTo(-19, 7); ctx.lineTo(19, 7); ctx.stroke();
  } else if (kind === 'star') {
    ctx.beginPath(); for (let index = 0; index < 5; index += 1) { const angle = -Math.PI / 2 + index * Math.PI * 0.8; const x = Math.cos(angle) * 19; const y = Math.sin(angle) * 19; if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.closePath(); ctx.stroke();
  } else if (kind === 'cup') {
    ctx.beginPath(); ctx.moveTo(-17, -12); ctx.lineTo(-11, 15); ctx.lineTo(11, 15); ctx.lineTo(17, -12); ctx.stroke();
  } else if (kind === 'knot') {
    ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(18, 14); ctx.moveTo(18, -14); ctx.lineTo(-18, 14); ctx.stroke();
  } else if (kind === 'step') {
    ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(-20, -12); ctx.lineTo(-2, -12); ctx.lineTo(-2, 4); ctx.lineTo(18, 4); ctx.stroke();
  } else if (kind === 'crumb') {
    ctx.beginPath(); ctx.arc(-12, 6, 5, 0, Math.PI * 2); ctx.arc(3, -6, 4, 0, Math.PI * 2); ctx.arc(15, 9, 3, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'eyelet') {
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(18, -12); ctx.stroke();
  }
  ctx.restore();
}

function drawGap(gap) {
  const x = gap.x * cssWidth;
  const y = gap.y * cssHeight;
  const w = gap.w * cssWidth;
  const h = gap.h * cssHeight;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(gap.angle);
  ctx.shadowColor = 'rgba(23,50,71,.23)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  polygon([[-w, 0], [-w * 0.5, -h], [w, -h * 0.55], [w * 0.66, h], [-w * 0.66, h * 0.85]], palette.paperLight, palette.ink, 1.1);
  ctx.restore();
}

function drawBlock(block, index) {
  const center = blockCenter(block);
  const width = block.w * cssWidth * block.scaleX;
  const height = block.h * cssHeight * block.scaleY;
  const depth = Math.max(7, Math.min(24, height * 0.20));
  const body = irregularBody(block, width, height);
  const bodyShifted = body.map(([x, y]) => [x, y + depth]);

  ctx.save();
  ctx.translate(center.x + width * 0.04, center.y + height * 0.06);
  ctx.rotate(block.angle);
  ctx.globalAlpha = 0.30;
  polygon(body, palette.shadow);
  ctx.restore();

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(block.angle);
  polygon(bodyShifted, 'rgba(23,50,71,.22)', palette.ink, 1);
  polygon([body[5], body[6], bodyShifted[6], bodyShifted[5]], 'rgba(23,50,71,.20)', palette.ink, 1);
  polygon([body[2], body[3], bodyShifted[3], bodyShifted[2]], 'rgba(23,50,71,.14)', palette.ink, 1);
  polygon(body, block.color, palette.ink, 1.2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(body[0][0], body[0][1]);
  for (const point of body.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.clip();
  const baseMotif = block.chips.find((chip) => chip.kind !== 'wrong-edge') ?? { kind: block.motif, offset: 0 };
  drawMotif(baseMotif.kind, palette.paperLight, 0.72, baseMotif.offset * width, 0);
  for (const face of block.falseFaces) {
    ctx.save();
    ctx.translate(face.x * width, face.y * height);
    ctx.rotate(face.rotation);
    ctx.fillStyle = face.color;
    ctx.beginPath();
    ctx.moveTo(-width * 0.14, -height * 0.19);
    ctx.lineTo(width * 0.18, -height * 0.13);
    ctx.lineTo(width * 0.12, height * 0.18);
    ctx.lineTo(-width * 0.22, height * 0.10);
    ctx.closePath();
    ctx.fill();
    drawMotif(face.to, palette.ink, 0.48, 0, 0.08);
    ctx.restore();
  }
  for (const face of block.inheritedFaces) {
    ctx.save();
    ctx.translate(face.x * width, face.y * height);
    ctx.rotate(face.rotation);
    ctx.strokeStyle = face.color;
    ctx.lineWidth = Math.max(2, cssWidth * 0.006);
    ctx.beginPath();
    ctx.moveTo(-width * 0.18, -height * 0.13);
    ctx.lineTo(width * 0.18, height * 0.15);
    ctx.stroke();
    drawMotif(face.from, face.color, 0.45, 0, 0);
    ctx.restore();
  }
  for (const chip of block.chips.filter((item) => item.kind === 'wrong-edge')) {
    ctx.fillStyle = palette.paperLight;
    ctx.beginPath();
    ctx.moveTo(chip.offset * width, -height * 0.52);
    ctx.lineTo(chip.offset * width + width * 0.10, -height * 0.37);
    ctx.lineTo(chip.offset * width - width * 0.02, -height * 0.20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();

  if (index % 3 === 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,250,240,.44)';
    ctx.translate(center.x - width * 0.26, center.y - height * 0.22);
    ctx.rotate(block.angle - 0.18);
    ctx.fillRect(0, 0, width * 0.11, Math.max(1, height * 0.035));
    ctx.restore();
  }
}

function drawShadow(frame) {
  const shadow = frame.scene.shadow;
  ctx.save();
  ctx.translate(cssWidth * (0.50 + shadow.x), cssHeight * (0.82 + shadow.y));
  ctx.rotate(shadow.tilt);
  ctx.scale(1 + shadow.scale * 0.04, 0.22);
  ctx.fillStyle = 'rgba(23,50,71,.15)';
  ctx.beginPath();
  ctx.ellipse(0, 0, cssWidth * 0.29, cssHeight * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(frame, state = 'sequence') {
  const layout = layoutForViewport(cssWidth, cssHeight);
  cssHeight = layout.mode === 'portrait' ? Math.max(fieldWrap.clientHeight || 1, cssHeight) : cssHeight;
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawBackground();
  drawShadow(frame);
  for (const gap of frame.scene.gaps) drawGap(gap);
  const sorted = [...frame.scene.blocks].sort((a, b) => (a.y - a.lift) - (b.y - b.lift));
  sorted.forEach((block) => drawBlock(block, BLOCK_LAYOUT.findIndex((entry) => entry.id === block.id)));
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.scene.attentionRecords.length);
  canvas.dataset.immediatePresenceChanges = String(frame.scene.materialTrace.immediatePresenceChanges);
  canvas.dataset.sustainedAttentionChanges = String(frame.scene.materialTrace.sustainedAttentionChanges);
  canvas.dataset.gaps = String(frame.scene.materialTrace.gapCount);
  stageReadout.textContent = state === 'visitor-attention' ? 'attention held / misaddressed' : state === 'attention-lifted' ? 'latest attention undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.attentionRecords.length} attention event${frame.scene.attentionRecords.length === 1 ? '' : 's'} remembered`;
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

function makeAttention(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-attention' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyAttention(base, point ?? { x: 0.58, y: 0.46 });
  committedHold = true;
  pendingPoint = null;
  render(interactionFrame, 'visitor-attention');
}

function undoAttention() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestAttention(base);
  committedHold = false;
  render(interactionFrame, 'attention-lifted');
}

function releaseSequence() {
  if (staticPreview) return;
  window.clearTimeout(holdTimer);
  interactionFrame = null;
  pendingPoint = null;
  holding = false;
  committedHold = false;
  started = performance.now();
  currentStage = 0;
  canvas.dataset.armed = 'false';
  renderCurrent();
}

function beginHold(event) {
  if (staticPreview) return;
  event.preventDefault();
  pendingPoint = pointerPoint(event);
  holding = true;
  committedHold = false;
  holdStarted = performance.now();
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => makeAttention(pendingPoint), HOLD_MS);
}

function endHold() {
  if (!holding) return;
  const heldFor = performance.now() - holdStarted;
  window.clearTimeout(holdTimer);
  holding = false;
  if (heldFor >= HOLD_MS && !committedHold) makeAttention(pendingPoint);
}

canvas.addEventListener('pointerenter', (event) => {
  if (staticPreview) return;
  pendingPoint = pointerPoint(event);
  canvas.dataset.armed = 'true';
});
canvas.addEventListener('pointermove', (event) => {
  if (staticPreview) return;
  pendingPoint = pointerPoint(event);
  canvas.dataset.armed = 'true';
});
canvas.addEventListener('pointerdown', beginHold);
canvas.addEventListener('pointerup', endHold);
canvas.addEventListener('pointercancel', endHold);
canvas.addEventListener('pointerleave', () => {
  if (staticPreview) return;
  canvas.dataset.armed = 'false';
  if (!holding) pendingPoint = null;
});
canvas.addEventListener('keydown', (event) => {
  if (staticPreview) return;
  if (event.key === 'Delete') {
    event.preventDefault();
    undoAttention();
    return;
  }
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeAttention({ x: 0.58, y: 0.46 });
});
attentionControl.addEventListener('click', () => makeAttention({ x: 0.58, y: 0.46 }));
undoControl.addEventListener('click', undoAttention);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitCanvas(); renderCurrent(); });

fitCanvas();
renderCurrent();

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);
