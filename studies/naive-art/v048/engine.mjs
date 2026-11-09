const SEED = '0x4e413438';
export const AGENT_COUNT = 15;
export const MEMORY_LIMIT = 4;
export const ATTENTION_THRESHOLD = 3;

const round = (value) => Math.round(Number(value) * 10000) / 10000;
const clone = (value) => JSON.parse(JSON.stringify(value));
const validAgent = (value) => Number.isInteger(value) && value >= 0 && value < AGENT_COUNT;

const AGENT_LAYOUT = [
  [-0.79, -0.28, 0.105, 0.175, -0.22, 0.92],
  [-0.61, -0.38, 0.095, 0.155, 0.44, 1.08],
  [-0.42, -0.18, 0.12, 0.2, -0.56, 0.86],
  [-0.22, -0.34, 0.09, 0.16, 0.17, 1.16],
  [0.01, -0.19, 0.115, 0.21, 0.7, 0.94],
  [0.23, -0.37, 0.1, 0.17, -0.38, 1.12],
  [0.46, -0.2, 0.125, 0.19, 0.31, 0.9],
  [0.7, -0.32, 0.09, 0.15, -0.72, 1.05],
  [-0.73, 0.16, 0.12, 0.19, 0.63, 0.98],
  [-0.51, 0.31, 0.095, 0.16, -0.18, 1.14],
  [-0.29, 0.19, 0.11, 0.18, 0.49, 0.88],
  [-0.04, 0.36, 0.1, 0.17, -0.61, 1.09],
  [0.19, 0.2, 0.12, 0.2, 0.25, 0.97],
  [0.43, 0.34, 0.095, 0.16, -0.4, 1.18],
  [0.68, 0.18, 0.11, 0.185, 0.58, 0.91]
];

function baseAgent(index) {
  const [x, y, width, height, angle, lean] = AGENT_LAYOUT[index];
  return {
    id: index,
    x,
    y,
    width,
    height,
    angle,
    lean,
    notch: round(0.22 + (index % 4) * 0.055),
    phase: round(((index * 13) % 31) / 31),
    role: 'situated-witness',
    backcastDepth: 0,
    attentionBias: 0
  };
}

const BASE_AGENTS = Array.from({ length: AGENT_COUNT }, (_, index) => baseAgent(index));

function averagePosition(agents, ids) {
  const chosen = ids.map((id) => agents[id]);
  return {
    x: round(chosen.reduce((sum, agent) => sum + agent.x, 0) / chosen.length),
    y: round(chosen.reduce((sum, agent) => sum + agent.y, 0) / chosen.length)
  };
}

function materialise(memory) {
  const agents = BASE_AGENTS.map((agent) => ({ ...agent }));
  const seams = [];
  const backcasts = memory.slice(-MEMORY_LIMIT).map((event) => ({ ...event, visited: [...event.visited] }));

  for (const event of backcasts) {
    const visitedSet = new Set(event.visited);
    const sequenceBias = event.visited.reduce((sum, id, index) => sum + (id + 1) * (index + 1), 0) % 17;
    agents.forEach((agent, index) => {
      const local = visitedSet.has(index);
      const stagger = ((index % 5) - 2) * 0.021;
      const direction = event.backAngle + stagger + (local ? 0.13 : -0.045);
      const turn = 0.12 + event.memoryIndex * 0.027 + (sequenceBias % 5) * 0.008;
      agent.angle = round(agent.angle + direction * 0.045 + turn * (local ? 1 : -0.24));
      agent.width = round(agent.width * (1 + (local ? 0.075 : 0.018)));
      agent.height = round(agent.height * (1 + (local ? -0.035 : 0.022)));
      agent.notch = round(Math.max(0.12, Math.min(0.58, agent.notch + (local ? 0.065 : -0.012))));
      agent.x = round(agent.x + Math.cos(direction) * (local ? 0.012 : 0.004));
      agent.y = round(agent.y + Math.sin(direction) * (local ? 0.01 : -0.003));
      agent.backcastDepth = round(agent.backcastDepth + 0.03 + (local ? 0.045 : 0.008));
      agent.attentionBias = round(agent.attentionBias + (local ? 0.18 : -0.035));
      if (local) agent.role = 'backcast-witness';
    });

    const centre = averagePosition(agents, event.visited);
    seams.push({
      id: event.memoryIndex,
      x: centre.x,
      y: centre.y,
      angle: round(event.backAngle),
      visited: [...event.visited],
      weight: round(0.6 + event.memoryIndex * 0.11),
      sequenceBias
    });
  }

  return {
    agents,
    seams,
    trace: {
      memoryCount: memory.length,
      lastVisited: memory.at(-1)?.visited ?? [],
      lastBackAngle: memory.at(-1)?.backAngle ?? null,
      backcastCount: memory.length
    }
  };
}

function stateFrom(memory, interaction = 'idle', pending = null) {
  const boundedMemory = memory.slice(-MEMORY_LIMIT).map((event, index) => ({
    ...event,
    memoryIndex: index,
    visited: [...event.visited]
  }));
  return {
    seed: SEED,
    grammar: 'backcast-ecology',
    surface: 'p5-canvas-reciprocal-field',
    stage: boundedMemory.length,
    memory: clone(boundedMemory),
    memoryLimit: MEMORY_LIMIT,
    pending: pending ? clone(pending) : { active: false, visited: [], lastAngle: null },
    interaction,
    event: interaction === 'look-back-committed' ? clone(boundedMemory.at(-1)) : null,
    body: materialise(boundedMemory)
  };
}

export function buildFrame() {
  return stateFrom([]);
}

export function geometrySignature(state) {
  return JSON.stringify({ agents: state.body.agents, seams: state.body.seams });
}

export function noticeAgent(state, agentIndex, viewerAngle = 0) {
  if (!validAgent(agentIndex)) return stateFrom(state.memory, 'attention-refused-target', state.pending);
  const pending = state.pending?.active
    ? clone(state.pending)
    : { active: true, visited: [], lastAngle: null };
  const repeated = pending.visited.includes(agentIndex);
  if (!repeated) pending.visited.push(agentIndex);
  pending.lastAngle = round(Number.isFinite(Number(viewerAngle)) ? Number(viewerAngle) : 0);
  return stateFrom(state.memory, repeated ? 'attention-repeated' : 'attention-noticed', pending);
}

export function commitLookBack(state, explicitAngle = null) {
  if (!state.pending?.active || state.pending.visited.length < ATTENTION_THRESHOLD) {
    return stateFrom(state.memory, 'look-back-refused-incomplete', state.pending);
  }
  const backAngle = Number.isFinite(Number(explicitAngle)) ? Number(explicitAngle) : (state.pending.lastAngle ?? 0);
  const event = {
    type: 'backcast',
    visited: [...state.pending.visited],
    backAngle: round(backAngle),
    memoryIndex: state.memory.length,
    attentionCount: state.pending.visited.length
  };
  return stateFrom([...state.memory, event], 'look-back-committed');
}

export function liftLatest(state) {
  return stateFrom(state.memory.slice(0, -1), 'backcast-lifted');
}

export function releaseMemory() {
  return stateFrom([], 'memory-released');
}

export function buildTimeline() {
  const plans = [
    { visited: [2, 6, 11], angle: -0.4 },
    { visited: [1, 7, 13], angle: 1.2 },
    { visited: [4, 9, 14], angle: 2.2 },
    { visited: [0, 5, 10], angle: -1.3 }
  ];
  const frames = [buildFrame()];
  for (const plan of plans) {
    let frame = frames.at(-1);
    for (const agentIndex of plan.visited) frame = noticeAgent(frame, agentIndex, plan.angle);
    frames.push(commitLookBack(frame, plan.angle));
  }
  return frames;
}

export { SEED };
