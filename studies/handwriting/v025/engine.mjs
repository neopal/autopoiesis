const CLAUSE_COUNT = 12;
const MEMORY_LIMIT = 4;
const BASE_TEXT = [
  'the word waits',
  'under a rule',
  'one voice arrives',
  'without a witness',
  'the margin opens',
  'another word answers',
  'a sentence keeps',
  'what it refused',
  'letters cross',
  'then stay apart',
  'the page listens',
  'before it speaks'
];

const BASE_BLOCKS = Array.from({ length: CLAUSE_COUNT }, (_, index) => ({
  id: index,
  text: BASE_TEXT[index],
  x: 0.12 + (index % 4) * 0.255,
  y: 0.18 + Math.floor(index / 4) * 0.29,
  rotation: [-7, 3, -2, 6, 4, -5, 2, -4, 6, -3, 1, -6][index],
  scale: [1.08, .92, 1.16, .86, .96, 1.12, .9, 1.04, .88, 1.14, .98, 1.06][index],
  weight: [700, 500, 800, 600, 650, 450, 750, 550, 800, 500, 650, 720][index]
}));

function cleanLetter(letter) {
  const value = String(letter ?? '').trim().slice(0, 1);
  return /^[a-z]$/i.test(value) ? value.toLowerCase() : 'e';
}

function cleanClause(clause) {
  const value = Number.isFinite(Number(clause)) ? Math.round(Number(clause)) : 0;
  return Math.max(0, Math.min(CLAUSE_COUNT - 1, value));
}

function cloneBlocks() {
  return BASE_BLOCKS.map((block) => ({ ...block }));
}

function replyFor(event, memoryBefore) {
  const candidate = (event.clause * 5 + event.letter.charCodeAt(0) + memoryBefore * 3 + 2) % CLAUSE_COUNT;
  return candidate === event.clause ? (candidate + 1) % CLAUSE_COUNT : candidate;
}

function applyEvent(blocks, event, memoryBefore) {
  const local = blocks[event.clause];
  const replyIndex = replyFor(event, memoryBefore);
  const reply = blocks[replyIndex];
  const letter = event.letter.toUpperCase();
  const localPosition = (memoryBefore + event.clause) % Math.max(1, local.text.length);
  local.text = `${local.text.slice(0, localPosition)}·${letter}·${local.text.slice(localPosition)}`;
  local.x += 0.012 * (memoryBefore + 1);
  local.y -= 0.018 * (event.clause % 3 + 1);
  local.rotation += 5 + memoryBefore * 1.75;
  local.scale += 0.045;
  local.weight = Math.min(900, local.weight + 35);
  reply.text = `${reply.text} / ${letter.toLowerCase()}`;
  reply.x -= 0.016 * (memoryBefore + 1);
  reply.y += 0.014 * ((replyIndex + event.clause) % 3 + 1);
  reply.rotation -= 4 + memoryBefore;
  reply.scale -= 0.032;
  reply.weight = Math.max(350, reply.weight - 28);

  blocks.forEach((block, index) => {
    if (index === event.clause || index === replyIndex) return;
    const distance = Math.abs(index - event.clause);
    if (distance <= 2) block.y += (index < event.clause ? -1 : 1) * 0.004 * (memoryBefore + 1);
  });
  return replyIndex;
}

function frameFromMemory(stage, memory) {
  const bounded = memory.slice(-MEMORY_LIMIT).map((event) => ({ clause: cleanClause(event.clause), letter: cleanLetter(event.letter) }));
  const blocks = cloneBlocks();
  const applied = [];
  bounded.forEach((event, index) => {
    const replyIndex = applyEvent(blocks, event, index);
    applied.push({ ...event, replyIndex });
  });
  return {
    composition: 'refusal-plate',
    stage: Math.max(0, Number(stage) || 0),
    blocks,
    memory: applied,
    interaction: applied.length ? 'character-committed' : 'sequence',
    material: {
      refusalCount: applied.length,
      replyCount: applied.filter((event) => event.replyIndex !== event.clause).length,
      lastLetter: applied.at(-1)?.letter ?? '',
      grammar: applied.map((event) => event.letter).join('')
    }
  };
}

export function buildFrame(stage = 0, memory = []) {
  return frameFromMemory(stage, Array.isArray(memory) ? memory : []);
}

export function commitCharacter(frame, { clause = 0, letter = 'e' } = {}) {
  const memory = Array.isArray(frame?.memory) ? frame.memory : [];
  const nextMemory = [...memory, { clause: cleanClause(clause), letter: cleanLetter(letter) }].slice(-MEMORY_LIMIT);
  return frameFromMemory(Math.min(14, (Number(frame?.stage) || 0) + 1), nextMemory);
}

export function liftLatestCharacter(frame) {
  const memory = Array.isArray(frame?.memory) ? frame.memory.slice(0, -1) : [];
  return frameFromMemory(Math.max(0, Number(frame?.stage) || 0), memory);
}

export function geometrySignature(frame) {
  return JSON.stringify({
    blocks: frame.blocks.map(({ text, x, y, rotation, scale, weight }) => [text, Number(x.toFixed(6)), Number(y.toFixed(6)), Number(rotation.toFixed(6)), Number(scale.toFixed(6)), weight]),
    grammar: frame.material.grammar
  });
}

export { BASE_TEXT, CLAUSE_COUNT, MEMORY_LIMIT };
