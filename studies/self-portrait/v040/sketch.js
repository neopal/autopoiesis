import {
  buildField,
  buildTimeline,
  geometrySignature,
  pulse,
  sealCadence,
  liftLatest,
  releaseField
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const staticMode = params.get('static') === '1' || params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const demoSites = [2, 8, 2];
const demoGaps = [0.22, 0.61, 0.24];

let field;
let stageNode;
let canvasNode;
let readoutNode;
let memoryNode;
let stateNode;
let hintNode;
let interactionNode;
let ctx;
let lastPulseAt = 0;
let demoStep = 0;
let frameTime = 0;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rounded = (value) => Number(Number(value).toFixed(4));

function unit() {
  return Math.min(canvasNode.width, canvasNode.height) * 0.43;
}

function center() {
  return { x: canvasNode.width * 0.5, y: canvasNode.height * 0.51 };
}

function aperturePoint(aperture) {
  const scale = unit();
  const origin = center();
  return {
    x: origin.x + (aperture.x + field.mask.offsetX) * scale,
    y: origin.y + (aperture.y + field.mask.offsetY) * scale,
    scale
  };
}

function outlinePath(context, margin = 1) {
  const origin = center();
  const scale = unit() * field.mask.scale;
  const points = 28;
  context.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const theta = (i / points) * TAU;
    const wobble = 1 + 0.035 * Math.sin(theta * 3 + 1.7) + 0.018 * Math.cos(theta * 7 - 0.8);
    const vertical = 1 + 0.06 * Math.sin(theta * 2 - 0.4) * field.mask.bulge;
    const x = origin.x + Math.cos(theta) * scale * 0.68 * wobble;
    const y = origin.y + Math.sin(theta) * scale * 1.08 * vertical;
    if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.closePath();
  if (margin !== 1) {
    context.save();
    context.translate(origin.x, origin.y);
    context.scale(margin, margin);
    context.translate(-origin.x, -origin.y);
  }
}

function aperturePath(context, aperture, margin = 1) {
  const point = aperturePoint(aperture);
  const rx = point.scale * aperture.radius * 0.93 * margin;
  const ry = point.scale * aperture.radius * (1.2 + aperture.cut * 0.56) * margin;
  const sides = 10;
  context.beginPath();
  for (let i = 0; i <= sides; i += 1) {
    const theta = (i / sides) * TAU;
    const wobble = 1 + 0.09 * Math.sin(theta * 3 + aperture.index * 1.7) + 0.04 * Math.cos(theta * 5);
    const x = point.x + Math.cos(theta) * rx * wobble;
    const y = point.y + Math.sin(theta) * ry * (1 + 0.05 * Math.sin(theta * 2 + aperture.index));
    const rotatedX = point.x + Math.cos(aperture.angle) * (x - point.x) - Math.sin(aperture.angle) * (y - point.y);
    const rotatedY = point.y + Math.sin(aperture.angle) * (x - point.x) + Math.cos(aperture.angle) * (y - point.y);
    if (i === 0) context.moveTo(rotatedX, rotatedY); else context.lineTo(rotatedX, rotatedY);
  }
  context.closePath();
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.floor(canvasNode.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvasNode.clientHeight * ratio));
  if (canvasNode.width !== width || canvasNode.height !== height) {
    canvasNode.width = width;
    canvasNode.height = height;
  }
}

function drawBackground(now) {
  const width = canvasNode.width;
  const height = canvasNode.height;
  const drift = staticMode || reducedMotion ? 0 : now * 0.000018;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#101c29');
  gradient.addColorStop(0.47, '#0d151f');
  gradient.addColorStop(1, '#11121b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.2, height * 0.18, 0, width * 0.2, height * 0.18, width * 0.66);
  glow.addColorStop(0, 'rgba(121,215,204,.16)');
  glow.addColorStop(0.62, 'rgba(121,215,204,.035)');
  glow.addColorStop(1, 'rgba(121,215,204,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = 'rgba(238,230,210,.07)';
  ctx.lineWidth = Math.max(1, width * 0.0006);
  for (let i = -8; i < 18; i += 1) {
    const x = i * width * 0.12 + Math.sin(i * 2.3 + drift) * width * 0.02;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height * 0.38, height);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  for (let i = 0; i < 86; i += 1) {
    const x = (Math.sin(i * 91.17 + 2.4) * 0.5 + 0.5) * width;
    const y = (Math.sin(i * 47.31 + 5.1) * 0.5 + 0.5) * height;
    const size = 0.5 + (i % 5) * 0.35;
    ctx.fillStyle = i % 7 === 0 ? 'rgba(255,150,119,.28)' : 'rgba(238,230,210,.13)';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

function drawMask(now) {
  const origin = center();
  const scale = unit() * field.mask.scale;
  const drift = staticMode || reducedMotion ? 0 : Math.sin(now * 0.0004) * 0.006;

  ctx.save();
  outlinePath(ctx, 1.04);
  ctx.shadowColor = 'rgba(0,0,0,.58)';
  ctx.shadowBlur = scale * 0.22;
  ctx.shadowOffsetY = scale * 0.08;
  ctx.fillStyle = 'rgba(1,4,8,.74)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(field.mask.tilt * 0.38 + drift);
  ctx.translate(-origin.x, -origin.y);
  outlinePath(ctx, 1);
  const bodyGradient = ctx.createLinearGradient(origin.x - scale * 0.7, origin.y - scale, origin.x + scale * 0.8, origin.y + scale);
  bodyGradient.addColorStop(0, '#f0e6cf');
  bodyGradient.addColorStop(.35, '#c9c4d4');
  bodyGradient.addColorStop(.67, '#91d3cc');
  bodyGradient.addColorStop(1, '#e78d72');
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(238,230,210,.74)';
  ctx.lineWidth = Math.max(1.4, scale * 0.008);
  ctx.stroke();

  ctx.save();
  outlinePath(ctx, 0.96);
  ctx.clip();
  for (let i = -4; i < 10; i += 1) {
    const y = origin.y - scale * 1.1 + i * scale * 0.18;
    ctx.strokeStyle = i % 3 === 0 ? 'rgba(11,16,24,.15)' : 'rgba(255,255,255,.1)';
    ctx.lineWidth = scale * 0.012;
    ctx.beginPath();
    ctx.moveTo(origin.x - scale * .78, y);
    ctx.bezierCurveTo(origin.x - scale * .25, y + scale * .06, origin.x + scale * .3, y - scale * .05, origin.x + scale * .78, y + scale * .025);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const aperture of field.apertures) {
    aperturePath(ctx, aperture);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  for (const aperture of field.apertures) {
    const point = aperturePoint(aperture);
    const active = aperture.state !== 'quiet';
    ctx.save();
    aperturePath(ctx, aperture, 1.03);
    ctx.strokeStyle = active
      ? (aperture.state === 'hollow' ? 'rgba(255,150,119,.9)' : aperture.state === 'scar' ? 'rgba(121,215,204,.92)' : 'rgba(188,169,255,.92)')
      : 'rgba(11,16,24,.5)';
    ctx.lineWidth = active ? scale * 0.012 : scale * 0.006;
    ctx.stroke();
    ctx.restore();
    if (active) {
      ctx.fillStyle = aperture.state === 'hollow' ? 'rgba(255,150,119,.16)' : aperture.state === 'scar' ? 'rgba(121,215,204,.16)' : 'rgba(188,169,255,.16)';
      ctx.beginPath();
      ctx.arc(point.x, point.y, scale * 0.012, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(field.mask.tilt * 0.38 + drift);
  ctx.translate(-origin.x, -origin.y);
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = 'rgba(11,16,24,.62)';
  ctx.lineWidth = Math.max(2, scale * 0.018);
  ctx.beginPath();
  const seamX = origin.x + field.mask.seam * scale;
  ctx.moveTo(seamX - scale * .01, origin.y - scale * .98);
  ctx.bezierCurveTo(seamX + scale * .12, origin.y - scale * .45, seamX - scale * .1, origin.y + scale * .35, seamX + scale * .05, origin.y + scale * 1.02);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255,150,119,.36)';
  ctx.lineWidth = Math.max(1, scale * 0.004);
  ctx.beginPath();
  ctx.moveTo(seamX + scale * .025, origin.y - scale * .98);
  ctx.bezierCurveTo(seamX + scale * .155, origin.y - scale * .42, seamX - scale * .05, origin.y + scale * .38, seamX + scale * .08, origin.y + scale * 1.02);
  ctx.stroke();
  ctx.restore();
}

function drawFrame(now = 0) {
  resize();
  drawBackground(now);
  drawMask(now);
}

function stateText(stage) {
  return {
    quiet: 'the mask is waiting for a return',
    'pulse / 1': 'the first visit is held without geometry',
    'pulse / 2': 'the middle visit interrupts the return',
    'pulse / 3': 'the return is ready to seal',
    'sealed / return': 'the cadence cut the mask elsewhere',
    'lifted / exact': 'the last remote cut was lifted exactly',
    released: 'the mask is quiet again'
  }[stage] ?? 'the mask is deciding';
}

function render(stage = field.interaction) {
  drawFrame(frameTime);
  const pulseCount = field.pulses.length;
  readoutNode.textContent = `${stage} / ${String(field.revision).padStart(2, '0')} · ${pulseCount} pulse${pulseCount === 1 ? '' : 's'}`;
  memoryNode.textContent = `${field.memory.length} return${field.memory.length === 1 ? '' : 's'} held`;
  stateNode.textContent = stateText(stage);
  interactionNode.textContent = stateText(stage);
  hintNode.textContent = pulseCount === 0 ? 'pulse a cut · visit another · return · seal' : pulseCount === 1 ? 'visit another cut · the mask still holds' : pulseCount === 2 ? 'return to the first cut · then seal' : 'seal the return · let the mask recut itself';
}

function sendPulse(site, explicitGap = null) {
  if (staticMode) return field;
  const now = performance.now();
  const gap = explicitGap ?? (lastPulseAt ? clamp((now - lastPulseAt) / 1000, 0.05, 1.8) : 0.22);
  lastPulseAt = now;
  field = pulse(field, { site, gap });
  stageNode.focus({ preventScroll: true });
  render(field.interaction);
  return field;
}

function sendDemoPulse() {
  const index = field.pulses.length % demoSites.length;
  const next = sendPulse(demoSites[index], demoGaps[index]);
  demoStep = (demoStep + 1) % demoSites.length;
  return next;
}

function seal() {
  if (staticMode) return { accepted: false, field };
  const result = sealCadence(field);
  field = result.field;
  demoStep = 0;
  render(result.accepted ? 'sealed / return' : field.interaction);
  return result;
}

function lift() {
  if (staticMode) return field;
  field = liftLatest(field);
  demoStep = 0;
  render('lifted / exact');
  return field;
}

function release() {
  if (staticMode) return field;
  field = releaseField();
  demoStep = 0;
  lastPulseAt = 0;
  render('released');
  return field;
}

function siteFromEvent(event) {
  const rect = canvasNode.getBoundingClientRect();
  const scaleX = canvasNode.width / rect.width;
  const scaleY = canvasNode.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  let best = 0;
  let bestDistance = Infinity;
  field.apertures.forEach((aperture) => {
    const point = aperturePoint(aperture);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = aperture.index; }
  });
  return best;
}

function bindControls() {
  stageNode.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      sendPulse(2, 0.22);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      sendPulse(8, 0.61);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      sendPulse(7, 0.34);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      sendPulse(3, 0.48);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      seal();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key === 'r' || event.key === 'R' || event.key === 'Escape') {
      event.preventDefault();
      release();
    }
  });
  canvasNode.addEventListener('pointerdown', (event) => {
    if (staticMode) return;
    event.preventDefault();
    canvasNode.setPointerCapture?.(event.pointerId);
    sendPulse(siteFromEvent(event));
  });
  canvasNode.addEventListener('pointerup', (event) => {
    if (canvasNode.hasPointerCapture?.(event.pointerId)) canvasNode.releasePointerCapture(event.pointerId);
  });
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.action === 'pulse') sendDemoPulse();
      if (button.dataset.action === 'seal') seal();
      if (button.dataset.action === 'lift') lift();
      if (button.dataset.action === 'release') release();
    });
  });
}

function animate(now) {
  frameTime = now;
  drawFrame(now);
  if (!staticMode && !reducedMotion) requestAnimationFrame(animate);
}

function setup() {
  stageNode = document.querySelector('[data-return-stage]');
  canvasNode = document.querySelector('[data-return-canvas]');
  readoutNode = document.querySelector('[data-stage]');
  memoryNode = document.querySelector('[data-memory]');
  stateNode = document.querySelector('[data-state]');
  hintNode = document.querySelector('[data-hint]');
  interactionNode = document.querySelector('[data-interaction-state]');
  ctx = canvasNode.getContext('2d', { alpha: true, desynchronized: true });
  field = staticMode ? buildTimeline().at(-1) : buildField();
  bindControls();
  render(staticMode ? 'sealed / return' : 'quiet');
  window.addEventListener('resize', () => render(field.interaction));
  window.__mutinePortraitV040 = {
    getState: () => structuredClone(field),
    pulse: (site, gap = 0.42) => sendPulse(site, gap),
    seal,
    lift,
    release,
    geometrySignature: () => geometrySignature(field),
    context: ctx
  };
  window.dispatchEvent(new CustomEvent('mutine:ready', { detail: 'portrait-v040' }));
  if (!staticMode && !reducedMotion) requestAnimationFrame(animate);
}

setup();
