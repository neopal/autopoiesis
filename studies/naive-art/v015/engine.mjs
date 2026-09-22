export const SEED = 0x4e413135;
export const STAGES = 18;
export const PRIMITIVE_BUDGET = 56;
export const MEMORY_WINDOW = 5;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const PANEL_LAYOUT = [
  { id: 'near-picture', x: 0.065, y: 0.075, w: 0.405, h: 0.365, kind: 'house' },
  { id: 'far-picture', x: 0.53, y: 0.075, w: 0.405, h: 0.365, kind: 'sun' },
  { id: 'left-picture', x: 0.065, y: 0.56, w: 0.405, h: 0.365, kind: 'road' },
  { id: 'answer-picture', x: 0.53, y: 0.56, w: 0.405, h: 0.365, kind: 'hill' }
];
const COMPONENTS = ['roof', 'sun', 'path', 'door'];

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
    localIndex: Number(event.localIndex),
    answerIndex: Number(event.answerIndex),
    vacancyIndex: Number(event.vacancyIndex),
    polarity: Number(event.polarity) < 0 ? -1 : 1,
    strength: Number(event.strength),
    component: COMPONENTS.includes(event.component) ? event.component : 'roof'
  };
}

function centerOf(panel) {
  return { x: panel.x + panel.w / 2, y: panel.y + panel.h / 2 };
}

function nearestPanel(point) {
  return PANEL_LAYOUT.reduce((closest, panel, index) => {
    const center = centerOf(panel);
    const distance = Math.hypot(point.x - center.x, point.y - center.y);
    return distance < closest.distance ? { index, distance } : closest;
  }, { index: 0, distance: Infinity }).index;
}

function componentForStage(stage, random) {
  return COMPONENTS[Math.floor((stage + random() * COMPONENTS.length) % COMPONENTS.length)];
}

function misreadForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const point = { x: 0.16 + random() * 0.68, y: 0.15 + random() * 0.70 };
  const localIndex = nearestPanel(point);
  return {
    stage,
    source: 'autonomous-misread',
    point,
    localIndex,
    answerIndex: (localIndex + 2) % PANEL_LAYOUT.length,
    vacancyIndex: (localIndex + 1) % PANEL_LAYOUT.length,
    component: componentForStage(stage, random),
    polarity: random() < 0.5 ? -1 : 1,
    strength: 0.035 + random() * 0.045,
    delay: 0.22 + random() * 0.24,
    reason: 'the picture learned the wrong part'
  };
}

function misreadsForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map(copyEvent);
}

function copyPanel(panel) {
  return {
    ...panel,
    turn: Number(panel.turn),
    horizon: Number(panel.horizon),
    wobble: Number(panel.wobble),
    replies: (panel.replies ?? []).map((reply) => ({ ...reply, offset: { ...reply.offset } })),
    missing: (panel.missing ?? []).map((missing) => ({ ...missing, slot: { ...missing.slot } }))
  };
}

function slotFor(panel, component) {
  const slots = {
    roof: { x: 0.50, y: 0.23, w: 0.30, h: 0.18 },
    sun: { x: 0.76, y: 0.22, w: 0.17, h: 0.17 },
    path: { x: 0.48, y: 0.78, w: 0.34, h: 0.23 },
    door: { x: 0.51, y: 0.61, w: 0.14, h: 0.25 }
  };
  const base = slots[component] ?? slots.roof;
  return { ...base, x: panel.x + base.x * panel.w, y: panel.y + base.y * panel.h, w: base.w * panel.w, h: base.h * panel.h };
}

function composeScene(events, random) {
  const panels = PANEL_LAYOUT.map((panel, index) => ({
    ...panel,
    tilt: (index % 2 ? -1 : 1) * (0.006 + random() * 0.012),
    turn: 0,
    horizon: 0,
    wobble: 0,
    replies: [],
    missing: []
  }));
  const replyRecords = [];
  const vacancyRecords = [];

  for (const [order, event] of events.entries()) {
    const local = panels[event.localIndex];
    const answer = panels[event.answerIndex];
    const vacancyPanel = panels[event.vacancyIndex];
    const impulse = event.polarity * event.strength * (1 + order * 0.08);
    local.turn = clamp(local.turn + impulse, -0.18, 0.18);
    local.horizon = clamp(local.horizon - impulse * 0.48, -0.10, 0.10);
    local.wobble = clamp(local.wobble + Math.abs(impulse) * 0.8, 0, 0.26);

    const reply = {
      source: event.source,
      stage: event.stage,
      order,
      component: event.component,
      offset: {
        x: event.polarity * (0.035 + event.delay * 0.08),
        y: (order % 2 ? -1 : 1) * (0.018 + event.strength * 0.42)
      },
      rotation: event.polarity * (0.05 + event.delay * 0.12)
    };
    answer.replies.push(reply);
    replyRecords.push({ ...reply, panelIndex: event.answerIndex });

    const vacancyRecord = {
      source: event.source,
      stage: event.stage,
      order,
      component: event.component,
      slot: slotFor(vacancyPanel, event.component)
    };
    vacancyPanel.missing.push(vacancyRecord);
    vacancyRecords.push({ ...vacancyRecord, panelIndex: event.vacancyIndex });
  }

  return {
    misreadRecords: events.map(copyEvent),
    panels,
    replyRecords,
    vacancyRecords,
    materialTrace: {
      misreadCount: events.length,
      localTurnCount: panels.filter((panel) => Math.abs(panel.turn) > 0.01).length,
      wrongCopyCount: replyRecords.length,
      blankSlotCount: vacancyRecords.length,
      grammar: 'look → local misread → distant wrong copy → blank slot'
    }
  };
}

export function misreadSignature(frame) {
  return frame.scene.panels.map((panel) => [
    panel.id,
    Number(panel.tilt).toFixed(4),
    Number(panel.turn).toFixed(4),
    Number(panel.horizon).toFixed(4),
    Number(panel.wobble).toFixed(4),
    ...panel.replies.map((reply) => `${reply.component}:${Number(reply.offset.x).toFixed(4)},${Number(reply.offset.y).toFixed(4)}`),
    ...panel.missing.map((missing) => `${missing.component}:${Number(missing.slot.x).toFixed(4)},${Number(missing.slot.y).toFixed(4)}`)
  ].join('|')).join('||');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyEvent) : [];
  const events = misreadsForMemory(inherited);
  const correction = misreadForStage(safeStage);
  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: { panels: PANEL_LAYOUT.map((panel) => ({ ...panel })), replies: [], missing: [] },
    scene: composeScene(events, random)
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

export function applyMisread(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.88)
  };
  const random = rng(SEED + frame.stage * 97 + frame.memory.length * 131);
  const localIndex = nearestPanel(bounded);
  const event = {
    stage: frame.stage,
    source: 'visitor-misread',
    point: bounded,
    localIndex,
    answerIndex: (localIndex + 2) % PANEL_LAYOUT.length,
    vacancyIndex: (localIndex + 1) % PANEL_LAYOUT.length,
    component: componentForStage(frame.stage + frame.memory.length, random),
    polarity: bounded.x < 0.5 ? -1 : 1,
    strength: 0.05 + Math.abs(bounded.x - 0.5) * 0.08,
    delay: 0.26 + bounded.y * 0.18,
    reason: 'the visitor was misread'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, event]), interaction: 'visitor-misread' };
}

export function deleteLatestMisread(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'misread-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'misread-lifted' };
}

export function layoutForViewport(width, height) {
  return {
    mode: width < 640 ? 'portrait' : 'landscape',
    width,
    height,
    field: { x: 0.045, y: 0.045, w: 0.91, h: 0.91 }
  };
}

export { PANEL_LAYOUT, COMPONENTS };
