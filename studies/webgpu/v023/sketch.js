import {
  COLUMNS,
  STAGES,
  buildTimeline,
  commitWitness,
  geometrySignature,
  liftLatestWitness,
  pressToken,
  releaseMembrane
} from './engine.mjs';

const canvas = document.querySelector('#membrane-field');
const gpuCanvas = document.querySelector('#gpu-veil');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  view: { width: 1, height: 1, dpr: 1 },
  lastAction: staticMode || reducedMotion ? 'settled-preview' : 'quiet',
  time: 0,
  gpu: null,
  renderer: 'CANVAS / MESH FALLBACK'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const draftElement = document.querySelector('[data-draft]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#05090f',
  deep: '#09141b',
  ink: '#edf0eb',
  cyan: '#7ee4dd',
  amber: '#f0bd78',
  violet: '#a9a1f5',
  coral: '#e98f93',
  blue: '#638dbb'
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.73137) * 43758.5453;
  return raw - Math.floor(raw);
};

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

const project = (vertex, width, height, time) => {
  const turn = staticMode || reducedMotion ? 0.16 : time * 0.00008;
  const cosine = Math.cos(turn);
  const sine = Math.sin(turn);
  const rotatedX = vertex.x * cosine - vertex.z * sine;
  const rotatedZ = vertex.x * sine + vertex.z * cosine;
  const depth = 1 + rotatedZ * 0.42;
  const scale = Math.min(width, height) * 0.84;
  return {
    x: width * 0.5 + rotatedX * scale / depth,
    y: height * 0.53 + vertex.y * scale * 0.72 / depth,
    depth: rotatedZ,
    z: vertex.z
  };
};

const drawBackground = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.56, height * 0.40, 0, width * 0.5, height * 0.52, Math.max(width, height) * 0.82);
  gradient.addColorStop(0, '#182b34');
  gradient.addColorStop(.34, '#0c1820');
  gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = .20;
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 20; index += 1) {
    const x = width * (.08 + hash(index * 4.1) * .84);
    const y = height * (.08 + hash(index * 2.7 + 5) * .84);
    const radius = Math.min(width, height) * (.015 + hash(index * 3.4) * .04);
    const haze = ctx.createRadialGradient(x, y, 0, x, y, radius);
    haze.addColorStop(0, index % 2 ? PALETTE.cyan : PALETTE.violet);
    haze.addColorStop(1, 'transparent');
    ctx.fillStyle = haze;
    ctx.beginPath();
    ctx.arc(x + Math.sin(time * .00004 + index) * 5, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .28;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 220; index += 1) {
    const x = hash(index * 1.73 + 1) * width;
    const y = hash(index * 4.11 + 3) * height;
    const size = hash(index * 3.37 + 4) * 1.1 + .25;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
};

const vertexMap = (frame, width, height, time) => new Map(frame.surface.vertices.map((vertex) => [vertex.id, project(vertex, width, height, time)]));

const trianglePoints = (triangle, projected) => [projected.get(triangle.a), projected.get(triangle.b), projected.get(triangle.c)];

const drawTriangle = (triangle, points, paletteIndex) => {
  if (triangle.open) return;
  const averageDepth = points.reduce((sum, point) => sum + point.depth, 0) / 3;
  const colours = [PALETTE.cyan, PALETTE.blue, PALETTE.violet, PALETTE.ink];
  const fill = colours[paletteIndex % colours.length];
  const alpha = clamp(.27 + (averageDepth + .35) * .44, .24, .72);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = .33 + alpha * .4;
  ctx.strokeStyle = averageDepth > .05 ? PALETTE.ink : PALETTE.cyan;
  ctx.lineWidth = averageDepth > .12 ? 1.15 : .62;
  ctx.stroke();
  ctx.restore();
};

const drawApertureEdges = (frame, projected) => {
  ctx.save();
  ctx.globalAlpha = .78;
  ctx.strokeStyle = PALETTE.coral;
  ctx.lineWidth = Math.max(1.1, Math.min(state.view.width, state.view.height) * .0025);
  for (const triangle of frame.surface.triangles) {
    if (!triangle.open) continue;
    const points = trianglePoints(triangle, projected);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawMembrane = (width, height, time) => {
  const frame = state.frame;
  const projected = vertexMap(frame, width, height, time);
  const triangles = frame.surface.triangles
    .filter((triangle) => !triangle.open)
    .map((triangle) => ({ triangle, points: trianglePoints(triangle, projected) }))
    .sort((left, right) => {
      const leftDepth = left.points.reduce((sum, point) => sum + point.depth, 0);
      const rightDepth = right.points.reduce((sum, point) => sum + point.depth, 0);
      return leftDepth - rightDepth;
    });

  ctx.save();
  ctx.globalAlpha = .26;
  ctx.shadowBlur = Math.min(width, height) * .06;
  ctx.shadowColor = PALETTE.cyan;
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = Math.min(width, height) * .04;
  ctx.beginPath();
  ctx.ellipse(width * .5, height * .53, width * .31, height * .23, -.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  triangles.forEach(({ triangle, points }, index) => drawTriangle(triangle, points, index + Math.floor(frame.surface.residue * 2)));
  drawApertureEdges(frame, projected);

  ctx.save();
  ctx.globalAlpha = .52;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = Math.max(1.2, Math.min(width, height) * .0032);
  ctx.beginPath();
  for (let column = 0; column < COLUMNS; column += 1) {
    const point = projected.get(column);
    if (column === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  const draft = state.frame.draft.join('') || '—';
  stageElement.textContent = `membrane ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'witness' : 'witnesses'}`;
  draftElement.textContent = `draft ${draft}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'incomplete-witness') statusElement.textContent = 'incomplete witness · add tokens before sealing';
  else if (state.frame.lastAction === 'token-drafted') statusElement.textContent = 'draft held · geometry unchanged';
  else if (state.frame.lastAction === 'witness-committed') statusElement.textContent = 'witness sealed · two apertures remembered';
  else if (state.frame.lastAction === 'witness-lifted') statusElement.textContent = 'latest witness lifted · membrane restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'archive full · lift or release before sealing again';
  else if (state.frame.lastAction === 'membrane-released') statusElement.textContent = 'membrane released · no witness retained';
  else statusElement.textContent = `${state.frame.surface.apertures.length} apertures · residue ${state.frame.surface.residue.toFixed(2)} · type A-D`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground(width, height, now);
  drawMembrane(width, height, now);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr);
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const addToken = (token) => renderState(pressToken(state.frame, token));
const seal = () => renderState(commitWitness(state.frame));
const lift = () => renderState(liftLatestWitness(state.frame));
const release = () => renderState(releaseMembrane());

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let glow = 0.035 + 0.02 * sin(pos.x * 0.004); return vec4f(0.025, 0.09 + glow, 0.11 + glow, 0.24); }` });
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' }
    });
    state.gpu = {
      device,
      context,
      pipeline,
      render() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
      }
    };
    state.renderer = 'WEBGPU / MEMBRANE VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

const handleKey = (event) => {
  const key = event.key.toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(key)) {
    event.preventDefault();
    addToken(key);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    seal();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || key === 'R') {
    event.preventDefault();
    release();
  }
};

canvas.addEventListener('keydown', handleKey);
document.addEventListener('keydown', (event) => {
  if (event.target.closest('a,button,input,textarea,select')) return;
  handleKey(event);
});
document.querySelectorAll('[data-token]').forEach((button) => button.addEventListener('click', () => addToken(button.dataset.token)));
document.querySelector('[data-gesture="seal"]').addEventListener('click', seal);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__mutineWebGPUV023 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    draft: [...state.frame.draft],
    residue: state.frame.surface.residue,
    route: state.frame.surface.route,
    apertures: state.frame.surface.apertures.length,
    openTriangles: state.frame.surface.triangles.filter((triangle) => triangle.open).length,
    signature: geometrySignature(state.frame),
    action: state.frame.lastAction,
    renderer: state.renderer
  }),
  token: addToken,
  seal,
  lift,
  release
};

resize();
setupGPU();
if (!staticMode && !reducedMotion) requestAnimationFrame(function tick(now) { render(now); requestAnimationFrame(tick); });
