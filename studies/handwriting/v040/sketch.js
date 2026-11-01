import {
  beginPressure,
  buildFrame,
  geometrySignature,
  HOLD_THRESHOLD,
  liftLatest,
  previewPressure,
  release,
  releasePressure,
  stateSignature
} from './engine.mjs';

const field = document.querySelector('#pressure-field');
const canvas = document.querySelector('#pressure-canvas');
const context = canvas.getContext('2d');
const stage = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const sourceReadout = document.querySelector('[data-source]');
const interactionState = document.querySelector('[data-interaction-state]');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const deterministicSources = [2, 0, 5, 7];
const staticDurations = [640, 1200, 900, 1680];
const palette = {
  ground: '#17130f',
  ink: '#eee1c8',
  muted: '#9c8d79',
  ember: '#ef936b',
  ochre: '#d9b36d',
  lilac: '#b9a6c9',
  sage: '#9eb99b',
  blue: '#96b6b3'
};
const messages = {
  quiet: 'The rack is quiet. No pressure is held.',
  'pressure armed': 'Pressure is held. The glyph remains geometrically exact.',
  'pressure held': 'Pressure is still held. Nothing has moved yet.',
  'pressure ready': 'Threshold reached. Release to transfer the debt elsewhere.',
  'pressure debt transferred': 'The source stayed exact. Three remote glyph chambers carry the debt.',
  'refused pressure': 'Refused. Pressure must be held for 640ms before it can become material.',
  'refused chamber': 'Refused. That position is not a glyph chamber.',
  'lifted latest': 'The latest pressure debt was lifted. The preceding rack is exact again.',
  release: 'Released. The rack is back at its quiet seed.',
  'pressure cancelled': 'Cancelled. The held pressure left no geometry behind.'
};

let frame = buildFrame();
let width = 1;
let height = 1;
let deviceScale = 1;
let animationFrame = 0;
let now = 0;
let activePointerId = null;
let uiTick = 0;

if (staticMode) {
  staticDurations.forEach((duration, index) => {
    frame = releasePressure(beginPressure(frame, deterministicSources[index], 0), duration);
  });
}

const rgba = (hex, alpha) => {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const resize = () => {
  const rect = field.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  deviceScale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * deviceScale);
  canvas.height = Math.round(height * deviceScale);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  render();
};

const pointFor = (chamber) => ({ x: chamber.x * width, y: chamber.y * height });
const chamberRadius = (chamber) => Math.min(width, height) * (0.055 + chamber.scale * 0.018);
const nearestChamber = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let nearest = null;
  let bestDistance = Infinity;
  for (const chamber of frame.field.chambers) {
    const point = pointFor(chamber);
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < bestDistance) {
      nearest = chamber.id;
      bestDistance = distance;
    }
  }
  return bestDistance <= Math.max(50, Math.min(width, height) * 0.12) ? nearest : null;
};

const modeColor = (mode) => mode === 'opened' ? palette.sage : mode === 'compressed' ? palette.lilac : mode === 'leaning' ? palette.ember : palette.ink;

const drawBackground = () => {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#2a2117');
  gradient.addColorStop(0.34, palette.ground);
  gradient.addColorStop(1, '#0e0c0a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(width * 0.52, height * 0.45, 0, width * 0.52, height * 0.45, Math.max(width, height) * 0.66);
  glow.addColorStop(0, rgba(palette.ochre, .12));
  glow.addColorStop(.45, rgba(palette.lilac, .035));
  glow.addColorStop(1, 'rgba(14, 12, 10, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.globalAlpha = .16;
  context.strokeStyle = palette.ink;
  context.lineWidth = .5;
  for (let index = 0; index < 18; index += 1) {
    const x = width * (0.1 + index * 0.052);
    context.beginPath();
    context.moveTo(x, height * .10);
    context.bezierCurveTo(x - width * .03, height * .34, x + width * .04, height * .66, x - width * .01, height * .90);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalAlpha = .18;
  for (let index = 0; index < 220; index += 1) {
    const x = ((index * 83 + 17) % 997) / 997 * width;
    const y = ((index * 47 + 71) % 991) / 991 * height;
    const size = .3 + ((index * 13) % 9) * .11;
    context.fillStyle = index % 7 === 0 ? palette.ochre : palette.ink;
    context.fillRect(x, y, size, size);
  }
  context.restore();
};

const drawRegister = () => {
  context.save();
  context.globalAlpha = .22;
  context.strokeStyle = rgba(palette.ochre, .52);
  context.lineWidth = .65;
  context.setLineDash([2, 12]);
  context.beginPath();
  context.moveTo(width * .08, height * .51);
  context.bezierCurveTo(width * .28, height * .44, width * .61, height * .58, width * .92, height * .48);
  context.stroke();
  context.setLineDash([]);
  context.restore();
};

const drawChamber = (chamber, index) => {
  const point = pointFor(chamber);
  const radius = chamberRadius(chamber);
  const color = modeColor(chamber.mode);
  const pending = frame.pending?.sourceId === chamber.id;
  const isChanged = chamber.mode !== 'quiet';
  const pulse = reducedMotion || staticMode ? 0 : Math.sin(now * .0011 + chamber.phase * Math.PI * 2) * .025;

  context.save();
  context.translate(point.x, point.y);
  context.rotate(chamber.angle * Math.PI / 180);

  if (isChanged || pending) {
    const halo = context.createRadialGradient(0, 0, radius * .25, 0, 0, radius * 2.8);
    halo.addColorStop(0, rgba(color, .19 + pulse));
    halo.addColorStop(.52, rgba(color, .045));
    halo.addColorStop(1, rgba(color, 0));
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, radius * 2.85, 0, Math.PI * 2);
    context.fill();
  }

  context.strokeStyle = rgba(color, .25);
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(0, 0, radius * (1.52 + chamber.counter * .24), radius * .54, 0, .12, Math.PI * 1.92);
  context.stroke();
  context.strokeStyle = rgba(color, .68);
  context.lineWidth = 1.2 + chamber.ink * 1.2;
  context.beginPath();
  context.ellipse(0, 0, radius * (1.15 + chamber.counter * .18), radius * .38, 0, -.48, Math.PI * .82);
  context.stroke();

  context.save();
  context.transform(1, 0, chamber.slant * .42, 1, 0, 0);
  context.scale(chamber.width * .72, 1);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const fontSize = Math.max(42, radius * 1.85);
  context.font = `700 ${fontSize}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
  context.shadowColor = rgba(color, .3);
  context.shadowBlur = radius * .18;
  context.fillStyle = rgba(color, Math.min(.94, .55 + chamber.ink * .42));
  context.fillText(chamber.glyph, 0, 0);
  context.shadowBlur = 0;
  context.strokeStyle = rgba(palette.ink, .12 + chamber.counter * .15);
  context.lineWidth = Math.max(.5, chamber.counter * 1.25);
  context.strokeText(chamber.glyph, 0, 0);
  context.restore();

  context.globalAlpha = .18 + chamber.counter * .18;
  context.strokeStyle = color;
  context.lineWidth = .7;
  context.beginPath();
  context.arc(0, 0, radius * (0.72 + chamber.counter * .45), Math.PI * (.2 + chamber.phase), Math.PI * (1.05 + chamber.phase));
  context.stroke();
  context.globalAlpha = .13;
  context.beginPath();
  context.arc(0, 0, radius * 1.42, Math.PI * (1.2 + chamber.phase), Math.PI * (1.75 + chamber.phase));
  context.stroke();

  if (pending) {
    const elapsed = Math.max(0, Math.min(HOLD_THRESHOLD * 1.4, (frame.pending.currentAt ?? now) - frame.pending.startedAt));
    const progress = Math.min(1, elapsed / HOLD_THRESHOLD);
    context.strokeStyle = progress >= 1 ? palette.ochre : palette.ember;
    context.lineWidth = 2.4;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.arc(0, 0, radius * 1.76, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    context.stroke();
    context.setLineDash([]);
  }

  context.restore();

  context.save();
  context.fillStyle = rgba(color, .4);
  context.font = '10px "DM Mono", monospace';
  context.textAlign = 'center';
  context.fillText(String(index + 1).padStart(2, '0'), point.x, point.y + radius * 1.86);
  context.restore();
};

const render = () => {
  context.clearRect(0, 0, width, height);
  drawBackground();
  drawRegister();
  frame.field.chambers.forEach(drawChamber);
};

const renderUi = () => {
  const pending = frame.pending;
  const source = pending ? frame.field.chambers[pending.sourceId] : null;
  sourceReadout.textContent = source ? source.glyph : '—';
  memoryReadout.textContent = `${frame.memory.length} debt${frame.memory.length === 1 ? '' : 's'} · 9 chambers`;
  stage.textContent = `${frame.lastEvent} / ${pending ? `holding ${source.glyph}` : 'no pressure held'}`;
  interactionState.textContent = messages[frame.lastEvent] ?? `The rack reports: ${frame.lastEvent}.`;
};

const announce = (next) => {
  frame = next;
  renderUi();
  render();
};

const nowForEvent = () => performance.now();
const deterministicCommit = (sourceId = 2, duration = HOLD_THRESHOLD + 1200) => {
  let next = beginPressure(frame, sourceId, 0);
  next = releasePressure(next, duration);
  announce(next);
};

field.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button')) return;
  const id = nearestChamber(event.clientX, event.clientY);
  if (id === null) return;
  activePointerId = event.pointerId;
  if (event.isTrusted) {
    try { field.setPointerCapture?.(event.pointerId); } catch { /* synthetic probes have no active pointer */ }
  }
  field.focus();
  announce(beginPressure(frame, id, nowForEvent()));
});

field.addEventListener('pointerup', (event) => {
  if (activePointerId !== event.pointerId) return;
  activePointerId = null;
  if (event.isTrusted) {
    try { field.releasePointerCapture?.(event.pointerId); } catch { /* synthetic probes have no active pointer */ }
  }
  announce(releasePressure(frame, nowForEvent()));
});

field.addEventListener('pointercancel', (event) => {
  if (activePointerId !== event.pointerId) return;
  activePointerId = null;
  field.releasePointerCapture?.(event.pointerId);
  announce({ ...frame, pending: null, lastEvent: 'pressure cancelled', changedChamberIds: [] });
});

field.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault();
    const index = frame.serial % deterministicSources.length;
    announce(beginPressure(frame, deterministicSources[index], nowForEvent()));
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (frame.pending) announce(releasePressure(frame, frame.pending.startedAt + HOLD_THRESHOLD + 1200));
    else deterministicCommit(deterministicSources[frame.serial % deterministicSources.length]);
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    announce(liftLatest(frame));
    return;
  }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') {
    event.preventDefault();
    announce({ ...release(), lastEvent: 'release' });
  }
});

document.querySelector('[data-action="press"]').addEventListener('click', () => {
  field.focus();
  deterministicCommit(2, HOLD_THRESHOLD + 1200);
});
document.querySelector('[data-action="lift"]').addEventListener('click', () => {
  field.focus();
  announce(liftLatest(frame));
});
document.querySelector('[data-action="release"]').addEventListener('click', () => {
  field.focus();
  announce({ ...release(), lastEvent: 'release' });
});

window.__mutineHandwritingV040 = {
  getFrame: () => frame,
  getState: () => ({
    memory: frame.memory.length,
    pending: frame.pending ? { ...frame.pending } : null,
    lastEvent: frame.lastEvent,
    changedChamberIds: [...frame.changedChamberIds],
    reducedMotion
  }),
  getSignature: () => geometrySignature(frame),
  getStateSignature: () => stateSignature(frame),
  getChambers: () => frame.field.chambers.map((chamber) => ({ ...chamber }))
};

new ResizeObserver(resize).observe(field);
resize();
renderUi();
window.__mutineReady = true;

const animate = (timestamp) => {
  now = timestamp;
  if (frame.pending) {
    frame = previewPressure(frame, timestamp);
    if (timestamp - uiTick > 80) {
      renderUi();
      uiTick = timestamp;
    }
  }
  render();
  animationFrame = window.requestAnimationFrame(animate);
};
if (!reducedMotion && !staticMode) animationFrame = window.requestAnimationFrame(animate);
void animationFrame;
