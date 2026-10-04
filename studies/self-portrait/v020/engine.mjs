export const SEED = 0x53504640;
export const STAGES = 18;
export const MEMORY_LIMIT = 4;
export const RIB_COUNT = 13;
export const PRIMITIVE_BUDGET = 104;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function safeStage(value) {
  return clamp(Math.floor(Number(value) || 0), 0, STAGES - 1);
}

function safeIndex(value, fallback = 0) {
  const index = Number(value);
  return Number.isInteger(index) ? Math.max(0, Math.min(RIB_COUNT - 1, index)) : fallback;
}

function makeRib(stage, index, random) {
  const middle = (RIB_COUNT - 1) / 2;
  const normalized = (index - middle) / middle;
  return {
    index,
    x: 0.18 + normalized * 0.025 + (random() - 0.5) * 0.018,
    y: 0.14 + index * 0.056 + Math.sin(stage * 0.11 + index * 0.72) * 0.006,
    width: 0.58 - Math.abs(normalized) * 0.07 + random() * 0.045,
    height: 0.061 + random() * 0.026,
    depth: 0.1 + random() * 0.08,
    skew: normalized * 0.08 + (random() - 0.5) * 0.06,
    lean: Math.sin(index * 1.31 + stage * 0.2) * 0.035,
    gap: 0,
    crease: 0,
    load: 0,
    resistance: 0.22 + random() * 0.58 + Math.abs(normalized) * 0.06,
    status: 'quiet'
  };
}

function makeBase(stage) {
  const random = rng(SEED + stage * 9973);
  const ribs = Array.from({ length: RIB_COUNT }, (_, index) => makeRib(stage, index, random));
  return {
    stage,
    ribs,
    memory: [],
    armed: false,
    pendingPressure: 0,
    totalLoad: 0,
    axis: 0,
    interaction: 'sequence'
  };
}

export function geometrySignature(frame) {
  return JSON.stringify({
    stage: frame.stage,
    axis: Number(frame.axis.toFixed(5)),
    totalLoad: Number(frame.totalLoad.toFixed(5)),
    ribs: frame.ribs.map((rib) => [
      rib.index,
      Number(rib.x.toFixed(5)), Number(rib.y.toFixed(5)), Number(rib.width.toFixed(5)),
      Number(rib.height.toFixed(5)), Number(rib.depth.toFixed(5)), Number(rib.skew.toFixed(5)),
      Number(rib.lean.toFixed(5)), Number(rib.gap.toFixed(5)), Number(rib.crease.toFixed(5)),
      Number(rib.load.toFixed(5)), rib.status
    ])
  });
}

function refreshDerived(frame) {
  frame.totalLoad = frame.ribs.reduce((sum, rib) => sum + rib.load, 0);
  frame.signature = geometrySignature(frame);
  return frame;
}

function chooseRib(frame, pressure) {
  const previous = frame.memory.at(-1)?.ribIndex;
  const candidates = frame.ribs
    .map((rib) => ({
      index: rib.index,
      score: rib.resistance + rib.load * 0.72 + Math.abs(rib.index - 6) * 0.013
    }))
    .filter(({ index }) => index !== previous)
    .sort((a, b) => a.score - b.score || a.index - b.index);
  const offset = (frame.memory.length * 2 + Math.round(pressure * 10)) % candidates.length;
  return candidates[offset]?.index ?? ((previous ?? 2) + 5) % RIB_COUNT;
}

function normalizeEvent(event = {}, frame) {
  const pressure = clamp(Number(event.pressure) || 0.86, 0.25, 1.4);
  const requested = Number.isInteger(event.ribIndex) ? safeIndex(event.ribIndex) : null;
  return {
    id: event.id ?? `visitor-yield-${frame.stage}-${frame.memory.length + 1}`,
    stage: frame.stage,
    source: 'measured-pressure',
    kind: 'material-yield',
    pressure,
    ribIndex: requested ?? chooseRib(frame, pressure),
    reason: 'pressure crosses the relief threshold; the lowest-resistance rib yields'
  };
}

function applyYield(frame, event) {
  const next = clone(frame);
  const target = next.ribs[event.ribIndex];
  const pressure = event.pressure;
  const force = 0.18 + pressure * 0.42 + target.load * 0.18;
  const direction = event.ribIndex % 2 === 0 ? 1 : -1;

  target.gap = clamp(target.gap + 0.1 + pressure * 0.15 + target.load * 0.05, 0, 0.48);
  target.crease = clamp(target.crease + 0.22 + pressure * 0.16, 0, 1);
  target.load = clamp(target.load + force, 0, 2.8);
  target.depth = clamp(target.depth + direction * (0.07 + pressure * 0.06), -0.3, 0.48);
  target.skew += direction * (0.035 + pressure * 0.05);
  target.lean += -direction * (0.08 + pressure * 0.04);
  target.width = clamp(target.width * (0.96 - pressure * 0.035), 0.34, 0.9);
  target.status = 'yielded';

  next.ribs.forEach((rib, index) => {
    if (index === event.ribIndex) return;
    const distance = Math.abs(index - event.ribIndex);
    const influence = Math.max(0, 1 - distance / 7);
    const side = index < event.ribIndex ? -1 : 1;
    rib.load = clamp(rib.load + influence * pressure * 0.115, 0, 2.8);
    rib.x += side * influence * pressure * 0.018;
    rib.skew += side * influence * pressure * 0.012;
    rib.crease = clamp(rib.crease + influence * 0.04, 0, 1);
    if (rib.status !== 'yielded' && influence > 0.18) rib.status = 'loaded';
  });

  next.axis += direction * (0.12 + pressure * 0.06);
  next.armed = false;
  next.pendingPressure = 0;
  next.interaction = 'yield-committed';
  return refreshDerived(next);
}

export function buildFrame(stage = 0, memory = []) {
  let frame = makeBase(safeStage(stage));
  for (const rawEvent of memory.slice(-MEMORY_LIMIT)) {
    const event = normalizeEvent(rawEvent, frame);
    frame = applyYield(frame, { ...event, ...rawEvent });
    frame.memory = [...frame.memory, {
      ...event,
      ...rawEvent,
      resistanceBefore: frame.ribs[event.ribIndex].resistance,
      resistanceAfter: frame.ribs[event.ribIndex].resistance + frame.ribs[event.ribIndex].load,
      signature: frame.signature
    }].slice(-MEMORY_LIMIT);
    frame = refreshDerived(frame);
  }
  frame.stage = safeStage(stage);
  return refreshDerived(frame);
}

export function armPressure(frame, pressure = 0) {
  const next = clone(frame);
  next.armed = true;
  next.pendingPressure = clamp(Number(pressure) || 0, 0, 1.4);
  next.interaction = 'pressure-armed';
  return refreshDerived(next);
}

export function commitPressure(frame, input = {}) {
  const armed = armPressure(frame, input.pressure ?? frame.pendingPressure);
  const event = normalizeEvent(input, armed);
  const changed = applyYield(armed, event);
  changed.memory = [...frame.memory, {
    ...event,
    resistanceBefore: frame.ribs[event.ribIndex]?.resistance ?? 0,
    resistanceAfter: changed.ribs[event.ribIndex].resistance + changed.ribs[event.ribIndex].load,
    signature: changed.signature
  }].slice(-MEMORY_LIMIT);
  return refreshDerived(changed);
}

export function liftLatestYield(frame) {
  if (!frame.memory.length) return refreshDerived(clone(frame));
  const restored = buildFrame(frame.stage, frame.memory.slice(0, -1));
  restored.interaction = 'yield-lifted';
  return refreshDerived(restored);
}

export function releasePressures(stage = 0) {
  return buildFrame(stage, []);
}

export function defaultCue(index = 0) {
  const pressures = [0.82, 1.04, 0.68, 0.94];
  return { pressure: pressures[index % pressures.length] };
}

export function buildTimeline() {
  const timeline = [];
  let memory = [];
  const eventStages = new Map([[3, 0], [7, 1], [11, 2], [15, 3]]);
  for (let stage = 0; stage < STAGES; stage += 1) {
    let frame = buildFrame(stage, memory);
    if (eventStages.has(stage)) {
      frame = commitPressure(frame, defaultCue(eventStages.get(stage)));
      memory = frame.memory;
    }
    frame.stage = stage;
    timeline.push(refreshDerived(frame));
  }
  return timeline;
}
