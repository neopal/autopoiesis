import {
  STAGES,
  buildFrame,
  buildTimeline,
  primeVault,
  tickVault,
  commitPressure,
  liftLatestPressure,
  releaseArchive,
  defaultPressure
} from './engine.mjs';

const canvas = document.querySelector('#vault-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  renderer: 'CANVAS / PRESSURE VAULT'
};
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const TAU = Math.PI * 2;
const PALETTE = {
  ground: [16, 18, 15],
  deep: [7, 9, 6],
  bone: [241, 234, 215],
  moss: [155, 179, 138],
  oxide: [209, 118, 88],
  sulfur: [216, 189, 115],
  shadow: [2, 3, 2]
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a.map((value, index) => Math.round(value + (b[index] - value) * amount));
const rgba = (rgb, alpha) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.713 + 3.17) * 43758.5453;
  return raw - Math.floor(raw);
};
const polygon = (points) => {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
};
const add = (point, delta) => ({ x: point.x + delta.x, y: point.y + delta.y });
const resize = () => {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.view = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
  canvas.width = Math.floor(state.view.width * dpr);
  canvas.height = Math.floor(state.view.height * dpr);
  gpuCanvas.width = Math.floor(state.view.width * dpr);
  gpuCanvas.height = Math.floor(state.view.height * dpr);
  render(performance.now());
};
const panelProjection = (panel, width, height, time) => {
  const span = Math.min(width, height);
  const drift = reducedMotion || staticMode ? 0 : Math.sin(time * 0.00017 + panel.id * 0.61) * 0.004;
  const depthScale = 0.78 + panel.depth * 0.34;
  const center = {
    x: width * 0.5 + panel.x * span * 0.78 + (panel.depth - 0.5) * span * 0.08 + drift * span,
    y: height * 0.54 + panel.y * span * 0.62 + (panel.depth - 0.5) * span * 0.05
  };
  const halfWidth = span * (0.035 + depthScale * 0.018);
  const halfHeight = span * (0.19 + depthScale * 0.045);
  const skew = (panel.yaw + drift) * halfHeight * 0.42;
  const droop = panel.pitch * halfWidth * 0.7;
  const slip = panel.slip * span * 0.014;
  const points = [
    { x: center.x - halfWidth + skew, y: center.y - halfHeight + droop - slip },
    { x: center.x + halfWidth + skew, y: center.y - halfHeight - droop + slip * 0.4 },
    { x: center.x + halfWidth - skew, y: center.y + halfHeight + droop + slip },
    { x: center.x - halfWidth - skew, y: center.y + halfHeight - droop - slip * 0.4 }
  ];
  return { center, points, halfWidth, halfHeight, depthScale, span };
};
const drawBackground = (width, height) => {
  const gradient = ctx.createRadialGradient(width * 0.54, height * 0.47, 0, width * 0.5, height * 0.52, Math.max(width, height) * 0.82);
  gradient.addColorStop(0, '#24291f');
  gradient.addColorStop(0.33, '#171b14');
  gradient.addColorStop(0.72, '#0b0e0a');
  gradient.addColorStop(1, '#050604');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let index = 0; index < 180; index += 1) {
    const x = pseudo(index * 1.13 + 3) * width;
    const y = pseudo(index * 2.41 + 9) * height;
    const size = pseudo(index * 3.91 + 17) * 1.2 + 0.2;
    ctx.fillStyle = index % 4 ? rgba(PALETTE.bone, 0.18) : rgba(PALETTE.moss, 0.26);
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};
const drawVaultShadow = (width, height) => {
  const span = Math.min(width, height);
  const shadow = ctx.createRadialGradient(width * 0.5, height * 0.56, span * 0.04, width * 0.5, height * 0.56, span * 0.46);
  shadow.addColorStop(0, 'rgba(0,0,0,.82)');
  shadow.addColorStop(0.58, 'rgba(0,0,0,.38)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, width, height);
};
const panelInset = (projection, panel) => {
  const [a, b, c, d] = projection.points;
  const aperture = 0.23 + panel.aperture * 0.29;
  const vertical = 0.21 + panel.aperture * 0.18;
  const top = {
    x: a.x + (b.x - a.x) * aperture,
    y: a.y + (b.y - a.y) * vertical
  };
  const topRight = {
    x: b.x - (b.x - a.x) * aperture,
    y: b.y + (c.y - b.y) * vertical
  };
  const bottomRight = {
    x: c.x - (c.x - d.x) * aperture * 0.8,
    y: c.y - (c.y - b.y) * vertical
  };
  const bottomLeft = {
    x: d.x + (c.x - d.x) * aperture * 0.8,
    y: d.y - (d.y - a.y) * vertical
  };
  return [top, topRight, bottomRight, bottomLeft];
};
const drawPanel = (panel, width, height, time) => {
  const projection = panelProjection(panel, width, height, time);
  const [a, b, c, d] = projection.points;
  const sideShift = {
    x: projection.span * (0.009 + panel.depth * 0.013),
    y: projection.span * (0.006 + panel.slip * 0.012)
  };
  const side = [b, c, add(c, sideShift), add(b, sideShift)];
  ctx.save();
  polygon([add(a, sideShift), add(b, sideShift), add(c, sideShift), add(d, sideShift)]);
  ctx.fillStyle = rgba(PALETTE.shadow, 0.76);
  ctx.fill();
  polygon(side);
  ctx.fillStyle = rgba(mix(PALETTE.deep, PALETTE.oxide, panel.slip * 0.62), 0.7);
  ctx.fill();
  const bodyGradient = ctx.createLinearGradient(a.x, a.y, c.x, c.y);
  const bodyTone = mix(PALETTE.moss, PALETTE.bone, panel.shade * 0.34);
  bodyGradient.addColorStop(0, rgba(mix(bodyTone, PALETTE.deep, 0.58), 0.88));
  bodyGradient.addColorStop(0.46, rgba(bodyTone, 0.94));
  bodyGradient.addColorStop(1, rgba(mix(bodyTone, PALETTE.oxide, panel.slip * 0.34), 0.86));
  polygon(projection.points);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.strokeStyle = rgba(PALETTE.bone, 0.18 + panel.tension * 0.22);
  ctx.lineWidth = Math.max(0.55, projection.span * 0.0011);
  ctx.stroke();
  const aperture = panelInset(projection, panel);
  polygon(aperture);
  const apertureGradient = ctx.createLinearGradient(aperture[0].x, aperture[0].y, aperture[2].x, aperture[2].y);
  apertureGradient.addColorStop(0, rgba(PALETTE.deep, 0.96));
  apertureGradient.addColorStop(0.5, rgba(PALETTE.shadow, 0.92));
  apertureGradient.addColorStop(1, rgba(mix(PALETTE.deep, PALETTE.oxide, panel.slip * 0.34), 0.94));
  ctx.fillStyle = apertureGradient;
  ctx.fill();
  ctx.strokeStyle = rgba(panel.slip > 0.16 ? PALETTE.oxide : PALETTE.sulfur, 0.28 + panel.slip * 0.36);
  ctx.lineWidth = Math.max(0.45, projection.span * 0.0009);
  ctx.stroke();
  if (panel.slip > 0.08) {
    const echo = aperture.map((point, index) => add(point, { x: (index % 2 ? 1 : -1) * panel.slip * projection.span * 0.02, y: panel.slip * projection.span * 0.012 }));
    polygon(echo);
    ctx.strokeStyle = rgba(PALETTE.oxide, 0.22 + panel.slip * 0.3);
    ctx.setLineDash([projection.span * 0.006, projection.span * 0.012]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 0.14 + panel.tension * 0.18;
  ctx.strokeStyle = rgba(PALETTE.bone, 0.7);
  ctx.lineWidth = Math.max(0.4, projection.span * 0.00065);
  for (let mark = 1; mark < 5; mark += 1) {
    const amount = mark / 5;
    const left = { x: a.x + (d.x - a.x) * amount, y: a.y + (d.y - a.y) * amount };
    const right = { x: b.x + (c.x - b.x) * amount, y: b.y + (c.y - b.y) * amount };
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
  ctx.restore();
};
const drawVault = (width, height, time) => {
  const panels = [...state.frame.field.panels].sort((a, b) => a.depth - b.depth);
  panels.forEach((panel) => drawPanel(panel, width, height, time));
};
const drawPressureBeat = (width, height) => {
  if (blindMode || !state.frame.pressure) return;
  const span = Math.min(width, height);
  const x = width - span * 0.11;
  const y = height * 0.13;
  ctx.save();
  ctx.strokeStyle = rgba(PALETTE.oxide, 0.72);
  ctx.lineWidth = Math.max(1, span * 0.0012);
  ctx.setLineDash([span * 0.008, span * 0.011]);
  ctx.strokeRect(x - span * 0.028, y - span * 0.028, span * 0.056, span * 0.056);
  ctx.setLineDash([]);
  ctx.fillStyle = rgba(PALETTE.oxide, 0.82);
  ctx.fillRect(x - span * 0.004, y - span * 0.004, span * 0.008, span * 0.008);
  ctx.restore();
};
const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `pressure ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'slip' : 'slips'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'pressure-committed') statusElement.textContent = 'pressure closed · the vault slipped elsewhere';
  else if (state.frame.lastAction === 'pressure-armed' || state.frame.lastAction === 'pressure-waiting') statusElement.textContent = 'first beat stored · tap again to close the interval';
  else if (state.frame.lastAction === 'pressure-refused-bounds') statusElement.textContent = 'interval refused · keep the delay bounded';
  else if (state.frame.lastAction === 'pressure-refused-no-arm') statusElement.textContent = 'no pressure sample · the vault stays quiet';
  else if (state.frame.lastAction === 'pressure-lifted') statusElement.textContent = 'latest slip lifted · the prior depth returns';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'vault full · lift or release before another pressure';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'vault released · depth returns to quiet';
  else statusElement.textContent = 'tap twice · the delay becomes pressure elsewhere';
};
const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawBackground(width, height);
  drawVaultShadow(width, height);
  drawVault(width, height, now);
  drawPressureBeat(width, height);
  updateReadout();
  state.gpu?.render();
};
const renderState = (next) => { state.frame = next; render(); };
const deterministicPressure = () => {
  let next = primeVault(state.frame, { at: 0 });
  if (!next.pressure) return renderState(next);
  next = commitPressure(next, { committedAt: defaultPressure(state.frame) });
  renderState(next);
};
const pressureGesture = () => {
  if (!state.frame.pressure) {
    renderState(primeVault(state.frame, { at: performance.now() }));
    return;
  }
  renderState(commitPressure(tickVault(state.frame, { at: performance.now() }), { committedAt: performance.now() }));
};
const lift = () => renderState(liftLatestPressure(state.frame));
const release = () => renderState(releaseArchive());
const keyboard = (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pressureGesture(); }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
};
const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    if (!context) return;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let grain = 0.009 * sin(pos.x * 0.023 + pos.y * 0.009); let seam = 0.012 * sin(pos.x * 0.004 + pos.y * 0.027); return vec4f(0.11 + grain, 0.14 + seam, 0.08 + grain, 0.11); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / VAULT VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};
const animate = (now) => {
  render(now);
  if (!reducedMotion && !staticMode) requestAnimationFrame(animate);
};

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  pressureGesture();
});
canvas.addEventListener('keydown', keyboard);
document.querySelector('[data-gesture="pressure"]').addEventListener('click', deterministicPressure);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);
window.__mutineWebGPUV035 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    pressure: state.frame.pressure,
    signature: state.frame.field.signature,
    panels: state.frame.field.panels.map((panel) => ({ ...panel })),
    event: state.frame.memory.at(-1) ?? null,
    lastAction: state.frame.lastAction,
    renderer: state.renderer
  })
};
resize();
setupGPU();
if (!reducedMotion && !staticMode) requestAnimationFrame(animate);
