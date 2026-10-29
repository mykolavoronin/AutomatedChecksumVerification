import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { hashBlob } from '../src/core.js';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url)).replaceAll(String.fromCharCode(92), '/').replace(/\/+$/, '');
const output = root + '/test-results/browser';
const body = Buffer.from('local browser verification fixture\n');
const hashes = await hashBlob(new Blob([body]), ['sha256', 'sha512', 'sha3256', 'blake3']);
const slowBody = Buffer.alloc(512 * 1024, 0x5a);
const slowHash = (await hashBlob(new Blob([slowBody]), ['sha256'])).sha256;
const alternate = Buffer.from('a different release with the same filename\n');
const alternateHash = (await hashBlob(new Blob([alternate]), ['sha256'])).sha256;
let pendingHits = 0;
const server = createServer((req, res) => {
  if(req.url==='/checksum-index') {res.writeHead(200,{'content-type':'text/html'});res.end('<a href="/nested/SHA256SUMS">Download checksum list</a>');}
  else if(req.url==='/nested/SHA256SUMS') {res.end(`${hashes.sha256} *nested-file.zip`);}
  else if(['/data-a/shared.bin','/data-b/shared.bin'].includes(req.url)) {res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename=shared.bin'});res.end(req.url.includes('data-a')?body:alternate);}
  else if(req.url==='/sum-redirect') { res.writeHead(302,{location:'/sum-final'});res.end(); }
  else if(req.url==='/sum-final') { res.writeHead(200,{'content-type':'text/html'});res.end(`<pre>SHA256 (redirected.zip) = ${hashes.sha256}</pre>`); }
  else if(['/build-a/shared.zip','/build-b/shared.zip'].includes(req.url)) {res.writeHead(200,{'content-type':'application/zip','content-disposition':'attachment; filename=shared.zip'});res.end(req.url.includes('build-a')?body:alternate);}
  else if(req.url==='/frame') { res.writeHead(200,{'content-type':'text/html'});res.end(`<a href="/framed.zip">Frame download</a><pre>SHA256 (framed.zip) = ${hashes.sha256}</pre>`); }
  else if(req.url==='/SHA256SUMS') { res.end(`${hashes.sha256} *list-only.exe`); }
  else if(req.url==='/list-only.exe') { res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="list-only.exe"'});res.end(body); }
  else if (['/slow.exe', '/guessed.exe'].includes(req.url)) {
    let offset = Number(req.headers.range?.match(/bytes=(\d+)-/)?.[1] || 0);
    res.writeHead(offset ? 206 : 200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${req.url.slice(1)}"`, 'accept-ranges': 'bytes', 'content-length': slowBody.length - offset, ...(offset ? { 'content-range': `bytes ${offset}-${slowBody.length-1}/${slowBody.length}` } : {}) });
    const timer = setInterval(() => { const end=Math.min(offset+16384,slowBody.length);res.write(slowBody.subarray(offset,end));offset=end;if(offset===slowBody.length){clearInterval(timer);res.end();} },60);
    res.on('close',()=>clearInterval(timer));
  } else if(req.url==='/guessed.exe.sha256') { res.end(`${slowHash} *guessed.exe`); }
  else if(req.url==='/hidden/jetbrains-toolbox-3.9.0.88839.exe.sha256') { res.end(`${hashes.sha256} *jetbrains-toolbox-3.9.0.88839.exe`); }
  else if(req.url==='/hidden/jetbrains-toolbox-3.9.0.88839.exe') { res.writeHead(200,{'content-type':'application/octet-stream','content-disposition':'attachment; filename="jetbrains-toolbox-3.9.0.88839.exe"'});res.end(body); }
  else if(req.url==='/loading.zip.sha256') { setTimeout(()=>res.end(`${hashes.sha256} *loading.zip`),2000); }
  else if(req.url==='/pending.zip.sha256') {
    pendingHits += 1;
    if (pendingHits < 3) { res.writeHead(200,{'content-type':'text/html'}); res.end('<!doctype html><title>Checksum</title><p>Loading checksum…</p>'); }
    else res.end(`${hashes.sha256} *pending.zip`);
  }
  else if(req.url==='/common') {
    res.writeHead(200,{'content-type':'text/html'});
    res.end(`<!doctype html><title>Common downloads</title><h1>Common downloads</h1>
      <section><a href="/generic.zip">Generic build</a> <a href="/notes.html">Release notes</a>
        <table><tr><th>File</th><th>Checksum</th></tr><tr><td><a href="/generic.zip">generic.zip</a></td><td>${hashes.sha256}</td></tr></table></section>
      <section><a href="/late.zip">Late download</a><p id="late-sum">Loading checksum…</p></section>
      <section><a href="/pending.zip">Pending sidecar</a><a href="/pending.zip.sha256">SHA256</a></section>
      <section><a href="/listed.zip">Listed download</a><dl><dt>SHA-256</dt><dd>${hashes.sha256}</dd></dl></section>
      <p><a id="attr-download" href="/attr.zip">Attribute download</a></p>
      <script>
        setTimeout(()=>{ document.querySelector('#late-sum').textContent = 'SHA-256 (late.zip) = ${hashes.sha256}'; }, 1200);
        setTimeout(()=>{ document.querySelector('#attr-download').dataset.sha256 = '${hashes.sha256}'; }, 800);
      </script>`);
  }
  else if (/^\/(download|bad|conflict|unknown|button|loading|shadow|framed|table|redirected|nested-file|generic|late|pending|listed|attr)\.zip$/.test(req.url)) {
    res.writeHead(200, {'content-type':'application/zip','content-disposition':`attachment; filename="${req.url.slice(1)}"`}); res.end(body);
  } else if(req.url === '/download.zip.sha256') { res.end(hashes.sha256); }
  else if(req.url === '/checksums') {
    res.writeHead(200, {'content-type':'text/html'});
    res.end(`<!doctype html><title>Checksums</title><button id="show">Show BLAKE3</button><script>document.querySelector('#show').onclick=()=>{const p=document.createElement('pre');p.textContent='BLAKE3 (download.zip) = ${hashes.blake3}';document.body.append(p)};</script>`);
  } else {
    res.writeHead(200, {'content-type':'text/html'});
    res.end(`<!doctype html><title>Download fixture</title><h1>Download fixture</h1>
      <section><a href="/download.zip">Download archive</a><a href="/download.zip.sha256">SHA256</a><a href="/checksums">Checksums</a><button id="reveal">Show SHA3-256</button><div id="digest"></div></section>
      <script type="application/json">${JSON.stringify({files:[{filename:'download.zip',sha512:hashes.sha512},{filename:'button.zip',sha256:hashes.sha256}]})}</script>
      <script type="application/json">{"hiddenDownload":"/hidden/jetbrains-toolbox-3.9.0.88839.exe.sha256"}</script>
      <script>document.querySelector('#reveal').onclick=()=>{document.querySelector('#digest').textContent='SHA3-256 (download.zip) = ${hashes.sha3256}'};</script>
      <div id="shadow-host"></div><script>document.querySelector('#shadow-host').attachShadow({mode:'open'}).innerHTML='<section><a href="/shadow.zip">Shadow download</a><p>SHA-256: <span>${hashes.sha256.slice(0,32)}</span><span>${hashes.sha256.slice(32)}</span></p></section>';</script>
      <iframe id="same-origin-frame" src="/frame"></iframe><a href="/list-only.exe">Manifest-only installer</a>
      <table><tr><th>File</th><th>SHA-256 checksum</th><th>SHA-512 checksum</th></tr><tr><td><a href="/table.zip">Table download</a></td><td>${hashes.sha256}</td><td>${hashes.sha512}</td></tr></table>
      <table><tr><th>File</th><th>SHA256</th></tr><tr><td><a href="/build-a/shared.zip">Release A</a></td><td>${hashes.sha256}</td></tr><tr><td><a href="/build-b/shared.zip">Release B</a></td><td>${alternateHash}</td></tr></table>
      <section><a href="/redirected.zip">Redirected checksum download</a><a href="/sum-redirect">View checksums</a></section>
      <section><a href="/nested-file.zip">Nested checksum download</a><a href="/checksum-index">View checksums</a></section>
      <script type="application/json">${JSON.stringify({assets:[{name:'shared.bin',browser_download_url:`http://${req.headers.host}/data-a/shared.bin`,digest:`sha256:${hashes.sha256}`},{name:'shared.bin',browser_download_url:`http://${req.headers.host}/data-b/shared.bin`,digest:`sha256:${alternateHash}`}]})}</script>
      <a href="/data-a/shared.bin">Metadata release A</a><a href="/data-b/shared.bin">Metadata release B</a>
      <section><a href="/bad.zip">Bad download</a><pre>SHA-256 (bad.zip) = ${'f'.repeat(64)}</pre></section>
      <section><a href="/conflict.zip">Conflicting download</a><pre>SHA-256 (conflict.zip) = ${hashes.sha256}\nSHA-256 (conflict.zip) = ${'f'.repeat(64)}</pre></section>
      <a href="/unknown.zip">Unknown download</a><a href="/loading.zip">Delayed checksum download</a><a href="/slow.exe">Slow installer</a><a href="/guessed.exe">Guessed installer</a><button onclick="location.href='/button.zip'">Download with button</button><form><button>Show checksums</button></form><button id="unrelated">Buy now</button>`);
  }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
let context;
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn, message) { for(let i=0;i<120;i++){if(await fn()) return; await wait(250);} throw new Error(message); }
try {
  await mkdir(`${root}/test-results/downloads`,{recursive:true});
  // New unpacked-extension profile per run: reusing one can retain Chrome's
  // installed service-worker script cache even after source files change.
  const profilePath = `${output}/test-profile-${Date.now()}`;
  const launchOptions = {
    executablePath:process.env.CHROMIUM_EXECUTABLE || chromium.executablePath(),headless:true,acceptDownloads:true,
    args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]
  };
  context = await chromium.launchPersistentContext(profilePath,launchOptions);
  let sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const data = () => sw.evaluate(()=>chrome.storage.session.get(null));
  const errors=[];
  const workerWarnings=[];sw.on('console',message=>{if(['warning','error'].includes(message.type()))workerWarnings.push(message.text());});
  const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
  const cdp=await context.newCDPSession(page);
  async function panelNodes() {
    const {root:doc}=await cdp.send('DOM.getDocument',{depth:-1,pierce:true});
    const flatten=node=>[node,...(node.children||[]).flatMap(flatten),...(node.shadowRoots||[]).flatMap(flatten)];
    const host=flatten(doc).find(node=>node.attributes?.includes('checksum-download-panel'));
    return host ? flatten(host) : [];
  }
  const nodeText=node=>(node.nodeValue||'')+(node.children||[]).map(nodeText).join('');
  async function clickPanelButton(label,downloadId) {
    const nodes=await panelNodes();
    const section=downloadId===undefined ? null : nodes.find(node=>node.nodeName==='SECTION'&&node.attributes?.includes(String(downloadId)));
    const flatten=node=>[node,...(node.children||[]).flatMap(flatten)];
    const button=(section?flatten(section):nodes).find(node=>node.nodeName==='BUTTON'&&(node.attributes?.includes(label)||nodeText(node)===label));
    assert.ok(button,`missing panel button ${label}`);
    await cdp.send('DOM.scrollIntoViewIfNeeded',{nodeId:button.nodeId});
    const {model}=await cdp.send('DOM.getBoxModel',{nodeId:button.nodeId});
    await page.mouse.click((model.content[0]+model.content[2])/2,(model.content[1]+model.content[5])/2);
  }
  await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fileURLToPath(new URL('../test-results/downloads/',import.meta.url)),eventsEnabled:true});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  try { await until(async()=>Object.values(await data()).some(p=>p.records?.some(r=>r.entries.some(e=>e.algorithm==='blake3'))),'background subpage BLAKE3 not discovered'); }
  catch(error) { console.log('DISCOVERY DIAGNOSTIC',await sw.evaluate(async()=>({tabs:await chrome.tabs.query({}),probes:Object.entries(await chrome.storage.session.get(null)).filter(([key])=>key.startsWith('probe:'))})),workerWarnings,errors);throw error; }
  const pages=Object.values(await data()).filter(x=>x.records);
  const entries=pages.flatMap(p=>p.records).find(r=>r.url.endsWith('/download.zip')).entries;
  assert.deepEqual([...new Set(entries.map(e=>e.algorithm))].sort(),['blake3','sha256','sha3256','sha512']);
  assert.equal(await page.locator('form button').evaluate(el=>el.hasAttribute('aria-expanded')),false);
  console.log('PASS page-code JSON, per-file bare sidecar, automatic reveal, background JS checksum subpage',entries.map(e=>e.algorithm));
  await page.evaluate(()=>history.pushState({},'', '/spa-view'));
  await until(async()=>Object.values(await data()).some(p=>p.page?.endsWith('/spa-view')&&p.scan?.phase==='complete'),'SPA navigation did not refresh registrations');
  await page.getByRole('link',{name:'Shadow download',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/shadow.zip')&&j.status==='match'),'shadow DOM digest was not verified');
  await page.frameLocator('#same-origin-frame').getByRole('link',{name:'Frame download',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/framed.zip')&&j.status==='match'),'same-origin frame digest was not associated with its download');
  await page.getByRole('link',{name:'Manifest-only installer',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/list-only.exe')&&j.status==='match'),'adjacent SHA256SUMS did not supply the artifact digest');
  console.log('PASS shadow DOM, split text nodes, same-origin frames, SPA refresh, and adjacent checksum lists');
  for (const [label,path,expected] of [['Release A','/build-a/shared.zip',hashes.sha256],['Release B','/build-b/shared.zip',alternateHash],['Redirected checksum download','/redirected.zip',hashes.sha256],['Nested checksum download','/nested-file.zip',hashes.sha256],['Metadata release A','/data-a/shared.bin',hashes.sha256],['Metadata release B','/data-b/shared.bin',alternateHash]]) {
    await page.getByRole('link',{name:label,exact:true}).click();
    await until(async()=>Object.values(await data()).some(job=>job.url?.endsWith(path)&&job.status==='match'&&job.entries.filter(e=>e.algorithm==='sha256').every(e=>e.value===expected)),`incorrect checksum attribution for ${path}`);
  }
  console.log('PASS distinct checksums for same-named releases and redirected publisher checksum pages');
  const common = await context.newPage();
  common.on('pageerror', e => errors.push(e.message));
  await common.goto(`http://127.0.0.1:${server.address().port}/common`);
  const recordReady = async name => Object.values(await data()).some(p => p.records?.some(r => r.url?.endsWith(name) && r.entries.some(e => e.algorithm === 'sha256' && e.value === hashes.sha256)));
  await until(async () => recordReady('/generic.zip'), 'generic checksum column was not tied to the download');
  await until(async () => recordReady('/listed.zip'), 'definition-list checksum was not tied to the download');
  await until(async () => recordReady('/late.zip'), 'checksum inserted after the loading state was missed');
  await until(async () => recordReady('/attr.zip'), 'checksum added to the download element after load was missed');
  await until(async () => recordReady('/pending.zip'), 'loading checksum URL was not read again after the digest was published');
  for (const label of ['Generic build', 'Late download', 'Pending sidecar', 'Listed download', 'Attribute download']) {
    const [download] = await Promise.all([common.waitForEvent('download'), common.getByRole('link', { name: label, exact: true }).click()]);
    assert.equal(await download.failure(), null);
    await until(async () => Object.values(await data()).some(j => j.url?.endsWith(download.suggestedFilename()) && j.status === 'match'), `${label} did not verify after the page finished loading`);
  }
  await common.close();
  console.log('PASS common download tables, late page text, data attributes, and loading checksum URLs');
  await page.getByRole('link',{name:'Table download',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/table.zip')&&j.status==='match'&&j.entries.some(e=>e.algorithm==='sha256')&&j.entries.some(e=>e.algorithm==='sha512')),'table headers did not associate both algorithms with the artifact');
  for(const [label,status] of [['Download archive','match'],['Bad download','mismatch'],['Conflicting download','conflict'],['Unknown download','unverified']]){
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:label,exact:true}).click()]);
    assert.equal(await download.failure(),null);
    await until(async()=>Object.values(await data()).some(j=>j.filename?.endsWith(download.suggestedFilename())&&j.status===status),`Expected ${status}`);
    console.log('PASS automatic download',label,status);
  }
  const [buttonDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download with button',exact:true}).click()]);
  assert.equal(await buttonDownload.failure(),null);
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/button.zip')&&j.status==='match'),'JavaScript button download failed verification');
  console.log('PASS automatic verification of a JavaScript button download without an anchor');
  // The extension page is inaccessible to publisher JS and is the privileged UI.
  const ui=await context.newPage();ui.on('pageerror',e=>errors.push(e.message));
  await ui.goto(`chrome-extension://${id}/report.html`);
  await ui.setViewportSize({width:520,height:760});
  const compact=await context.newPage();
  compact.on('pageerror',e=>errors.push(e.message));
  await compact.setViewportSize({width:420,height:600});
  await compact.goto(`chrome-extension://${id}/popup.html`);
  await until(async()=>await ui.evaluate(()=>document.documentElement.dataset.mode==='basic'),'Basic should be the default interface');
  assert.equal(await ui.locator('#tab-files').isVisible(),false);
  await page.getByRole('link',{name:'Delayed checksum download',exact:true}).click();
  await ui.locator('#verification-activity').waitFor({state:'visible'});
  await compact.locator('#compact-loader').waitFor({state:'visible'});
  await page.locator('#checksum-download-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#checksum-download-panel').evaluate(host=>host.shadowRoot===null),true);
  assert.ok((await panelNodes()).some(node=>node.nodeName==='H2'&&/Finding the checksum|Checking your download/.test(nodeText(node))));
  await page.locator('#checksum-download-panel').screenshot({path:`${output}/page-progress.png`});
  await compact.screenshot({path:`${output}/compact-checking.png`,fullPage:false});
  await ui.screenshot({path:`${output}/basic-checking.png`,fullPage:false});
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/loading.zip')&&j.status==='match'&&j.resultAt),'delayed checksum did not finish with a result');
  await ui.locator('#result-title').getByText('YES — Checksum matches',{exact:true}).waitFor();
  await ui.locator('#verification-activity').waitFor({state:'hidden'});
  await compact.locator('#compact-title').getByText('YES — Checksum matches',{exact:true}).waitFor();
  await compact.locator('#compact-loader').waitFor({state:'hidden'});
  assert.ok((await panelNodes()).some(node=>node.nodeName==='H2'&&nodeText(node)==='Checksum matches'));
  const completedPanelJob=Object.values(await data()).find(job=>job.url?.endsWith('/loading.zip')&&job.status==='match');
  const paintPanel=async overrides=>sw.evaluate(async payload=>chrome.tabs.sendMessage(payload.tabId,{type:'download-progress',page:payload.page,job:payload.job}),{tabId:completedPanelJob.panelTabId,page:completedPanelJob.panelPage,job:{id:completedPanelJob.id,name:'loading.zip',status:'hashing',progress:10,...overrides}});
  const panelSection=async()=> (await panelNodes()).find(node=>node.nodeName==='SECTION'&&node.attributes?.includes(String(completedPanelJob.id)));
  const descendants=node=>[node,...(node.children||[]).flatMap(descendants)];
  await paintPanel({});
  const closeBefore=descendants(await panelSection()).find(node=>node.nodeName==='BUTTON'&&node.attributes?.includes('Dismiss download panel'));
  await cdp.send('DOM.focus',{nodeId:closeBefore.nodeId});
  await paintPanel({progress:80});
  const closeAfter=descendants(await panelSection()).find(node=>node.nodeName==='BUTTON'&&node.attributes?.includes('Dismiss download panel'));
  assert.equal(closeAfter.backendNodeId,closeBefore.backendNodeId,'progress updates replaced the focused control');
  const {object:closeObject}=await cdp.send('DOM.resolveNode',{backendNodeId:closeAfter.backendNodeId});
  assert.equal((await cdp.send('Runtime.callFunctionOn',{objectId:closeObject.objectId,functionDeclaration:'function(){return this===this.getRootNode().activeElement;}',returnByValue:true})).result.value,true);
  await paintPanel({status:'match',needsRecheck:true});
  assert.ok(descendants(await panelSection()).some(node=>node.nodeName==='H2'&&nodeText(node)==='Finding the checksum…'),'pending recheck displayed a premature outcome');
  await page.emulateMedia({reducedMotion:'reduce'});
  await paintPanel({status:'match',progress:100});
  const {object:sectionObject}=await cdp.send('DOM.resolveNode',{backendNodeId:(await panelSection()).backendNodeId});
  const motion=await cdp.send('Runtime.callFunctionOn',{objectId:sectionObject.objectId,functionDeclaration:'function(){return {running:this.getAnimations({subtree:true}).filter(animation=>animation.playState==="running").length,buttonRadius:getComputedStyle(this.querySelector("button:not(.close)")).borderRadius};}',returnByValue:true});
  assert.equal(motion.result.value.running,0);assert.equal(motion.result.value.buttonRadius,'999px');
  await page.emulateMedia({reducedMotion:'no-preference'});
  console.log('PASS stable panel focus, pending-recheck timing, pill controls, and reduced motion');
  await compact.screenshot({path:`${output}/compact-verified.png`,fullPage:false});
  await compact.getByRole('button',{name:'View file report',exact:true}).click();
  await until(async()=>context.pages().some(p=>p.url().includes('/report.html?panel=downloads')),'compact report action did not open the full report');
  await ui.screenshot({path:`${output}/basic-verified.png`,fullPage:false});
  await ui.getByRole('button',{name:'Dismiss verification result',exact:true}).click();
  await ui.locator('#result-popup').waitFor({state:'hidden'});
  await page.getByRole('link',{name:'Unknown download',exact:true}).click();
  await ui.locator('#result-title').getByText('Couldn’t verify',{exact:true}).waitFor();
  await ui.locator('.report-options > summary').click();
  await ui.getByRole('button',{name:'Advanced',exact:true}).click();
  await ui.locator('#tab-files').waitFor({state:'visible'});
  console.log('PASS Basic/Advanced switching, real discovery loader, final YES popup, and dismissal');
  if(process.env.LIVE_JETBRAINS==='1') {
    const live=await ui.evaluate(()=>chrome.runtime.sendMessage({type:'fetch-checksum',url:'https://download.jetbrains.com/toolbox/jetbrains-toolbox-3.9.0.88839.exe.sha256',page:'https://www.jetbrains.com/toolbox-app/'}));
    assert.equal(live.error,undefined,live.error);
    assert.ok(live.entries.some(e=>e.algorithm==='sha256'&&e.filename==='jetbrains-toolbox-3.9.0.88839.exe'&&e.value.length===64));
    console.log('PASS live cross-origin JetBrains checksum retrieval and executable association');
    const catalog=await ui.evaluate(()=>chrome.runtime.sendMessage({type:'discover-catalog',page:'https://www.jetbrains.com/toolbox-app/'}));
    assert.equal(catalog.error,undefined,catalog.error);
    assert.ok(catalog.files.some(file=>file.url.endsWith('.exe')&&file.checksumURL===file.url+'.sha256'));
    const publisher=await context.newPage();
    await publisher.goto('https://www.jetbrains.com/toolbox-app/',{waitUntil:'domcontentloaded'});
    await until(async()=>Object.values(await ui.evaluate(()=>chrome.storage.session.get(null))).some(p=>p.page?.includes('jetbrains.com/toolbox-app')&&p.files?.some(f=>f.url.endsWith('.exe'))&&p.records?.some(r=>r.entries?.some(e=>e.algorithm==='sha256'))),'live Toolbox page did not discover its release catalog and checksums');
    await publisher.close();
    console.log('PASS live JetBrains page discovers its installers and SHA-256 expectations before downloading');
  }
  await ui.getByRole('tab',{name:/Page files/}).click();
  const hiddenRow=ui.locator('.file-row').filter({has:ui.getByRole('heading',{name:'jetbrains-toolbox-3.9.0.88839.exe',exact:true})});
  await hiddenRow.waitFor();
  await hiddenRow.getByText('1 checksum',{exact:true}).waitFor();
  await hiddenRow.getByRole('button',{name:'Download & verify',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/hidden/jetbrains-toolbox-3.9.0.88839.exe')&&j.status==='match'),'hidden JetBrains-format artifact was not verified');
  console.log('PASS hidden checksum link identifies executable and Download & verify preserves publisher attribution');
  await ui.getByRole('tab',{name:'Verify a file',exact:true}).click();
  await ui.locator('#file').setInputFiles({name:'manual.zip',mimeType:'application/zip',buffer:body});
  await ui.locator('#expected').fill(hashes.sha256);
  await ui.getByRole('button',{name:'Verify locally',exact:true}).click();
  await ui.locator('#manual-result').getByText('Integrity verified',{exact:true}).waitFor();
  await ui.locator('#expected').fill('0'.repeat(64));
  await ui.getByRole('button',{name:'Verify locally',exact:true}).click();
  await ui.locator('#manual-result').getByText('Checksum mismatch — do not run this file',{exact:true}).waitFor();
  await ui.locator('#result-title').getByText('NO — Checksum mismatch',{exact:true}).waitFor();
  await ui.emulateMedia({colorScheme:'dark'});
  await ui.screenshot({path:`${output}/extension-verification-dark.png`,fullPage:true});
  await ui.emulateMedia({colorScheme:'light'});
  await ui.screenshot({path:`${output}/extension-verification.png`,fullPage:true});
  await ui.getByRole('tab',{name:'Settings',exact:true}).click();
  await ui.locator('#block-mode').selectOption('hold-all');
  await ui.getByRole('button',{name:'Save settings',exact:true}).click();
  await ui.locator('#settings-status').getByText('Settings saved',{exact:true}).waitFor();
  await page.getByRole('link',{name:'Slow installer',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/slow.exe')&&j.status==='held'),'ask-before-download did not pause file');
  const held=Object.values(await data()).find(j=>j.url?.endsWith('/slow.exe')&&j.status==='held');
  await ui.getByRole('tab',{name:/Downloads/}).click();
  await ui.locator(`article.job[data-job="${held.id}"]`).getByRole('button',{name:'Allow once',exact:true}).click();
  await until(async()=>(await data())[`job:${held.id}`]?.status==='unverified','allow once did not complete');
  await page.getByRole('link',{name:'Slow installer',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/slow.exe')&&j.status==='held'),'second download did not pause');
  const heldAgain=Object.values(await data()).find(j=>j.url?.endsWith('/slow.exe')&&j.status==='held');
  await ui.locator(`article.job[data-job="${heldAgain.id}"]`).getByRole('button',{name:'Cancel download',exact:true}).click();
  assert.equal((await data())[`job:${heldAgain.id}`].status,'canceled');
  console.log('PASS actual pause, allow-once resume, and cancel actions');
  await ui.getByRole('tab',{name:'Settings',exact:true}).click();
  await ui.locator('#block-mode').selectOption('dangerous');
  await ui.locator('#blocked-hosts').fill('127.0.0.1');
  await ui.getByRole('button',{name:'Save settings',exact:true}).click();
  await page.getByRole('link',{name:'Slow installer',exact:true}).click();
  await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/slow.exe')&&j.status==='blocked'),'blocked host did not cancel file');
  await ui.locator('#blocked-hosts').fill('');
  await ui.locator('#block-mode').selectOption('require-checksum');
  await ui.getByRole('button',{name:'Save settings',exact:true}).click();
  await until(async()=>await sw.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');return settings.blockMode==='require-checksum'&&settings.blockedHosts.length===0;}),'updated download policy did not persist');
  await page.getByRole('link',{name:'Guessed installer',exact:true}).click();
  try { await until(async()=>Object.values(await data()).some(j=>j.url?.endsWith('/guessed.exe')&&j.status==='match'),'guessed sidecar did not resume and verify automatically'); }
  catch(error) { console.log('GUESSED DIAGNOSTIC',Object.values(await data()).filter(j=>j.url?.endsWith('/guessed.exe')),await sw.evaluate(()=>chrome.storage.local.get('settings')));throw error; }
  console.log('PASS persistent host blocking and automatic sidecar lookup/resume/verification');
  await ui.locator('#theme').selectOption('dark');
  await ui.getByRole('button',{name:'Save settings',exact:true}).click();
  await until(async()=>await ui.evaluate(async()=>(await chrome.storage.local.get('settings')).settings.theme==='dark'),'theme did not persist');
  await ui.reload();
  await until(async()=>await ui.evaluate(()=>document.documentElement.dataset.theme==='dark'),'saved theme was not applied after reload');
  await ui.getByRole('tab',{name:'Settings',exact:true}).click();
  await ui.evaluate(()=>scrollTo(0,0));
  await ui.bringToFront();
  await ui.mouse.move(400,400);await ui.mouse.wheel(0,700);
  await until(async()=>await ui.evaluate(()=>scrollY>100),'the report did not respond to wheel scrolling');
  const scrolled=await ui.evaluate(()=>scrollY);
  await ui.evaluate(()=>chrome.storage.session.set({'ui-scroll-test':{updated:Date.now()}}));
  await wait(200);
  assert.ok(await ui.evaluate(()=>scrollY)>=scrolled-2,'a background update reset the report scroll');
  await ui.evaluate(()=>{document.activeElement?.blur();document.body.tabIndex=-1;document.body.focus({preventScroll:true});});
  await ui.keyboard.press('Control+End');
  try {await until(async()=>await ui.evaluate(()=>scrollY+innerHeight>=document.documentElement.scrollHeight-3),'keyboard scrolling could not reach the settings footer');}
  catch(error){console.log('SCROLL DIAGNOSTIC',await ui.evaluate(()=>({y:scrollY,viewport:innerHeight,height:document.documentElement.scrollHeight,focus:document.activeElement?.tagName,focused:document.hasFocus(),hidden:document.hidden,bodyOverflow:getComputedStyle(document.body).overflow,rootOverflow:getComputedStyle(document.documentElement).overflow})));throw error;}
  await ui.evaluate(()=>scrollTo(0,0));

  assert.equal(await ui.locator('#result-popup').isVisible(),false,'Settings should not carry an unrelated result banner');
  assert.equal(await ui.locator('#verification-activity').isVisible(),false);
  await ui.screenshot({path:`${output}/settings-dark.png`,fullPage:true});
  await ui.setViewportSize({width:360,height:760});
  await ui.screenshot({path:`${output}/settings-mobile.png`,fullPage:true});
  assert.equal(await ui.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await ui.mouse.move(220,440);await ui.mouse.wheel(0,650);
  await until(async()=>await ui.evaluate(()=>scrollY>100),'narrow report did not scroll');
  await ui.evaluate(()=>scrollTo(0,0));
  await ui.setViewportSize({width:520,height:760});
  await ui.getByRole('tab',{name:/Downloads/}).click();
  await ui.evaluate(()=>scrollTo(0,0));
  await ui.screenshot({path:`${output}/downloads.png`,fullPage:true});
  await ui.setViewportSize({width:1180,height:850});
  await ui.screenshot({path:`${output}/full-report.png`,fullPage:false});
  await ui.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,theme:'light'}});});
  await until(async()=>await ui.evaluate(()=>document.documentElement.dataset.theme==='light'),'light appearance did not apply');
  await ui.evaluate(()=>scrollTo(0,0));
  assert.equal(await ui.evaluate(()=>document.body.getBoundingClientRect().width),1180);
  await ui.screenshot({path:`${output}/full-report-white.png`,fullPage:false});
  await ui.getByRole('tab',{name:'Settings',exact:true}).click();
  await ui.screenshot({path:`${output}/settings-white.png`,fullPage:true});
  await ui.evaluate(async()=>{const {settings}=await chrome.storage.local.get('settings');await chrome.storage.local.set({settings:{...settings,theme:'dark'}});});
  await ui.getByRole('tab',{name:/Downloads/}).click();
  await compact.emulateMedia({colorScheme:'dark'});
  await compact.getByText('More options',{exact:true}).click();
  await compact.getByRole('button',{name:'Advanced',exact:true}).hover();
  await compact.screenshot({path:`${output}/compact-dark-options.png`,fullPage:false});
  await compact.evaluate(()=>scrollTo(0,0));
  await compact.screenshot({path:`${output}/compact-dark.png`,fullPage:false});
  await ui.getByRole('tab',{name:/Page files/}).click();
  await ui.getByRole('button',{name:'Protection on',exact:true}).click();
  await until(async()=>await ui.getByRole('button',{name:'Protection off',exact:true}).count()===1,'protection toggle did not turn off');
  await until(async()=>await ui.locator('.file-row button').first().isDisabled(),'file downloads should require enabled protection');
  await ui.getByRole('button',{name:'Protection off',exact:true}).click();
  await until(async()=>!(await ui.locator('.file-row button').first().isDisabled()),'file download action did not recover after enabling protection');
  await ui.getByRole('tab',{name:/Downloads/}).click();
  const panelJobs=Object.values(await data()).filter(job=>Number.isSafeInteger(job.id)&&job.panelPage?.endsWith('/spa-view')&&!job.pagePanelDismissed).slice(0,3);
  assert.equal(panelJobs.length,3);
  for (const job of panelJobs) await clickPanelButton('Dismiss download panel',job.id);
  await until(async()=>(await panelNodes()).some(node=>node.nodeName==='H2'&&nodeText(node)==='Prefer fewer popups?'),'repeated-dismiss preference prompt missing');
  await clickPanelButton('Turn off panels');
  await until(async()=>!(await page.locator('#checksum-download-panel').count()),'disabled panels stayed visible');
  const panelSettings=await sw.evaluate(async()=>(await chrome.storage.local.get('settings')).settings);
  assert.equal(panelSettings.downloadPanels,false);assert.equal(panelSettings.enabled,true);
  await ui.reload();
  console.log('PASS persistent closed-shadow progress panels, final result, three dismissals, and disable without disabling checks');
  // A browser-owned worker restart must retain session history and recover a stale job.
  const targets = await cdp.send('Target.getTargets');
  const workerTarget = targets.targetInfos.find(t=>t.type==='service_worker'&&t.url===sw.url());
  assert.ok(workerTarget);
  await cdp.send('Target.closeTarget',{targetId:workerTarget.targetId});
  await ui.reload();
  await until(async()=>await ui.locator('article.job[data-status="match"]').count()>0,'worker did not answer after restart');
  const afterRestart = await ui.evaluate(()=>chrome.storage.session.get(null));
  const prior = Object.entries(afterRestart).find(([k,j])=>k.startsWith('job:')&&j.status==='match');
  assert.ok(prior, 'history survived worker restart');
  await ui.evaluate(async key => {
    const state=await chrome.storage.session.get(key);
    state[key].status='hashing'; state[key].updated=0;
    await chrome.storage.session.set(state);
    await chrome.alarms.create('recover',{when:Date.now()+100});
  },prior[0]);
  await until(async()=>(await ui.evaluate(()=>chrome.storage.session.get(null)))[prior[0]]?.status==='match','stale job did not recover');
  console.log('PASS service-worker restart, persisted history, stale-job recovery');
  assert.deepEqual(errors,[]);
  console.log('PASS manual match and mismatch; wheel/keyboard scrolling; responsive white and dark UI; no page errors');
  console.log('CHROMIUM',context.browser().version(),'BROWSER CHECKS PASSED');
  await context.close();
  context = await chromium.launchPersistentContext(profilePath,launchOptions);
  const reopened = await context.newPage();
  await reopened.goto(`chrome-extension://${id}/report.html`);
  await until(async()=>await reopened.evaluate(async()=>(await chrome.storage.local.get('settings')).settings?.theme==='dark'),'settings lost after full browser restart');
  const persisted = await reopened.evaluate(async()=>({local:await chrome.storage.local.get('settings'),session:await chrome.storage.session.get(null)}));
  assert.equal(persisted.local.settings.blockMode,'require-checksum');
  assert.equal(persisted.local.settings.interfaceMode,'advanced');
  assert.equal(Object.keys(persisted.session).some(key=>key.startsWith('job:')),false);
  console.log('PASS full browser restart retains settings and clears session download history');
}finally{await context?.close();server.close();}


