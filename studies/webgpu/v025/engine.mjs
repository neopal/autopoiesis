export const SEED = 0x57473235;
export const STAGES = 13;
export const SECTOR_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const MIN_PRESSURE = 0.18;
export const PRIMITIVE_BUDGET = 42;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clampInt = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const wrap = (value, max) => ((value % max) + max) % max;
const pseudo = (value) => {
  const raw = Math.sin(value * 12.9898 + SEED * 0.0001) * 43758.5453;
  return raw - Math.floor(raw);
};
const round = (value) => Number(value.toFixed(5));
const ringDistance = (a, b) => Math.min(Math.abs(a - b), SECTOR_COUNT - Math.abs(a - b));

const normalizeStrike = (raw = {}, serial = 0) => ({
  id: `strike-${serial}`,
  mode: 'pressure-cure',
  source: raw.source || 'replayed-strike',
  sector: clampInt(raw.sector, 0, SECTOR_COUNT - 1),
  pressure: round(clamp(finite(raw.pressure, 0.5), MIN_PRESSURE, 1)),
  serial
});

const normalizeMemory = (memory = []) => memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeStrike(event, index));

const baseSectors = () => Array.from({ length: SECTOR_COUNT }, (_, id) => {
  const angle = -Math.PI * 0.5 + id * Math.PI * 2 / SECTOR_COUNT;
  return {
    id,
    angle: round(angle),
    radius: round(0.58 + pseudo(id + 11) * 0.08),
    z: round((pseudo(id + 29) - 0.5) * 0.14),
    width: round(0.22 + pseudo(id + 41) * 0.055),
    height: round(0.72 + pseudo(id + 53) * 0.14),
    twist: 0,
    shear: 0,
    lift: 0,
    vacancy: 0,
    thickness: round(0.12 + pseudo(id + 67) * 0.045),
    density: round(0.48 + pseudo(id + 79) * 0.42),
    vertices: []
  };
});

const buildVertices = (sector) => {
  const angle = sector.angle + sector.twist * 0.18;
  const inner = sector.radius - 0.17 + sector.vacancy * 0.035;
  const outer = sector.radius + 0.17 - sector.vacancy * 0.06;
  const halfWidth = sector.width * (1 - sector.vacancy * 0.22);
  const bottom = -sector.height * 0.5 + sector.lift * 0.18;
  const top = sector.height * 0.5 + sector.lift * 0.62;
  const skew = sector.shear * 0.22;
  const point = (radius, side, z) => ({
    x: round(Math.cos(angle + side * halfWidth) * radius + skew * (z - bottom)),
    y: round(Math.sin(angle + side * halfWidth) * radius + sector.shear * 0.08 * (radius - sector.radius)),
    z: round(sector.z + z + sector.shear * 0.11 * (radius - sector.radius))
  });
  return [point(inner, -1, bottom), point(outer, -1, bottom), point(outer, 1, top), point(inner, 1, top)];
};

const buildChamber = (memory) => {
  const sectors = baseSectors();
  let residue = 0;
  const routeHistory = [];

  normalizeMemory(memory).forEach((event, serial) => {
    const target = wrap(event.sector + Math.floor(residue * 2.4) + serial * 2, SECTOR_COUNT);
    const remote = wrap(target + 5 + serial * 2, SECTOR_COUNT);
    const amount = 0.2 + event.pressure * 0.72;
    const direction = serial % 2 === 0 ? 1 : -1;

    sectors.forEach((sector, index) => {
      const local = clamp(1 - ringDistance(index, target) / 3.1, 0, 1);
      const remoteWeight = clamp(1 - ringDistance(index, remote) / 2.2, 0, 1);
      if (local > 0) {
        sector.shear = round(sector.shear + direction * local * amount * 0.42);
        sector.twist = round(sector.twist + direction * local * (0.08 + amount * 0.21));
        sector.lift = round(sector.lift + local * amount * 0.26);
        sector.density = round(clamp(sector.density + local * amount * 0.12, 0.18, 1));
        sector.thickness = round(sector.thickness + local * amount * 0.035);
      }
      if (remoteWeight > 0) {
        sector.vacancy = round(clamp(sector.vacancy + remoteWeight * amount * 0.68, 0, 1));
        sector.shear = round(sector.shear - remoteWeight * direction * amount * 0.11);
        sector.height = round(sector.height - remoteWeight * amount * 0.08);
      }
      const downstream = index > target ? clamp(1 - (index - target) / (SECTOR_COUNT - target + 1), 0, 1) : 0;
      sector.z = round(sector.z + downstream * direction * amount * 0.045);
    });

    routeHistory.push(`${event.sector}>${target}>${remote}>${event.pressure}`);
    residue = round(residue + 0.27 + amount * 0.93 + target * 0.019);
  });

  sectors.forEach((sector) => { sector.vertices = buildVertices(sector); });
  const route = routeHistory.join('|') || 'quiet';
  const signature = JSON.stringify({
    route,
    residue: round(residue),
    sectors: sectors.map((sector) => [
      sector.id,
      sector.angle,
      sector.radius,
      sector.z,
      sector.width,
      sector.height,
      sector.twist,
      sector.shear,
      sector.lift,
      sector.vacancy,
      sector.thickness,
      sector.density,
      sector.vertices
    ])
  });
  return { sectors, route, residue, signature };
};

export const buildFrame = (stage = 0, memory = [], armed = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: clampInt(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    armed: armed ? { sector: clampInt(armed.sector, 0, SECTOR_COUNT - 1), startedAt: finite(armed.startedAt, 0) } : null,
    lastAction,
    chamber: buildChamber(normalizedMemory)
  };
};

const AUTO_STRIKES = [
  { sector: 2, pressure: 0.74 },
  { sector: 9, pressure: 0.51 },
  { sector: 5, pressure: 0.92 },
  { sector: 10, pressure: 0.64 }
];

export const buildTimeline = (limit = STAGES) => Array.from({ length: limit }, (_, stage) => {
  const count = Math.min(MEMORY_LIMIT, Math.floor((stage + 1) / 3));
  const memory = AUTO_STRIKES.slice(0, count).map((strike, serial) => normalizeStrike(strike, serial));
  return buildFrame(stage, memory, null, stage === 0 ? 'quiet' : 'settled-preview');
});

export const armStrike = (frame, sector, startedAt = 0) => ({
  ...frame,
  armed: { sector: clampInt(sector, 0, SECTOR_COUNT - 1), startedAt: finite(startedAt, 0) },
  lastAction: 'strike-armed'
});

export const commitStrike = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, lastAction: 'memory-limit' };
  const pressure = finite(input.pressure, 0);
  if (pressure < MIN_PRESSURE) return { ...frame, lastAction: 'strike-too-light' };
  const event = normalizeStrike({
    sector: input.sector ?? frame.armed?.sector ?? 0,
    pressure,
    source: 'visitor-pressure'
  }, frame.memory.length);
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'strike-committed');
};

export const liftLatestStrike = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'strike-lifted');
export const releaseCrown = () => buildFrame(0, [], null, 'crown-released');
export const defaultStrike = () => ({ ...AUTO_STRIKES[0] });
export const geometrySignature = (frame) => JSON.stringify({ chamber: frame.chamber.signature, sectors: frame.chamber.sectors });
