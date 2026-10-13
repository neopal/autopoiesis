export const SEED = 0x57473238;
export const STAGES = 9;
export const CAVITY_COUNT = 16;
export const SHELL_COUNT = 6;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 64;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const int = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const round = (value) => Number(value.toFixed(5));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};

const normalizeCavity = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const candidate = Number(value);
  return Number.isFinite(candidate) ? int(candidate, 0, CAVITY_COUNT - 1) : null;
};

const normalizeEvent = (raw = {}, serial = 0) => ({
  id: `absence-${serial}`,
  mode: 'dispatched-absence',
  cavity: normalizeCavity(raw.cavity) ?? 0,
  remote: normalizeCavity(raw.remote) ?? 1,
  layer: int(raw.layer ?? serial, 0, SHELL_COUNT - 1),
  force: round(clamp(finite(raw.force, 0.55), 0.28, 1)),
  serial
});

const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : []).slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const baseCavities = () => Array.from({ length: CAVITY_COUNT }, (_, id) => {
  const column = id % 4;
  const row = Math.floor(id / 4);
  return {
    id,
    x: round(-0.72 + column * 0.48 + (pseudo(id + 11) - 0.5) * 0.08),
    y: round(-0.62 + row * 0.42 + (pseudo(id + 23) - 0.5) * 0.07),
    z: round(-0.24 + pseudo(id + 37) * 0.48),
    width: round(0.12 + pseudo(id + 41) * 0.045),
    height: round(0.075 + pseudo(id + 53) * 0.03),
    opening: round(0.42 + pseudo(id + 67) * 0.2),
    closure: 0,
    bulge: 0,
    depthShift: 0,
    twist: 0
  };
});

const baseShells = () => Array.from({ length: SHELL_COUNT }, (_, id) => ({
  id,
  x: round(-0.73 + (id % 3) * 0.73),
  y: round(-0.7 + Math.floor(id / 3) * 1.4),
  z: round(-0.08 + pseudo(id + 89) * 0.18),
  width: round(0.84 + pseudo(id + 97) * 0.15),
  height: round(0.34 + pseudo(id + 103) * 0.08),
  shift: 0,
  tilt: 0,
  fold: 0
}));

const attentionScores = (memory) => {
  const scores = Array.from({ length: CAVITY_COUNT }, () => 0);
  memory.forEach((event, serial) => {
    scores[event.cavity] += 3 + serial * 0.25;
    scores[event.remote] += 0.5;
    const neighbor = wrap(event.remote + serial + 1, CAVITY_COUNT);
    scores[neighbor] += 0.2;
  });
  return scores;
};

const chooseRemote = (memory, source) => {
  const scores = attentionScores(memory);
  return Array.from({ length: CAVITY_COUNT }, (_, id) => id)
    .filter((id) => id !== source)
    .sort((a, b) => scores[a] - scores[b] || wrap(a - (source + 5), CAVITY_COUNT) - wrap(b - (source + 5), CAVITY_COUNT))[0] ?? wrap(source + 1, CAVITY_COUNT);
};

const buildObject = (memory) => {
  const cavities = baseCavities();
  const shells = baseShells();
  const route = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const force = event.force + serial * 0.07;
    const direction = serial % 2 === 0 ? -1 : 1;
    const source = cavities[event.cavity];
    const remote = cavities[event.remote];
    const sourceNeighbor = cavities[wrap(event.cavity + 1 + serial, CAVITY_COUNT)];
    const shell = shells[event.layer];

    source.closure = round(source.closure + force);
    source.opening = round(Math.max(0.04, source.opening - force * 0.22));
    source.depthShift = round(source.depthShift - force * 0.12);
    source.twist = round(source.twist + direction * force * 0.16);

    remote.bulge = round(remote.bulge + force * 0.82);
    remote.opening = round(Math.min(1.4, remote.opening + force * 0.34));
    remote.depthShift = round(remote.depthShift + force * 0.18);
    remote.twist = round(remote.twist - direction * force * 0.12);

    sourceNeighbor.bulge = round(sourceNeighbor.bulge + force * 0.19);
    sourceNeighbor.depthShift = round(sourceNeighbor.depthShift + direction * force * 0.06);

    shell.shift = round(shell.shift + direction * force * 0.14);
    shell.tilt = round(shell.tilt + direction * force * 0.09);
    shell.fold = round(shell.fold + force * 0.12);
    const echoShell = shells[wrap(event.layer + 2 + serial, SHELL_COUNT)];
    echoShell.shift = round(echoShell.shift - direction * force * 0.06);
    echoShell.fold = round(echoShell.fold + force * 0.06);

    route.push(`${event.cavity}>${event.remote}>${event.layer}>${round(force)}`);
  });

  const signature = JSON.stringify({
    route: route.join('|') || 'quiet',
    cavities: cavities.map((cavity) => [cavity.id, cavity.opening, cavity.closure, cavity.bulge, cavity.depthShift, cavity.twist]),
    shells: shells.map((shell) => [shell.id, shell.shift, shell.tilt, shell.fold])
  });
  return { cavities, shells, route: route.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], armed = null, lastAction = 'quiet') => ({
  stage: int(stage, 0, STAGES - 1),
  memory: normalizeMemory(memory),
  armed: armed && normalizeCavity(armed.cavity) !== null ? {
    cavity: normalizeCavity(armed.cavity),
    startedAt: finite(armed.startedAt, 0)
  } : armed ? { cavity: null, startedAt: finite(armed.startedAt, 0) } : null,
  lastAction,
  field: buildObject(memory)
});

const AUTO_FOCI = [5, 2, 11, 14];

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 2));
  const memory = [];
  for (let serial = 0; serial < count; serial += 1) {
    const cavity = AUTO_FOCI[serial];
    const remote = chooseRemote(memory, cavity);
    memory.push(normalizeEvent({ cavity, remote, layer: cavity % SHELL_COUNT, force: 0.56 + serial * 0.06 }, serial));
  }
  return buildFrame(stage, memory, null, stage === 0 ? 'quiet' : 'settled-preview');
});

export const armFocus = (frame, focus = {}, startedAt = 0) => ({
  ...frame,
  armed: { cavity: normalizeCavity(focus.cavity), startedAt: finite(focus.startedAt, startedAt) },
  lastAction: normalizeCavity(focus.cavity) === null ? 'focus-empty' : 'focus-armed'
});

export const commitAbsence = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  const candidate = frame.armed ?? input;
  const cavity = normalizeCavity(candidate?.cavity);
  if (cavity === null) return { ...frame, lastAction: 'absence-refused-empty' };
  const remote = chooseRemote(frame.memory, cavity);
  const event = normalizeEvent({ cavity, remote, layer: (cavity + frame.memory.length) % SHELL_COUNT, force: 0.56 + (frame.memory.length % 2) * 0.08 }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'absence-committed');
};

export const liftLatestAbsence = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'absence-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');
export const defaultFocus = () => ({ cavity: AUTO_FOCI[0] });
export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, cavities: frame.field.cavities, shells: frame.field.shells });
