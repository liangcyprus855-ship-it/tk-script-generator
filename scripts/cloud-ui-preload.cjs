// Isolated UI acceptance fixture. Never used by the shipped Electron app.
const result = { balance: 0, posts: [], job: null, calls: [] };
window.__cloudTest = result;
const user = () => ({id:'acceptance',email:'acceptance@example.test',balanceFen:result.balance,balanceYuan:(result.balance/100).toFixed(2)});
window.tkDesktop = {
  loadAuth: async()=>({cloudToken:'acceptance-token'}), saveAuth:async()=>{}, clearAuth:async()=>{},
  loadSettings:async()=>{throw new Error('Commercial client must not load model keys');},
  saveSettings:async()=>{throw new Error('Commercial client must not save model keys');},
  getVersion:async()=> '1.0.17', getUpdateState:async()=>({state:'idle'}), onUpdateStatus:cb=>{result.update=cb;return()=>{};},
  downloadUpdate:async()=>{result.downloads=(result.downloads||0)+1;result.update({state:'downloading',percent:35});},
  checkForUpdates:async()=>{},installUpdate:async()=>{},
};
window.fetch = async (url, options={}) => {
  const parsed=new URL(url, location.href), pathname=parsed.pathname;
  result.calls.push({url:String(url),method:options.method||'GET'});
  let value;
  if (pathname==='/api/account/me') value={user:user()};
  else if (pathname==='/api/generations') value={records:result.job?.status==='succeeded'?[{id:'history',duration:'20-30秒',amountYuan:'0.60',content:result.job.scripts,created_at:new Date().toISOString(),region:'美区',product:'测试产品'}]:[]};
  else if (pathname==='/api/billing/channels') value={channels:{alipay:{available:true},wechat:{available:false}}};
  else if (pathname==='/api/billing/orders') value={order:{id:'test-order123456',amountFen:1000,status:'pending'},payment:{qrUrl:'/payment/alipay-personal.jpg'}};
  else if (pathname.endsWith('/submit-proof')) {result.proofs=(result.proofs||0)+1;value={ok:true};}
  else if (pathname==='/api/generation-jobs/latest') value=result.job||{status:'none'};
  else if (pathname==='/api/generate' && options.method==='POST') {
    result.posts.push(JSON.parse(options.body)); result.balance-=60;
    result.job={jobId:'test-job',status:'running',duration:'20-30秒',createdAt:new Date().toISOString(),amountFen:60,user:user()}; value=result.job;
  } else if(pathname==='/api/generation-jobs/test-job') value=result.job;
  else throw new Error('Unexpected endpoint: '+pathname);
  return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
};
