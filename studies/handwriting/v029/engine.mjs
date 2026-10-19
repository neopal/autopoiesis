const MEMORY_LIMIT = 4;
const TILE_COUNT = 12;
const MIN_DISTINCT_OBSERVED = 4;
const WORDS = [
  'LISTEN', 'OTHER', 'STAY', 'NEAR', 'THE', 'UNHEARD',
  'WORD', 'LEARNS', 'YOUR', 'WEIGHT', 'THEN', 'MOVES'
];
const POSITIONS = [
  [-0.68, -0.34, 1.14, -8], [-0.18, -0.51, 0.78, 5], [0.27, -0.39, 1.32, -4],
  [0.66, -0.18, 0.84, 9], [-0.57, 0.04, 0.92, 3], [-0.05, -0.02, 1.52, -7],
  [0.42, 0.04, 0.9, 6], [-0.74, 0.42, 0.76, -11], [-0.28, 0.37, 1.08, 2],
  [0.18, 0.39, 0.8, -5], [0.58, 0.34, 1.22, 8], [0.76, 0.08, 0.7, -3]
];
const TONES = ['ember', 'chalk', 'acid', 'violet'];

function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
}

function round(value, places = 6) {
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}

function cloneTile(tile) {
  return { ...tile };
}

function baseTiles() {
  return WORDS.map((text, index) => {
    const [x, y, scale, rotation] = POSITIONS[index];
    return {
      index,
      text,
      x,
      y,
      scale,
      rotation,
      weight: [760, 420, 680, 520][index % 4],
      tone: TONES[index % TONES.length],
      cadence: 0,
      silence: false
    };
  });
}

function normalizeEvent(event, fallbackSequence = 1) {
  const attention = Array.isArray(event?.attention)
    ? Array.from({ length: TILE_COUNT }, (_, index) => clamp(event.attention[index], 0, 1))
    : Array(TILE_COUNT).fill(0);
  const sequence = Math.max(1, Math.floor(Number(event?.sequence) || fallbackSequence));
  const speakerIndex = Number.isInteger(event?.speakerIndex) ? event.speakerIndex : 0;
  const silenceIndex = Number.isInteger(event?.silenceIndex) ? event.silenceIndex : 1;
  const relayIndex = Number.isInteger(event?.relayIndex) ? event.relayIndex : 2;
  return {
    sequence,
    attention,
    speakerIndex,
    silenceIndex,
    relayIndex,
    distinctObserved: Math.max(0, Math.floor(Number(event?.distinctObserved) || 0)),
    totalAttention: round(attention.reduce((sum, value) => sum + value, 0))
  };
}

function chooseRoles(attention, sequence) {
  const ranked = attention
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const speakerIndex = ranked[0]?.index ?? 0;
  const silenceIndex = [...ranked]
    .reverse()
    .find((entry) => entry.index !== speakerIndex)?.index ?? ((speakerIndex + 1) % TILE_COUNT);
  let relayIndex = (speakerIndex + 5 + sequence) % TILE_COUNT;
  if (relayIndex === silenceIndex || relayIndex === speakerIndex) relayIndex = (relayIndex + 1) % TILE_COUNT;
  return { speakerIndex, silenceIndex, relayIndex };
}

function applyCensus(tiles, event) {
  const next = tiles.map(cloneTile);
  const speaker = next[event.speakerIndex];
  const silence = next[event.silenceIndex];
  const relay = next[event.relayIndex];
  const speakerText = speaker.text;
  const silenceText = silence.text;
  const relayText = relay.text;
  const force = Math.min(1, 0.22 + event.totalAttention / 8);

  speaker.text = '—';
  speaker.silence = true;
  speaker.scale = round(speaker.scale * (0.88 - force * 0.06));
  speaker.rotation = round(speaker.rotation - (4 + event.sequence * 0.7));
  speaker.weight = Math.max(280, Math.round(speaker.weight - 90));
  speaker.cadence = round(speaker.cadence - force);

  silence.text = speakerText;
  silence.silence = false;
  silence.scale = round(silence.scale * (1.08 + force * 0.1));
  silence.rotation = round(silence.rotation + 7 + event.sequence);
  silence.weight = Math.min(860, Math.round(silence.weight + 80));
  silence.cadence = round(silence.cadence + force);
  silence.x = round(silence.x + 0.035 + force * 0.02);

  relay.text = silenceText;
  relay.silence = false;
  relay.scale = round(relay.scale * (0.96 + force * 0.03));
  relay.rotation = round(relay.rotation - 9 - event.sequence * 0.4);
  relay.cadence = round(relay.cadence + force * 0.5);
  relay.y = round(relay.y + (event.sequence % 2 ? 0.045 : -0.04));

  next.forEach((tile, index) => {
    if (index === event.speakerIndex || index === event.silenceIndex || index === event.relayIndex) return;
    const distance = Math.min(Math.abs(index - event.speakerIndex), TILE_COUNT - Math.abs(index - event.speakerIndex));
    if (distance <= 3) {
      tile.x = round(tile.x + (index < event.speakerIndex ? -1 : 1) * (0.012 + force * 0.012));
      tile.y = round(tile.y + (index % 2 ? 1 : -1) * 0.012 * force);
      tile.cadence = round(tile.cadence + (index % 2 ? 1 : -1) * force * 0.08);
    }
  });

  // Keep the displaced word in the state trace so a later census starts from this body.
  relay.weight = Math.max(280, Math.round(relay.weight + (relayText === speakerText ? 12 : 0)));
  return next;
}

function frameFromMemory(stage, memory, overrides = {}) {
  const safeMemory = Array.isArray(memory)
    ? memory.slice(-MEMORY_LIMIT).map((event, index) => normalizeEvent(event, index + 1))
    : [];
  const tiles = baseTiles();
  safeMemory.forEach((event) => {
    const changed = applyCensus(tiles, event);
    changed.forEach((tile, index) => { tiles[index] = tile; });
  });
  const last = safeMemory.at(-1);
  const attention = Array.isArray(overrides.attention)
    ? overrides.attention.slice(0, TILE_COUNT)
    : Array(TILE_COUNT).fill(0);
  return {
    composition: 'attention-census',
    stage: Number.isFinite(Number(stage)) ? Number(stage) : safeMemory.length,
    tiles,
    memory: safeMemory,
    material: {
      lastEvent: overrides.lastEvent ?? (last ? 'census' : 'quiet'),
      censusCount: Math.max(0, Math.floor(Number(overrides.censusCount ?? last?.sequence ?? 0))),
      refusedCount: Math.max(0, Math.floor(Number(overrides.refusedCount) || 0)),
      observationCount: Math.max(0, Math.floor(Number(overrides.observationCount) || 0)),
      distinctObserved: Math.max(0, Math.floor(Number(overrides.distinctObserved) || 0)),
      attention,
      speakerIndex: overrides.speakerIndex ?? last?.speakerIndex ?? null,
      silenceIndex: overrides.silenceIndex ?? last?.silenceIndex ?? null,
      relayIndex: overrides.relayIndex ?? last?.relayIndex ?? null,
      undoMemory: Array.isArray(overrides.undoMemory) ? overrides.undoMemory : null,
      undoStage: Number.isFinite(Number(overrides.undoStage)) ? Number(overrides.undoStage) : null
    }
  };
}

function buildFrame(stage = 0, memory = []) {
  return frameFromMemory(stage, memory);
}

function observeTile(frame, { index = 0, amount = 0.18 } = {}) {
  const safeFrame = frame || buildFrame();
  const safeIndex = Math.max(0, Math.min(TILE_COUNT - 1, Math.floor(Number(index) || 0)));
  const attention = Array.isArray(safeFrame.material.attention)
    ? safeFrame.material.attention.slice()
    : Array(TILE_COUNT).fill(0);
  const wasUnseen = attention[safeIndex] <= 0;
  attention[safeIndex] = clamp(attention[safeIndex] + clamp(amount, 0.01, 0.45));
  return frameFromMemory(safeFrame.stage, safeFrame.memory, {
    lastEvent: 'observed',
    censusCount: safeFrame.material.censusCount,
    refusedCount: safeFrame.material.refusedCount,
    observationCount: safeFrame.material.observationCount + 1,
    distinctObserved: safeFrame.material.distinctObserved + (wasUnseen ? 1 : 0),
    attention
  });
}

function takeCensus(frame) {
  const safeFrame = frame || buildFrame();
  if (safeFrame.material.distinctObserved < MIN_DISTINCT_OBSERVED) {
    return frameFromMemory(safeFrame.stage, safeFrame.memory, {
      lastEvent: 'refused',
      censusCount: safeFrame.material.censusCount,
      refusedCount: safeFrame.material.refusedCount + 1,
      observationCount: safeFrame.material.observationCount,
      distinctObserved: safeFrame.material.distinctObserved,
      attention: safeFrame.material.attention
    });
  }
  const sequence = safeFrame.material.censusCount + 1;
  const roles = chooseRoles(safeFrame.material.attention, sequence);
  const event = normalizeEvent({
    sequence,
    attention: safeFrame.material.attention,
    distinctObserved: safeFrame.material.distinctObserved,
    ...roles
  }, sequence);
  return frameFromMemory(safeFrame.stage + 1, [...safeFrame.memory, event], {
    lastEvent: 'census',
    censusCount: sequence,
    refusedCount: safeFrame.material.refusedCount,
    speakerIndex: roles.speakerIndex,
    silenceIndex: roles.silenceIndex,
    relayIndex: roles.relayIndex,
    undoMemory: safeFrame.memory,
    undoStage: safeFrame.stage
  });
}

function liftLatestCensus(frame) {
  const safeFrame = frame || buildFrame();
  if (safeFrame.memory.length === 0) return safeFrame;
  const memory = Array.isArray(safeFrame.material.undoMemory)
    ? safeFrame.material.undoMemory
    : safeFrame.memory.slice(0, -1);
  const last = memory.at(-1);
  return frameFromMemory(safeFrame.material.undoStage ?? safeFrame.stage, memory, {
    lastEvent: 'lifted',
    censusCount: last?.sequence ?? 0,
    refusedCount: safeFrame.material.refusedCount,
    attention: Array(TILE_COUNT).fill(0)
  });
}

function releaseCensus() {
  return buildFrame(0, []);
}

function geometrySignature(frame) {
  return JSON.stringify({
    tiles: frame.tiles.map(({ index, text, x, y, scale, rotation, weight, tone, cadence, silence }) => ({ index, text, x, y, scale, rotation, weight, tone, cadence, silence })),
    memory: frame.memory
  });
}

export {
  MEMORY_LIMIT,
  TILE_COUNT,
  MIN_DISTINCT_OBSERVED,
  buildFrame,
  geometrySignature,
  liftLatestCensus,
  observeTile,
  releaseCensus,
  takeCensus
};
