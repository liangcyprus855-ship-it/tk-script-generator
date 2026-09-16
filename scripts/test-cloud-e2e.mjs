// Run on LA-02 with its .env; creates and removes only its own disposable account.
import pg from 'pg';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const pool=new pg.Pool();
const id=crypto.randomUUID(),email=`acceptance-${id}@example.invalid`,password=crypto.randomBytes(24).toString('hex');
const salt=crypto.randomUUID(),hash=`${salt}:${crypto.pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`;
const base='https://107-173-144-109.nip.io:8443';
let token,jobId;
const request=async(path,body)=>{
  const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  return {status:r.status,data:await r.json()};
};
try {
  await pool.query('INSERT INTO accounts(id,email,password_hash,credits,balance_fen,created_at,membership) VALUES($1,$2,$3,0,60,now(),$4)',[id,email,hash,'验收测试']);
  const login=await request('/api/account/login',{email,password}); assert.equal(login.status,200); token=login.data.token;
  const input={requestId:crypto.randomUUID(),region:'美区 (United States)',product:'绿茶泥膜',targetAudience:'居家办公成年人',features:'展示使用方法，不夸大功效',duration:'20-30秒'};
  const started=Date.now();
  const initial=await request('/api/generate',input); assert.equal(initial.status,202,JSON.stringify(initial.data));jobId=initial.data.jobId;
  assert.equal(initial.data.user.balanceFen,0);
  const duplicate=await request('/api/generate',input);assert.equal(duplicate.data.jobId,jobId);
  let job=initial.data;
  while(job.status==='running'&&Date.now()-started<220000){await new Promise(r=>setTimeout(r,2000));job=(await request('/api/generation-jobs/'+jobId)).data;}
  assert.equal(job.status,'succeeded',JSON.stringify({status:job.status,error:job.error}));assert.equal(job.scripts.length,3);assert.equal(job.user.balanceFen,0);
  assert.equal((await request('/api/generate',{...input,requestId:crypto.randomUUID()})).status,402);
  const stored=(await pool.query('SELECT amount_fen,content_json FROM generation_records WHERE account_id=$1',[id])).rows;
  assert.equal(stored.length,1);assert.equal(stored[0].amount_fen,60);assert.deepEqual(JSON.parse(stored[0].content_json),job.scripts);
  const ledger=(await pool.query('SELECT type,amount,balance FROM ledger WHERE account_id=$1',[id])).rows;assert.equal(ledger.length,1);assert.equal(Number(ledger[0].amount),-60);
  assert.equal((await request('/api/billing/refund',{reference:jobId})).status,410);
  assert.equal((await request('/api/generation-jobs/latest')).data.jobId,jobId);
  const records=await request('/api/generations');assert.equal(records.status,200);assert.equal(records.data.records.length,1);
  console.log(JSON.stringify({ok:true,seconds:(Date.now()-started)/1000,model:job.model,scripts:job.scripts.length,amountFen:60,balanceFen:0,ledgerEntries:ledger.length,historyRecords:stored.length,calls:job.calls,timelines:job.scripts.map(s=>s.script.map(x=>x.timestamp))}));
} finally {
  // Do not delete while a real generation is still running.
  if(jobId) { const row=(await pool.query('SELECT status FROM generation_jobs WHERE id=$1',[jobId])).rows[0]; if(row?.status==='running'){await pool.end();throw new Error('Test job still running; retain fixture for investigation');} }
  const c=await pool.connect();
  try { await c.query('BEGIN');for(const table of ['generation_records','generation_jobs','ledger','sessions'])await c.query(`DELETE FROM ${table} WHERE account_id=$1`,[id]);await c.query('DELETE FROM accounts WHERE id=$1',[id]);await c.query('COMMIT'); }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await pool.end();}
}
