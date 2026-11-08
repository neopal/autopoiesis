import {
  AGENT_COUNT,
  MEMORY_LIMIT,
  MIN_GAZE_DWELL_MS,
  buildFrame,
  buildTimeline,
  registerGaze,
  commitDefaultGaze,
  liftLatest,
  releaseField
} from './engine.mjs';

const frameElement = document.querySelector('#absence-frame');
const stageElement = document.querySelector('[data-stage]');
const memoryElement = document.querySelector('[data-memory]');
const rendererElement = document.querySelector('[data-renderer]');
const statusElement = document.querySelector('[data-status]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const staticMode = document.documentElement.classList.contains('static-mode');
const blindMode = document.documentElement.classList.contains('blind-mode');
const timeline = buildTimeline();
const state = {
  frame: staticMode || reducedMotion ? timeline.at(-1) : buildFrame(),
  motion: !(staticMode || reducedMotion),
  canvas: null,
  p: null
};

const palette = {
  ground: [9, 11, 20],
  void: [15, 20, 34],
  deep: [27, 35, 52],
  paper: [221, 198, 156],
  copper: [220, 131, 99],
  mint: [155, 224, 198],
  blue: [120, 151, 170],
  violet: [169, 155, 207],
  ink: [238, 230, 210]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return { x: clamp((clientX - rect.left) / rect.width, 0, 1), y: clamp((clientY - rect.top) / rect.height, 0, 1) };
};
const archPoint = (agent, scale, width, height) => ({ x: width * 0.5 + agent.x * scale, y: height * 0.66 + agent.y * scale });
const slotFromPoint = (point) => {
  const scale = Math.min(state.p?.width ?? 1, state.p?.height ?? 1) * 0.34;
  const x = point.x * (state.p?.width ?? 1);
  const y = point.y * (state.p?.height ?? 1);
  let bestSlot = 0;
  let bestDistance = Infinity;
  state.frame.field.agents.forEach((agent) => {
    const projected = archPoint(agent, scale, state.p.width, state.p.height);
    const distance = (projected.x - x) ** 2 + (projected.y - y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; bestSlot = agent.slot; }
  });
  return bestSlot;
};

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  const looks = state.frame.gesture?.slots?.length ?? 0;
  stageElement.textContent = `room ${String(state.frame.stage + 1).padStart(2, '0')} / ${MEMORY_LIMIT + 1}`;
  memoryElement.textContent = state.frame.gesture ? `look ${looks} / 3` : `${memory} ${memory === 1 ? 'absence' : 'absences'}`;
  rendererElement.textContent = `WEBGPU SIGNAL / CANVAS 2D / ABSENCE ARCH${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'gaze-armed') statusElement.textContent = 'first witness held · look elsewhere';
  else if (action === 'gaze-building') statusElement.textContent = `the arch is being watched · ${looks} witnesses marked`;
  else if (action === 'absence-committed') statusElement.textContent = 'the witnesses turned · someone left elsewhere';
  else if (action === 'gaze-refused-repeat') statusElement.textContent = 'the same witness cannot count twice';
  else if (action === 'gaze-refused-short') statusElement.textContent = 'the look was too brief · the arch stayed exact';
  else if (action === 'gaze-refused-memory-limit') statusElement.textContent = 'the room is full · lift an absence first';
  else if (action === 'absence-lifted') statusElement.textContent = 'the last empty seat returned · the prior arch resumes';
  else if (action === 'field-released') statusElement.textContent = 'the room released · the quiet arch returns';
  else statusElement.textContent = blindMode ? '' : 'look at three different witnesses · the absent one is elsewhere';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const registerPointerGaze = (event) => {
  if (event.target !== state.canvas || state.frame.memory.length >= MEMORY_LIMIT) return;
  const point = pointFromClient(event.clientX, event.clientY);
  const slot = slotFromPoint(point);
  setFrame(registerGaze(state.frame, { slot, time: performance.now(), dwell: MIN_GAZE_DWELL_MS + 100 }));
  state.canvas.focus({ preventScroll: true });
  event.preventDefault();
};

const commitDefault = () => setFrame(commitDefaultGaze(state.frame));
const lift = () => setFrame(liftLatest(state.frame));
const release = () => setFrame(releaseField());

const drawBackground = (p, time) => {
  const ctx = p.drawingContext;
  const gradient = ctx.createLinearGradient(0, 0, p.width, p.height);
  gradient.addColorStop(0, 'rgb(9,11,20)');
  gradient.addColorStop(0.48, 'rgb(15,20,34)');
  gradient.addColorStop(1, 'rgb(8,10,17)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, p.width, p.height);
  p.noStroke();
  p.fill(...palette.blue, 12);
  p.ellipse(p.width * 0.22, p.height * 0.24, p.width * 0.48, p.height * 0.45);
  p.fill(...palette.copper, 10);
  p.ellipse(p.width * 0.81, p.height * 0.7, p.width * 0.56, p.height * 0.54);
  p.stroke(...palette.ink, 16);
  p.strokeWeight(1);
  for (let index = 0; index < 9; index += 1) {
    const y = p.height * (0.14 + index * 0.088);
    p.line(p.width * 0.08, y, p.width * 0.92, y + Math.sin(index * 2.8) * 2);
  }
  if (state.motion) {
    p.noStroke();
    p.fill(...palette.mint, 14);
    p.ellipse(p.width * (0.5 + Math.sin(time * 0.00008) * 0.03), p.height * 0.35, 2, 2);
  }
};

const materialFor = (agent) => {
  if (agent.attention > 0.62) return palette.copper;
  if (agent.tone > 0.76) return palette.violet;
  if (agent.tone > 0.49) return palette.paper;
  if (agent.tone > 0.25) return palette.blue;
  return palette.deep;
};

const drawRail = (p, agents, scale, time) => {
  for (let index = 0; index < agents.length - 1; index += 1) {
    const current = agents[index];
    const next = agents[index + 1];
    if (!current.present || !next.present) continue;
    const a = archPoint(current, scale, p.width, p.height);
    const b = archPoint(next, scale, p.width, p.height);
    p.stroke(...palette.mint, 42);
    p.strokeWeight(1);
    p.line(a.x, a.y, b.x, b.y);
    if (state.motion && index % 4 === 0) {
      p.stroke(...palette.copper, 34);
      p.line(a.x, a.y + Math.sin(time * 0.0002 + index) * 2, b.x, b.y + Math.cos(time * 0.00018 + index) * 2);
    }
  }
};

const drawThreads = (p, field, scale) => {
  field.absences.forEach((absence, eventIndex) => {
    const target = field.agents[absence.slot];
    if (!target) return;
    const targetPoint = archPoint(target, scale, p.width, p.height);
    absence.witnesses.forEach((slot, witnessIndex) => {
      const witness = field.agents[slot];
      if (!witness) return;
      const source = archPoint(witness, scale, p.width, p.height);
      const bendX = (source.x + targetPoint.x) * 0.5 + (witnessIndex - 1) * scale * 0.09;
      const bendY = Math.min(source.y, targetPoint.y) - scale * (0.18 + eventIndex * 0.025);
      p.noFill();
      p.stroke(...(witnessIndex === 1 ? palette.copper : palette.mint), 48 - eventIndex * 5);
      p.strokeWeight(0.7 + eventIndex * 0.12);
      p.bezier(source.x, source.y, bendX, bendY, bendX, bendY, targetPoint.x, targetPoint.y);
    });
  });
};

const drawAbsence = (p, agent, scale, time) => {
  const point = archPoint(agent, scale, p.width, p.height);
  const width = agent.width * scale * 1.1;
  const height = agent.height * scale * 1.05;
  p.push();
  p.translate(point.x, point.y);
  p.rotate(agent.tangent + agent.lean * 0.55);
  p.noStroke();
  p.fill(...palette.ground, 220);
  p.beginShape();
  p.vertex(-width * 0.72, -height * 0.5);
  p.vertex(width * 0.62, -height * 0.42);
  p.vertex(width * 0.78, height * 0.5);
  p.vertex(-width * 0.48, height * 0.58);
  p.endShape(p.CLOSE);
  p.stroke(...palette.copper, 115);
  p.strokeWeight(1.1);
  p.line(-width * 0.3, -height * 0.56, width * 0.42, height * 0.56);
  p.stroke(...palette.mint, 70);
  p.line(width * 0.34, -height * 0.43, -width * 0.48, height * 0.4 + Math.sin(time * 0.0002) * 1.5);
  p.pop();
};

const drawAgent = (p, agent, scale, time) => {
  const point = archPoint(agent, scale, p.width, p.height);
  const width = agent.width * scale;
  const height = agent.height * scale;
  const ambientTurn = state.motion ? Math.sin(time * 0.00015 + agent.slot * 0.7) * 0.014 : 0;
  const angle = agent.tangent + agent.lean * 0.55 + agent.tilt * 0.28 + ambientTurn;
  const material = materialFor(agent);
  p.push();
  p.translate(point.x, point.y);
  p.rotate(angle);
  p.noStroke();
  p.fill(0, 0, 0, 110);
  p.beginShape();
  p.vertex(-width * 0.62, -height * 0.42 + scale * 0.035);
  p.vertex(width * 0.68, -height * 0.34 + scale * 0.035);
  p.vertex(width * 0.82, height * 0.5 + scale * 0.035);
  p.vertex(-width * 0.54, height * 0.57 + scale * 0.035);
  p.endShape(p.CLOSE);
  p.fill(...material, 232);
  p.beginShape();
  p.vertex(-width * 0.62, -height * 0.5);
  p.vertex(width * 0.62, -height * 0.42);
  p.vertex(width * 0.78, height * 0.48);
  p.vertex(-width * 0.52, height * 0.56);
  p.endShape(p.CLOSE);
  p.fill(...palette.ink, 24 + agent.attention * 75);
  p.beginShape();
  p.vertex(-width * 0.22, -height * 0.42);
  p.vertex(width * 0.12, -height * 0.39);
  p.vertex(width * 0.18, height * 0.43);
  p.vertex(-width * 0.1, height * 0.48);
  p.endShape(p.CLOSE);
  p.stroke(...(agent.attention > 0.4 ? palette.copper : palette.ink), 90 + agent.attention * 100);
  p.strokeWeight(agent.attention > 0.4 ? 1.15 : 0.65);
  p.line(-width * 0.07, -height * 0.44, width * 0.05, height * 0.45);
  if (agent.scar > 0.1) {
    p.stroke(...palette.mint, 70 + agent.scar * 80);
    p.strokeWeight(0.7);
    p.line(-width * 0.45, -height * 0.1, width * 0.4, height * 0.18);
  }
  p.pop();
};

const drawCurrent = (p, field, time) => {
  const scale = Math.min(p.width, p.height) * 0.34;
  drawBackground(p, time);
  drawRail(p, field.agents, scale, time);
  drawThreads(p, field, scale);
  field.agents.forEach((agent) => agent.present ? drawAgent(p, agent, scale, time) : drawAbsence(p, agent, scale, time));
  p.noFill();
  p.stroke(...palette.ink, 25);
  p.strokeWeight(1);
  p.arc(p.width * 0.5, p.height * 0.66, scale * 2.94, scale * 2.0, Math.PI, Math.PI * 2);
};

const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event, witnesses: [...event.witnesses] })),
  signature: state.frame.field.signature,
  gesture: state.frame.gesture ? { ...state.frame.gesture, slots: [...state.frame.gesture.slots] } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  agentCount: AGENT_COUNT,
  absenceCount: state.frame.field.absences.length,
  presentCount: state.frame.field.agents.filter((agent) => agent.present).length,
  memoryLimit: MEMORY_LIMIT,
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable)
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#absence-field');
    const canvasWidth = Math.max(1, frameElement.clientWidth);
    const canvasHeight = Math.max(1, frameElement.clientHeight);
    const canvas = p.createCanvas(canvasWidth, canvasHeight, p.P2D);
    canvas.id('absence-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'An irregular arch of situated witnesses. Look at three different witnesses to make a remote one leave a real absence.');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    canvas.parent(frameElement);
    placeholder?.remove();
    p.pixelDensity(1);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV047 = { getState: exposeState, getFrame: () => state.frame };
    window._p5Ready = true;
    state.canvas.addEventListener('pointerdown', registerPointerGaze);
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { commitDefault(); event.preventDefault(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { lift(); event.preventDefault(); }
      if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { release(); event.preventDefault(); }
      if (event.key.toLowerCase() === 's') p.saveCanvas('mutine-webgpu-v047', 'png');
    });
  };
  p.draw = () => drawCurrent(p, state.frame.field, p.millis());
  p.windowResized = () => {
    if (!frameElement) return;
    p.resizeCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    p.redraw();
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const gazeButton = document.querySelector('[data-gesture="gaze"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [gazeButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
gazeButton?.addEventListener('click', commitDefault);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
