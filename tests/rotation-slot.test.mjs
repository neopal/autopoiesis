import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function validCulturalField(referenceOverrides = {}) {
  return {
    schema: 'mutine-cultural-field/v1',
    title: 'Valid cultural field',
    purpose: 'A valid cultural field fixture.',
    practice: {
      cycle: ['observe'],
      antiCopyRules: ['translate'],
      periodRule: 'change'
    },
    references: [{
      id: 'fixture-reference',
      kind: 'fixture',
      title: 'Fixture reference',
      url: 'https://example.com/reference',
      author: 'Fixture Author',
      observedMechanisms: ['mechanism'],
      translation: {
        principle: 'principle',
        candidateCurrents: ['brush'],
        experiments: ['experiment'],
        falsifier: 'falsifier',
        doNotCopy: 'do not copy'
      },
      ...referenceOverrides
    }],
    researchDirections: [{
      id: 'fixture-direction',
      question: 'What changes?',
      preferredCurrents: ['brush']
    }],
    rotation: {
      selection: 'deterministic',
      requiredOutput: ['mechanism'],
      reuseRule: 'invert'
    }
  };
}

test('daily slot helper rotates through all six currents and is idempotent', async () => {
  const { stdout } = await exec('python', ['scripts/daily-studio-slot.py'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, MUTINE_SLOT_NOW: '2026-09-02T12:00:00+02:00' }
  });
  assert.match(stdout, /date=2026-09-02/);
  assert.match(stdout, /current_id=brush/);
  assert.match(stdout, /current_index=4\/6/);
  assert.match(stdout, /existing_work_id=none/);
  assert.match(stdout, /culture_reference_id=p5-brush/);
  assert.match(stdout, /culture_reference_title=/);
});

test('daily slot helper advances to the next missing current when the scheduled slot is occupied', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  await writeFile(worksPath, JSON.stringify({
    works: [
      { id: 'brush-2026-09-21', currentId: 'brush', date: '2026-09-21' },
      { id: 'naive-2026-09-21', currentId: 'naive', date: '2026-09-21' }
    ]
  }));

  try {
    const { stdout } = await exec('python', ['scripts/daily-studio-slot.py'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
        MUTINE_SLOT_TEST_MODE: '1',
        MUTINE_SLOT_WORKS_PATH: worksPath
      }
    });
    assert.match(stdout, /date=2026-09-21/);
    assert.match(stdout, /scheduled_current_id=brush/);
    assert.match(stdout, /current_id=webgpu/);
    assert.match(stdout, /current_index=6\/6/);
    assert.match(stdout, /culture_reference_id=little-critters/);
    assert.match(stdout, /existing_work_id=none/);
    assert.match(stdout, /action=create-and-record/);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper verifies the scheduled work when every current is occupied', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  const currentIds = ['typography', 'portrait', 'svg', 'brush', 'naive', 'webgpu'];
  await writeFile(worksPath, JSON.stringify({
    works: currentIds.map((currentId) => ({
      id: `${currentId}-2026-09-21`, currentId, date: '2026-09-21'
    }))
  }));

  try {
    const { stdout } = await exec('python', ['scripts/daily-studio-slot.py'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
        MUTINE_SLOT_TEST_MODE: '1',
        MUTINE_SLOT_WORKS_PATH: worksPath
      }
    });
    assert.match(stdout, /current_id=brush/);
    assert.match(stdout, /existing_work_id=brush-2026-09-21/);
    assert.match(stdout, /action=verify-only/);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper wraps from webgpu to the first missing current', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  await writeFile(worksPath, JSON.stringify({
    works: [{ id: 'webgpu-2026-09-21', currentId: 'webgpu', date: '2026-09-21' }]
  }));

  try {
    const { stdout } = await exec('python', ['scripts/daily-studio-slot.py'], {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        MUTINE_SLOT_NOW: '2026-09-21T20:00:00+02:00',
        MUTINE_SLOT_TEST_MODE: '1',
        MUTINE_SLOT_WORKS_PATH: worksPath
      }
    });
    assert.match(stdout, /scheduled_current_id=webgpu/);
    assert.match(stdout, /current_id=typography/);
    assert.match(stdout, /current_index=1\/6/);
    assert.match(stdout, /culture_reference_id=p5-brush/);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper fails closed on an invalid works registry', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  await writeFile(worksPath, JSON.stringify({ works: null }));

  try {
    await assert.rejects(
      exec('python', ['scripts/daily-studio-slot.py'], {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
          MUTINE_SLOT_TEST_MODE: '1',
          MUTINE_SLOT_WORKS_PATH: worksPath
        }
      }),
      /invalid works registry/
    );
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper fails closed on incomplete cultural reference metadata', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  const culturePath = join(fixtureDir, 'cultural-field.json');
  await writeFile(worksPath, JSON.stringify({ works: [] }));
  await writeFile(culturePath, JSON.stringify({
    schema: 'mutine-cultural-field/v1',
    practice: {},
    rotation: {},
    references: [{ id: 'broken', title: 'Broken', url: 'https://example.com', author: 'test' }]
  }));

  try {
    await assert.rejects(
      exec('python', ['scripts/daily-studio-slot.py'], {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
          MUTINE_SLOT_TEST_MODE: '1',
          MUTINE_SLOT_WORKS_PATH: worksPath,
          MUTINE_CULTURAL_FIELD_PATH: culturePath
        }
      }),
      /invalid cultural field/
    );
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper fails closed on malformed cultural reference URLs', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  const culturePath = join(fixtureDir, 'cultural-field.json');
  await writeFile(worksPath, JSON.stringify({ works: [] }));
  await writeFile(culturePath, JSON.stringify({
    schema: 'mutine-cultural-field/v1',
    practice: {},
    rotation: {},
    references: [{
      id: 'broken-url',
      title: 'Broken URL',
      url: 'https://',
      author: 'test',
      observedMechanisms: ['mechanism'],
      translation: {
        principle: 'principle',
        candidateCurrents: ['naive-art'],
        experiments: ['experiment'],
        falsifier: 'falsifier',
        doNotCopy: 'do not copy'
      }
    }]
  }));

  try {
    await assert.rejects(
      exec('python', ['scripts/daily-studio-slot.py'], {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
          MUTINE_SLOT_TEST_MODE: '1',
          MUTINE_SLOT_WORKS_PATH: worksPath,
          MUTINE_CULTURAL_FIELD_PATH: culturePath
        }
      }),
      /invalid cultural field/
    );
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper rejects cultural-field overrides outside the repository', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'mutine-slot-external-'));
  const worksPath = join(fixtureDir, 'works.json');
  const culturePath = join(fixtureDir, 'cultural-field.json');
  await writeFile(worksPath, JSON.stringify({ works: [] }));
  await writeFile(culturePath, JSON.stringify(validCulturalField()));

  try {
    await assert.rejects(
      exec('python', ['scripts/daily-studio-slot.py'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
          MUTINE_SLOT_TEST_MODE: '1',
          MUTINE_SLOT_WORKS_PATH: worksPath,
          MUTINE_CULTURAL_FIELD_PATH: culturePath
        }
      }),
      /test override path must remain inside repository root/
    );
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper fails closed on incomplete cultural field objects', async () => {
  const fixtureDir = await mkdtemp(join(repoRoot, '.mutine-slot-'));
  const worksPath = join(fixtureDir, 'works.json');
  const culturePath = join(fixtureDir, 'cultural-field.json');
  const culture = validCulturalField();
  culture.practice = {};
  await writeFile(worksPath, JSON.stringify({ works: [] }));
  await writeFile(culturePath, JSON.stringify(culture));

  try {
    await assert.rejects(
      exec('python', ['scripts/daily-studio-slot.py'], {
        cwd: repoRoot,
        env: {
          ...process.env,
          MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
          MUTINE_SLOT_TEST_MODE: '1',
          MUTINE_SLOT_WORKS_PATH: worksPath,
          MUTINE_CULTURAL_FIELD_PATH: culturePath
        }
      }),
      /invalid cultural field/
    );
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper rejects unsafe cultural reference URL authorities', async () => {
  const invalidUrls = [
    'http://example.com/reference',
    'https://',
    'https://example.com:abc/reference',
    'https://user:pass@example.com/reference',
    'https://example.com\\\\evil/reference',
    ' https://example.com/reference',
    'https://example.com/reference ',
    'https://example .com/reference',
    'https://example.\u00A0com/reference',
    'https://example.\u2003com/reference'
  ];

  for (const [index, url] of invalidUrls.entries()) {
    const fixtureDir = await mkdtemp(join(repoRoot, `.mutine-slot-url-${index}-`));
    const worksPath = join(fixtureDir, 'works.json');
    const culturePath = join(fixtureDir, 'cultural-field.json');
    await writeFile(worksPath, JSON.stringify({ works: [] }));
    await writeFile(culturePath, JSON.stringify(validCulturalField({ url })));

    try {
      await assert.rejects(
        exec('python', ['scripts/daily-studio-slot.py'], {
          cwd: repoRoot,
          env: {
            ...process.env,
            MUTINE_SLOT_NOW: '2026-09-21T12:00:00+02:00',
            MUTINE_SLOT_TEST_MODE: '1',
            MUTINE_SLOT_WORKS_PATH: worksPath,
            MUTINE_CULTURAL_FIELD_PATH: culturePath
          }
        }),
        /invalid cultural field/
      );
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  }
});
