import {
  SEED,
  STAGES,
  buildTimeline,
  buildFrame,
  commitPressure,
  liftLatestPressure,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const field = document.querySelector('#countertype-field');
const svg = document.querySelector('#countertype-svg');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const pressControl = document.querySelector('#press-type-control');
const liftControl = document.querySelector('#lift-pressure');
const releaseControl = document.querySelector('#release-pressure');
const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_PATH = [
  { x: 0.11, y: 0.21 },
  { x: 0.35, y: 0.32 },
  { x: 0.61, y: 0.48 },
  { x: 0.86, y: 0.69 }
];
const palette = {
  paper: '#efe8db',
  quietStone: ['#c6b9a2', '#d2c6b3', '#b8aa93'],
  seam: '#6d716d',
  ink: '#1b2025',
  oxide: '#c85843',
  blue: '#3b6684'
};

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = buildFrame(0, []);
let pointerPath = [];
let pointerActive = false;
let p5Instance = null;
let canvasElement = null;
const timeline = buildTimeline(STAGES);
const STAGE_MS = 3600;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function svgElement(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
  return node;
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(path) {
  return path.reduce((total, point, index) => index === 0 ? 0 : total + pointDistance(point, path[index - 1]), 0);
}

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function renderSvg(frame) {
  svg.replaceChildren();
  svg.append(svgElement('rect', { x: 0, y: 0, width: 1000, height: 700, fill: palette.paper, 'fill-opacity': 0.35 }));
  const topRule = svgElement('path', { d: 'M 92 102 H 906', fill: 'none', stroke: palette.seam, 'stroke-opacity': 0.22, 'stroke-width': 1.1 });
  const bottomRule = svgElement('path', { d: 'M 92 596 H 906', fill: 'none', stroke: palette.seam, 'stroke-opacity': 0.22, 'stroke-width': 1.1 });
  svg.append(topRule, bottomRule);

  frame.glyphs.forEach((glyph, index) => {
    const group = svgElement('g', {
      class: `stone-group is-${glyph.role}`,
      transform: `translate(${(glyph.x * 1000).toFixed(2)} ${(glyph.y * 700).toFixed(2)}) rotate(${(glyph.rotation * 57.2958).toFixed(2)}) scale(${glyph.scaleX.toFixed(3)} ${glyph.scaleY.toFixed(3)})`
    });
    const points = glyph.stone.map(([x, y]) => `${(x * 47).toFixed(2)},${(y * 49).toFixed(2)}`).join(' ');
    const stone = svgElement('polygon', {
      class: 'stone',
      points,
      fill: palette.quietStone[(index + frame.stage) % palette.quietStone.length],
      'fill-opacity': glyph.yielded ? 0.94 : 0.68
    });
    const letter = svgElement('text', { class: 'letter', x: 0, y: 1 });
    letter.textContent = glyph.char;
    group.append(stone, letter);
    svg.append(group);
  });

  if (pointerActive && pointerPath.length > 1) {
    const d = pointerPath.map((point, index) => `${index === 0 ? 'M' : 'L'} ${(point.x * 1000).toFixed(2)} ${(point.y * 700).toFixed(2)}`).join(' ');
    svg.append(svgElement('path', { d, fill: 'none', stroke: palette.oxide, 'stroke-width': 3, 'stroke-opacity': 0.58, 'stroke-linecap': 'round', 'stroke-dasharray': '5 12' }));
  }
}

function updateReadout(frame, state = 'sequence') {
  const stageText = state === 'pressure-committed'
    ? 'pressure committed / word retyped'
    : state === 'pressure-lifted'
      ? 'latest pressure lifted'
      : state === 'pressure-refused'
        ? 'short pressure refused'
        : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (stageReadout) stageReadout.textContent = stageText;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} pressure${frame.memory.length === 1 ? '' : 's'} · resistance ${frame.resistance.toFixed(2)}`;
  if (interactionState) interactionState.textContent = state === 'pressure-committed'
    ? 'The crossed letters yielded; a distant word now carries the pressure.'
    : state === 'pressure-lifted'
      ? 'The latest pressure is gone; the preceding sentence is exact again.'
      : state === 'pressure-refused'
        ? 'A tap cannot change the word. Travel is the cause.'
        : 'The word is unpressed.';
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.resistance = frame.resistance.toFixed(3);
  field.dataset.interaction = state;
  if (liftControl) liftControl.disabled = !interactionFrame || interactionFrame.memory.length === 0;
  if (pressControl) pressControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
}

function drawAtmosphere(p, width, height, now) {
  p.background(228, 221, 207);
  p.noStroke();
  for (let band = 0; band < 22; band += 1) {
    const amount = band / 21;
    const breath = frozen ? 0 : Math.sin(now * 0.0004 + band * 0.7) * 3;
    p.fill(214 + amount * 16, 204 + amount * 14, 184 + amount * 12, 9);
    p.rect(0, amount * height + breath, width, height / 18 + 4);
  }
  p.fill(74, 80, 82, 10);
  for (let index = 0; index < 240; index += 1) {
    const x = ((Math.sin(index * 19.17 + 0.4) * 43758.5453) % 1 + 1) % 1 * width;
    const y = ((Math.sin(index * 71.31 + 2.8) * 19341.114) % 1 + 1) % 1 * height;
    p.circle(x, y, 0.6 + (index % 4) * 0.34);
  }
}

function render(p, frame, state = 'sequence', now = performance.now()) {
  drawAtmosphere(p, p.width, p.height, now);
  renderSvg(frame);
  updateReadout(frame, state);
}

function pointFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) / Math.max(1, rect.width)), y: clamp((event.clientY - rect.top) / Math.max(1, rect.height)) };
}

function redraw(state = interactionFrame?.interaction ?? 'sequence') {
  currentFrame = activeFrameAt(performance.now());
  render(p5Instance, currentFrame, state);
}

function commit(path = DEFAULT_PATH, touchedIndices = null) {
  if (staticPreview) return false;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  const next = commitPressure(baseline, { path, touchedIndices: touchedIndices ?? undefined, force: 0.84 });
  interactionFrame = next;
  currentFrame = next;
  pointerPath = [];
  redraw(next.interaction);
  return next.interaction === 'pressure-committed';
}

function lift() {
  if (!interactionFrame || interactionFrame.memory.length === 0 || staticPreview) return false;
  interactionFrame = liftLatestPressure(interactionFrame);
  currentFrame = interactionFrame;
  redraw('pressure-lifted');
  return true;
}

function release() {
  if (staticPreview) return;
  interactionFrame = null;
  pointerPath = [];
  startedAt = performance.now();
  currentFrame = timeline[0];
  redraw('sequence');
}

function onPointerDown(event) {
  if (staticPreview || event.target.closest('button')) return;
  pointerActive = true;
  pointerPath = [pointFromEvent(event)];
  field.setPointerCapture?.(event.pointerId);
  render(p5Instance, currentFrame, 'pressure-armed');
}

function onPointerMove(event) {
  if (!pointerActive || event.target.closest('button')) return;
  pointerPath.push(pointFromEvent(event));
  render(p5Instance, currentFrame, 'pressure-armed');
}

function onPointerUp(event) {
  if (!pointerActive) return;
  pointerActive = false;
  field.releasePointerCapture?.(event.pointerId);
  const path = pointerPath;
  pointerPath = [];
  const didCommit = pathLength(path) >= 0.12;
  if (didCommit) commit(path);
  else {
    interactionFrame = commitPressure(interactionFrame || currentFrame, { path });
    currentFrame = interactionFrame;
    redraw(interactionFrame.interaction);
  }
}

function onKeyDown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(DEFAULT_PATH, [1, 8, 13]);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  } else if (event.key.toLowerCase() === 's' && p5Instance) {
    event.preventDefault();
    p5Instance.saveCanvas('mutine-handwriting-v022', 'png');
  }
}

field.addEventListener('pointerdown', onPointerDown);
field.addEventListener('pointermove', onPointerMove);
field.addEventListener('pointerup', onPointerUp);
field.addEventListener('pointercancel', onPointerUp);
field.addEventListener('keydown', onKeyDown);
pressControl.addEventListener('click', () => commit(DEFAULT_PATH, [1, 8, 13]));
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

p5Instance = new p5((p) => {
  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(Math.max(1, field.clientWidth), Math.max(1, field.clientHeight));
    p.canvas.id = 'material-canvas';
    p.canvas.setAttribute('aria-hidden', 'true');
    p.canvas.style.pointerEvents = 'none';
    field.prepend(p.canvas);
    p.colorMode(p.RGB, 255, 255, 255, 255);
    p.noiseSeed(SEED);
    p.randomSeed(SEED);
    if (frozen) p.noLoop();
    render(p, activeFrameAt(), 'sequence');
    window.__mutineHandwritingV022 = {
      getState: () => ({ memory: currentFrame.memory.length, resistance: currentFrame.resistance, interaction: currentFrame.interaction, stage: currentFrame.stage }),
      getSignature: () => geometrySignature(currentFrame),
      commitDefault: () => commit(DEFAULT_PATH, [1, 8, 13]),
      liftLatest: lift,
      release,
      getFrame: () => currentFrame
    };
    window._p5Ready = true;
  };
  p.draw = () => {
    if (pointerActive || interactionFrame) return;
    currentFrame = activeFrameAt(performance.now());
    render(p, currentFrame, 'sequence', performance.now());
  };
  p.windowResized = () => {
    p.resizeCanvas(Math.max(1, field.clientWidth), Math.max(1, field.clientHeight));
    render(p, currentFrame, currentFrame.interaction);
  };
}, field);
