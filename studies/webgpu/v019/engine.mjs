export const SEED = 0x57473231;
export const STAGES = 17;
export const CUBE_COUNT = 16;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 48;

const AUTO_SIGNALS = [0, 1, 2, 3];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clampInt = (value, min, max) => Math.round(clamp(Number.isFinite(Number(value)) ? Number(value) : min, min, max));
const copy = (value) => JSON.parse(JSON.stringify(value));

const baseCubes = () => Array.from({ length: CUBE_COUNT }, (_, id) => {
  const column = id % 4;
  const row = Math.floor(id / 4);
  return {
    id,
    x: Number((-0.48 + column * 0.32).toFixed(5)),
    y: Number((-0.42 + row * 0.28).toFixed(5)),
    z: Number((0.08 + ((id * 7) % 9) * 0.035).toFixed(5)),
    size: Number((0.16 + (id % 3) * 0.018).toFixed(5)),
    phase: Number(((id * 0.37) % (Math.PI * 2)).toFixed(5)),
    tilt: Number(((id % 5 - 2) * 0.02).toFixed(5)),
    seam: 0,
    echo: 0,
    load: 0,
    mode: 'quiet'
  };
});

const normalizeSignal = (signal) => clampInt(signal, 0, 3);
const normalizeEvent = (event = {}, serial = 0) => ({
  id: `broadcast-${serial}`,
  source: event.source || 'replayed-broadcast',
  mode: 'borrowed-phase',
  cue: { signal: normalizeSignal(event.cue?.signal ?? event.signal) },
  serial
});
const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index));

const buildLoom = (memory) => {
  const cubes = baseCubes();
  const transmissions = [];
  const seams = [];
  const echoes = [];
  let phaseDebt = 0;

  memory.forEach((rawEvent, serial) => {
    const event = normalizeEvent(rawEvent, serial);
    const signal = event.cue.signal;
    const sourceId = signal * 4 + ((serial + signal) % 4);
    const echoId = (sourceId + 5 + serial * 2) % CUBE_COUNT;
    const source = cubes[sourceId];
    const echo = cubes[echoId];
    const borrowed = 0.42 + serial * 0.08 + phaseDebt * 0.1;
    const direction = serial % 2 === 0 ? 1 : -1;

    source.phase += direction * borrowed;
    source.tilt += direction * (0.06 + borrowed * 0.04);
    source.z += 0.025 + borrowed * 0.02;
    source.load += borrowed;
    source.mode = 'carrier';
    echo.phase -= direction * borrowed * 0.72;
    echo.x += direction * (0.03 + borrowed * 0.025);
    echo.y -= direction * (0.022 + borrowed * 0.018);
    echo.echo += borrowed;
    echo.load += borrowed * 0.36;
    echo.mode = 'echo';
    phaseDebt += 0.18 + borrowed * 0.11;

    cubes.forEach((cube) => {
      if (cube.id !== source.id && cube.id !== echo.id) {
        cube.phase += (cube.id % 2 ? -1 : 1) * borrowed * 0.012;
        cube.load += borrowed * 0.008;
      }
    });

    transmissions.push({ from: source.id, to: echo.id, signal, phase: Number(borrowed.toFixed(5)), serial });
    seams.push({ cube: source.id, depth: Number((source.z + source.tilt).toFixed(5)), serial });
    echoes.push({ cube: echo.id, x: Number(echo.x.toFixed(5)), y: Number(echo.y.toFixed(5)), serial });
  });

  const signature = JSON.stringify({
    phaseDebt: Number(phaseDebt.toFixed(5)),
    cubes: cubes.map((cube) => [cube.id, Number(cube.x.toFixed(5)), Number(cube.y.toFixed(5)), Number(cube.z.toFixed(5)), Number(cube.phase.toFixed(5)), Number(cube.tilt.toFixed(5)), Number(cube.seam.toFixed(5)), Number(cube.echo.toFixed(5)), Number(cube.load.toFixed(5)), cube.mode])
  });
  return { cubes, transmissions, seams, echoes, phaseDebt: Number(phaseDebt.toFixed(5)), signature };
};

export const buildFrame = (stage = 0, memory = [], armedSignal = 0) => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armedSignal: normalizeSignal(armedSignal),
    loom: buildLoom(normalizedMemory),
    archive: normalizedMemory.map((event, index) => ({ index, id: event.id, mode: event.mode, cue: copy(event.cue) }))
  };
};

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const memory = AUTO_SIGNALS.slice(0, Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 4)))
    .map((signal, index) => ({ signal, source: 'auto-broadcast', index }));
  return buildFrame(stage, memory, stage % 4);
});

export const armSignal = (frame, cue = { signal: 0 }) => ({ ...frame, armedSignal: normalizeSignal(cue.signal) });

export const commitBroadcast = (frame, cue = { signal: frame.armedSignal }) => {
  if (frame.memory.length >= MEMORY_LIMIT) return frame;
  const requested = Number(cue?.signal);
  const signal = Number.isFinite(requested) && requested >= 0 && requested <= 3 ? requested : frame.armedSignal;
  const event = normalizeEvent({ cue: { signal }, source: 'visitor-broadcast' }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], event.cue.signal);
};

export const liftLatestBroadcast = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), frame.armedSignal);
export const releaseLoom = () => buildFrame(0, [], 0);
export const geometrySignature = (frame) => JSON.stringify({ loom: frame.loom.signature, transmissions: frame.loom.transmissions, seams: frame.loom.seams, echoes: frame.loom.echoes });
