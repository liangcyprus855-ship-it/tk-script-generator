import { useEffect, useRef, useState } from 'react';
import packageInfo from '../../package.json';
import { request } from './api';
import { AUDIENCE_BY_REGION, DURATION_OPTIONS, FEATURES_BY_REGION, PRODUCT_CATEGORIES, REGION_OPTIONS } from './data/tk-options';
import { durationPriceYuan } from './data/tk-business';
import { TopBar, type UpdateState } from './components/TopBar';
import { RegionLibrary } from './components/RegionLibrary';
import { DurationPanel } from './components/DurationPanel';
import { ProductForm } from './components/ProductForm';
import { ResultPanel } from './components/ResultPanel';
import { GenerateFooter } from './components/GenerateFooter';
import { AccountModal } from './components/AccountModal';
import { RechargeModal } from './components/RechargeModal';
import { HistoryModal } from './components/HistoryModal';
import { UpdateModal } from './components/UpdateModal';
import type { GenerationRecord, GenerationStatus, ProductVisualFacts, ScriptOption, UploadedImage } from './components/types';

type Account = {id: string; email: string; balanceFen: number; balanceYuan: string};

function mergeRecords(...lists: GenerationRecord[][]): GenerationRecord[] {
  const byId = new Map<string, GenerationRecord>();
  for (const list of lists) for (const record of list) {
    const previous = byId.get(record.id);
    byId.set(record.id, previous ? { ...previous, ...record, scripts: record.scripts || previous.scripts } : record);
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 200);
}

async function loadLocalRecords(accountId: string): Promise<GenerationRecord[]> {
  try {
    if (window.tkDesktop?.loadHistory) return (await window.tkDesktop.loadHistory(accountId)) as GenerationRecord[];
    const raw = window.localStorage.getItem(`tk-generation-history:${accountId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function saveLocalRecords(accountId: string, records: GenerationRecord[]) {
  const value = records.slice(0, 200);
  try {
    if (window.tkDesktop?.saveHistory) await window.tkDesktop.saveHistory(accountId, value);
    else window.localStorage.setItem(`tk-generation-history:${accountId}`, JSON.stringify(value));
  } catch { /* 本地索引失败不阻断服务器生成 */ }
}

export default function Workbench(_props: {initialSettings?: any}) {
  const main = Object.keys(PRODUCT_CATEGORIES)[0], sub = Object.keys(PRODUCT_CATEGORIES[main])[0], initialRegion = REGION_OPTIONS[0].id;
  const [form, setForm] = useState({region: initialRegion, mainCategory: main, subCategory: sub, product: PRODUCT_CATEGORIES[main][sub][0], isCustomProduct: false, customProduct: '', targetAudience: AUDIENCE_BY_REGION[initialRegion][0], features: FEATURES_BY_REGION[initialRegion][0]});
  const [duration, setDuration] = useState(DURATION_OPTIONS[2]);
  const [image, setImage] = useState<UploadedImage | null>(null), [facts, setFacts] = useState<ProductVisualFacts | null>(null);
  const [account, setAccount] = useState<Account | null>(null), [token, setToken] = useState('');
  const tokenRef = useRef(''), submitting = useRef(false), epoch = useRef(0), submissionVersion = useRef(0);
  const [records, setRecords] = useState<GenerationRecord[]>([]);
  const [status, setStatus] = useState<GenerationStatus>('idle'), [scripts, setScripts] = useState<ScriptOption[]>([]);
  const [jobId, setJobId] = useState(''), [started, setStarted] = useState(0), [elapsed, setElapsed] = useState(0);
  const [queuePosition, setQueuePosition] = useState(0), [queueAhead, setQueueAhead] = useState(0);
  const [failReason, setFailReason] = useState(''), [refunded, setRefunded] = useState(false), [offline, setOffline] = useState(false);
  const [resultMeta, setResultMeta] = useState({duration, amountYuan: durationPriceYuan(duration)});
  const [accountOpen, setAccountOpen] = useState(false), [rechargeOpen, setRechargeOpen] = useState(false), [historyOpen, setHistoryOpen] = useState(false), [updateOpen, setUpdateOpen] = useState(false);
  const [version, setVersion] = useState(packageInfo.version), [update, setUpdate] = useState<any>({state:'idle'});
  const [notice, setNotice] = useState('');
  const amountYuan = durationPriceYuan(duration);
  function clearSession() {
    epoch.current++; tokenRef.current=''; setToken(''); setAccount(null); setRecords([]); setScripts([]); setJobId(''); setStatus('idle'); setQueuePosition(0); setQueueAhead(0); setFacts(null); submitting.current=false;
    void window.tkDesktop?.clearAuth();
  }
  function handleError(e: any) { if(e.status===401) {clearSession();setAccountOpen(true);setNotice('登录已过期，请重新登录');} }
  async function refreshRecords(auth: string) {
    const data=await request('/api/generations',auth); if(tokenRef.current!==auth)return;
    const remote=(data.records||[]).map((r:any)=>({id:r.id,time:new Date(r.created_at).toLocaleString('sv-SE',{hour12:false}),duration:r.duration,amountYuan:r.amountYuan,status:r.status==='failed'?'failed':'success',region:r.region||'历史记录',product:r.product||'产品信息未记录',scripts:r.content||r.scripts,failReason:r.error}));
    const local=await loadLocalRecords(account?.id || '');
    if(tokenRef.current===auth)setRecords(previous=>mergeRecords(local,remote,previous));
  }
  async function persistJobRecord(job: any, status: 'success'|'failed', userId?: string) {
    const id=userId || job.user?.id || account?.id; if(!id)return;
    const record: GenerationRecord={id:job.jobId,time:new Date(job.createdAt||Date.now()).toLocaleString('sv-SE',{hour12:false}),duration:job.duration,amountYuan:(Number(job.amountFen||0)/100).toFixed(2),status,region:job.region||form.region,product:job.product||((form.isCustomProduct?form.customProduct:form.product).trim()),scripts:job.scripts||undefined,failReason:job.error};
    const local=await loadLocalRecords(id), next=mergeRecords([record],local);
    setRecords(previous=>mergeRecords(next,previous));
    await saveLocalRecords(id,next);
  }
  function applyJob(job:any, auth:string) {
    if(tokenRef.current!==auth || job.status==='none')return;
    if(job.user)setAccount(job.user);
    if(job.duration)setResultMeta({duration:job.duration,amountYuan:(job.amountFen/100).toFixed(2)});
    if(job.status==='queued' || job.status==='running') {setJobId(job.jobId);setStatus('generating');setQueuePosition(Number(job.queuePosition||0));setQueueAhead(Number(job.queueAhead||0));if(job.createdAt)setStarted(new Date(job.createdAt).getTime());return;}
    setJobId('');
    setQueuePosition(0);setQueueAhead(0);
    if(job.status==='succeeded') {setStatus('success');setScripts(job.scripts||[]);setFailReason('');setFacts(job.visualFacts||null);void persistJobRecord(job,'success');}
    if(job.status==='failed') {setStatus('failed');setRefunded(true);setFailReason(job.error||'生成失败，费用已退回');void persistJobRecord(job,'failed');}
    void refreshRecords(auth).catch(()=>{});
  }
  useEffect(()=>{let alive=true;const current=epoch.current;
    window.tkDesktop?.loadAuth().then(saved=>{if(alive && current===epoch.current && saved?.cloudToken){tokenRef.current=saved.cloudToken;setToken(saved.cloudToken);}}).catch(()=>setNotice('暂时无法读取登录信息，请重新登录'));
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    if(!token)return;let alive=true, busy=false;let needLatest=true;
    const sync=async()=>{if(busy)return;busy=true;try{
      const me=await request('/api/account/me',token);if(!alive||tokenRef.current!==token)return;setAccount(me.user);setOffline(false);
      if(needLatest && !submitting.current){const captured=submissionVersion.current;const job=await request('/api/generation-jobs/latest',token);if(!alive)return;if(!submitting.current && captured===submissionVersion.current)applyJob(job,token);needLatest=false;await refreshRecords(token);}
    }catch(e:any){if(alive){setOffline(true);handleError(e);}}finally{busy=false;}};
    void sync();const timer=setInterval(sync,5000);return()=>{alive=false;clearInterval(timer);};
  },[token]);
  useEffect(()=>{if(!account?.id)return;let alive=true;void loadLocalRecords(account.id).then(local=>{if(alive)setRecords(previous=>mergeRecords(local,previous));});return()=>{alive=false;};},[account?.id]);
  useEffect(()=>{
    if(!jobId||!token)return;let alive=true;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{const job=await request('/api/generation-jobs/'+jobId,token);if(!alive)return;setOffline(false);applyJob(job,token);if(job.status!=='running'&&job.status!=='queued')return;}catch(e:any){if(!alive)return;setOffline(true);handleError(e);if(e.status===401)return;}if(alive)timer=setTimeout(poll,2000);};
    void poll();return()=>{alive=false;clearTimeout(timer);};
  },[jobId,token]);
  useEffect(()=>{if(status!=='generating')return;const timer=setInterval(()=>setElapsed(Math.max(0,Math.floor((Date.now()-started)/1000))),500);return()=>clearInterval(timer);},[status,started]);
  useEffect(()=>{const desktop=window.tkDesktop;if(!desktop)return;let alive=true;
    desktop.getVersion().then(v=>{if(alive)setVersion(v);}).catch(()=>{});
    const receive=(p:any)=>{if(alive)setUpdate((old:any)=>({...old,...p}));};
    const off=desktop.onUpdateStatus(receive);desktop.getUpdateState().then(receive).catch(()=>{});
    return()=>{alive=false;off();};
  },[]);
  async function authenticate(email:string,password:string,code?:string):Promise<string|null>{try{
    if(code!==undefined)await request('/api/account/register','',{email,password,verificationCode:code});
    const data=await request('/api/account/login','',{email,password});
    epoch.current++;tokenRef.current=data.token;setAccount(data.user);setToken(data.token);setNotice('');
    try{await window.tkDesktop?.saveAuth({localToken:'',cloudToken:data.token});}catch{setNotice('登录成功，但无法保存自动登录信息');}return null;
  }catch(e:any){return e.message;}}
  async function startGeneration(){
    if(!account||!token||status==='generating'||submitting.current)return;
    if(account.balanceFen<Math.round(Number(amountYuan)*100)){setRechargeOpen(true);return;}
    const product=(form.isCustomProduct?form.customProduct:form.product).trim();if(!product){setNotice('请填写产品名称');return;}
    const auth=token, payload={requestId:crypto.randomUUID(),region:form.region,product,targetAudience:form.targetAudience,features:form.features,duration,...(image?{image:image.dataUrl}:{})};
    submissionVersion.current++;submitting.current=true;setStatus('generating');setStarted(Date.now());setElapsed(0);setFailReason('');setRefunded(false);setScripts([]);setNotice('');setResultMeta({duration,amountYuan});
    try{let job;try{job=await request('/api/generate',auth,payload);}catch(e:any){if(e.status!==0)throw e;job=await request('/api/generate',auth,payload);}applyJob(job,auth);
    }catch(e:any){if(tokenRef.current!==auth)return;if(e.status===401){handleError(e);return;}setStatus('failed');setFailReason(e.message);
      try{const latest=await request('/api/generation-jobs/latest',auth);if(latest.requestId===payload.requestId||latest.status==='running'||latest.status==='queued')applyJob(latest,auth);const me=await request('/api/account/me',auth);if(tokenRef.current===auth)setAccount(me.user);}catch{}
    }finally{submitting.current=false;}
  }
  async function runUpdate(){const desktop=window.tkDesktop;if(!desktop)return;const current=update.state;
    setUpdate((p:any)=>({...p,state:current==='available'?'downloading':current==='downloaded'?'downloaded':'checking',message:'正在处理更新…'}));
    try{if(current==='available')await desktop.downloadUpdate();else if(current==='downloaded')await desktop.installUpdate();else await desktop.checkForUpdates();}catch(e:any){setUpdate((p:any)=>({...p,state:'error',message:e.message||'更新失败，请重试'}));}}
  const updateState:UpdateState=({current:'idle',dev:'idle',error:'failed'} as Record<string,UpdateState>)[update.state]||update.state;
  return <main><div className="dashboard">
    <TopBar version={'V'+version} latestVersion={update.version?'V'+update.version:''} updateState={updateState} onUpdate={()=>setUpdateOpen(true)} account={account} onOpenAccount={()=>setAccountOpen(true)} onOpenHistory={()=>{setHistoryOpen(true);if(token)void refreshRecords(token).catch(e=>setNotice(e.message));}} />
    {notice&&<div role="alert" className="error-text">{notice}</div>}
    <div className="config-grid"><section className="main-setup">
      <RegionLibrary value={form.region} onChange={region=>setForm(p=>({...p,region,targetAudience:AUDIENCE_BY_REGION[region][0],features:FEATURES_BY_REGION[region][0]}))}/>
      <DurationPanel value={duration} onChange={setDuration}/>
      <ProductForm {...form} image={image} facts={facts} onChange={patch=>setForm(p=>({...p,...patch}))} onImageChange={v=>{setImage(v);setFacts(null);}} onFactsChange={setFacts}/>
    </section><aside className="sidebar-config">
      <ResultPanel status={status} scripts={scripts} elapsed={elapsed} queuePosition={queuePosition} queueAhead={queueAhead} failReason={failReason} refunded={refunded} offline={offline} duration={resultMeta.duration} amountYuan={resultMeta.amountYuan} onRetry={startGeneration}/>
      <GenerateFooter amountYuan={amountYuan} balanceYuan={account?.balanceYuan||'0.00'} loggedIn={!!account} status={status} elapsed={elapsed} queuePosition={queuePosition} onGenerate={startGeneration} onOpenRecharge={()=>setRechargeOpen(true)}/>
    </aside></div>
  </div>
  {accountOpen&&<AccountModal account={account} records={records} onLogin={authenticate} onRegister={authenticate} onSendCode={async email=>{await request('/api/account/send-code','',{email});}} onLogout={()=>{const auth=token;clearSession();setAccountOpen(false);void request('/api/account/logout',auth,{}).catch(()=>{});}} onOpenRecharge={()=>{setAccountOpen(false);setRechargeOpen(true);}} onOpenHistory={()=>{setAccountOpen(false);setHistoryOpen(true);}} onClose={()=>setAccountOpen(false)}/>}
  {rechargeOpen&&account&&<RechargeModal token={token} onClose={()=>setRechargeOpen(false)}/>}
  {historyOpen&&<HistoryModal records={records} onClose={()=>setHistoryOpen(false)}/>}
  {updateOpen&&<UpdateModal version={'V'+version} latestVersion={update.version?'V'+update.version:'暂无新版本'} updateLog={[update.releaseNotes,update.message,update.percent!==undefined?`下载进度 ${update.percent}%`:''].filter(Boolean).join('\n')||'暂无更新日志'} state={updateState} onUpdate={runUpdate} onClose={()=>setUpdateOpen(false)}/>}
  </main>;
}
