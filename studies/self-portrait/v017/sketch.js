import {
  STAGES,
  buildTimeline,
  armGaze,
  registerGaze,
  liftLatestGaze,
  releaseGazes,
  geometrySignature,
  GAZE_THRESHOLD
} from './engine.mjs';

const canvas = document.querySelector('#aperture');
const context = canvas.getContext('2d', { alpha: false });
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const attendControl = document.querySelector('#attend-control');
const liftControl = document.querySelector('#lift-control');
const releaseControl = document.querySelector('#release-control');
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const interactivePreview = params.has('interaction');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !params.has('interaction'));
const blindMode = params.get('blind') === '1';
const visualNoFurniture = staticPreview || blindMode;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3600;

let width = 1;
let height = 1;
let pixelRatio = 1;
let startedAt = performance.now();
let currentStage = 0;
let paused = frozen;
let interactionFrame = null;
let armedPoint = { x: .72, y: .34 };
let armedBlade = null;
let holdPointerId = null;

if (interactivePreview) canvas.dataset.interactive = 'true';
if (blindMode) document.documentElement.classList.add('blind-mode');
if (staticPreview) {
  canvas.tabIndex = -1;
  canvas.removeAttribute('aria-keyshortcuts');
}

const palette = {
  ground: '#05070a',
  deep: '#0b111a',
  ink: '#edf3ed',
  ember: '#ef9b67',
  mint: '#79e0c0',
  ice: '#91c5f1',
  violet: '#b7a7ff'
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function syncCanvas() {
  const bounds = canvas.getBoundingClientRect();
  width = Math.max(1, bounds.width);
  height = Math.max(1, bounds.height);
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
  const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  context.setTransform(pixelWidth, 0, 0, pixelHeight, 0, 0);
}

function drawBackground(stage) {
  const wash = context.createRadialGradient(.78, .18, .04, .5, .55, .9);
  wash.addColorStop(0, '#354960');
  wash.addColorStop(.28, '#162636');
  wash.addColorStop(.7, '#080e16');
  wash.addColorStop(1, palette.ground);
  context.fillStyle = wash;
  context.fillRect(0, 0, 1, 1);

  const ember = context.createRadialGradient(.18, .82, 0, .18, .82, .62);
  ember.addColorStop(0, 'rgba(239,155,103,.11)');
  ember.addColorStop(.42, 'rgba(121,224,192,.025)');
  ember.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = ember;
  context.fillRect(0, 0, 1, 1);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = palette.ice;
  context.lineWidth = .00055;
  for (let index = 0; index < 28; index += 1) {
    const y = .08 + index * .031;
    const drift = Math.sin(index * 1.73 + stage * .09) * .009;
    context.beginPath();
    context.moveTo(.035, y + drift);
    context.bezierCurveTo(.3, y - drift, .68, y + drift * .5, .965, y - drift * .25);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = 'screen';
  for (let index = 0; index < 460; index += 1) {
    const x = ((index * 83.17 + stage * 2.3) % 991) / 991;
    const y = ((index * 157.31 + 29 + stage * 1.7) % 997) / 997;
    context.fillStyle = index % 17 === 0 ? 'rgba(121,224,192,.13)' : 'rgba(237,243,237,.022)';
    context.fillRect(x, y, .001, .001);
  }
  context.restore();
}

function drawApertureWell(frame) {
  context.save();
  context.translate(.5, .52);
  context.rotate(-.035);
  const outer = context.createRadialGradient(0, -.04, .03, 0, 0, .42);
  outer.addColorStop(0, 'rgba(5,8,12,.98)');
  outer.addColorStop(.55, 'rgba(10,19,28,.94)');
  outer.addColorStop(1, 'rgba(4,6,9,.1)');
  context.fillStyle = outer;
  context.beginPath();
  context.ellipse(0, 0, .27 + frame.aperture.gap * .23, .41, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `rgba(145,197,241,${.17 + frame.aperture.occlusion * .08})`;
  context.lineWidth = .0012;
  context.beginPath();
  context.ellipse(0, 0, .285, .425, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function bladeGradient(blade, state) {
  const hue = state === 'refusing' ? palette.ember : state === 'answering' ? palette.mint : blade.tone < .42 ? palette.ice : palette.violet;
  const gradient = context.createLinearGradient(-blade.width, -blade.height * .5, blade.width, blade.height * .5);
  gradient.addColorStop(0, 'rgba(3,8,12,.92)');
  gradient.addColorStop(.28, hue);
  gradient.addColorStop(.56, state === 'refusing' ? '#6c3940' : '#203c4b');
  gradient.addColorStop(1, 'rgba(4,8,12,.94)');
  return gradient;
}

function drawBlade(blade, index, frame) {
  const active = frame.armedBlade === index;
  context.save();
  context.translate(blade.x, blade.top + blade.height * .5);
  context.rotate(blade.angle);
  context.globalAlpha = .72 + blade.opening * .2;

  const shadow = context.createLinearGradient(-blade.width, 0, blade.width * 1.8, 0);
  shadow.addColorStop(0, 'rgba(0,0,0,.58)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = shadow;
  context.beginPath();
  context.roundRect(-blade.width * 1.3, -blade.height * .52, blade.width * 2.5, blade.height * 1.08, blade.width * .42);
  context.fill();

  context.fillStyle = bladeGradient(blade, blade.state);
  context.beginPath();
  const taper = blade.width * (.35 + blade.opening * .3);
  context.moveTo(-blade.width, -blade.height * .5);
  context.lineTo(blade.width, -blade.height * .5 + taper);
  context.lineTo(blade.width * (.92 + blade.opening * .22), blade.height * .48);
  context.lineTo(-blade.width * (.72 + blade.opening * .38), blade.height * .5);
  context.closePath();
  context.fill();

  context.strokeStyle = active ? palette.ink : blade.state === 'refusing' ? 'rgba(239,155,103,.9)' : 'rgba(237,243,237,.3)';
  context.lineWidth = active ? .0022 : .001;
  context.stroke();

  context.strokeStyle = blade.state === 'answering' ? 'rgba(121,224,192,.8)' : 'rgba(237,243,237,.24)';
  context.lineWidth = .0008;
  for (let mark = 0; mark < 4; mark += 1) {
    const y = -blade.height * .3 + mark * blade.height * .19;
    context.beginPath();
    context.moveTo(-blade.width * .34, y);
    context.lineTo(blade.width * (.23 + blade.opening * .2), y + Math.sin(index + mark) * .003);
    context.stroke();
  }

  if (active) {
    context.strokeStyle = 'rgba(121,224,192,.9)';
    context.lineWidth = .0012;
    context.beginPath();
    context.arc(0, -blade.height * .56, blade.width * 1.3, Math.PI * .1, Math.PI * .9);
    context.stroke();
  }
  context.restore();
}

function drawRegistration(frame) {
  if (visualNoFurniture) return;
  context.save();
  context.strokeStyle = 'rgba(237,243,237,.42)';
  context.lineWidth = .0008;
  const corners = [[.045, .05, 1, 1], [.955, .05, -1, 1], [.045, .95, 1, -1], [.955, .95, -1, -1]];
  corners.forEach(([x, y, sx, sy]) => {
    context.beginPath();
    context.moveTo(x, y); context.lineTo(x + sx * .04, y);
    context.moveTo(x, y); context.lineTo(x, y + sy * .04);
    context.stroke();
  });
  context.fillStyle = 'rgba(237,243,237,.7)';
  context.font = '0.012px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.fillText('SELF / ORDER OF LOOKING', .045, .075);
  context.textAlign = 'right';
  context.fillStyle = palette.ember;
  context.fillText(`STAGE ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`, .955, .93);
  context.fillStyle = palette.mint;
  context.fillText(`${frame.memory.length} REFUSAL${frame.memory.length === 1 ? '' : 'S'} HELD`, .955, .955);
  context.restore();
}

function render(frame, state = 'sequence') {
  syncCanvas();
  drawBackground(frame.stage);
  drawApertureWell(frame);
  frame.depthOrder.slice().reverse().forEach((index) => drawBlade(frame.blades[index], index, frame));
  drawRegistration(frame);
  if (stageReadout) {
    stageReadout.textContent = state === 'gaze-committed'
      ? 'gaze refused / opening redirected'
      : state === 'gaze-lifted'
        ? 'latest refusal lifted'
        : state === 'gaze-armed'
          ? 'blade noticed / commit to alter the order'
          : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} refusal${frame.memory.length === 1 ? '' : 's'} held · ${frame.aperture.gap.toFixed(2)} aperture gap`;
  canvas.dataset.stage = String(frame.stage);
  canvas.dataset.memory = String(frame.memory.length);
  canvas.dataset.refusals = String(frame.refusals.length);
  canvas.dataset.redirects = String(frame.redirects.length);
  canvas.dataset.armedBlade = frame.armedBlade == null ? '' : String(frame.armedBlade);
  canvas.dataset.signature = geometrySignature(frame);
  canvas.dataset.interaction = state;
}

function frameAt(now) {
  const elapsed = Math.max(0, now - startedAt);
  const cycle = STAGE_MS * timeline.length;
  const withinCycle = elapsed % cycle;
  currentStage = Math.floor(withinCycle / STAGE_MS);
  return timeline[currentStage];
}

function renderCurrent(now = performance.now()) {
  if (interactionFrame) {
    render(interactionFrame, interactionFrame.interaction ?? 'gaze-committed');
    return;
  }
  const frame = frozen ? timeline.at(-1) : frameAt(now);
  render(frame, 'sequence');
  if (!paused && !frozen) requestAnimationFrame(renderCurrent);
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - bounds.left) / bounds.width, .08, .92),
    y: clamp((event.clientY - bounds.top) / bounds.height, .12, .88),
    dwell: .86
  };
}

function commit(point = armedPoint, dwell = .88) {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  interactionFrame = registerGaze(baseline, { ...point, dwell: clamp(dwell, GAZE_THRESHOLD, 1) });
  armedBlade = interactionFrame.memory.at(-1)?.selectedBlade ?? armedBlade;
  paused = true;
  render(interactionFrame, interactionFrame.interaction);
}

function lift() {
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  if (!baseline.memory.length) return;
  interactionFrame = liftLatestGaze(baseline);
  render(interactionFrame, 'gaze-lifted');
}

function release() {
  armedBlade = null;
  if (frozen) interactionFrame = releaseGazes(0);
  else interactionFrame = null;
  paused = frozen;
  currentStage = 0;
  startedAt = performance.now();
  renderCurrent();
}

canvas.addEventListener('pointermove', (event) => {
  armedPoint = pointFromEvent(event);
  const baseline = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
  const armed = armGaze(baseline, armedPoint);
  armedBlade = armed.armedBlade;
  if (!interactionFrame) render(armed, 'gaze-armed');
});

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  armedPoint = pointFromEvent(event);
  holdPointerId = event.pointerId;
});

canvas.addEventListener('pointerup', (event) => {
  if (holdPointerId !== event.pointerId) return;
  holdPointerId = null;
  commit(armedPoint, .88);
});

canvas.addEventListener('pointercancel', () => { holdPointerId = null; });

canvas.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    commit(armedPoint, .9);
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  }
  if (event.key.toLowerCase() === 'r') {
    event.preventDefault();
    release();
  }
});

attendControl?.addEventListener('click', () => commit({ x: .72, y: .34 }, .9));
liftControl?.addEventListener('click', lift);
releaseControl?.addEventListener('click', release);
window.addEventListener('resize', () => renderCurrent());

window.__mutinePortraitV017 = {
  getState() {
    const frame = interactionFrame ?? timeline[currentStage] ?? timeline.at(-1);
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      refusals: frame.refusals.length,
      redirects: frame.redirects.length,
      armedBlade,
      signature: geometrySignature(frame),
      interaction: interactionFrame?.interaction ?? 'sequence'
    };
  },
  getFrame() { return interactionFrame ?? timeline[currentStage] ?? timeline.at(-1); },
  getDiagnostics() { return { seed: '0x53504637', threshold: GAZE_THRESHOLD }; },
  release
};

renderCurrent();
