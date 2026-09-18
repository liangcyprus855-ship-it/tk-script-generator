import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import express from 'express';
import crypto from 'node:crypto';
import { generationService, mountGeneration, quoteDuration } from './generation.mjs';

test('server generation: balance gate, concurrency, ownership, idempotency, refund and recovery', async () => {
  const schema = 'tk_gen_test_' + crypto.randomBytes(8).toString('hex');
  const root = new pg.Pool();
  await root.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ options: `-c search_path=${schema}`, max: 8 });
  let http;
  try {
    await pool.query(`CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT,balance_fen INTEGER NOT NULL);
      CREATE TABLE ledger(id TEXT PRIMARY KEY,account_id TEXT,type TEXT,amount INTEGER,balance INTEGER,description TEXT,created_at TIMESTAMPTZ,reference TEXT);
      CREATE TABLE generation_records(id TEXT PRIMARY KEY,account_id TEXT,reference TEXT UNIQUE,duration TEXT,amount_fen INTEGER,content_json TEXT,created_at TIMESTAMPTZ);
      INSERT INTO accounts VALUES('good','good@example.test',60),('empty','empty@example.test',0),('other','other@example.test',100)`);
    let calls = 0, release;
    const generate = async input => {
      calls++;
      await new Promise(resolve => { release = resolve; });
      if (input.features === 'fail') throw new Error('Provider failed');
      return { scripts: [{ title: 'server result' }], model: 'mimo-v2.5', calls: [] };
    };
    const app = express(); app.use(express.json());
    const jobs = await mountGeneration(app, pool, req => {
      const id = req.get('authorization')?.replace('Bearer ', '');
      return ['good', 'empty', 'other'].includes(id) ? { id } : null;
    }, generate);
    http = app.listen(0, '127.0.0.1'); await new Promise(resolve => http.once('listening', resolve));
    const url = `http://127.0.0.1:${http.address().port}`;
    const body = { requestId: crypto.randomUUID(), duration: '20-30秒 · ¥0.60 (标准)', region: '美区', product: '杯子', targetAudience: '成人', features: '便携', model: 'wrong', amountFen: 0 };
    const post = (token, payload = body) => fetch(url + '/api/generate', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    assert.equal((await post('bad')).status, 401);
    assert.equal((await post('empty')).status, 402); assert.equal(calls, 0);
    const responses = await Promise.all([post('good'), post('good')]);
    assert.deepEqual(responses.map(r=>r.status), [202,202]);
    const a = await responses[0].json(), b = await responses[1].json();
    assert.equal(a.jobId, b.jobId); assert.equal(a.user.balanceFen, 0); assert.equal(calls, 1);
    assert.equal((await post('good', { ...body, requestId: crypto.randomUUID() })).status, 402);
    assert.equal((await fetch(url + '/api/generation-jobs/' + a.jobId, { headers: { authorization: 'Bearer other' } })).status, 404);
    release();
    for (let i=0; i<30 && (await jobs.get('good',a.jobId)).status==='running'; i++) await new Promise(r=>setTimeout(r,20));
    assert.equal((await jobs.get('good',a.jobId)).status, 'succeeded');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM ledger WHERE account_id='good'")).rows[0].n, 1);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM generation_records')).rows[0].n, 1);
    assert.equal((await post('good', {...body,requestId:crypto.randomUUID()})).status, 402); assert.equal(calls, 1);
    const f = await (await post('other', {...body, duration:'10秒',features:'fail',requestId:crypto.randomUUID()})).json();
    for (let i=0; i<30 && (await jobs.get('other',f.jobId)).status!=='running'; i++) await new Promise(r=>setTimeout(r,20));
    release();
    for (let i=0; i<30; i++) { const state = (await jobs.get('other',f.jobId)).status; if (state === 'failed' || state === 'succeeded') break; await new Promise(r=>setTimeout(r,20)); }
    const failed = await jobs.get('other', f.jobId); assert.equal(failed.status, 'failed'); assert.equal(failed.user.balanceFen, 100);
    await jobs.finish(f.jobId, null, 'duplicate failure'); assert.equal((await jobs.get('other',f.jobId)).user.balanceFen,100);
    const interrupted = await (await post('other', {...body, duration:'10秒',requestId:crypto.randomUUID()})).json();
    for (let i=0; i<30 && (await jobs.get('other',interrupted.jobId)).status!=='running'; i++) await new Promise(r=>setTimeout(r,20));
    await jobs.recover(true); await jobs.recover(true);
    assert.equal((await jobs.get('other',interrupted.jobId)).user.balanceFen,100);
    release();
    await jobs.drain();
    for (const [duration, price] of [['10秒',20],['15秒',30],['20-30秒',60],['45秒',90],['60秒',120]]) assert.equal(quoteDuration(duration).amountFen, price);
    assert.throws(()=>quoteDuration('1秒'));
  } finally {
    if (http) await new Promise(resolve=>{http.close(resolve); http.closeAllConnections();});
    await pool.end(); await root.query(`DROP SCHEMA ${schema} CASCADE`); await root.end();
  }
});

test('server generation queues jobs in submission order and starts the next job after a slot frees', async () => {
  const schema = 'tk_gen_queue_test_' + crypto.randomBytes(8).toString('hex');
  const root = new pg.Pool();
  const pool = new pg.Pool({ options: `-c search_path=${schema}`, max: 8 });
  const releases = new Map();
  const calls = [];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const waitFor = async (fn, predicate) => {
    for (let i = 0; i < 100; i += 1) {
      const value = await fn();
      if (predicate(value)) return value;
      await wait(10);
    }
    throw new Error('等待队列状态超时');
  };
  let jobs;
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT,balance_fen INTEGER NOT NULL);
      CREATE TABLE ledger(id TEXT PRIMARY KEY,account_id TEXT,type TEXT,amount INTEGER,balance INTEGER,description TEXT,created_at TIMESTAMPTZ,reference TEXT);
      CREATE TABLE generation_records(id TEXT PRIMARY KEY,account_id TEXT,reference TEXT UNIQUE,duration TEXT,amount_fen INTEGER,content_json TEXT,created_at TIMESTAMPTZ);
      INSERT INTO accounts VALUES('a','a@example.test',100),('b','b@example.test',100),('c','c@example.test',100)`);
    const generate = async input => {
      calls.push(input.product);
      await new Promise(resolve => releases.set(input.product, resolve));
      return { scripts: [{ title: input.product }], model: 'mimo-v2.5' };
    };
    jobs = generationService(pool, generate, { maxConcurrency: 1 });
    await jobs.init();
    const submit = (accountId, product) => jobs.submit(accountId, { requestId: crypto.randomUUID(), duration: '10秒', region: '美区', product, targetAudience: '成人', features: '便携' });
    const first = await submit('a', 'first');
    await waitFor(() => jobs.get('a', first.jobId), job => job.status === 'running');
    const second = await submit('b', 'second');
    const secondQueued = await jobs.get('b', second.jobId);
    assert.equal(secondQueued.status, 'queued');
    assert.equal(secondQueued.queuePosition, 1);
    assert.equal(secondQueued.queueAhead, 0);
    const third = await submit('c', 'third');
    const thirdQueued = await jobs.get('c', third.jobId);
    assert.equal(thirdQueued.status, 'queued');
    assert.equal(thirdQueued.queuePosition, 2);
    assert.deepEqual(calls, ['first']);
    releases.get('first')();
    await waitFor(() => jobs.get('b', second.jobId), job => job.status === 'running');
    await waitFor(() => calls.length, count => count === 2);
    assert.deepEqual(calls, ['first', 'second']);
    releases.get('second')();
    await waitFor(() => jobs.get('c', third.jobId), job => job.status === 'running');
    await waitFor(() => calls.length, count => count === 3);
    assert.deepEqual(calls, ['first', 'second', 'third']);
    releases.get('third')();
    await waitFor(() => jobs.get('a', first.jobId), job => job.status === 'succeeded');
    await waitFor(() => jobs.get('b', second.jobId), job => job.status === 'succeeded');
    await waitFor(() => jobs.get('c', third.jobId), job => job.status === 'succeeded');
    await jobs.drain();
    for (const id of ['a', 'b', 'c']) assert.equal((await pool.query('SELECT balance_fen FROM accounts WHERE id=$1', [id])).rows[0].balance_fen, 80);
  } finally {
    for (const release of releases.values()) release();
    if (jobs) await jobs.recover(true);
    await pool.end();
    await root.query(`DROP SCHEMA ${schema} CASCADE`);
    await root.end();
  }
});
