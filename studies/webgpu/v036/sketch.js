import {
  STAGES,
  GATE_COUNT,
  buildFrame,
  buildTimeline,
  attendGate,
  moveAttention,
  releaseAttention,
  liftLatestAttention,
  releaseArchive,
  defaultDwell
} from './engine.mjs';

const svg = document.querySelector('#ribbon-field');
const art = document.querySelector('#ribbon-art');
const gpuCanvas = document.querySelector('#gpu-veil');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  hoverGate: 4,
  keyboardGate: 4,
  time: 0,
  gpu: null,
  renderer: 'SVG / RECIPROCAL RIBBON'
};
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const TAU = Math.PI * 2;
const VIEW = { width: 1000, height: 760 };
const PALETTE = {
  deep: '#070a07',
  ink: '#eee4cc',
  sage: '#b8c98c',
  oxide: '#e98265',
  sulfur: '#d7c49a'
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, amount) => a + (b - a) * amount;
const point = (x, y) => ({ x, y });
const toView = (normalized) => point(normalized.x * VIEW.width, normalized.y * VIEW.height);
const add = (a, b) => point(a.x + b.x, a.y + b.y);
const sub = (a, b) => point(a.x - b.x, a.y - b.y);
const scale = (a, amount) => point(a.x * amount, a.y * amount);
const length = (a) => Math.hypot(a.x, a.y) || 1;
const normalize = (a) => scale(a, 1 / length(a));
const perpendicular = (a) => point(-a.y, a.x);
const svgEscape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

const pathLine = (points, close = false) => {
  if (!points.length) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    d += ` L ${points[index].x.toFixed(2)} ${points[index].y.toFixed(2)}`;
  }
  return close ? `${d} Z` : d;
};

const pointAt = (ribbon, u) => {
  const points = ribbon.centerline;
  const cursor = clamp(u, 0, 1) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(cursor));
  const amount = cursor - index;
  return toView({
    x: mix(points[index].x, points[index + 1].x, amount),
    y: mix(points[index].y, points[index + 1].y, amount)
  });
};

const tangentAt = (ribbon, u) => {
  const delta = 0.015;
  return normalize(sub(pointAt(ribbon, clamp(u + delta, 0, 1)), pointAt(ribbon, clamp(u - delta, 0, 1))));
};

const widthAt = (field, u) => {
  const cursor = clamp(u, 0, 1) * (field.ribbon.widths.length - 1);
  const index = Math.min(field.ribbon.widths.length - 2, Math.floor(cursor));
  return mix(field.ribbon.widths[index], field.ribbon.widths[index + 1], cursor - index) * VIEW.height;
};

const ribbonGeometry = (field) => {
  const upper = [];
  const lower = [];
  field.ribbon.centerline.forEach((_, index, points) => {
    const u = index / (points.length - 1);
    const center = pointAt(field.ribbon, u);
    const tangent = tangentAt(field.ribbon, u);
    const normal = perpendicular(tangent);
    const half = widthAt(field, u);
    upper.push(add(center, scale(normal, half)));
    lower.push(sub(center, scale(normal, half)));
  });
  return { upper, lower, path: pathLine([...upper, ...lower.reverse()], true) };
};

const gateGeometry = (field, gate) => {
  const center = pointAt(field.ribbon, gate.u);
  const tangent = tangentAt(field.ribbon, gate.u);
  const normal = perpendicular(tangent);
  const bodyHalf = widthAt(field, gate.u);
  const angle = gate.fold * 0.7;
  const rotatedTangent = normalize(point(tangent.x * Math.cos(angle) - tangent.y * Math.sin(angle), tangent.x * Math.sin(angle) + tangent.y * Math.cos(angle)));
  const slitHalf = 7 + gate.opening * 25;
  const reach = bodyHalf * (0.85 + gate.opening * 0.45);
  const a = add(add(center, scale(normal, -reach)), scale(rotatedTangent, -slitHalf));
  const b = add(add(center, scale(normal, -reach)), scale(rotatedTangent, slitHalf));
  const c = add(add(center, scale(normal, reach)), scale(rotatedTangent, slitHalf));
  const d = add(add(center, scale(normal, reach)), scale(rotatedTangent, -slitHalf));
  return { center, tangent: rotatedTangent, path: pathLine([a, b, c, d], true), bodyHalf, slitHalf };
};

const renderMemoryTrace = (field, event) => {
  const answer = field.gates[event.answerGate];
  const relay = field.gates[event.relayGate];
  const a = pointAt(field.ribbon, answer.u);
  const b = pointAt(field.ribbon, relay.u);
  const tangent = tangentAt(field.ribbon, answer.u);
  const normal = perpendicular(tangent);
  const mid = add(a, scale(normal, (answer.fold - relay.fold) * 80));
  return `<path class="memory-trace" d="M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mid.x.toFixed(1)} ${mid.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}" />`;
};

const renderRibbon = () => {
  const field = state.frame.field;
  const geometry = ribbonGeometry(field);
  const memoryEvents = state.frame.memory.slice(-4);
  const memories = memoryEvents.map((event) => renderMemoryTrace(field, event)).join('');
  const gates = field.gates.map((gate) => {
    const geometryForGate = gateGeometry(field, gate);
    const event = memoryEvents.find((item) => item.sourceGate === gate.id || item.answerGate === gate.id || item.relayGate === gate.id);
    const role = event?.answerGate === gate.id ? 'answer' : event?.relayGate === gate.id ? 'relay' : event?.sourceGate === gate.id ? 'source' : 'quiet';
    const fill = role === 'answer' ? 'url(#ribbon-glow)' : role === 'relay' ? PALETTE.sulfur : PALETTE.deep;
    const accent = role === 'answer' ? PALETTE.oxide : role === 'relay' ? PALETTE.sulfur : PALETTE.ink;
    const ring = role === 'answer'
      ? `<path class="gate-ring answer-ring" d="${geometryForGate.path}" />`
      : role === 'relay'
        ? `<path class="gate-ring relay-ring" d="${geometryForGate.path}" />`
        : '';
    return `<g class="gate gate-${role}" data-gate="${gate.id}"><path class="gate-glow" d="${geometryForGate.path}" fill="${fill}" /><path class="gate-slit" d="${geometryForGate.path}" fill="${PALETTE.deep}" stroke="${accent}" stroke-opacity="${role === 'quiet' ? 0.26 : 0.74}" /><circle class="gate-core" cx="${geometryForGate.center.x.toFixed(1)}" cy="${geometryForGate.center.y.toFixed(1)}" r="${(1.8 + gate.lift * 4).toFixed(1)}" fill="${accent}" fill-opacity="${role === 'quiet' ? 0.24 : 0.78}" />${ring}</g>`;
  }).join('');
  const attention = state.frame.attention && !blindMode
    ? (() => {
        const gate = field.gates[state.frame.attention.currentGate];
        const g = gateGeometry(field, gate);
        return `<circle class="attention-marker" cx="${g.center.x.toFixed(1)}" cy="${g.center.y.toFixed(1)}" r="${(g.bodyHalf * .72).toFixed(1)}" />`;
      })()
    : '';
  art.innerHTML = `<path class="ribbon-shadow" d="${geometry.path}" />${memories}<path class="ribbon-body" d="${geometry.path}" /><path class="ribbon-edge" d="${pathLine(geometry.upper)}" /><path class="ribbon-edge ribbon-edge-lower" d="${pathLine(geometry.lower)}" />${gates}${attention}`;
};

const updateReadout = () => {
  const memory = state.frame.memory.length;
  stageElement.textContent = `attention ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'reply' : 'replies'}`;
  rendererElement.textContent = state.renderer;
  if (state.frame.lastAction === 'attention-released') statusElement.textContent = 'attention departed · another gate opened';
  else if (state.frame.lastAction === 'attention-armed' || state.frame.lastAction === 'attention-moving') statusElement.textContent = 'witness stored · leave to let the ribbon answer';
  else if (state.frame.lastAction === 'attention-refused-bounds') statusElement.textContent = 'attention refused · stay long enough to be remembered';
  else if (state.frame.lastAction === 'attention-refused-no-arm') statusElement.textContent = 'no witness stored · the ribbon stays quiet';
  else if (state.frame.lastAction === 'attention-lifted') statusElement.textContent = 'latest reply lifted · the prior ribbon returns';
  else if (state.frame.lastAction === 'memory-limit') statusElement.textContent = 'ribbon full · lift or release before another witness';
  else if (state.frame.lastAction === 'archive-released') statusElement.textContent = 'attention released · the ribbon returns to quiet';
  else statusElement.textContent = 'approach a gate · leave to open another';
};

const render = (now = performance.now()) => {
  state.time = now;
  renderRibbon();
  updateReadout();
  state.gpu?.render();
};

const renderState = (next) => {
  state.frame = next;
  render();
};

const gateFromPointer = (event) => {
  const rect = svg.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * VIEW.width;
  const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * VIEW.height;
  const field = state.frame.field;
  return field.gates.reduce((best, gate) => {
    const current = pointAt(field.ribbon, gate.u);
    const bestPoint = pointAt(field.ribbon, best.u);
    const currentScore = Math.hypot(current.x - x, current.y - y) + Math.abs(current.y - y) * .22;
    const bestScore = Math.hypot(bestPoint.x - x, bestPoint.y - y) + Math.abs(bestPoint.y - y) * .22;
    return currentScore < bestScore ? gate : best;
  }, field.gates[0]).id;
};

const updateAttentionGate = (gate, at) => {
  state.hoverGate = gate;
  if (state.frame.attention) renderState(moveAttention(state.frame, { gate, at }));
};

const armDeterministic = () => {
  const gate = (state.frame.memory.length * 4 + 3) % GATE_COUNT;
  renderState(attendGate(state.frame, { gate, at: 0 }));
};

const releaseDeterministic = () => {
  const armed = state.frame.attention ? state.frame : attendGate(state.frame, { gate: state.keyboardGate, at: 0 });
  renderState(releaseAttention(armed, { gate: state.keyboardGate, releasedAt: (armed.attention?.startedAt ?? 0) + defaultDwell(armed) }));
};

const lift = () => renderState(liftLatestAttention(state.frame));
const release = () => renderState(releaseArchive());

const keyboard = (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    state.keyboardGate = (state.keyboardGate + (event.key === 'ArrowRight' ? 1 : -1) + GATE_COUNT) % GATE_COUNT;
    updateAttentionGate(state.keyboardGate, performance.now());
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (state.frame.attention) releaseDeterministic();
    else armDeterministic();
  }
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
    const shader = device.createShaderModule({ code: `@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f { var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0)); return vec4f(p[index], 0.0, 1.0); } @fragment fn fragmentMain(@builtin(position) pos: vec4f) -> @location(0) vec4f { let breath = 0.008 * sin(pos.x * 0.017 + pos.y * 0.013); return vec4f(0.055 + breath, 0.08 + breath * 0.6, 0.045, 0.12); }` });
    const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vertexMain' }, fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
    state.gpu = { render() {
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    } };
    state.renderer = 'WEBGPU / RIBBON VEIL';
    render();
  } catch {
    state.gpu = null;
  }
};

const resize = () => {
  const rect = svg.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  gpuCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
  gpuCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
  render();
};

svg.addEventListener('pointermove', (event) => updateAttentionGate(gateFromPointer(event), performance.now()));
svg.addEventListener('pointerdown', (event) => {
  svg.setPointerCapture?.(event.pointerId);
  const gate = gateFromPointer(event);
  state.hoverGate = gate;
  if (!state.frame.attention) renderState(attendGate(state.frame, { gate, at: performance.now() }));
});
svg.addEventListener('pointerup', (event) => {
  const gate = gateFromPointer(event);
  if (state.frame.attention) renderState(releaseAttention(state.frame, { gate, releasedAt: performance.now() }));
  svg.releasePointerCapture?.(event.pointerId);
});
svg.addEventListener('pointercancel', () => {
  if (state.frame.attention) state.frame = buildFrame(state.frame.stage, state.frame.memory, null, 'attention-cancelled');
  render();
});
svg.addEventListener('keydown', keyboard);
document.querySelector('[data-gesture="attend"]').addEventListener('click', armDeterministic);
document.querySelector('[data-gesture="lift"]').addEventListener('click', lift);
document.querySelector('[data-gesture="release"]').addEventListener('click', releaseDeterministic);
window.addEventListener('resize', resize);
window.__mutineWebGPUV036 = {
  getState: () => ({
    stage: state.frame.stage,
    memory: state.frame.memory.length,
    attention: state.frame.attention,
    signature: state.frame.field.signature,
    ribbon: state.frame.field.ribbon,
    gates: state.frame.field.gates.map((gate) => ({ ...gate })),
    event: state.frame.memory.at(-1) ?? null,
    lastAction: state.frame.lastAction,
    renderer: state.renderer
  })
};
resize();
setupGPU();
if (!reducedMotion && !staticMode) {
  const animate = (now) => {
    render(now);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
}
