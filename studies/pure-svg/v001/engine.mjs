export const SEED = 0x4d555449;
export const STAGES = 8;
export const PRIMITIVE_BUDGET = 18;

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function nearest(point, memory) {
  return memory.reduce((closest, scar) => (
    !closest || distance(point, scar) < distance(point, closest) ? scar : closest
  ), null);
}

function draftPoints(stage) {
  const random = rng(SEED + stage * 104729);
  return Array.from({ length: 10 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 10 - Math.PI / 2;
    const radius = 0.22 + random() * 0.11 + Math.sin(stage * 0.7 + index) * 0.018;
    return {
      x: 0.5 + Math.cos(angle) * radius * (1 + Math.sin(stage * 0.4) * 0.18),
      y: 0.52 + Math.sin(angle) * radius * (0.92 + Math.cos(index + stage) * 0.08)
    };
  });
}

export function buildFrame(stage, memory = []) {
  const draft = draftPoints(stage);
  const inherited = memory.length > 0;
  const candidate = draft.map((point, index) => {
    const scar = nearest(point, memory);
    if (!scar) return { ...point };
    const pull = Math.max(0, 1 - distance(point, scar) / 0.42);
    const direction = index % 2 === 0 ? 1 : -1;
    return {
      x: point.x + (scar.x - point.x) * pull * 0.2,
      y: point.y + (scar.y - point.y) * pull * 0.2 + direction * pull * 0.035
    };
  });
  const cutIndex = (stage * 3 + Math.floor((SEED + stage) % 7)) % candidate.length;
  const failed = stage === 0 || stage % 3 === 1;
  const scar = failed ? candidate[cutIndex] : null;
  const memoryInfluence = inherited
    ? candidate.reduce((sum, point, index) => sum + distance(point, draft[index]), 0) / candidate.length
    : 0;

  return {
    stage,
    draft,
    points: candidate.filter((_, index) => index !== cutIndex),
    cutIndex,
    failed,
    scar,
    memory: memory.map((point) => ({ ...point })),
    memoryInfluence,
    primitiveBudget: PRIMITIVE_BUDGET,
    primitiveLedger: Array.from({ length: PRIMITIVE_BUDGET }, (_, index) => index)
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  return Array.from({ length: stageCount }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.scar) memory = [...memory, frame.scar].slice(-4);
    return frame;
  });
}
