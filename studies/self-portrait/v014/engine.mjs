export const SEED = 0x53505644;
export const STAGES = 16;
export const MEMORY_LIMIT = 5;
export const PRIMITIVE_BUDGET = 84;
export const ROWS = 5;
export const COLS = 5;
export const PLATE_COUNT = ROWS * COLS;

const TAU = Math.PI * 2;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const plateId = (index) => `plate-${String(index).padStart(2, '0')}`;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^ (state >>> 16)) >>> 0) / 4294967296;
  };
}

const copyPoint = (point) => ({ x: Number(point.x), y: Number(point.y) });
const copyPoints = (points = []) => points.map(copyPoint);
const copyWitness = (witness) => ({ ...witness, point: copyPoint(witness.point) });

function safeStage(stage) {
  return clamp(Math.floor(Number(stage) || 0), 0, STAGES - 1);
}

function gridIndex(row, column) {
  return clamp(Math.round(row), 0, ROWS - 1) * COLS + clamp(Math.round(column), 0, COLS - 1);
}

function plateCenter(row, column, stage) {
  const drift = Math.sin(stage * 0.21 + row * 0.73 + column * 0.41) * 0.004;
  const cheekLift = Math.max(0, 2 - Math.abs(column - 2)) * 0.004;
  return {
    x: 0.2 + column * 0.15 + drift + (row === 4 ? (column - 2) * 0.015 : 0),
    y: 0.17 + row * 0.15 + Math.cos(stage * 0.17 + column * 0.57) * 0.004 - cheekLift
  };
}

function makePlate(row, column, stage, index) {
  const random = rng(SEED + stage * 7919 + index * 149);
  const center = plateCenter(row, column, stage);
  const width = 0.115 + (row === 4 ? 0.024 : 0) + (column === 2 ? 0.008 : 0);
  const height = 0.105 + (row === 0 ? 0.012 : 0) + (row === 4 ? 0.018 : 0);
  const baseAngle = (column - 2) * 0.035 + Math.sin(stage * 0.13 + index) * 0.012;
  const shape = [
    [-0.48, -0.26], [-0.27, -0.5], [0.29, -0.46], [0.5, -0.12], [0.39, 0.45], [-0.36, 0.48]
  ];
  const rotate = (point, angle) => ({
    x: center.x + (point[0] * width) * Math.cos(angle) - (point[1] * height) * Math.sin(angle),
    y: center.y + (point[0] * width) * Math.sin(angle) + (point[1] * height) * Math.cos(angle)
  });
  const points = shape.map((point) => rotate(point, baseAngle));
  const inner = {
    x: center.x + (random() - 0.5) * 0.012,
    y: center.y + (random() - 0.5) * 0.01,
    width: width * 0.34,
    height: height * 0.12,
    angle: baseAngle + Math.PI * 0.08
  };
  return {
    id: plateId(index),
    row,
    column,
    center,
    width,
    height,
    baseAngle,
    angle: baseAngle,
    basePoints: points,
    points: copyPoints(points),
    inner,
    state: 'quiet',
    occupancy: 1,
    pressure: 0,
    shard: []
  };
}

function basePlates(stage) {
  return Array.from({ length: PLATE_COUNT }, (_, index) => {
    const row = Math.floor(index / COLS);
    const column = index % COLS;
    return makePlate(row, column, stage, index);
  });
}

function boundedPoint(point = {}) {
  const rawX = Number(point.x);
  const rawY = Number(point.y);
  return {
    x: clamp(Number.isFinite(rawX) ? rawX : 0.78, 0.08, 0.92),
    y: clamp(Number.isFinite(rawY) ? rawY : 0.42, 0.1, 0.9)
  };
}

function chooseIndices(point, eventIndex, usedIndexes = []) {
  const row = clamp(Math.round(point.y * (ROWS - 1)), 0, ROWS - 1);
  const column = clamp(Math.round(point.x * (COLS - 1)), 0, COLS - 1);
  let target = gridIndex(row, column);
  while (usedIndexes.includes(target)) target = (target + 1) % PLATE_COUNT;
  let reply = gridIndex(ROWS - 1 - row, COLS - 1 - column);
  while (reply === target || usedIndexes.includes(reply)) reply = (reply + 1) % PLATE_COUNT;
  let vacancy = (target + 7 + eventIndex * 3) % PLATE_COUNT;
  while (vacancy === target || vacancy === reply || usedIndexes.includes(vacancy)) vacancy = (vacancy + 1) % PLATE_COUNT;
  return { target, reply, vacancy };
}

function makeWitness(stage, point, eventIndex, source, existingMemory = []) {
  const bounded = boundedPoint(point);
  const usedIndexes = existingMemory.flatMap((event) => [Number(event.targetIndex), Number(event.replyIndex), Number(event.vacancyIndex)]);
  const { target, reply, vacancy } = chooseIndices(bounded, eventIndex, usedIndexes);
  return {
    id: `${source === 'visitor-witness' ? 'visitor' : 'renderer'}-witness-${stage}-${eventIndex + 1}`,
    source,
    stage,
    point: bounded,
    targetIndex: target,
    replyIndex: reply,
    vacancyIndex: vacancy,
    targetId: plateId(target),
    replyId: plateId(reply),
    vacancyId: plateId(vacancy),
    weight: source === 'visitor-witness' ? 1.32 : 0.86,
    phase: (stage * 0.71 + eventIndex * 1.37) % TAU,
    kind: 'reciprocal-plate',
    reason: source === 'visitor-witness' ? 'the visitor made the portrait answer its own surface' : 'the portrait rehearsed a remembered look'
  };
}

function transformedPoints(plate, witness, role, eventIndex) {
  const dx = witness.point.x - plate.center.x;
  const dy = witness.point.y - plate.center.y;
  const distance = Math.max(0.04, Math.hypot(dx, dy));
  const toward = { x: dx / distance, y: dy / distance };
  const perpendicular = { x: -toward.y, y: toward.x };
  const strength = witness.weight * (0.78 + eventIndex * 0.055);
  const sign = role === 'looking' ? 1 : -1;
  const angle = Math.atan2(dy, dx) + (role === 'looking' ? 0.18 : Math.PI - 0.12) + sign * 0.12;
  const localScale = role === 'looking' ? 1.08 : 0.92;
  return plate.basePoints.map((point, pointIndex) => {
    const radial = (pointIndex % 2 === 0 ? 1 : -1) * 0.008 * strength;
    const local = {
      x: plate.center.x + (point.x - plate.center.x) * localScale,
      y: plate.center.y + (point.y - plate.center.y) * localScale
    };
    const edge = Math.sin(pointIndex * 1.7 + witness.phase) * 0.009 * strength;
    const shift = role === 'looking' ? 0.035 : 0.026;
    return {
      x: clamp(local.x + toward.x * shift * strength + perpendicular.x * (edge + radial), 0.04, 0.96),
      y: clamp(local.y + toward.y * shift * strength + perpendicular.y * (edge + radial), 0.04, 0.96)
    };
  });
}

function applyWitness(plates, witness, eventIndex) {
  const next = plates.map((plate) => ({
    ...plate,
    basePoints: copyPoints(plate.basePoints),
    points: copyPoints(plate.points),
    inner: { ...plate.inner },
    shard: copyPoints(plate.shard)
  }));
  const target = next[witness.targetIndex];
  const reply = next[witness.replyIndex];
  const vacancy = next[witness.vacancyIndex];

  target.points = transformedPoints(target, witness, 'looking', eventIndex);
  target.state = 'looking';
  target.occupancy = 1;
  target.pressure += witness.weight;
  target.lookAngle = Math.atan2(witness.point.y - target.center.y, witness.point.x - target.center.x);
  target.angle = target.lookAngle + 0.34;
  target.inner = {
    ...target.inner,
    x: clamp(target.center.x + (witness.point.x - target.center.x) * 0.36, 0.06, 0.94),
    y: clamp(target.center.y + (witness.point.y - target.center.y) * 0.26, 0.06, 0.94),
    angle: target.lookAngle
  };

  reply.points = transformedPoints(reply, witness, 'answering', eventIndex);
  reply.state = 'answering';
  reply.occupancy = 1;
  reply.pressure += witness.weight * 0.82;
  reply.answerAngle = Math.atan2(reply.center.y - witness.point.y, reply.center.x - witness.point.x);
  reply.angle = reply.answerAngle - 0.28;
  reply.inner = {
    ...reply.inner,
    x: clamp(reply.center.x + (reply.center.x - witness.point.x) * 0.24, 0.06, 0.94),
    y: clamp(reply.center.y + (reply.center.y - witness.point.y) * 0.18, 0.06, 0.94),
    angle: reply.answerAngle
  };

  const shardAngle = witness.phase + eventIndex * 0.3;
  vacancy.state = 'vacant';
  vacancy.occupancy = 0;
  vacancy.points = [];
  vacancy.pressure += witness.weight * 0.34;
  vacancy.shard = vacancy.basePoints.map((point, pointIndex) => ({
    x: clamp(point.x + Math.cos(shardAngle) * (0.045 + pointIndex * 0.002), 0.04, 0.96),
    y: clamp(point.y + Math.sin(shardAngle) * (0.045 + pointIndex * 0.002), 0.04, 0.96)
  }));

  return next;
}

function candidateWitness(stage, plates, memory) {
  const random = rng(SEED + stage * 12347 + 401);
  const index = (stage * 7 + Math.floor(random() * plates.length)) % plates.length;
  const plate = plates[index];
  return makeWitness(stage, {
    x: clamp(plate.center.x + Math.cos(random() * TAU) * 0.2, 0.12, 0.88),
    y: clamp(plate.center.y + Math.sin(random() * TAU) * 0.2, 0.14, 0.86)
  }, memory.length, 'renderer-attention', memory);
}

export function buildFrame(stage = 0, memory = []) {
  const safe = safeStage(stage);
  const inherited = Array.isArray(memory) ? memory.map(copyWitness).slice(-MEMORY_LIMIT) : [];
  let plates = basePlates(safe);
  inherited.forEach((witness, index) => {
    plates = applyWitness(plates, witness, index);
  });
  const witnesses = inherited;
  const responses = plates.filter((plate) => plate.state === 'answering' && plate.occupancy === 1);
  const vacancies = plates.filter((plate) => plate.occupancy === 0);
  const shards = vacancies.flatMap((plate) => plate.shard.map(copyPoint));
  const witness = candidateWitness(safe, plates, inherited);
  return {
    stage: safe,
    plates,
    witnesses,
    witness,
    responses,
    vacancies,
    shards,
    decided: safe % 3 === 2,
    memory: inherited,
    primitiveBudget: PRIMITIVE_BUDGET
  };
}

export function buildTimeline(stageCount = STAGES) {
  let memory = [];
  const count = clamp(Math.floor(Number(stageCount) || 0), 0, STAGES);
  return Array.from({ length: count }, (_, stage) => {
    const frame = buildFrame(stage, memory);
    if (frame.decided) memory = [...memory, frame.witness].slice(-MEMORY_LIMIT);
    return frame;
  });
}

export function registerWitness(frame, point = {}) {
  const witness = makeWitness(frame.stage, point, frame.memory.length, 'visitor-witness', frame.memory);
  const nextMemory = [...frame.memory, witness].slice(-MEMORY_LIMIT);
  return { ...buildFrame(frame.stage, nextMemory), interaction: 'visitor-witness', restoreMemory: frame.memory.map(copyWitness) };
}

export function liftLatestWitness(frame) {
  if (frame.restoreMemory) return { ...buildFrame(frame.stage, frame.restoreMemory), interaction: 'witness-lifted' };
  if (!frame.memory.length) return { ...frame, interaction: 'witness-lifted' };
  return { ...buildFrame(frame.stage, frame.memory.slice(0, -1)), interaction: 'witness-lifted' };
}

export function geometrySignature(frame) {
  const plates = (frame.plates ?? []).flatMap((plate) => [
    plate.id,
    plate.occupancy,
    plate.state,
    plate.pressure,
    plate.angle,
    plate.lookAngle,
    plate.answerAngle,
    ...plate.points.flatMap(({ x, y }) => [x, y]),
    ...plate.shard.flatMap(({ x, y }) => [x, y])
  ]);
  const witnesses = (frame.witnesses ?? []).flatMap((witness) => [
    witness.id, witness.targetIndex, witness.replyIndex, witness.vacancyIndex, witness.point.x, witness.point.y, witness.weight, witness.phase
  ]);
  return [...plates, ...witnesses].map((value) => typeof value === 'number' ? value.toFixed(6) : String(value)).join('|');
}
