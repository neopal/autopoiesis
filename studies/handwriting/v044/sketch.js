import {
  MATERIAL_BIN_COUNT,
  TOKEN_COUNT,
  buildTimeline,
  castMaterial,
  geometrySignature,
  liftLatest,
  loadMaterial,
  releaseArchive
} from './engine.mjs';

const field = document.querySelector('#carrier-field');
const canvas = document.querySelector('#carrier-canvas');
const context = canvas.getContext('2d');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateText = document.querySelector('#interaction-state');
const interactionState = document.querySelector('[data-interaction-state]');
const buttons = [...document.querySelectorAll('[data-action]')];
const staticMode = document.documentElement.classList.contains('static-mode');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let frame = staticMode ? buildTimeline().at(-1) : releaseArchive();
let width = 1;
let height = 1;
let density = 1;
let dragging = false;
let keyboardCursor = 0;
let animationFrame = 0;

function resizeCanvas() {
  const rect = field.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  density = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * density);
  canvas.height = Math.round(height * density);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(density, 0, 0, density, 0, 0);
  draw(performance.now());
}

const px = (value) => value * width;
const py = (value) => value * height;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function smoothPath(nodes, offset = 0) {
  if (!nodes.length) return;
  context.moveTo(px(nodes[0].x), py(nodes[0].y + offset));
  for (let index = 1; index < nodes.length - 1; index += 1) {
    const current = nodes[index];
    const next = nodes[index + 1];
    const middleX = (px(current.x) + px(next.x)) / 2;
    const middleY = (py(current.y + offset) + py(next.y + offset)) / 2;
    context.quadraticCurveTo(px(current.x), py(current.y + offset), middleX, middleY);
  }
  const last = nodes.at(-1);
  context.lineTo(px(last.x), py(last.y + offset));
}

function drawBackground(time) {
  context.clearRect(0, 0, width, height);
  const wash = context.createRadialGradient(width * .78, height * .2, 0, width * .78, height * .2, width * .5);
  wash.addColorStop(0, 'rgba(120,181,178,.13)');
  wash.addColorStop(1, 'rgba(120,181,178,0)');
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(232,223,205,.055)';
  context.lineWidth = 1;
  for (let x = .1; x < 1; x += .1) {
    context.beginPath();
    context.moveTo(px(x), py(.09));
    context.lineTo(px(x), py(.78));
    context.stroke();
  }
  const pulse = reducedMotion || staticMode ? 0 : Math.sin(time * .0004) * .002;
  context.strokeStyle = 'rgba(232,223,205,.16)';
  context.setLineDash([2, 9]);
  context.beginPath();
  context.moveTo(px(.07), py(.77 + pulse));
  context.lineTo(px(.93), py(.77 + pulse));
  context.stroke();
  context.setLineDash([]);
}

function drawCarrier(time) {
  const nodes = frame.field.carrier.nodes;
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * .00055) * .0018;
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.shadowColor = 'rgba(227,111,69,.42)';
  context.shadowBlur = 20;
  context.strokeStyle = 'rgba(227,111,69,.3)';
  context.lineWidth = Math.max(9, width * .014);
  context.beginPath();
  smoothPath(nodes, drift);
  context.stroke();
  context.shadowBlur = 0;

  context.strokeStyle = '#e36f45';
  context.lineWidth = Math.max(2, width * .003);
  context.beginPath();
  smoothPath(nodes, drift);
  context.stroke();

  context.strokeStyle = 'rgba(232,223,205,.56)';
  context.lineWidth = Math.max(1, width * .0011);
  context.beginPath();
  smoothPath(nodes, -.015 + drift);
  context.stroke();
  context.beginPath();
  smoothPath(nodes, .016 + drift);
  context.stroke();

  for (const node of nodes) {
    context.fillStyle = '#78b5b2';
    context.beginPath();
    context.arc(px(node.x), py(node.y + drift), Math.max(2, px(node.radius)), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawTokens() {
  const tokenSize = clamp(width * .105, 40, 146);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const token of frame.field.tokens) {
    const x = px(token.x);
    const y = py(token.y);
    const size = tokenSize * token.scale;
    const isChanged = frame.changedTokenIds.includes(token.id);
    context.save();
    context.translate(x, y);
    context.rotate(token.angle * Math.PI / 180);
    context.scale(token.width, 1);
    context.font = `600 ${size}px Georgia, 'Times New Roman', serif`;
    context.shadowColor = isChanged ? 'rgba(120,181,178,.38)' : 'rgba(0,0,0,.55)';
    context.shadowBlur = isChanged ? 18 : 12;
    context.fillStyle = isChanged ? '#f1e8d6' : '#e8dfcd';
    context.fillText(token.glyph, 0, 0);
    context.shadowBlur = 0;
    context.strokeStyle = isChanged ? 'rgba(120,181,178,.76)' : 'rgba(232,223,205,.28)';
    context.lineWidth = 1;
    context.strokeText(token.glyph, 0, 0);
    context.strokeStyle = isChanged ? '#78b5b2' : 'rgba(227,111,69,.55)';
    context.lineWidth = Math.max(1, width * .0015);
    context.beginPath();
    context.arc(0, size * .38, Math.max(3, size * token.counter * .08), 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function binPosition(bin) {
  return .17 + bin * .165;
}

function drawLoadRail() {
  const railY = .835;
  context.strokeStyle = 'rgba(232,223,205,.42)';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(px(.1), py(railY));
  context.lineTo(px(.9), py(railY));
  context.stroke();
  for (let bin = 0; bin < MATERIAL_BIN_COUNT; bin += 1) {
    const x = px(binPosition(bin));
    const selected = frame.pending.includes(bin);
    const radius = Math.max(9, width * .012);
    context.strokeStyle = selected ? '#e36f45' : 'rgba(232,223,205,.7)';
    context.fillStyle = selected ? 'rgba(227,111,69,.22)' : 'rgba(17,19,21,.92)';
    context.lineWidth = selected ? 3 : 1;
    context.beginPath();
    context.arc(x, py(railY), radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    if (selected) {
      context.fillStyle = '#e36f45';
      context.beginPath();
      context.arc(x, py(railY), 3, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function draw(time = 0) {
  drawBackground(time);
  drawCarrier(time);
  drawTokens();
  drawLoadRail();
}

function describeState() {
  const casts = frame.memory.length;
  const pending = frame.pending.length;
  const pendingText = pending ? ` ${pending} of 3 load wells are held.` : ' Three load wells are empty.';
  const accessible = casts
    ? `${casts} material casts remain in the carrier.${pendingText}`
    : `The carrier is quiet.${pendingText}`;
  stage.textContent = frame.pending.length ? `${frame.lastEvent} / ${pending} of 3` : frame.lastEvent;
  memoryReadout.textContent = `${casts} casts · ${TOKEN_COUNT} tokens`;
  stateText.textContent = accessible;
  interactionState.textContent = accessible;
}

function render() {
  describeState();
  draw(animationFrame);
}

function pointFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

function binFromPoint(point) {
  if (point.y < .72) return null;
  let nearest = null;
  let distance = Infinity;
  for (let bin = 0; bin < MATERIAL_BIN_COUNT; bin += 1) {
    const nextDistance = Math.abs(point.x - binPosition(bin));
    if (nextDistance < distance) { distance = nextDistance; nearest = bin; }
  }
  return distance < .085 ? nearest : null;
}

function holdBin(bin) {
  if (bin === null || bin === undefined) return;
  frame = loadMaterial(frame, { bin });
  render();
}

function castPending() {
  if (frame.pending.length === 3) frame = castMaterial(frame);
  render();
}

function castDeterministic() {
  frame = { ...frame, pending: [] };
  [0, 2, 4].forEach((bin) => { frame = loadMaterial(frame, { bin }); });
  frame = castMaterial(frame);
  render();
}

function handlePointerDown(event) {
  if (staticMode) return;
  dragging = true;
  field.setPointerCapture?.(event.pointerId);
  holdBin(binFromPoint(pointFromEvent(event)));
}
function handlePointerMove(event) {
  if (!dragging || staticMode) return;
  holdBin(binFromPoint(pointFromEvent(event)));
}
function handlePointerUp(event) {
  if (!dragging || staticMode) return;
  dragging = false;
  field.releasePointerCapture?.(event.pointerId);
  castPending();
}

field.addEventListener('pointerdown', handlePointerDown);
field.addEventListener('pointermove', handlePointerMove);
field.addEventListener('pointerup', handlePointerUp);
field.addEventListener('pointercancel', handlePointerUp);
field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardCursor = (keyboardCursor + 1) % MATERIAL_BIN_COUNT;
    holdBin(keyboardCursor);
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending.length === 3) castPending();
    else castDeterministic();
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    frame = liftLatest(frame);
    render();
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    frame = releaseArchive();
    render();
  }
});

for (const button of buttons) {
  button.addEventListener('click', () => {
    if (button.dataset.action === 'cast') castDeterministic();
    if (button.dataset.action === 'lift') { frame = liftLatest(frame); render(); }
    if (button.dataset.action === 'release') { frame = releaseArchive(); render(); }
  });
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
describeState();
window.__mutineHandwritingV044 = {
  getState: () => frame,
  geometrySignature: () => geometrySignature(frame),
  load: (bin) => { holdBin(Number(bin)); },
  castDeterministic,
  lift: () => { frame = liftLatest(frame); render(); },
  release: () => { frame = releaseArchive(); render(); }
};
window._mutineReady = true;

function animate(time) {
  animationFrame = time;
  draw(time);
  if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
}
if (!staticMode && !reducedMotion) window.requestAnimationFrame(animate);
