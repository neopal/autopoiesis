import {
  STAGES,
  buildTimeline,
  traverse,
  commitDeparture,
  liftLatestDeparture,
  releaseAttention,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3200;
const field = document.querySelector('#ribbon-field');
const canvas = document.querySelector('#field');
const context = canvas.getContext('2d');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let routePoints = [];
let pointerInside = false;
let cssWidth = 1;
let cssHeight = 1;
let deviceScale = 1;

const palette = {
  ground: '#080911',
  quiet: ['#8d88bd', '#a49cc9', '#67668f', '#b5aac9'],
  witness: '#ddd594',
  detour: '#ef7c67',
  reply: '#82d1cc',
  ink: '#eee9df',
  shadow: '#05060a',
  violet: '#373357',
  seam: '#222238'
};

const grain = Array.from({ length: 720 }, (_, index) => {
  const value = (Math.sin(index * 12.9898 + 4.1414) * 43758.5453) % 1;
  const value2 = (Math.sin(index * 78.233 + 9.221) * 19231.443) % 1;
  return { x: Math.abs(value), y: Math.abs(value2), a: 0.025 + (index % 7) * 0.006 };
});

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function resizeCanvas() {
  const rect = field.getBoundingClientRect();
  cssWidth = Math.max(1, rect.width);
  cssHeight = Math.max(1, rect.height);
  deviceScale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssWidth * deviceScale);
  canvas.height = Math.round(cssHeight * deviceScale);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  renderFrame(currentFrame, currentFrame.interaction || 'sequence');
}

function mapX(value) { return ((value + 1) * 0.5) * cssWidth; }
function mapY(value) { return cssHeight * 0.52 + value * cssHeight * 0.34; }
function lerp(a, b, amount) { return a + (b - a) * amount; }
function colorFor(segment) {
  if (segment.state === 'detoured') return palette.detour;
  if (segment.state === 'replied') return palette.reply;
  if (segment.state === 'witnessed') return palette.witness;
  return palette.quiet[segment.index % palette.quiet.length];
}

function drawBackground(frame) {
  const gradient = context.createLinearGradient(0, 0, cssWidth, cssHeight);
  gradient.addColorStop(0, '#19162a');
  gradient.addColorStop(.44, palette.ground);
  gradient.addColorStop(1, '#05060a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, cssWidth, cssHeight);

  const glow = context.createRadialGradient(cssWidth * .18, cssHeight * .52, 0, cssWidth * .18, cssHeight * .52, cssWidth * .7);
  glow.addColorStop(0, 'rgba(121, 105, 175, .19)');
  glow.addColorStop(.48, 'rgba(59, 49, 98, .08)');
  glow.addColorStop(1, 'rgba(5, 6, 10, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, cssWidth, cssHeight);

  context.save();
  context.globalAlpha = .8;
  for (const dot of grain) {
    context.fillStyle = `rgba(238,233,223,${dot.a})`;
    context.fillRect(dot.x * cssWidth, dot.y * cssHeight, 1, 1);
  }
  context.restore();

  const axisY = cssHeight * .52;
  context.save();
  context.strokeStyle = 'rgba(221,213,148,.15)';
  context.lineWidth = 1;
  context.setLineDash([2, 15]);
  context.beginPath();
  context.moveTo(cssWidth * .04, axisY);
  context.lineTo(cssWidth * .96, axisY);
  context.stroke();
  context.restore();

  context.save();
  context.fillStyle = 'rgba(130,209,204,.12)';
  context.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.letterSpacing = '2px';
  context.fillText('THE FIELD REMEMBERS WHERE YOU LEFT', cssWidth * .05, cssHeight * .18);
  context.restore();
}

function spinePath(frame) {
  const first = frame.segments[0];
  const last = frame.segments.at(-1);
  const startX = mapX(first.x - .08);
  const endX = mapX(last.x + .08);
  const y = cssHeight * .52;
  context.beginPath();
  context.moveTo(startX, y + first.y * cssHeight * .22);
  context.bezierCurveTo(cssWidth * .28, y - cssHeight * .12, cssWidth * .56, y + cssHeight * .1, cssWidth * .76, y - cssHeight * .03);
  context.bezierCurveTo(cssWidth * .84, y - cssHeight * .09, endX, y + last.y * cssHeight * .22, endX, y + last.y * cssHeight * .22);
}

function drawSpine(frame) {
  context.save();
  context.lineCap = 'round';
  spinePath(frame);
  context.strokeStyle = 'rgba(12, 13, 23, .96)';
  context.lineWidth = Math.max(26, cssHeight * .045);
  context.stroke();
  spinePath(frame);
  context.strokeStyle = 'rgba(221,213,148,.42)';
  context.lineWidth = 1.2;
  context.setLineDash([1, 8]);
  context.stroke();
  context.restore();
}

function drawPiece(segment, x, y, width, fromY, toY, fill, alpha = 1) {
  if (toY <= fromY) return;
  const lean = segment.lean * cssHeight * .06;
  context.beginPath();
  context.moveTo(x - width * .52 + lean, y + fromY);
  context.lineTo(x + width * .43 + lean, y + fromY - width * .08);
  context.lineTo(x + width * .52 - lean, y + toY + width * .05);
  context.lineTo(x - width * .42 - lean, y + toY);
  context.closePath();
  context.globalAlpha = alpha;
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = 'rgba(238,233,223,.34)';
  context.lineWidth = 1;
  context.stroke();
  context.globalAlpha = 1;
}

function drawSegment(segment, frame, index) {
  const x = mapX(segment.x) + segment.bend * cssWidth * .07;
  const y = mapY(segment.y);
  const width = segment.width * cssWidth;
  const height = segment.height * cssHeight * .9;
  const gap = segment.gap * height * .58;
  const fill = colorFor(segment);
  const top = -height * .5;
  const middle = -gap * .5;
  const bottom = height * .5;

  context.save();
  context.shadowColor = 'rgba(0,0,0,.54)';
  context.shadowBlur = 20;
  context.shadowOffsetY = 12;
  drawPiece(segment, x, y, width, top, gap ? middle : bottom, fill, .9);
  if (gap) drawPiece(segment, x + segment.fold * width * .8, y, width * .92, gap * .5, bottom, fill, .86);
  context.shadowColor = 'transparent';

  context.save();
  context.globalAlpha = .54;
  context.strokeStyle = index % 2 ? palette.shadow : palette.violet;
  context.lineWidth = Math.max(1, width * .018);
  for (let inner = 0; inner < 3; inner += 1) {
    const inset = (inner + 1) * width * .14;
    const drift = Math.sin(segment.phase + inner) * width * .08 + segment.fold * width * inner * .12;
    context.beginPath();
    context.moveTo(x - width * .34 + inset + drift, y + top * .78);
    context.quadraticCurveTo(x + segment.bend * width * 1.6, y + segment.bend * cssHeight * .11, x + width * .31 - inset + drift, y + bottom * .74);
    context.stroke();
  }
  context.restore();

  if (gap) {
    const cutY = y;
    context.strokeStyle = 'rgba(5,6,10,.96)';
    context.lineWidth = Math.max(2, width * .035);
    context.beginPath();
    context.moveTo(x - width * .72, cutY - gap * .5);
    context.lineTo(x + width * .72, cutY + gap * .5);
    context.stroke();
    context.strokeStyle = 'rgba(239,124,103,.65)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x - width * .42, cutY - gap * .34);
    context.lineTo(x + width * .34, cutY + gap * .34);
    context.stroke();
  }
  if (segment.state === 'replied') {
    context.strokeStyle = 'rgba(130,209,204,.8)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + width * .38, y - height * .35);
    context.lineTo(x + width * (.66 + segment.fold * .28), y + height * .38);
    context.stroke();
  }
  context.restore();
}

function drawMemory(frame) {
  if (!frame.memory.length) return;
  context.save();
  context.lineWidth = 1;
  context.setLineDash([3, 7]);
  for (const event of frame.memory) {
    const from = frame.segments[event.detourSegment];
    const to = frame.segments[event.replySegment];
    context.beginPath();
    context.moveTo(mapX(from.x), mapY(from.y));
    context.bezierCurveTo(cssWidth * .5, cssHeight * (.2 + event.energy * .12), mapX(to.x), cssHeight * .78, mapX(to.x), mapY(to.y));
    context.strokeStyle = 'rgba(130,209,204,.24)';
    context.stroke();
  }
  context.restore();
}

function drawRoute(frame) {
  if (!frame.route?.length) return;
  context.save();
  context.strokeStyle = 'rgba(221,213,148,.9)';
  context.lineWidth = 2;
  context.setLineDash([7, 8]);
  context.beginPath();
  frame.route.forEach(([x, y], index) => {
    const px = mapX(x);
    const py = mapY(y);
    if (!index) context.moveTo(px, py);
    else context.lineTo(px, py);
  });
  context.stroke();
  context.fillStyle = palette.ink;
  for (const [x, y] of [frame.route[0], frame.route.at(-1)]) context.fillRect(mapX(x) - 3, mapY(y) - 3, 6, 6);
  context.restore();
}

function renderCanvas(frame, now = performance.now()) {
  context.clearRect(0, 0, cssWidth, cssHeight);
  drawBackground(frame);
  drawSpine(frame);
  drawMemory(frame);
  frame.segments.forEach((segment, index) => drawSegment(segment, frame, index));
  drawRoute(frame);
  if (!frozen && !interactionFrame) {
    const pulse = (Math.sin(now * .0012) + 1) * .5;
    context.save();
    context.globalAlpha = .08 + pulse * .04;
    context.strokeStyle = palette.acid;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(cssWidth * .8, cssHeight * .19, 14 + pulse * 5, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function renderFrame(frame, interaction = frame.interaction || 'sequence') {
  currentFrame = frame;
  renderCanvas(frame);
  const event = frame.memory.at(-1);
  if (stageReadout) stageReadout.textContent = interaction === 'departure-committed' ? 'departure committed / detour sent' : interaction === 'route-refused' ? 'route refused / too little travel' : interaction === 'departure-lifted' ? 'latest detour lifted' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} departure${frame.memory.length === 1 ? '' : 's'} held${event ? ` · segment ${event.detourSegment + 1} opened` : ''}`;
  if (stateReadout) stateReadout.textContent = interaction === 'departure-committed'
    ? `Segment ${event.detourSegment + 1} opened away from your route; segment ${event.replySegment + 1} bends in reply.`
    : interaction === 'route-refused'
      ? 'The route was too short to become a departure.'
      : interaction === 'departure-lifted'
        ? 'The latest detour is gone. The prior ribbon is exact again.'
        : 'The ribbon is waiting for a route.';
  if (hint) hint.textContent = routePoints.length ? 'leave the field to submit the route' : 'traverse the ribbon; leave to let it decide';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.interaction = interaction;
    field.dataset.signature = geometrySignature(frame);
  }
}

function pointFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return [Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)), Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))];
}

function cueFor(index = 0) {
  const cues = [
    [[-0.82, -0.22], [-0.26, 0.18], [0.16, -0.06], [0.76, 0.26]],
    [[-0.76, 0.36], [-0.24, -0.18], [0.12, 0.34], [0.7, -0.3]],
    [[-0.82, -0.4], [-0.32, -0.08], [0.18, 0.22], [0.78, 0.44]],
    [[-0.72, 0.2], [-0.16, 0.4], [0.26, -0.22], [0.82, -0.12]]
  ];
  return cues[index % cues.length];
}

function submitCue() {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = commitDeparture(traverse(base, { points: cueFor(base.memory.length) }));
  routePoints = [];
  renderFrame(interactionFrame, interactionFrame.interaction);
}

function lift() {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = liftLatestDeparture(base);
  routePoints = [];
  renderFrame(interactionFrame, 'departure-lifted');
}

function release() {
  interactionFrame = frozen ? releaseAttention(0) : null;
  routePoints = [];
  startedAt = performance.now();
  renderFrame(interactionFrame ?? timeline[0], 'attention-released');
}

function saveState() {
  const payload = JSON.stringify({ version: 'v025', signature: geometrySignature(currentFrame), frame: currentFrame }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = 'mutine-self-portrait-v025-state.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function armRoute(event) {
  if (staticPreview || event.target.closest('.ribbon-controls')) return;
  pointerInside = true;
  const point = pointFromEvent(event);
  if (event.pointerType !== 'mouse' && !routePoints.length) routePoints = [point];
  else routePoints.push(point);
  interactionFrame = traverse(interactionFrame ?? activeFrameAt(), { points: routePoints });
  renderFrame(interactionFrame, 'route-armed');
}

function commitRoute() {
  if (!routePoints.length) return;
  interactionFrame = commitDeparture(interactionFrame ?? activeFrameAt());
  routePoints = [];
  renderFrame(interactionFrame, interactionFrame.interaction);
}

function attachInteractions() {
  if (!field || staticPreview) return;
  field.addEventListener('pointermove', armRoute);
  field.addEventListener('pointerleave', () => { pointerInside = false; if (routePoints.length) commitRoute(); });
  field.addEventListener('pointerup', (event) => { if (event.pointerType !== 'mouse') commitRoute(); });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); submitCue(); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
    else if (event.key.toLowerCase() === 's') { event.preventDefault(); saveState(); }
  });
  actionButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'depart') submitCue();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  }));
}

window.__mutinePortraitV025 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    interaction: currentFrame.interaction,
    observedSegment: currentFrame.memory.at(-1)?.observedSegment ?? null,
    detourSegment: currentFrame.memory.at(-1)?.detourSegment ?? null,
    replySegment: currentFrame.memory.at(-1)?.replySegment ?? null,
    signature: geometrySignature(currentFrame),
    segmentStates: currentFrame.segments.map((segment) => segment.state),
    interactive: interactivePreview || !staticPreview,
    blind: blindMode,
    pointerInside
  }),
  getFrame: () => currentFrame,
  submit: submitCue,
  lift,
  release,
  save: saveState,
  requestRender: () => renderFrame(currentFrame, currentFrame.interaction || 'sequence')
};

window.addEventListener('resize', resizeCanvas);
renderFrame(frozen ? timeline.at(-1) : currentFrame);
attachInteractions();
resizeCanvas();
window._p5Ready = true;

function tick(now) {
  if (!frozen && !interactionFrame) renderFrame(activeFrameAt(now));
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
