import {
  STAGES,
  applyAttention,
  buildTimeline,
  removeLatestAttention
} from './engine.mjs';

const canvas = document.querySelector('#piece');
const ctx = canvas.getContext('2d', { alpha: false });
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticPreview = params.get('static') === '1';
const interactive = params.get('interaction') === '1' || document.documentElement.classList.contains('interactive-preview');
const blind = params.get('blind') === '1';
const FINAL_STAGE = STAGES - 1;
const STAGE_MS = 2900;
const timeline = buildTimeline(FINAL_STAGE);
const colors = {
  paper: '#f4f0e6',
  paperDeep: '#e9e4d6',
  ink: '#171b23',
  muted: '#6e757c',
  accent: '#d64732',
  signal: '#1b5f72',
  warm: '#c8a15b',
  hole: '#b6b5aa',
  shadow: 'rgba(23, 27, 35, .11)'
};

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let frameState = staticPreview || reduced ? timeline[FINAL_STAGE] : timeline[0];
let paused = staticPreview || reduced;
let lastPointer = { x: 0.5, y: 0.46 };
let latestVisitorId = null;
let selectedAttentionId = null;
let animationFrame = 0;

const stateNode = document.querySelector('#state');
const liftButton = document.querySelector('#lift-attention');
const releaseButton = document.querySelector('#release-sequence');
const attendButton = document.querySelector('#attend-mark');

function pointToCanvas(point) {
  return { x: point.x * width, y: point.y * height };
}

function drawPaper() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#fffaf0');
  gradient.addColorStop(0.5, colors.paper);
  gradient.addColorStop(1, colors.paperDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.28, height * 0.24, 0, width * 0.28, height * 0.24, width * 0.8);
  glow.addColorStop(0, 'rgba(214, 71, 50, .075)');
  glow.addColorStop(.42, 'rgba(27, 95, 114, .035)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.lineWidth = Math.max(0.45, width / 2400);
  ctx.strokeStyle = 'rgba(23, 27, 35, .07)';
  for (let row = 0; row < 7; row += 1) {
    const y = height * (0.12 + row * 0.13);
    ctx.beginPath();
    ctx.moveTo(width * 0.055, y);
    ctx.lineTo(width * 0.945, y);
    ctx.stroke();
  }
  for (let column = 0; column < 10; column += 1) {
    const x = width * (0.055 + column * 0.10);
    ctx.beginPath();
    ctx.moveTo(x, height * 0.10);
    ctx.lineTo(x, height * 0.90);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  for (let index = 0; index < 920; index += 1) {
    const x = ((index * 73.17 + 19) % 997) / 997 * width;
    const y = ((index * 191.3 + 37) % 991) / 991 * height;
    const alpha = .006 + ((index * 17) % 23) / 3600;
    ctx.fillStyle = `rgba(23, 27, 35, ${alpha})`;
    ctx.fillRect(x, y, .7, .7);
  }
  ctx.restore();
}

function drawSlot(agent) {
  const point = pointToCanvas({ x: agent.baseX, y: agent.baseY });
  const size = Math.min(width, height) * 0.075;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(agent.baseAngle * 0.3);
  ctx.strokeStyle = 'rgba(23, 27, 35, .075)';
  ctx.lineWidth = Math.max(0.6, size * 0.018);
  ctx.setLineDash([size * 0.08, size * 0.12]);
  ctx.strokeRect(-size * 0.37, -size * 0.46, size * 0.74, size * 0.92);
  ctx.setLineDash([]);
  ctx.restore();
}

function roleColor(role, index) {
  if (role === 'looking') return colors.accent;
  if (role === 'answering') return colors.signal;
  if (role === 'witness') return index % 2 ? colors.warm : '#7d6b51';
  return colors.ink;
}

function drawMark(agent, index) {
  const point = pointToCanvas(agent);
  const unit = Math.min(width, height) * 0.095 * agent.scale;
  if (!agent.visible) return;
  const color = roleColor(agent.role, index);
  const lineWidth = Math.max(1.1, unit * 0.072 * agent.weight);
  const aperture = Math.max(0.14, Math.min(0.94, agent.aperture));
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(agent.angle);
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(-unit * 0.30, -unit * 0.46);
  ctx.lineTo(-unit * 0.30, unit * 0.46);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-unit * 0.08, -unit * 0.46);
  ctx.quadraticCurveTo(unit * aperture * 0.62, -unit * 0.28, unit * aperture * 0.68, 0);
  ctx.quadraticCurveTo(unit * aperture * 0.62, unit * 0.28, -unit * 0.08, unit * 0.46);
  ctx.stroke();

  if (agent.role === 'looking') {
    ctx.lineWidth = Math.max(0.8, lineWidth * 0.46);
    ctx.beginPath();
    ctx.moveTo(unit * 0.04, -unit * 0.23);
    ctx.lineTo(unit * 0.38, -unit * 0.23);
    ctx.stroke();
  } else if (agent.role === 'answering') {
    ctx.lineWidth = Math.max(0.8, lineWidth * 0.42);
    ctx.beginPath();
    ctx.moveTo(unit * 0.08, unit * 0.23);
    ctx.lineTo(unit * 0.38, unit * 0.23);
    ctx.stroke();
  } else if (agent.role === 'witness') {
    ctx.lineWidth = Math.max(0.8, lineWidth * 0.3);
    ctx.beginPath();
    ctx.moveTo(unit * 0.04, 0);
    ctx.lineTo(unit * 0.31, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEmptySlots() {
  frameState.agents.filter((agent) => !agent.visible).forEach((agent) => {
    const point = pointToCanvas({ x: agent.baseX, y: agent.baseY });
    const size = Math.min(width, height) * 0.075;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(agent.baseAngle * 0.3);
    ctx.strokeStyle = 'rgba(214, 71, 50, .34)';
    ctx.lineWidth = Math.max(0.7, size * 0.025);
    ctx.setLineDash([size * 0.13, size * 0.16]);
    ctx.strokeRect(-size * 0.37, -size * 0.46, size * 0.74, size * 0.92);
    ctx.setLineDash([]);
    ctx.restore();
  });
}

function drawQuorumWitnesses() {
  if (blind) return;
  frameState.quorums.forEach((quorum, index) => {
    const point = pointToCanvas(quorum);
    const active = quorum.id === latestVisitorId || quorum.id === selectedAttentionId;
    ctx.save();
    ctx.strokeStyle = active ? 'rgba(214, 71, 50, .72)' : 'rgba(27, 95, 114, .28)';
    ctx.lineWidth = active ? 1.8 : 0.75;
    ctx.setLineDash(active ? [] : [3, 5]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.min(width, height) * (active ? 0.075 : 0.052), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = active ? colors.accent : colors.signal;
    ctx.beginPath();
    ctx.arc(point.x, point.y, active ? 3.3 : 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawLabels() {
  if (blind) return;
  ctx.fillStyle = colors.ink;
  ctx.font = `${Math.max(9, Math.min(12, width / 128))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillText(`QUORUM MARKS / ${String(frameState.stage).padStart(2, '0')}`, width * 0.06, height * 0.075);
  ctx.textAlign = 'right';
  ctx.fillStyle = latestVisitorId ? colors.accent : colors.signal;
  ctx.fillText(latestVisitorId ? 'VISITOR LOOK / FIELD REORIENTED' : 'SEPARATE SYLLABLES / WAITING', width * 0.94, height * 0.075);
  ctx.fillStyle = colors.muted;
  ctx.fillText(`${frameState.agents.filter((agent) => agent.visible).length} MARKS · ${frameState.emptySlots.length} VACANCIES · ${frameState.memory.length} LOOKS REMEMBERED`, width * 0.94, height * 0.925);
  if (interactive && !staticPreview) ctx.fillText('CLICK TO ATTEND · TAB TO ACTIONS · SPACE TO ATTEND', width * 0.94, height * 0.965);
  ctx.textAlign = 'left';
}

function drawFrame(now) {
  drawPaper();
  frameState.agents.forEach(drawSlot);
  frameState.agents.forEach(drawMark);
  drawEmptySlots();
  drawQuorumWitnesses();
  drawLabels();

  if (!paused && !reduced && !staticPreview) {
    const elapsed = Math.max(0, now - startedAt);
    const nextStage = Math.min(FINAL_STAGE, Math.floor(elapsed / STAGE_MS));
    if (nextStage !== frameState.stage) {
      frameState = timeline[nextStage];
      selectedAttentionId = frameState.memory.at(-1)?.id ?? null;
      updateButtons();
    }
    if (nextStage < FINAL_STAGE) animationFrame = window.requestAnimationFrame(drawFrame);
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  drawFrame(performance.now());
}

function updateState(message) {
  if (stateNode) stateNode.textContent = message;
}

function updateButtons() {
  if (attendButton) attendButton.disabled = !interactive || staticPreview;
  if (liftButton) liftButton.disabled = !interactive || staticPreview || frameState.memory.length === 0;
  if (releaseButton) releaseButton.disabled = !interactive || staticPreview;
}

function positionFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / Math.max(1, rect.width),
    y: (event.clientY - rect.top) / Math.max(1, rect.height)
  };
}

function placeAt(position) {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  lastPointer = position;
  frameState = applyAttention(frameState, position);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedAttentionId = latestVisitorId;
  paused = true;
  updateState('The marks turned, answered, and left a vacancy in the sentence.');
  updateButtons();
  drawFrame(performance.now());
}

function liftLatest() {
  if (!frameState.memory.length || !interactive || staticPreview) return;
  frameState = removeLatestAttention(frameState);
  latestVisitorId = frameState.memory.at(-1)?.id ?? null;
  selectedAttentionId = latestVisitorId;
  paused = true;
  updateState('The latest look lifted; the earlier alphabet is exact again.');
  updateButtons();
  drawFrame(performance.now());
}

function releaseSequence() {
  if (!interactive || staticPreview) return;
  window.cancelAnimationFrame(animationFrame);
  frameState = timeline[0];
  latestVisitorId = null;
  selectedAttentionId = null;
  paused = false;
  startedAt = performance.now();
  updateState('The marks are separate again; the next quorum is latent.');
  updateButtons();
  drawFrame(startedAt);
  animationFrame = window.requestAnimationFrame(drawFrame);
}

function saveStill() {
  const link = document.createElement('a');
  link.download = 'mutine-handwriting-v015-quorum.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

canvas.addEventListener('pointermove', (event) => {
  lastPointer = positionFromEvent(event);
});
canvas.addEventListener('pointerup', (event) => {
  if (interactive) placeAt(positionFromEvent(event));
});
canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    placeAt(lastPointer);
  }
  if (event.key === 'Delete' || event.key.toLowerCase() === 'u') {
    event.preventDefault();
    liftLatest();
  }
  if (event.key.toLowerCase() === 'p') {
    paused = !paused;
    if (!paused) {
      startedAt = performance.now() - frameState.stage * STAGE_MS;
      animationFrame = window.requestAnimationFrame(drawFrame);
    }
    updateState(paused ? 'Timeline paused; the quorum is held.' : 'Timeline moving; the next quorum is latent.');
  }
  if (event.key.toLowerCase() === 'r') releaseSequence();
  if (event.key.toLowerCase() === 's') saveStill();
});
attendButton?.addEventListener('click', () => placeAt(lastPointer));
liftButton?.addEventListener('click', liftLatest);
releaseButton?.addEventListener('click', releaseSequence);
window.addEventListener('resize', resize);

window.__mutineHandwritingV015 = {
  getState: () => ({
    stage: frameState.stage,
    memory: frameState.memory.map((event) => ({ ...event })),
    visibleMarks: frameState.agents.filter((agent) => agent.visible).length,
    lookingCount: frameState.quorums.reduce((sum, quorum) => sum + quorum.lookingCount, 0),
    answeringCount: frameState.quorums.reduce((sum, quorum) => sum + quorum.answeringCount, 0),
    vacancyCount: frameState.emptySlots.length,
    paused,
    interactive,
    blind
  }),
  placeAt,
  liftLatest,
  releaseSequence,
  getFrameSignature: () => canvas.toDataURL(),
  getCanvas: () => canvas
};

updateButtons();
resize();
