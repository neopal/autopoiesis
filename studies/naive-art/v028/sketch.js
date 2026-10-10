import {
  MARK_COUNT,
  MIN_LOOK_MS,
  buildFrame,
  buildTimeline,
  commitObservation,
  geometrySignature,
  liftLatestObservation,
  observe,
  releaseMemory
} from './engine.mjs';

const field = document.querySelector('#mishear-field');
const lineHost = document.querySelector('#score-lines');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const statusReadout = document.querySelector('[data-status]');
const controls = [...document.querySelectorAll('[data-action]')];
const staticMode = document.documentElement.classList.contains('static-mode');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = buildFrame();
let look = null;

function settledFrame() {
  let next = buildFrame();
  for (const observation of buildTimeline().observations) {
    next = commitObservation(next, observation);
  }
  return next;
}

if (staticMode || reducedMotion) state = settledFrame();

function markButton(mark) {
  const item = document.createElement('li');
  item.className = 'mark-slot';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mark';
  button.dataset.markIndex = String(mark.id);
  button.setAttribute('aria-label', `notation mark ${mark.id + 1}`);
  const glyph = document.createElement('span');
  glyph.className = 'mark-glyph';
  glyph.setAttribute('aria-hidden', 'true');
  button.append(glyph);
  item.append(button);
  button.addEventListener('pointerenter', () => beginLook(mark.id));
  button.addEventListener('pointerleave', () => endLook(mark.id));
  button.addEventListener('focus', () => arm(mark.id));
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commitActive();
    }
  });
  return item;
}

function ensureMarks() {
  if (lineHost.children.length) return;
  for (let row = 0; row < 3; row += 1) {
    const line = document.createElement('ol');
    line.className = `mark-line mark-line-${row}`;
    line.setAttribute('aria-label', `notation line ${row + 1}`);
    state.scene.marks.filter((mark) => mark.row === row).forEach((mark) => line.append(markButton(mark)));
    lineHost.append(line);
  }
}

function arm(index) {
  state = observe(state, index);
  render();
}

function beginLook(index) {
  arm(index);
  look = { index, started: performance.now() };
  field.dataset.interaction = 'observation-armed';
}

function endLook(index) {
  if (!look || look.index !== index) return;
  const duration = performance.now() - look.started;
  look = null;
  state = commitObservation(state, { index, duration, departed: true });
  render();
}

function commitActive() {
  state = commitObservation(state, {
    index: state.active,
    duration: MIN_LOOK_MS + 180,
    departed: true
  });
  render();
}

function lift() {
  state = liftLatestObservation(state);
  render();
}

function release() {
  state = releaseMemory(state);
  render();
}

function render() {
  ensureMarks();
  stageReadout.textContent = `stage ${String(state.stage).padStart(2, '0')} / 04`;
  memoryReadout.textContent = `${state.memory.length} retained`;
  statusReadout.textContent = state.interaction === 'observation-refused-short'
    ? 'short look refused'
    : state.interaction === 'observation-committed'
      ? 'the gap moved elsewhere'
      : state.interaction === 'observation-lifted'
        ? 'latest mistake lifted'
        : state.interaction === 'memory-released'
          ? 'memory released'
          : state.interaction === 'observation-armed'
            ? 'still looking — leave to write'
            : 'look at a mark, then leave it';

  state.scene.marks.forEach((mark) => {
    const button = lineHost.querySelector(`[data-mark-index="${mark.id}"]`);
    const glyph = button.querySelector('.mark-glyph');
    glyph.textContent = mark.glyph;
    button.dataset.role = mark.role;
    button.classList.toggle('is-active', mark.id === state.active && state.interaction === 'observation-armed');
    button.style.setProperty('--turn', `${mark.turn}deg`);
    button.style.setProperty('--span', String(mark.span));
    button.style.setProperty('--nudge', `${mark.nudge}em`);
    button.style.setProperty('--weight', String(mark.weight));
    button.setAttribute('aria-label', `notation mark ${mark.id + 1}, ${mark.role}`);
  });
  field.dataset.interaction = state.interaction;
  field.dataset.changedMarks = String(state.scene.trace.changedMarkCount);
  field.dataset.gapIndex = String(state.scene.trace.gapIndex ?? 'none');
}

field.addEventListener('keydown', (event) => {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

controls.forEach((control) => control.addEventListener('click', () => {
  if (control.dataset.action === 'mishear') commitActive();
  if (control.dataset.action === 'lift') lift();
  if (control.dataset.action === 'release') release();
}));

window.__mutineNaiveV028 = {
  getState: () => ({ ...state, geometrySignature: geometrySignature(state) }),
  commit: commitActive,
  lift,
  release,
  arm,
  buildTimeline
};

render();
