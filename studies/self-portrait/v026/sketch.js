import {
  MARK_COUNT,
  STAGES,
  buildTimeline,
  armWitness,
  commitWitness,
  liftLatestWitness,
  releaseAttention,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3200;
const field = document.querySelector('#witness-field');
const marksLayer = document.querySelector('[data-marks]');
const threadsLayer = document.querySelector('[data-threads]');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let lastSignature = '';
let cssWidth = 1;
let cssHeight = 1;

const palette = {
  paper: '#e5dfcf',
  violet: '#9b91c3',
  violetDeep: '#514a73',
  coral: '#df806b',
  cyan: '#83cbc1',
  acid: '#d5d58a',
  ink: '#171823',
  night: '#090b12'
};

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function currentIndex(frame) {
  return frame.pendingIndex === null || frame.pendingIndex === undefined ? null : frame.pendingIndex;
}

function percentX(value) { return 50 + value * 42; }
function percentY(value) { return 50 + value * 36; }

function markStyle(mark) {
  return {
    '--x': `${percentX(mark.x).toFixed(3)}%`,
    '--y': `${percentY(mark.y).toFixed(3)}%`,
    '--w': `${(mark.width * 100).toFixed(3)}%`,
    '--h': `${(mark.height * 100).toFixed(3)}%`,
    '--tilt': `${(mark.tilt * 57.2958).toFixed(3)}deg`,
    '--scale': mark.scale.toFixed(4),
    '--skew': `${(mark.skew * 57.2958).toFixed(3)}deg`,
    '--cut': mark.cut.toFixed(4),
    '--bridge': mark.bridge.toFixed(4),
    '--debt': mark.debt.toFixed(4)
  };
}

function applyStyles(element, styles) {
  Object.entries(styles).forEach(([property, value]) => element.style.setProperty(property, value));
}

function createMark(mark, frame) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'witness-mark';
  button.dataset.mark = String(mark.index);
  button.dataset.state = mark.state;
  button.setAttribute('aria-label', `Witness mark ${mark.index + 1}`);
  button.setAttribute('aria-pressed', String(currentIndex(frame) === mark.index));
  applyStyles(button, markStyle(mark));
  if (currentIndex(frame) === mark.index) button.classList.add('is-pending');

  const shell = document.createElement('span');
  shell.className = 'mark-shell';
  const core = document.createElement('span');
  core.className = `mark-core glyph-${mark.glyph}`;
  for (let index = 0; index < 5; index += 1) {
    const stroke = document.createElement('i');
    stroke.className = 'mark-stroke';
    stroke.style.setProperty('--stroke-index', String(index));
    core.append(stroke);
  }
  const notch = document.createElement('span');
  notch.className = 'mark-notch';
  shell.append(core, notch);
  button.append(shell);
  button.addEventListener('click', () => {
    if (currentFrame.pendingIndex === mark.index) commit();
    else witness(mark.index);
  });
  return button;
}

function threadBetween(a, b, className = '') {
  const thread = document.createElement('span');
  thread.className = `field-thread ${className}`.trim();
  const x1 = percentX(a.x);
  const y1 = percentY(a.y);
  const x2 = percentX(b.x);
  const y2 = percentY(b.y);
  const dx = (x2 - x1) * cssWidth / 100;
  const dy = (y2 - y1) * cssHeight / 100;
  const length = Math.hypot(dx, dy) / cssWidth * 100;
  const angle = Math.atan2(dy, dx) * 57.2958;
  thread.style.left = `${x1.toFixed(3)}%`;
  thread.style.top = `${y1.toFixed(3)}%`;
  thread.style.width = `${length.toFixed(3)}%`;
  thread.style.transform = `rotate(${angle.toFixed(3)}deg)`;
  return thread;
}

function renderThreads(frame) {
  if (!threadsLayer) return;
  threadsLayer.replaceChildren();
  for (let index = 1; index < frame.marks.length; index += 1) {
    threadsLayer.append(threadBetween(frame.marks[index - 1], frame.marks[index]));
  }
  for (const event of frame.memory) {
    const from = frame.marks[event.absenceIndex];
    const to = frame.marks[event.replyIndex];
    if (from && to) threadsLayer.append(threadBetween(from, to, 'memory-thread'));
  }
}

function renderMarks(frame) {
  if (!marksLayer) return;
  marksLayer.replaceChildren(...frame.marks.map((mark) => createMark(mark, frame)));
}

function render(frame, interaction = frame.interaction || 'sequence') {
  currentFrame = frame;
  const signature = `${geometrySignature(frame)}|${frame.pendingIndex}|${interaction}`;
  if (signature !== lastSignature) {
    cssWidth = Math.max(1, field?.getBoundingClientRect().width ?? 1);
    cssHeight = Math.max(1, field?.getBoundingClientRect().height ?? 1);
    renderThreads(frame);
    renderMarks(frame);
    lastSignature = signature;
  }
  const event = frame.memory.at(-1);
  if (stageReadout) stageReadout.textContent = interaction === 'absence-election' ? 'absence elected / reply distributed' : interaction === 'witness-refused' ? 'witness refused / choose a mark' : interaction === 'witness-lifted' ? 'latest absence lifted' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} election${frame.memory.length === 1 ? '' : 's'} held${event ? ` · mark ${event.absenceIndex + 1} absent` : ''}`;
  if (stateReadout) stateReadout.textContent = interaction === 'absence-election'
    ? `Mark ${event.absenceIndex + 1} disappeared away from your witness; mark ${event.replyIndex + 1} answers and mark ${event.counterIndex + 1} slips.`
    : interaction === 'witness-refused'
      ? 'No mark is armed. Visit one before asking the portrait to decide.'
      : interaction === 'witness-lifted'
        ? 'The latest absence is gone. The previous field is exact again.'
        : frame.pendingIndex === null || frame.pendingIndex === undefined
          ? 'The field is waiting to be witnessed.'
          : `Mark ${frame.pendingIndex + 1} is being witnessed. Press Enter to let the field decide.`;
  if (hint) hint.textContent = frame.pendingIndex === null || frame.pendingIndex === undefined ? 'visit one mark; press Enter to let it decide' : 'press Enter again to release the decision';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.interaction = interaction;
    field.dataset.signature = geometrySignature(frame);
  }
}

function cueIndex(frame) { return (frame.memory.length * 3 + 2) % MARK_COUNT; }

function witness(index) {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = armWitness(base, index);
  render(interactionFrame, 'witness-armed');
  marksLayer?.querySelector(`[data-mark="${index}"]`)?.focus();
}

function commit() {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = commitWitness(base);
  render(interactionFrame, interactionFrame.interaction);
}

function submitCue() {
  const base = interactionFrame ?? activeFrameAt();
  if (base.pendingIndex === null || base.pendingIndex === undefined) {
    interactionFrame = armWitness(base, cueIndex(base));
    render(interactionFrame, 'witness-armed');
    return;
  }
  commit();
}

function lift() {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = liftLatestWitness(base);
  render(interactionFrame, 'witness-lifted');
}

function release() {
  interactionFrame = frozen ? releaseAttention(0) : null;
  startedAt = performance.now();
  lastSignature = '';
  render(interactionFrame ?? timeline[0], 'attention-released');
}

function saveState() {
  const payload = JSON.stringify({ version: 'v026', signature: geometrySignature(currentFrame), frame: currentFrame }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = 'mutine-self-portrait-v026-state.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function attachInteractions() {
  if (!field || staticPreview || blindMode) return;
  field.addEventListener('pointermove', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-mark]') : null;
    field.dataset.near = target?.dataset.mark ?? '';
  });
  field.addEventListener('pointerleave', () => { field.dataset.near = ''; });
  field.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-mark]') : null;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (target && currentFrame.pendingIndex !== Number(target.dataset.mark)) witness(Number(target.dataset.mark));
      else submitCue();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      release();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveState();
    }
  });
  actionButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'witness') submitCue();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  }));
}

window.__mutinePortraitV026 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    interaction: currentFrame.interaction,
    pendingIndex: currentFrame.pendingIndex,
    witnessIndex: currentFrame.memory.at(-1)?.witnessIndex ?? null,
    absenceIndex: currentFrame.memory.at(-1)?.absenceIndex ?? null,
    replyIndex: currentFrame.memory.at(-1)?.replyIndex ?? null,
    counterIndex: currentFrame.memory.at(-1)?.counterIndex ?? null,
    signature: geometrySignature(currentFrame),
    markStates: currentFrame.marks.map((mark) => mark.state),
    exposure: currentFrame.exposure.slice(),
    interactive: interactivePreview || !staticPreview,
    blind: blindMode
  }),
  getFrame: () => currentFrame,
  witness,
  submit: submitCue,
  commit,
  lift,
  release,
  save: saveState,
  requestRender: () => render(currentFrame, currentFrame.interaction || 'sequence')
};

window.addEventListener('resize', () => {
  lastSignature = '';
  render(currentFrame, currentFrame.interaction || 'sequence');
});
render(frozen ? timeline.at(-1) : currentFrame);
attachInteractions();
window._p5Ready = true;

function tick(now) {
  const frame = activeFrameAt(now);
  if (frozen) { render(frame, 'sequence'); return; }
  if (!interactionFrame) render(frame, 'sequence');
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);