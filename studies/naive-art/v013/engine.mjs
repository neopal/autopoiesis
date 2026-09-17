export const SEED = 0x4e413133;
export const STAGES = 18;
export const PRIMITIVE_BUDGET = 62;
export const MEMORY_WINDOW = 6;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

function copyPoint(point) {
  return { ...point, x: Number(point.x), y: Number(point.y) };
}

function copyFork(fork) {
  return { ...fork, point: fork.point ? copyPoint(fork.point) : null };
}

function forkForStage(stage) {
  const random = rng(SEED + stage * 7919);
  const x = 0.16 + random() * 0.68;
  const y = 0.18 + random() * 0.64;
  return {
    stage,
    source: 'autonomous-fork',
    point: { x, y },
    polarity: random() < 0.5 ? -1 : 1,
    width: 0.030 + random() * 0.026,
    span: 0.095 + random() * 0.105,
    spread: 0.050 + random() * 0.060,
    tilt: random() < 0.5 ? -1 : 1,
    reason: 'the line kept two ways forward'
  };
}

function forksForMemory(memory) {
  return memory.slice(-MEMORY_WINDOW).map((fork, order) => ({
    ...copyFork(fork),
    source: fork.source ?? 'autonomous-fork',
    polarity: Number(fork.polarity) < 0 ? -1 : 1,
    width: clamp(Number(fork.width) || 0.042, 0.024, 0.084),
    span: clamp(Number(fork.span) || 0.15, 0.080, 0.27),
    spread: clamp(Number(fork.spread) || 0.075, 0.038, 0.145),
    tilt: Number(fork.tilt) < 0 ? -1 : 1,
    order
  }));
}

function traceForks(origin, forks, scale = 1, verticalBias = 0) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const fork of forks) {
    const width = fork.width * scale;
    const span = fork.span * scale;
    const spread = fork.spread * scale;
    const drift = ((fork.point?.x ?? 0.5) - 0.5) * 0.035 + verticalBias;
    const anchor = clamp(cursor.x + ((fork.point?.x ?? 0.5) - 0.5) * 0.024, 0.04, 0.90);
    const baseline = clamp(cursor.y + drift, 0.06, 0.94);
    const signedSpread = fork.polarity * spread;
    points.push(
      { x: clamp(anchor + width * 0.16, 0.04, 0.96), y: clamp(baseline - signedSpread * 0.06, 0.06, 0.94), phase: 'approach', stage: fork.stage, source: fork.source },
      { x: clamp(anchor + width * 0.66, 0.04, 0.96), y: clamp(baseline, 0.06, 0.94), phase: 'split', stage: fork.stage, source: fork.source },
      { x: clamp(anchor + width * 1.05 + span * 0.28, 0.04, 0.96), y: clamp(baseline - signedSpread, 0.06, 0.94), phase: 'upper', stage: fork.stage, source: fork.source },
      { x: clamp(anchor + width * 1.05 + span * 0.28, 0.04, 0.96), y: clamp(baseline + signedSpread, 0.06, 0.94), phase: 'lower', stage: fork.stage, source: fork.source },
      { x: clamp(anchor + width * 1.44 + span, 0.04, 0.96), y: clamp(baseline + signedSpread * 0.08, 0.06, 0.94), phase: 'merge', stage: fork.stage, source: fork.source }
    );
    cursor = {
      x: clamp(anchor + width * 1.78 + span, 0.04, 0.96),
      y: clamp(baseline + signedSpread * 0.08, 0.06, 0.94)
    };
  }
  return points;
}

function plainHouse() {
  const front = {
    left: { x: 0.34, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.34, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  return {
    front,
    roof: { peak: { x: 0.485, y: 0.30 } },
    forkLine: [],
    forkDriven: false,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } }
  };
}

function houseForForks(forks) {
  const plain = plainHouse();
  const forkLine = traceForks({ x: plain.front.right.x, y: plain.front.right.y }, forks, 0.88, -0.002);
  const last = forkLine.at(-1) ?? plain.front.right;
  return {
    ...plain,
    roof: {
      peak: plain.roof.peak,
      returnPeak: { x: clamp(last.x - 0.035, 0.16, 0.84), y: clamp(last.y - 0.12, 0.14, 0.62) }
    },
    forkLine,
    forkDriven: forks.length > 0
  };
}

function routeForForks(house, forks) {
  const base = [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
    { ...house.door.bottom, inside: true },
    { ...house.door.top, inside: true }
  ];
  const forkLine = traceForks({ x: house.door.top.x, y: house.door.top.y - 0.01 }, forks, 1.14, 0.004);
  const exit = forkLine.at(-1) ?? base.at(-1);
  return [
    ...base,
    ...forkLine,
    { x: clamp(exit.x + 0.080, 0.04, 0.96), y: clamp(exit.y - 0.045, 0.06, 0.92), phase: 'leave', source: 'exit' }
  ];
}

export function forkSignature(frame) {
  return [
    ...frame.scene.house.forkLine,
    ...frame.scene.ground.forkLine,
    ...frame.scene.route
  ].map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.phase ?? 'base'}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyFork) : [];
  const forks = forksForMemory(inherited);
  const correction = forkForStage(safeStage);
  const draftHouse = plainHouse();
  const sceneHouse = houseForForks(forks);
  const groundForkLine = traceForks({ x: 0.10, y: 0.83 }, forks, 0.66, 0);
  const route = routeForForks(sceneHouse, forks);

  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      house: draftHouse,
      route: [
        { x: 0.46, y: 0.95 },
        { x: 0.46, y: 0.81 },
        { ...draftHouse.door.bottom },
        { ...draftHouse.door.top }
      ],
      ground: { y: 0.79 }
    },
    scene: {
      forkRecords: forks,
      house: sceneHouse,
      route,
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        forkLine: groundForkLine
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (forks.at(-1)?.point?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (forks.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        forkCount: forks.length,
        approachCount: forks.length * 3,
        splitCount: forks.length * 3,
        upperCount: forks.length * 3,
        lowerCount: forks.length * 3,
        mergeCount: forks.length * 3,
        retained: inherited.length > 0
      }
    }
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

export function applyFork(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.06, 0.94),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.10, 0.88)
  };
  const fork = {
    stage: frame.stage,
    source: 'visitor-fork',
    point: bounded,
    polarity: bounded.y < 0.5 ? -1 : 1,
    width: 0.034 + Math.abs(bounded.x - 0.5) * 0.052,
    span: 0.10 + bounded.x * 0.15,
    spread: 0.050 + Math.abs(bounded.y - 0.5) * 0.13,
    tilt: bounded.x < 0.5 ? -1 : 1,
    reason: bounded.y < 0.5 ? 'the visitor kept an upper fork' : 'the visitor kept a lower fork'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, fork]), interaction: 'visitor-fork' };
}

export function deleteLatestFork(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'fork-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'fork-lifted' };
}

export function layoutForViewport(width, height) {
  const stacked = width < 640;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.05, w: 0.84, h: 0.39, label: 'proposal' },
        { x: 0.08, y: 0.55, w: 0.84, h: 0.39, label: 'consequence' }
      ],
      fork: { x1: 0.50, y1: 0.44, x2: 0.50, y2: 0.55 },
      height
    }
    : {
      mode: 'diptych',
      panels: [
        { x: 0.04, y: 0.10, w: 0.41, h: 0.78, label: 'proposal' },
        { x: 0.55, y: 0.10, w: 0.41, h: 0.78, label: 'consequence' }
      ],
      fork: { x1: 0.45, y1: 0.50, x2: 0.55, y2: 0.50 },
      height
    };
}
