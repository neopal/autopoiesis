import {
  GAP_LENGTH,
  GLYPH_COUNT,
  WELL_COUNT,
  buildFrame,
  commitSpan,
  geometrySignature,
  liftLatestSpan,
  loadWell,
  nearestWell,
  releaseSpan
} from './engine.mjs';

const DEFAULT_SPANS = [[0, 3], [1, 4], [0, 4], [2, 4]];
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const field = document.querySelector('#material-field');
const svg = document.querySelector('#material-svg');
const creaseLayer = document.querySelector('#crease-layer');
const glyphLayer = document.querySelector('#glyph-layer');
const wellLayer = document.querySelector('#well-layer');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const foldControl = document.querySelector('#span-control');
const liftControl = document.querySelector('#lift-span');
const releaseControl = document.querySelector('#release-span');
const wellButtons = [...document.querySelectorAll('.well-button')];

let currentFrame = staticPreview ? buildFrame(DEFAULT_SPANS) : buildFrame([]);
let lastState = staticPreview ? 'fold' : 'quiet';
let focusWell = 0;

const escapeText = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const svgPoint = (value) => Number(value.toFixed(2));

function roleLabel(state) {
  if (state === 'loading') return `material / ${currentFrame.span.length} of ${GAP_LENGTH}`;
  if (state === 'fold') return `material / fold ${String(currentFrame.history.length).padStart(2, '0')}`;
  if (state === 'refused') return 'material / refused';
  if (state === 'lifted') return 'material / latest lifted';
  if (state === 'released') return 'material / released';
  return 'material / quiet';
}

function renderCreases(frame) {
  return frame.folds.map((fold, index) => {
    const x = 110 + fold.center * 790;
    const width = 28 + fold.pressure * 110;
    const lean = fold.direction * (15 + index * 4);
    const top = 135 + index * 13;
    const bottom = 474 - index * 11;
    return `<path class="fold-band" d="M ${svgPoint(x - width)} ${top} L ${svgPoint(x + width + lean)} ${top - 8} L ${svgPoint(x + width - lean)} ${bottom + 12} L ${svgPoint(x - width)} ${bottom} Z"/><path class="fold-seam" d="M ${svgPoint(x - width * .22)} ${top - 12} Q ${svgPoint(x + lean)} 304 ${svgPoint(x + width * .18)} ${bottom + 8}"/><path class="fold-seam-cool" d="M ${svgPoint(x + width * .2)} ${top - 2} Q ${svgPoint(x - lean * .5)} 315 ${svgPoint(x - width * .18)} ${bottom + 2}"/>`;
  }).join('');
}

function renderGlyphs(frame) {
  return frame.glyphs.map((glyph) => {
    const x = glyph.x * 1000;
    const y = glyph.y * 620;
    const size = glyph.scale;
    const transform = `translate(${svgPoint(x)} ${svgPoint(y)}) rotate(${svgPoint(glyph.rotation)}) skewX(${svgPoint(glyph.shear)}) scale(${svgPoint(size)} ${svgPoint(size)})`;
    if (glyph.blank) {
      return `<g data-glyph-id="${glyph.id}" data-role="${glyph.role}" transform="${transform}"><path class="counterform" d="M -32 -47 C -18 -62 22 -61 34 -42 L 28 46 C 6 60 -18 55 -34 41 Z"/><path class="counterform-inner" d="M -8 -37 L 12 36 M 22 -18 L -18 24"/></g>`;
    }
    return `<text class="glyph" data-glyph-id="${glyph.id}" data-role="${glyph.role}" transform="${transform}" style="font-weight:${Math.round(500 + glyph.weight * 300)}">${escapeText(glyph.glyph)}</text>`;
  }).join('');
}

function renderWells(frame) {
  return frame.wells.map((well) => {
    const selected = frame.span.includes(well.id);
    const x = well.x * 1000;
    const y = well.y * 620;
    return `<g data-well-id="${well.id}" data-selected="${selected}"><ellipse class="well-mark" cx="${svgPoint(x)}" cy="${svgPoint(y)}" rx="24" ry="11" data-selected="${selected}"/><circle cx="${svgPoint(x)}" cy="${svgPoint(y)}" r="3" fill="${selected ? '#fff2df' : '#b25b47'}"/></g>`;
  }).join('');
}

function render(frame) {
  creaseLayer.innerHTML = renderCreases(frame);
  glyphLayer.innerHTML = renderGlyphs(frame);
  wellLayer.innerHTML = renderWells(frame);
  field.dataset.stage = lastState;
  field.dataset.span = frame.span.join(',');
  field.dataset.memory = String(frame.memory.length);
  field.dataset.signature = geometrySignature(frame);
  stageReadout.textContent = roleLabel(lastState);
  memoryReadout.textContent = `${frame.memory.length} folds · ${WELL_COUNT} wells`;
  interactionState.textContent = lastState === 'loading'
    ? `${frame.span.length} negative well${frame.span.length === 1 ? '' : 's'} loaded. The plate has not moved.`
    : lastState === 'fold'
      ? 'The blank carried pressure: distant letters bent, one inherited, and one opened.'
      : lastState === 'refused'
        ? 'The plate stayed exact. Choose two non-adjacent wells.'
        : lastState === 'lifted'
          ? 'The latest fold is gone. The preceding plate is exact again.'
          : lastState === 'released'
            ? 'The material memory is released. Every letter is quiet again.'
            : 'The plate is quiet. No blank is carrying pressure.';
  wellButtons.forEach((button, index) => {
    button.setAttribute('aria-pressed', frame.span.includes(index) ? 'true' : 'false');
    button.disabled = staticPreview;
  });
  liftControl.disabled = staticPreview || frame.memory.length === 0;
  foldControl.disabled = staticPreview;
  releaseControl.disabled = staticPreview;
}

function update(frame, state, focus = focusWell) {
  currentFrame = frame;
  lastState = state;
  focusWell = ((focus % WELL_COUNT) + WELL_COUNT) % WELL_COUNT;
  render(currentFrame);
}

function chooseWell(id) {
  if (staticPreview) return false;
  const next = loadWell(currentFrame, id);
  if (next.lastEvent === 'refused') {
    update(next, 'refused', id);
    return false;
  }
  if (next.span.length === GAP_LENGTH) {
    const committed = commitSpan(next);
    update(committed, committed.lastEvent === 'fold' ? 'fold' : 'refused', id);
    return committed.lastEvent === 'fold';
  }
  update(next, 'loading', id);
  return true;
}

function playDefault() {
  if (staticPreview) return false;
  const pairs = [[0, 3], [1, 4], [0, 4], [2, 4]];
  const pair = pairs[currentFrame.history.length % pairs.length];
  let next = loadWell(currentFrame, pair[0]);
  next = loadWell(next, pair[1]);
  const committed = commitSpan(next);
  update(committed, committed.lastEvent === 'fold' ? 'fold' : 'refused', pair[1]);
  return committed.lastEvent === 'fold';
}

function lift() {
  if (staticPreview) return false;
  const next = liftLatestSpan(currentFrame);
  update(next, 'lifted', focusWell);
  return true;
}

function release() {
  if (staticPreview) return false;
  update(releaseSpan(), 'released', focusWell);
  return true;
}

function pointerWell(event) {
  const rect = svg.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const points = currentFrame.wells.map((well) => ({ id: well.id, x: well.x, y: well.y }));
  return nearestWell(points, { x, y }, .065);
}

function handleKey(event) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    focusWell += event.key === 'ArrowRight' ? 1 : -1;
    wellButtons[(focusWell + WELL_COUNT) % WELL_COUNT].focus({ preventScroll: true });
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    playDefault();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    release();
  }
}

field.addEventListener('keydown', handleKey);
svg.addEventListener('pointerdown', (event) => {
  if (staticPreview) return;
  const id = pointerWell(event);
  if (id >= 0) {
    field.focus({ preventScroll: true });
    chooseWell(id);
  }
});
wellButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    focusWell = index;
    chooseWell(index);
  });
});
foldControl.addEventListener('click', playDefault);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

update(currentFrame, lastState, focusWell);
window._p5Ready = true;
window.__mutineHandwritingV033 = {
  getState: () => ({ memory: currentFrame.memory.length, span: [...currentFrame.span], changedGlyphIds: [...currentFrame.changedGlyphIds], lastEvent: currentFrame.lastEvent, interaction: lastState }),
  getSignature: () => geometrySignature(currentFrame),
  chooseWell,
  commitDefault: playDefault,
  liftLatest: lift,
  release,
  getFrame: () => currentFrame
};
