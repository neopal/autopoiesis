// depth-accord renderer: a continuous fragment field whose archive is a changed ordering of depth.
import {
  STAGES,
  WITNESS_COUNT,
  buildFrame,
  buildTimeline,
  beginWitness,
  finishAccord,
  liftLatestAccord,
  releaseArchive,
  defaultAccord
} from './engine.mjs';

const frameElement = document.querySelector('.accord-frame');
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
  shader: null
};

const vertexShader = `
  precision highp float;
  attribute vec3 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_memory;
  uniform float u_stage;
  uniform float u_aperture;
  uniform float u_shear;
  uniform float u_horizon;
  uniform float u_motion;
  uniform vec4 u_band0;
  uniform vec4 u_band1;
  uniform vec4 u_band2;
  uniform vec4 u_band3;
  uniform vec4 u_band4;
  uniform vec4 u_band5;
  uniform vec4 u_band6;
  uniform vec4 u_band7;
  uniform vec4 u_band8;
  uniform vec4 u_meta0;
  uniform vec4 u_meta1;
  uniform vec4 u_meta2;
  uniform vec4 u_meta3;
  uniform vec4 u_meta4;
  uniform vec4 u_meta5;
  uniform vec4 u_meta6;
  uniform vec4 u_meta7;
  uniform vec4 u_meta8;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c) * p;
  }

  vec3 spectral(float t) {
    vec3 a = vec3(0.035, 0.045, 0.10);
    vec3 b = vec3(0.34, 0.28, 0.18);
    vec3 c = vec3(0.80, 0.56, 0.33);
    vec3 d = vec3(0.21, 0.56, 0.70);
    return a + b * cos(6.28318 * (c * t + d));
  }

  float sheet(vec2 q, vec4 band, vec4 meta, float id, float time) {
    float angle = atan(q.y, q.x);
    vec2 bent = rotate(q, band.w * 0.32 + u_shear * (id - 4.0) * 0.035);
    float radial = length(vec2(bent.x * (1.0 + band.z * 0.08), bent.y * (0.86 + band.z * 0.05)));
    float breathing = sin(angle * (2.0 + mod(id, 3.0)) + meta.x + time * (0.04 + id * 0.003)) * (0.012 + meta.z * 0.018);
    float fold = sin(bent.x * 7.0 + bent.y * 3.2 + meta.x * 1.7 + u_shear * id) * 0.008;
    float distanceToSheet = abs(radial - band.x - breathing - fold);
    float edge = exp(-pow(distanceToSheet / max(0.004, band.y * 1.25), 2.0));
    float gate = smoothstep(-0.2, 0.22, cos(angle - meta.x) - (1.0 - meta.y) * 0.38);
    float glint = pow(max(0.0, sin(angle * 4.0 + meta.x + band.z * 2.0)), 8.0) * 0.24;
    return edge * (0.24 + meta.z * 0.78) * (0.38 + gate * 0.62) + glint * edge;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    uv.y *= -1.0;
    float time = u_time * u_motion;
    vec2 drift = vec2(noise(uv * 1.7 + time * 0.012), noise(uv * 1.4 - time * 0.009)) - 0.5;
    vec2 q = uv + drift * 0.028;
    q.x += sin(q.y * 2.2 + time * 0.08) * u_shear * 0.07;

    vec3 color = mix(vec3(0.018, 0.022, 0.052), vec3(0.075, 0.045, 0.10), smoothstep(-0.9, 0.9, q.y));
    float total = 0.0;
    float layers = 0.0;
    float value;

    value = sheet(q, u_band0, u_meta0, 0.0, time); total += value; layers += value * 0.9;
    value = sheet(q, u_band1, u_meta1, 1.0, time); total += value; layers += value * 0.95;
    value = sheet(q, u_band2, u_meta2, 2.0, time); total += value; layers += value;
    value = sheet(q, u_band3, u_meta3, 3.0, time); total += value; layers += value * 1.05;
    value = sheet(q, u_band4, u_meta4, 4.0, time); total += value; layers += value * 1.1;
    value = sheet(q, u_band5, u_meta5, 5.0, time); total += value; layers += value * 1.05;
    value = sheet(q, u_band6, u_meta6, 6.0, time); total += value; layers += value * 1.0;
    value = sheet(q, u_band7, u_meta7, 7.0, time); total += value; layers += value * 0.95;
    value = sheet(q, u_band8, u_meta8, 8.0, time); total += value; layers += value * 0.9;

    float missing = smoothstep(0.16 + u_aperture * 0.06, 0.01, abs(q.x + sin(q.y * 2.5 + u_shear) * 0.05));
    float throat = smoothstep(0.06, 0.0, abs(q.y - u_horizon * 0.36) + abs(q.x) * 0.11);
    color += spectral(0.58 + u_memory * 0.08) * total * 0.22;
    color += vec3(0.93, 0.48, 0.28) * layers * 0.055;
    color *= 1.0 - missing * 0.84;
    color += vec3(0.12, 0.75, 0.74) * throat * 0.12;

    float grain = hash21(gl_FragCoord.xy + u_stage * 31.0) - 0.5;
    color += grain * 0.018;
    color = pow(max(color, 0.0), vec3(0.92));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const setFrame = (frame) => {
  state.frame = frame;
  updateReadout();
  state.p?.redraw();
};

const updateReadout = () => {
  if (!stageElement) return;
  const memory = state.frame.memory.length;
  stageElement.textContent = `cycle ${String(state.frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  memoryElement.textContent = `${memory} ${memory === 1 ? 'accord' : 'accords'}`;
  rendererElement.textContent = `P5.JS / WEBGL / DEPTH ACCORD${window.__mutineWebGPUAvailable ? ' / GPU READY' : ''}`;
  const action = state.frame.lastAction;
  if (action === 'witness-held') statusElement.textContent = `${state.frame.attention.witnesses.length} witness held · choose two more sites`;
  else if (action === 'witness-third-held') statusElement.textContent = 'three witnesses held · make the accord';
  else if (action === 'witness-refused-repeat') statusElement.textContent = 'the same site cannot witness twice';
  else if (action === 'witness-refused-full') statusElement.textContent = 'three sites already held · make the accord';
  else if (action === 'witness-aimed') statusElement.textContent = 'attention moved · the depth stays exact';
  else if (action === 'accord-committed') statusElement.textContent = 'accord made · a remote depth changed order';
  else if (action === 'accord-refused-incomplete') statusElement.textContent = 'the archive refuses · choose three distinct sites';
  else if (action === 'accord-refused-memory-limit') statusElement.textContent = 'archive full · lift a depth accord first';
  else if (action === 'accord-lifted') statusElement.textContent = 'latest accord lifted · the prior depth returns';
  else if (action === 'archive-released') statusElement.textContent = 'archive released · the quiet depth returns';
  else statusElement.textContent = 'choose three witnesses, then make an accord';
};

const pointFromClient = (clientX, clientY) => {
  const rect = state.canvas?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  };
};

const pointFromP5 = (p) => pointFromClient(p.mouseX + state.canvas.getBoundingClientRect().left, p.mouseY + state.canvas.getBoundingClientRect().top);

const chooseWitness = (point) => {
  state.frame = beginWitness(state.frame, point);
  updateReadout();
  state.p?.redraw();
};

const commitDefaultAccord = () => {
  if (state.frame.attention?.witnesses.length === 3) {
    setFrame(finishAccord(state.frame, { confirmed: true, pressure: 0.74 }));
    return;
  }
  if (state.frame.attention) {
    setFrame(finishAccord(state.frame, { confirmed: true, pressure: 0.74 }));
    return;
  }
  const preset = defaultAccord(state.frame);
  let armed = state.frame;
  preset.witnesses.forEach((witness) => { armed = beginWitness(armed, witness); });
  setFrame(finishAccord(armed, { confirmed: true, pressure: preset.pressure }));
};

const lift = () => setFrame(liftLatestAccord(state.frame));
const release = () => setFrame(releaseArchive());

const setShaderUniforms = (shader, p) => {
  const field = state.frame.field;
  shader.setUniform('u_resolution', [p.width, p.height]);
  shader.setUniform('u_time', performance.now() * 0.001);
  shader.setUniform('u_memory', state.frame.memory.length);
  shader.setUniform('u_stage', state.frame.stage);
  shader.setUniform('u_aperture', field.aperture);
  shader.setUniform('u_shear', field.shear);
  shader.setUniform('u_horizon', field.horizon);
  shader.setUniform('u_motion', state.motion ? 1 : 0);
  field.bands.forEach((band, index) => {
    shader.setUniform(`u_band${index}`, [band.radius, band.width, band.depth, band.twist]);
    shader.setUniform(`u_meta${index}`, [band.phase, band.aperture, band.weight, band.tone]);
  });
};

const p5Sketch = (p) => {
  p.setup = () => {
    const placeholder = document.querySelector('#accord-field');
    const canvas = p.createCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight), p.WEBGL);
    canvas.id('accord-field');
    canvas.elt.setAttribute('role', 'img');
    canvas.elt.setAttribute('aria-label', 'A luminous depth field with a dark missing channel and layered accord memory');
    canvas.elt.tabIndex = 0;
    state.canvas = canvas.elt;
    state.p = p;
    placeholder?.replaceWith(canvas.elt);
    p.pixelDensity(1);
    p.noStroke();
    state.shader = p.createShader(vertexShader, fragmentShader);
    if (!state.motion) p.noLoop();
    updateReadout();
    window.__mutineWebGPUV040 = {
      getState: () => ({
        stage: state.frame.stage,
        memory: state.frame.memory.length,
        signature: state.frame.field.signature,
        attention: Boolean(state.frame.attention),
        witnesses: state.frame.attention?.witnesses ?? [],
        lastAction: state.frame.lastAction,
        kind: state.frame.field.kind,
        bands: state.frame.field.bands.map((band) => ({ ...band })),
        depthOrder: [...state.frame.field.depthOrder],
        aperture: state.frame.field.aperture,
        gpuAvailable: Boolean(window.__mutineWebGPUAvailable),
        witnessCount: WITNESS_COUNT
      })
    };
  };
  p.draw = () => {
    p.shader(state.shader);
    setShaderUniforms(state.shader, p);
    p.rect(0, 0, p.width, p.height);
  };
  p.windowResized = () => {
    if (!frameElement) return;
    p.resizeCanvas(Math.max(1, frameElement.clientWidth), Math.max(1, frameElement.clientHeight));
    p.redraw();
  };
  p.mousePressed = () => {
    if (p.mouseEvent?.target && p.mouseEvent.target !== state.canvas) return true;
    chooseWitness(pointFromP5(p));
    state.canvas?.focus({ preventScroll: true });
    return false;
  };
  p.touchStarted = () => {
    chooseWitness(pointFromP5(p));
    state.canvas?.focus({ preventScroll: true });
    return false;
  };
  p.keyPressed = () => {
    if (p.key === 'Enter' || p.key === ' ') commitDefaultAccord();
    if (p.key === 'Delete' || p.key === 'Backspace') lift();
    if (p.key === 'Escape' || p.key === 'r' || p.key === 'R') release();
    return false;
  };
};

new window.p5(p5Sketch);

const stopCanvasGesture = (event) => event.stopPropagation();
const accordButton = document.querySelector('[data-gesture="accord"]');
const liftButton = document.querySelector('[data-gesture="lift"]');
const releaseButton = document.querySelector('[data-gesture="release"]');
for (const button of [accordButton, liftButton, releaseButton]) {
  button?.addEventListener('pointerdown', stopCanvasGesture);
  button?.addEventListener('pointerup', stopCanvasGesture);
  button?.addEventListener('mousedown', stopCanvasGesture);
  button?.addEventListener('mouseup', stopCanvasGesture);
}
accordButton?.addEventListener('click', commitDefaultAccord);
liftButton?.addEventListener('click', lift);
releaseButton?.addEventListener('click', release);
