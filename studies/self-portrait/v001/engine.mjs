export const SEED = 0x53454c46;
export const STAGES = 7;
export const BLIND_SPOT = 0.082;
export const PRIMITIVE_BUDGET = 32;

function rng(seed) {
  return () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function averageMemory(memory) {
  if (!memory.length) return { x: 0.5, y: 0.47, weight: 0 };
  const sum = memory.reduce((total, spot) => ({
    x: total.x + spot.x,
    y: total.y + spot.y
  }), { x: 0, y: 0 });
  return { x: sum.x / memory.length, y: sum.y / memory.length, weight: Math.min(memory.length / 4, 1) };
}

function perturb(point, memory, stage, index) {
  const influence = averageMemory(memory);
  let x = point.x;
  let y = point.y;
  for (const [memoryIndex, spot] of memory.entries()) {
    const dx = x - spot.x;
    const dy = y - spot.y;
    const distance = Math.max(Math.hypot(dx, dy), 0.018);
    const pull = Math.min(0.22, BLIND_SPOT / distance) * (0.34 + memoryIndex * 0.06);
    x += (dx / distance) * pull * 0.018;
    y += (dy / distance) * pull * 0.018;
  }
  x += Math.sin(stage * 0.9 + index * 0.61) * influence.weight * 0.006;
  y += Math.cos(stage * 0.7 + index * 0.37) * influence.weight * 0.004;
  return { x, y };
}

export function buildFrame(stage, memory = []) {
  const safeStage = Math.max(0, Math.floor(stage));
  const random = rng(SEED + safeStage * 101);
  const contourTemplate = [
    [-0.07, -0.26], [0.08, -0.25], [0.20, -0.15], [0.16, -0.04],
    [0.27, 0.08], [0.14, 0.18], [0.04, 0.31], [-0.09, 0.22],
    [-0.22, 0.25], [-0.18, 0.08], [-0.29, -0.01], [-0.18, -0.16],
    [-0.10, -0.29], [-0.02, -0.18]
  ];
  const count = contourTemplate.length * 2;
  const centerX = 0.5 + Math.sin(safeStage * 0.8) * 0.018;
  const centerY = 0.48 + Math.cos(safeStage * 0.46) * 0.012;
  const draft = Array.from({ length: count }, (_, index) => {
    const anchorIndex = Math.floor(index / 2) % contourTemplate.length;
    const anchor = contourTemplate[anchorIndex];
    const next = contourTemplate[(anchorIndex + 1) % contourTemplate.length];
    const blend = index % 2 ? 0.5 : 0;
    const jitter = (random() - 0.5) * 0.014;
    return {
      x: centerX + anchor[0] * (1 - blend) + next[0] * blend + jitter,
      y: centerY + anchor[1] * (1 - blend) + next[1] * blend + jitter * 0.7
    };
  });
  const contour = draft.map((point, index) => perturb(point, memory, safeStage, index));
  const gapStart = (safeStage * 5 + Math.floor(random() * count)) % count;
  const blindSpot = contour[gapStart];
  const influence = averageMemory(memory);
  const decisionNodes = Array.from({ length: 7 }, (_, index) => {
    const source = contour[(gapStart + index * 3) % count];
    const lean = (index % 2 ? -1 : 1) * (0.012 + influence.weight * 0.008);
    return {
      x: centerX + (source.x - centerX) * 0.52 + lean,
      y: centerY + (source.y - centerY) * 0.45 + (index - 3) * 0.012
    };
  });
  return {
    stage: safeStage,
    draft,
    contour,
    gapStart,
    gapLength: 3,
    blindSpot: { x: blindSpot.x, y: blindSpot.y, radius: 0.025 + influence.weight * 0.012 },
    decisionNodes,
    memory: memory.map((spot) => ({ ...spot })),
    refused: safeStage === 0 || safeStage % 2 === 0,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  const timeline = [];
  let memory = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    const frame = buildFrame(stage, memory);
    timeline.push(frame);
    if (frame.refused) {
      memory = [...memory, { ...frame.blindSpot, sourceStage: stage }].slice(-4);
    }
  }
  return timeline;
}
