import {
  PORT_COUNT,
  MEMORY_LIMIT,
  buildFrame,
  buildTimeline,
  geometrySignature,
  pressPort,
  releaseAtPort,
  commitDefaultRoute,
  liftLatest,
  releaseMaterial
} from './engine.mjs';

const frameElement = document.querySelector('#pressure-frame');
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
  p: null,
  pointerEntry: null,
  focusedPort: 0
};

const palette = {
  ground: [7, 10, 18],
  deep: [12, 24, 42],
  blue: [65, 113, 139],
  steel: [126, 158, 174],
  paper: [215, 182, 121],
  copper: [226, 145, 91],
  mint: [139, 217, 199],
  violet: [150, 138, 199],
  ink: [235, 226, 210]
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const portPoint = (port, width, height) => ({ x: port.nx * width, y: port.ny * height });
const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return { x: clamp(clientX - rect.left, 0, rect.width), y: clamp(clientY - rect.top, 0, rect.height) };
};
const pickPort = (point) => {
  let best = 0;
  let bestDistance = Infinity;
  state.frame.field.ports.forEach((port) => {
    const projected = portPoint(port, state.p.width, state.p.height);
    const distance = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = port.id; }
  });
  return best;
};
const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  const active = state.frame.gesture ? `source ${state.frame.gesture.entry + 1} / ${PORT_COUNT}` : `${memory} ${memory === 1 ? 'route' : 'routes'}`;
  stageElement.textContent = `shell ${String(state.frame.stage + 1).padStart(2, '0')} / ${MEMORY_LIMIT + 1}`;
  memoryElement.textContent = state.frame.gesture ? `pressure armed · ${active}` : `material · ${active}`;
  rendererElement.textContent = `WEBGPU SIGNAL / WEBGL SURFACE / PRESSURE SHELL${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'pressure-armed') statusElement.textContent = `source ${state.frame.gesture.entry + 1} held · release at the exit`;
  else if (action === 'pressure-committed') statusElement.textContent = `the shell re-produced · source moved to port ${state.frame.field.nextEntry + 1}`;
  else if (action === 'route-refused-origin') statusElement.textContent = `pressure refuses that source · port ${state.frame.field.nextEntry + 1} is lit`;
  else if (action === 'route-refused-exit') statusElement.textContent = 'the material route did not reach its chosen mouth';
  else if (action === 'route-refused-repeat') statusElement.textContent = 'one port cannot begin and end the same route';
  else if (action === 'route-refused-memory-limit') statusElement.textContent = 'the shell is full · lift a route first';
  else if (action === 'pressure-lifted') statusElement.textContent = 'the last route lifted · the prior shell resumes';
  else if (action === 'material-released') statusElement.textContent = 'material released · the quiet shell returns';
  else statusElement.textContent = blindMode ? '' : `press port ${state.frame.field.nextEntry + 1} · release at its chosen exit`;
};
const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};
const surfacePoint = (vertex, scale) => ({ x: vertex.x * scale, y: vertex.y * scale, z: vertex.z * scale });
const facetColor = (vertices) => {
  const pressure = vertices.reduce((sum, vertex) => sum + vertex.pressure, 0) / vertices.length;
  const torsion = Math.abs(vertices.reduce((sum, vertex) => sum + vertex.torsion, 0) / vertices.length);
  const r = 22 + pressure * 174 + torsion * 26;
  const g = 43 + (1 - pressure) * 58 + torsion * 24;
  const b = 69 + (1 - pressure) * 80 + pressure * 34;
  return [r, g, b, 232];
};
const nearestVertex = (vertices, point) => {
  let best = vertices[0];
  let bestDistance = Infinity;
  vertices.forEach((vertex) => {
    const distance = (vertex.u - point.u) ** 2 + (vertex.v - point.v) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = vertex; }
  });
  return best;
};

const drawBackdrop = (p, time) => {
  p.background(...palette.ground);
  p.push();
  p.noStroke();
  p.translate(0, 0, -420);
  p.fill(10, 21, 39, 255);
  p.ellipse(-p.width * 0.28, -p.height * 0.22, p.width * 0.9, p.height * 0.72);
  p.fill(55, 24, 30, 120);
  p.ellipse(p.width * 0.3, p.height * 0.3, p.width * 0.68, p.height * 0.55);
  p.pop();
  p.push();
  p.noFill();
  p.stroke(...palette.steel, 22);
  p.strokeWeight(1);
  for (let index = 0; index < 5; index += 1) {
    const offset = Math.sin(index * 1.7 + time * 0.00008) * 4;
    p.arc(-p.width * 0.1, p.height * 0.02, p.width * (0.8 + index * 0.12), p.height * (0.65 + index * 0.08), Math.PI * 0.15, Math.PI * 1.05);
    p.translate(offset * 0.2, offset * 0.1, 0);
  }
  p.pop();
};

const drawShell = (p, field, time) => {
  const scale = Math.min(p.width, p.height) * 0.31;
  const spin = state.motion ? Math.sin(time * 0.00016) * 0.035 : 0;
  p.push();
  p.rotateX(-0.3 + spin);
  p.rotateY(0.48 + spin * 1.6);
  p.rotateZ(-0.08);
  p.scale(scale);
  p.noStroke();
  field.surface.faces.forEach((face, index) => {
    const vertices = face.map((vertexIndex) => field.surface.vertices[vertexIndex]);
    const [r, g, b, alpha] = facetColor(vertices);
    p.fill(r, g, b, alpha);
    p.beginShape(p.TRIANGLES);
    vertices.forEach((vertex) => p.vertex(vertex.x, vertex.y, vertex.z));
    p.endShape();
    if (index % 5 === 0) {
      p.stroke(...palette.ink, 24);
      p.strokeWeight(0.004);
      p.beginShape(p.LINE_STRIP);
      vertices.forEach((vertex) => p.vertex(vertex.x, vertex.y, vertex.z + 0.006));
      p.endShape();
      p.noStroke();
    }
  });
  field.seams.forEach((seam, seamIndex) => {
    p.noFill();
    p.stroke(...(seamIndex % 2 ? palette.mint : palette.copper), 170 - seamIndex * 18);
    p.strokeWeight(0.016 + seamIndex * 0.003);
    p.beginShape(p.LINE_STRIP);
    seam.points.forEach((point) => {
      const vertex = nearestVertex(field.surface.vertices, point);
      p.vertex(vertex.x, vertex.y, vertex.z + point.lift * 0.08);
    });
    p.endShape();
  });
  p.pop();
};

const drawPorts = (p, field) => {
  p.push();
  p.resetMatrix();
  p.translate(-p.width / 2, -p.height / 2, 120);
  field.ports.forEach((port) => {
    const point = portPoint(port, p.width, p.height);
    const active = port.id === field.nextEntry;
    const armed = state.frame.gesture?.entry === port.id;
    p.push();
    p.translate(point.x, point.y);
    p.noFill();
    p.stroke(...(armed ? palette.copper : active ? palette.mint : palette.steel), active || armed ? 220 : 80);
    p.strokeWeight(active || armed ? 2 : 1);
    p.ellipse(0, 0, active || armed ? 18 : 12, active || armed ? 18 : 12);
    p.line(-4, 0, 4, 0);
    p.line(0, -4, 0, 4);
    p.pop();
  });
  p.pop();
};

const drawCurrent = (p, field, time) => {
  drawBackdrop(p, time);
  drawShell(p, field, time);
  drawPorts(p, field);
};

const exposeState = () => ({
  stage: state.frame.stage,
  memory: state.frame.memory.length,
  events: state.frame.memory.map((event) => ({ ...event })),
  signature: geometrySignature(state.frame),
  gesture: state.frame.gesture ? { ...state.frame.gesture } : null,
  lastAction: state.frame.lastAction,
  kind: state.frame.field.kind,
  portCount: PORT_COUNT,
  seamCount: state.frame.field.seams.length,
  nextEntry: state.frame.field.nextEntry,
  vertexCount: state.frame.field.surface.vertices.length,
  memoryLimit: MEMORY_LIMIT,
  gpuAvailable: Boolean(window.__mutineWebGPUAvailable)
});

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#pressure-field');
    const canvasWidth = Math.max(1, frameElement.clientWidth);
    const canvasHeight = Math.max(1, frameElement.clientHeight);
    const canvas = p.createCanvas(canvasWidth, canvasHeight, p.WEBGL);
    canvas.id('pressure-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A continuous faceted pressure shell. Press the lit source port and release at the next material port to rewrite the whole surface.');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    canvas.parent(frameElement);
    placeholder?.remove();
    p.pixelDensity(1);
    p.setAttributes('antialias', true);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV048 = { getState: exposeState, getFrame: () => state.frame };
    window._p5Ready = true;
    state.canvas.addEventListener('pointerdown', (event) => {
      if (event.target !== state.canvas) return;
      const port = pickPort(pointFromClient(event.clientX, event.clientY));
      state.pointerEntry = port;
      state.focusedPort = port;
      setFrame(pressPort(state.frame, port));
      state.canvas.focus({ preventScroll: true });
      event.preventDefault();
    });
    state.canvas.addEventListener('pointerup', (event) => {
      if (event.target !== state.canvas || state.pointerEntry === null) return;
      const port = pickPort(pointFromClient(event.clientX, event.clientY));
      setFrame(releaseAtPort(state.frame, port));
      state.pointerEntry = null;
      event.preventDefault();
    });
    state.canvas.addEventListener('pointercancel', () => { state.pointerEntry = null; });
    state.canvas.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { state.focusedPort = (state.focusedPort + 1) % PORT_COUNT; event.preventDefault(); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { state.focusedPort = (state.focusedPort - 1 + PORT_COUNT) % PORT_COUNT; event.preventDefault(); }
      if (event.key === 'Enter' || event.key === ' ') { setFrame(commitDefaultRoute(state.frame)); event.preventDefault(); }
      if (event.key === 'Delete' || event.key === 'Backspace') { setFrame(liftLatest(state.frame)); event.preventDefault(); }
      if (event.key === 'Escape' || event.key.toLowerCase() === 'r') { setFrame(releaseMaterial()); event.preventDefault(); }
      if (event.key.toLowerCase() === 's') p.saveCanvas('mutine-webgpu-v048', 'png');
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
const routeButton = document.querySelector('[data-gesture="route"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [routeButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
  button?.addEventListener('touchstart', stopCanvasGesture, { passive: true });
  button?.addEventListener('touchend', stopCanvasGesture, { passive: true });
}
routeButton?.addEventListener('click', () => setFrame(commitDefaultRoute(state.frame)));
liftButton?.addEventListener('click', () => setFrame(liftLatest(state.frame)));
releaseButton?.addEventListener('click', () => setFrame(releaseMaterial()));
