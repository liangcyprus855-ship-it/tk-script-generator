// Isolated UI acceptance fixture. Never used by the shipped Electron app.
const result = { balance: 0, posts: [], job: null, calls: [] };
window.__cloudTest = result;
const user = () => ({id:'acceptance',email:'acceptance@example.test',balanceFen:result.balance});
window.tkDesktop = {
  loadAuth: async()=>({cloudToken:'acceptance-token'}), saveAuth:async()=>{}, clearAuth:async()=>{},
  loadSettings:async()=>{throw new Error('Commercial client must not load model keys');},
  saveSettings:async()=>{throw new Error('Commercial client must not save model keys');},
  getVersion:async()=> '1.0.16', getUpdateState:async()=>({state:'idle'}), onUpdateStatus:()=>()=>{},
};
window.fetch = async (url, options={}) => {
  const parsed=new URL(url, location.href), pathname=parsed.pathname;
  result.calls.push({url:String(url),method:options.method||'GET'});
  let value;
  if (pathname==='/api/account/me') value={user:user()};
  else if (pathname==='/api/generations') value={records:[]};
  else if (pathname==='/api/generation-jobs/latest') value=result.job||{status:'none'};
  else if (pathname==='/api/generate' && options.method==='POST') {
    result.posts.push(JSON.parse(options.body)); result.balance-=60;
    result.job={jobId:'test-job',status:'running',amountFen:60,user:user()}; value=result.job;
  } else if(pathname==='/api/generation-jobs/test-job') value=result.job;
  else throw new Error('Unexpected endpoint: '+pathname);
  return new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
};
