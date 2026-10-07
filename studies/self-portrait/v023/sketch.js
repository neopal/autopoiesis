import {
  STAGES,
  buildFrame,
  buildTimeline,
  armOrbit,
  sealObservation,
  liftLatestObservation,
  releaseObservations,
  defaultCue,
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
const field = document.querySelector('#observation-field');
const canvas = document.querySelector('#solid-canvas');
const context = canvas?.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const actionButtons = [...document.querySelectorAll('[data-action]')];
let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let canvasWidth = 1;
let canvasHeight = 1;
let pointerDown = false;

const palette = {
  background: '#081015',
  quiet: ['#334954', '#47636d', '#5e7780'],
  open: ['#d88464', '#a94f49', '#e8ad80'],
  echo: ['#84b9c8', '#547d91', '#b3d9d2'],
  ink: '#e7e5d9',
  shadow: 'rgba(0, 0, 0, .62)',
  acid: '#c9d68d'
};

function resizeCanvas() {
  if (!canvas || !context) return;
  const rect = field.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvasWidth = Math.max(1, rect.width);
  canvasHeight = Math.max(1, rect.height);
  canvas.width = Math.round(canvasWidth * ratio);
  canvas.height = Math.round(canvasHeight * ratio);
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  renderFrame(currentFrame, currentFrame.interaction || 'sequence');
}

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function colorFor(face, index) {
  const group = face.state === 'unseen-open' ? palette.open : face.state === 'echo' ? palette.echo : palette.quiet;
  return group[index % group.length];
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function polar(cx, cy, radius, angle) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function drawBackground() {
  const gradient = context.createRadialGradient(canvasWidth * .5, canvasHeight * .44, 8, canvasWidth * .5, canvasHeight * .5, Math.max(canvasWidth, canvasHeight) * .68);
  gradient.addColorStop(0, '#263c43');
  gradient.addColorStop(.38, '#12232a');
  gradient.addColorStop(1, palette.background);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  context.save();
  context.globalAlpha = .18;
  context.strokeStyle = '#9ab3ad';
  context.lineWidth = 1;
  for (let index = 0; index < 26; index += 1) {
    const x = canvasWidth * seededUnit(index + 3.1);
    const y = canvasHeight * (.2 + seededUnit(index + 19.7) * .64);
    const length = 12 + seededUnit(index + 41.8) * Math.min(canvasWidth, canvasHeight) * .14;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y - length * .12);
    context.stroke();
  }
  context.restore();
}

function facePoints(face, index, frame, center, scale) {
  const base = face.radial + frame.viewAzimuth * .9;
  const span = (Math.PI * 2 / frame.faces.length) * (.84 + face.width * .05);
  const lean = frame.viewPitch * (index % 2 ? -1 : 1) + face.twist;
  const outer = scale * (face.radius + face.depth * .08);
  const inner = scale * (.16 + face.fold * .025);
  const left = polar(center.x, center.y, inner, base - span * .44 + lean);
  const outerLeft = polar(center.x, center.y, outer, base - span * .5 + lean);
  const notchDepth = 1 - face.notch * .46;
  const outerMiddle = polar(center.x, center.y, outer * notchDepth, base + lean + face.notch * .13);
  const outerRight = polar(center.x, center.y, outer, base + span * .5 + lean);
  const right = polar(center.x, center.y, inner, base + span * .44 + lean);
  return [left, outerLeft, outerMiddle, outerRight, right];
}

function pathFromPoints(points) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) context.lineTo(points[index].x, points[index].y);
  context.closePath();
}

function drawFace(face, index, frame, center, scale) {
  const points = facePoints(face, index, frame, center, scale);
  pathFromPoints(points);
  const shade = context.createLinearGradient(points[1].x, points[1].y, points[3].x, points[3].y);
  const base = colorFor(face, index);
  shade.addColorStop(0, base);
  shade.addColorStop(.58, face.state === 'unseen-open' ? '#6d3535' : '#263943');
  shade.addColorStop(1, '#0b151a');
  context.fillStyle = shade;
  context.fill();
  context.strokeStyle = face.state === 'unseen-open' ? 'rgba(244, 179, 132, .86)' : face.state === 'echo' ? 'rgba(184, 226, 220, .74)' : 'rgba(231, 229, 217, .26)';
  context.lineWidth = face.state === 'unseen-open' ? 2.2 : 1;
  context.stroke();

  if (face.seam > 0) {
    const seamStart = polar(center.x, center.y, scale * .2, face.radial + frame.viewAzimuth);
    const seamEnd = polar(center.x, center.y, scale * (.68 + face.seam * .08), face.radial + frame.viewAzimuth + face.twist);
    context.save();
    context.globalAlpha = Math.min(.84, .2 + face.seam * .65);
    context.strokeStyle = palette.ink;
    context.setLineDash([4, 7]);
    context.lineWidth = 1.4;
    context.beginPath();
    context.moveTo(seamStart.x, seamStart.y);
    context.lineTo(seamEnd.x, seamEnd.y);
    context.stroke();
    context.restore();
  }

  if (face.notch > 0) {
    const mark = polar(center.x, center.y, scale * (.73 - face.notch * .12), face.radial + frame.viewAzimuth + face.twist);
    context.save();
    context.globalAlpha = .72;
    context.fillStyle = '#070b0e';
    context.beginPath();
    context.arc(mark.x, mark.y, 3 + face.notch * 8, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawSolid(frame) {
  if (!context) return;
  drawBackground();
  const center = {
    x: canvasWidth * (.5 + frame.viewAzimuth * .035),
    y: canvasHeight * (.5 + frame.viewPitch * .22)
  };
  const scale = Math.min(canvasWidth, canvasHeight) * .34;

  context.save();
  context.translate(0, 9);
  context.globalAlpha = .56;
  context.fillStyle = palette.shadow;
  context.filter = 'blur(18px)';
  context.beginPath();
  context.ellipse(center.x, center.y + scale * .72, scale * .78, scale * .14, frame.viewAzimuth * .2, 0, Math.PI * 2);
  context.fill();
  context.filter = 'none';
  context.restore();

  context.save();
  const order = [...frame.faces].sort((a, b) => Math.sin(a.radial + frame.viewAzimuth) - Math.sin(b.radial + frame.viewAzimuth));
  order.forEach((face) => drawFace(face, face.index, frame, center, scale));
  context.restore();

  context.save();
  context.globalAlpha = .5;
  context.strokeStyle = 'rgba(231,229,217,.3)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(center.x, center.y, scale * (.98 + Math.sin(frame.stage * .3) * .012), 0, Math.PI * 2);
  context.stroke();
  if (frame.armedFace !== null) {
    const armed = frame.faces[frame.armedFace];
    const p = polar(center.x, center.y, scale * 1.08, armed.radial + frame.viewAzimuth);
    context.strokeStyle = palette.acid;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(p.x, p.y, 7, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .32;
  context.fillStyle = palette.ink;
  for (let index = 0; index < frame.faces.length; index += 1) {
    const face = frame.faces[index];
    const p = polar(center.x, center.y, scale * 1.13, face.radial + frame.viewAzimuth);
    context.fillRect(p.x - 1, p.y - 1, 2 + face.seen * 2, 2 + face.seen * 2);
  }
  context.restore();
}

function renderFrame(frame, interaction = frame.interaction || 'sequence') {
  currentFrame = frame;
  drawSolid(frame);
  const event = frame.memory.at(-1);
  const changed = event ? frame.faces[event.alteredFace] : null;
  if (stageReadout) {
    stageReadout.textContent = interaction === 'observation-sealed'
      ? 'unseen face opened / remote seam returned'
      : interaction === 'observation-lifted'
        ? 'latest unseen change lifted'
        : interaction === 'orbit-armed'
          ? `face ${String((frame.armedFace ?? 0) + 1).padStart(2, '0')} witnessed / seal to write`
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} unseen change${frame.memory.length === 1 ? '' : 's'} held${changed ? ` · face ${changed.index + 1} open` : ''}`;
  if (stateReadout) {
    stateReadout.textContent = interaction === 'observation-sealed'
      ? `The watched face stayed still. Face ${changed.index + 1} carries what the orbit missed.`
      : interaction === 'observation-lifted'
        ? 'The latest unseen change is gone. The prior solid is exact again.'
        : interaction === 'orbit-armed'
          ? `Face ${(frame.armedFace ?? 0) + 1} is witnessed but unchanged. Seal to make the blind side answer.`
          : 'The solid is holding a bounded archive of unseen decisions.';
  }
  if (hint) hint.textContent = frame.armedFace !== null ? 'seal to write the blind side' : 'orbit first; sealing changes what you did not see';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.armedFace = String(frame.armedFace ?? '');
    field.dataset.interaction = interaction;
    field.dataset.signature = geometrySignature(frame);
  }
}

function angleFromClientX(clientX) {
  const rect = field.getBoundingClientRect();
  return Math.max(-1, Math.min(1, ((clientX - rect.left) / rect.width) * 2 - 1));
}

function isControlEvent(event) {
  return event.target instanceof Element && Boolean(event.target.closest('.observation-controls'));
}

function orbit(angle) {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = armOrbit(base, angle);
  renderFrame(interactionFrame, 'orbit-armed');
}

function seal(angle = null) {
  const base = interactionFrame ?? activeFrameAt();
  const safeAngle = angle ?? base.armedAngle ?? defaultCue(base.memory.length).angle;
  interactionFrame = sealObservation(base, { angle: safeAngle });
  renderFrame(interactionFrame, 'observation-sealed');
}

function lift() {
  const base = interactionFrame ?? activeFrameAt();
  if (!base.memory.length) return;
  interactionFrame = liftLatestObservation(base);
  renderFrame(interactionFrame, 'observation-lifted');
}

function release() {
  interactionFrame = frozen ? releaseObservations(0) : null;
  startedAt = performance.now();
  renderFrame(interactionFrame ?? timeline[0], 'observations-released');
}

function saveState() {
  const payload = JSON.stringify({ version: 'v023', signature: geometrySignature(currentFrame), frame: currentFrame }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'mutine-self-portrait-v023-state.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function attachInteractions() {
  if (!field || staticPreview) return;
  field.addEventListener('pointermove', (event) => {
    if (isControlEvent(event)) return;
    orbit(angleFromClientX(event.clientX));
  });
  field.addEventListener('pointerdown', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    pointerDown = true;
    field.setPointerCapture?.(event.pointerId);
    orbit(angleFromClientX(event.clientX));
  });
  field.addEventListener('pointerup', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    if (!pointerDown) return;
    pointerDown = false;
    seal(angleFromClientX(event.clientX));
  });
  field.addEventListener('pointercancel', () => { pointerDown = false; });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      orbit(-0.72);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      orbit(0.72);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      seal();
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
    if (button.dataset.action === 'orbit-left') orbit(-0.72);
    if (button.dataset.action === 'seal') seal();
    if (button.dataset.action === 'lift') lift();
    if (button.dataset.action === 'release') release();
  }));
}

window.__mutinePortraitV023 = {
  getState: () => ({
    stage: currentFrame.stage,
    memory: currentFrame.memory.length,
    watchedFace: currentFrame.memory.at(-1)?.watchedFace ?? currentFrame.armedFace,
    alteredFace: currentFrame.memory.at(-1)?.alteredFace ?? null,
    interaction: currentFrame.interaction || 'sequence',
    interactive: interactivePreview || !staticPreview,
    blind: blindMode,
    signature: geometrySignature(currentFrame)
  }),
  getFrame: () => currentFrame,
  orbit,
  seal,
  lift,
  release,
  save: saveState,
  requestRender: () => renderFrame(currentFrame, currentFrame.interaction || 'sequence')
};

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
renderFrame(frozen ? timeline.at(-1) : currentFrame);
attachInteractions();
window._p5Ready = true;

function tick(now) {
  if (!frozen && !interactionFrame) renderFrame(activeFrameAt(now));
  window.requestAnimationFrame(tick);
}
window.requestAnimationFrame(tick);
