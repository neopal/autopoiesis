import {
  STAGES,
  buildTimeline,
  buildFrame,
  registerTurn,
  liftLatestTurn
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 4800;

const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const turnControl = document.querySelector('#turn-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const rack = document.querySelector('#rack');

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];

const palette = {
  ground: '#0d1110',
  deep: '#060908',
  ink: '#e7e0cf',
  copper: '#d88957',
  ochre: '#e9bc70',
  blue: '#7ba9a4',
  mauve: '#b67387',
  shadow: '#020303'
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function rgba(hex, alpha) {
  const value = hex.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

function colourFor(index, load = 0.6) {
  const colours = [palette.copper, palette.ochre, palette.blue, palette.mauve];
  const base = colours[index % colours.length];
  return base;
}

function drawGlow(p, x, y, radius, colour, alpha) {
  const context = p.drawingContext;
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(colour, alpha));
  gradient.addColorStop(1, rgba(colour, 0));
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawBackground(p, frame) {
  const context = p.drawingContext;
  const gradient = context.createRadialGradient(p.width * 0.72, p.height * 0.08, p.width * 0.02, p.width * 0.52, p.height * 0.53, p.width * 0.78);
  gradient.addColorStop(0, '#263b31');
  gradient.addColorStop(0.35, '#131d19');
  gradient.addColorStop(1, palette.deep);
  context.fillStyle = gradient;
  context.fillRect(0, 0, p.width, p.height);

  drawGlow(p, p.width * 0.17, p.height * 0.2, p.width * 0.32, palette.copper, 0.08);
  drawGlow(p, p.width * 0.81, p.height * 0.7, p.width * 0.35, palette.blue, 0.055);

  p.push();
  p.strokeWeight(Math.max(0.6, p.width * 0.00055));
  for (let line = 0; line < 18; line += 1) {
    const y = p.height * (0.12 + line * 0.047);
    p.stroke(line % 4 === 0 ? rgba(palette.blue, 0.11) : rgba(palette.ink, 0.035));
    p.noFill();
    p.beginShape();
    for (let step = 0; step <= 16; step += 1) {
      const x = p.width * (0.04 + step * 0.058);
      const drift = Math.sin(step * 0.72 + line * 0.63 + frame.stage * 0.08) * p.height * 0.008;
      p.vertex(x, y + drift);
    }
    p.endShape();
  }
  p.pop();

  p.push();
  p.noStroke();
  for (let index = 0; index < 680; index += 1) {
    const x = ((index * 83.17 + frame.stage * 5.2) % 997) / 997 * p.width;
    const y = ((index * 157.31 + 23 + frame.stage * 3.1) % 991) / 991 * p.height;
    p.fill(index % 31 === 0 ? rgba(palette.ochre, 0.14) : rgba(palette.ink, 0.024));
    p.rect(x, y, Math.max(0.6, p.width * 0.0011), Math.max(0.6, p.width * 0.0011));
  }
  p.pop();
}

function drawRail(p) {
  const x0 = p.width * 0.1;
  const x1 = p.width * 0.78;
  const y = p.height * 0.18;
  p.push();
  p.strokeCap(p.SQUARE);
  p.strokeWeight(Math.max(1.5, p.width * 0.002));
  p.stroke(rgba(palette.ink, 0.68));
  p.line(x0, y, x1, y);
  p.strokeWeight(Math.max(0.6, p.width * 0.0007));
  p.stroke(rgba(palette.blue, 0.34));
  p.line(x0, y + p.height * 0.012, x1, y + p.height * 0.012);
  p.noStroke();
  p.fill(palette.ochre);
  p.circle(x0, y, Math.max(3, p.width * 0.006));
  p.circle(x1, y, Math.max(3, p.width * 0.006));
  p.pop();
}

function drawPigmentRung(p, rung) {
  const x = rung.x * p.width;
  const top = (rung.y + 0.045) * p.height;
  const width = rung.width * p.width;
  const height = rung.height * p.height;
  const lean = rung.lean * p.width;
  const colour = colourFor(rung.index, rung.load);
  const shadow = rgba(palette.shadow, 0.72);

  p.push();
  p.translate(x, top);
  p.rotate(rung.lean * 0.28);
  p.drawingContext.shadowColor = shadow;
  p.drawingContext.shadowBlur = p.width * 0.018;
  p.drawingContext.shadowOffsetX = p.width * 0.01;
  p.drawingContext.shadowOffsetY = p.height * 0.018;

  p.noStroke();
  p.fill(rgba(colour, 0.86));
  p.beginShape();
  p.vertex(-width * 0.42, 0);
  p.bezierVertex(-width * 0.58, height * 0.23, -width * 0.34 + lean * 0.12, height * 0.74, -width * 0.1, height);
  p.bezierVertex(width * 0.16 + lean * 0.08, height * 0.94, width * 0.52, height * 0.72, width * 0.43, height * 0.03);
  p.endShape(p.CLOSE);

  p.drawingContext.shadowBlur = 0;
  p.stroke(rgba(palette.ink, 0.38));
  p.strokeWeight(Math.max(0.6, p.width * 0.0008));
  p.noFill();
  p.beginShape();
  p.vertex(-width * 0.4, 0);
  p.bezierVertex(-width * 0.21, height * 0.1, width * 0.2, height * 0.08, width * 0.4, height * 0.03);
  p.endShape();

  for (let stripe = 0; stripe < 9; stripe += 1) {
    const ratio = stripe / 8;
    p.stroke(stripe % 3 === 0 ? rgba(palette.ink, 0.22) : rgba(palette.deep, 0.18));
    p.strokeWeight(Math.max(0.45, p.width * 0.00045));
    p.beginShape();
    p.vertex(-width * 0.29 + ratio * width * 0.11, height * (0.1 + stripe * 0.018));
    p.bezierVertex(-width * 0.1, height * (0.36 + ratio * 0.12), width * 0.19, height * (0.52 + ratio * 0.08), width * 0.29 - ratio * width * 0.08, height * (0.85 + ratio * 0.08));
    p.endShape();
  }
  p.pop();

  p.push();
  p.stroke(rgba(palette.ink, 0.54));
  p.strokeWeight(Math.max(0.7, p.width * 0.00065));
  p.line(x, p.height * 0.18, x + lean * 0.34, top);
  p.pop();
}

function drawMissingRung(p, missing) {
  const x = missing.anchorX * p.width;
  const top = (missing.anchorY + 0.045) * p.height;
  const width = missing.width * p.width;
  const height = missing.height * p.height;
  p.push();
  p.stroke(rgba(palette.ochre, 0.58));
  p.strokeWeight(Math.max(0.75, p.width * 0.0007));
  p.drawingContext.setLineDash([p.width * 0.006, p.width * 0.009]);
  p.noFill();
  p.rect(x - width * 0.45, top, width * 0.9, height, p.width * 0.006);
  p.drawingContext.setLineDash([]);
  p.stroke(rgba(palette.copper, 0.26));
  p.line(x - width * 0.18, top + height * 0.16, x + width * 0.14, top + height * 0.82);
  p.pop();
}

function drawCounterweight(p, counterweight, index) {
  const x = counterweight.anchorX * p.width;
  const y = counterweight.anchorY * p.height;
  const width = counterweight.width * p.width;
  const height = counterweight.height * p.height;
  const colour = colourFor(counterweight.rungIndex, counterweight.mass);
  p.push();
  p.stroke(rgba(palette.ink, 0.44));
  p.strokeWeight(Math.max(0.6, p.width * 0.0006));
  p.line(x, p.height * 0.18, x + counterweight.lean * p.width, y - height * 0.32);
  p.translate(x, y);
  p.rotate(counterweight.lean);
  p.drawingContext.shadowColor = rgba(palette.shadow, 0.72);
  p.drawingContext.shadowBlur = p.width * 0.012;
  p.noStroke();
  p.fill(rgba(colour, 0.88));
  p.beginShape();
  p.vertex(-width * 0.52, -height * 0.3);
  p.vertex(width * 0.42, -height * 0.22);
  p.vertex(width * 0.52, height * 0.26);
  p.vertex(-width * 0.36, height * 0.42);
  p.endShape(p.CLOSE);
  p.drawingContext.shadowBlur = 0;
  p.stroke(rgba(palette.ink, 0.36));
  p.strokeWeight(Math.max(0.45, p.width * 0.00045));
  p.noFill();
  p.arc(0, 0, width * 0.68, height * 0.78, Math.PI * 0.1, Math.PI * 1.24);
  if (!visualNoFurniture) {
    p.noStroke();
    p.fill(rgba(palette.ink, 0.68));
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(Math.max(8, p.width * 0.009));
    p.text(String(index + 1).padStart(2, '0'), 0, height * 0.82);
  }
  p.pop();
}

function drawMarks(p, frame) {
  if (visualNoFurniture) return;
  p.push();
  p.noStroke();
  p.fill(rgba(palette.ink, 0.72));
  p.textFont('ui-monospace, SFMono-Regular, Menlo, monospace');
  p.textSize(Math.max(9, p.width * 0.010));
  p.text('MATERIAL / ORDINAL REGISTER', p.width * 0.065, p.height * 0.075);
  p.fill(palette.copper);
  p.text(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, p.width * 0.065, p.height * 0.93);
  p.textAlign(p.RIGHT);
  p.fill(palette.blue);
  p.text(`${frame.memory.length} GAP${frame.memory.length === 1 ? '' : 'S'} CARRIED`, p.width * 0.77, p.height * 0.93);
  p.pop();
}

function render(p, frame, state = 'sequence') {
  drawBackground(p, frame);
  drawRail(p);
  frame.missingRungs.forEach((missing) => drawMissingRung(p, missing));
  frame.rungs.forEach((rung) => drawPigmentRung(p, rung));
  frame.counterweights.forEach((counterweight, index) => drawCounterweight(p, counterweight, index));
  drawMarks(p, frame);
  if (stageReadout) stageReadout.textContent = state === 'visitor-wheel-turn'
    ? 'turn registered / the register has a gap'
    : state === 'turn-lifted'
      ? 'latest gap lifted'
      : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} gap${frame.memory.length === 1 ? '' : 's'} carried · ${frame.counterweights.length} counterweight${frame.counterweights.length === 1 ? '' : 's'}`;
  if (interactionState) interactionState.textContent = state === 'visitor-wheel-turn'
    ? 'One rung is gone; the later load has settled.'
    : state === 'turn-lifted'
      ? 'The latest absence is gone; the prior register is exact.'
      : 'The register is carrying its first load.';
  if (rack) {
    rack.dataset.stage = String(frame.stage);
    rack.dataset.memory = String(frame.memory.length);
    rack.dataset.gaps = String(frame.missingRungs.length);
    rack.dataset.interaction = state;
  }
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const withinCycle = elapsed % (STAGE_MS * timeline.length);
  return timeline[Math.floor(withinCycle / STAGE_MS)];
}

function renderCurrent(p, now = performance.now()) {
  if (interactionFrame) {
    currentFrame = interactionFrame;
    render(p, interactionFrame, interactionFrame.interaction ?? 'visitor-wheel-turn');
    return;
  }
  currentFrame = frozen ? timeline.at(-1) : frameAt(now);
  render(p, currentFrame, 'sequence');
}

function commitTurn(p, direction = 1) {
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  interactionFrame = registerTurn(baseline, { direction });
  renderCurrent(p);
}

function liftLatest(p) {
  if (!interactionFrame) return;
  interactionFrame = liftLatestTurn(interactionFrame);
  renderCurrent(p);
}

function releaseRegister(p) {
  interactionFrame = null;
  startedAt = performance.now();
  renderCurrent(p);
}

const sketch = (p) => {
  p.setup = () => {
    const bounds = rack.getBoundingClientRect();
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height), p.P2D);
    canvas.parent('rack');
    canvas.id('rack-canvas');
    canvas.elt.tabIndex = 0;
    canvas.elt.setAttribute('aria-label', 'Interactive pigment register canvas');
    renderCurrent(p);
    if (frozen) p.noLoop();
  };

  p.draw = () => renderCurrent(p, performance.now());

  p.mouseWheel = (event) => {
    if (staticPreview) return false;
    commitTurn(p, event.deltaY < 0 ? -1 : 1);
    return false;
  };

  p.keyPressed = () => {
    if (staticPreview) return false;
    if (p.keyCode === p.UP_ARROW) commitTurn(p, -1);
    if (p.keyCode === p.DOWN_ARROW) commitTurn(p, 1);
    if (p.key === 'Enter' || p.key === ' ') commitTurn(p, 1);
    if (p.keyCode === p.DELETE || p.keyCode === p.BACKSPACE) liftLatest(p);
    if (p.key && p.key.toLowerCase() === 'r') releaseRegister(p);
    if (p.key && p.key.toLowerCase() === 's') {
      p.saveCanvas('mutine-brush-v019', 'png');
    }
    return false;
  };

  p.windowResized = () => {
    const bounds = rack.getBoundingClientRect();
    p.resizeCanvas(Math.max(1, bounds.width), Math.max(1, bounds.height));
    renderCurrent(p);
  };
};

const instance = new window.p5(sketch);
turnControl?.addEventListener('click', () => commitTurn(instance, 1));
liftControl?.addEventListener('click', () => liftLatest(instance));
releaseControl?.addEventListener('click', () => releaseRegister(instance));
