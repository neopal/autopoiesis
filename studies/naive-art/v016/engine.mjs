export const SEED = 0x4e413136;
export const STAGES = 18;
export const PRIMITIVE_BUDGET = 44;
export const MEMORY_WINDOW = 5;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const FORM_LAYOUT = [
  { id: 'coral-loop', x: 0.16, y: 0.22, size: 0.105, kind: 'loop', color: '#d85d4c' },
  { id: 'ink-kite', x: 0.40, y: 0.16, size: 0.115, kind: 'kite', color: '#173247' },
  { id: 'lemon-pool', x: 0.72, y: 0.22, size: 0.125, kind: 'pool', color: '#e6b949' },
  { id: 'green-bowl', x: 0.12, y: 0.55, size: 0.12, kind: 'bowl', color: '#6f8f80' },
  { id: 'lilac-knot', x: 0.46, y: 0.50, size: 0.13, kind: 'knot', color: '#a58ab0' },
  { id: 'sky-step', x: 0.82, y: 0.54, size: 0.11, kind: 'step', color: '#77aeb0' },
  { id: 'coral-crumb', x: 0.29, y: 0.82, size: 0.10, kind: 'crumb', color: '#c96959' },
  { id: 'ink-pool', x: 0.68, y: 0.82, size: 0.115, kind: 'pool', color: '#3e5968' }
];
const FORM_KINDS = FORM_LAYOUT.map((form) => form.kind);

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

function copyEvent(event) {
  return {
    ...event,
    point: event.point ? copyPoint(event.point) : null,
    sourceIndex: Number(event.sourceIndex),
    receiverIndex: Number(event.receiverIndex),
    hollowIndex: Number(event.hollowIndex),
    magnitude: Number(event.magnitude),
    wait: Number(event.wait),
    skew: Number(event.skew)
  };
}

function copyForm(form) {
  return {
    ...form,
    rotation: Number(form.rotation),
    scale: Number(form.scale),
    drift: Number(form.drift),
    notches: (form.notches ?? []).map((notch) => ({ ...notch })),
    wrongFragments: (form.wrongFragments ?? []).map((fragment) => ({ ...fragment })),
    hollows: (form.hollows ?? []).map((hollow) => ({ ...hollow })),
    marks: (form.marks ?? []).map((mark) => ({ ...mark }))
  };
}

function centerOf(form) {
  return { x: form.x, y: form.y };
}

function nearestForm(point) {
  return FORM_LAYOUT.reduce((closest, form, index) => {
    const center = centerOf(form);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    return distance < closest.distance ? { index, distance } : closest;
  }, { index: 0, distance: Infinity }).index;
}

function departureForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const point = { x: 0.12 + random() * 0.76, y: 0.13 + random() * 0.74 };
  const sourceIndex = nearestForm(point);
  return {
    stage,
    source: 'autonomous-departure',
    point,
    sourceIndex,
    receiverIndex: (sourceIndex + 3 + Math.floor(random() * 2)) % FORM_LAYOUT.length,
    hollowIndex: (sourceIndex + 5 + Math.floor(random() * 2)) % FORM_LAYOUT.length,
    magnitude: 0.045 + random() * 0.035,
    wait: 0.18 + random() * 0.25,
    skew: (random() - 0.5) * 0.8,
    reason: 'the empty edge kept the wrong part'
  };
}

function departuresForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((event, order) => ({ ...copyEvent(event), order }));
}

function baseForms(random) {
  return FORM_LAYOUT.map((form, index) => ({
    ...form,
    rotation: (index % 2 ? -1 : 1) * (0.04 + random() * 0.10),
    scale: 0.92 + random() * 0.10,
    drift: (random() - 0.5) * 0.035,
    notches: [],
    wrongFragments: [],
    hollows: [],
    marks: [{ kind: form.kind, offset: (random() - 0.5) * 0.12 }]
  }));
}

function composeScene(events, random) {
  const forms = baseForms(random);
  const departureRecords = [];

  for (const [order, event] of events.entries()) {
    const source = forms[event.sourceIndex];
    const receiver = forms[event.receiverIndex];
    const hollow = forms[event.hollowIndex];
    const impulse = event.magnitude * (1 + order * 0.09);
    source.scale = clamp(source.scale - impulse * 0.42, 0.68, 1.12);
    source.rotation += event.skew * 0.12;
    source.drift += event.skew * 0.025;
    source.notches.push({
      source: event.source,
      stage: event.stage,
      order,
      angle: event.skew + order * 0.24,
      width: 0.24 + event.wait * 0.18,
      depth: 0.23 + impulse * 1.6
    });

    receiver.rotation -= event.skew * 0.08;
    receiver.wrongFragments.push({
      source: event.source,
      stage: event.stage,
      order,
      kind: FORM_KINDS[event.sourceIndex],
      color: FORM_LAYOUT[event.sourceIndex].color,
      x: event.skew * 0.22 + (order % 2 ? -0.12 : 0.10),
      y: -0.18 - event.wait * 0.22,
      rotation: event.skew * 0.32 + (order % 2 ? -0.08 : 0.06),
      scale: 0.30 + event.magnitude * 1.4
    });

    hollow.hollows.push({
      source: event.source,
      stage: event.stage,
      order,
      x: (order % 2 ? -0.18 : 0.16) + event.skew * 0.06,
      y: (order % 2 ? 0.12 : -0.10),
      radius: 0.22 + event.magnitude * 0.9,
      kind: order % 2 ? 'circle' : 'diamond'
    });
    hollow.marks = hollow.marks.slice(0, 1);
    departureRecords.push({ ...copyEvent(event), order });
  }

  return {
    departureRecords,
    forms,
    materialTrace: {
      departureCount: events.length,
      departureChanges: events.length * 3,
      presenceChanges: 0,
      sourceNotchCount: forms.reduce((sum, form) => sum + form.notches.length, 0),
      wrongFragmentCount: forms.reduce((sum, form) => sum + form.wrongFragments.length, 0),
      hollowCount: forms.reduce((sum, form) => sum + form.hollows.length, 0),
      grammar: 'presence refused → departure cuts source → wrong fragment arrives → third form hollows'
    }
  };
}

export function departureSignature(frame) {
  return frame.scene.forms.map((form) => [
    form.id,
    Number(form.rotation).toFixed(4),
    Number(form.scale).toFixed(4),
    Number(form.drift).toFixed(4),
    ...form.notches.map((notch) => `notch:${Number(notch.angle).toFixed(4)},${Number(notch.width).toFixed(4)}`),
    ...form.wrongFragments.map((fragment) => `wrong:${fragment.kind}:${Number(fragment.x).toFixed(4)},${Number(fragment.y).toFixed(4)}`),
    ...form.hollows.map((hollow) => `hollow:${hollow.kind}:${Number(hollow.x).toFixed(4)},${Number(hollow.y).toFixed(4)}`)
  ].join('|')).join('||');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent) : [];
  return {
    stage: safeStage,
    memory: inherited,
    correction: departureForStage(safeStage),
    primitiveCount: PRIMITIVE_BUDGET,
    draft: { forms: FORM_LAYOUT.map((form) => ({ ...form })) },
    scene: composeScene(departuresForMemory(inherited), random)
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

export function applyDeparture(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.90)
  };
  const random = rng(SEED + frame.stage * 97 + frame.memory.length * 131);
  const sourceIndex = nearestForm(bounded);
  const event = {
    stage: frame.stage,
    source: 'visitor-departure',
    point: bounded,
    sourceIndex,
    receiverIndex: (sourceIndex + 3 + Math.floor(random() * 2)) % FORM_LAYOUT.length,
    hollowIndex: (sourceIndex + 5 + Math.floor(random() * 2)) % FORM_LAYOUT.length,
    magnitude: 0.052 + Math.abs(bounded.x - 0.5) * 0.07,
    wait: 0.20 + bounded.y * 0.16,
    skew: (bounded.x - 0.5) * 1.3,
    reason: 'the visitor left and the field kept the wrong part'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, event]), interaction: 'visitor-departure' };
}

export function deleteLatestDeparture(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'departure-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'departure-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    field: { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }
  };
}

export { FORM_LAYOUT, FORM_KINDS };
