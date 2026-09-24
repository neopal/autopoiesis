export const SEED = 0x57473135;
export const BODY_COUNT = 180;
export const MEMORY_LIMIT = 5;
export const STAGES = 18;

const ROWS = 12;
const COLUMNS = 15;
const EVENT_POINTS = [
  { x: 0.22, y: 0.28 },
  { x: 0.73, y: 0.34 },
  { x: 0.58, y: 0.68 },
  { x: 0.28, y: 0.77 },
  { x: 0.82, y: 0.76 }
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clamp01 = (value) => clamp(value, 0, 1);
const fract = (value) => value - Math.floor(value);
const hash = (value) => fract(Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453);

const baseBodies = () => {
  const bodies = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const index = row * COLUMNS + column;
      const u = (column + 0.5) / COLUMNS;
      const v = (row + 0.5) / ROWS;
      const jitterX = (hash(index * 1.71 + 2) - 0.5) * 0.032;
      const jitterY = (hash(index * 2.13 + 5) - 0.5) * 0.042;
      const wave = Math.sin(u * Math.PI * 2.4 + v * 2.8) * 0.032;
      const x = clamp01(u + jitterX + wave * (0.4 + v));
      const y = clamp01(v + jitterY + Math.cos(u * 4.2) * 0.018);
      const depth = clamp01(0.18 + v * 0.56 + Math.sin(u * 5.3 + v * 2.2) * 0.1 + (hash(index * 3.4 + 8) - 0.5) * 0.08);
      const baseYaw = (x - 0.5) * 0.86 + Math.sin(v * Math.PI * 2.1) * 0.17;
      bodies.push({
        id: index,
        x,
        y,
        depth,
        baseDepth: depth,
        yaw: baseYaw,
        baseYaw,
        size: 0.72 + hash(index * 5.1 + 11) * 0.45,
        width: 0.78 + hash(index * 7.4 + 13) * 0.34,
        height: 0.68 + hash(index * 8.2 + 17) * 0.46,
        tint: Math.floor(hash(index * 9.2 + 19) * 5),
        hidden: 0,
        age: 0
      });
    }
  }
  return bodies;
};

const makeEvent = (point, index) => {
  const bounded = {
    x: clamp(point?.x ?? 0.5, 0.08, 0.92),
    y: clamp(point?.y ?? 0.5, 0.08, 0.92)
  };
  return {
    source: 'visitor-witness',
    mode: 'concealment',
    point: bounded,
    cavity: {
      x: bounded.x,
      y: bounded.y,
      radius: 0.105 + index * 0.014,
      depth: 0.32 + index * 0.045
    },
    hiddenLoad: 0,
    index
  };
};

const applyEvent = (bodies, event, eventIndex) => {
  let hiddenLoad = 0;
  let cavityBodies = 0;
  let reorientedBodies = 0;
  const radius = event.cavity.radius;
  for (const body of bodies) {
    const dx = body.x - event.point.x;
    const dy = body.y - event.point.y;
    const distance = Math.hypot(dx, dy);
    const safeDistance = distance || 0.0001;
    const core = distance < radius * (0.72 + 0.04 * Math.sin(body.id));
    const rim = distance >= radius * 0.58 && distance < radius * 1.78;
    const outer = distance >= radius * 1.78 && distance < radius * 2.72;
    const direction = (eventIndex % 2 === 0 ? 1 : -1) * (body.id % 2 === 0 ? 1 : -1);

    if (core) {
      const intensity = 1 - distance / (radius * 1.12);
      body.hidden = Math.max(body.hidden, clamp01(0.68 + intensity * 0.32));
      body.x = clamp01(body.x + (dx / safeDistance) * (0.018 + intensity * 0.018));
      body.y = clamp01(body.y + (dy / safeDistance) * (0.018 + intensity * 0.018));
      body.depth = clamp01(body.depth + 0.1 + intensity * 0.18);
      body.yaw += direction * (0.22 + intensity * 0.62);
      body.age += 1;
      hiddenLoad += body.hidden;
      cavityBodies += 1;
    } else if (rim) {
      const intensity = 1 - Math.abs(distance - radius) / (radius * 0.92);
      body.x = clamp01(body.x + (dx / safeDistance) * intensity * 0.052);
      body.y = clamp01(body.y + (dy / safeDistance) * intensity * 0.052);
      body.depth = clamp01(body.depth - intensity * 0.16 + Math.sin(body.id + eventIndex) * 0.012);
      body.yaw += direction * intensity * 0.92;
      body.hidden = Math.max(body.hidden, intensity * 0.2);
      body.age += intensity * 0.5;
    } else if (outer) {
      const intensity = 1 - (distance - radius * 1.78) / (radius * 0.94);
      body.depth = clamp01(body.depth + intensity * 0.1 * (eventIndex % 2 ? -1 : 1));
      body.yaw -= direction * intensity * 0.26;
      body.age += intensity * 0.2;
    }
    if (Math.abs(body.yaw - body.baseYaw) > 0.06) reorientedBodies += 1;
  }
  event.hiddenLoad = hiddenLoad;
  return { cavityBodies, reorientedBodies };
};

const aggregateFrame = (bodies, memory) => {
  const cavityBodies = bodies.filter((body) => body.hidden > 0.55).length;
  const hiddenBodies = bodies.filter((body) => body.hidden > 0.08).length;
  const reorientedBodies = bodies.filter((body) => Math.abs(body.yaw - body.baseYaw) > 0.06).length;
  const archivedLoad = memory.reduce((sum, event) => sum + event.hiddenLoad, 0);
  return {
    cavityBodies,
    hiddenBodies,
    reorientedBodies,
    archivedLoad,
    cavityCount: memory.length
  };
};

export const buildFrame = (stage = 0, memory = []) => {
  const bodies = baseBodies();
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map((event, index) => ({
    ...event,
    point: { ...event.point },
    cavity: { ...event.cavity },
    index
  }));
  for (let index = 0; index < boundedMemory.length; index += 1) {
    applyEvent(bodies, boundedMemory[index], index);
  }
  return {
    stage: clamp(stage, 0, STAGES - 1),
    bodies,
    memory: boundedMemory,
    archive: {
      cavities: boundedMemory.map((event) => ({ ...event.cavity, point: { ...event.point } })),
      totalHiddenLoad: boundedMemory.reduce((sum, event) => sum + event.hiddenLoad, 0)
    },
    aggregate: aggregateFrame(bodies, boundedMemory)
  };
};

export const buildTimeline = () => {
  const timeline = [];
  for (let stage = 0; stage < STAGES; stage += 1) {
    const count = Math.min(MEMORY_LIMIT, Math.floor(stage / 3));
    const memory = EVENT_POINTS.slice(0, count).map((point, index) => makeEvent(point, index));
    timeline.push(buildFrame(stage, memory));
  }
  return timeline;
};

export const applyAttention = (frame, point) => {
  const event = makeEvent(point, frame.memory.length);
  const nextMemory = [...frame.memory, event].slice(-MEMORY_LIMIT);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), nextMemory);
};

export const deleteAttention = (frame) => {
  if (frame.memory.length === 0) return buildFrame(frame.stage, []);
  return buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1));
};

export const releaseAttention = () => buildFrame(0, []);

export const geometrySignature = (frame) => JSON.stringify(frame.bodies.map((body) => [
  Number(body.x.toFixed(6)),
  Number(body.y.toFixed(6)),
  Number(body.depth.toFixed(6)),
  Number(body.yaw.toFixed(6)),
  Number(body.hidden.toFixed(6))
]));

export const timelinePoints = EVENT_POINTS.map((point) => ({ ...point }));
