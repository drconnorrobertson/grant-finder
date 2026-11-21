import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/fetch-grants.js';

function response() {
  return { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('grant refresh authorization and failure boundaries', async (t) => {
  const oldSecret = process.env.CRON_SECRET;
  const oldFetch = globalThis.fetch;
  const oldLog = console.log;
  const oldError = console.error;
  let calls = 0;
  console.log = console.error = () => {};
  try {
    globalThis.fetch = async () => { calls++; throw new Error('private upstream diagnostic'); };
    await t.test('missing configuration fails closed without network access', async () => {
      delete process.env.CRON_SECRET;
      const res = response();
      await handler({ method: 'GET', headers: {} }, res);
      assert.equal(res.code, 503);
      assert.equal(res.headers['Cache-Control'], 'no-store');
      assert.equal(calls, 0);
    });
    process.env.CRON_SECRET = 'test-only-secret';
    await t.test('missing and incorrect credentials cannot trigger a refresh', async () => {
      for (const authorization of [undefined, 'Bearer wrong', 'test-only-secret']) {
        const res = response();
        await handler({ method: 'GET', headers: { authorization } }, res);
        assert.equal(res.code, 401);
      }
      assert.equal(calls, 0);
    });
    await t.test('unsupported methods cannot trigger a refresh', async () => {
      const res = response();
      await handler({ method: 'DELETE', headers: { authorization: 'Bearer test-only-secret' } }, res);
      assert.equal(res.code, 405);
      assert.equal(res.headers.Allow, 'GET, POST');
      assert.equal(calls, 0);
    });
    await t.test('authorized refresh reaches upstream but keeps diagnostics private', async () => {
      for (const method of ['GET', 'POST']) {
        const res = response();
        await handler({ method, headers: { authorization: 'Bearer test-only-secret' } }, res);
        assert.equal(res.code, 500);
        assert.equal(res.body.error, 'Grant refresh failed');
        assert.ok(!JSON.stringify(res.body).includes('private upstream diagnostic'));
      }
      assert.equal(calls, 2);
    });
  } finally {
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
    globalThis.fetch = oldFetch;
    console.log = oldLog;
    console.error = oldError;
  }
});
