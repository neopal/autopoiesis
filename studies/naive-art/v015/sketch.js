import {
  STAGES,
  applyMisread,
  buildTimeline,
  deleteLatestMisread,
  layoutForViewport,
  misreadSignature
} from './engine.mjs';

const canvas = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const misreadControl = document.querySelector('#misread-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3800;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const previewParams = new URLSearchParams(location.search);
const interactivePreview = previewParams.has('interaction');
const staticPreview = previewParams.get('static') === '1' || (previewParams.has('preview') && !interactivePreview);
const frozen = reducedMotion || staticPreview;
let started = performance.now();
let currentStage = 0;
let interactionFrame = null;
let cssWidth = 1000;
let cssHeight = 760;
let viewHeight = 760;

const palette = {
  paper: '#f6f0e5',
  paperDeep: '#e7dccb',
  ink: '#173247',
  coral: '#d85d4c',
  lemon: '#f2c861',
  green: '#6f8f80',
  lilac: '#c9a9c9',
  sky: '#c4d9d8',
  shadow: 'rgba(23,50,71,.18)'
};

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage]);
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.scene.misreadRecords.length,
    engineMemory: frame.memory.length,
    localTurns: frame.scene.materialTrace.localTurnCount,
    replies: frame.scene.replyRecords.length,
    blanks: frame.scene.vacancyRecords.length,
    interaction: interactionFrame?.interaction ?? 'sequence',
    misreadSignature: misreadSignature(frame)
  };
}

window.__mutineNaiveV015 = { getState: stateSnapshot };
canvas.dataset.witness = 'copy-error';
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function mapPoint(point) {
  return { x: point.x * 1000, y: point.y * viewHeight };
}

function fitCanvas() {
  cssWidth = Math.max(1, fieldWrap.clientWidth || 1000);
  cssHeight = Math.max(1, fieldWrap.clientHeight || Math.round(cssWidth * 0.76));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

function drawPaper() {
  const gradient = ctx.createLinearGradient(0, 0, 1000, viewHeight);
  gradient.addColorStop(0, '#fffaf0');
  gradient.addColorStop(0.48, '#f0e6d6');
  gradient.addColorStop(1, '#d4e2dc');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, viewHeight);

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = palette.coral;
  ctx.lineWidth = 1.2;
  for (let x = -180; x < 1180; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 150, viewHeight);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  for (let index = 0; index < 420; index += 1) {
    const x = (index * 79 + 17) % 1000;
    const y = (index * 131 + 29) % viewHeight;
    ctx.fillStyle = index % 4 ? palette.ink : palette.lemon;
    ctx.fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function panelTransform(panel) {
  const center = { x: (panel.x + panel.w / 2) * 1000, y: (panel.y + panel.h / 2) * viewHeight };
  ctx.translate(center.x, center.y);
  ctx.rotate(panel.tilt + panel.turn * 0.22);
  ctx.scale(panel.w * 1000, panel.h * viewHeight);
  ctx.translate(-0.5, -0.5);
}

function isMissing(panel, component) {
  return panel.missing.some((missing) => missing.component === component);
}

function stroke(points, color, width = 0.008, close = false, dash = []) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  if (close) ctx.closePath();
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.restore();
}

function fill(points, color, close = true) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  if (close) ctx.closePath();
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawComponent(component, panel, offset = { x: 0, y: 0 }, rotation = 0, reply = false) {
  const wobble = panel.wobble * 0.12;
  ctx.save();
  ctx.translate(offset.x, offset.y);
  ctx.rotate(rotation);
  ctx.globalAlpha = reply ? 0.82 : 1;
  if (component === 'roof') {
    const roof = [
      { x: 0.17 + wobble, y: 0.41 },
      { x: 0.49, y: 0.18 - wobble },
      { x: 0.82 - wobble, y: 0.41 }
    ];
    fill(roof, reply ? palette.lilac : palette.coral);
    stroke(roof, palette.ink, 0.018, true);
  } else if (component === 'sun') {
    ctx.fillStyle = reply ? palette.coral : palette.lemon;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 0.014;
    ctx.beginPath(); ctx.arc(0.78, 0.20, 0.085, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 0.008;
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(0.78 + Math.cos(angle) * 0.11, 0.20 + Math.sin(angle) * 0.11);
      ctx.lineTo(0.78 + Math.cos(angle) * 0.15, 0.20 + Math.sin(angle) * 0.15);
      ctx.stroke();
    }
  } else if (component === 'path') {
    stroke([
      { x: 0.47 - wobble, y: 0.98 },
      { x: 0.55, y: 0.79 + wobble },
      { x: 0.43, y: 0.64 },
      { x: 0.53 + wobble, y: 0.48 }
    ], reply ? palette.coral : palette.green, 0.065, false);
    stroke([
      { x: 0.47 - wobble, y: 0.98 },
      { x: 0.55, y: 0.79 + wobble },
      { x: 0.43, y: 0.64 },
      { x: 0.53 + wobble, y: 0.48 }
    ], palette.ink, 0.009, false);
  } else if (component === 'door') {
    ctx.fillStyle = reply ? palette.lilac : palette.ink;
    ctx.strokeStyle = palette.coral;
    ctx.lineWidth = 0.012;
    ctx.beginPath(); ctx.rect(0.43 + wobble, 0.53, 0.15, 0.27); ctx.fill(); ctx.stroke();
    ctx.fillStyle = palette.lemon;
    ctx.beginPath(); ctx.arc(0.54 + wobble, 0.67, 0.018, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPanel(panel) {
  ctx.save();
  panelTransform(panel);
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 0.025;
  ctx.shadowOffsetX = 0.025;
  ctx.shadowOffsetY = 0.035;
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, 1, 1);
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = panel.kind === 'sun' ? palette.sky : panel.kind === 'road' ? '#e4d6c4' : '#d7e3d7';
  ctx.fillRect(0.035, 0.035, 0.93, 0.91);
  ctx.fillStyle = panel.kind === 'hill' ? palette.lilac : palette.green;
  ctx.globalAlpha = 0.44;
  ctx.fillRect(0.035, 0.69, 0.93, 0.255);
  ctx.globalAlpha = 1;

  for (const component of ['roof', 'sun', 'path', 'door']) {
    if (!isMissing(panel, component)) drawComponent(component, panel);
  }
  for (const reply of panel.replies) {
    drawComponent(reply.component, panel, reply.offset, reply.rotation, true);
  }
  for (const missing of panel.missing) {
    const slots = {
      roof: { x: 0.17, y: 0.18, w: 0.65, h: 0.25 },
      sun: { x: 0.67, y: 0.09, w: 0.22, h: 0.22 },
      path: { x: 0.35, y: 0.44, w: 0.35, h: 0.51 },
      door: { x: 0.40, y: 0.49, w: 0.22, h: 0.35 }
    };
    const slot = slots[missing.component] ?? slots.roof;
    ctx.fillStyle = palette.paper;
    ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    stroke([
      { x: slot.x, y: slot.y },
      { x: slot.x + slot.w, y: slot.y },
      { x: slot.x + slot.w, y: slot.y + slot.h },
      { x: slot.x, y: slot.y + slot.h }
    ], palette.coral, 0.012, true, [0.025, 0.018]);
  }

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 0.014;
  ctx.strokeRect(0, 0, 1, 1);
  ctx.strokeStyle = palette.coral;
  ctx.lineWidth = 0.006;
  ctx.strokeRect(0.018, 0.018, 0.964, 0.964);
  ctx.restore();
}

function drawLabels(frame) {
  if (staticPreview) return;
  ctx.save();
  ctx.fillStyle = palette.ink;
  ctx.font = '11px Arial';
  ctx.letterSpacing = '2px';
  ctx.fillText('FOUR PICTURES / ONE BAD MEMORY', 42, 36);
  ctx.fillStyle = palette.coral;
  ctx.textAlign = 'right';
  ctx.fillText(`${frame.scene.replyRecords.length} WRONG COPIES`, 958, 36);
  ctx.fillStyle = palette.ink;
  ctx.textAlign = 'left';
  ctx.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, 42, viewHeight - 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.coral;
  ctx.fillText(`${frame.scene.vacancyRecords.length} BLANK SLOTS`, 958, viewHeight - 28);
  ctx.restore();
}

function render(frame, state = 'sequence') {
  const layout = layoutForViewport(cssWidth, cssHeight);
  viewHeight = layout.mode === 'portrait' ? 1000 : 760;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(pixelRatio * cssWidth / 1000, 0, 0, pixelRatio * cssHeight / viewHeight, 0, 0);
  ctx.clearRect(0, 0, 1000, viewHeight);
  drawPaper();
  for (const panel of frame.scene.panels) drawPanel(panel);
  drawLabels(frame);
  stageReadout.textContent = state === 'visitor-misread' ? 'visitor misread / paused' : state === 'misread-lifted' ? 'latest misread undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.misreadRecords.length} misread${frame.scene.misreadRecords.length === 1 ? '' : 's'} remembered`;
  undoControl.disabled = frame.memory.length === 0;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - started);
  currentStage = Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS);
  return timeline[currentStage];
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

function makeMisread(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-misread' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyMisread(base, point);
  render(interactionFrame, 'visitor-misread');
}

function undoMisread() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestMisread(base);
  render(interactionFrame, 'misread-lifted');
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
  makeMisread(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (staticPreview) return;
  if (event.key === 'Delete') {
    event.preventDefault();
    undoMisread();
    return;
  }
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeMisread({ x: 0.74, y: 0.44 });
});
misreadControl.addEventListener('click', () => makeMisread({ x: 0.74, y: 0.44 }));
undoControl.addEventListener('click', undoMisread);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitCanvas(); renderCurrent(); });

fitCanvas();
renderCurrent();

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);
