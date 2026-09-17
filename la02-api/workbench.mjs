import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
export function mountWorkbench(app,pool,userFrom,root=path.dirname(fileURLToPath(import.meta.url))) {
  const payments=path.join(root,'payment');
  const channels=()=>Object.fromEntries(['alipay','wechat'].map(c=>[c,{available:existsSync(path.join(payments,c+'-personal.jpg')),qrUrl:'/payment/'+c+'-personal.jpg'}]));
  app.get('/payment/:file',(req,res)=>{if(!['alipay-personal.jpg','wechat-personal.jpg'].includes(req.params.file))return res.sendStatus(404);res.sendFile(path.resolve(payments,req.params.file));});
  const route=fn=>async(req,res,next)=>{try{const user=await userFrom(req);if(!user)return res.status(401).json({error:'登录已过期，请重新登录'});await fn(req,res,user,next);}catch(e){console.error('Workbench endpoint failed',e.code||e.name);res.status(503).json({error:'服务暂时不可用，请稍后重试'});}};
  app.get('/api/billing/channels',route(async(_req,res)=>res.json({channels:channels(),minAmountFen:200})));
  app.post('/api/account/logout',route(async(req,res)=>{const token=String(req.get('authorization')||'').replace(/^Bearer\s+/i,'');await pool.query('DELETE FROM sessions WHERE token_hash=$1',[crypto.createHash('sha256').update(token).digest('hex')]);res.json({ok:true});}));
  app.post('/api/billing/orders',route(async(req,res,user,next)=>{
    const provider=req.body?.provider;if(!['alipay_personal','wechat_personal'].includes(provider))return next();
    const channel=provider==='alipay_personal'?'alipay':'wechat',amount=req.body.amountFen;
    if(!Number.isSafeInteger(amount)||amount<200||amount>1000000)return res.status(400).json({error:'充值金额须为 ¥2 至 ¥10000'});
    const config=channels()[channel];if(!config.available)return res.status(503).json({error:'该渠道暂未开通，请选择其他充值方式'});
    const id='RC'+Date.now()+crypto.randomBytes(4).toString('hex');
    await pool.query('INSERT INTO orders(id,account_id,provider,package_id,amount_fen,credits,status,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,now())',[id,user.id,provider,'custom',amount,Math.floor(amount/10),'pending']);
    res.status(201).json({order:{id,amountFen:amount,status:'pending',provider},payment:{mode:'manual',qrUrl:config.qrUrl}});
  }));
  app.get('/api/generations',route(async(_req,res,user)=>{
    const rows=await pool.query(`SELECT r.id,r.reference,r.duration,r.amount_fen,r.content_json,r.created_at,'success' AS status,j.region,j.product,NULL::text AS error FROM generation_records r LEFT JOIN generation_jobs j ON j.id=r.reference AND j.account_id=r.account_id WHERE r.account_id=$1
      UNION ALL SELECT id,id,duration,amount_fen,NULL::text,created_at,'failed',region,product,error FROM generation_jobs WHERE account_id=$1 AND status='failed' ORDER BY created_at DESC LIMIT 100`,[user.id]);
    res.json({records:rows.rows.map(r=>({...r,amountYuan:(r.amount_fen/100).toFixed(2),content:typeof r.content_json==='string'?JSON.parse(r.content_json):r.content_json}))});
  }));
}
