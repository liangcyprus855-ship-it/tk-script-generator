import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startServer } from '../server';

test('commercial desktop serves UI but cannot use a local account, model key or money endpoint', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'TK 云端边界 '));
  mkdirSync(path.join(root, 'dist')); writeFileSync(path.join(root, 'dist/index.html'), '<html>cloud client</html>');
  const backend = await startServer({rootDir: root, cloudGenerationOnly: true});
  try {
    assert.equal((await fetch(backend.url + '/api/health')).status, 200);
    assert.equal((await fetch(backend.url)).status, 200);
    for (const endpoint of ['generate', 'generate-one', 'analyze-product-image', 'account/login', 'billing/refund', 'billing/consume']) {
      const response = await fetch(backend.url + '/api/' + endpoint, { method: 'POST', headers: {'content-type':'application/json'}, body:'{}' });
      assert.equal(response.status, 410, endpoint);
      assert.equal((await response.json()).code, 'CLOUD_API_REQUIRED');
    }
  } finally { await backend.close(); rmSync(root, {recursive:true}); }
});
