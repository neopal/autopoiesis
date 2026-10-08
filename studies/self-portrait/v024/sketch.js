import {
  STAGES,
  buildTimeline,
  submitStroke,
  liftLatestStroke,
  releaseStrain,
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
const field = document.querySelector('#membrane-field');
const svg = document.querySelector('#field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let pointerStart = null;
let pointerCurrent = null;

const palette = {
  background: '#080a11',
  quiet: ['#77719d', '#8e81ae', '#605b86', '#aaa1c3'],
  rupture: '#e77d64',
  relay: '#86c7c1',
  ink: '#eee8dc',
  dim: '#24233a',
  acid: '#d5dc8c'
};

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function colorFor(ring, index) {
  if (ring.state === 'ruptured') return palette.rupture;
  if (ring.state === 'relayed') return palette.relay;
  return palette.quiet[index % palette.quiet.length];
}

function angleDistance(a, b) {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(delta, Math.PI * 2 - delta);
}

function ringPoints(ring, frame, steps = 64) {
  const points = [];
  const centerX = frame.fieldBias.x * 0.05 + ring.drift * 0.03;
  const centerY = frame.fieldBias.y * 0.05 - ring.drift * 0.02;
  const gap = ring.notch * 0.48;
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2 - Math.PI / 2;
    if (gap > 0 && angleDistance(angle, ring.phase + 0.35) < gap) continue;
    const breathing = 1 + Math.sin(angle * 3 + ring.phase + frame.stage * 0.04) * 0.035 + Math.cos(angle * 7 - ring.phase) * 0.018;
    const relayWarp = Math.sin(angle * 2 + ring.phase) * ring.relay * 0.018;
    const radius = (ring.radius + relayWarp) * breathing;
    const x = centerX + Math.cos(angle + ring.drift) * radius;
    const y = centerY + Math.sin(angle + ring.drift) * radius * ring.eccentricity;
    points.push([x, y]);
  }
  return points;
}

function pathFromPoints(points, close = true) {
  if (!points.length) return '';
  const commands = [`M ${points[0][0].toFixed(4)} ${points[0][1].toFixed(4)}`];
  for (let index = 1; index < points.length; index += 1) commands.push(`L ${points[index][0].toFixed(4)} ${points[index][1].toFixed(4)}`);
  if (close) commands.push('Z');
  return commands.join(' ');
}

function svgMarkup(frame) {
  const rings = frame.rings.map((ring, index) => {
    const points = ringPoints(ring, frame);
    const broken = ring.notch > 0.01;
    const stroke = colorFor(ring, index);
    const width = ring.state === 'ruptured' ? 0.018 : ring.state === 'relayed' ? 0.014 : 0.008;
    const opacity = ring.state === 'quiet' ? 0.44 + index * 0.035 : 0.9;
    const dash = ring.state === 'relayed' ? '0.045 0.028' : 'none';
    const ends = broken && points.length > 2 ? [points[0], points.at(-1)] : [];
    return `<path class="membrane-ring ${ring.state}" d="${pathFromPoints(points, !broken)}" fill="none" stroke="${stroke}" stroke-width="${width.toFixed(4)}" stroke-opacity="${opacity.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${dash}"/>${ends.map(([x, y]) => `<circle class="rupture-terminal" cx="${x.toFixed(4)}" cy="${y.toFixed(4)}" r="${(0.012 + ring.notch * 0.012).toFixed(4)}" fill="${palette.rupture}" fill-opacity=".88"/>`).join('')}`;
  }).join('');
  const ghosts = frame.rings.filter((ring) => ring.state === 'relayed').map((ring) => {
    const angle = ring.phase;
    const x1 = Math.cos(angle) * ring.radius * 0.72;
    const y1 = Math.sin(angle) * ring.radius * ring.eccentricity * 0.72;
    const x2 = Math.cos(angle + ring.drift + 0.8) * ring.radius * 1.13;
    const y2 = Math.sin(angle + ring.drift + 0.8) * ring.radius * ring.eccentricity * 1.13;
    return `<path d="M ${x1.toFixed(4)} ${y1.toFixed(4)} C 0 0 ${x2.toFixed(4)} ${y2.toFixed(4)} ${x2.toFixed(4)} ${y2.toFixed(4)}" fill="none" stroke="${palette.relay}" stroke-width=".004" stroke-opacity=".5"/>`;
  }).join('');
  return `<defs><radialGradient id="membrane-ground"><stop offset="0" stop-color="#252344"/><stop offset=".6" stop-color="#111426"/><stop offset="1" stop-color="#080a11"/></radialGradient><filter id="soft-glow"><feGaussianBlur stdDeviation=".012"/></filter></defs><rect x="-1" y="-1" width="2" height="2" fill="url(#membrane-ground)"/><circle cx="0" cy="0" r=".09" fill="#05070b" stroke="#eee8dc" stroke-opacity=".16" stroke-width=".004"/><circle cx="0" cy="0" r=".17" fill="none" stroke="#d5dc8c" stroke-opacity=".12" stroke-width=".004" stroke-dasharray=".01 .028"/>${ghosts}<g filter="url(#soft-glow)" opacity=".2">${rings}</g><g>${rings}</g>${pointerCurrent && pointerStart ? `<line class="stroke-ghost" x1="${pointerStart[0]}" y1="${pointerStart[1]}" x2="${pointerCurrent[0]}" y2="${pointerCurrent[1]}" stroke="${palette.acid}" stroke-width=".008" stroke-dasharray=".025 .018"/>` : ''}`;
}

function renderFrame(frame, interaction = frame.interaction || 'sequence') {
  currentFrame = frame;
  if (svg) svg.innerHTML = svgMarkup(frame);
  const event = frame.memory.at(-1);
  if (stageReadout) stageReadout.textContent = interaction === 'stroke-committed' ? 'rupture committed / relay sent' : interaction === 'stroke-refused' ? 'stroke refused / too little strain' : interaction === 'stroke-lifted' ? 'latest rupture lifted' : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} strain${frame.memory.length === 1 ? '' : 's'} held${event ? ` · ring ${event.rupturedRing + 1} ruptured` : ''}`;
  if (stateReadout) stateReadout.textContent = interaction === 'stroke-committed'
    ? `Ring ${event.rupturedRing + 1} broke under its own resistance; ring ${event.relayRing + 1} carries the relay.`
    : interaction === 'stroke-refused'
      ? 'The gesture was too short to become material strain.'
      : interaction === 'stroke-lifted'
        ? 'The latest rupture is gone. The prior membrane is exact again.'
        : 'The membrane is holding its own resistance.';
  if (hint) hint.textContent = pointerStart ? 'release to submit measured strain' : 'draw across the membrane; release to let it choose';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.interaction = interaction;
    field.dataset.signature = geometrySignature(frame);
  }
}

function pointFromEvent(event) {
  const rect = field.getBoundingClientRect();
  return [Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1)), Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1))];
}

function isControlEvent(event) {
  return event.target instanceof Element && Boolean(event.target.closest('.membrane-controls'));
}

function cueFor(index = 0) {
  const cues = [
    { start: [-0.78, -0.14], end: [0.58, 0.3] },
    { start: [-0.62, 0.42], end: [0.7, -0.34] },
    { start: [-0.7, -0.48], end: [0.48, 0.52] },
    { start: [-0.42, 0.66], end: [0.76, 0.02] }
  ];
  return cues[index % cues.length];
}

function submit(input) {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = submitStroke(base, input);
  pointerStart = null;
  pointerCurrent = null;
  renderFrame(interactionFrame, interactionFrame.interaction);
}

function lift() {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = liftLatestStroke(base);
  renderFrame(interactionFrame, 'stroke-lifted');
}

function release() {
  interactionFrame = frozen ? releaseStrain(0) : null;
  startedAt = performance.now();
  renderFrame(interactionFrame ?? timeline[0], 'strain-released');
}

function saveState() {
  const payload = JSON.stringify({ version: 'v024', signature: geometrySignature(currentFrame), frame: currentFrame }, null, 2);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
  link.download = 'mutine-self-portrait-v024-state.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function attachInteractions() {
  if (!field || staticPreview) return;
  field.addEventListener('pointerdown', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    pointerStart = pointFromEvent(event);
    pointerCurrent = pointerStart.slice();
    field.setPointerCapture?.(event.pointerId);
    renderFrame(interactionFrame ?? activeFrameAt(), 'stroke-armed');
  });
  field.addEventListener('pointermove', (event) => {
    if (!pointerStart || isControlEvent(event)) return;
    pointerCurrent = pointFromEvent(event);
    renderFrame(interactionFrame ?? activeFrameAt(), 'stroke-armed');
  });
  field.addEventListener('pointerup', (event) => {
    if (!pointerStart || isControlEvent(event)) return;
    event.preventDefault();
    pointerCurrent = pointFromEvent(event);
    submit({ start: pointerStart, end: pointerCurrent });
  });
  field.addEventListener('pointercancel', () => { pointerStart = null; pointerCurrent = null; renderFrame(currentFrame); });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); submit(cueFor((interactionFrame ?? currentFrame).memory.length)); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
    else if (event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
    else if (event.key.toLowerCase() === 's') { event.preventDefault(); saveState(); }
  });
  actionButtons.forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.action === 'strain') submit(cueFor((interactionFrame ?? currentFrame).memory.length));
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  }));
}

window.__mutinePortraitV024 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    interaction: currentFrame.interaction,
    rupturedRing: currentFrame.memory.at(-1)?.rupturedRing ?? null,
    relayRing: currentFrame.memory.at(-1)?.relayRing ?? null,
    signature: geometrySignature(currentFrame),
    ringStates: currentFrame.rings.map((ring) => ring.state),
    interactive: interactivePreview || !staticPreview,
    blind: blindMode
  }),
  getFrame: () => currentFrame,
  submit,
  lift,
  release,
  save: saveState,
  requestRender: () => renderFrame(currentFrame, currentFrame.interaction || 'sequence')
};

renderFrame(frozen ? timeline.at(-1) : currentFrame);
attachInteractions();
window._p5Ready = true;

function tick(now) {
  if (!frozen && !interactionFrame) renderFrame(activeFrameAt(now));
  window.requestAnimationFrame(tick);
}
window.requestAnimationFrame(tick);
