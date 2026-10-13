const MEMORY_LIMIT = 4;
const BAND_COUNT = 8;
const PRESSURE_THRESHOLD = 0.42;
const PRESSURE_WORDS = ['PRESSURE', 'SETS', 'THE', 'MARGIN', 'ELSEWHERE', 'INTO', 'A NEW', 'WORD'];
const RELIEF_TOKENS = 'yield'.split('');

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function cloneBand(band) {
  return { ...band };
}

function normalizeEvent(event, fallbackSequence = 1) {
  const duration = clamp(Number(event?.duration), 0, 1);
  const sequence = Math.max(1, Math.floor(Number(event?.sequence) || fallbackSequence));
  const intensity = clamp((duration - PRESSURE_THRESHOLD) / (1 - PRESSURE_THRESHOLD));
  const keystoneIndex = ((Math.floor(duration * 997) + sequence * 3) % BAND_COUNT + BAND_COUNT) % BAND_COUNT;
  const reliefIndex = (keystoneIndex + 3 + sequence) % BAND_COUNT;
  return {
    duration: round(duration),
    intensity: round(intensity),
    sequence,
    keystoneIndex,
    reliefIndex,
    token: RELIEF_TOKENS[(sequence - 1) % RELIEF_TOKENS.length]
  };
}

function baseBands() {
  return PRESSURE_WORDS.map((text, index) => ({
    index,
    text,
    x: [-0.38, -0.02, 0.22, -0.31, 0.06, 0.3, -0.18, 0.18][index],
    y: -0.78 + index * 0.22,
    scale: [1.04, 0.76, 0.62, 1.12, 0.94, 0.69, 0.84, 1.16][index],
    tracking: [0.09, -0.03, 0.15, -0.06, 0.12, -0.04, 0.1, -0.08][index],
    slant: [-3, 2, -1, 3, -2, 1, -3, 2][index],
    weight: [600, 420, 700, 520, 650, 460, 580, 720][index],
    relief: 0,
    custody: ''
  }));
}

function applyPressure(bands, event) {
  const local = bands[event.keystoneIndex];
  const relief = bands[event.reliefIndex];
  const force = event.intensity;
  local.tracking = round(local.tracking - (0.1 + force * 0.12));
  local.scale = round(local.scale * (1 - 0.055 * force));
  local.x = round(local.x - (0.035 + force * 0.04));
  local.slant = round(local.slant + 4.5 + force * 3.5);
  local.weight = Math.round(local.weight + 90 + force * 70);
  local.relief = round(local.relief - force);
  local.custody += event.token.toLowerCase();

  relief.tracking = round(relief.tracking + (0.13 + force * 0.15));
  relief.scale = round(relief.scale * (1 + 0.05 * force));
  relief.x = round(relief.x + (0.045 + force * 0.04));
  relief.slant = round(relief.slant - 3.5 - force * 2.5);
  relief.weight = Math.max(260, Math.round(relief.weight - 55 - force * 30));
  relief.relief = round(relief.relief + force);
  relief.custody += event.token;

  bands.forEach((band, index) => {
    if (index === event.keystoneIndex || index === event.reliefIndex) return;
    const distance = Math.min(Math.abs(index - event.keystoneIndex), BAND_COUNT - Math.abs(index - event.keystoneIndex));
    if (distance <= 2) {
      band.y = round(band.y + (index < event.keystoneIndex ? -1 : 1) * (0.012 + force * 0.018));
      band.slant = round(band.slant + (index % 2 ? 1 : -1) * (0.8 + force));
      band.tracking = round(band.tracking + (index < event.keystoneIndex ? -1 : 1) * 0.018 * force);
    }
  });
}

function frameFromMemory(stage, memory, pressureCount = memory.length, lastEvent = 'quiet', refusedCount = 0) {
  const safeMemory = Array.isArray(memory)
    ? memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index + 1))
    : [];
  const bands = baseBands();
  safeMemory.forEach((event) => applyPressure(bands, event));
  const totalIntensity = safeMemory.reduce((sum, event) => sum + event.intensity, 0);
  return {
    composition: 'pressure-loom',
    stage: Number.isFinite(Number(stage)) ? Number(stage) : safeMemory.length,
    bands,
    memory: safeMemory,
    material: {
      lastEvent,
      pressureCount: Math.max(0, Math.floor(Number(pressureCount) || 0)),
      refusedCount: Math.max(0, Math.floor(Number(refusedCount) || 0)),
      pressureTotal: round(totalIntensity),
      threshold: PRESSURE_THRESHOLD,
      custody: safeMemory.map((event) => event.token).join('').slice(-MEMORY_LIMIT)
    }
  };
}

function buildFrame(stage = 0, memory = []) {
  return frameFromMemory(stage, memory, Array.isArray(memory) ? memory.length : 0);
}

function commitPressure(frame, { duration = 0 } = {}) {
  const safeFrame = frame || buildFrame();
  const safeDuration = clamp(duration, 0, 1);
  if (safeDuration < PRESSURE_THRESHOLD) {
    return frameFromMemory(
      safeFrame.stage,
      safeFrame.memory,
      safeFrame.material.pressureCount,
      'refused',
      safeFrame.material.refusedCount + 1
    );
  }
  const sequence = safeFrame.material.pressureCount + 1;
  const event = normalizeEvent({ duration: safeDuration, sequence }, sequence);
  return frameFromMemory(
    safeFrame.stage + 1,
    [...safeFrame.memory, event],
    sequence,
    'pressed',
    safeFrame.material.refusedCount
  );
}

function liftLatestPressure(frame) {
  const safeFrame = frame || buildFrame();
  if (safeFrame.memory.length === 0) return safeFrame;
  return frameFromMemory(
    safeFrame.stage,
    safeFrame.memory.slice(0, -1),
    Math.max(0, safeFrame.material.pressureCount - 1),
    'lifted',
    safeFrame.material.refusedCount
  );
}

function geometrySignature(frame) {
  return JSON.stringify({
    bands: frame.bands.map(({ text, x, y, scale, tracking, slant, weight, relief, custody }) => ({ text, x, y, scale, tracking, slant, weight, relief, custody })),
    memory: frame.memory,
    custody: frame.material.custody
  });
}

export {
  BAND_COUNT,
  MEMORY_LIMIT,
  PRESSURE_THRESHOLD,
  buildFrame,
  commitPressure,
  geometrySignature,
  liftLatestPressure
};
