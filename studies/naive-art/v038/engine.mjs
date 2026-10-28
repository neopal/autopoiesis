const SEED = '0x4e413338';
const WITNESS_COUNT = 9;
const MEMORY_WINDOW = 4;
const MIN_DWELL = 0.22;
const MAX_DWELL = 0.92;

const BASE_WITNESSES = [
  { x: 0.17, y: 0.29, scale: 0.92, rotation: -0.22, width: 0.14, height: 0.31, fold: 0.18, tone: 0 },
  { x: 0.35, y: 0.17, scale: 0.78, rotation: 0.16, width: 0.16, height: 0.26, fold: 0.42, tone: 1 },
  { x: 0.61, y: 0.22, scale: 1.06, rotation: 0.31, width: 0.15, height: 0.34, fold: 0.65, tone: 2 },
  { x: 0.81, y: 0.37, scale: 0.74, rotation: -0.34, width: 0.18, height: 0.27, fold: 0.31, tone: 3 },
  { x: 0.72, y: 0.58, scale: 0.98, rotation: 0.08, width: 0.15, height: 0.32, fold: 0.82, tone: 4 },
  { x: 0.50, y: 0.72, scale: 0.87, rotation: -0.12, width: 0.19, height: 0.25, fold: 0.51, tone: 5 },
  { x: 0.27, y: 0.66, scale: 1.05, rotation: 0.28, width: 0.14, height: 0.33, fold: 0.26, tone: 1 },
  { x: 0.11, y: 0.49, scale: 0.76, rotation: -0.42, width: 0.17, height: 0.26, fold: 0.73, tone: 3 },
  { x: 0.45, y: 0.43, scale: 1.18, rotation: 0.04, width: 0.20, height: 0.29, fold: 0.56, tone: 0 }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const round = (value) => Number(value.toFixed(6));

function baselineScene() {
  return {
    witnesses: BASE_WITNESSES.map((witness) => ({
      ...witness,
      role: 'quiet',
      drift: 0,
      aperture: 0,
      echo: 0,
      pressure: 0
    })),
    aperture: { x: 0.49, y: 0.46, scale: 1, lean: 0, depth: 0, signature: 'quiet-aperture' },
    trace: { memoryCount: 0, changedWitnessCount: 0, lastWitness: null, lastMissing: null }
  };
}

export function buildFrame() {
  return {
    seed: SEED,
    grammar: 'witness-absence',
    surface: 'single-cutout-field',
    stage: 0,
    memory: [],
    pending: null,
    interaction: 'idle',
    scene: baselineScene()
  };
}

export function geometrySignature(state) {
  const scene = state.scene;
  return JSON.stringify({
    witnesses: scene.witnesses.map(({ x, y, scale, rotation, width, height, fold, role, drift, aperture, echo, pressure }) => ({
      x: round(x), y: round(y), scale: round(scale), rotation: round(rotation), width: round(width), height: round(height), fold: round(fold), role, drift: round(drift), aperture: round(aperture), echo: round(echo), pressure: round(pressure)
    })),
    aperture: scene.aperture,
    trace: scene.trace
  });
}

export function beginLook(state, { witness } = {}) {
  if (!Number.isInteger(witness) || witness < 0 || witness >= WITNESS_COUNT) {
    return { ...clone(state), pending: null, interaction: 'look-refused-invalid' };
  }
  return { ...clone(state), pending: { witness }, interaction: 'look-armed' };
}

function remoteRoles(witness, stage) {
  let missing = (witness * 3 + stage * 2 + 2) % WITNESS_COUNT;
  if (missing === witness) missing = (missing + 1) % WITNESS_COUNT;
  let echo = (missing + 3 + stage) % WITNESS_COUNT;
  if (echo === witness || echo === missing) echo = (echo + 2) % WITNESS_COUNT;
  let ridge = (echo + 2 + witness) % WITNESS_COUNT;
  if (ridge === witness || ridge === missing || ridge === echo) ridge = (ridge + 1) % WITNESS_COUNT;
  return { missing, echo, ridge };
}

function applyEvent(scene, event) {
  const next = clone(scene);
  const witness = next.witnesses[event.witness];
  const missing = next.witnesses[event.missing];
  const echo = next.witnesses[event.echo];
  const ridge = next.witnesses[event.ridge];
  const force = 0.12 + event.dwell * 0.18;

  witness.role = 'quieted';
  witness.scale = round(witness.scale * (0.93 - event.dwell * 0.03));
  witness.fold = round(witness.fold + 0.08 + event.dwell * 0.12);
  witness.drift = round(witness.drift + force);
  witness.aperture = round(witness.aperture + 0.16 + event.dwell * 0.08);
  witness.pressure = round(witness.pressure + event.dwell);

  missing.role = 'missing-witness';
  missing.x = round(missing.x - 0.018 * (event.stage + 1));
  missing.y = round(missing.y + 0.022 * (event.stage + 1));
  missing.scale = round(missing.scale * (0.78 - event.dwell * 0.05));
  missing.aperture = round(missing.aperture + 0.8);
  missing.drift = round(missing.drift + force * 0.7);

  echo.role = 'false-reconstruction';
  echo.x = round(echo.x + 0.025 * (event.stage + 1));
  echo.y = round(echo.y - 0.017 * (event.stage + 1));
  echo.rotation = round(echo.rotation + 0.14 + event.dwell * 0.08);
  echo.fold = round(echo.fold + 0.21 + event.dwell * 0.1);
  echo.echo = round(echo.echo + 0.9);

  ridge.role = 'remembering-edge';
  ridge.rotation = round(ridge.rotation - 0.06 - event.dwell * 0.05);
  ridge.fold = round(ridge.fold + 0.12);
  ridge.pressure = round(ridge.pressure + event.dwell * 0.65);

  next.aperture.x = round(next.aperture.x + (event.witness - 4) * 0.007);
  next.aperture.y = round(next.aperture.y - 0.012 - event.dwell * 0.01);
  next.aperture.scale = round(next.aperture.scale + 0.04 + event.dwell * 0.03);
  next.aperture.lean = round(next.aperture.lean + (event.witness % 2 ? -0.04 : 0.05));
  next.aperture.depth = round(next.aperture.depth + 0.14 + event.dwell * 0.08);
  next.aperture.signature = `remote-absence-${event.stage}`;
  next.trace = {
    memoryCount: event.stage + 1,
    changedWitnessCount: 4,
    lastWitness: event.witness,
    lastMissing: event.missing
  };
  return next;
}

function replay(events) {
  let scene = baselineScene();
  events.forEach((event) => { scene = applyEvent(scene, event); });
  return {
    seed: SEED,
    grammar: 'witness-absence',
    surface: 'single-cutout-field',
    stage: events.length,
    memory: clone(events),
    pending: null,
    interaction: events.length ? 'look-committed' : 'idle',
    scene
  };
}

export function commitLook(state, { witness, dwell } = {}) {
  const current = clone(state);
  const selected = witness ?? current.pending?.witness;
  const duration = Number(dwell);
  if (!Number.isInteger(selected) || selected < 0 || selected >= WITNESS_COUNT) {
    current.pending = null;
    current.interaction = 'look-refused-invalid';
    return current;
  }
  if (!Number.isFinite(duration) || duration < MIN_DWELL) {
    current.pending = null;
    current.interaction = 'look-refused-short';
    return current;
  }
  const bounded = Math.min(MAX_DWELL, duration);
  const event = {
    kind: 'witness-absence',
    stage: current.memory.length,
    witness: selected,
    ...remoteRoles(selected, current.memory.length),
    dwell: round(bounded)
  };
  const events = [...current.memory, event].slice(-MEMORY_WINDOW);
  const next = replay(events);
  next.interaction = 'look-committed';
  return next;
}

export function liftLatestLook(state) {
  const events = state.memory.slice(0, -1);
  const next = replay(events);
  next.interaction = state.memory.length ? 'look-lifted' : 'idle';
  return next;
}

export function releaseMemory() {
  const next = buildFrame();
  next.interaction = 'memory-released';
  return next;
}

export function buildTimeline() {
  return [
    { witness: 2, dwell: 0.68 },
    { witness: 7, dwell: 0.54 },
    { witness: 4, dwell: 0.79 },
    { witness: 0, dwell: 0.46 }
  ];
}

export {
  MAX_DWELL,
  MIN_DWELL,
  MEMORY_WINDOW,
  SEED,
  WITNESS_COUNT
};
