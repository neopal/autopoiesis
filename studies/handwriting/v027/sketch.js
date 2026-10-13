import {
  BAND_COUNT,
  buildFrame,
  commitPressure,
  geometrySignature,
  liftLatestPressure
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loom = document.querySelector('#pressure-loom');
const mount = document.querySelector('#canvas-mount');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const pressControl = document.querySelector('#press-to-yield');
const liftControl = document.querySelector('#lift-pressure');
const releaseControl = document.querySelector('#release-pressure');

let currentFrame = buildFrame(0, []);
let lastState = 'quiet';
let pressStartedAt = 0;
let p5Instance = null;

function redraw() {
  if (p5Instance) p5Instance.redraw();
}

function setState(frame, state = 'quiet') {
  currentFrame = frame;
  lastState = state;
  const custody = frame.material.custody || '—';
  if (stageReadout) stageReadout.textContent = state === 'pressed'
    ? `loom / pressure ${String(frame.material.pressureCount).padStart(2, '0')}`
    : state === 'refused'
      ? 'loom / pressure refused'
      : state === 'lifted'
        ? 'loom / latest lifted'
        : 'loom / quiet';
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure${frame.memory.length === 1 ? '' : 's'} · custody ${custody}`;
  if (interactionState) interactionState.textContent = state === 'pressed'
    ? 'The word tightened here; space opened elsewhere.'
    : state === 'refused'
      ? 'The hold was too brief. The loom did not write.'
      : state === 'lifted'
        ? 'The latest pressure is gone; the preceding loom is exact again.'
        : 'The loom is quiet.';
  if (loom) {
    loom.dataset.stage = String(frame.stage);
    loom.dataset.memory = String(frame.memory.length);
    loom.dataset.interaction = state;
  }
  if (liftControl) liftControl.disabled = staticPreview || frame.memory.length === 0;
  if (pressControl) pressControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
  redraw();
}

function commit(duration = 0.82) {
  if (staticPreview) return false;
  const next = commitPressure(currentFrame, { duration });
  const changed = next.material.lastEvent === 'pressed';
  setState(next, changed ? 'pressed' : 'refused');
  return changed;
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  setState(liftLatestPressure(currentFrame), 'lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  setState(buildFrame(0, []), 'quiet');
  return true;
}

function normalizedHold(milliseconds) {
  return Math.max(0, Math.min(1, Number(milliseconds) / 1200));
}

function handlePointerDown(event) {
  if (staticPreview || event.target.closest('button')) return;
  pressStartedAt = performance.now();
  loom.focus({ preventScroll: true });
  if (event.pointerId !== undefined && loom.setPointerCapture) loom.setPointerCapture(event.pointerId);
}

function handlePointerUp(event) {
  if (staticPreview || event.target.closest('button') || !pressStartedAt) return;
  const duration = normalizedHold(performance.now() - pressStartedAt);
  pressStartedAt = 0;
  if (event.pointerId !== undefined && loom.releasePointerCapture) {
    try { loom.releasePointerCapture(event.pointerId); } catch (_) { /* pointer may already be released */ }
  }
  commit(duration);
}

function handleKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(0.82);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
}

function drawBackdrop(p) {
  p.background(216, 27, 8);
  for (let row = 0; row < 18; row += 1) {
    const hue = row % 3 === 0 ? 184 : 211;
    const alpha = 4 + (row % 4) * 2;
    p.noStroke();
    p.fill(hue, 26, 13 + row * 0.18, alpha);
    p.rect(0, (row / 18) * p.height, p.width, p.height / 18 + 1);
  }
  p.stroke(184, 26, 52, 18);
  p.strokeWeight(0.7);
  for (let y = p.height * 0.12; y < p.height * 0.92; y += p.height * 0.11) {
    p.line(p.width * 0.07, y, p.width * 0.93, y + Math.sin(y * 0.018) * 3);
  }
  p.stroke(44, 25, 83, 18);
  for (let x = p.width * 0.1; x < p.width * 0.94; x += p.width * 0.1) {
    p.line(x, p.height * 0.1, x + Math.cos(x * 0.02) * 5, p.height * 0.9);
  }
  p.noStroke();
  for (let index = 0; index < 160; index += 1) {
    const x = (index * 83 + 17) % Math.max(1, p.width);
    const y = (index * 47 + 31) % Math.max(1, p.height);
    const size = 0.5 + ((index * 13) % 7) * 0.16;
    p.fill(index % 2 ? 44 : 184, 20, 88, 9 + (index % 4) * 2);
    p.circle(x, y, size);
  }
}

function bandRole(frame, index) {
  const latest = frame.memory.at(-1);
  if (!latest) return 'quiet';
  if (latest.keystoneIndex === index) return 'keystone';
  if (latest.reliefIndex === index) return 'relief';
  const distance = Math.min(Math.abs(index - latest.keystoneIndex), BAND_COUNT - Math.abs(index - latest.keystoneIndex));
  return distance <= 2 ? 'nearby' : 'quiet';
}

function drawTrackedText(p, band, role, width) {
  const centerX = width / 2;
  const x = centerX + band.x * width * 0.42;
  const y = p.height * (0.5 + band.y * 0.46);
  const size = Math.max(22, Math.min(width * 0.145, p.height * 0.16) * band.scale);
  const tracking = band.tracking * size;
  const colour = role === 'keystone'
    ? p.color(12, 58, 98, 100)
    : role === 'relief'
      ? p.color(43, 34, 96, 100)
      : role === 'nearby'
        ? p.color(184, 30, 84, 76)
        : p.color(38, 15, 92, 91);
  const echo = role === 'keystone' ? 3 : role === 'relief' ? 2 : 1;

  p.push();
  p.translate(x, y);
  p.rotate(p.radians(band.slant));
  p.textFont('Georgia');
  p.textAlign(p.LEFT, p.CENTER);
  p.textSize(size);
  p.textStyle(band.weight >= 600 ? p.BOLD : p.NORMAL);
  p.noStroke();
  for (let layer = echo; layer >= 1; layer -= 1) {
    p.fill(p.hue(colour), p.saturation(colour), p.brightness(colour), 12 + layer * 5);
    let ghostX = -layer * 1.8;
    for (const character of band.text) {
      p.text(character, ghostX, layer * 1.4);
      ghostX += p.textWidth(character) + tracking;
    }
  }
  p.fill(colour);
  let cursor = 0;
  for (const character of band.text) {
    p.text(character, cursor, 0);
    cursor += p.textWidth(character) + tracking;
  }
  p.stroke(role === 'keystone' ? p.color(12, 72, 96, 54) : p.color(184, 22, 78, 20));
  p.strokeWeight(role === 'keystone' ? 1.15 : 0.45);
  p.noFill();
  p.line(0, size * 0.57, Math.max(cursor, size * 0.5), size * 0.57);
  p.pop();
}

function createSketch(p) {
  p.setup = () => {
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(320, mount.clientWidth), Math.max(420, mount.clientHeight));
    canvas.parent(mount);
    canvas.elt.setAttribute('aria-label', 'Interactive typographic pressure loom');
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noLoop();
    window._p5Ready = true;
    setState(currentFrame, 'quiet');
  };

  p.draw = () => {
    drawBackdrop(p);
    const latest = currentFrame.memory.at(-1);
    if (latest) {
      const keystoneY = p.height * (0.5 + currentFrame.bands[latest.keystoneIndex].y * 0.46);
      const reliefY = p.height * (0.5 + currentFrame.bands[latest.reliefIndex].y * 0.46);
      p.stroke(12, 62, 95, 32);
      p.strokeWeight(1.4);
      p.line(p.width * 0.08, keystoneY, p.width * 0.92, keystoneY - p.height * 0.03);
      p.stroke(43, 42, 98, 34);
      p.line(p.width * 0.08, reliefY, p.width * 0.92, reliefY + p.height * 0.025);
    }
    currentFrame.bands.forEach((band, index) => drawTrackedText(p, band, bandRole(currentFrame, index), p.width));
    p.noFill();
    p.stroke(184, 22, 78, 38);
    p.strokeWeight(1.1);
    p.rect(p.width * 0.065, p.height * 0.08, p.width * 0.87, p.height * 0.84);
  };

  p.windowResized = () => {
    p.resizeCanvas(Math.max(320, mount.clientWidth), Math.max(420, mount.clientHeight));
    redraw();
  };
}

loom.addEventListener('pointerdown', handlePointerDown);
loom.addEventListener('pointerup', handlePointerUp);
loom.addEventListener('pointercancel', () => { pressStartedAt = 0; });
loom.addEventListener('keydown', handleKey);
pressControl.addEventListener('click', () => commit(0.82));
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

p5Instance = new window.p5(createSketch);
window.__mutineHandwritingV027 = {
  getState: () => ({ memory: currentFrame.memory.length, custody: currentFrame.material.custody, interaction: lastState }),
  getSignature: () => geometrySignature(currentFrame),
  commitDefault: () => commit(0.82),
  commitPressure: (duration = 0.82) => commit(duration),
  liftLatest: lift,
  release,
  getFrame: () => currentFrame,
  isReducedMotion: () => reducedMotion
};
