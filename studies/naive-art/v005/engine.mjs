export const SEED = 0x4e413035;
export const STAGES = 10;
export const PRIMITIVE_BUDGET = 32;

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

function correctionForStage(stage) {
  const random = rng(SEED + stage * 9176);
  const side = random() < 0.5 ? -1 : 1;
  return {
    stage,
    side,
    span: 0.024 + random() * 0.022,
    drop: 0.025 + random() * 0.018,
    reason: side < 0 ? 'the correction turned left too soon' : 'the correction turned right too soon'
  };
}

function turnsForMemory(memory) {
  return memory.slice(-9).map((correction, index) => ({
    stage: correction.stage,
    source: correction.source ?? 'autonomous-correction',
    side: Number(correction.side) < 0 ? -1 : 1,
    dx: (Number(correction.side) < 0 ? -1 : 1) * clamp(Number(correction.span) || 0.03, 0.016, 0.064),
    dy: clamp(Number(correction.drop) || 0.03, 0.018, 0.058),
    order: index
  }));
}

function traceTurns(origin, turns, scale = 1) {
  let cursor = copyPoint(origin);
  const points = [];
  for (const turn of turns) {
    const elbow = {
      x: clamp(cursor.x + turn.dx * scale, 0.08, 0.92),
      y: cursor.y
    };
    const landing = {
      x: elbow.x,
      y: clamp(elbow.y + turn.dy * scale, 0.10, 0.88)
    };
    points.push({ ...elbow, turn: true, stage: turn.stage, source: turn.source });
    points.push({ ...landing, turn: false, stage: turn.stage, source: turn.source });
    cursor = landing;
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
    hinges: [],
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } },
    hingeDriven: false
  };
}

function houseForTurns(turns) {
  const front = {
    left: { x: 0.34, y: 0.43 },
    right: { x: 0.63, y: 0.43 },
    bottomLeft: { x: 0.34, y: 0.69 },
    bottomRight: { x: 0.63, y: 0.69 }
  };
  const hinges = traceTurns({ x: front.right.x, y: front.right.y }, turns, 0.92);
  const last = hinges.at(-1) ?? front.right;
  return {
    front,
    roof: {
      peak: { x: 0.485, y: 0.30 },
      end: { x: clamp(last.x, 0.16, 0.86), y: clamp(last.y - 0.08, 0.16, 0.68) }
    },
    hinges,
    door: { top: { x: 0.48, y: 0.56 }, bottom: { x: 0.48, y: 0.69 } },
    hingeDriven: turns.length > 0
  };
}

function routeForTurns(house, turns) {
  const start = { x: 0.46, y: 0.95 };
  const knee = { x: 0.46, y: 0.81 };
  const door = { ...house.door.bottom, inside: true };
  const turned = traceTurns({ x: door.x, y: door.y - 0.01 }, turns, 1.14);
  const exit = turned.at(-1) ?? { x: door.x, y: door.y - 0.12 };
  return [start, knee, door, ...turned, { x: clamp(exit.x + 0.055, 0.08, 0.92), y: clamp(exit.y - 0.018, 0.10, 0.86), turn: turns.length > 0, source: 'exit' }];
}

function plainRoute(house) {
  return [
    { x: 0.46, y: 0.95 },
    { x: 0.46, y: 0.81 },
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
  const turns = turnsForMemory(inherited);
  const draftHouse = plainHouse();
  const sceneHouse = houseForTurns(turns);

  return {
    stage: safeStage,
    memory: inherited,
    correction,
    primitiveCount: PRIMITIVE_BUDGET,
    draft: {
      house: draftHouse,
      route: plainRoute(draftHouse),
      ground: { y: 0.79 }
    },
    scene: {
      turns,
      house: sceneHouse,
      route: routeForTurns(sceneHouse, turns),
      ground: {
        left: { x: 0.08, y: 0.83 },
        right: { x: 0.92, y: 0.83 },
        turns: traceTurns({ x: 0.08, y: 0.83 }, turns, 0.72)
      },
      sun: {
        x: clamp(0.14 + random() * 0.08, 0.10, 0.28),
        y: clamp(0.14 + random() * 0.06, 0.10, 0.27),
        radius: 0.055 + random() * 0.013
      },
      tree: {
        x: clamp(0.79 - (turns.at(-1)?.x ?? 0.63) * 0.08, 0.68, 0.90),
        y: clamp(0.49 + (turns.length % 3) * 0.012, 0.44, 0.58)
      },
      decisionTrace: {
        turnCount: turns.length,
        routeTurnCount: turns.filter((point) => point.turn).length,
        houseTurnCount: sceneHouse.hinges.filter((point) => point.turn).length,
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
    source: 'visitor-wrong-turn',
    point: bounded,
    side: bounded.x < 0.5 ? -1 : 1,
    span: 0.024 + Math.abs(bounded.x - 0.5) * 0.060,
    drop: 0.022 + bounded.y * 0.030,
    reason: bounded.x < 0.5 ? 'the visitor pointed the turn left' : 'the visitor pointed the turn right'
  };
  return { ...buildFrame(frame.stage, [...frame.memory, correction]), interaction: 'visitor-wrong-turn' };
}

export function deleteLatestCorrection(frame) {
  if (!frame.memory.length) return { ...frame, interaction: 'wrong-turn-deleted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'wrong-turn-deleted' };
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
