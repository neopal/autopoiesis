import {
  applyPinch,
  buildFrame,
  buildTimeline,
  geometrySignature,
  liftLatest,
  releaseLayers,
  selectSeam
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const field = document.querySelector('#lamina-field');
const stack = document.querySelector('#lamina-stack');
const seamNodes = document.querySelector('#seam-nodes');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const staticMode = params.get('static') === '1' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TONES = ['bone', 'oxide', 'reed', 'ink', 'chalk'];
let frame = staticMode ? buildTimeline().at(-1) : buildFrame(0, []);
let selected = [];

function polygon(path) {
  return path.map((point) => `${(point.x * 100).toFixed(2)}% ${(point.y * 100).toFixed(2)}%`).join(', ');
}

function messageFor(interaction) {
  const messages = {
    baseline: 'The layers are held together.',
    'seam-selected': 'One boundary is carrying pressure. Choose where it leaves.',
    'seam-refused-repeat': 'The same boundary cannot make an interval.',
    'seam-refused-full': 'The stack is already holding two boundaries.',
    'pinch-refused-adjacent': 'Adjacent seams have no material span between them.',
    'pinch-committed': 'The interval opened: one layer peeled, one sealed, one shed.',
    lifted: 'The latest pressure span has been lifted.',
    'lift-refused': 'Nothing is peeled enough to lift.',
    released: 'The layers return to their quiet order.',
    timeline: 'Reduced motion settles the remembered layer order.'
  };
  return messages[interaction] || 'The stack is listening.';
}

function renderStack() {
  stack.innerHTML = frame.skins.map((skin, index) => {
    const tone = TONES[skin.tone % TONES.length];
    const holeScale = 0.30 + Math.min(0.55, skin.opening * 0.20);
    const holeWidth = 18 + holeScale * 22;
    const holeHeight = 11 + holeScale * 20;
    const depth = 5 + skin.depth * 20;
    return `<div class="lamina lamina--${tone}" data-skin="${skin.id}" style="--x:${(skin.x * 100).toFixed(2)}%;--y:${(skin.y * 100).toFixed(2)}%;--w:${(skin.width * 100).toFixed(2)}%;--h:${(skin.height * 100).toFixed(2)}%;--angle:${skin.angle.toFixed(2)}deg;--depth:${depth.toFixed(2)}px;--peel:${skin.peel.toFixed(2)};--fold:${skin.fold.toFixed(2)};clip-path:polygon(${polygon(skin.path)});z-index:${index + 2};"><span class="lamina-edge" aria-hidden="true"></span><span class="lamina-hole" aria-hidden="true" style="--hole-width:${holeWidth.toFixed(2)}%;--hole-height:${holeHeight.toFixed(2)}%;--hole-rotate:${(skin.angle * -0.55 + skin.fold * 8).toFixed(2)}deg;--hole-open:${Math.min(1, skin.opening / 1.4).toFixed(2)}"></span><span class="lamina-grain" aria-hidden="true"></span></div>`;
  }).join('');
}

function renderSeamNodes() {
  seamNodes.innerHTML = frame.seams.map((seam) => {
    const isSelected = frame.pending.seams.includes(seam.id);
    const label = isSelected ? `Seam ${seam.id + 1}, selected` : `Choose seam ${seam.id + 1}`;
    return `<button class="seam-node${isSelected ? ' is-selected' : ''}" type="button" data-seam="${seam.id}" aria-label="${label}" aria-pressed="${isSelected ? 'true' : 'false'}" style="--x:${(seam.x * 100).toFixed(2)}%;--y:${(seam.y * 100).toFixed(2)}%;--angle:${seam.angle}deg;--pressure:${Math.min(1, seam.pressure / 1.4).toFixed(2)}"><span aria-hidden="true"></span></button>`;
  }).join('');
  if (!staticMode) seamNodes.querySelectorAll('[data-seam]').forEach((button) => {
    button.addEventListener('click', () => chooseSeam(Number(button.dataset.seam)));
  });
}

function renderFrame(nextFrame = frame) {
  frame = nextFrame;
  selected = frame.pending.seams;
  if (stageReadout) stageReadout.textContent = `stage ${String(frame.stage + 1).padStart(2, '0')} / ${String(13).padStart(2, '0')}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length ? 'pressured' : 'quiet'} layers · ${frame.memory.length} pressure span${frame.memory.length === 1 ? '' : 's'}`;
  if (stateReadout) stateReadout.textContent = messageFor(frame.interaction);
  renderStack();
  renderSeamNodes();
}

function chooseSeam(index) {
  if (staticMode) return;
  if (!selected.length) {
    renderFrame(selectSeam(frame, index));
    return;
  }
  const next = applyPinch(frame, selected[0], index, 'visitor-pinch');
  renderFrame(next);
}

function performControlPinch() {
  if (staticMode) return;
  renderFrame(applyPinch(frame, 1, 5, 'control-pinch'));
}

function bindControls() {
  document.querySelector('[data-gesture="pinch"]')?.addEventListener('click', performControlPinch);
  document.querySelector('[data-gesture="lift"]')?.addEventListener('click', () => renderFrame(liftLatest(frame)));
  document.querySelector('[data-gesture="release"]')?.addEventListener('click', () => renderFrame(releaseLayers()));
  field?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      performControlPinch();
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      renderFrame(liftLatest(frame));
    }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
      event.preventDefault();
      renderFrame(releaseLayers());
    }
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      const source = document.documentElement.outerHTML;
      const blob = new Blob([source], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'mutine-brush-v038.html';
      link.click();
      URL.revokeObjectURL(link.href);
    }
  });
}

bindControls();
renderFrame(frame);
window._p5Ready = true;
window.__mutineBrushV038 = {
  getFrame: () => frame,
  geometrySignature: () => geometrySignature(frame),
  selectSeam: (index) => renderFrame(selectSeam(frame, index)),
  performPinch: performControlPinch,
  lift: () => renderFrame(liftLatest(frame)),
  release: () => renderFrame(releaseLayers()),
  ready: true
};
