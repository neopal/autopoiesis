import {
  BLOCK_COUNT,
  MEMORY_WINDOW,
  beginPressure,
  buildFrame,
  geometrySignature,
  liftLatest,
  release,
  releasePressure,
  cast
} from './engine.mjs';

const DEFAULT_CASTS = [
  { source: 3, elapsed: 920 },
  { source: 8, elapsed: 680 },
  { source: 1, elapsed: 1080 },
  { source: 10, elapsed: 520 }
];
const KEYBOARD_SOURCES = [3, 8, 1, 10];
const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const field = document.querySelector('#casting-field');
const canvas = document.querySelector('#cast-canvas');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const interactionState = document.querySelector('[data-interaction-state]');
const castControl = document.querySelector('#cast-control');
const liftControl = document.querySelector('#lift-cast');
const releaseControl = document.querySelector('#release-cast');

let currentFrame = staticPreview ? buildFrame(DEFAULT_CASTS) : buildFrame([]);
let lastState = staticPreview ? 'cast' : 'quiet';
let keyboardFocus = 3;
let pointerStart = 0;
let pointerActive = false;
let pointerId = null;
let gl = null;
let context2d = null;
let program = null;
let textureCache = new Map();
let positionBuffer = null;
let uvBuffer = null;
let indexBuffer = null;
let projectionLocation = null;
let modelLocation = null;
let textureLocation = null;
let tintLocation = null;
let cameraTime = 0;

const VERTEX_SHADER = `
  attribute vec3 aPosition;
  attribute vec2 aUv;
  uniform mat4 uProjection;
  uniform mat4 uModel;
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    gl_Position = uProjection * uModel * vec4(aPosition, 1.0);
  }
`;
const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uTexture;
  uniform vec4 uTint;
  varying vec2 vUv;
  void main() {
    vec4 surface = texture2D(uTexture, vUv);
    gl_FragColor = surface * uTint;
  }
`;

const multiply = (a, b) => {
  const output = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return output;
};

const identity = () => new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1
]);

const translation = (x, y, z) => {
  const matrix = identity();
  matrix[12] = x;
  matrix[13] = y;
  matrix[14] = z;
  return matrix;
};

const scale = (x, y, z) => {
  const matrix = identity();
  matrix[0] = x;
  matrix[5] = y;
  matrix[10] = z;
  return matrix;
};

const rotationY = (angle) => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1
  ]);
};

const rotationZ = (angle) => {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new Float32Array([
    cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
};

const perspective = (fieldOfView, aspect, near, far) => {
  const f = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, near * far * range * 2, 0
  ]);
};

const tintFor = (block, layer) => {
  const palette = block.role === 'receiver'
    ? [0.92, 0.58, 0.28, 1]
    : block.role === 'echo'
      ? [0.31, 0.57, 0.64, 1]
      : block.role === 'counterform'
        ? [0.82, 0.34, 0.3, 1]
        : [0.62, 0.77, 0.79, 1];
  const shade = layer === 0 ? 1 : Math.max(0.18, 0.74 - layer * 0.08);
  return [palette[0] * shade, palette[1] * shade, palette[2] * shade, palette[3]];
};

const textureKey = (block) => [block.token, block.role, block.aperture, block.extrusion, block.pressure, block.cast, block.skew].join('|');

function createBlockTexture(block) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 512;
  textureCanvas.height = 320;
  const context = textureCanvas.getContext('2d');
  const roleColor = block.role === 'receiver' ? '#e7a35f' : block.role === 'echo' ? '#71c7c7' : block.role === 'counterform' ? '#d46f5f' : '#b9d1d3';
  const darkColor = block.role === 'receiver' ? '#4b2d1f' : '#101b24';
  context.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  context.shadowColor = 'rgba(0, 0, 0, .45)';
  context.shadowBlur = 24;
  context.shadowOffsetY = 18;
  context.fillStyle = 'rgba(0, 0, 0, .44)';
  context.beginPath();
  context.roundRect(28, 34, 456, 252, 24);
  context.fill();
  context.shadowColor = 'transparent';
  const surface = context.createLinearGradient(0, 30, 512, 300);
  surface.addColorStop(0, block.role === 'counterform' ? '#471d25' : '#263943');
  surface.addColorStop(.52, block.role === 'receiver' ? '#67462f' : '#15242e');
  surface.addColorStop(1, '#080d13');
  context.fillStyle = surface;
  context.beginPath();
  context.roundRect(18, 18, 456, 252, 24);
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = roleColor;
  context.globalAlpha = .84;
  context.stroke();
  context.globalAlpha = 1;
  const cavityWidth = 340 * block.aperture;
  const cavityHeight = 182 * block.aperture;
  context.fillStyle = darkColor;
  context.beginPath();
  context.roundRect(256 - cavityWidth / 2, 144 - cavityHeight / 2, cavityWidth, cavityHeight, 18);
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = `${roleColor}99`;
  context.stroke();
  context.fillStyle = roleColor;
  context.font = '900 168px Arial Narrow, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  if (block.role === 'counterform') {
    context.globalAlpha = .28;
    context.strokeStyle = roleColor;
    context.lineWidth = 7;
    context.strokeText(block.token, 256, 142);
    context.globalAlpha = 1;
  } else {
    context.fillText(block.token, 256, 142);
  }
  context.globalAlpha = .55;
  context.fillStyle = '#e8eef0';
  context.font = '600 14px ui-monospace, monospace';
  context.textAlign = 'left';
  context.fillText(`MOLD ${String(block.id + 1).padStart(2, '0')}`, 36, 298);
  context.textAlign = 'right';
  context.fillText(`D${Math.round(block.depth * 12).toString().padStart(2, '0')}`, 470, 298);
  context.globalAlpha = 1;
  return textureCanvas;
}

function getTexture(block) {
  const key = textureKey(block);
  if (textureCache.has(key)) return textureCache.get(key);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createBlockTexture(block));
  textureCache.set(key, texture);
  return texture;
}

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

function initWebGL() {
  const vertexShader = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), gl.STATIC_DRAW);
  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), gl.STATIC_DRAW);
  const uvLocation = gl.getAttribLocation(program, 'aUv');
  gl.enableVertexAttribArray(uvLocation);
  gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 0, 0);
  indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  projectionLocation = gl.getUniformLocation(program, 'uProjection');
  modelLocation = gl.getUniformLocation(program, 'uModel');
  textureLocation = gl.getUniformLocation(program, 'uTexture');
  tintLocation = gl.getUniformLocation(program, 'uTint');
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function resizeCanvas() {
  const rect = field.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    if (gl) gl.viewport(0, 0, width, height);
  }
}

function drawQuad(block, layer, cameraYaw, projection) {
  const aspect = canvas.width / Math.max(1, canvas.height);
  const x = block.x * 1.02;
  const y = -block.y * 1.04;
  const z = -3.18 + block.depth * .72 - layer * (block.extrusion * .14);
  const width = .38 * block.scale * (aspect < 1 ? .92 : 1);
  const height = .27 * block.scale;
  let model = translation(x, y, z);
  model = multiply(model, rotationY(cameraYaw + block.rotation * .45));
  model = multiply(model, rotationZ(-block.rotation * .42 + block.skew * .16));
  model = multiply(model, scale(width, height, 1));
  gl.uniformMatrix4fv(modelLocation, false, model);
  gl.uniform4fv(tintLocation, tintFor(block, layer));
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, getTexture(block));
  gl.uniform1i(textureLocation, 0);
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
}

function renderWebGL(time) {
  resizeCanvas();
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const aspect = canvas.width / Math.max(1, canvas.height);
  const projection = perspective(.88, aspect, .1, 10);
  gl.useProgram(program);
  gl.uniformMatrix4fv(projectionLocation, false, projection);
  const cameraYaw = staticPreview || reducedMotion ? .02 : Math.sin(time * .00018) * .06;
  const ordered = [...currentFrame.blocks].sort((a, b) => a.depth - b.depth);
  for (const block of ordered) {
    const layers = Math.max(2, Math.round(2 + block.extrusion * 7));
    for (let layer = layers; layer >= 0; layer -= 1) drawQuad(block, layer, cameraYaw, projection);
  }
}

function renderFallback() {
  resizeCanvas();
  context2d.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context2d.createRadialGradient(canvas.width * .5, canvas.height * .45, 2, canvas.width * .5, canvas.height * .45, canvas.width * .7);
  gradient.addColorStop(0, 'rgba(29, 69, 78, .68)');
  gradient.addColorStop(1, 'rgba(4, 8, 13, 0)');
  context2d.fillStyle = gradient;
  context2d.fillRect(0, 0, canvas.width, canvas.height);
  const sorted = [...currentFrame.blocks].sort((a, b) => a.depth - b.depth);
  for (const block of sorted) {
    const x = (block.x * .45 + .5) * canvas.width;
    const y = (block.y * .45 + .5) * canvas.height;
    const width = 90 * block.scale;
    const height = 62 * block.scale;
    context2d.save();
    context2d.translate(x, y);
    context2d.rotate(block.rotation);
    context2d.fillStyle = block.role === 'receiver' ? '#e7a35f' : block.role === 'counterform' ? '#d46f5f' : '#71c7c7';
    context2d.globalAlpha = .62;
    context2d.fillRect(-width / 2, -height / 2, width, height);
    context2d.globalAlpha = 1;
    context2d.fillStyle = '#0b1017';
    context2d.font = `900 ${Math.round(52 * block.scale)}px Arial`;
    context2d.textAlign = 'center';
    context2d.textBaseline = 'middle';
    context2d.fillText(block.token, 0, 0);
    context2d.restore();
  }
}

function renderScene(time = cameraTime) {
  cameraTime = time;
  if (gl) renderWebGL(time);
  else renderFallback();
}

function roleLabel(state) {
  if (state === 'charging') return `rack / charging mold ${String(currentFrame.active + 1).padStart(2, '0')}`;
  if (state === 'cast') return `rack / cast ${String(currentFrame.history.length).padStart(2, '0')}`;
  if (state === 'lifted') return 'rack / latest lifted';
  if (state === 'released') return 'rack / released';
  if (state === 'refused') return 'rack / refused';
  return 'rack / quiet';
}

function render(frame, state = lastState) {
  currentFrame = frame;
  lastState = state;
  field.dataset.stage = state;
  field.dataset.memory = String(frame.memory.length);
  field.dataset.signature = geometrySignature(frame);
  field.dataset.active = frame.active === null ? '' : String(frame.active);
  stageReadout.textContent = roleLabel(state);
  memoryReadout.textContent = `${frame.memory.length} casts · ${BLOCK_COUNT} blocks`;
  interactionState.textContent = state === 'charging'
    ? `Block ${frame.active + 1} is holding pressure. Its geometry has not moved.`
    : state === 'cast'
      ? 'Pressure released. A remote mold has changed; the source stayed exact.'
      : state === 'lifted'
        ? 'The latest cast is gone. The preceding rack is exact again.'
        : state === 'released'
          ? 'The rack is released. Every mold has returned to its quiet depth.'
          : state === 'refused'
            ? 'Nothing moved. A cast needs a pressed source block.'
            : 'The rack is quiet. No pressure has entered the mold.';
  castControl.disabled = staticPreview;
  liftControl.disabled = staticPreview || frame.history.length === 0;
  releaseControl.disabled = staticPreview;
  renderScene(cameraTime);
}

function pickBlock(event) {
  const rect = canvas.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const py = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  let best = currentFrame.blocks[0];
  let bestDistance = Infinity;
  for (const block of currentFrame.blocks) {
    const dx = px - block.x;
    const dy = py - block.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = block;
      bestDistance = distance;
    }
  }
  return best.id;
}

function startPressure(source, pressureMs = 0) {
  if (staticPreview) return false;
  keyboardFocus = source;
  render(beginPressure(currentFrame, source, pressureMs), 'charging');
  return true;
}

function finishPressure(elapsed) {
  if (staticPreview || !Number.isInteger(currentFrame.active)) return false;
  const next = releasePressure(currentFrame, elapsed);
  render(next, next.lastEvent === 'cast' ? 'cast' : 'refused');
  return next.lastEvent === 'cast';
}

function deterministicCast() {
  if (staticPreview) return false;
  const source = KEYBOARD_SOURCES[currentFrame.history.length % KEYBOARD_SOURCES.length];
  startPressure(source, 760);
  return finishPressure(760 + currentFrame.history.length * 90);
}

function lift() {
  if (staticPreview) return false;
  const next = liftLatest(currentFrame);
  render(next, next.lastEvent === 'lifted' ? 'lifted' : 'refused');
  return next.lastEvent === 'lifted';
}

function reset() {
  if (staticPreview) return false;
  render(release(), 'released');
  return true;
}

function handleKey(event) {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    keyboardFocus = (keyboardFocus + (event.key === 'ArrowRight' ? 1 : -1) + BLOCK_COUNT) % BLOCK_COUNT;
    startPressure(keyboardFocus, 0);
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    deterministicCast();
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    lift();
  } else if (event.key.toLowerCase() === 'r' || event.key === 'Escape') {
    event.preventDefault();
    reset();
  }
}

function animationFrame(time) {
  if (!reducedMotion && !staticPreview) renderScene(time);
  requestAnimationFrame(animationFrame);
}

field.addEventListener('keydown', handleKey);
field.addEventListener('pointerdown', (event) => {
  if (staticPreview || pointerActive) return;
  pointerActive = true;
  pointerId = event.pointerId;
  field.setPointerCapture(pointerId);
  pointerStart = performance.now();
  startPressure(pickBlock(event), 0);
});
field.addEventListener('pointerup', (event) => {
  if (!pointerActive || event.pointerId !== pointerId) return;
  pointerActive = false;
  const elapsed = performance.now() - pointerStart;
  finishPressure(elapsed);
});
field.addEventListener('pointercancel', () => {
  pointerActive = false;
  if (!staticPreview) render(currentFrame.active === null ? currentFrame : releasePressure({ ...currentFrame, active: null }), 'refused');
});
castControl.addEventListener('click', deterministicCast);
liftControl.addEventListener('click', lift);
releaseControl.addEventListener('click', reset);

try {
  gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: false });
  if (gl) initWebGL();
  else context2d = canvas.getContext('2d');
} catch (error) {
  gl = null;
  context2d = canvas.getContext('2d');
  field.dataset.renderer = 'fallback';
}

render(currentFrame, lastState);
window._p5Ready = true;
window.__mutineHandwritingV035 = {
  getState: () => ({ memory: currentFrame.memory.length, active: currentFrame.active, history: currentFrame.history.map((event) => ({ ...event })), changedBlockIds: [...currentFrame.changedBlockIds], lastEvent: currentFrame.lastEvent, interaction: lastState }),
  getSignature: () => geometrySignature(currentFrame),
  getFrame: () => currentFrame,
  beginPressure: startPressure,
  releasePressure: finishPressure,
  cast: deterministicCast,
  liftLatest: lift,
  release: reset
};
requestAnimationFrame(animationFrame);
