import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Brush v001 exposes the status target used by its mode controls', async () => {
  const index = await read('studies/p5-brush/v001/index.html');
  const sketch = await read('studies/p5-brush/v001/sketch.js');

  assert.match(sketch, /querySelector\('#state'\)/);
  assert.match(index, /id=["']state["']/);
});

test('retired vote endpoint is explicit instead of disappearing as a 404', async () => {
  const source = await read('api/vote.js');

  assert.match(source, /status\(410\)/);
  assert.doesNotMatch(source, /KV_REST_API_(URL|TOKEN)/);
  assert.match(source, /Voting is retired/);
});

test('retired vote endpoint returns HTTP 410 at runtime', async () => {
  const { default: handler } = await import('../api/vote.js');
  let statusCode;
  let payload;
  const response = {
    status(code) {
      statusCode = code;
      return {
        json(value) {
          payload = value;
        }
      };
    }
  };

  await handler({}, response);

  assert.equal(statusCode, 410);
  assert.deepEqual(payload, {
    message: 'Voting is retired; the Journal and critique are the canonical record.'
  });
});

test('active surfaces do not depend on remote font imports', async () => {
  const paths = [
    'studio/studio.css',
    'studio/work.css',
    'studies/p5-brush/v001/style.css',
    'studies/handwriting/v001/style.css',
    'studies/handwriting/v002/style.css'
  ];

  for (const path of paths) {
    assert.doesNotMatch(await read(path), /fonts\.(?:googleapis|gstatic)\.com/);
  }
});
