import {
  STAGES,
  applyTear,
  buildTimeline,
  deleteLatestTear,
  layoutForViewport,
  tearSignature
} from './engine.mjs';

const canvas = document.querySelector('#field');
const fieldWrap = document.querySelector('.field-wrap');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const tearControl = document.querySelector('#tear-control');
const undoControl = document.querySelector('#undo-control');
const releaseControl = document.querySelector('#release-control');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3600;
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

function activeFrame() {
  return interactionFrame ?? (frozen ? timeline.at(-1) : timeline[currentStage]);
}

function stateSnapshot() {
  const frame = activeFrame();
  return {
    stage: frame.stage,
    stages: STAGES,
    memory: frame.scene.tearRecords.length,
    engineMemory: frame.memory.length,
    cutouts: frame.scene.cutouts.length,
    fragments: frame.scene.fragments.length,
    notches: frame.scene.ground.notches.length,
    interaction: interactionFrame?.interaction ?? 'sequence',
    tearSignature: tearSignature(frame)
  };
}

window.__mutineNaiveV014 = { getState: stateSnapshot };
canvas.dataset.witness = 'puncture';
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const mapPoint = (point) => ({ x: point.x * 1000, y: point.y * viewHeight });

function fitCanvas() {
  cssWidth = Math.max(1, fieldWrap.clientWidth || 1000);
  cssHeight = Math.max(1, fieldWrap.clientHeight || Math.round(cssWidth * 0.7));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * pixelRatio);
  canvas.height = Math.round(cssHeight * pixelRatio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

function path(points, close = false) {
  if (!points?.length) return;
  const mapped = points.map(mapPoint);
  ctx.beginPath();
  ctx.moveTo(mapped[0].x, mapped[0].y);
  for (let index = 1; index < mapped.length; index += 1) ctx.lineTo(mapped[index].x, mapped[index].y);
  if (close) ctx.closePath();
}

function stroke(points, color, width, close = false, dash = []) {
  if (!points?.length) return;
  path(points, close);
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
  if (!points?.length) return;
  path(points, close);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawPaper() {
  const gradient = ctx.createLinearGradient(0, 0, 1000, viewHeight);
  gradient.addColorStop(0, '#fbf1d6');
  gradient.addColorStop(0.46, '#efd49f');
  gradient.addColorStop(1, '#d27e5f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1000, viewHeight);

  const glow = ctx.createRadialGradient(168, 118, 6, 168, 118, 310);
  glow.addColorStop(0, 'rgba(255,250,208,.72)');
  glow.addColorStop(1, 'rgba(255,250,208,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1000, viewHeight);

  ctx.save();
  ctx.globalAlpha = 0.11;
  ctx.strokeStyle = '#345c60';
  ctx.lineWidth = 1;
  for (let x = -120; x < 1080; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 164, viewHeight);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.18;
  for (let index = 0; index < 390; index += 1) {
    const x = (index * 83 + 19) % 1000;
    const y = (index * 137 + 31) % viewHeight;
    ctx.fillStyle = index % 3 ? '#8a594b' : '#fff0c9';
    ctx.fillRect(x, y, index % 4 === 0 ? 2 : 1, 1);
  }
  ctx.restore();
}

function drawSun(sun) {
  const center = mapPoint(sun);
  const radius = sun.radius * Math.min(1000, viewHeight);
  ctx.save();
  ctx.fillStyle = '#f2b343';
  ctx.strokeStyle = '#a8433d';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2;
  for (let index = 0; index < 9; index += 1) {
    const angle = index * Math.PI * 2 / 9;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(angle) * radius * 1.35, center.y + Math.sin(angle) * radius * 1.35);
    ctx.lineTo(center.x + Math.cos(angle) * radius * 1.72, center.y + Math.sin(angle) * radius * 1.72);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTree(tree, groundY) {
  stroke([{ x: tree.x, y: tree.y + 0.04 }, { x: tree.x, y: groundY }], '#a8433d', 8);
  const crown = [
    { x: tree.x, y: tree.y - 0.14 },
    { x: tree.x - 0.12, y: tree.y + 0.10 },
    { x: tree.x + 0.11, y: tree.y + 0.07 }
  ];
  fill(crown, '#477b78');
  stroke(crown, '#28373a', 3, true);
}

function drawGround(world) {
  const y = world.ground.left.y;
  const band = [
    { x: world.ground.left.x, y: y - 0.025 },
    { x: world.ground.right.x, y: y - 0.025 },
    { x: world.ground.right.x, y: y + 0.045 },
    { x: world.ground.left.x, y: y + 0.045 }
  ];
  fill(band, '#477b78');
  stroke(band, '#28373a', 3, true);
  for (const notch of world.ground.notches) {
    const points = [
      { x: clamp(notch.x - notch.width, 0.05, 0.95), y: y - 0.045 },
      { x: clamp(notch.x + notch.width * notch.side, 0.05, 0.95), y: y - notch.depth },
      { x: clamp(notch.x + notch.width * 0.72, 0.05, 0.95), y: y + 0.055 },
      { x: clamp(notch.x - notch.width * 0.52, 0.05, 0.95), y: y + 0.055 }
    ];
    fill(points, '#fbf1d6');
    stroke(points, '#28373a', 2, true);
  }
}

function drawHouse(world) {
  const house = world.house;
  ctx.save();
  ctx.shadowColor = 'rgba(40,34,37,.22)';
  ctx.shadowBlur = 13;
  ctx.shadowOffsetX = 12;
  ctx.shadowOffsetY = 15;
  fill(house.body, '#f0b64c');
  fill(house.roof, '#a8433d');
  ctx.restore();
  stroke(house.body, '#28373a', 4, true);
  stroke(house.roof, '#28373a', 4, true);
  fill(house.door, '#28373a');
  stroke(house.door, '#a8433d', 2, true);
  fill(house.window, '#78a7a1');
  stroke(house.window, '#28373a', 2, true);
}

function drawCutout(cutout) {
  fill(cutout.points, '#fbf1d6');
  stroke(cutout.points, '#28373a', 2.2, true);
  const center = mapPoint(cutout.point);
  ctx.save();
  ctx.fillStyle = '#a8433d';
  ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFragment(fragment) {
  ctx.save();
  const center = mapPoint(fragment.points.reduce((sum, point) => ({ x: sum.x + point.x / fragment.points.length, y: sum.y + point.y / fragment.points.length }), { x: 0, y: 0 }));
  ctx.translate(center.x, center.y);
  ctx.rotate(fragment.angle);
  ctx.translate(-center.x, -center.y);
  fill(fragment.points, '#f2b343');
  stroke(fragment.points, '#a8433d', 2.5, true);
  ctx.restore();
}

function drawLabels(frame) {
  if (staticPreview) return;
  ctx.save();
  ctx.fillStyle = '#28373a';
  ctx.font = '11px Arial';
  ctx.letterSpacing = '2px';
  ctx.fillText('A HOUSE MADE OF MISSING PIECES', 46, 40);
  ctx.fillStyle = '#a8433d';
  ctx.textAlign = 'right';
  ctx.fillText(`${frame.scene.tearRecords.length} TEARS REMEMBERED`, 954, 40);
  ctx.fillStyle = '#28373a';
  ctx.textAlign = 'left';
  ctx.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, 46, viewHeight - 32);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#a8433d';
  ctx.fillText(`${frame.scene.cutouts.length} CUTS / ${frame.scene.fragments.length} LIFTED`, 954, viewHeight - 32);
  ctx.restore();
}

function render(frame, state = 'sequence') {
  const layout = layoutForViewport(cssWidth, cssHeight);
  viewHeight = layout.mode === 'portrait' ? 1180 : 760;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  ctx.setTransform(pixelRatio * cssWidth / 1000, 0, 0, pixelRatio * cssHeight / viewHeight, 0, 0);
  ctx.clearRect(0, 0, 1000, viewHeight);
  drawPaper();
  drawSun(frame.scene.sun);
  drawGround(frame.scene);
  drawTree(frame.scene.tree, frame.scene.ground.left.y);
  drawHouse(frame.scene);
  for (const cutout of frame.scene.cutouts) drawCutout(cutout);
  for (const fragment of frame.scene.fragments) drawFragment(fragment);
  drawLabels(frame);
  stageReadout.textContent = state === 'visitor-tear' ? 'visitor tear / paused' : state === 'tear-lifted' ? 'latest tear undone' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryReadout.textContent = `${frame.scene.tearRecords.length} tear${frame.scene.tearRecords.length === 1 ? '' : 's'} remembered`;
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

function makeTear(point) {
  if (staticPreview) return;
  const base = interactionFrame?.interaction === 'visitor-tear' ? interactionFrame : timeline[currentStage];
  interactionFrame = applyTear(base, point);
  render(interactionFrame, 'visitor-tear');
}

function undoTear() {
  if (staticPreview) return;
  const base = interactionFrame ?? timeline[currentStage];
  interactionFrame = deleteLatestTear(base);
  render(interactionFrame, 'tear-lifted');
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
  makeTear(pointerPoint(event));
});
canvas.addEventListener('keydown', (event) => {
  if (staticPreview || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  makeTear({ x: 0.74, y: 0.44 });
});
tearControl.addEventListener('click', () => makeTear({ x: 0.74, y: 0.44 }));
undoControl.addEventListener('click', undoTear);
releaseControl.addEventListener('click', releaseSequence);
window.addEventListener('resize', () => { fitCanvas(); renderCurrent(); });

fitCanvas();
renderCurrent();

function frame(now) {
  renderCurrent(now);
  if (!frozen) requestAnimationFrame(frame);
}
if (!frozen) requestAnimationFrame(frame);
