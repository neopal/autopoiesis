import {
  ROW_COUNT,
  SLOT_COUNT,
  SLOT_COUNT_TOTAL,
  STAGES,
  armWitness,
  buildTimeline,
  commitPair,
  defaultPair,
  geometrySignature,
  liftLatestPair,
  releaseRegister
} from './engine.mjs';

const canvas = document.querySelector('#register-field');
const gpuCanvas = document.querySelector('#gpu-paper');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : timeline[0],
  selectedSlot: 4,
  view: { width: 1, height: 1, dpr: 1 },
  time: 0,
  gpu: null,
  renderer: 'CANVAS / TYPOGRAPHIC REGISTER'
};

const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const slotElement = document.querySelector('[data-slot]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');

const PALETTE = {
  ground: '#0e0f18',
  paper: '#e7dfd1',
  paperShade: '#d3c8b9',
  ink: '#29283a',
  blue: '#305c79',
  red: '#a24e43',
  ochre: '#b67a4d',
  graphite: '#454454',
  rule: 'rgba(41,40,58,.20)'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hash = (value) => {
  const raw = Math.sin(value * 12.9898 + 0.4217) * 43758.5453;
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

const drawSurround = (width, height, time) => {
  const gradient = ctx.createRadialGradient(width * 0.48, height * 0.48, 0, width * 0.5, height * 0.52, Math.max(width, height) * 0.82);
  gradient.addColorStop(0, '#343244');
  gradient.addColorStop(.34, '#1e1f2d');
  gradient.addColorStop(1, PALETTE.ground);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = .22;
  ctx.fillStyle = PALETTE.paper;
  for (let index = 0; index < 180; index += 1) {
    const x = hash(index * 1.71 + 4) * width;
    const y = hash(index * 3.19 + 9) * height;
    const size = hash(index * 2.27 + 12) * 1.1 + .15;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .17;
  ctx.strokeStyle = PALETTE.red;
  ctx.lineWidth = 1;
  const pulse = reducedMotion || staticMode ? .5 : .5 + Math.sin(time * .00019) * .5;
  ctx.beginPath();
  ctx.arc(width * (.5 + (pulse - .5) * .03), height * .51, Math.min(width, height) * .41, -Math.PI * .07, Math.PI * 1.07);
  ctx.stroke();
  ctx.restore();
};

const sheetRect = (width, height) => {
  const margin = Math.min(width, height) * .095;
  return { x: margin, y: margin * .98, width: width - margin * 2, height: height - margin * 1.96 };
};

const slotPoint = (entry, sheet) => ({
  x: sheet.x + (entry.x + 1) * .5 * sheet.width,
  y: sheet.y + (entry.y + 1) * .5 * sheet.height
});

const drawPaper = (width, height, time) => {
  const sheet = sheetRect(width, height);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.42)';
  ctx.shadowBlur = Math.min(width, height) * .045;
  ctx.shadowOffsetY = Math.min(width, height) * .02;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(sheet.x, sheet.y, sheet.width, sheet.height);
  ctx.restore();

  const wash = ctx.createLinearGradient(sheet.x, sheet.y, sheet.x + sheet.width, sheet.y + sheet.height);
  wash.addColorStop(0, 'rgba(255,255,255,.22)');
  wash.addColorStop(.52, 'rgba(255,255,255,0)');
  wash.addColorStop(1, 'rgba(91,55,46,.10)');
  ctx.fillStyle = wash;
  ctx.fillRect(sheet.x, sheet.y, sheet.width, sheet.height);

  ctx.save();
  ctx.strokeStyle = PALETTE.rule;
  ctx.lineWidth = Math.max(.6, Math.min(width, height) * .001);
  for (let row = 0; row < ROW_COUNT + 1; row += 1) {
    const y = sheet.y + sheet.height * (.14 + row * .135);
    ctx.beginPath();
    ctx.moveTo(sheet.x + sheet.width * .045, y);
    ctx.lineTo(sheet.x + sheet.width * .955, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .20;
  ctx.fillStyle = PALETTE.ink;
  for (let index = 0; index < 420; index += 1) {
    const x = sheet.x + hash(index * 1.31 + 22) * sheet.width;
    const y = sheet.y + hash(index * 2.77 + 17) * sheet.height;
    const size = hash(index * 4.07 + 5) * 1.0 + .12;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = PALETTE.ink;
  ctx.globalAlpha = .56;
  ctx.font = `${Math.max(8, Math.min(width, height) * .012)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.letterSpacing = '0.18em';
  ctx.fillText('REGISTER / 026', sheet.x + sheet.width * .06, sheet.y + sheet.height * .08);
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(sheet.x + sheet.width * .06, sheet.y + sheet.height * .095, sheet.width * .12, 1.5);
  ctx.globalAlpha = .35;
  ctx.fillStyle = PALETTE.blue;
  ctx.fillText('UNSETTLED INDEX', sheet.x + sheet.width * .70, sheet.y + sheet.height * .08);
  ctx.restore();

  if (!blindMode) {
    ctx.save();
    ctx.globalAlpha = .35;
    ctx.strokeStyle = PALETTE.red;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sheet.x + sheet.width * .04, sheet.y + sheet.height * .045);
    ctx.lineTo(sheet.x + sheet.width * .08, sheet.y + sheet.height * .045);
    ctx.moveTo(sheet.x + sheet.width * .04, sheet.y + sheet.height * .045);
    ctx.lineTo(sheet.x + sheet.width * .04, sheet.y + sheet.height * .075);
    ctx.stroke();
    ctx.restore();
  }
};

const drawEntry = (entry, sheet, width, height) => {
  const point = slotPoint(entry, sheet);
  const barWidth = entry.width * sheet.width * .42;
  const barHeight = Math.max(2, entry.height * sheet.height * .65);
  const baseX = point.x - barWidth * .5 + entry.offsetX * sheet.width;
  const baseY = point.y + entry.offsetY * sheet.height;
  const colour = entry.excision > .02 ? PALETTE.red : entry.reply > .02 ? PALETTE.blue : entry.row % 3 === 0 ? PALETTE.ink : entry.row % 3 === 1 ? PALETTE.graphite : PALETTE.ochre;
  const segments = entry.segments.length ? entry.segments : [{ start: 0, end: 1 }];

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(entry.angle + entry.tilt * .045);
  ctx.globalAlpha = clamp(.54 + entry.weight * .38 + entry.bridge * .1, .35, .96);
  ctx.fillStyle = colour;
  segments.forEach((segment) => {
    ctx.fillRect(segment.start * barWidth - barWidth * .5, -barHeight * .5, (segment.end - segment.start) * barWidth, barHeight);
  });
  ctx.restore();

  if (entry.bridge > .01) {
    ctx.save();
    ctx.globalAlpha = clamp(.12 + entry.bridge * .24, .12, .38);
    ctx.strokeStyle = PALETTE.blue;
    ctx.lineWidth = Math.max(.6, Math.min(width, height) * .0012);
    ctx.beginPath();
    ctx.moveTo(baseX - barWidth * .25, baseY + barHeight * .7);
    ctx.lineTo(baseX + barWidth * .33, baseY - barHeight * .8);
    ctx.stroke();
    ctx.restore();
  }

  if (!blindMode && entry.id === state.selectedSlot) {
    ctx.save();
    ctx.globalAlpha = state.frame.armed ? .86 : .35;
    ctx.strokeStyle = PALETTE.red;
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(baseX - barWidth * .64, baseY - barHeight * 2.2, barWidth * 1.28, barHeight * 4.4);
    ctx.restore();
  }
};

const drawRegister = (width, height) => {
  const sheet = sheetRect(width, height);
  state.frame.register.entries.forEach((entry) => drawEntry(entry, sheet, width, height));

  ctx.save();
  ctx.strokeStyle = 'rgba(162,78,67,.40)';
  ctx.lineWidth = Math.max(1, Math.min(width, height) * .0014);
  ctx.beginPath();
  ctx.moveTo(sheet.x + sheet.width * .925, sheet.y + sheet.height * .13);
  ctx.lineTo(sheet.x + sheet.width * .925, sheet.y + sheet.height * .87);
  ctx.stroke();
  ctx.globalAlpha = .5;
  for (let tick = 0; tick < 12; tick += 1) {
    const y = sheet.y + sheet.height * (.16 + tick * .063);
    ctx.beginPath();
    ctx.moveTo(sheet.x + sheet.width * .91, y);
    ctx.lineTo(sheet.x + sheet.width * .94, y);
    ctx.stroke();
  }
  ctx.restore();
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `register ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'pair' : 'pairs'}`;
  slotElement.textContent = `slot ${String(state.selectedSlot + 1).padStart(2, '0')}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'pair-committed') statusElement.textContent = 'pair filed · one record excised, another replies';
  else if (state.frame.lastAction === 'witness-armed') statusElement.textContent = `slot ${String(state.selectedSlot + 1).padStart(2, '0')} armed · choose a second place`;
  else if (state.frame.lastAction === 'same-place-refused') statusElement.textContent = 'same place refused · a pair needs distance';
  else if (state.frame.lastAction === 'pair-lifted') statusElement.textContent = 'latest pair lifted · register restored';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'register full · lift or release before filing again';
  else if (state.frame.lastAction === 'register-released') statusElement.textContent = 'register released · the sheet returns to quiet';
  else statusElement.textContent = `${state.frame.register.entries.filter((entry) => entry.excision > .02).length} excisions · choose a first witness`;
};

const render = (now = performance.now()) => {
  state.time = now;
  const { width, height, dpr } = state.view;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSurround(width, height, now);
  drawPaper(width, height, now);
  drawRegister(width, height);
  updateReadout();
  state.gpu?.render(now, width * dpr, height * dpr);
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const entryAtPoint = (clientX, clientY) => {
  const rect = canvas.getBoundingClientRect();
  const sheet = sheetRect(rect.width, rect.height);
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  state.frame.register.entries.forEach((entry) => {
    const point = slotPoint(entry, sheet);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.id;
    }
  });
  return best;
};

const arm = (slot, startedAt = performance.now()) => {
  state.selectedSlot = clamp(slot, 0, SLOT_COUNT_TOTAL - 1);
  renderState(armWitness(state.frame, state.selectedSlot, startedAt));
};
const pair = (target = state.selectedSlot) => {
  const source = state.frame.armed?.slot;
  if (source === undefined) {
    arm(state.selectedSlot);
    return;
  }
  renderState(commitPair(state.frame, { source, target }));
};
const lift = () => renderState(liftLatestPair(state.frame));
const release = () => renderState(releaseRegister());

const setupGPU = async () => {
  if (!navigator.gpu) return;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return;
    const device = await adapter.requestDevice();
    const context = gpuCanvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let paper = 0.018 + 0.008 * sin(pos.x * 0.021 + pos.y * 0.013); return vec4f(0.34 + paper, 0.20, 0.14, 0.10); }` });
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
    state.renderer = 'WEBGPU / PAPER VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

const handleKey = (event) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.selectedSlot = (state.selectedSlot + SLOT_COUNT_TOTAL - SLOT_COUNT) % SLOT_COUNT_TOTAL;
    render();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.selectedSlot = (state.selectedSlot + SLOT_COUNT) % SLOT_COUNT_TOTAL;
    render();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    state.selectedSlot = Math.floor(state.selectedSlot / SLOT_COUNT) * SLOT_COUNT + (state.selectedSlot + SLOT_COUNT - 1) % SLOT_COUNT;
    render();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    state.selectedSlot = Math.floor(state.selectedSlot / SLOT_COUNT) * SLOT_COUNT + (state.selectedSlot + 1) % SLOT_COUNT;
    render();
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    pair();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key === 'Escape' || event.key.toUpperCase() === 'R') {
    event.preventDefault();
    release();
  }
};

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  const slot = entryAtPoint(event.clientX, event.clientY);
  state.selectedSlot = slot;
  if (state.frame.armed) pair(slot);
  else arm(slot, performance.now());
});
canvas.addEventListener('pointermove', (event) => {
  if (!state.frame.armed) return;
  state.selectedSlot = entryAtPoint(event.clientX, event.clientY);
  render();
});
document.addEventListener('keydown', (event) => {
  if (event.target.closest('a,button,input,textarea,select')) return;
  handleKey(event);
});
document.querySelector('[data-gesture="pair"]').addEventListener('click', () => {
  if (state.frame.armed) pair(defaultPair().target);
  else {
    arm(defaultPair().source);
    pair(defaultPair().target);
  }
});
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', release);
window.addEventListener('resize', resize);

window.__mutineWebGPUV026 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    selectedSlot: state.selectedSlot,
    armed: state.frame.armed ? { ...state.frame.armed } : null,
    excisions: state.frame.register.entries.filter((entry) => entry.excision > .02).length,
    replies: state.frame.register.entries.filter((entry) => entry.reply > .02).length,
    bridges: state.frame.register.entries.filter((entry) => entry.bridge > .01).length,
    signature: geometrySignature(state.frame),
    action: state.frame.lastAction,
    renderer: state.renderer
  }),
  arm,
  pair,
  lift,
  release
};

resize();
setupGPU();
if (!staticMode && !reducedMotion) requestAnimationFrame(function tick(now) { render(now); requestAnimationFrame(tick); });
