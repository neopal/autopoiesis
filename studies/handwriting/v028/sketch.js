import {
  GLYPH_COUNT,
  armCounter,
  buildFrame,
  commitReply,
  liftLatestReply
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#counter-field');
const svg = document.querySelector('#counter-svg');
const glyphLayer = document.querySelector('#counter-glyphs');
const bridgeLayer = document.querySelector('#counter-bridges');
const structureLayer = document.querySelector('#counter-structure');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const offerControl = document.querySelector('#offer-counter');
const liftControl = document.querySelector('#lift-counter');
const releaseControl = document.querySelector('#release-counter');

let currentFrame = buildFrame(0, []);
let pointerSource = null;
let lastState = 'quiet';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function coordinateFromPointer(event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1000, ((event.clientX - rect.left) / rect.width) * 1000)),
    y: Math.max(0, Math.min(1000, ((event.clientY - rect.top) / rect.height) * 1000))
  };
}

function nearestGlyph(point) {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  currentFrame.glyphs.forEach((glyph, index) => {
    const dx = point.x - glyph.x * 1000;
    const dy = point.y - glyph.y * 1000;
    const distance = dx * dx + dy * dy;
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  return nearest;
}

function renderStructure() {
  structureLayer.replaceChildren();
  for (let index = 0; index < 12; index += 1) {
    const x = 92 + index * 71;
    const y = 122 + (index % 3) * 386;
    structureLayer.appendChild(svgElement('circle', { cx: x, cy: y, r: index % 2 ? 2 : 3, fill: index % 2 ? '#8bd0c8' : '#ef8e72', 'fill-opacity': '.36' }));
  }
  structureLayer.appendChild(svgElement('path', { d: 'M108 502C268 439 365 545 492 496S730 421 896 506', fill: 'none', stroke: '#f0e9dc', 'stroke-opacity': '.08', 'stroke-width': '1' }));
  structureLayer.appendChild(svgElement('path', { d: 'M112 634C280 716 386 617 528 680S768 722 892 612', fill: 'none', stroke: '#8bd0c8', 'stroke-opacity': '.1', 'stroke-width': '1' }));
}

function renderFrame() {
  glyphLayer.replaceChildren();
  bridgeLayer.replaceChildren();

  currentFrame.memory.forEach((event, index) => {
    const source = currentFrame.glyphs[event.sourceIndex];
    const target = currentFrame.glyphs[event.targetIndex];
    const relay = currentFrame.glyphs[event.relayIndex];
    const path = svgElement('path', {
      d: `M ${source.x * 1000} ${source.y * 1000} Q ${relay.x * 1000} ${relay.y * 1000} ${target.x * 1000} ${target.y * 1000}`,
      fill: 'none',
      stroke: index % 2 ? '#8bd0c8' : '#ef8e72',
      'stroke-opacity': String(0.34 - index * 0.045),
      'stroke-width': String(2.2 - index * 0.18),
      'stroke-dasharray': index % 2 ? '9 13' : '2 11'
    });
    bridgeLayer.appendChild(path);
  });

  currentFrame.glyphs.forEach((glyph, index) => {
    const role = currentFrame.material.armedSource === index ? 'armed' : glyph.counter;
    const group = svgElement('g', {
      class: `counter-glyph counter-glyph--${glyph.tone} counter-glyph--${role}`,
      'data-glyph-index': index,
      transform: `translate(${glyph.x * 1000} ${glyph.y * 1000}) rotate(${glyph.rotation})`
    });
    const echo = svgElement('text', {
      x: 8,
      y: 8,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-family': 'Arial Black, Arial, sans-serif',
      'font-size': glyph.size * 1000,
      'font-weight': glyph.weight,
      fill: 'none',
      stroke: '#f0e9dc',
      'stroke-opacity': '.08',
      'stroke-width': '2'
    });
    echo.textContent = glyph.text;
    const text = svgElement('text', {
      x: 0,
      y: 0,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-family': 'Arial Black, Arial, sans-serif',
      'font-size': glyph.size * 1000,
      'font-weight': glyph.weight,
      'letter-spacing': glyph.counter === 'open' ? '2' : '-2'
    });
    text.textContent = glyph.text;
    group.append(echo, text);
    glyphLayer.appendChild(group);
  });
}

function updateUi(frame, state = 'quiet') {
  currentFrame = frame;
  lastState = state;
  const custody = frame.material.custody || '—';
  if (stageReadout) stageReadout.textContent = state === 'armed'
    ? `field / armed ${String(frame.material.armedSource).padStart(2, '0')}`
    : state === 'replied'
      ? `field / reply ${String(frame.material.replyCount).padStart(2, '0')}`
      : state === 'refused'
        ? 'field / same gap refused'
        : state === 'lifted'
          ? 'field / latest lifted'
          : 'field / quiet';
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} repl${frame.memory.length === 1 ? 'y' : 'ies'} · custody ${custody}`;
  if (interactionState) interactionState.textContent = state === 'armed'
    ? 'The first gap is armed; it cannot answer itself.'
    : state === 'replied'
      ? 'The hollow moved: one letter closed, another opened.'
      : state === 'refused'
        ? 'Same-gap contact was refused. Cross to another letter.'
        : state === 'lifted'
          ? 'The latest reply is gone; the preceding body is exact again.'
          : 'The field is quiet.';
  field.dataset.stage = String(frame.stage);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = state;
  if (liftControl) liftControl.disabled = staticPreview || frame.memory.length === 0;
  if (offerControl) offerControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
  renderFrame();
}

function arm(source) {
  if (staticPreview) return false;
  updateUi(armCounter(currentFrame, { source }), 'armed');
  return true;
}

function reply(target) {
  if (staticPreview) return false;
  const next = commitReply(currentFrame, { target });
  const state = next.material.lastEvent === 'replied' ? 'replied' : 'refused';
  updateUi(next, state);
  return state === 'replied';
}

function defaultReply() {
  if (currentFrame.material.armedSource === null) arm((currentFrame.material.replyCount * 3 + 1) % GLYPH_COUNT);
  return reply((currentFrame.material.armedSource + 5) % GLYPH_COUNT);
}

function lift() {
  if (staticPreview || currentFrame.memory.length === 0) return false;
  updateUi(liftLatestReply(currentFrame), 'lifted');
  return true;
}

function release() {
  if (staticPreview) return false;
  updateUi(buildFrame(0, []), 'quiet');
  return true;
}

function pointerDown(event) {
  if (staticPreview || event.target.closest('button')) return;
  field.focus({ preventScroll: true });
  pointerSource = nearestGlyph(coordinateFromPointer(event));
  arm(pointerSource);
  if (event.pointerId !== undefined && field.setPointerCapture) field.setPointerCapture(event.pointerId);
}

function pointerUp(event) {
  if (staticPreview || event.target.closest('button') || pointerSource === null) return;
  const target = nearestGlyph(coordinateFromPointer(event));
  const source = pointerSource;
  pointerSource = null;
  if (event.pointerId !== undefined && field.releasePointerCapture) {
    try { field.releasePointerCapture(event.pointerId); } catch (_) { /* pointer may already be released */ }
  }
  if (target === source) {
    updateUi(commitReply(currentFrame, { target }), 'refused');
    return;
  }
  reply(target);
}

function handleKey(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    defaultReply();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
}

renderStructure();
updateUi(currentFrame, 'quiet');
field.addEventListener('pointerdown', pointerDown);
field.addEventListener('pointerup', pointerUp);
field.addEventListener('pointercancel', () => { pointerSource = null; });
field.addEventListener('keydown', handleKey);
offerControl.addEventListener('click', defaultReply);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

window._p5Ready = true;
window.__mutineHandwritingV028 = {
  getState: () => ({ memory: currentFrame.memory.length, custody: currentFrame.material.custody, interaction: lastState, armedSource: currentFrame.material.armedSource }),
  getSignature: () => JSON.stringify({ glyphs: currentFrame.glyphs, memory: currentFrame.memory }),
  armCounter: (source = 0) => arm(source),
  commitReply: (target = 7) => reply(target),
  commitDefault: defaultReply,
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
