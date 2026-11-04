import {
  DEPARTURE_THRESHOLD,
  NODE_COUNT,
  SEED,
  approach,
  buildField,
  buildTimeline,
  commitDeparture,
  geometrySignature,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field = staticMode ? buildTimeline().at(-1) : buildField();
let selectedSite = 0;
let inside = false;
let lastPoint = null;
let movementBudget = 0;
let renderer;
let backgroundLayer;
let canvasNode;

const stageNode = document.querySelector('[data-absence-stage]');
const hostNode = document.querySelector('[data-absence-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

const stateText = (stage) => ({
  'quiet field': 'the field is waiting for you to leave',
  'present / 0': 'presence is held without a decision',
  'stayed / no departure': 'a brief passage was not enough to leave a trace',
  'left / remote': 'the departure opened a place you did not touch',
  'lifted / exact': 'the last absence was lifted exactly'
}[stage] ?? 'the portrait is deciding elsewhere');

const toneFor = (p, index) => {
  if (index % 4 === 0) return p.color(9, 68, 68, 92);
  if (index % 4 === 1) return p.color(178, 59, 50, 92);
  if (index % 4 === 2) return p.color(42, 60, 72, 92);
  return p.color(191, 26, 34, 84);
};

function setSelected(site) {
  selectedSite = (site + NODE_COUNT) % NODE_COUNT;
  if (!field.presence && !staticMode) {
    field = approach(field, { site: selectedSite, load: 0 });
    renderStatus(field.interaction);
  }
}

function renderStatus(stage = field.interaction) {
  const pulse = field.presence ? ` · ${Math.round(field.presence.load * 100)}%` : '';
  readoutNode.textContent = `${stage} / ${String(field.revision).padStart(2, '0')}${pulse}`;
  memoryNode.textContent = `${field.memory.length} departure${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = field.presence
    ? (field.presence.load >= DEPARTURE_THRESHOLD ? 'leave now · the field has enough of you' : 'move through it · presence is still latent')
    : 'enter the field · move through it · leave';
}

function apply(next, stage = next.interaction) {
  field = next;
  renderStatus(stage);
  return field;
}

function commitLeave(site = selectedSite, load = DEPARTURE_THRESHOLD + 0.18) {
  if (staticMode) return { accepted: false, field };
  const present = approach(field, { site, load });
  const result = commitDeparture(present);
  apply(result.field, result.accepted ? 'left / remote' : 'stayed / no departure');
  movementBudget = 0;
  lastPoint = null;
  return result;
}

function lift() {
  if (staticMode) return field;
  return apply(liftLatest(field), 'lifted / exact');
}

function release() {
  if (staticMode) return field;
  selectedSite = 0;
  movementBudget = 0;
  lastPoint = null;
  return apply(releaseField(), 'quiet field');
}

function pointerPoint(event) {
  const rect = stageNode.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function nodePosition(node) {
  const width = renderer?.width ?? hostNode.clientWidth;
  const height = renderer?.height ?? hostNode.clientHeight;
  const top = Math.min(104, height * 0.14);
  const bottom = Math.max(top + 250, height - (width < 600 ? 160 : 118));
  return {
    x: width * 0.5 + node.x * width * 0.34,
    y: top + ((node.y + 1) / 2) * (bottom - top)
  };
}

function nearestSite(point) {
  if (!renderer) return selectedSite;
  let best = selectedSite;
  let bestDistance = Infinity;
  for (const node of field.nodes) {
    const position = nodePosition(node);
    const dx = position.x - point.x;
    const dy = position.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = node.index;
    }
  }
  return best;
}

function onPointerEnter(event) {
  if (staticMode) return;
  inside = true;
  lastPoint = pointerPoint(event);
  movementBudget = 0.08;
  const site = nearestSite(lastPoint);
  selectedSite = site;
  apply(approach(field, { site, load: movementBudget }), `present / ${site}`);
}

function onPointerMove(event) {
  if (staticMode || !inside) return;
  const point = pointerPoint(event);
  const previous = lastPoint ?? point;
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  movementBudget = Math.min(1, movementBudget + Math.min(0.14, distance / 180));
  lastPoint = point;
  const site = nearestSite(point);
  selectedSite = site;
  apply(approach(field, { site, load: movementBudget }), `present / ${site}`);
}

function onPointerLeave() {
  if (staticMode || !inside) return;
  inside = false;
  commitLeave(field.presence?.site ?? selectedSite, Math.max(movementBudget, field.presence?.load ?? 0));
}

function onPointerUp(event) {
  if (event.pointerType === 'touch') onPointerLeave();
}

function cycle(direction) {
  setSelected(selectedSite + direction);
  stageNode.focus({ preventScroll: true });
}

stageNode.addEventListener('pointerenter', onPointerEnter);
stageNode.addEventListener('pointermove', onPointerMove);
stageNode.addEventListener('pointerleave', onPointerLeave);
stageNode.addEventListener('pointerup', onPointerUp);
stageNode.addEventListener('pointercancel', onPointerLeave);
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); cycle(1); }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); cycle(-1); }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commitLeave(selectedSite); stageNode.focus({ preventScroll: true }); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); stageNode.focus({ preventScroll: true }); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); stageNode.focus({ preventScroll: true }); }
});

document.querySelector('[data-action="leave"]').addEventListener('click', () => commitLeave(selectedSite));
document.querySelector('[data-action="lift"]').addEventListener('click', () => lift());
document.querySelector('[data-action="release"]').addEventListener('click', () => release());

function createBackdrop(p) {
  backgroundLayer = p.createGraphics(p.width, p.height);
  backgroundLayer.pixelDensity(1);
  backgroundLayer.colorMode(p.HSB, 360, 100, 100, 100);
  const ctx = backgroundLayer.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, p.width, p.height);
  gradient.addColorStop(0, '#eee8de');
  gradient.addColorStop(0.46, '#e1d9ce');
  gradient.addColorStop(1, '#d1c6ba');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, p.width, p.height);
  backgroundLayer.noStroke();
  backgroundLayer.fill(178, 59, 50, 5);
  backgroundLayer.ellipse(p.width * 0.22, p.height * 0.24, p.width * 0.56, p.height * 0.44);
  backgroundLayer.fill(191, 26, 34, 5);
  backgroundLayer.ellipse(p.width * 0.79, p.height * 0.75, p.width * 0.6, p.height * 0.46);
  backgroundLayer.stroke(24, 37, 44, 7);
  backgroundLayer.strokeWeight(1);
  const step = Math.max(28, Math.round(Math.min(p.width, p.height) / 18));
  for (let x = step; x < p.width; x += step) backgroundLayer.line(x, 0, x, p.height);
  for (let y = step; y < p.height; y += step) backgroundLayer.line(0, y, p.width, y);
  backgroundLayer.noStroke();
  p.randomSeed(SEED);
  for (let i = 0; i < Math.floor((p.width * p.height) / 9500); i += 1) {
    const x = p.random(p.width);
    const y = p.random(p.height);
    backgroundLayer.fill(i % 5 === 0 ? 9 : 191, i % 5 === 0 ? 50 : 22, i % 5 === 0 ? 50 : 38, 9);
    backgroundLayer.ellipse(x, y, p.random(0.5, 2.2));
  }
}

function renderArtwork(p) {
  p.image(backgroundLayer, 0, 0);
  const top = Math.min(104, p.height * 0.14);
  const bottom = Math.max(top + 250, p.height - (p.width < 600 ? 160 : 118));
  const centerX = p.width * 0.5 + Math.sin(p.frameCount * 0.003) * (reducedMotion ? 0 : 3);
  p.push();
  p.stroke(24, 37, 44, 20);
  p.strokeWeight(1);
  p.line(centerX, top, centerX, bottom);
  p.stroke(178, 59, 50, 28);
  p.line(centerX - 8, top + 46, centerX + 8, bottom - 38);
  p.pop();

  for (const event of field.memory) {
    const source = nodePosition(field.nodes[event.source]);
    const receiver = nodePosition(field.nodes[event.receiver]);
    const bend = (event.revision % 2 === 0 ? 1 : -1) * p.width * 0.11;
    p.noFill();
    p.stroke(178, 59, 50, 30);
    p.strokeWeight(1.1);
    p.bezier(source.x, source.y, source.x + bend, source.y + 18, receiver.x - bend, receiver.y - 18, receiver.x, receiver.y);
    p.stroke(191, 26, 34, 14);
    p.line(source.x, source.y, receiver.x, receiver.y);
  }

  const active = field.presence?.site;
  for (const node of field.nodes) drawNode(p, node, node.index === active);

  p.noStroke();
  p.fill(24, 37, 44, 58);
  p.rect(p.width * 0.5 - 2, bottom + 10, 4, 18, 2);
  p.fill(178, 59, 50, 68);
  p.rect(p.width * 0.5 - 1, top - 20, 2, 14, 1);
}

function drawNode(p, node, active) {
  const position = nodePosition(node);
  const unit = Math.min(p.width, p.height);
  const width = Math.max(20, node.width * unit * 0.56) * (node.state === 'hollow' ? 1.12 : 1);
  const height = Math.max(18, node.height * unit * 0.56) * (node.state === 'hollow' ? 1.08 : 1);
  const away = active && field.presence ? (field.presence.load * 0.13) * (node.index % 2 === 0 ? 1 : -1) : 0;
  const drift = !reducedMotion && node.state === 'quiet' ? Math.sin(p.frameCount * 0.018 + node.index) * 1.4 : 0;
  const stroke = toneFor(p, node.index);
  const start = node.notch * p.TWO_PI + away;

  p.push();
  p.translate(position.x + drift, position.y);
  p.rotate(node.angle + away);
  p.noStroke();
  p.fill(24, 37, 44, node.state === 'hollow' ? 8 : 11);
  p.ellipse(5, 7, width * 1.32, height * 1.34);
  p.noFill();
  p.stroke(stroke);
  p.strokeWeight(node.state === 'hollow' ? 2.5 : 1.7);
  p.arc(0, 0, width, height, start + 0.24, start + p.TWO_PI - 0.22);
  p.stroke(24, 37, 44, 42);
  p.strokeWeight(0.8);
  p.arc(0, 0, width * 0.64, height * 0.62, start + 0.54, start + p.TWO_PI - 0.48);
  p.stroke(stroke);
  p.strokeWeight(1.4);
  const notchX = Math.cos(start) * width * 0.42;
  const notchY = Math.sin(start) * height * 0.42;
  p.line(notchX, notchY, notchX * 0.38, notchY * 0.38);
  p.noStroke();
  p.fill(stroke);
  p.ellipse(0, 0, node.state === 'hollow' ? width * node.voidScale * 0.18 : 4.5, node.state === 'hollow' ? height * node.voidScale * 0.18 : 4.5);
  if (node.state === 'hollow') {
    p.noFill();
    p.stroke(178, 59, 50, 86);
    p.strokeWeight(1.1);
    p.ellipse(0, 0, width * node.voidScale * 0.32, height * node.voidScale * 0.32);
    p.stroke(191, 26, 34, 58);
    p.line(-width * 0.22, height * 0.28, width * 0.32, -height * 0.26);
  }
  p.pop();
}

renderer = new window.p5((p) => {
  p.setup = () => {
    const canvas = p.createCanvas(Math.max(320, hostNode.clientWidth), Math.max(500, hostNode.clientHeight));
    canvas.parent(hostNode);
    canvas.addClass('absence-p5-canvas');
    canvas.attribute('aria-hidden', 'true');
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.randomSeed(SEED);
    p.noiseSeed(SEED);
    createBackdrop(p);
    renderStatus();
    window.__mutinePortraitV042 = {
      DEPARTURE_THRESHOLD,
      NODE_COUNT,
      getState: () => JSON.parse(JSON.stringify(field)),
      geometrySignature: () => geometrySignature(field),
      approach,
      commitDeparture,
      leave: () => commitLeave(selectedSite),
      lift,
      release,
      getSelected: () => selectedSite,
      context: stageNode
    };
  };
  p.draw = () => {
    renderArtwork(p);
  };
  p.windowResized = () => {
    p.resizeCanvas(Math.max(320, hostNode.clientWidth), Math.max(500, hostNode.clientHeight));
    createBackdrop(p);
  };
});

renderStatus();
