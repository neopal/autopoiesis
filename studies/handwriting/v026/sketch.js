import {
  GLYPH_COUNT,
  buildFrame,
  commitDeparture,
  geometrySignature,
  liftLatestDeparture
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = staticPreview || reducedMotion;
const rack = document.querySelector('#route-rack');
const mount = document.querySelector('#canvas-mount');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const readControl = document.querySelector('#read-margin');
const liftControl = document.querySelector('#lift-departure');
const releaseControl = document.querySelector('#release-rack');

let currentFrame = buildFrame(0, []);
let armedGlyph = -1;
let lastState = 'quiet';
let p5Instance = null;

function redraw() {
  if (p5Instance) p5Instance.redraw();
}

function setState(frame, state = 'quiet') {
  currentFrame = frame;
  lastState = state;
  const custody = frame.material.custody || '—';
  if (stageReadout) stageReadout.textContent = state === 'departed' ? `rack / departure ${String(frame.material.departureCount).padStart(2, '0')}` : state === 'lifted' ? 'rack / latest lifted' : state === 'armed' ? 'rack / route armed' : 'rack / quiet';
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} departure${frame.memory.length === 1 ? '' : 's'} · custody ${custody}`;
  if (interactionState) interactionState.textContent = state === 'departed'
    ? 'The spare left here and arrived elsewhere.'
    : state === 'lifted'
      ? 'The latest custody is gone; the preceding rack is exact again.'
      : state === 'armed'
        ? 'This route has noticed you. Withdraw to make it causal.'
        : 'The rack is quiet.';
  if (rack) {
    rack.dataset.stage = String(frame.stage);
    rack.dataset.memory = String(frame.memory.length);
    rack.dataset.armedGlyph = String(armedGlyph);
    rack.dataset.interaction = state;
  }
  if (liftControl) liftControl.disabled = staticPreview || frame.memory.length === 0;
  if (readControl) readControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
  redraw();
}

function armGlyph(index) {
  if (staticPreview) return false;
  armedGlyph = Math.max(0, Math.min(GLYPH_COUNT - 1, Number(index) || 0));
  setState(currentFrame, 'armed');
  return true;
}

function commit(glyph = armedGlyph >= 0 ? armedGlyph : 3, distance = 0.84) {
  if (staticPreview) return false;
  const next = commitDeparture(currentFrame, { glyph, distance });
  armedGlyph = -1;
  setState(next, next.material.lastEvent === 'armed' ? 'armed' : 'departed');
  return next.material.lastEvent === 'departed';
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  armedGlyph = -1;
  setState(liftLatestDeparture(currentFrame), 'lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  armedGlyph = -1;
  setState(buildFrame(0, []), 'quiet');
  return true;
}

function glyphAtClientX(clientX) {
  const rect = mount.getBoundingClientRect();
  const normalized = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
  return Math.max(0, Math.min(GLYPH_COUNT - 1, Math.round(normalized * (GLYPH_COUNT - 1))));
}

function pointerMove(event) {
  if (staticPreview) return;
  const index = glyphAtClientX(event.clientX);
  if (armedGlyph < 0) {
    armGlyph(index);
    return;
  }
  const separation = Math.abs(index - armedGlyph) / (GLYPH_COUNT - 1);
  if (separation >= 0.34) {
    commit(armedGlyph, Math.min(1, 0.7 + separation));
  } else if (index !== armedGlyph) {
    armGlyph(index);
  }
}

function handleKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const next = armedGlyph < 0 ? 3 : armedGlyph + (event.key === 'ArrowRight' ? 1 : -1);
    armGlyph(Math.max(0, Math.min(GLYPH_COUNT - 1, next)));
  }
}

function drawRoute(p, route, z) {
  route.forEach(([x1, y1, x2, y2]) => p.line(x1, y1, z, x2, y2, z));
}

function routeColour(p, role) {
  if (role === 'local') return p.color(12, 72, 96, 100);
  if (role === 'reply') return p.color(78, 48, 92, 100);
  if (role === 'nearby') return p.color(188, 38, 78, 78);
  return p.color(188, 18, 88, 82);
}

function renderGlyph(p, glyph, index, role, scale) {
  const x = (index - 3) * 148 * scale + glyph.offset[0] * 420 * scale;
  const y = Math.sin((index + 1) * 0.8) * 28 * scale + glyph.offset[1] * 360 * scale;
  const z = (index - 3) * 26 * scale - 70 * scale + glyph.depth * 52 * scale;
  const rotation = glyph.rotation * Math.PI / 180;
  const colour = routeColour(p, role);
  const isArmed = index === armedGlyph;

  p.push();
  p.translate(x, y, z);
  p.rotateZ(rotation);
  p.rotateY((index - 3) * 0.06);
  p.scale(72 * scale * glyph.scale);
  p.strokeWeight((isArmed ? 2.5 : 1.5) / Math.max(scale, 0.55));
  p.noFill();
  for (let layer = 7; layer >= 0; layer -= 1) {
    const depth = (layer - 3.5) * 0.045;
    const alpha = layer === 3 ? 100 : 18;
    p.stroke(p.red(colour), p.green(colour), p.blue(colour), alpha);
    drawRoute(p, glyph.route, depth);
  }
  if (isArmed) {
    p.stroke(42, 28, 96, 76);
    p.strokeWeight(0.85 / Math.max(scale, 0.55));
    p.ellipse(0, 0, 2.55, 2.55);
  }
  p.pop();
}

function createSketch(p) {
  p.setup = () => {
    p.pixelDensity(1);
    const canvas = p.createCanvas(Math.max(320, mount.clientWidth), Math.max(420, mount.clientHeight), p.WEBGL);
    canvas.parent(mount);
    canvas.elt.setAttribute('aria-label', 'Interactive three-dimensional letter route rack');
    canvas.elt.addEventListener('pointermove', pointerMove);
    canvas.elt.addEventListener('pointerdown', () => rack.focus({ preventScroll: true }));
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noLoop();
    window._p5Ready = true;
    setState(currentFrame, 'quiet');
  };

  p.draw = () => {
    p.background(213, 32, 7);
    const scale = Math.min(p.width / 900, p.height / 600);
    const last = currentFrame.memory.at(-1);
    const active = last ? last.glyph : -1;
    const reply = last ? last.replyIndex : -1;

    p.push();
    p.rotateX(-0.12);
    p.rotateZ(-0.015);
    p.strokeWeight(0.6);
    p.stroke(188, 24, 44, 28);
    for (let y = -190; y <= 190; y += 24) p.line(-p.width * 0.52, y * scale, 150 * scale, p.width * 0.52, y * scale, 150 * scale);
    for (let x = -p.width * 0.48; x <= p.width * 0.48; x += 54) p.line(x, -210 * scale, 150 * scale, x, 210 * scale, 150 * scale);
    p.stroke(188, 16, 70, 55);
    p.strokeWeight(1.4);
    p.line(-p.width * 0.44, 132 * scale, -95 * scale, p.width * 0.44, 132 * scale, -95 * scale);
    p.line(-p.width * 0.44, -132 * scale, 78 * scale, p.width * 0.44, -132 * scale, 78 * scale);

    for (let index = 0; index < currentFrame.glyphs.length; index += 1) {
      const role = index === active ? 'local' : index === reply ? 'reply' : last && Math.abs(index - active) <= 1 ? 'nearby' : 'quiet';
      renderGlyph(p, currentFrame.glyphs[index], index, role, scale);
    }
    p.pop();
  };

  p.windowResized = () => {
    p.resizeCanvas(Math.max(320, mount.clientWidth), Math.max(420, mount.clientHeight));
    redraw();
  };
}

rack.addEventListener('keydown', handleKey);
readControl.addEventListener('click', () => commit(armedGlyph >= 0 ? armedGlyph : 3));
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

p5Instance = new window.p5(createSketch);
window.__mutineHandwritingV026 = {
  getState: () => ({ memory: currentFrame.memory.length, custody: currentFrame.material.custody, interaction: lastState, armedGlyph }),
  getSignature: () => geometrySignature(currentFrame),
  armGlyph,
  commitDefault: () => commit(3),
  commitDeparture: (glyph = 3, distance = 0.84) => commit(glyph, distance),
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
