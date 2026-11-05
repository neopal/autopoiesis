import {
  ALIGNMENT_THRESHOLD,
  CHANNEL_COUNT,
  MEMORY_LIMIT,
  RESISTANCE_THRESHOLD,
  SEED,
  TRAVEL_THRESHOLD,
  buildField,
  buildTimeline,
  commitPressure,
  geometrySignature,
  liftLatest,
  loadPressure,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let field = staticMode ? buildTimeline().at(-1) : buildField();
let selectedChannel = 0;
let renderer;
let backgroundLayer;
let canvasNode;
let pointer = {
  active: false,
  start: null,
  last: null,
  distance: 0,
  dx: 0,
  dy: 0,
  points: []
};

const stageNode = document.querySelector('[data-pressure-stage]');
const hostNode = document.querySelector('[data-pressure-canvas]');
const readoutNode = document.querySelector('[data-stage]');
const memoryNode = document.querySelector('[data-memory]');
const stateNode = document.querySelector('[data-state]');
const hintNode = document.querySelector('[data-hint]');
const interactionNode = document.querySelector('[data-interaction-state]');

const stateText = (stage) => ({
  'quiet slab': 'the portrait is waiting for pressure',
  'loaded / 0': 'pressure is held without a decision',
  'refused / latent': 'the slab refused a short or misaligned crossing',
  'recast / remote': 'the portrait re-formed a channel elsewhere',
  'lifted / exact': 'the last recast was lifted exactly'
}[stage] ?? 'the material is deciding elsewhere');

const toneFor = (index) => [
  [20, 60, 88],
  [168, 44, 78],
  [43, 51, 84],
  [192, 32, 73]
][index % 4];

function renderStatus(stage = field.interaction) {
  const current = field.pressure;
  const pulse = current ? ` · ${Math.round(current.pressure * 100)}%` : '';
  readoutNode.textContent = `${stage} / ${String(field.revision).padStart(2, '0')}${pulse}`;
  memoryNode.textContent = `${field.memory.length} recast${field.memory.length === 1 ? '' : 's'} held`;
  const text = stateText(stage);
  stateNode.textContent = text;
  interactionNode.textContent = text;
  hintNode.textContent = current
    ? (current.travel >= TRAVEL_THRESHOLD && current.alignment >= ALIGNMENT_THRESHOLD
      ? 'resistance is met · release to re-form elsewhere'
      : 'follow the grain · the pressure is still latent')
    : 'press into the slab · follow its grain · release';
}

function stagePoint(event) {
  const rect = stageNode.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function channelPosition(channel) {
  const width = renderer?.width ?? hostNode.clientWidth;
  const height = renderer?.height ?? hostNode.clientHeight;
  return {
    x: width * 0.5 + channel.x * width * 0.34,
    y: height * 0.47 + channel.y * height * 0.42
  };
}

function nearestChannel(point) {
  let best = selectedChannel;
  let bestDistance = Infinity;
  for (const channel of field.channels) {
    const position = channelPosition(channel);
    const dx = position.x - point.x;
    const dy = position.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = channel.index;
    }
  }
  return best;
}

function strokeMetrics() {
  const unit = Math.max(1, Math.min(renderer?.width ?? 1, renderer?.height ?? 1));
  const distance = pointer.distance;
  return {
    channel: selectedChannel,
    travel: Math.min(1, distance / (unit * 0.58)),
    alignment: Math.min(1, Math.abs(pointer.dx) / Math.max(distance, 1)),
    pressure: Math.min(1, distance / (unit * 0.56))
  };
}

function applyPressure(metrics, interaction = `loaded / ${selectedChannel}`) {
  field = loadPressure(field, metrics);
  field.interaction = interaction;
  renderStatus(interaction);
}

function resetPointer() {
  pointer = { active: false, start: null, last: null, distance: 0, dx: 0, dy: 0, points: [] };
}

function commitStroke() {
  if (staticMode) return { accepted: false, field };
  const pointerId = pointer.pointerId;
  const result = commitPressure(field);
  field = result.field;
  renderStatus(result.accepted ? 'recast / remote' : 'refused / latent');
  resetPointer();
  if (pointerId !== undefined && stageNode.hasPointerCapture?.(pointerId)) stageNode.releasePointerCapture(pointerId);
  return result;
}

function pressSelected() {
  if (staticMode) return { accepted: false, field };
  applyPressure({
    channel: selectedChannel,
    travel: Math.min(1, TRAVEL_THRESHOLD + 0.22),
    alignment: Math.min(1, ALIGNMENT_THRESHOLD + 0.2),
    pressure: Math.min(1, RESISTANCE_THRESHOLD + 0.2)
  });
  const result = commitPressure(field);
  field = result.field;
  renderStatus(result.accepted ? 'recast / remote' : 'refused / latent');
  return result;
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  renderStatus('lifted / exact');
  stageNode.focus({ preventScroll: true });
  return field;
}

function release() {
  if (staticMode) return field;
  selectedChannel = 0;
  resetPointer();
  field = releaseField();
  renderStatus('quiet slab');
  stageNode.focus({ preventScroll: true });
  return field;
}

function cycle(direction) {
  selectedChannel = (selectedChannel + direction + CHANNEL_COUNT) % CHANNEL_COUNT;
  if (!staticMode) applyPressure({ channel: selectedChannel, travel: 0, alignment: 0, pressure: 0 }, `loaded / ${selectedChannel}`);
  stageNode.focus({ preventScroll: true });
}

function onPointerDown(event) {
  if (staticMode || event.target.closest('.pressure-controls')) return;
  event.preventDefault();
  try { stageNode.setPointerCapture?.(event.pointerId); } catch {
    // Synthetic touch probes may not own a browser pointer capture slot.
  }
  const point = stagePoint(event);
  selectedChannel = nearestChannel(point);
  pointer = { active: true, pointerId: event.pointerId, start: point, last: point, distance: 0, dx: 0, dy: 0, points: [point] };
  applyPressure({ channel: selectedChannel, travel: 0, alignment: 0, pressure: 0 });
}

function onPointerMove(event) {
  if (staticMode || !pointer.active || event.target.closest('.pressure-controls')) return;
  event.preventDefault();
  const point = stagePoint(event);
  const previous = pointer.last ?? point;
  const dx = point.x - previous.x;
  const dy = point.y - previous.y;
  pointer.distance += Math.hypot(dx, dy);
  pointer.dx += dx;
  pointer.dy += dy;
  pointer.last = point;
  pointer.points = [...pointer.points.slice(-20), point];
  applyPressure(strokeMetrics());
}

function onPointerUp(event) {
  if (staticMode || !pointer.active || event.target.closest('.pressure-controls')) return;
  event.preventDefault();
  commitStroke();
}

stageNode.addEventListener('pointerdown', onPointerDown);
stageNode.addEventListener('pointermove', onPointerMove);
stageNode.addEventListener('pointerup', onPointerUp);
stageNode.addEventListener('pointercancel', onPointerUp);
stageNode.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); cycle(1); }
  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); cycle(-1); }
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pressSelected(); stageNode.focus({ preventScroll: true }); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
});

document.querySelector('[data-action="press"]').addEventListener('click', pressSelected);
document.querySelector('[data-action="lift"]').addEventListener('click', lift);
document.querySelector('[data-action="release"]').addEventListener('click', release);

function createBackdrop(p) {
  backgroundLayer = p.createGraphics(p.width, p.height);
  backgroundLayer.pixelDensity(1);
  backgroundLayer.colorMode(p.HSB, 360, 100, 100, 100);
  const ctx = backgroundLayer.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, p.width, p.height);
  gradient.addColorStop(0, '#162225');
  gradient.addColorStop(0.48, '#10181b');
  gradient.addColorStop(1, '#0b1113');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, p.width, p.height);
  backgroundLayer.noFill();
  backgroundLayer.stroke(168, 35, 80, 7);
  backgroundLayer.strokeWeight(1);
  for (let i = -8; i < 20; i += 1) {
    const x = i * p.width / 12;
    backgroundLayer.bezier(x, 0, x + p.width * 0.13, p.height * .28, x - p.width * .1, p.height * .62, x + p.width * .02, p.height);
  }
  backgroundLayer.stroke(42, 44, 88, 8);
  for (let i = 0; i < 12; i += 1) {
    const y = p.height * (0.1 + i * 0.075);
    backgroundLayer.line(0, y, p.width, y + p.width * 0.07);
  }
  p.randomSeed(SEED);
  for (let i = 0; i < Math.floor((p.width * p.height) / 8200); i += 1) {
    const x = p.random(p.width);
    const y = p.random(p.height);
    backgroundLayer.stroke(i % 3 === 0 ? 20 : 168, i % 3 === 0 ? 58 : 32, i % 3 === 0 ? 88 : 74, 10);
    backgroundLayer.point(x, y);
  }
}

function drawBody(p) {
  const w = p.width;
  const h = p.height;
  p.push();
  p.translate(w * 0.5, h * 0.47);
  p.rotate(-0.025);
  p.noStroke();
  p.fill(205, 22, 17, 42);
  p.beginShape();
  p.curveVertex(-w * .27, -h * .38);
  p.curveVertex(-w * .27, -h * .38);
  p.curveVertex(-w * .15, -h * .48);
  p.curveVertex(w * .12, -h * .46);
  p.curveVertex(w * .27, -h * .28);
  p.curveVertex(w * .24, h * .31);
  p.curveVertex(w * .13, h * .43);
  p.curveVertex(-w * .14, h * .4);
  p.curveVertex(-w * .26, h * .2);
  p.curveVertex(-w * .27, -h * .38);
  p.curveVertex(-w * .27, -h * .38);
  p.endShape();
  p.noFill();
  p.stroke(168, 30, 65, 35);
  p.strokeWeight(1.3);
  p.beginShape();
  p.curveVertex(-w * .2, -h * .32);
  p.curveVertex(-w * .2, -h * .32);
  p.curveVertex(w * .03, -h * .39);
  p.curveVertex(w * .2, -h * .18);
  p.curveVertex(w * .18, h * .22);
  p.curveVertex(w * .04, h * .35);
  p.curveVertex(-w * .17, h * .24);
  p.curveVertex(-w * .2, -h * .32);
  p.endShape();
  p.pop();
}

function drawGrain(p) {
  const w = p.width;
  const h = p.height;
  p.push();
  p.noFill();
  for (let i = 0; i < 17; i += 1) {
    const y = h * (.18 + i * .038);
    const drift = Math.sin(i * 1.7 + p.frameCount * .008) * (reducedMotion ? 0 : 3);
    p.stroke(i % 3 === 0 ? 43 : 168, i % 3 === 0 ? 55 : 30, i % 3 === 0 ? 92 : 78, i % 3 === 0 ? 20 : 12);
    p.strokeWeight(i % 4 === 0 ? 1.3 : .55);
    p.bezier(w * .18, y + drift, w * .34, y - 26, w * .65, y + 22, w * .82, y - 2 + drift);
  }
  p.pop();
}

function drawContour(p, rx, ry, phase, index, scale = 1) {
  const segments = 14;
  p.beginShape();
  for (let i = 0; i <= segments + 2; i += 1) {
    const a = ((i - 1) / segments) * p.TWO_PI;
    const wobble = 1 + 0.055 * Math.sin(a * 3 + phase * p.TWO_PI + index * .7);
    p.curveVertex(Math.cos(a) * rx * scale * wobble, Math.sin(a) * ry * scale * (1 + .04 * Math.cos(a * 2 + index)));
  }
  p.endShape(p.CLOSE);
}

function drawChannel(p, channel, active) {
  const position = channelPosition(channel);
  const unit = Math.min(p.width, p.height);
  const rx = Math.max(31, channel.width * unit * .68);
  const ry = Math.max(54, channel.height * unit * .47);
  const [hue, saturation, brightness] = toneFor(channel.index);
  const recast = channel.state === 'recast';
  const activeLoad = active && field.pressure ? field.pressure.pressure : 0;

  p.push();
  p.translate(position.x, position.y);
  p.rotate(channel.angle + (activeLoad * .08));
  p.noStroke();
  p.fill(205, 26, 5, 52);
  drawContour(p, rx * 1.12, ry * 1.06, channel.phase, channel.index, 1);
  p.fill(hue, saturation, brightness, recast ? 82 : 68);
  drawContour(p, rx, ry, channel.phase, channel.index, 1);
  p.noFill();
  p.stroke(hue, Math.min(82, saturation + 16), Math.min(98, brightness + 10), recast ? 88 : 67);
  p.strokeWeight(recast ? 2.2 : 1.25);
  drawContour(p, rx, ry, channel.phase, channel.index, .9);

  for (let i = 1; i <= channel.contours; i += 1) {
    const scale = .82 - i * .065;
    p.stroke(205, 18, 88, recast ? 56 : 32);
    p.strokeWeight(i === channel.contours ? 1.2 : .65);
    drawContour(p, rx, ry, channel.phase + i * .11, channel.index + i, Math.max(.42, scale));
  }

  const grainCount = Math.floor(5 + channel.density * 12);
  p.stroke(hue, Math.min(70, saturation + 8), 100, recast ? 62 : 28);
  p.strokeWeight(.55);
  for (let i = 0; i < grainCount; i += 1) {
    const gx = -rx * .65 + ((i * 1.73 + channel.phase * 7) % 1) * rx * 1.3;
    const gy = Math.sin(i * 1.9 + channel.phase * 5) * ry * .5;
    p.line(gx, gy, gx + rx * .14, gy - ry * .1);
  }

  if (recast) {
    p.noFill();
    p.stroke(20, 62, 96, 78);
    p.strokeWeight(1.4);
    for (let i = 0; i < 3; i += 1) {
      p.arc(0, 0, rx * (1.48 + i * .14), ry * (1.35 + i * .1), -1.2 + i * .4, 1.15 + i * .5);
    }
    p.stroke(43, 70, 98, 72);
    p.line(-rx * .58, ry * .15, rx * .48, -ry * .28);
  }
  p.pop();
}

function drawPressureTrace(p) {
  if (!pointer.active || pointer.points.length < 2) return;
  p.push();
  p.noFill();
  p.stroke(43, 55, 98, 76);
  p.strokeWeight(1.5);
  p.beginShape();
  for (const point of pointer.points) p.vertex(point.x, point.y);
  p.endShape();
  p.stroke(20, 55, 100, 32);
  p.strokeWeight(5);
  const first = pointer.points[0];
  const last = pointer.points.at(-1);
  p.line(first.x, first.y, last.x, last.y);
  p.pop();
}

function renderArtwork(p) {
  p.image(backgroundLayer, 0, 0);
  drawGrain(p);
  drawBody(p);

  const ordered = [...field.channels].sort((a, b) => a.y - b.y);
  for (const channel of ordered) drawChannel(p, channel, channel.index === selectedChannel && Boolean(field.pressure));
  drawPressureTrace(p);

  p.push();
  p.noFill();
  p.stroke(168, 35, 88, 34);
  p.strokeWeight(1);
  p.line(p.width * .5, p.height * .1, p.width * .5, p.height * .2);
  p.line(p.width * .5, p.height * .8, p.width * .5, p.height * .9);
  p.stroke(43, 55, 92, 24);
  p.line(p.width * .2, p.height * .89, p.width * .8, p.height * .89);
  p.pop();
}

renderer = new window.p5((p) => {
  p.setup = () => {
    const canvas = p.createCanvas(Math.max(320, hostNode.clientWidth), Math.max(500, hostNode.clientHeight));
    canvas.parent(hostNode);
    canvasNode = canvas;
    canvas.attribute('aria-hidden', 'true');
    canvas.addClass('pressure-p5-canvas');
    p.pixelDensity(1);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.randomSeed(SEED);
    p.noiseSeed(SEED);
    createBackdrop(p);
    renderStatus();
    window.__mutinePortraitV043 = {
      ALIGNMENT_THRESHOLD,
      CHANNEL_COUNT,
      MEMORY_LIMIT,
      RESISTANCE_THRESHOLD,
      TRAVEL_THRESHOLD,
      SEED,
      getState: () => JSON.parse(JSON.stringify(field)),
      geometrySignature: () => geometrySignature(field),
      loadPressure,
      commitPressure,
      press: pressSelected,
      lift,
      release,
      getSelected: () => selectedChannel,
      context: stageNode,
      canvas: canvas.elt
    };
    if (staticMode) p.noLoop();
  };
  p.draw = () => renderArtwork(p);
  p.windowResized = () => {
    p.resizeCanvas(Math.max(320, hostNode.clientWidth), Math.max(500, hostNode.clientHeight));
    createBackdrop(p);
    if (staticMode) p.redraw();
  };
});

renderStatus();
