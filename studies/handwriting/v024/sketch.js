import {
  PORT_COUNT,
  STAGES,
  buildFrame,
  commitPressure,
  geometrySignature,
  liftLatestPressure
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = staticPreview || reducedMotion;
const field = document.querySelector('#pressure-field');
const mount = document.querySelector('#canvas-mount');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const pressControl = document.querySelector('#press-margin');
const liftControl = document.querySelector('#lift-pressure');
const releaseControl = document.querySelector('#release-pressure');
const timeline = Array.from({ length: STAGES }, (_, stage) => buildFrame(stage, []));
const DEFAULT_PORT = 4;

let currentFrame = timeline[0];
let interactionFrame = null;
let pointer = { x: 0.5, y: 0.5, active: false };
let phase = 0;
let instance = null;
let grain = [];

function setState(frame, state = frame.interaction) {
  currentFrame = frame;
  if (stageReadout) stageReadout.textContent = state === 'pressure-committed' ? `material field / pressure ${String(frame.material.pressureCount).padStart(2, '0')}` : state === 'pressure-lifted' ? 'material field / latest lifted' : 'material field / quiet';
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure${frame.memory.length === 1 ? '' : 's'} · resistance ${frame.material.resistance.toFixed(2)}`;
  if (interactionState) interactionState.textContent = state === 'pressure-committed'
    ? 'The field was pressed; downstream words carry the force.'
    : state === 'pressure-lifted'
      ? 'The latest pressure is gone; the preceding field is exact again.'
      : 'The sentence is quiet.';
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.resistance = frame.material.resistance.toFixed(4);
  field.dataset.interaction = state;
  if (liftControl) liftControl.disabled = !interactionFrame || interactionFrame.memory.length === 0;
  if (pressControl) pressControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
}

function portAt(x, y) {
  const frame = interactionFrame || currentFrame;
  let nearest = 0;
  let distance = Infinity;
  frame.tokens.forEach((token, index) => {
    const dx = token.x - x;
    const dy = token.y - y;
    const candidate = dx * dx + dy * dy;
    if (candidate < distance) {
      distance = candidate;
      nearest = Math.round((index / (frame.tokens.length - 1)) * (PORT_COUNT - 1));
    }
  });
  return Math.max(0, Math.min(PORT_COUNT - 1, nearest));
}

function commit(port = DEFAULT_PORT) {
  if (staticPreview) return false;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  const next = commitPressure(baseline, { port });
  interactionFrame = next;
  setState(next, next.interaction);
  return true;
}

function lift() {
  if (staticPreview || !interactionFrame || interactionFrame.memory.length === 0) return false;
  interactionFrame = liftLatestPressure(interactionFrame);
  setState(interactionFrame, 'pressure-lifted');
  return true;
}

function release() {
  if (staticPreview) return;
  interactionFrame = null;
  setState(timeline[0], 'sequence');
}

function drawBackground(p) {
  const ctx = p.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, p.width, p.height);
  gradient.addColorStop(0, '#0b1420');
  gradient.addColorStop(.48, '#14283a');
  gradient.addColorStop(1, '#091019');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, p.width, p.height);
  p.noStroke();
  p.fill(127, 201, 198, 12);
  p.ellipse(p.width * (.5 + Math.sin(phase * .16) * .04), p.height * .45, p.width * .86, p.height * .78);
  p.fill(240, 139, 98, 9);
  p.ellipse(p.width * .3, p.height * (.54 + Math.cos(phase * .11) * .025), p.width * .48, p.height * .64);
  p.stroke(233, 226, 207, 18);
  p.strokeWeight(1);
  for (let index = 1; index < 9; index += 1) {
    const y = (index / 9) * p.height;
    p.line(p.width * .055, y, p.width * .945, y + Math.sin(index * 1.8) * 5);
  }
  p.noStroke();
  grain.forEach((point) => {
    p.fill(point.color[0], point.color[1], point.color[2], point.alpha);
    p.circle(point.x * p.width, point.y * p.height, point.size);
  });
}

function drawMaterial(p, frame) {
  const tokens = frame.tokens;
  p.push();
  p.noFill();
  p.stroke(127, 201, 198, 46);
  p.strokeWeight(Math.max(1, p.width * .001));
  p.beginShape();
  tokens.forEach((token, index) => {
    const wobble = frozen ? 0 : Math.sin(phase * .9 + index * .32) * 2.2;
    p.curveVertex(token.x * p.width + wobble, token.y * p.height);
  });
  p.endShape();
  p.pop();

  tokens.forEach((token, index) => {
    const x = token.x * p.width;
    const y = token.y * p.height;
    const breathing = frozen ? 1 : 1 + Math.sin(phase * .8 + index * .43) * .012;
    const residue = Math.min(1, token.residue / 4.6);
    const palette = token.role === 'anchor' ? [240, 139, 98] : token.role === 'reply' ? [127, 201, 198] : token.role === 'bent' ? [224, 189, 115] : token.role === 'settled' ? [152, 139, 209] : [233, 226, 207];
    p.push();
    p.translate(x, y);
    p.rotate((token.angle * Math.PI) / 180);
    p.scale(token.scale * breathing);
    p.textAlign(p.CENTER, p.CENTER);
    p.textFont('Georgia');
    p.textStyle(p.BOLD);
    p.textSize(Math.min(p.width * .064, p.height * .102) * (0.82 + token.weight * .18));
    p.drawingContext.shadowBlur = 18 + residue * 30;
    p.drawingContext.shadowColor = `rgba(${palette[0]}, ${palette[1]}, ${palette[2]}, ${.18 + residue * .2})`;
    p.fill(palette[0], palette[1], palette[2], 238);
    p.text(token.text, 0, 0);
    p.drawingContext.shadowBlur = 0;
    p.noFill();
    p.stroke(palette[0], palette[1], palette[2], 34 + residue * 80);
    p.strokeWeight(1.1 + residue * 2);
    p.arc(0, 0, p.textWidth(token.text) * 1.24, p.textSize() * 1.45, -Math.PI * .72, Math.PI * .44);
    p.pop();
  });

  const fieldMax = Math.max(...frame.material.field, 0);
  if (fieldMax > 0) {
    frame.material.field.forEach((value, index) => {
      if (value <= 0) return;
      const y = p.height * (.12 + index / (PORT_COUNT - 1) * .76);
      const radius = Math.min(p.width * .18, 24 + value * 15);
      p.noFill();
      p.stroke(240, 139, 98, Math.min(80, 18 + value * 12));
      p.strokeWeight(1);
      p.arc(p.width * .08, y, radius, radius, -.8, .8);
    });
  }
}

function redrawSketch(p) {
  p.clear();
  drawBackground(p);
  const frame = interactionFrame || (frozen ? timeline[0] : currentFrame);
  drawMaterial(p, frame);
}

function updatePointer(event) {
  if (!instance || !mount) return;
  const rect = mount.getBoundingClientRect();
  pointer.x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  pointer.y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
}

function keydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(DEFAULT_PORT);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
}

field.addEventListener('pointermove', updatePointer);
field.addEventListener('pointerdown', (event) => {
  if (staticPreview || event.target.closest('button')) return;
  updatePointer(event);
  pointer.active = true;
  field.focus({ preventScroll: true });
  commit(portAt(pointer.x, pointer.y));
});
field.addEventListener('pointerup', () => { pointer.active = false; });
field.addEventListener('keydown', keydown);
pressControl.addEventListener('click', () => commit(DEFAULT_PORT));
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

instance = new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.randomSeed(0x48574924);
    p.noiseSeed(0x48574924);
    const width = Math.max(280, mount.clientWidth || 800);
    const height = Math.max(280, mount.clientHeight || 560);
    p.createCanvas(width, height);
    p.frameRate(30);
    p.textLeading(1);
    grain = Array.from({ length: 420 }, () => ({
      x: p.random(),
      y: p.random(),
      size: p.random(.35, 1.7),
      alpha: p.random(8, 28),
      color: p.random() > .68 ? [240, 139, 98] : [233, 226, 207]
    }));
    setState(currentFrame, 'sequence');
    window._p5Ready = true;
  };
  p.draw = () => {
    phase = frozen ? 0 : p.millis() * .001;
    redrawSketch(p);
  };
  p.mousePressed = () => false;
  p.windowResized = () => {
    if (!mount) return;
    p.resizeCanvas(Math.max(280, mount.clientWidth), Math.max(280, mount.clientHeight));
  };
}, mount);

window.__mutineHandwritingV024 = {
  getState: () => ({ memory: currentFrame.memory.length, resistance: currentFrame.material.resistance, interaction: currentFrame.interaction }),
  getSignature: () => geometrySignature(currentFrame),
  commitDefault: () => commit(DEFAULT_PORT),
  commitPort: (port) => commit(port),
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
