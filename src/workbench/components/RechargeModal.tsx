import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { request, API_BASE } from '../api';
import { RECHARGE_MIN_YUAN } from '../data/tk-business';
export function RechargeModal({token,onClose}:{token:string;onClose:()=>void}){
  const [tab,setTab]=useState<'wechat'|'alipay'>('alipay'),[amount,setAmount]=useState('10'),[order,setOrder]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [channels,setChannels]=useState<any>({});const locked=useRef(false);
  useEffect(()=>{request('/api/billing/channels',token).then(d=>setChannels(d.channels||{})).catch(e=>setError(e.message));},[token]);
  const valid=/^\d+(\.\d{1,2})?$/.test(amount)&&Number(amount)>=RECHARGE_MIN_YUAN&&Number(amount)<=10000;
  async function create(){if(locked.current||!valid)return;locked.current=true;setBusy(true);setError('');try{
    const data=await request('/api/billing/orders',token,{provider:tab==='alipay'?'alipay_personal':'wechat_personal',amountFen:Math.round(Number(amount)*100),packageId:'custom'});
    setOrder({...data.order,qrUrl:data.payment.qrUrl});
  }catch(e:any){setError(e.message);}finally{locked.current=false;setBusy(false);}}
  async function submit(){if(locked.current||!order)return;locked.current=true;setBusy(true);setError('');try{
    await request(`/api/billing/orders/${order.id}/submit-proof`,token,{note:'付款备注：'+order.id.slice(-6)});setOrder((p:any)=>({...p,status:'proof_submitted'}));
  }catch(e:any){setError(e.message);}finally{locked.current=false;setBusy(false);}}
  return <Modal title="账户充值" onClose={onClose}>
    <div className="tab-switch">{(['wechat','alipay'] as const).map(c=><button key={c} disabled={busy} className={tab===c?'active':''} onClick={()=>{setTab(c);setOrder(null);setError('');}}>{c==='wechat'?'微信充值':'支付宝充值'}</button>)}</div>
    <div className="field"><label htmlFor="recharge-amount">充值金额（最低 ¥{RECHARGE_MIN_YUAN}）</label><input id="recharge-amount" type="number" min={2} max={10000} step="0.01" value={amount} disabled={!!order||busy} onChange={e=>setAmount(e.target.value)}/>{!valid&&<span className="error-text">请输入 ¥2 至 ¥10000 的金额，最多两位小数</span>}</div>
    {!channels[tab]?.available&&<div className="field-note">{tab==='wechat'?'微信收款码暂未配置，请使用支付宝充值':'正在读取收款配置…'}</div>}
    {error&&<div role="alert" className="error-text">{error}</div>}
    {!order?<button className="btn-dark" disabled={!valid||busy||!channels[tab]?.available} onClick={create}>{busy?'创建订单中…':'生成收款码'}</button>:<>
      <div className="qr-box"><img alt={tab==='wechat'?'微信收款码':'支付宝收款码'} src={order.qrUrl?.startsWith('/')?API_BASE+order.qrUrl:order.qrUrl} style={{width:240,height:260,objectFit:'contain'}}/>
      <div className="pay-status">应付金额 <b>¥{(order.amountFen/100).toFixed(2)}</b></div><div className="order-no">订单号 {order.id}</div><div className="note-box">付款备注请填写订单号后 6 位：<b>{order.id.slice(-6)}</b></div></div>
      {order.status==='proof_submitted'?<div className="ok-text">已提交审核，待管理员确认后到账。余额会自动刷新。</div>:<button className="btn-dark" disabled={busy} onClick={submit}>{busy?'提交中…':'我已付款，提交审核'}</button>}
    </>}
  </Modal>;
}
