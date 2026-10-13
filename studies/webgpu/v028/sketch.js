import {
  CAVITY_COUNT,
  STAGES,
  armFocus,
  buildTimeline,
  commitAbsence,
  defaultFocus,
  geometrySignature,
  liftLatestAbsence,
  releaseArchive
} from './engine.mjs';

const canvas = document.querySelector('#vacancy-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  selectedCavity: 5,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  points: [],
  gpu: null,
  renderer: 'CANVAS / OBJECT'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const cavityElement = document.querySelector('[data-cavity]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#061013',
  deep: '#091418',
  shell: '#1a5055',
  shellLight: '#6aa89b',
  glass: '#9ed4bf',
  light: '#e8d8b3',
  coral: '#dd866f',
  rust: '#935b50',
  void: '#02090b',
  mist: 'rgba(158, 212, 191, .18)'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.4847) * 43758.5453;
  return raw - Math.floor(raw);
};
const lerp = (a, b, amount) => a + (b - a) * amount;

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

const project = (cavity, width, height, time) => {
  const motion = reducedMotion || staticMode ? 0 : time * 0.00012;
  const depth = 1 + cavity.z * 0.26 + cavity.depthShift;
  const breathing = Math.sin(motion + cavity.id * 0.63) * 0.005;
  const scale = Math.min(width, height) * (0.88 + breathing) * depth;
  return {
    x: width * 0.5 + (cavity.x + cavity.depthShift * 0.16) * width * 0.39 * depth,
    y: height * 0.52 + (cavity.y - cavity.depthShift * 0.09) * height * 0.4 * depth,
    width: scale * cavity.width,
    height: scale * cavity.height,
    depth
  };
};

const drawGrain = (width, height) => {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = PALETTE.light;
  for (let index = 0; index < 420; index += 1) {
    const x = pseudo(index * 1.31 + 22) * width;
    const y = pseudo(index * 2.77 + 17) * height;
    const size = pseudo(index * 4.07 + 5) * 1.1 + 0.15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.52, height * 0.45, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.8);
  gradient.addColorStop(0, '#173f42');
  gradient.addColorStop(.32, '#0d292e');
  gradient.addColorStop(.7, PALETTE.deep);
  gradient.addColorStop(1, '#02090b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawGrain(width, height);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = PALETTE.glass;
  ctx.lineWidth = Math.max(0.6, Math.min(width, height) * 0.001);
  const breathe = reducedMotion || staticMode ? 0 : Math.sin(time * 0.0002) * 0.018;
  ctx.beginPath();
  ctx.ellipse(width * (0.5 + breathe), height * 0.51, width * 0.38, height * 0.41, -0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.08;
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.51, width * 0.28, height * 0.3, 0.14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const shellPolygon = (shell, width, height, offset = 0) => {
  const cx = width * 0.5 + shell.x * width * 0.32 + shell.shift * width * 0.08;
  const cy = height * 0.51 + shell.y * height * 0.24 + shell.shift * height * 0.04;
  const sx = width * shell.width * 0.25;
  const sy = height * shell.height * 0.3;
  const angle = -0.16 + shell.tilt * 0.22 + offset;
  const rotate = (x, y) => ({ x: cx + x * Math.cos(angle) - y * Math.sin(angle), y: cy + x * Math.sin(angle) + y * Math.cos(angle) });
  return [rotate(-sx, -sy), rotate(sx, -sy * 0.82), rotate(sx * 0.94, sy), rotate(-sx * 1.05, sy * 0.9)];
};

const drawPolygon = (points, fill, stroke = null, alpha = 1) => {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  ctx.restore();
};

const drawMonolith = (width, height) => {
  const center = { x: width * 0.5, y: height * 0.51 };
  const body = [
    { x: width * 0.17, y: height * 0.17 },
    { x: width * 0.78, y: height * 0.12 },
    { x: width * 0.87, y: height * 0.79 },
    { x: width * 0.21, y: height * 0.88 }
  ];
  const top = [body[0], body[1], { x: body[1].x - width * 0.06, y: body[1].y - height * 0.065 }, { x: body[0].x - width * 0.055, y: body[0].y - height * 0.045 }];
  const side = [body[1], { x: body[1].x + width * 0.055, y: body[1].y + height * 0.045 }, { x: body[2].x + width * 0.045, y: body[2].y + height * 0.08 }, body[2]];
  drawPolygon(top, '#427d78', PALETTE.glass, .8);
  drawPolygon(side, '#0b292e', PALETTE.shell, .9);
  const bodyGradient = ctx.createLinearGradient(0, body[0].y, width, body[2].y);
  bodyGradient.addColorStop(0, '#225f61');
  bodyGradient.addColorStop(.46, '#123b42');
  bodyGradient.addColorStop(1, '#0a2228');
  drawPolygon(body, bodyGradient, 'rgba(158,212,191,.54)', .98);

  ctx.save();
  ctx.globalAlpha = .18;
  ctx.strokeStyle = PALETTE.light;
  ctx.lineWidth = Math.max(0.8, Math.min(width, height) * 0.0011);
  for (let seam = 0; seam < 7; seam += 1) {
    const t = seam / 6;
    ctx.beginPath();
    ctx.moveTo(lerp(body[0].x, body[3].x, t), lerp(body[0].y, body[3].y, t));
    ctx.lineTo(lerp(body[1].x, body[2].x, t), lerp(body[1].y, body[2].y, t));
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .32;
  ctx.fillStyle = PALETTE.void;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y + height * .02, width * .27, height * .31, -.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const cavityPath = (point, cavity, scale = 1) => {
  const width = point.width * scale * (1 + cavity.bulge * .16 - cavity.closure * .05);
  const height = point.height * scale * (1 + cavity.bulge * .1 - cavity.closure * .04);
  const angle = cavity.twist * .6;
  const points = [];
  for (let vertex = 0; vertex < 7; vertex += 1) {
    const t = vertex / 7 * Math.PI * 2;
    const wobble = .88 + pseudo(cavity.id * 17 + vertex * 3) * .22;
    const x = Math.cos(t) * width * wobble;
    const y = Math.sin(t) * height * (.88 + pseudo(cavity.id * 23 + vertex) * .2);
    points.push({ x: point.x + x * Math.cos(angle) - y * Math.sin(angle), y: point.y + x * Math.sin(angle) + y * Math.cos(angle) });
  }
  return points;
};

const drawCavity = (cavity, point, width, height) => {
  const closure = clamp(cavity.closure * .22, 0, .78);
  const opening = clamp(cavity.opening, .05, 1.5);
  const rim = cavityPath(point, cavity, 1.25 + closure * .12);
  const hole = cavityPath(point, cavity, .83 + opening * .18 - closure * .14);
  drawPolygon(rim, cavity.closure > .01 ? 'rgba(221,134,111,.66)' : 'rgba(158,212,191,.58)', null, .95);
  drawPolygon(hole, PALETTE.void, 'rgba(232,216,179,.5)', .98);
  const depthHole = cavityPath({ ...point, x: point.x + cavity.depthShift * width * .025, y: point.y + cavity.depthShift * height * .018 }, cavity, .53 + opening * .12 - closure * .08);
  drawPolygon(depthHole, cavity.bulge > .01 ? 'rgba(221,134,111,.72)' : 'rgba(22,75,78,.9)', null, .95);
  ctx.save();
  ctx.globalAlpha = .72;
  ctx.strokeStyle = cavity.bulge > .01 ? PALETTE.coral : PALETTE.light;
  ctx.lineWidth = Math.max(.55, Math.min(width, height) * .0008);
  ctx.beginPath();
  rim.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  ctx.stroke();
  if (!blindMode && cavity.id === state.selectedCavity) {
    ctx.globalAlpha = .95;
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = PALETTE.coral;
    ctx.lineWidth = 1.1;
    const focus = cavityPath(point, cavity, 1.45);
    ctx.beginPath();
    focus.forEach((p, index) => index ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
};

const updatePoints = () => {
  const { width, height } = state.view;
  state.points = state.frame.field.cavities.map((cavity) => project(cavity, width, height, state.time));
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(width, height, now);
  drawMonolith(width, height);
  updatePoints();
  [...state.frame.field.shells].sort((a, b) => a.z - b.z).forEach((shell) => {
    const polygon = shellPolygon(shell, width, height, shell.fold * .02);
    drawPolygon(polygon, shell.fold > .01 ? 'rgba(221,134,111,.14)' : 'rgba(133,199,182,.11)', PALETTE.mist, .8);
  });
  [...state.frame.field.cavities].sort((a, b) => a.z - b.z).forEach((cavity) => drawCavity(cavity, state.points[cavity.id], width, height));
  updateReadout();
  state.gpu?.render();
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `object ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'absence' : 'absences'}`;
  cavityElement.textContent = `cavity ${String(state.selectedCavity + 1).padStart(2, '0')}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'absence-committed') statusElement.textContent = 'refusal dispatched · a remote opening carries the absence';
  else if (state.frame.lastAction === 'focus-armed') statusElement.textContent = 'focus held · Enter to refuse the address';
  else if (state.frame.lastAction === 'focus-empty' || state.frame.lastAction === 'absence-refused-empty') statusElement.textContent = 'no cavity focused · the object stays quiet';
  else if (state.frame.lastAction === 'absence-lifted') statusElement.textContent = 'latest vacancy lifted · object restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before another absence';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'archive released · the object returns to quiet';
  else statusElement.textContent = `${state.frame.field.cavities.filter((cavity) => cavity.bulge > .01).length} remote openings · focus a cavity`;
};

const renderState = (next) => { state.frame = next; render(); };
const focus = (cavity) => { state.selectedCavity = ((cavity % CAVITY_COUNT) + CAVITY_COUNT) % CAVITY_COUNT; renderState(armFocus(state.frame, { cavity: state.selectedCavity }, performance.now())); };
const commit = () => renderState(commitAbsence(state.frame));
const lift = () => renderState(liftLatestAbsence(state.frame));
const release = () => renderState(releaseArchive());

const cavityAtPoint = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const local = { x: clientX - rect.left, y: clientY - rect.top };
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  state.points.forEach((point, index) => {
    const distance = (point.x - local.x) ** 2 + (point.y - local.y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = index; }
  });
  return best;
};

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let veil = 0.018 + 0.009 * sin(pos.x * 0.013 + pos.y * 0.017); return vec4f(0.04 + veil, 0.14 + veil, 0.15 + veil, 0.12); }` });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    state.gpu = { device, context, pipeline, render() { const encoder = device.createCommandEncoder(); const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] }); pass.setPipeline(pipeline); pass.draw(3); pass.end(); device.queue.submit([encoder.finish()]); } };
    state.renderer = 'WEBGPU / OBJECT VEIL';
    render();
  } catch { state.gpu = null; }
};

const handleKey = (event) => {
  if (event.key === 'ArrowUp') { event.preventDefault(); focus(state.selectedCavity - 4); }
  else if (event.key === 'ArrowDown') { event.preventDefault(); focus(state.selectedCavity + 4); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); focus(state.selectedCavity - 1); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); focus(state.selectedCavity + 1); }
  else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!state.frame.armed) focus(state.selectedCavity); commit(); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); lift(); }
  else if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { event.preventDefault(); release(); }
};

canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture?.(event.pointerId); focus(cavityAtPoint(event.clientX, event.clientY)); });
canvas.addEventListener('keydown', handleKey);
document.querySelector('[data-gesture="commit"]').addEventListener('click', () => { if (!state.frame.armed) focus(state.selectedCavity); commit(); });
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__mutineWebGPUV028 = {
  getState: () => ({ stage: state.frame.stage, memory: state.frame.memory.length, events: state.frame.memory, armed: state.frame.armed, lastAction: state.frame.lastAction, signature: state.frame.field.signature, cavities: state.frame.field.cavities, shells: state.frame.field.shells, selectedCavity: state.selectedCavity, renderer: state.renderer, gpuAvailable: Boolean(navigator.gpu), gpuReady: Boolean(state.gpu) }),
  getCavityPoints: () => state.points.map((point) => ({ x: point.x, y: point.y })),
  geometrySignature: () => geometrySignature(state.frame),
  focusCavity: (cavity = state.selectedCavity) => focus(cavity),
  commitAbsence: commit,
  liftLatestAbsence: lift,
  releaseArchive: release
};

resize();
if (!staticMode) { const animate = (now) => { render(now); requestAnimationFrame(animate); }; requestAnimationFrame(animate); }
setupGPU();
