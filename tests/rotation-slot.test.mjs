import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

test('daily slot helper rotates through all six currents and is idempotent', async () => {
  const { stdout } = await exec('python', ['scripts/daily-studio-slot.py'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, MUTINE_SLOT_NOW: '2026-09-02T12:00:00+02:00' }
  });
  assert.match(stdout, /date=2026-09-02/);
  assert.match(stdout, /current_id=brush/);
  assert.match(stdout, /current_index=4\/6/);
  assert.match(stdout, /existing_work_id=none/);
});

test('daily slot helper advances to the next missing current when the scheduled slot is occupied', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'mutine-slot-'));
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
    assert.match(stdout, /existing_work_id=none/);
    assert.match(stdout, /action=create-and-record/);
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper verifies the scheduled work when every current is occupied', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'mutine-slot-'));
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
  const fixtureDir = await mkdtemp(join(tmpdir(), 'mutine-slot-'));
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
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('daily slot helper fails closed on an invalid works registry', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'mutine-slot-'));
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
