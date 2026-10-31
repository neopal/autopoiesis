export const AGENT_COUNT = 13;
export const MEMORY_LIMIT = 4;
export const SEED = 0x503038;

const LAYOUT = [
  [132, 168, 132, 108, -17], [352, 124, 184, 126, 8], [620, 172, 136, 154, 22],
  [874, 116, 172, 112, -11], [1081, 216, 126, 170, 18], [782, 318, 178, 112, -23],
  [532, 346, 148, 172, 7], [266, 326, 190, 108, 27], [118, 504, 128, 152, -12],
  [344, 548, 184, 118, 14], [616, 560, 158, 142, -17], [868, 516, 192, 110, 9],
  [1095, 508, 132, 150, -21]
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const rounded = (value) => Number(Number(value).toFixed(5));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seeded(index) {
  const value = Math.sin((index + 1) * 19.173 + SEED) * 43758.5453;
  return value - Math.floor(value);
}

function createAgent(index) {
  const [x, y, width, height, angle] = LAYOUT[index];
  return {
    index,
    x: rounded(x + (seeded(index + 11) - 0.5) * 16),
    y: rounded(y + (seeded(index + 21) - 0.5) * 14),
    width: rounded(width * (0.92 + seeded(index + 31) * 0.16)),
    height: rounded(height * (0.91 + seeded(index + 41) * 0.17)),
    angle: rounded(angle + (seeded(index + 51) - 0.5) * 8),
    aperture: rounded(0.22 + seeded(index + 61) * 0.34),
    bend: rounded(-0.22 + seeded(index + 71) * 0.44),
    tone: seeded(index + 81) > 0.68 ? 'coral' : seeded(index + 91) > 0.45 ? 'cyan' : 'bone',
    state: 'quiet',
    pose: 0,
    gaze: 0
  };
}

export function buildField() {
  return {
    composition: 'departing-syntax',
    revision: 0,
    agents: Array.from({ length: AGENT_COUNT }, (_, index) => createAgent(index)),
    ledger: Array.from({ length: AGENT_COUNT }, () => 0),
    memory: [],
    snapshots: [],
    lastGaze: null,
    interaction: 'quiet'
  };
}

export function structureSignature(field) {
  return JSON.stringify({
    composition: field.composition,
    revision: field.revision,
    agents: field.agents.map((agent) => [
      agent.index, agent.x, agent.y, agent.width, agent.height, agent.angle,
      agent.aperture, agent.bend, agent.tone
    ])
  });
}

export function poseSignature(field) {
  return JSON.stringify(field.agents.map((agent) => [agent.index, agent.pose, agent.gaze]));
}

export function gazeAt(field, { index = 6, intensity = 0.72 } = {}) {
  const next = clone(field);
  const safeIndex = clamp(Math.floor(Number(index) || 0), 0, AGENT_COUNT - 1);
  const safeIntensity = rounded(clamp(Number(intensity) || 0, 0, 1));
  next.lastGaze = { index: safeIndex, intensity: safeIntensity, relation: 'reciprocal' };
  next.ledger[safeIndex] = rounded(Math.min(1, next.ledger[safeIndex] + safeIntensity * 0.2));
  next.agents = next.agents.map((agent) => agent.index === safeIndex
    ? { ...agent, pose: rounded((safeIntensity - 0.5) * 18), gaze: safeIntensity, state: 'gazing' }
    : { ...agent, pose: 0, gaze: 0, state: agent.state === 'gazing' ? 'quiet' : agent.state });
  next.interaction = 'gazing';
  return next;
}

function nextRemote(candidate, forbidden) {
  let index = ((candidate % AGENT_COUNT) + AGENT_COUNT) % AGENT_COUNT;
  while (forbidden.has(index)) index = (index + 1) % AGENT_COUNT;
  return index;
}

function mutateAgent(agent, role, revision, intensity) {
  const next = { ...agent, pose: 0, gaze: 0, state: role };
  if (role === 'closed') {
    next.aperture = rounded(clamp(agent.aperture - 0.12 - intensity * 0.06, 0.04, 0.72));
    next.height = rounded(agent.height * 1.12);
    next.bend = rounded(clamp(agent.bend - 0.11, -0.55, 0.55));
  } else if (role === 'opened') {
    next.aperture = rounded(clamp(agent.aperture + 0.18 + intensity * 0.04, 0.08, 0.92));
    next.width = rounded(agent.width * 1.08);
    next.angle = rounded(agent.angle + (revision % 2 ? 8 : -8));
  } else if (role === 'echoed') {
    next.x = rounded(agent.x + (agent.index % 2 ? -18 : 18));
    next.y = rounded(agent.y + (revision % 2 ? 12 : -12));
    next.angle = rounded(agent.angle + (agent.index % 2 ? -13 : 13));
    next.bend = rounded(clamp(agent.bend + 0.17, -0.6, 0.6));
  }
  return next;
}

export function departGaze(field) {
  if (!field.lastGaze) return { accepted: false, field: clone(field), event: null };
  const next = clone(field);
  const witnessIndex = field.lastGaze.index;
  const intensity = field.lastGaze.intensity;
  const revision = field.revision + 1;
  const forbidden = new Set([witnessIndex]);
  const closedIndex = nextRemote(witnessIndex + 3 + revision * 5, forbidden);
  forbidden.add(closedIndex);
  const openedIndex = nextRemote(witnessIndex + 7 + revision * 4, forbidden);
  forbidden.add(openedIndex);
  const echoedIndex = nextRemote(witnessIndex + 10 + revision * 3, forbidden);
  const event = {
    kind: 'departing-gaze',
    relation: 'non-local',
    witnessIndex,
    closedIndex,
    openedIndex,
    echoedIndex,
    intensity,
    revision
  };
  next.revision = revision;
  next.agents = field.agents.map((agent) => {
    if (agent.index === closedIndex) return mutateAgent(agent, 'closed', revision, intensity);
    if (agent.index === openedIndex) return mutateAgent(agent, 'opened', revision, intensity);
    if (agent.index === echoedIndex) return mutateAgent(agent, 'echoed', revision, intensity);
    return { ...agent, pose: 0, gaze: 0, state: agent.index === witnessIndex ? agent.state === 'gazing' ? 'quiet' : agent.state : agent.state === 'gazing' ? 'quiet' : agent.state };
  });
  next.snapshots = [...field.snapshots, clone(field)].slice(-MEMORY_LIMIT);
  next.memory = [...field.memory, event].slice(-MEMORY_LIMIT);
  next.ledger = field.ledger.map((value, index) => rounded(value * 0.76 + (index === closedIndex ? intensity * 0.08 : 0)));
  next.lastGaze = null;
  next.interaction = 'departed / remembered';
  return { accepted: true, field: next, event };
}

export function liftLatest(field) {
  if (!field.snapshots.length) return { ...clone(field), interaction: 'lifted / exact' };
  return { ...clone(field.snapshots.at(-1)), interaction: 'lifted / exact' };
}

export function releaseField() {
  return buildField();
}

export function buildTimeline() {
  let field = buildField();
  const timeline = [field];
  [2, 8, 5, 10].forEach((index, step) => {
    field = departGaze(gazeAt(field, { index, intensity: 0.56 + step * 0.1 })).field;
    timeline.push(field);
  });
  return timeline;
}
