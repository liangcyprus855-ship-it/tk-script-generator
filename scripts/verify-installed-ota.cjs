const fs = require('node:fs');
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9337/json')).json();
  const page = pages.find(p => p.type === 'page' && p.url.startsWith('http://127.0.0.1:'));
  if (!page) throw new Error('Application renderer not found');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Check timed out')), 60000);
    ws.addEventListener('message', e => {
      const data = JSON.parse(e.data);
      if (data.id === 1) { clearTimeout(timer); resolve(data); }
    });
  });
  ws.send(JSON.stringify({id:1, method:'Runtime.evaluate',params:{awaitPromise:true,returnByValue:true,expression:`(async()=>{ const version=await window.tkDesktop.getVersion(); await window.tkDesktop.checkForUpdates(); await new Promise(r=>setTimeout(r,500)); return {version, updateText: [...document.querySelectorAll('button')].map(b=>b.textContent).filter(t=>/更新/.test(t))}; })()`}}));
  const data = await result;
  fs.writeFileSync('outputs/installed-ota.json', JSON.stringify(data));
  console.log(JSON.stringify(data));
  ws.close();
})().catch(e => { console.error(e.message); process.exitCode=1; });
