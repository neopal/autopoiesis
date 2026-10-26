export const SEED = 0x57473535;
export const STAGES = 9;
export const PANEL_COUNT = 12;
export const MEMORY_LIMIT = 4;
export const PRIMITIVE_BUDGET = 48;
export const MIN_PRESSURE = 120;
export const MAX_PRESSURE = 1400;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value) => Number(value.toFixed(5));
const pseudo = (value) => {
  const raw = Math.sin(value * 17.371 + SEED * 0.000013) * 43758.5453;
  return raw - Math.floor(raw);
};
const integer = (value, min, max) => Math.round(clamp(finite(value, min), min, max));
const panelOffset = (panel, offset) => (panel + offset + PANEL_COUNT) % PANEL_COUNT;
const panelDistance = (a, b) => Math.min(Math.abs(a - b), PANEL_COUNT - Math.abs(a - b));

const normalizeEvent = (event = {}, index = 0) => {
  const interval = clamp(finite(event.interval, 360 + index * 80), MIN_PRESSURE, MAX_PRESSURE);
  const pressure = clamp(finite(event.pressure, (interval - MIN_PRESSURE) / (MAX_PRESSURE - MIN_PRESSURE)), 0.05, 1);
  const sourcePanel = integer(event.sourcePanel ?? (index * 3 + 2), 0, PANEL_COUNT - 1);
  let responsePanel = integer(event.responsePanel ?? panelOffset(sourcePanel, 4 + Math.round(pressure * 3) + index), 0, PANEL_COUNT - 1);
  if (responsePanel === sourcePanel) responsePanel = panelOffset(sourcePanel, 5);
  let splitPanel = integer(event.splitPanel ?? panelOffset(responsePanel, 3 + index), 0, PANEL_COUNT - 1);
  if (splitPanel === sourcePanel || splitPanel === responsePanel) splitPanel = panelOffset(responsePanel, 4);
  return {
    id: `pressure-${index}`,
    mode: 'double-tap-pressure',
    interval: round(interval),
    pressure: round(pressure),
    sourcePanel,
    responsePanel,
    splitPanel,
    serial: index
  };
};
const normalizeMemory = (memory = []) => (Array.isArray(memory) ? memory : [])
  .slice(-MEMORY_LIMIT)
  .map((event, index) => normalizeEvent(event, index));

const basePanels = () => Array.from({ length: PANEL_COUNT }, (_, id) => {
  const t = id / (PANEL_COUNT - 1);
  const jitter = pseudo(id + 11) - 0.5;
  return {
    id,
    depth: round(clamp(0.08 + t * 0.84 + jitter * 0.035, 0.02, 0.98)),
    x: round((t - 0.5) * 0.52 + jitter * 0.07),
    y: round((pseudo(id + 31) - 0.5) * 0.18),
    yaw: round((pseudo(id + 51) - 0.5) * 0.18),
    pitch: round((pseudo(id + 71) - 0.5) * 0.12),
    aperture: round(0.28 + pseudo(id + 91) * 0.22),
    slip: 0,
    tension: round(0.26 + pseudo(id + 111) * 0.58),
    shade: round(0.22 + pseudo(id + 131) * 0.68)
  };
});

const buildField = (memory) => {
  let panels = basePanels();
  const ledger = [];
  normalizeMemory(memory).forEach((event, serial) => {
    const previous = panels.map((panel) => ({ ...panel }));
    panels = previous.map((panel, index) => {
      const sourceDistance = 1 - panelDistance(index, event.sourcePanel) / (PANEL_COUNT * 0.5);
      const responseDistance = 1 - panelDistance(index, event.responsePanel) / (PANEL_COUNT * 0.5);
      const splitDistance = 1 - panelDistance(index, event.splitPanel) / (PANEL_COUNT * 0.5);
      const neighbour = previous[panelOffset(index, index % 2 ? -1 : 1)];
      const pressureWave = (responseDistance - sourceDistance) * event.pressure * 0.055;
      return {
        ...panel,
        depth: round(clamp(panel.depth + pressureWave + (neighbour.depth - panel.depth) * 0.035, 0.02, 0.98)),
        x: round(clamp(panel.x + (responseDistance - sourceDistance) * event.pressure * 0.016, -0.72, 0.72)),
        y: round(clamp(panel.y + (splitDistance - sourceDistance) * event.pressure * 0.012, -0.42, 0.42)),
        yaw: round(panel.yaw + (responseDistance - splitDistance) * event.pressure * 0.045),
        pitch: round(panel.pitch + (sourceDistance - responseDistance) * event.pressure * 0.032),
        aperture: round(clamp(panel.aperture + (responseDistance - sourceDistance) * event.pressure * 0.08, 0.12, 0.94)),
        slip: round(clamp(panel.slip + Math.abs(pressureWave) * 0.8 + splitDistance * event.pressure * 0.006, 0, 0.86)),
        tension: round(clamp(panel.tension + (splitDistance - sourceDistance) * event.pressure * 0.05, 0.08, 0.98))
      };
    });
    panels = panels.map((panel, index) => {
      if (index === event.sourcePanel) return {
        ...panel,
        depth: round(clamp(panel.depth - (0.13 + event.pressure * 0.16), 0.02, 0.98)),
        x: round(panel.x - (0.04 + event.pressure * 0.05)),
        aperture: round(clamp(panel.aperture - (0.05 + event.pressure * 0.035), 0.12, 0.94)),
        slip: round(clamp(panel.slip + 0.08 + event.pressure * 0.09, 0, 0.86))
      };
      if (index === event.responsePanel) return {
        ...panel,
        depth: round(clamp(panel.depth + (0.24 + event.pressure * 0.34), 0.02, 0.98)),
        x: round(panel.x + (0.06 + event.pressure * 0.07)),
        y: round(panel.y - 0.04 - serial * 0.008),
        yaw: round(panel.yaw + 0.12 + event.pressure * 0.1),
        aperture: round(clamp(panel.aperture + 0.34 + event.pressure * 0.25, 0.12, 0.94)),
        slip: round(clamp(panel.slip + 0.24 + event.pressure * 0.22, 0, 0.86)),
        tension: round(clamp(panel.tension + 0.12, 0.08, 0.98))
      };
      if (index === event.splitPanel) return {
        ...panel,
        depth: round(clamp(panel.depth - 0.08 - event.pressure * 0.06, 0.02, 0.98)),
        x: round(panel.x + (serial % 2 ? -0.055 : 0.055)),
        pitch: round(panel.pitch - 0.1 - event.pressure * 0.06),
        aperture: round(clamp(panel.aperture + 0.1, 0.12, 0.94)),
        slip: round(clamp(panel.slip + 0.16 + event.pressure * 0.12, 0, 0.86))
      };
      return panel;
    });
    ledger.push(`${event.sourcePanel}>${event.responsePanel}>${event.splitPanel}:${event.interval.toFixed(1)}`);
  });
  const signature = JSON.stringify({
    ledger: ledger.join('|') || 'quiet',
    panels: panels.map((panel) => [panel.id, panel.depth, panel.x, panel.y, panel.yaw, panel.pitch, panel.aperture, panel.slip, panel.tension])
  });
  return { panels, ledger: ledger.join('|') || 'quiet', signature };
};

export const buildFrame = (stage = 0, memory = [], pressure = null, lastAction = 'quiet') => {
  const normalizedMemory = normalizeMemory(memory);
  return {
    stage: integer(stage, 0, STAGES - 1),
    memory: normalizedMemory,
    pressure: pressure ? {
      armedAt: finite(pressure.armedAt, 0),
      currentAt: finite(pressure.currentAt, pressure.armedAt ?? 0)
    } : null,
    lastAction,
    field: buildField(normalizedMemory)
  };
};

export const primeVault = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, pressure: null, lastAction: 'memory-limit' };
  const at = finite(input.at, 0);
  return { ...frame, pressure: { armedAt: at, currentAt: at }, lastAction: 'pressure-armed' };
};

export const tickVault = (frame, input = {}) => {
  if (!frame.pressure) return frame;
  return {
    ...frame,
    pressure: { ...frame.pressure, currentAt: finite(input.at, frame.pressure.currentAt) },
    lastAction: 'pressure-waiting'
  };
};

export const commitPressure = (frame, input = {}) => {
  if (frame.memory.length >= MEMORY_LIMIT) return { ...frame, pressure: null, lastAction: 'memory-limit' };
  if (!frame.pressure) return { ...frame, lastAction: 'pressure-refused-no-arm' };
  const committedAt = finite(input.committedAt, frame.pressure.currentAt);
  const interval = committedAt - frame.pressure.armedAt;
  if (interval < MIN_PRESSURE || interval > MAX_PRESSURE) return { ...frame, pressure: null, lastAction: 'pressure-refused-bounds' };
  const pressure = (interval - MIN_PRESSURE) / (MAX_PRESSURE - MIN_PRESSURE);
  const sourcePanel = frame.memory.length * 3 + 2;
  const event = { mode: 'double-tap-pressure', interval, pressure, sourcePanel };
  return buildFrame(Math.min(STAGES - 1, frame.stage + 1), [...frame.memory, event], null, 'pressure-committed');
};

export const liftLatestPressure = (frame) => buildFrame(Math.max(0, frame.stage - 1), frame.memory.slice(0, -1), null, 'pressure-lifted');
export const releaseArchive = () => buildFrame(0, [], null, 'archive-released');

export const defaultPressure = (frame) => [260, 520, 840, 380][frame.memory.length % 4];

export const buildTimeline = (limit = STAGES) => {
  const timeline = [buildFrame(0, [])];
  let frame = timeline[0];
  for (let stage = 1; stage < limit; stage += 1) {
    if (frame.memory.length < MEMORY_LIMIT) {
      frame = primeVault(frame, { at: 0 });
      frame = commitPressure(frame, { committedAt: defaultPressure(frame) });
    } else {
      frame = buildFrame(stage, frame.memory, null, 'settled-preview');
    }
    timeline.push(buildFrame(stage, frame.memory, null, frame.memory.length ? 'settled-preview' : 'quiet'));
  }
  return timeline;
};

export const geometrySignature = (frame) => JSON.stringify({ field: frame.field.signature, panels: frame.field.panels });
export const panelPoints = () => basePanels().map((panel) => ({ id: panel.id, depth: panel.depth, x: panel.x, y: panel.y }));
