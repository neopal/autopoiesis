import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const proofDir = resolve('research/qa/proofs/naive-art-v025-2026-10-07-production');

test('production probe records every captured PNG in its screenshot count', async () => {
  const result = JSON.parse(await readFile(resolve(proofDir, 'results.json'), 'utf8'));
  const files = await readdir(proofDir);
  const pngCount = files.filter((file) => file.endsWith('.png')).length;
  assert.equal(result.counts.screenshotCount, pngCount);
  if (process.env.MUTINE_EXPECTED_DEPLOYMENT_ID) {
    assert.equal(result.deployment, process.env.MUTINE_EXPECTED_DEPLOYMENT_ID);
  }
});
