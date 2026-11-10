import {
  SITE_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  buildTimeline,
  geometrySignature,
  attendAt,
  withdrawAt,
  commitDefaultAttention,
  liftLatest,
  releaseAttention
} from './engine.mjs';

const frameElement = document.querySelector('#attention-frame');
const canvas = document.querySelector('#attention-field');
const context = canvas?.getContext('2d', { alpha: false });
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const palette = {
  ground: '#0b0c13',
  deep: '#11141f',
  ink: '#eee7d7',
  muted: '#9aa0ae',
  sulfur: '#d7d18c',
  coral: '#e18e72',
  sky: '#86b8bf',
  violet: '#8d84b7'
};
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  motion: !(staticMode || reducedMotion),
  pointerEntry: null,
  focusedSite: 3,
  width: 1,
  height: 1,
  raf: 0
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sitePoint = (site) => ({ x: site.x * state.width, y: site.y * state.height });
const pointFromClient = (clientX, clientY) => {
  const rect = canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return { x: clamp((clientX - rect.left) / rect.width, 0, 1), y: clamp((clientY - rect.top) / rect.height, 0, 1) };
};
const pickSite = (point) => {
  let best = 0;
  let bestDistance = Infinity;
  state.frame.field.sites.forEach((site, index) => {
    const dx = site.x - point.x;
    const dy = site.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return best;
};
const updateReadout = () => {
  const memory = state.frame.memory.length;
  const active = state.frame.gesture ? `witness ${state.frame.gesture.entry + 1} / ${SITE_COUNT}` : `${memory} ${memory === 1 ? 'return' : 'returns'}`;
  stageElement.textContent = `field ${String(state.frame.stage + 1).padStart(2, '0')} / ${MEMORY_LIMIT + 1}`;
  memoryElement.textContent = state.frame.gesture ? `attention held · ${active}` : `absence · ${active}`;
  rendererElement.textContent = `WEBGPU SIGNAL / CANVAS 2D / RECIPROCAL ABSENCE${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'attention-held') statusElement.textContent = `witness ${state.frame.gesture.entry + 1} held · withdraw toward its return`;
  else if (action === 'attention-returned') statusElement.textContent = `the field returned attention · absence moved to witness ${state.frame.field.absenceSite + 1}`;
  else if (action === 'attention-refused-witness') statusElement.textContent = `that witness is quiet · attend to ${state.frame.field.nextWitness + 1}`;
  else if (action === 'attention-refused-reply') statusElement.textContent = 'the field did not receive attention back at that witness';
  else if (action === 'attention-refused-no-return') statusElement.textContent = 'attention cannot return to the place it entered';
  else if (action === 'attention-refused-repeat') statusElement.textContent = 'one witness cannot hold a second gaze';
  else if (action === 'attention-refused-memory-limit') statusElement.textContent = 'the absence field is full · lift a return first';
  else if (action === 'attention-lifted') statusElement.textContent = 'the last absence lifted · the prior field resumes';
  else if (action === 'attention-released') statusElement.textContent = 'absence released · the quiet field returns';
  else statusElement.textContent = blindMode ? '' : `attend witness ${state.frame.field.nextWitness + 1} · withdraw toward its return`;
};
const setFrame = (frame) => {
  state.frame = frame;
  state.focusedSite = frame.field.nextWitness;
  updateReadout();
  draw(performance.now());
};
const resizeCanvas = () => {
  if (!frameElement || !canvas || !context) return;
  const rect = frameElement.getBoundingClientRect();
  state.width = Math.max(1, Math.floor(rect.width));
  state.height = Math.max(1, Math.floor(rect.height));
  canvas.width = state.width;
  canvas.height = state.height;
  draw(performance.now());
};
const drawBackdrop = (time) => {
  context.fillStyle = palette.ground;
  context.fillRect(0, 0, state.width, state.height);
  const cool = context.createRadialGradient(state.width * 0.18, state.height * 0.18, 0, state.width * 0.18, state.height * 0.18, state.width * 0.72);
  cool.addColorStop(0, 'rgba(134,184,191,.16)');
  cool.addColorStop(1, 'rgba(134,184,191,0)');
  context.fillStyle = cool;
  context.fillRect(0, 0, state.width, state.height);
  const warm = context.createRadialGradient(state.width * 0.82, state.height * 0.8, 0, state.width * 0.82, state.height * 0.8, state.width * 0.62);
  warm.addColorStop(0, 'rgba(225,142,114,.13)');
  warm.addColorStop(1, 'rgba(225,142,114,0)');
  context.fillStyle = warm;
  context.fillRect(0, 0, state.width, state.height);
  context.save();
  context.translate(state.width * 0.5, state.height * 0.5);
  const breath = state.motion ? Math.sin(time * 0.00045) * 0.006 : 0;
  context.strokeStyle = 'rgba(238,231,215,.04)';
  context.lineWidth = 1;
  for (let ring = 1; ring < 6; ring += 1) {
    context.beginPath();
    context.ellipse(0, 0, state.width * (0.08 + ring * 0.075 + breath), state.height * (0.11 + ring * 0.072 + breath), -0.12, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
};
const drawReturnAxis = (field) => {
  if (!field.memoryLength && !field.absenceHistory.length) return;
  const angle = field.returnAxis;
  const centerX = state.width * 0.5;
  const centerY = state.height * 0.5;
  const length = Math.max(state.width, state.height) * 0.72;
  context.save();
  context.translate(centerX, centerY);
  context.rotate(angle);
  context.strokeStyle = 'rgba(215,209,140,.11)';
  context.lineWidth = 1;
  context.setLineDash([2, 11]);
  context.beginPath();
  context.moveTo(-length, 0);
  context.lineTo(length, 0);
  context.stroke();
  context.setLineDash([]);
  context.strokeStyle = 'rgba(225,142,114,.11)';
  context.beginPath();
  context.ellipse(0, 0, state.width * 0.32, state.height * 0.11, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
};
const drawMemoryThreads = (frame) => {
  if (!frame.memory.length) return;
  context.save();
  context.lineWidth = 1;
  frame.memory.forEach((event, index) => {
    const entry = sitePoint(frame.field.sites[event.entry]);
    const reply = sitePoint(frame.field.sites[event.reply]);
    const bend = (index % 2 ? -1 : 1) * state.height * (0.06 + index * 0.012);
    context.strokeStyle = index % 2 ? 'rgba(134,184,191,.25)' : 'rgba(225,142,114,.25)';
    context.beginPath();
    context.moveTo(entry.x, entry.y);
    context.quadraticCurveTo((entry.x + reply.x) * 0.5, (entry.y + reply.y) * 0.5 + bend, reply.x, reply.y);
    context.stroke();
  });
  context.restore();
};
const drawCenterQuiet = () => {
  const radiusX = Math.min(state.width, state.height) * 0.09;
  const radiusY = radiusX * 0.68;
  const centerX = state.width * 0.5;
  const centerY = state.height * 0.5;
  const quiet = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusX * 1.7);
  quiet.addColorStop(0, 'rgba(4,5,9,.96)');
  quiet.addColorStop(.65, 'rgba(11,12,19,.8)');
  quiet.addColorStop(1, 'rgba(11,12,19,0)');
  context.fillStyle = quiet;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX * 1.7, radiusY * 1.7, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(238,231,215,.12)';
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.stroke();
};
const drawSite = (site, index, field, time) => {
  const point = sitePoint(site);
  const scale = Math.min(state.width, state.height);
  const radius = scale * site.radius * (1 + site.attention * 0.17);
  const pulse = state.motion ? Math.sin(time * 0.0011 + index * 0.64) * 0.8 : 0;
  const isNext = index === field.nextWitness;
  const isAbsence = index === field.absenceSite;
  const hue = isAbsence ? palette.coral : isNext ? palette.sulfur : index % 3 === 0 ? palette.sky : palette.violet;
  context.save();
  context.translate(point.x, point.y);
  context.rotate(site.gap + pulse * 0.012);
  context.lineCap = 'round';
  context.lineWidth = isNext || isAbsence ? 2 : 1;
  context.strokeStyle = isAbsence ? 'rgba(225,142,114,.84)' : isNext ? 'rgba(215,209,140,.96)' : `rgba(${index % 3 === 0 ? '134,184,191' : '141,132,183'},${0.28 + site.echo * 0.34})`;
  context.beginPath();
  context.arc(0, 0, radius + pulse, site.aperture, Math.PI * 2 - site.aperture * 0.36);
  context.stroke();
  context.lineWidth = .7;
  context.strokeStyle = isAbsence ? 'rgba(225,142,114,.38)' : 'rgba(238,231,215,.18)';
  context.beginPath();
  context.arc(0, 0, radius * 0.58, site.aperture + 0.42, Math.PI * 1.68 - site.aperture * 0.2);
  context.stroke();
  context.strokeStyle = hue;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-radius * 1.55, 0);
  context.lineTo(-radius * .55, 0);
  context.moveTo(radius * .55, 0);
  context.lineTo(radius * 1.55, 0);
  context.stroke();
  if (isAbsence) {
    context.fillStyle = 'rgba(4,5,9,.92)';
    context.beginPath();
    context.ellipse(0, 0, radius * 1.16, radius * .82, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(225,142,114,.62)';
    context.setLineDash([1, 5]);
    context.beginPath();
    context.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }
  if (isNext) {
    context.fillStyle = 'rgba(215,209,140,.8)';
    context.beginPath();
    context.arc(0, 0, 2.2, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
};
const draw = (time) => {
  if (!context) return;
  drawBackdrop(time);
  drawReturnAxis(state.frame.field);
  drawMemoryThreads(state.frame);
  drawCenterQuiet();
  state.frame.field.sites.forEach((site, index) => drawSite(site, index, state.frame.field, time));
};
const animate = (time) => {
  draw(time);
  if (state.motion) state.raf = requestAnimationFrame(animate);
};
const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event })),
  signature: geometrySignature(state.frame),
  gesture: state.frame.gesture ? { ...state.frame.gesture } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  siteCount: SITE_COUNT,
  absenceSite: state.frame.field.absenceSite,
  absenceHistory: [...state.frame.field.absenceHistory],
  nextWitness: state.frame.field.nextWitness,
  memoryLimit: MEMORY_LIMIT,
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable)
});

const onPointerDown = (event) => {
  if (event.target !== canvas) return;
  const site = pickSite(pointFromClient(event.clientX, event.clientY));
  state.pointerEntry = site;
  state.focusedSite = site;
  setFrame(attendAt(state.frame, site));
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture?.(event.pointerId);
  event.preventDefault();
};
const onPointerUp = (event) => {
  if (event.target !== canvas || state.pointerEntry === null) return;
  const site = pickSite(pointFromClient(event.clientX, event.clientY));
  setFrame(withdrawAt(state.frame, site));
  state.pointerEntry = null;
  event.preventDefault();
};
const stopCanvasGesture = (event) => event.stopPropagation();

const setup = () => {
  if (!canvas || !context) return;
  resizeCanvas();
  updateReadout();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { state.pointerEntry = null; });
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { state.focusedSite = (state.focusedSite + 1) % SITE_COUNT; event.preventDefault(); }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { state.focusedSite = (state.focusedSite - 1 + SITE_COUNT) % SITE_COUNT; event.preventDefault(); }
    if (event.key === 'Enter' || event.key === ' ') { setFrame(commitDefaultAttention(state.frame)); event.preventDefault(); }
    if (event.key === 'Delete' || event.key === 'Backspace') { setFrame(liftLatest(state.frame)); event.preventDefault(); }
    if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { setFrame(releaseAttention()); event.preventDefault(); }
    if (event.key.toLowerCase() === 's') {
      const link = document.createElement('a');
      link.download = 'mutine-webgpu-v049.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      event.preventDefault();
    }
  });
  const attendButton = document.querySelector('[data-gesture="attend"]');
  const liftButton = document.querySelector('[data-gesture="lift"]');
  const releaseButton = document.querySelector('[data-gesture="release"]');
  for (const button of [attendButton, liftButton, releaseButton]) {
    button?.addEventListener('pointerdown', stopCanvasGesture);
    button?.addEventListener('pointerup', stopCanvasGesture);
    button?.addEventListener('mousedown', stopCanvasGesture);
    button?.addEventListener('mouseup', stopCanvasGesture);
  }
  attendButton?.addEventListener('click', () => setFrame(commitDefaultAttention(state.frame)));
  liftButton?.addEventListener('click', () => setFrame(liftLatest(state.frame)));
  releaseButton?.addEventListener('click', () => setFrame(releaseAttention()));
  window.addEventListener('resize', resizeCanvas);
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(frameElement);
  window.__mutineWebGPUV049 = { getState: exposeState, getFrame: () => state.frame };
  window._p5Ready = true;
  if (state.motion) state.raf = requestAnimationFrame(animate);
  else draw(performance.now());
};

setup();
