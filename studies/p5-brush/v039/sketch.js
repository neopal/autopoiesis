import {
  applyRemoval,
  buildFrame,
  buildTimeline,
  commitLoop,
  geometrySignature,
  liftLatest,
  previewLoop,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#wound-field');
const svg = document.querySelector('#wound-svg');
const surfaceShadowLayer = document.querySelector('#surface-shadow-layer');
const channelLayer = document.querySelector('#channel-layer');
const surfaceLayer = document.querySelector('#surface-layer');
const contourLayer = document.querySelector('#contour-layer');
const basinLayer = document.querySelector('#basin-layer');
const traceLayer = document.querySelector('#trace-layer');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const staticMode = params.get('static') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TONES = ['#d9dfbd', '#df7656', '#82b3a6', '#d4bd78', '#9f8eae'];

let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let trace = [];
let drawing = false;

function pathData(points, close = true) {
  if (!points?.length) return '';
  const commands = points.map((point, index) => `${index ? 'L' : 'M'} ${(point.x * 1000).toFixed(2)} ${(point.y * 700).toFixed(2)}`);
  return `${commands.join(' ')}${close ? ' Z' : ''}`;
}

function lineData(points) {
  return pathData(points, false);
}

function tone(index) {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length];
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The field is intact. Nothing has been removed.',
    'loop-preview': 'The loop is only a pressure trace. Close it to make an absence.',
    'loop-refused-open': 'The loop stayed open. The field refuses an incomplete removal.',
    'loop-refused-small': 'The loop was too small to become a wound.',
    'wound-committed': 'A chamber is gone. The contour field is suturing around it.',
    lifted: 'The latest wound has been lifted. The earlier field returns exactly.',
    'lift-refused': 'Nothing is missing enough to lift.',
    released: 'The field returns to its intact pressure.',
    timeline: 'Reduced motion settles the remembered absences.'
  };
  return messages[interaction] || 'The material is listening for a closed absence.';
}

function renderSvg() {
  const holes = frame.basins.filter((basin) => basin.removed).map((basin) => pathData(basin.points)).join(' ');
  const surfacePath = `${pathData(frame.surface)} ${holes}`;
  surfaceShadowLayer.innerHTML = `<path class="surface-shadow" d="${pathData(frame.surface)}"/>`;
  channelLayer.innerHTML = frame.channels.map((channel) => `<path class="channel-line" data-suture="${channel.suture.toFixed(2)}" d="${lineData(channel.points)}" style="--channel-tone:${tone(channel.id + 2)};--channel-width:${(channel.width * 1.6).toFixed(2)}"/>`).join('');
  surfaceLayer.innerHTML = `<path class="surface-body" d="${surfacePath}" fill-rule="evenodd"/><path class="surface-rim" d="${pathData(frame.surface)}"/>`;
  contourLayer.innerHTML = frame.contours.map((contour) => `<path class="contour-line" data-wound="${contour.wound.toFixed(2)}" d="${pathData(contour.points)}" style="--contour-tone:${tone(contour.tone)};--contour-width:${contour.width.toFixed(2)}"/>`).join('');
  basinLayer.innerHTML = frame.basins.map((basin) => {
    if (basin.removed) {
      return `<path class="wound-hole" d="${pathData(basin.points)}" style="--wound-tone:${tone(basin.id + 1)}"/><path class="wound-rim" d="${pathData(basin.points)}"/><path class="wound-glow" d="${pathData(basin.points)}"/>`;
    }
    return `<path class="basin-pocket" d="${pathData(basin.points)}" style="--pocket-tone:${tone(basin.tone)};--pocket-shore:${basin.shore.toFixed(2)}"/>`;
  }).join('');
  traceLayer.innerHTML = trace.length > 1 ? `<polyline class="pressure-trace" points="${trace.map((point) => `${(point.x * 1000).toFixed(2)},${(point.y * 700).toFixed(2)}`).join(' ')}"/>` : '';
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  trace = frame.pending.trace;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${String(13).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'pressured field' : 'intact field'} · ${frame.memory.length} wound${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  svg.dataset.memory = String(frame.memory.length);
  renderSvg();
}

function pointFromEvent(event) {
  const rect = svg.getBoundingClientRect();
  return {
    x: Math.min(0.98, Math.max(0.02, (event.clientX - rect.left) / rect.width)),
    y: Math.min(0.98, Math.max(0.02, (event.clientY - rect.top) / rect.height))
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function beginTrace(event) {
  if (staticMode || event.target.closest('button, a')) return;
  drawing = true;
  trace = [pointFromEvent(event)];
  field.setPointerCapture?.(event.pointerId);
  renderFrame(previewLoop(frame, trace));
}

function moveTrace(event) {
  if (!drawing || staticMode) return;
  const point = pointFromEvent(event);
  if (distance(point, trace.at(-1)) < 0.008) return;
  trace.push(point);
  renderFrame(previewLoop(frame, trace));
}

function endTrace(event) {
  if (!drawing || staticMode) return;
  drawing = false;
  const point = pointFromEvent(event);
  if (distance(point, trace.at(-1)) >= 0.004) trace.push(point);
  field.releasePointerCapture?.(event.pointerId);
  renderFrame(commitLoop(frame, trace, 'visitor-closed-loop'));
}

function performControlRemoval() {
  if (staticMode) return;
  renderFrame(applyRemoval(frame, 2, 'control-removal', [
    { x: 0.59, y: 0.16 }, { x: 0.72, y: 0.20 }, { x: 0.78, y: 0.30 },
    { x: 0.70, y: 0.36 }, { x: 0.58, y: 0.30 }, { x: 0.59, y: 0.16 }
  ], 0.031));
}

function downloadSource() {
  const blob = new Blob([document.documentElement.outerHTML], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mutine-brush-v039.html';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function bindControls() {
  field?.addEventListener('pointerdown', beginTrace);
  field?.addEventListener('pointermove', moveTrace);
  field?.addEventListener('pointerup', endTrace);
  field?.addEventListener('pointercancel', endTrace);
  document.querySelector('[data-gesture="remove"]')?.addEventListener('click', performControlRemoval);
  document.querySelector('[data-gesture="lift"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(liftLatest(frame)); });
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => { if (!staticMode) renderFrame(releaseField(frame)); });
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlRemoval();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (!staticMode) renderFrame(liftLatest(frame));
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      if (!staticMode) renderFrame(releaseField(frame));
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      downloadSource();
    }
  });
}

bindControls();
renderFrame(frame);
window._p5Ready = true;
window.__mutineBrushV039 = {
  getFrame: () => frame,
  geometrySignature: () => geometrySignature(frame),
  preview: (points) => renderFrame(previewLoop(frame, points)),
  commit: (points) => renderFrame(commitLoop(frame, points, 'api-closed-loop')),
  remove: performControlRemoval,
  lift: () => renderFrame(liftLatest(frame)),
  release: () => renderFrame(releaseField(frame)),
  ready: true
};
