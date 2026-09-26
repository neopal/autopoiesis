export const SEED = 0x4e413139;
export const STAGES = 18;
export const PRIMITIVE_BUDGET = 34;
export const MEMORY_WINDOW = 4;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const FORM_LAYOUT = [
  { id: 'sun-disc', x: 0.18, y: 0.27, w: 0.19, h: 0.22, kind: 'sun', color: '#f0bd4d' },
  { id: 'soft-cloud', x: 0.39, y: 0.23, w: 0.25, h: 0.18, kind: 'cloud', color: '#e56b5d' },
  { id: 'blue-hill', x: 0.66, y: 0.35, w: 0.34, h: 0.27, kind: 'hill', color: '#6d9e92' },
  { id: 'red-flag', x: 0.30, y: 0.58, w: 0.18, h: 0.23, kind: 'flag', color: '#ba7ba8' },
  { id: 'yellow-puddle', x: 0.55, y: 0.66, w: 0.30, h: 0.16, kind: 'puddle', color: '#dba264' },
  { id: 'violet-moon', x: 0.82, y: 0.20, w: 0.16, h: 0.18, kind: 'moon', color: '#7c84b3' }
];

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function copyEvent(event) {
  return {
    ...event,
    start: event.start ? { ...event.start } : null,
    end: event.end ? { ...event.end } : null,
    sourceIndex: Number(event.sourceIndex),
    receiverIndex: Number(event.receiverIndex),
    distance: Number(event.distance),
    tilt: Number(event.tilt),
    offset: Number(event.offset)
  };
}

function copyForm(form) {
  return { ...form, angle: Number(form.angle), scale: Number(form.scale), opening: Number(form.opening), borrowedContour: Number(form.borrowedContour), shift: { ...form.shift }, contour: [...form.contour] };
}

function nearestForm(point) {
  return FORM_LAYOUT.reduce((closest, form, index) => {
    const distance = Math.hypot(point.x - form.x, point.y - form.y);
    return distance < closest.distance ? { index, distance } : closest;
  }, { index: 0, distance: Infinity }).index;
}

function baseForms(random) {
  return FORM_LAYOUT.map((form, index) => ({
    ...form,
    angle: (index % 2 ? -1 : 1) * (0.03 + random() * 0.08),
    scale: 0.92 + random() * 0.14,
    opening: 0,
    borrowedContour: 0,
    shift: { x: (random() - 0.5) * 0.012, y: (random() - 0.5) * 0.012 },
    contour: [0.14 + random() * 0.05, 0.22 + random() * 0.06, 0.11 + random() * 0.04]
  }));
}

function baseHorizon(random) {
  return {
    slope: (random() - 0.5) * 0.04,
    wrongSlope: 0,
    borrowedSegment: 0,
    notch: 0,
    lift: 0
  };
}

function eventForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const start = { x: 0.15 + random() * 0.68, y: 0.20 + random() * 0.45 };
  const end = { x: 0.16 + random() * 0.70, y: 0.42 + random() * 0.34 };
  const sourceIndex = nearestForm(start);
  let receiverIndex = (sourceIndex + 2 + Math.floor(random() * 3)) % FORM_LAYOUT.length;
  if (receiverIndex === sourceIndex) receiverIndex = (receiverIndex + 1) % FORM_LAYOUT.length;
  return {
    stage,
    source: 'autonomous-weather-step',
    start,
    end,
    sourceIndex,
    receiverIndex,
    distance: Math.hypot(end.x - start.x, end.y - start.y),
    tilt: (random() - 0.5) * 0.9,
    offset: (random() - 0.5) * 0.8,
    reason: 'the panorama remembered the wrong weather'
  };
}

function composeScene(events, random) {
  const forms = baseForms(random);
  const horizon = baseHorizon(random);
  const sky = { notchedSun: 0, borrowedRay: 0, wrongCloud: 0 };
  const stepRecords = [];

  for (const [order, event] of events.entries()) {
    const source = forms[event.sourceIndex];
    const receiver = forms[event.receiverIndex];
    const impulse = 0.08 + event.distance * 0.16 + order * 0.014;

    source.opening += impulse;
    source.angle += event.tilt * 0.18;
    source.scale -= impulse * 0.10;
    source.shift.x += event.offset * 0.016;
    source.shift.y -= impulse * 0.014;
    source.contour[order % source.contour.length] += impulse * 0.30;

    receiver.borrowedContour += impulse * 0.62;
    receiver.angle -= event.tilt * 0.16;
    receiver.scale += impulse * 0.08;
    receiver.shift.x -= event.offset * 0.011;
    receiver.shift.y += impulse * 0.012;
    receiver.contour[(order + 1) % receiver.contour.length] -= impulse * 0.18;

    horizon.wrongSlope += (event.offset || 0.2) * 0.08 + 0.022;
    horizon.borrowedSegment += impulse * 0.55;
    horizon.notch += impulse * 0.28;
    horizon.lift += Math.abs(event.tilt) * 0.05 + 0.02;
    sky.notchedSun += event.sourceIndex === 0 ? impulse * 0.8 : impulse * 0.18;
    sky.borrowedRay += impulse * 0.44;
    sky.wrongCloud += event.receiverIndex === 1 ? impulse * 0.48 : impulse * 0.16;

    stepRecords.push({ ...copyEvent(event), order, sourceKind: source.kind, receiverKind: receiver.kind });
  }

  return {
    forms,
    horizon,
    sky,
    stepRecords,
    materialTrace: {
      stepCount: events.length,
      pointerOnlyChanges: 0,
      stepChanges: events.length * 4,
      openedForms: forms.filter((form) => form.opening > 0.01).length,
      borrowedForms: forms.filter((form) => form.borrowedContour > 0.01).length,
      grammar: 'wheel step → wrong weather → source contour opens → distant contour borrows → horizon tilts'
    }
  };
}

export function geometrySignature(frame) {
  return [
    ...frame.scene.forms.map((form) => [
      form.id,
      Number(form.angle).toFixed(4),
      Number(form.scale).toFixed(4),
      Number(form.opening).toFixed(4),
      Number(form.borrowedContour).toFixed(4),
      Number(form.shift.x).toFixed(4),
      Number(form.shift.y).toFixed(4),
      form.contour.map((value) => Number(value).toFixed(4)).join(',')
    ].join('|')),
    Object.entries(frame.scene.horizon).map(([key, value]) => `${key}:${Number(value).toFixed(4)}`).join('|'),
    Object.entries(frame.scene.sky).map(([key, value]) => `${key}:${Number(value).toFixed(4)}`).join('|')
  ].join('||');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent).slice(-MEMORY_WINDOW) : [];
  return {
    stage: safeStage,
    memory: inherited,
    correction: eventForStage(safeStage),
    primitiveCount: PRIMITIVE_BUDGET,
    draft: { forms: FORM_LAYOUT.map((form) => ({ ...form })) },
    scene: composeScene(inherited, random)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: Math.min(Math.max(0, stageCount), STAGES) }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    memory = [...memory, frame.correction];
    return frame;
  });
}

function eventForVisitor(frame, direction) {
  const sign = Number(direction) < 0 ? -1 : 1;
  const seed = rng(SEED + frame.stage * 97 + frame.memory.length * 131 + (sign < 0 ? 17 : 0));
  const baseIndex = Math.floor(seed() * FORM_LAYOUT.length);
  const sourceIndex = (baseIndex + (sign < 0 ? 1 : 0)) % FORM_LAYOUT.length;
  let receiverIndex = (sourceIndex + (sign < 0 ? -2 : 2) + Math.floor(seed() * 3) + FORM_LAYOUT.length) % FORM_LAYOUT.length;
  if (receiverIndex === sourceIndex) receiverIndex = (receiverIndex + (sign < 0 ? -1 : 1) + FORM_LAYOUT.length) % FORM_LAYOUT.length;
  return {
    stage: frame.stage,
    source: 'visitor-wheel-step',
    start: null,
    end: null,
    sourceIndex,
    receiverIndex,
    distance: 0.42 + seed() * 0.30,
    tilt: (sign < 0 ? -1 : 1) * (0.18 + seed() * 0.42),
    offset: (sign < 0 ? -1 : 1) * (0.22 + seed() * 0.44),
    direction: sign,
    reason: 'the panorama remembered the wrong weather'
  };
}

export function stepWeather(frame, { direction = 1 } = {}) {
  const event = eventForVisitor(frame, direction);
  return { ...buildFrame(frame.stage, [...frame.memory, event]), interaction: 'visitor-wheel-step' };
}

export function liftLatestStep(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'step-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'step-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    field: { x: 0.03, y: 0.04, w: 0.94, h: 0.92 }
  };
}
