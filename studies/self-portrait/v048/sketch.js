import {
  buildField,
  buildTimeline,
  commitDeparture,
  geometrySignature,
  liftLatest,
  recordNotice,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const stageNode = document.querySelector('[data-departure-stage]');
const canvasHost = document.querySelector('[data-departure-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

let field = staticMode ? buildTimeline().at(-1) : buildField();
let pointerRoute = null;
let keyboardCursor = 0;
let p5Instance;

const stateText = (stage) => {
  if (stage === 'quiet body') return 'the portrait is waiting for a witness to leave';
  if (stage.startsWith('presence noticed')) return 'the body has noticed presence without moving';
  if (stage === 'refused / departure incomplete') return 'arrival alone cannot move the portrait';
  if (stage.startsWith('departed /')) return 'the body answered the shape of the departure';
  if (stage === 'lifted / exact') return 'the latest departure was lifted exactly';
  if (stage === 'released / quiet') return 'the portrait returned to its waiting body';
  return 'the portrait is making a decision';
};

function renderStatus(stage = field.interaction) {
  readoutNode.textContent = `${stage} / ${String(field.document.revision).padStart(2, '0')}`;
  memoryNode.textContent = `${field.memory.length} departure${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.pending.length
    ? `${field.pending.length} thresholds noticed · leave toward another`
    : 'visit three thresholds · leave toward another · the body will answer';
  stageNode.dataset.revision = String(field.document.revision);
  stageNode.dataset.pending = String(field.pending.length);
}

function xFor(value, width) { return value * width; }
function yFor(value, height) { return value * height; }

function drawBody(p, ctx) {
  const w = p.width;
  const h = p.height;
  const gradient = ctx.createLinearGradient(w * .2, h * .2, w * .82, h * .82);
  gradient.addColorStop(0, '#e8e7c6');
  gradient.addColorStop(.42, '#c3d36e');
  gradient.addColorStop(1, '#71959a');
  ctx.beginPath();
  field.body.forEach((point, index) => {
    const x = xFor(point.x, w);
    const y = yFor(point.y, h);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(237,240,223,.72)';
  ctx.lineWidth = Math.max(1, w / 900);
  ctx.stroke();

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  field.cuts.forEach((cut) => {
    ctx.save();
    ctx.translate(xFor(cut.x, w), yFor(cut.y, h));
    ctx.rotate(cut.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * cut.radius, h * cut.length * .42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(16,21,27,.62)';
  ctx.lineWidth = Math.max(1.5, w / 520);
  field.cuts.forEach((cut) => {
    ctx.save();
    ctx.translate(xFor(cut.x, w), yFor(cut.y, h));
    ctx.rotate(cut.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * cut.radius, h * cut.length * .42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}

function drawStations(p, ctx) {
  const w = p.width;
  const h = p.height;
  field.stations.forEach((station, index) => {
    const x = xFor(station.x, w);
    const y = yFor(station.y, h);
    const active = field.pending.some((notice) => notice.station === index);
    const length = Math.min(w, h) * (.04 + station.width * 1.2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(station.lean);
    ctx.strokeStyle = active ? 'rgba(220,143,99,.95)' : 'rgba(237,240,223,.38)';
    ctx.lineWidth = active ? Math.max(2, w / 420) : Math.max(1, w / 720);
    ctx.beginPath();
    ctx.moveTo(0, -length * 1.8);
    ctx.lineTo(0, length * 1.8);
    ctx.stroke();
    ctx.strokeStyle = active ? 'rgba(220,143,99,.35)' : 'rgba(127,171,179,.22)';
    ctx.lineWidth = Math.max(1, w / 1200);
    ctx.beginPath();
    ctx.moveTo(-length * 1.8, -length);
    ctx.lineTo(length * 1.8, length);
    ctx.stroke();
    ctx.restore();
  });
}

function drawAmbient(p, ctx) {
  const w = p.width;
  const h = p.height;
  const t = staticMode || reducedMotion ? 0 : p.frameCount * .006;
  const gradient = ctx.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, Math.max(w, h) * .62);
  gradient.addColorStop(0, '#1d2a2d');
  gradient.addColorStop(.45, '#121b21');
  gradient.addColorStop(1, '#080c11');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  for (let index = 0; index < 150; index += 1) {
    const x = (Math.sin(index * 12.9898 + 1.23) * .5 + .5) * w;
    const y = (Math.sin(index * 78.233 + 3.7) * .5 + .5) * h;
    const pulse = .5 + .5 * Math.sin(index * .71 + t * 4);
    ctx.fillStyle = `rgba(195,211,110,${(0.018 + pulse * .025).toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = 'rgba(127,171,179,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(w * .5, h * .52, Math.min(w, h) * (.32 + Math.sin(t) * .004), 0, Math.PI * 2);
  ctx.stroke();
}

function drawField(p) {
  const ctx = p.drawingContext;
  drawAmbient(p, ctx);
  drawStations(p, ctx);
  drawBody(p, ctx);
  const glow = ctx.createRadialGradient(p.width * .5, p.height * .52, 0, p.width * .5, p.height * .52, Math.min(p.width, p.height) * .32);
  glow.addColorStop(0, 'rgba(220,143,99,.09)');
  glow.addColorStop(1, 'rgba(220,143,99,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, p.width, p.height);
}

function redraw() {
  renderStatus();
  p5Instance?.redraw();
}

function notice(station) {
  field = recordNotice(field, station);
  redraw();
}

function commitValid() {
  const wanted = [0, 2, 5].map((offset) => (offset + field.document.revision * 2) % field.stations.length);
  for (const station of wanted) notice(station);
  const destination = (wanted.at(-1) + 2) % field.stations.length;
  const result = commitDeparture(field, destination);
  field = result.field;
  redraw();
  return result;
}

function applyAction(action) {
  if (action === 'departure') commitValid();
  if (action === 'lift') { field = liftLatest(field); redraw(); }
  if (action === 'release') { field = releaseField(); redraw(); }
}

function nearestStation(event) {
  const rect = stageNode.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  let best = 0;
  let distance = Infinity;
  field.stations.forEach((station, index) => {
    const candidate = Math.hypot(station.x - x, station.y - y);
    if (candidate < distance) { distance = candidate; best = index; }
  });
  return best;
}

stageNode.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.departure-controls')) return;
  stageNode.setPointerCapture?.(event.pointerId);
  pointerRoute = { pointerId: event.pointerId };
  notice(nearestStation(event));
});
stageNode.addEventListener('pointermove', (event) => {
  if (!pointerRoute || pointerRoute.pointerId !== event.pointerId) return;
  notice(nearestStation(event));
});
const finishPointer = (event) => {
  if (!pointerRoute || pointerRoute.pointerId !== event.pointerId) return;
  const destination = nearestStation(event);
  const result = commitDeparture(field, destination);
  field = result.field;
  pointerRoute = null;
  redraw();
};
stageNode.addEventListener('pointerup', finishPointer);
stageNode.addEventListener('pointercancel', finishPointer);
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardCursor = (keyboardCursor + (event.key === 'ArrowRight' ? 1 : -1) + field.stations.length) % field.stations.length;
    notice(keyboardCursor);
  }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitValid(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); field = liftLatest(field); redraw(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); field = releaseField(); redraw(); }
});
document.querySelector('.departure-controls')?.addEventListener('click', (event) => {
  const action = event.target.closest('button')?.dataset.action;
  if (action) applyAction(action);
});

p5Instance = new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(stageNode.clientWidth, stageNode.clientHeight).parent(canvasHost);
    p.frameRate(30);
    if (staticMode || reducedMotion) p.noLoop();
    window._p5Ready = true;
    redraw();
  };
  p.draw = () => drawField(p);
  p.windowResized = () => {
    p.resizeCanvas(stageNode.clientWidth, stageNode.clientHeight);
    redraw();
  };
}, canvasHost);

window.__mutinePortraitV048 = {
  getState: () => field,
  geometrySignature: () => geometrySignature(field),
  notice,
  commitValid,
  applyAction,
  release: () => { field = releaseField(); redraw(); },
  version: 'v048'
};
