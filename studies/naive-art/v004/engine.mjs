export const SEED = 0x4e413034;
export const STAGES = 10;
export const PRIMITIVE_BUDGET = 30;

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

function copyCorrection(correction) {
  return { ...correction, point: correction.point ? copyPoint(correction.point) : null };
}

function inheritedInfluence(memory, key) {
  return memory.reduce((sum, correction, index) => {
    const age = 1 - Math.min(index, 7) * 0.06;
    return sum + Number(correction[key] ?? 0) * age;
  }, 0);
}

function correctionForStage(stage) {
  const random = rng(SEED + stage * 9176);
  return {
    stage,
    lateralDrift: (random() - 0.5) * 0.035,
    rise: 0.018 + random() * 0.012,
    depth: 0.06 + random() * 0.025,
    reason: stage % 2 ? 'the correction pointed farther away' : 'the correction kept its wrong horizon'
  };
}

function toward(point, target, amount) {
  return {
    x: point.x + (target.x - point.x) * amount,
    y: point.y + (target.y - point.y) * amount
  };
}

function houseForVanishingPoint(vanishingPoint, depth) {
  const front = {
    left: { x: 0.35, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.35, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  const back = {
    topLeft: toward(front.left, vanishingPoint, depth * 0.80),
    topRight: toward(front.right, vanishingPoint, depth),
    bottomLeft: toward(front.bottomLeft, vanishingPoint, depth * 0.80),
    bottomRight: toward(front.bottomRight, vanishingPoint, depth)
  };
  const roof = {
    frontPeak: { x: 0.49, y: 0.31 },
    backPeak: toward({ x: 0.49, y: 0.31 }, vanishingPoint, depth * 0.9)
  };
  const door = {
    top: { x: 0.48, y: 0.56 },
    bottom: { x: 0.48, y: 0.69 }
  };
  return {
    front,
    back,
    roof,
    door,
    recedingEdge: [copyPoint(front.right), copyPoint(back.topRight)],
    floorEdge: [copyPoint(front.bottomRight), copyPoint(back.bottomRight)],
    vanishingPoint: copyPoint(vanishingPoint),
    perspectiveDriven: true
  };
}

function plainHouse() {
  const front = {
    left: { x: 0.35, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.35, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  return {
    front,
    back: null,
    roof: { frontPeak: { x: 0.49, y: 0.31 }, backPeak: null },
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } },
    recedingEdge: [copyPoint(front.right), copyPoint(front.right)],
    floorEdge: [copyPoint(front.bottomLeft), copyPoint(front.bottomRight)],
    perspectiveDriven: false
  };
}

function routeForPerspective(house, vanishingPoint) {
  const start = { x: 0.46, y: 0.96 };
  const knee = { x: 0.46, y: 0.80 };
  const door = { ...house.door.bottom, inside: false };
  const nearInterior = { ...toward(door, vanishingPoint, 0.26), inside: true, recedes: true };
  const farInterior = { ...toward(door, vanishingPoint, 0.78), inside: true, recedes: true };
  const exit = { ...toward(house.back.bottomRight, vanishingPoint, 0.02), inside: false, recedes: true };
  return [start, knee, door, nearInterior, farInterior, exit, { x: exit.x + 0.05, y: exit.y - 0.01, inside: false, recedes: true }];
}

function plainRoute(house) {
  return [
    { x: 0.46, y: 0.96 },
    { x: 0.46, y: 0.80 },
    { ...house.door.bottom },
    { ...house.door.top }
  ];
}

export function routeSignature(frame) {
  return frame.scene.route.map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`).join('|');
}

export function buildFrame(stage = 0, memory = []) {
  const safeStage = clamp(Math.floor(stage), 0, STAGES - 1);
  const random = rng(SEED + safeStage * 31337);
  const inherited = Array.isArray(memory) ? memory.map(copyCorrection) : [];
  const correction = correctionForStage(safeStage);
  const lateral = inheritedInfluence(inherited, 'lateralDrift');
  const rise = inheritedInfluence(inherited, 'rise');
  const depth = clamp(0.10 + inheritedInfluence(inherited, 'depth'), 0.08, 0.34);
  const vanishingPoint = {
    x: clamp(0.50 + lateral * 2.2, 0.20, 0.80),
    y: clamp(0.27 - rise * 1.65, 0.10, 0.27)
  };
  const draftVanishingPoint = { x: 0.50, y: 0.27 };
  const draftHouse = plainHouse();
  const sceneHouse = houseForVanishingPoint(vanishingPoint, depth);

  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      vanishingPoint: draftVanishingPoint,
      house: draftHouse,
      route: plainRoute(draftHouse),
      ground: { y: 0.78 }
    },
    scene: {
      vanishingPoint,
      house: sceneHouse,
      route: routeForPerspective(sceneHouse, vanishingPoint),
      ground: {
        left: { x: 0.08, y: 0.82 },
        right: { x: 0.92, y: 0.82 },
        vanishingPoint: copyPoint(vanishingPoint)
      },
      sun: {
        x: clamp(0.15 + random() * 0.08, 0.10, 0.30),
        y: clamp(0.15 + random() * 0.06, 0.10, 0.28),
        radius: 0.056 + random() * 0.012
      },
      tree: {
        x: clamp(0.79 + (vanishingPoint.x - 0.5) * 0.18, 0.67, 0.90),
        y: clamp(0.50 - (vanishingPoint.y - 0.20) * 0.08, 0.44, 0.58)
      },
      decisionTrace: {
        vanishingPointMoved: vanishingPoint.x !== draftVanishingPoint.x || vanishingPoint.y !== draftVanishingPoint.y,
        recedingEdgeLength: Math.hypot(sceneHouse.recedingEdge[1].x - sceneHouse.recedingEdge[0].x, sceneHouse.recedingEdge[1].y - sceneHouse.recedingEdge[0].y),
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

export function applyCorrection(frame, point) {
  const rawX = Number(point?.x);
  const rawY = Number(point?.y);
  const bounded = {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.5, 0.12, 0.86)
  };
  const correction = {
    stage: frame.stage,
    source: 'visitor-vanishing-point',
    point: bounded,
    lateralDrift: (bounded.x - 0.5) * 0.12,
    rise: 0.026 + (0.5 - bounded.y) * 0.025,
    depth: 0.10 + Math.abs(bounded.x - 0.5) * 0.08,
    reason: bounded.x < 0.5 ? 'the visitor pointed away to the left' : 'the visitor pointed away to the right'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, correction]), interaction: 'visitor-vanishing-point' };
}

export function deleteLatestCorrection(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'vanishing-point-deleted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'vanishing-point-deleted' };
}

export function layoutForViewport(width, height) {
  const stacked = width < 640;
  return stacked
    ? {
      mode: 'stacked',
      panels: [
        { x: 0.08, y: 0.06, w: 0.84, h: 0.38, label: 'refused' },
        { x: 0.08, y: 0.56, w: 0.84, h: 0.38, label: 'kept' }
      ],
      bridge: { x1: 0.50, y1: 0.44, x2: 0.50, y2: 0.56 },
      height
    }
    : {
      mode: 'diptych',
      panels: [
        { x: 0.04, y: 0.10, w: 0.41, h: 0.78, label: 'refused' },
        { x: 0.55, y: 0.10, w: 0.41, h: 0.78, label: 'kept' }
      ],
      bridge: { x1: 0.45, y1: 0.50, x2: 0.55, y2: 0.50 },
      height
    };
}
