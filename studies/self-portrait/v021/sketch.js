import {
  STAGES,
  FACET_COUNT,
  buildFrame,
  buildTimeline,
  armAttention,
  commitDeparture,
  defaultCue,
  liftLatestDeparture,
  releaseAttention,
  geometrySignature
} from './engine.mjs';

const params = new URLSearchParams(location.search);
const interactivePreview = params.has('interaction') || document.documentElement.classList.contains('interactive-preview');
const staticPreview = params.get('static') === '1' || (params.has('preview') && !interactivePreview);
const blindMode = params.get('blind') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frozen = reducedMotion || staticPreview;
const timeline = buildTimeline();
const STAGE_MS = 3100;

const field = document.querySelector('#blind-field');
const stageReadout = document.querySelector('[data-stage]');
const memoryReadout = document.querySelector('[data-memory]');
const stateReadout = document.querySelector('[data-interaction-state]');
const hint = document.querySelector('[data-hint]');
const approachControl = document.querySelector('#approach-control');
const liftControl = document.querySelector('#lift-turn');
const releaseControl = document.querySelector('#release-attention');

const palette = {
  deep: [217, 34, 7],
  haze: [205, 30, 13],
  quiet: [195, 32, 66],
  quietEdge: [188, 42, 84],
  ember: [17, 70, 92],
  mint: [142, 48, 88],
  answer: [183, 43, 88],
  violet: [248, 30, 76]
};

let startedAt = performance.now();
let interactionFrame = null;
let currentFrame = timeline[0];
let canvasElement = null;
let pointerState = null;
let pointerMoved = false;

function activeFrameAt(now = performance.now()) {
  if (interactionFrame) return interactionFrame;
  if (frozen) return timeline.at(-1);
  const elapsed = Math.max(0, now - startedAt);
  return timeline[Math.floor((elapsed % (STAGE_MS * timeline.length)) / STAGE_MS)];
}

function pointFromEvent(event) {
  const rect = canvasElement?.getBoundingClientRect() ?? field.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 0.72,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 0.72
  };
}

function baselineWithoutArm() {
  const frame = interactionFrame ?? activeFrameAt();
  return buildFrame(frame.stage, frame.memory);
}

function updateReadout(frame, interaction = frame.interaction || 'sequence') {
  const averted = frame.facets.filter((facet) => facet.status === 'averted').length;
  const answered = frame.facets.filter((facet) => facet.status === 'answered').length;
  if (stageReadout) {
    stageReadout.textContent = interaction === 'departure-committed'
      ? 'blind side turned / distant answer'
      : interaction === 'departure-lifted'
        ? 'latest turn lifted'
        : interaction === 'pointer-tap-refused'
          ? 'tap refused / approach then leave'
          : interaction === 'attention-armed'
            ? 'attention armed / leaving commits'
            : `stage ${String(frame.stage + 1).padStart(2, '0')} / ${STAGES}`;
  }
  if (memoryReadout) memoryReadout.textContent = `${frame.memory.length} turn${frame.memory.length === 1 ? '' : 's'} · ${averted} avert · ${answered} answer`;
  if (stateReadout) {
    stateReadout.textContent = interaction === 'departure-committed'
      ? 'One facet has turned its blind side; a distant facet now carries the answer.'
      : interaction === 'departure-lifted'
        ? 'The latest departure is gone; the preceding mobile is exact again.'
        : interaction === 'pointer-tap-refused'
          ? 'A tap cannot make the portrait look back. Approach, then depart.'
          : interaction === 'attention-armed'
            ? 'Nearness is only a witness. Leave the field to make the portrait decide.'
            : 'The mobile is not looking back.';
  }
  if (hint) hint.textContent = interaction === 'attention-armed' ? 'leave the field' : 'move close, then leave';
  if (field) {
    field.dataset.stage = String(frame.stage);
    field.dataset.memory = String(frame.memory.length);
    field.dataset.averted = String(averted);
    field.dataset.answered = String(answered);
    field.dataset.interaction = interaction;
    field.dataset.signature = geometrySignature(frame);
  }
}

function renderFrame(frame, interaction = frame.interaction || 'sequence') {
  currentFrame = frame;
  updateReadout(frame, interaction);
  window.__mutinePortraitV021?.requestRender?.();
}

function arm(point) {
  const base = interactionFrame ?? activeFrameAt();
  interactionFrame = armAttention(base, point);
  renderFrame(interactionFrame, 'attention-armed');
}

function commit(cue = null) {
  const base = interactionFrame ?? activeFrameAt();
  const event = cue ?? defaultCue(base.memory.length);
  interactionFrame = commitDeparture(base, event);
  renderFrame(interactionFrame, 'departure-committed');
}

function refuseTap() {
  const base = baselineWithoutArm();
  interactionFrame = base;
  renderFrame(base, 'pointer-tap-refused');
}

function lift() {
  const base = interactionFrame ?? activeFrameAt();
  if (!base.memory.length) return;
  interactionFrame = liftLatestDeparture(base);
  renderFrame(interactionFrame, 'departure-lifted');
}

function release() {
  interactionFrame = frozen ? releaseAttention(0) : null;
  startedAt = performance.now();
  renderFrame(interactionFrame ?? timeline[0], 'attention-released');
}

function drawAtmosphere(p, width, height, now) {
  p.background(...palette.deep);
  p.noStroke();
  for (let ring = 0; ring < 11; ring += 1) {
    const scale = 1.7 - ring * 0.09;
    const drift = Math.sin(now * 0.00009 + ring * 0.63) * 16;
    p.push();
    p.translate(drift, ring * 10 - 50, -180 - ring * 8);
    p.rotateZ(Math.sin(now * 0.00004 + ring) * 0.012);
    p.fill(palette.haze[0] + ring * 2, palette.haze[1], Math.max(7, palette.haze[2] - ring * 0.6), 5 + ring * 1.2);
    p.rectMode(p.CENTER);
    p.rect(0, 0, width * scale, height * scale);
    p.pop();
  }

  p.push();
  p.stroke(...palette.violet, 16);
  p.strokeWeight(1);
  for (let line = -12; line <= 12; line += 1) {
    const x = line * width * 0.065 + Math.sin(now * 0.00008 + line) * 5;
    p.line(x, -height * 0.6, -250, x + height * 0.23, height * 0.6, -250);
  }
  p.pop();

  p.push();
  p.stroke(...palette.mint, 18);
  p.strokeWeight(1);
  for (let mark = 0; mark < 90; mark += 1) {
    const x = ((mark * 83 + 17) % 997) / 997 * width - width / 2;
    const y = ((mark * 47 + 31) % 991) / 991 * height - height / 2;
    p.point(x, y, -80 + (mark % 7) * 8);
  }
  p.pop();
}

function drawCore(p, width, height, now) {
  p.push();
  p.translate(Math.sin(now * 0.00012) * 10, Math.cos(now * 0.00011) * 6, -20);
  p.rotateZ(-0.18);
  p.noStroke();
  p.emissiveMaterial(216, 34, 5, 80);
  p.box(width * 0.05, height * 0.52, 24);
  p.translate(0, 0, 16);
  p.stroke(...palette.mint, 34);
  p.strokeWeight(1);
  p.noFill();
  p.box(width * 0.062, height * 0.54, 3);
  p.pop();
}

function drawFacet(p, width, height, facet, now) {
  const x = facet.x * width * 2.1;
  const y = facet.y * height * 1.7;
  const z = facet.z * 260;
  const w = facet.width * width * 0.9;
  const h = facet.height * height * 0.82;
  const d = Math.max(8, facet.depth * 80);
  const status = facet.status;
  const body = status === 'averted' ? palette.ember : status === 'answered' ? palette.answer : palette.quiet;
  const edge = status === 'averted' ? palette.ember : status === 'answered' ? palette.mint : palette.quietEdge;
  const pulse = status === 'quiet' ? Math.sin(now * 0.0004 + facet.index) * 0.006 : 0;

  p.push();
  p.translate(x, y, z);
  p.rotateX(facet.twist + pulse);
  p.rotateY(facet.tilt);
  p.rotateZ(facet.shadowShift * 0.22);

  p.push();
  p.translate(18 + facet.shadowShift * 18, 24, -d * 0.78);
  p.noStroke();
  p.emissiveMaterial(220, 36, 3, 62);
  p.box(w * 1.02, h * 1.02, d * 0.22);
  p.pop();

  p.noStroke();
  p.specularMaterial(body[0], body[1], body[2], status === 'quiet' ? 78 : 92);
  p.shininess(24);
  p.box(w, h, d);

  p.push();
  p.translate(0, 0, d * 0.53);
  p.noFill();
  p.stroke(...edge, 76);
  p.strokeWeight(status === 'quiet' ? 1 : 2);
  p.box(w * 0.98, h * 0.98, 2);
  p.stroke(...palette.ink ?? palette.mint, status === 'quiet' ? 28 : 54);
  for (let mark = -2; mark <= 2; mark += 1) {
    const offset = mark * w * 0.15 + Math.sin(facet.index * 1.7 + mark) * 4;
    p.line(offset, -h * 0.32, offset + facet.shadowShift * 18, h * 0.32, 0);
  }
  p.pop();
  p.pop();
}

function render(p, frame, now) {
  const width = p.width;
  const height = p.height;
  drawAtmosphere(p, width, height, now);
  p.ambientLight(90, 25, 48);
  p.directionalLight(205, 24, 92, -0.35, 0.22, -1);
  p.pointLight(24, 62, 94, width * 0.18, -height * 0.18, 240);
  drawCore(p, width, height, now);

  p.push();
  p.rotateZ(Math.sin(now * 0.00006) * 0.03);
  p.rotateX(-0.1);
  frame.facets.forEach((facet) => drawFacet(p, width, height, facet, now));
  p.pop();

  p.push();
  p.noFill();
  p.stroke(...palette.mint, 24);
  p.strokeWeight(1);
  p.rotateZ(-0.18);
  p.ellipse(0, 0, width * 0.34, height * 0.74);
  p.pop();
}

function attachInteractions() {
  if (!field || staticPreview) return;
  const isControlEvent = (event) => event.target instanceof Element && Boolean(event.target.closest('.field-controls'));
  field.addEventListener('pointermove', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    if (pointerState) {
      const distance = Math.hypot(event.clientX - pointerState.x, event.clientY - pointerState.y);
      if (distance > 22) pointerMoved = true;
    }
    arm(point);
  });
  field.addEventListener('pointerdown', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    field.setPointerCapture?.(event.pointerId);
    pointerState = { startedAt: performance.now(), x: event.clientX, y: event.clientY };
    pointerMoved = false;
    arm(pointFromEvent(event));
  });
  field.addEventListener('pointerup', (event) => {
    if (isControlEvent(event)) return;
    event.preventDefault();
    if (!pointerState) return;
    const duration = performance.now() - pointerState.startedAt;
    const travel = Math.hypot(event.clientX - pointerState.x, event.clientY - pointerState.y);
    const pending = interactionFrame?.pendingFacet;
    pointerState = null;
    if (duration >= 520 || travel >= 38 || pointerMoved) commit({ ...pointFromEvent(event), facetIndex: pending });
    else refuseTap();
  });
  field.addEventListener('pointerleave', () => {
    if (pointerState || !interactionFrame?.armed) return;
    commit({ facetIndex: interactionFrame.pendingFacet });
  });
  field.addEventListener('pointercancel', () => { pointerState = null; pointerMoved = false; });
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      commit(defaultCue((interactionFrame ?? activeFrameAt()).memory.length));
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      lift();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      release();
    } else if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      window.__mutinePortraitV021?.save?.();
    }
  });
  approachControl?.addEventListener('click', () => commit(defaultCue((interactionFrame ?? activeFrameAt()).memory.length)));
  liftControl?.addEventListener('click', lift);
  releaseControl?.addEventListener('click', release);
}

window.__mutinePortraitV021 = {
  getState: () => {
    const frame = currentFrame ?? activeFrameAt();
    return {
      stage: frame.stage,
      memory: frame.memory.length,
      averted: frame.facets.filter((facet) => facet.status === 'averted').length,
      answered: frame.facets.filter((facet) => facet.status === 'answered').length,
      interaction: frame.interaction || 'sequence',
      interactive: interactivePreview || !staticPreview,
      blind: blindMode,
      signature: geometrySignature(frame)
    };
  },
  getFrame: () => currentFrame,
  getField: () => field,
  getCanvas: () => canvasElement,
  arm: (point) => arm(point),
  commit: (cue) => commit(cue),
  lift,
  release,
  save: () => window.__mutinePortraitV021.p5?.saveCanvas('mutine-self-portrait-v021', 'png'),
  requestRender: () => window.__mutinePortraitV021.p5?.redraw()
};

window.__mutinePortraitV021.p5 = new p5((p) => {
  p.setup = () => {
    const width = Math.max(320, field?.clientWidth || 900);
    const height = Math.max(300, field?.clientHeight || 620);
    p.pixelDensity(1);
    p.createCanvas(width, height, p.WEBGL);
    p.colorMode(p.HSB, 360, 100, 100, 100);
    p.noLoop();
    canvasElement = p.canvas;
    canvasElement.setAttribute('aria-hidden', 'true');
    attachInteractions();
    window._p5Ready = true;
    p.redraw();
    const tick = () => {
      if (!frozen && !interactionFrame) p.redraw();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  p.draw = () => {
    currentFrame = activeFrameAt(performance.now());
    render(p, currentFrame, performance.now());
    updateReadout(currentFrame, interactionFrame?.interaction || 'sequence');
  };
  p.windowResized = () => {
    if (!field) return;
    p.resizeCanvas(Math.max(320, field.clientWidth), Math.max(300, field.clientHeight));
    p.redraw();
  };
}, field);
