import {
  GLYPH_COUNT,
  MEMORY_WINDOW,
  MIN_SWEEP,
  beginPressure,
  buildFrame,
  finishPressure,
  geometrySignature,
  liftLatest,
  movePressure,
  release
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG_NS = 'http://www.w3.org/2000/svg';
const field = document.querySelector('#seam-field');
const svg = document.querySelector('#sentence-svg');
const glyphLayer = document.querySelector('#glyph-layer');
const cutsLayer = document.querySelector('#seam-cuts');
const atmosphereLayer = document.querySelector('#seam-atmosphere');
const carrier = document.querySelector('#sentence-carrier');
const shadowPath = document.querySelector('#seam-shadow-path');
const pressureProbe = document.querySelector('#pressure-probe');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const defaultPairs = [
  { start: { x: -0.74, y: 0.68 }, end: { x: -0.4, y: 0.77 } },
  { start: { x: -0.34, y: 0.68 }, end: { x: 0.01, y: 0.59 } },
  { start: { x: 0.08, y: 0.62 }, end: { x: 0.42, y: 0.7 } },
  { start: { x: 0.48, y: 0.54 }, end: { x: 0.82, y: 0.46 } }
];

let frame = staticPreview ? buildFrame(defaultPairs) : buildFrame();
let activePointerId = null;
let keyboardIndex = 0;
let phase = 0;

function svgElement(name) {
  return document.createElementNS(SVG_NS, name);
}

function setAttributes(node, attributes) {
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

function pointFor(glyph) {
  return { x: 500 + glyph.x * 450, y: 310 + glyph.y * 255 };
}

function pathForGlyphs(glyphs) {
  const visible = glyphs.filter((glyph) => glyph.char.trim());
  if (!visible.length) return '';
  const points = visible.map(pointFor);
  const first = points[0];
  let d = `M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const dx = (current.x - previous.x) * 0.42;
    d += ` C ${(previous.x + dx).toFixed(2)} ${previous.y.toFixed(2)}, ${(current.x - dx).toFixed(2)} ${current.y.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }
  return d;
}

function renderAtmosphere() {
  atmosphereLayer.replaceChildren();
  for (let index = 0; index < 9; index += 1) {
    const path = svgElement('path');
    const y = 104 + index * 52;
    const bow = 16 + index * 5;
    setAttributes(path, { d: `M 44 ${y} C 240 ${y - bow}, 400 ${y + bow}, 544 ${y} S 790 ${y - bow}, 956 ${y + 2}` });
    atmosphereLayer.append(path);
  }
}

function renderGlyph(glyph) {
  if (!glyph.char.trim()) return null;
  const point = pointFor(glyph);
  const text = svgElement('text');
  const fontSize = 58 * glyph.size;
  const fontFamily = glyph.id % 4 === 0 ? 'Georgia, serif' : 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  setAttributes(text, {
    x: point.x.toFixed(2),
    y: point.y.toFixed(2),
    'font-size': fontSize.toFixed(2),
    'font-family': fontFamily,
    'font-weight': glyph.id % 5 === 0 ? 700 : 500,
    'font-style': glyph.id % 7 === 0 ? 'italic' : 'normal',
    'text-anchor': 'middle',
    'letter-spacing': (glyph.tracking * 24).toFixed(2),
    'data-glyph-id': glyph.id,
    'data-mode': glyph.mode,
    opacity: glyph.opacity,
    transform: `rotate(${(glyph.rotation * 57.2958).toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)})`
  });
  text.textContent = glyph.char;
  return text;
}

function renderCuts() {
  cutsLayer.replaceChildren();
  frame.cuts.forEach((cut) => {
    const glyph = frame.glyphs[cut.hinge];
    if (!glyph) return;
    const point = pointFor(glyph);
    const length = 26 + cut.depth * 42;
    const path = svgElement('path');
    const x = point.x + cut.direction * 2;
    setAttributes(path, { d: `M ${(x - 16).toFixed(2)} ${(point.y - length).toFixed(2)} L ${(x + 16).toFixed(2)} ${(point.y + length).toFixed(2)} M ${(x - 27).toFixed(2)} ${(point.y - length * .62).toFixed(2)} L ${(x + 27).toFixed(2)} ${(point.y + length * .62).toFixed(2)}`, 'data-event': cut.event });
    cutsLayer.append(path);
    const marker = svgElement('circle');
    setAttributes(marker, { cx: x, cy: point.y, r: 3 + cut.depth * 3, 'data-event': cut.event });
    cutsLayer.append(marker);
  });
}

function updateProbe() {
  const probe = frame.probe;
  if (!probe) {
    pressureProbe.setAttribute('d', '');
    pressureProbe.style.opacity = '0';
    return;
  }
  const start = { x: 500 + probe.start.x * 450, y: 310 + probe.start.y * 255 };
  const end = { x: 500 + probe.end.x * 450, y: 310 + probe.end.y * 255 };
  setAttributes(pressureProbe, { d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} L ${end.x.toFixed(2)} ${end.y.toFixed(2)}` });
  pressureProbe.style.opacity = frame.active ? '.8' : '0';
}

function updateStatus() {
  const label = frame.lastEvent === 'cut' ? 'seam / cut produced'
    : frame.lastEvent === 'charging' ? 'pressure / held'
      : frame.lastEvent === 'lifted' ? 'seam / latest lifted'
        : frame.lastEvent === 'refused' ? 'seam / sweep refused' : 'seam / quiet';
  if (stageReadout) stageReadout.textContent = label;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} cuts · ${GLYPH_COUNT} glyphs`;
  if (interactionState) {
    interactionState.textContent = frame.lastEvent === 'cut'
      ? `The hinge broke the line. ${frame.memory.length} ${frame.memory.length === 1 ? 'cut remains' : 'cuts remain'} in the sentence.`
      : frame.lastEvent === 'charging'
        ? 'The pressure is held. The glyphs have not moved.'
        : frame.lastEvent === 'lifted'
          ? 'The latest cut has been lifted. The preceding sentence is exact.'
          : frame.lastEvent === 'refused'
            ? 'The sentence refused that sweep. Release between the two bounds.'
            : 'The sentence is quiet. No pressure has entered the seam.';
  }
}

function render() {
  const glyphs = frame.glyphs;
  const carrierPath = pathForGlyphs(glyphs);
  carrier.setAttribute('d', carrierPath);
  shadowPath.setAttribute('d', carrierPath);
  glyphLayer.replaceChildren(...glyphs.map(renderGlyph).filter(Boolean));
  renderCuts();
  updateProbe();
  updateStatus();
  phase += reducedMotion ? 0 : 0.008;
  svg.style.setProperty('--seam-phase', phase.toFixed(3));
}

function pointerPoint(event) {
  const rect = field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
    at: performance.now()
  };
}

function setFrame(next) {
  frame = next;
  render();
}

function deterministicPair(index = keyboardIndex) {
  return defaultPairs[index % defaultPairs.length];
}

function commitDeterministic(index = keyboardIndex) {
  const pair = deterministicPair(index);
  setFrame(finishPressure(beginPressure(frame, { ...pair.start, at: performance.now() }), { ...pair.end, at: performance.now() }));
}

function lift() {
  setFrame(liftLatest(frame));
}

function reset() {
  setFrame(release());
}

field.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  field.focus({ preventScroll: true });
  activePointerId = event.pointerId;
  field.setPointerCapture?.(activePointerId);
  setFrame(beginPressure(frame, pointerPoint(event)));
});

field.addEventListener('pointermove', (event) => {
  if (activePointerId !== event.pointerId || !frame.active) return;
  setFrame(movePressure(frame, pointerPoint(event)));
});

field.addEventListener('pointerup', (event) => {
  if (activePointerId !== event.pointerId || !frame.active) return;
  setFrame(finishPressure(frame, pointerPoint(event)));
  activePointerId = null;
});

field.addEventListener('pointercancel', () => {
  activePointerId = null;
  setFrame(release());
});

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    keyboardIndex = (keyboardIndex + 1) % defaultPairs.length;
    const pair = deterministicPair(keyboardIndex);
    setFrame(beginPressure(frame, { ...pair.start, at: performance.now() }));
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault();
    keyboardIndex = (keyboardIndex - 1 + defaultPairs.length) % defaultPairs.length;
    const pair = deterministicPair(keyboardIndex);
    setFrame(beginPressure(frame, { ...pair.start, at: performance.now() }));
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.active) {
      const pair = deterministicPair(keyboardIndex);
      setFrame(finishPressure(frame, { ...pair.end, at: performance.now() }));
    } else {
      commitDeterministic();
    }
  } else if (event.key === 'Delete') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    reset();
  }
});

document.querySelector('[data-action="press"]')?.addEventListener('click', () => commitDeterministic());
document.querySelector('[data-action="lift"]')?.addEventListener('click', lift);
document.querySelector('[data-action="release"]')?.addEventListener('click', reset);
window.addEventListener('resize', render);

window.__mutineHandwritingV037 = {
  getFrame: () => frame,
  getState: () => ({ lastEvent: frame.lastEvent, memory: frame.memory.length, active: frame.active, pressure: frame.pressure }),
  getSignature: () => geometrySignature(frame),
  press: () => commitDeterministic(),
  lift,
  reset,
  release: reset
};

renderAtmosphere();
render();
window._p5Ready = true;
