import {
  VOICE_COUNT,
  MEMORY_LIMIT,
  STAGES,
  buildFrame,
  buildTimeline,
  recordBeat,
  cancelCadence,
  commitDefaultCadence,
  liftLatestCadence,
  releaseArchive
} from './engine.mjs';

const frameElement = document.querySelector('.fold-frame');
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
  ground: [11, 8, 24],
  deep: [30, 21, 47],
  plum: [81, 54, 103],
  paper: [202, 174, 122],
  copper: [232, 130, 94],
  mint: [120, 219, 183],
  violet: [168, 151, 233],
  ink: [239, 231, 212]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1)
  };
};
const voiceFromPoint = (point) => clamp(Math.round(point.x * (VOICE_COUNT - 1)), 0, VOICE_COUNT - 1);
const directionFromPoint = (point) => point.y < 0.5 ? 1 : -1;

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  const beats = state.frame.gesture?.beats?.length ?? 0;
  stageElement.textContent = `crease ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = state.frame.gesture ? `beat ${beats} / 3` : `${memory} ${memory === 1 ? 'crease' : 'creases'}`;
  rendererElement.textContent = `WEBGPU SIGNAL / WEBGL FALLBACK / FOLDED CHORUS${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'beat-armed') statusElement.textContent = 'first beat held in the ledger · tap again';
  else if (action === 'cadence-building') statusElement.textContent = `phrase building · ${beats} beats registered`;
  else if (action === 'cadence-ready') statusElement.textContent = 'the chorus has three beats · release the break';
  else if (action === 'cadence-committed') statusElement.textContent = 'the missing beat folded the crowd · crease remembered';
  else if (action === 'cadence-refused-regular') statusElement.textContent = 'too regular · the ledger stayed flat';
  else if (action === 'cadence-refused-incomplete') statusElement.textContent = 'the phrase ended early · no crease spent';
  else if (action === 'cadence-cancelled') statusElement.textContent = 'phrase withdrawn · no ghost crease remains';
  else if (action === 'cadence-refused-memory-limit') statusElement.textContent = 'the archive is full · lift a crease first';
  else if (action === 'cadence-lifted') statusElement.textContent = 'latest wrong rhythm lifted · the prior fold returns';
  else if (action === 'archive-released') statusElement.textContent = 'archive released · the quiet ledger returns';
  else statusElement.textContent = blindMode ? '' : 'tap an uneven three-beat phrase into the ledger';
};

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const registerPointerBeat = (event) => {
  if (event.target !== state.canvas || state.frame.memory.length >= MEMORY_LIMIT) return;
  const point = pointFromClient(event.clientX, event.clientY);
  setFrame(recordBeat(state.frame, {
    time: performance.now(),
    index: voiceFromPoint(point)
  }));
  state.canvas.focus({ preventScroll: true });
  event.preventDefault();
};

const commitDefault = () => setFrame(commitDefaultCadence(state.frame));
const lift = () => setFrame(liftLatestCadence(state.frame));
const release = () => setFrame(releaseArchive());

const drawLeaf = (p, voice, scale, time) => {
  const width = voice.width * scale;
  const height = voice.height * scale;
  const depth = scale * (0.028 + voice.crease * 0.035);
  const fold = voice.fold + (state.motion ? Math.sin(time * 0.00018 + voice.phase) * 0.012 : 0);
  const hueMaterial = voice.tone > 0.72 ? palette.violet : voice.tone > 0.38 ? palette.paper : palette.plum;
  const creaseMaterial = voice.crease > 0.42 ? (voice.ink > 0.46 ? palette.copper : palette.mint) : hueMaterial;
  const angle = voice.lean * 0.44 + (voice.id % 3 - 1) * 0.05;

  p.push();
  p.translate(voice.x * scale, voice.y * scale, voice.z * scale);
  p.rotateZ(-0.18 + angle);
  p.rotateY(fold * 0.34);
  p.noStroke();
  p.ambientMaterial(...hueMaterial);
  p.beginShape(p.TRIANGLES);
  p.vertex(0, -height * 0.54, depth * 0.1);
  p.vertex(-width * 0.5, height * 0.48, -depth * 0.2);
  p.vertex(0, height * 0.38, depth * (0.9 + fold * 0.25));
  p.vertex(0, -height * 0.54, depth * 0.1);
  p.vertex(0, height * 0.38, depth * (0.9 + fold * 0.25));
  p.vertex(width * 0.5, height * 0.48, -depth * 0.2);
  p.endShape();
  p.ambientMaterial(...creaseMaterial);
  p.beginShape(p.TRIANGLES);
  p.vertex(0, -height * 0.54, -depth * 0.12);
  p.vertex(0, height * 0.38, -depth * (0.45 + fold * 0.14));
  p.vertex(-width * 0.5, height * 0.48, -depth * 0.2);
  p.vertex(0, -height * 0.54, -depth * 0.12);
  p.vertex(width * 0.5, height * 0.48, -depth * 0.2);
  p.vertex(0, height * 0.38, -depth * (0.45 + fold * 0.14));
  p.endShape();
  p.stroke(...(voice.crease > 0.5 ? palette.ink : palette.deep), voice.crease > 0.5 ? 150 : 85);
  p.strokeWeight(voice.crease > 0.6 ? 1.35 : 0.75);
  p.line(0, -height * 0.5, depth * 0.12, 0, height * 0.37, depth * (0.85 + fold * 0.2));
  p.pop();
};

const drawSpine = (p, voices, scale) => {
  p.push();
  p.noFill();
  p.stroke(...palette.mint, 42);
  p.strokeWeight(1);
  p.beginShape();
  voices.forEach((voice) => p.vertex(voice.x * scale, voice.y * scale, voice.z * scale - scale * 0.055));
  p.endShape();
  p.stroke(...palette.copper, 24);
  p.strokeWeight(2.2);
  for (let index = 2; index < voices.length; index += 3) {
    const previous = voices[index - 1];
    const current = voices[index];
    p.line(previous.x * scale, previous.y * scale, previous.z * scale - scale * 0.07, current.x * scale, current.y * scale, current.z * scale - scale * 0.07);
  }
  p.pop();
};

const drawCreaseMarkers = (p, field, scale) => {
  field.creases.forEach((crease, index) => {
    const voice = field.voices[crease.anchorIndex];
    if (!voice) return;
    const length = scale * (0.28 + index * 0.045);
    p.push();
    p.translate(voice.x * scale, voice.y * scale, voice.z * scale + scale * (0.08 + index * 0.025));
    p.rotateZ(-0.18 + voice.lean * 0.44);
    p.rotateY(voice.fold * 0.28);
    p.noStroke();
    p.ambientMaterial(...(crease.cadenceShape === 'late-break' ? palette.copper : palette.mint));
    p.box(length, scale * 0.012, scale * 0.018);
    p.pop();
  });
};

const drawCurrent = (p, field, time) => {
  const scale = Math.min(p.width, p.height) * 0.34;
  p.background(...palette.ground);
  p.ambientLight(56, 48, 72);
  p.directionalLight(211, 186, 145, -0.55, 0.48, -1);
  p.pointLight(232, 130, 94, scale * 0.7, -scale * 0.6, scale * 1.2);
  p.pointLight(120, 219, 183, -scale * 0.8, scale * 0.3, scale * 0.7);
  p.push();
  p.rotateX(0.38);
  p.rotateY(-0.22 + (state.motion ? Math.sin(time * 0.0001) * 0.012 : 0));
  p.rotateZ(-0.05);
  drawSpine(p, field.voices, scale);
  field.voices.forEach((voice) => drawLeaf(p, voice, scale, time));
  drawCreaseMarkers(p, field, scale);
  p.pop();
};

const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event, beats: [...event.beats] })),
  signature: state.frame.field.signature,
  gesture: state.frame.gesture ? { ...state.frame.gesture, beats: [...state.frame.gesture.beats] } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  voiceCount: VOICE_COUNT,
  creaseCount: state.frame.field.creases.length,
  memoryLimit: MEMORY_LIMIT,
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable)
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#chorus-field');
    const canvasWidth = Math.max(1, frameElement.clientWidth);
    const canvasHeight = Math.max(1, frameElement.clientHeight);
    const canvas = p.createCanvas(canvasWidth, canvasHeight, p.WEBGL);
    canvas.id('chorus-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A diagonal chorus of folded planes that re-creases when an uneven three-beat cadence is released');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    canvas.parent(frameElement);
    placeholder?.remove();
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV046 = { getState: exposeState, getFrame: () => state.frame };
    window._p5Ready = true;

    state.canvas.addEventListener('pointerdown', registerPointerBeat);
    state.canvas.addEventListener('pointercancel', (event) => { setFrame(cancelCadence(state.frame)); event.preventDefault(); });
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { commitDefault(); event.preventDefault(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { lift(); event.preventDefault(); }
      if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { release(); event.preventDefault(); }
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
const cadenceButton = document.querySelector('[data-gesture="cadence"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [cadenceButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
cadenceButton?.addEventListener('click', commitDefault);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
