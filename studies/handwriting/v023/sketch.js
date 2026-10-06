import {
  STAGES,
  buildTimeline,
  buildFrame,
  commitReadingReturn,
  liftLatestReturn,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const field = document.querySelector('#reading-field');
const stage = document.querySelector('#sentence-stage');
const aperture = document.querySelector('.reading-aperture');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const readForwardControl = document.querySelector('#read-forward-control');
const turnBackControl = document.querySelector('#turn-back-control');
const liftControl = document.querySelector('#lift-return');
const releaseControl = document.querySelector('#release-reading');
const timeline = buildTimeline(STAGES);
const DEFAULT_PATH = [0, 1, 2, 3, 2];

let startedAt = performance.now();
let currentFrame = timeline[0];
let interactionFrame = null;
let readingPath = [0];
let cursor = 0;
let pointerStart = null;
let pointerActive = false;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline[0];
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (3600 * timeline.length)) / 3600)];
}

function tokenClass(role) {
  return role === 'turn' ? 'is-turn' : role === 'reply' ? 'is-reply' : role === 'shifted' ? 'is-shifted' : '';
}

function renderFrame(frame, state = frame.interaction) {
  stage.replaceChildren();
  for (let column = 0; column < 4; column += 1) {
    const columnNode = document.createElement('div');
    columnNode.className = 'type-column';
    columnNode.style.left = `${column * 25}%`;
    columnNode.dataset.column = String(column);
    stage.append(columnNode);
  }
  frame.tokens.forEach((token) => {
    const node = document.createElement('span');
    node.className = `word-token ${tokenClass(token.role)}`.trim();
    node.dataset.index = String(token.index);
    node.dataset.role = token.role;
    node.textContent = token.text;
    node.style.setProperty('--x', clamp(token.x, .05, .95).toFixed(4));
    node.style.setProperty('--y', clamp(token.y, .05, .95).toFixed(4));
    node.style.setProperty('--angle', `${token.angle.toFixed(3)}deg`);
    node.style.setProperty('--scale', token.scale.toFixed(3));
    stage.querySelector(`[data-column="${token.column}"]`).append(node);
  });
  const cursorValue = clamp((frame.readingCursor + .5) / 16, .04, .96);
  aperture.style.setProperty('--cursor', cursorValue.toFixed(4));
  updateReadout(frame, state);
}

function updateReadout(frame, state = 'sequence') {
  const stageText = state === 'return-committed'
    ? 'return committed / line reflowed'
    : state === 'return-lifted'
      ? 'latest return lifted'
      : state === 'return-refused'
        ? 'one-way reading refused'
        : state === 'reading-armed'
          ? `reading ${String(frame.readingCursor + 1).padStart(2, '0')} / 16`
          : `reading ${String(frame.readingCursor + 1).padStart(2, '0')} / 16`;
  if (stageReadout) stageReadout.textContent = stageText;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} return${frame.memory.length === 1 ? '' : 's'} · ${frame.memory.length ? 'break remembers' : 'line intact'}`;
  if (interactionState) interactionState.textContent = state === 'return-committed'
    ? 'The reader returned; two places exchanged and a distant word answered.'
    : state === 'return-lifted'
      ? 'The latest return is gone; the preceding line is exact again.'
      : state === 'return-refused'
        ? 'Forward travel only arms attention. A return must be travelled.'
        : state === 'reading-armed'
          ? 'The reading window is moving. The line has not changed.'
          : 'The line is intact.';
  field.dataset.stage = String(frame.readingCursor);
  field.dataset.memory = String(frame.memory.length);
  field.dataset.interaction = state;
  field.dataset.cursor = String(cursor);
  if (liftControl) liftControl.disabled = !interactionFrame || interactionFrame.memory.length === 0;
  if (readForwardControl) readForwardControl.disabled = staticPreview;
  if (turnBackControl) turnBackControl.disabled = staticPreview;
  if (releaseControl) releaseControl.disabled = staticPreview;
}

function showArmed(nextCursor, state = 'reading-armed') {
  cursor = Math.max(0, Math.min(15, nextCursor));
  currentFrame = { ...currentFrame, readingCursor: cursor, interaction: state };
  renderFrame(currentFrame, state);
}

function commit(path = DEFAULT_PATH) {
  if (staticPreview) return false;
  const baseline = interactionFrame || currentFrame || buildFrame(0, []);
  const next = commitReadingReturn(baseline, { path });
  if (next.interaction !== 'return-committed') {
    currentFrame = { ...baseline, readingCursor: cursor, interaction: next.interaction };
    renderFrame(currentFrame, next.interaction);
    return false;
  }
  interactionFrame = next;
  currentFrame = next;
  cursor = path.at(-1) ?? cursor;
  readingPath = [cursor];
  renderFrame(next, next.interaction);
  return true;
}

function moveReader(delta) {
  if (staticPreview) return false;
  const nextCursor = Math.max(0, Math.min(15, cursor + Math.sign(delta)));
  if (nextCursor === cursor) return false;
  cursor = nextCursor;
  readingPath = [...readingPath, cursor];
  const candidate = commitReadingReturn(interactionFrame || currentFrame, { path: readingPath });
  if (candidate.interaction === 'return-committed') {
    interactionFrame = candidate;
    currentFrame = candidate;
    readingPath = [cursor];
    renderFrame(candidate, candidate.interaction);
    return true;
  }
  showArmed(cursor, 'reading-armed');
  return false;
}

function lift() {
  if (!interactionFrame || interactionFrame.memory.length === 0 || staticPreview) return false;
  interactionFrame = liftLatestReturn(interactionFrame);
  currentFrame = interactionFrame;
  cursor = currentFrame.readingCursor;
  readingPath = [cursor];
  renderFrame(currentFrame, 'return-lifted');
  return true;
}

function release() {
  if (staticPreview) return;
  interactionFrame = null;
  cursor = 0;
  readingPath = [0];
  startedAt = performance.now();
  currentFrame = timeline[0];
  renderFrame(currentFrame, 'sequence');
}

function onWheel(event) {
  if (staticPreview || event.target.closest('button')) return;
  event.preventDefault();
  moveReader(event.deltaY > 0 ? 1 : -1);
}

function onPointerDown(event) {
  if (staticPreview || event.target.closest('button')) return;
  pointerActive = true;
  pointerStart = { x: event.clientX, y: event.clientY };
  field.setPointerCapture?.(event.pointerId);
}

function onPointerUp(event) {
  if (!pointerActive || !pointerStart) return;
  pointerActive = false;
  field.releasePointerCapture?.(event.pointerId);
  const distance = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(distance) < 28) return;
  const steps = Math.min(4, Math.max(1, Math.round(Math.abs(distance) / 70)));
  const direction = distance > 0 ? 1 : -1;
  for (let index = 0; index < steps; index += 1) moveReader(direction);
}

function onKeyDown(event) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    moveReader(1);
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    moveReader(-1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(DEFAULT_PATH);
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
}

function loop(now) {
  if (!interactionFrame && !pointerActive) {
    currentFrame = activeFrameAt(now);
    renderFrame(currentFrame, currentFrame.interaction);
  }
  requestAnimationFrame(loop);
}

field.addEventListener('wheel', onWheel, { passive: false });
field.addEventListener('pointerdown', onPointerDown);
field.addEventListener('pointerup', onPointerUp);
field.addEventListener('pointercancel', onPointerUp);
field.addEventListener('keydown', onKeyDown);
readForwardControl.addEventListener('click', () => moveReader(1));
turnBackControl.addEventListener('click', () => commit(DEFAULT_PATH));
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', release);

renderFrame(currentFrame, 'sequence');
window.__mutineHandwritingV023 = {
  getState: () => ({ memory: currentFrame.memory.length, interaction: currentFrame.interaction, cursor, stage: currentFrame.readingCursor }),
  getSignature: () => geometrySignature(currentFrame),
  commitDefault: () => commit(DEFAULT_PATH),
  liftLatest: lift,
  release,
  moveReader,
  getFrame: () => currentFrame
};
window._p5Ready = true;
requestAnimationFrame(loop);
