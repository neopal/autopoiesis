import {
  applyStrike,
  applyTap,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatestStrike,
  releaseLaminate
} from './engine.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const params = new URLSearchParams(location.search);
const field = document.querySelector('#seam-field');
const svg = document.querySelector('#field');
const geometry = document.querySelector('#dynamic-geometry');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let frame = params.get('static') === '1' || reducedMotion ? buildTimeline().at(-1) : buildFrame(0, []);
let pointerDown = null;

function element(name, attributes = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

function pathFor(points) {
  return `${points.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 1000} ${point.y * 700}`).join(' ')} Z`;
}

function lineFor(points) {
  return points.map((point, index) => `${index ? 'L' : 'M'} ${point.x * 1000} ${point.y * 700}`).join(' ');
}

function centerOf(points) {
  return points.reduce((center, point) => ({ x: center.x + point.x / points.length, y: center.y + point.y / points.length }), { x: 0, y: 0 });
}

function render(nextFrame = frame) {
  frame = nextFrame;
  geometry.replaceChildren();

  const shadow = element('path', { class: 'laminate-shadow', d: pathFor(frame.slab) });
  geometry.append(shadow);

  const plateLayer = element('g', { class: 'plate-layer' });
  for (const plate of frame.plates) {
    const path = element('path', {
      class: `plate tone-${plate.tone} state-${plate.state}`,
      d: pathFor(plate.points),
      'data-plate': String(plate.id)
    });
    plateLayer.append(path);

    const highlight = element('path', { class: 'plate-highlight', d: pathFor(plate.points) });
    plateLayer.append(highlight);

    const center = centerOf(plate.points);
    for (let index = 0; index < 4; index += 1) {
      const seed = (plate.id + 1) * (index + 3) * 0.173;
      plateLayer.append(element('circle', {
        class: 'plate-speck',
        cx: (center.x * 1000 + Math.sin(seed) * 18 + index * 5).toFixed(2),
        cy: (center.y * 700 + Math.cos(seed * 1.7) * 14 - index * 4).toFixed(2),
        r: (1.4 + ((plate.id + index) % 3) * 0.65).toFixed(2)
      }));
    }
  }
  geometry.append(plateLayer);

  const seamShadow = element('path', { class: 'dry-seam-shadow', d: lineFor(frame.seam) });
  const seam = element('path', { class: 'dry-seam', d: lineFor(frame.seam) });
  geometry.append(seamShadow, seam);
  for (const point of frame.seam.filter((_, index) => index % 2 === 1)) {
    geometry.append(element('circle', { class: 'seam-notch', cx: point.x * 1000, cy: point.y * 700, r: 7 }));
  }

  stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / 13`;
  memoryReadout.textContent = `${frame.memory.length} triplet${frame.memory.length === 1 ? '' : 's'} held${frame.pending.length ? ` · ${frame.pending.length}/3 offered` : ''}`;
  const messages = {
    baseline: 'The seam is refusing the offered points.',
    'tap-armed': `${frame.pending.length}/3 knocks held in the seam.`,
    'tap-refused-drag': 'A drag is not a knock. The laminate stayed still.',
    'tap-refused-weak': 'Too slight. The laminate stayed still.',
    'tap-refused-overheld': 'The hand lingered. The laminate stayed still.',
    'triplet-committed': 'The triplet shifted a seam you did not touch.',
    'strike-lifted': 'The latest dry shift has been lifted.',
    'strike-lift-refused': 'Nothing is held to lift.',
    'memory-released': 'The laminate has released its stored shifts.',
    timeline: 'Reduced motion settles the laminate into its remembered state.'
  };
  stateReadout.textContent = messages[frame.interaction] || 'The material is holding its refusal.';
}

function svgPoint(event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.max(0.06, Math.min(0.94, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0.08, Math.min(0.92, (event.clientY - rect.top) / rect.height))
  };
}

field.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  const point = svgPoint(event);
  pointerDown = { ...point, at: performance.now() };
  field.setPointerCapture?.(event.pointerId);
});

field.addEventListener('pointerup', (event) => {
  if (!pointerDown) return;
  const point = svgPoint(event);
  const duration = Math.round(performance.now() - pointerDown.at);
  const next = applyTap(frame, {
    x: point.x,
    y: point.y,
    dx: point.x - pointerDown.x,
    dy: point.y - pointerDown.y,
    duration
  });
  pointerDown = null;
  render(next);
});

field.addEventListener('pointercancel', () => { pointerDown = null; });

document.querySelector('[data-gesture="knock"]').addEventListener('click', () => {
  render(applyStrike(frame, [
    { x: 0.22, y: 0.24, duration: 120 },
    { x: 0.55, y: 0.48, duration: 165 },
    { x: 0.78, y: 0.73, duration: 220 }
  ], 'button-triplet'));
});
document.querySelector('[data-gesture="lift"]').addEventListener('click', () => render(liftLatestStrike(frame)));
document.querySelector('[data-gesture="release"]').addEventListener('click', () => render(releaseLaminate()));

function downloadSvg() {
  const clone = svg.cloneNode(true);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-brush-v033.svg';
  link.click();
  URL.revokeObjectURL(link.href);
}

field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    document.querySelector('[data-gesture="knock"]').click();
  }
  if (event.key === 'Delete') {
    event.preventDefault();
    document.querySelector('[data-gesture="lift"]').click();
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    document.querySelector('[data-gesture="release"]').click();
  }
  if (event.key.toLowerCase() === 's') downloadSvg();
});

render(frame);
window.__mutineBrushV033 = {
  getFrame: () => frame,
  commitDemo: () => { render(applyStrike(frame, [{ x: 0.22, y: 0.24, duration: 120 }, { x: 0.55, y: 0.48, duration: 165 }, { x: 0.78, y: 0.73, duration: 220 }], 'browser-demo')); return frame; },
  lift: () => { render(liftLatestStrike(frame)); return frame; },
  release: () => { render(releaseLaminate()); return frame; },
  geometrySignature: () => geometrySignature(frame)
};
