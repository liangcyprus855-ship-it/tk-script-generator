import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import express from 'express';
import crypto from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { mountWorkbench } from './workbench.mjs';
import { generationService } from './generation.mjs';

test('workbench orders, server history, ownership and logout', async()=>{
  const schema='tk_ui_test_'+crypto.randomBytes(8).toString('hex');
  const root=new pg.Pool(); await root.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({options:`-c search_path=${schema}`});
  const files=mkdtempSync(path.join(tmpdir(),'tk-ui-')); let http;
  try {
    mkdirSync(path.join(files,'payment'));writeFileSync(path.join(files,'payment/alipay-personal.jpg'),'fixture');
    await pool.query(`CREATE TABLE accounts(id TEXT PRIMARY KEY,email TEXT,balance_fen INTEGER);
      CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,account_id TEXT);
      CREATE TABLE orders(id TEXT PRIMARY KEY,account_id TEXT,provider TEXT,package_id TEXT,amount_fen INTEGER,credits INTEGER,status TEXT,created_at TIMESTAMPTZ);
      CREATE TABLE generation_records(id TEXT PRIMARY KEY,account_id TEXT,reference TEXT,duration TEXT,amount_fen INTEGER,content_json TEXT,created_at TIMESTAMPTZ);
      INSERT INTO accounts VALUES('u','user@example.test',123),('other','other@example.test',0)`);
    const hash=crypto.createHash('sha256').update('test-token').digest('hex');
    await pool.query('INSERT INTO sessions VALUES($1,$2)',[hash,'u']);
    await generationService(pool,()=>{}).init();
    await pool.query(`INSERT INTO generation_jobs(id,account_id,request_id,input_hash,status,duration,amount_fen,region,product) VALUES('j','u','r','h','succeeded','10秒',20,'美区','杯子'),('f','u','f','h','failed','15秒',30,'泰区','衣服'),('private','other','p','h','failed','10秒',20,'','')`);
    await pool.query(`INSERT INTO generation_records VALUES('record','u','j','10秒',20,'[{"title":"已生成内容"}]',now())`);
    const app=express();app.use(express.json());
    mountWorkbench(app,pool,async req=>{
      const hash=crypto.createHash('sha256').update(req.get('authorization')?.replace('Bearer ','')||'').digest('hex');
      const row=(await pool.query('SELECT account_id FROM sessions WHERE token_hash=$1',[hash])).rows[0];return row?{id:row.account_id}:null;
    },files);
    http=app.listen(0,'127.0.0.1');await new Promise(r=>http.once('listening',r));
    const base='http://127.0.0.1:'+http.address().port;
    const call=(url,body)=>fetch(base+url,{method:body?'POST':'GET',headers:{authorization:'Bearer test-token','content-type':'application/json'},body:body?JSON.stringify(body):undefined});
    assert.equal((await fetch(base+'/api/generations')).status,401);
    const channels=await (await call('/api/billing/channels')).json();assert.equal(channels.channels.alipay.available,true);assert.equal(channels.channels.wechat.available,false);
    assert.equal((await call('/api/billing/orders',{provider:'alipay_personal',amountFen:199})).status,400);
    assert.equal((await call('/api/billing/orders',{provider:'wechat_personal',amountFen:500})).status,503);
    const order=await (await call('/api/billing/orders',{provider:'alipay_personal',amountFen:505})).json();assert.equal(order.order.amountFen,505);
    assert.equal((await pool.query('SELECT balance_fen FROM accounts WHERE id=$1',['u'])).rows[0].balance_fen,123);
    const records=(await (await call('/api/generations')).json()).records;assert.equal(records.length,2);
    const success=records.find(r=>r.status==='success');assert.equal(success.product,'杯子');assert.equal(success.amountYuan,'0.20');assert.equal(success.content[0].title,'已生成内容');
    assert.equal(records.find(r=>r.status==='failed').amountYuan,'0.30');
    assert.equal((await call('/api/account/logout',{})).status,200);assert.equal((await call('/api/generations')).status,401);
  } finally {
    if(http)await new Promise(r=>{http.close(r);http.closeAllConnections();});
    await pool.end();await root.query(`DROP SCHEMA ${schema} CASCADE`);await root.end();rmSync(files,{recursive:true,force:true});
  }
});
