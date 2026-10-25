export const SEED = 0x57473434;
export const STAGES = 9;
export const AGENT_COUNT = 18;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 36;
export const MIN_ARC = 0.12;
export const MIN_DURATION = 120;
export const MAX_DURATION = 1400;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const pseudo = (value) => {
  const raw = Math.sin(value * 19.371 + SEED * 0.000017) * 43758.5453;
  return raw - Math.floor(raw);
};
const normalizeAngle = (value, fallback = 0.5) => {
  const numeric = finite(value, fallback);
  return ((numeric % 1) + 1) % 1;
};
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const sectorFor = (angle) => integer(Math.floor(normalizeAngle(angle) * AGENT_COUNT), 0, AGENT_COUNT - 1);
const angularDistance = (a, b) => {
  const distance = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(distance, 1 - distance);
};
const sectorDistance = (a, b) => Math.min(Math.abs(a - b), AGENT_COUNT - Math.abs(a - b));
const sectorOffset = (sector, offset) => (sector + offset + AGENT_COUNT) % AGENT_COUNT;
const normalizeEvent = (event = {}, index = 0) => {
  const startAngle = normalizeAngle(event.startAngle ?? event.angle, 0.18 + index * 0.17);
  const endAngle = normalizeAngle(event.endAngle ?? (startAngle + 0.42), startAngle + 0.42);
  const sourceSector = event.sourceSector === undefined ? sectorFor(startAngle) : integer(event.sourceSector, 0, AGENT_COUNT - 1);
  let replySector = integer(event.replySector ?? sectorOffset(sourceSector, Math.max(3, Math.round(angularDistance(startAngle, endAngle) * AGENT_COUNT) + 3 + index)), 0, AGENT_COUNT - 1);
  if (replySector === sourceSector) replySector = sectorOffset(sourceSector, 5);
  const distance = clamp(finite(event.distance, angularDistance(startAngle, endAngle)), MIN_ARC * 0.5, 0.98);
  return {
    id: `relay-${index}`,
    mode: 'reciprocal-relay',
    startAngle,
    endAngle,
    sourceSector,
    replySector,
    distance: round(distance),
    duration: round(clamp(finite(event.duration, 420), MIN_DURATION, MAX_DURATION)),
    force: round(clamp(finite(event.force, 0.72), 0.56, 1)),
    serial: index
  };
};
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const baseAgents = () => Array.from({ length: AGENT_COUNT }, (_, id) => {
  const angle = id / AGENT_COUNT;
  const radius = 0.47 + Math.sin(angle * Math.PI * 4.2 + 0.6) * 0.055 + (pseudo(id + 12) - 0.5) * 0.045;
  return {
    id,
    angle: round(angle),
    radius: round(clamp(radius, 0.35, 0.62)),
    phase: round((pseudo(id + 52) - 0.5) * 0.16),
    reciprocity: 0,
    depth: round(0.24 + pseudo(id + 92) * 0.58),
    aperture: round(0.42 + pseudo(id + 132) * 0.24)
  };
});

const buildField = (memory) => {
  let agents = baseAgents();
  const relays = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = agents.map((agent) => ({ ...agent }));
    const source = event.sourceSector;
    const reply = event.replySector;
    const twist = (event.endAngle - event.startAngle) * (serial % 2 ? -1 : 1) * 0.12;
    agents = previous.map((agent, index) => {
      const neighbour = previous[sectorOffset(index, index % 2 ? -1 : 1)];
      const antipode = previous[sectorOffset(index, Math.floor(AGENT_COUNT / 2))];
      const local = 1 - sectorDistance(index, source) / (AGENT_COUNT * 0.5);
      const mutual = 1 - sectorDistance(index, reply) / (AGENT_COUNT * 0.5);
      const exchange = (antipode.radius - agent.radius) * event.force * 0.16;
      const orbit = (neighbour.angle - agent.angle) * 0.14 + twist * (0.35 + local * 0.65);
      return {
        ...agent,
        angle: round(normalizeAngle(agent.angle + orbit + (local - mutual) * 0.008)),
        radius: round(clamp(agent.radius + exchange + (neighbour.radius - agent.radius) * 0.08 + (mutual - local) * event.force * 0.035, 0.2, 0.9)),
        phase: round(agent.phase + (antipode.phase - agent.phase) * 0.18 + (mutual - local) * event.force * 0.08 + Math.sin(index * 0.71 + serial) * event.force * 0.012),
        reciprocity: round(clamp(agent.reciprocity + Math.abs(antipode.radius - agent.radius) * 0.46 + (local * mutual) * event.force * 0.12, 0, 1)),
        depth: round(clamp(agent.depth + (neighbour.depth - agent.depth) * 0.12 + (mutual - local) * 0.06, 0.04, 0.98)),
        aperture: round(clamp(agent.aperture + (local - mutual) * 0.08 + event.force * 0.015, 0.16, 0.92))
      };
    });
    agents = agents.map((agent, index) => {
      if (index === source) return {
        ...agent,
        radius: round(clamp(agent.radius - (0.17 + serial * 0.018) * event.force, 0.18, 0.9)),
        phase: round(agent.phase - 0.18 * event.force),
        reciprocity: round(clamp(agent.reciprocity + 0.16 + serial * 0.025, 0, 1)),
        aperture: round(clamp(agent.aperture - 0.06, 0.16, 0.92))
      };
      if (index === reply) return {
        ...agent,
        radius: round(clamp(agent.radius + (0.245 + serial * 0.026) * event.force, 0.18, 0.9)),
        phase: round(agent.phase + 0.22 * event.force),
        reciprocity: round(clamp(agent.reciprocity + 0.2 + serial * 0.03, 0, 1)),
        aperture: round(clamp(agent.aperture + 0.09, 0.16, 0.92))
      };
      return agent;
    });
    relays.push(`${source}>${reply}:${event.startAngle.toFixed(3)}-${event.endAngle.toFixed(3)}`);
  });
  const signature = JSON.stringify({
    relays: relays.join('|') || 'quiet',
    agents: agents.map((agent) => [agent.id, agent.angle, agent.radius, agent.phase, agent.reciprocity, agent.depth, agent.aperture])
  });
  return { agents, relays: relays.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], attention = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    attention: attention ? {
      startAngle: normalizeAngle(attention.startAngle),
      currentAngle: normalizeAngle(attention.currentAngle ?? attention.startAngle),
      startedAt: finite(attention.startedAt, 0)
    } : null,
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const attendChorus = (frame, input = {}) => {
  const angle = normalizeAngle(input.angle);
  return { ...frame, attention: { startAngle: angle, currentAngle: angle, startedAt: finite(input.at, 0) }, lastAction: 'listen-armed' };
};

export const moveChorus = (frame, input = {}) => {
  if (!frame.attention) return frame;
  return {
    ...frame,
    attention: { ...frame.attention, currentAngle: normalizeAngle(input.angle, frame.attention.currentAngle) },
    lastAction: 'listen-moving'
  };
};

export const releaseChorus = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, attention: null, lastAction: 'memory-limit' };
  if (!frame.attention) return { ...frame, lastAction: 'listen-refused-no-arm' };
  const startAngle = frame.attention.startAngle;
  const endAngle = normalizeAngle(input.angle, frame.attention.currentAngle);
  const distance = angularDistance(startAngle, endAngle);
  const duration = finite(input.releasedAt, frame.attention.startedAt) - frame.attention.startedAt;
  if (distance < MIN_ARC * 0.5 || duration < MIN_DURATION || duration > MAX_DURATION) return { ...frame, attention: null, lastAction: 'listen-refused-bounds' };
  const sourceSector = sectorFor(startAngle);
  const replySector = sectorOffset(sourceSector, Math.max(3, Math.round(distance * AGENT_COUNT) + 3 + frame.memory.length * 2));
  const event = { mode: 'reciprocal-relay', startAngle, endAngle, sourceSector, replySector, distance, duration, force: 0.68 + ((frame.memory.length + Math.round(distance * 10)) % 3) * 0.08 };
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'relay-committed');
};

export const liftLatestRelay = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'relay-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultRelay = (frame) => {
  const relays = [[0.12, 0.56], [0.64, 0.18], [0.28, 0.82], [0.9, 0.42]];
  return relays[frame.memory.length % relays.length];
};

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    if (frame.memory.length < MEMORY_LIMIT) {
      const [startAngle, endAngle] = defaultRelay(frame);
      frame = releaseChorus(attendChorus(frame, { angle: startAngle, at: 0 }), { angle: endAngle, releasedAt: 420 });
    } else {
      frame = buildFrame(stage, frame.memory, null, 'settled-preview');
    }
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, agents: frame.field.agents });
export const agentPoints = () => baseAgents().map((agent) => ({ id: agent.id, angle: agent.angle, radius: agent.radius }));
