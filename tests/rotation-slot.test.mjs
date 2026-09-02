import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
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
