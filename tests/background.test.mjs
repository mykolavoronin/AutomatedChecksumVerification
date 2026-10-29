import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as Core from '../src/core.js';

const source = (await readFile(new URL('../scripts/protection.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../scripts/background.js', import.meta.url), 'utf8'));
function harness(fetchImpl=async()=>{throw new Error('Offline test');}) {
  const state = {}, deleted = [], notified = [], popupCalls = [], listeners = {}, local = { settings: { ...Core.DEFAULT_SETTINGS, notifications:true, resultPopups:true, guessSidecars: false } };
  const event = name => ({ addListener(fn) { listeners[name] = fn; } });
  const noop = async () => {};
  const extensionURL = path => `chrome-extension://test/${path}`;
  const chrome = {
    runtime: { id: 'test', getURL: extensionURL, getContexts: async () => [], onMessage: event('message'), onInstalled: event('installed'), onStartup: event('startup') },
    extension: { isAllowedFileSchemeAccess: async () => false },
    action: { setBadgeText: noop, setBadgeBackgroundColor: noop, openPopup: async () => popupCalls.push(true) },
    notifications: { create: async (id, options) => notified.push({ id, options }), onClicked: event('notification') },
    downloads: { onCreated: event('created'), onChanged: event('changed'), search: async ({ id }) => [{ id, state: 'complete', filename: '/tmp/file.zip', fileSize: 3, url: 'https://publisher.test/file.zip', referrer: 'https://publisher.test/download' }], removeFile: async id => deleted.push(id) },
    storage: { local: { get: async key => ({ [key]: structuredClone(local[key]) }), set: async values => Object.assign(local, structuredClone(values)) }, session: {
      get: async key => key === null ? structuredClone(state) : { [key]: structuredClone(state[key]) },
      set: async values => Object.assign(state, structuredClone(values)),
      remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete state[key]; },
      setAccessLevel: noop
    } },
    offscreen: { createDocument: noop, closeDocument: noop },
    tabs: { query: async () => [], sendMessage: noop, onRemoved: event('tabRemoved'), onUpdated: event('tabUpdated') },
    alarms: { create: noop, onAlarm: event('alarm') }
  };
  vm.runInNewContext(source, { chrome, ChecksumCore: Core, importScripts() {}, console, URL, URLSearchParams, AbortSignal, TextDecoder, fetch: fetchImpl });
  const send = (request, sender) => new Promise(resolve => listeners.message(request, { id: 'test', ...sender }, resolve));
  const ui = { url: extensionURL('popup.html') };
  const page = { url: 'https://publisher.test/download', frameId: 0, tab: { id: 1 } };
  return { state, local, deleted, notified, popupCalls, listeners, send, ui, page, chrome };
}
test('web content cannot invoke deletion or forge hash results', async () => {
  const h = harness();
  h.state['job:1'] = { id: 1, status: 'mismatch' };
  assert.match((await h.send({ type: 'delete', id: 1 }, h.page)).error, /extension popup/);
  assert.match((await h.send({ type: 'hash-result', id: 1, digests: {} }, h.page)).error, /Invalid hash sender/);
  assert.deepEqual(h.deleted, []);
  assert.equal(h.state['job:1'].status, 'mismatch');
});

test('the white-interface upgrade preserves protection rules and later appearance choices',async()=>{
  const h=harness();h.local.settings={...h.local.settings,theme:'dark',blockMode:'hold-all',blockedHosts:['blocked.example']};
  h.listeners.installed({reason:'update',previousVersion:'1.3.1'});await h.send({type:'history'},h.ui);
  assert.equal(h.local.settings.theme,'light');assert.equal(h.local.settings.blockMode,'hold-all');assert.deepEqual(h.local.settings.blockedHosts,['blocked.example']);
  await h.send({type:'save-settings',settings:{...h.local.settings,theme:'dark'}},h.ui);
  h.listeners.startup();await h.send({type:'history'},h.ui);assert.equal(h.local.settings.theme,'dark');
});

test('public release metadata is fetched without cookies and returns URL-bound expectations',async()=>{
  const requests=[],file='https://github.com/owner/project/releases/download/v1/app.zip';
  const h=harness(async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({tag_name:'v1',assets:[{name:'app.zip',state:'uploaded',browser_download_url:file,digest:'sha256:'+'a'.repeat(64)}]}));});
  const page={url:'https://github.com/owner/project/releases/tag/v1',frameId:0,tab:{id:1}};
  const result=await h.send({type:'discover-catalog'},page);
  assert.equal(result.entries[0].downloadURL,file);assert.equal(result.files[0].url,file);
  assert.equal(requests[0].url,'https://api.github.com/repos/owner/project/releases/tags/v1');
  assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');
});

test('redirected aggregate lists resolve directory-qualified filenames from the final source',async()=>{
  const h=harness(async()=>{const response=new Response(`${'a'.repeat(64)} *linux/app.zip`);Object.defineProperty(response,'url',{value:'https://publisher.test/releases/SHA256SUMS'});return response;});
  const result=await h.send({type:'fetch-checksum',url:'https://publisher.test/checksums.sha256'},h.page);
  assert.equal(result.entries[0].downloadURL,'https://publisher.test/releases/linux/app.zip');
  assert.equal(result.entries[0].source,'https://publisher.test/releases/SHA256SUMS');
});

test('background checksum pages start an unloaded tab and clean up navigation failures', async () => {
  for(const fails of [false,true]){
    const h=harness(),reloaded=[],removed=[],created=[];
    h.chrome.tabs.create=async options=>{created.push(options);return{id:3};};
    h.chrome.tabs.update=async()=>{if(fails)throw new Error('Navigation denied');return{status:'unloaded'};};
    h.chrome.tabs.reload=async id=>reloaded.push(id);
    h.chrome.tabs.remove=async id=>removed.push(id);
    const response=await h.send({type:'load-checksum-page',url:'https://publisher.test/checksums',filename:'archive.zip'},h.page);
    assert.equal(created[0].url,'chrome-extension://test/probe.html');assert.equal(created[0].active,false);
    if(fails){assert.match(response.error,/Navigation denied/);assert.equal(h.state['probe:3'],undefined);assert.deepEqual(removed,[3]);}
    else{assert.equal(response.ok,true);assert.deepEqual(reloaded,[3]);assert.equal(h.state['probe:3'].parent,1);}
  }
});

test('page panels can only read or dismiss their own initiating download', async () => {
  const h = harness();
  h.state['job:9'] = { id:9, status:'downloading', panelTabId:1, panelPage:h.page.url, filename:'archive.zip' };
  const action = { type:'panel-action', id:9, action:'dismiss' };
  assert.ok((await h.send(action,{...h.page,tab:{id:2}})).error);
  assert.ok((await h.send(action,{...h.page,url:'https://other.test'})).error);
  assert.ok((await h.send({...action,action:'disable'},h.page)).error);
  assert.equal((await h.send(action,h.page)).ask,false);
  assert.equal((await h.send(action,h.page)).ask,false);
  assert.equal(h.local.panelDismissals,1,'repeated updates cannot count as new dismissals');
  for (const id of [10,11]) {
    h.state[`job:${id}`] = {id,status:'hashing',panelTabId:1,panelPage:h.page.url};
    const result = await h.send({...action,id},h.page);
    assert.equal(result.ask,id===11);
  }
  assert.equal((await h.send({...action,id:11,action:'disable'},h.page)).ok,true);
  assert.equal(h.local.settings.downloadPanels,false);
  assert.equal(h.local.settings.enabled,true,'verification remains enabled');
  assert.equal((await h.send({type:'panel-state'},{...h.page,url:'https://other.test'})).jobs.length,0);
});

test('an unresponsive page panel cannot stall verification state', { timeout: 1000 }, async () => {
  const h = harness();
  h.chrome.tabs.sendMessage = () => new Promise(() => {});
  h.state['job:12'] = { id:12, status:'hashing', filename:'archive.zip', panelTabId:1, panelPage:h.page.url,
    entries:[{algorithm:'sha256',value:'a'.repeat(64)}],warnings:[] };
  await h.send({type:'hash-result',id:12,digests:{sha256:'a'.repeat(64)}},{url:'chrome-extension://test/offscreen.html'});
  assert.equal(h.state['job:12'].status,'match');
  assert.ok(h.state['job:12'].resultAt);
});
test('deletion requires extension UI and a tracked mismatched download', async () => {
  const h = harness();
  h.state['job:1'] = { id: 1, status: 'match' };
  assert.ok((await h.send({ type: 'delete', id: 1 }, h.ui)).error);
  assert.ok((await h.send({ type: 'delete', id: 999 }, h.ui)).error);
  h.state['job:1'].status = 'mismatch';
  assert.equal((await h.send({ type: 'delete', id: 1 }, h.ui)).ok, true);
  assert.deepEqual(h.deleted, [1]);
  assert.equal(h.state['job:1'].status, 'deleted');
});
test('registrations require a top-level sender and its exact source page', async () => {
  const h = harness();
  const record = { type: 'register', page: h.page.url, records: [{ url: 'https://publisher.test/file.zip', entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }] }] };
  assert.ok((await h.send(record, { ...h.page, frameId: 1 })).error);
  assert.ok((await h.send({ ...record, page: 'https://other.test' }, h.page)).error);
  assert.equal((await h.send(record, h.page)).ok, true);
  assert.equal(h.state['page:1'].records.length, 1);
});
test('download association rejects cross-page capture and missing referrers', async () => {
  const h = harness();
  await h.send({ type: 'register', page: h.page.url, records: [{ url: 'https://publisher.test/file.zip', entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }] }] }, h.page);
  for (const [id, referrer, count] of [[1, h.page.url, 1], [2, 'https://evil.test', 0], [3, '', 0]]) {
    h.listeners.created({ id, url: 'https://publisher.test/file.zip', referrer, state: 'in_progress', danger: 'safe', filename: '' });
    // The message queue orders this read after the download event.
    await h.send({ type: 'history' }, h.ui);
    assert.equal(h.state[`job:${id}`].entries.length, count);
  }
});
test('automatic mismatches alert the user without requiring an open popup', async () => {
  const h = harness();
  h.state['job:1'] = { id: 1, status: 'hashing', filename: '/tmp/file.zip', entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }], warnings: [] };
  assert.equal((await h.send({ type: 'hash-result', id: 1, digests: { sha256: 'b'.repeat(64) } }, { url: 'chrome-extension://test/offscreen.html' })).ok, true);
  assert.equal(h.state['job:1'].status, 'mismatch');
  assert.equal(h.notified.length, 1);
  assert.match(h.notified[0].options.title, /^NO/);
  assert.equal(h.notified[0].id, 'checksum:1');
});
test('JavaScript download buttons can use explicitly named publisher checksums', async () => {
  const h = harness();
  await h.send({ type: 'register', page: h.page.url, records: [], entries: [{ filename: 'file.zip', algorithm: 'sha256', value: 'a'.repeat(64) }] }, h.page);
  h.listeners.created({ id: 1, url: 'https://publisher.test/file.zip', referrer: h.page.url, state: 'in_progress' });
  await h.send({ type: 'history' }, h.ui);
  assert.equal(h.state['job:1'].entries.length, 1);
});
test('pause, resume-once and cancellation are real download actions restricted to extension UI', async () => {
  const h = harness(), calls = [];
  const item = { id: 1, state: 'in_progress', url: 'https://publisher.test/file.zip', referrer: h.page.url, danger: 'safe' };
  h.chrome.downloads.search = async () => [item];
  h.chrome.downloads.pause = async () => { calls.push('pause'); item.paused = true; };
  h.chrome.downloads.resume = async () => { calls.push('resume'); item.paused = false; };
  h.chrome.downloads.cancel = async () => { calls.push('cancel'); item.state = 'interrupted'; };
  h.local.settings.blockMode = 'hold-all';
  h.listeners.created(item); await h.send({ type: 'history' }, h.ui);
  assert.equal(h.state['job:1'].status, 'held');
  assert.deepEqual(calls, ['pause']);
  assert.ok((await h.send({ type: 'resume-download', id: 1 }, h.page)).error);
  assert.equal((await h.send({ type: 'resume-download', id: 1 }, h.ui)).ok, true);
  assert.equal(h.state['job:1'].allowedOnce, true);
  assert.equal((await h.send({ type: 'cancel-download', id: 1 }, h.ui)).ok, true);
  assert.equal(h.state['job:1'].status, 'canceled');
  assert.deepEqual(calls, ['pause', 'resume', 'cancel']);
});
test('blocked-host policy cancels active downloads and preserves the blocked status', async () => {
  const h = harness();
  const item = { id: 1, state: 'in_progress', url: 'https://publisher.test/file.zip', danger: 'safe' };
  h.chrome.downloads.search = async () => [item];
  h.chrome.downloads.cancel = async () => { item.state = 'interrupted'; };
  h.local.settings.blockedHosts = ['publisher.test'];
  h.listeners.created(item); await h.send({ type: 'history' }, h.ui);
  assert.equal(h.state['job:1'].status, 'blocked');
  h.listeners.changed({ id: 1, state: { current: 'interrupted' } }); await h.send({ type: 'history' }, h.ui);
  assert.equal(h.state['job:1'].status, 'blocked');
});
test('persistent settings cannot be changed by a publisher page', async () => {
  const h = harness();
  assert.ok((await h.send({ type: 'save-settings', settings: { enabled: false } }, h.page)).error);
  assert.equal(h.local.settings.enabled, true);
  assert.equal((await h.send({ type: 'save-settings', settings: { enabled: false, theme: 'dark' } }, h.ui)).ok, true);
  assert.equal(h.local.settings.enabled, false);
  assert.equal(h.local.settings.theme, 'dark');
});
test('successful checks show YES, open the result popup and do not repeat identical results', async () => {
  const h = harness();
  h.state['job:1'] = { id: 1, status: 'hashing', filename: '/tmp/file.zip', entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }], warnings: [] };
  const result = { type: 'hash-result', id: 1, digests: { sha256: 'a'.repeat(64) } };
  const sender = { url: 'chrome-extension://test/offscreen.html' };
  await h.send(result, sender);
  assert.match(h.notified[0].options.title, /^YES/);
  assert.equal(h.popupCalls.length, 1);
  assert.ok(h.state['job:1'].resultAt);
  h.state['job:1'].status = 'hashing';
  await h.send(result, sender);
  assert.equal(h.notified.length, 1);
});
test('a computed match is not announced while more checksum discovery is pending', async () => {
  const h = harness();
  h.state['job:1'] = { id: 1, status: 'hashing', lookupPending: true, entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }], warnings: [] };
  await h.send({ type: 'hash-result', id: 1, digests: { sha256: 'a'.repeat(64) } }, { url: 'chrome-extension://test/offscreen.html' });
  assert.equal(h.notified.length, 0);
  assert.equal(h.popupCalls.length, 0);
  assert.equal(h.state['job:1'].resultAt, undefined);
});

test('late checksum evidence stays in checking state until its algorithms finish', async () => {
  const h=harness(), statuses=[], requests=[];
  const set=h.chrome.storage.session.set;
  h.chrome.storage.session.set=async values=>{if(values['job:5'])statuses.push(values['job:5'].status);await set(values);};
  h.chrome.extension.isAllowedFileSchemeAccess=async()=>true;
  h.chrome.runtime.sendMessage=async request=>requests.push(request);
  h.state['job:5']={id:5,status:'hashing',needsRecheck:true,filename:'/tmp/file.zip',entries:[{algorithm:'sha256',value:'a'.repeat(64)},{algorithm:'sha512',value:'b'.repeat(128)}],warnings:[]};
  const sender={url:'chrome-extension://test/offscreen.html'};
  await h.send({type:'hash-result',id:5,digests:{sha256:'a'.repeat(64)}},sender);
  assert.ok(statuses.length>0&&statuses.every(status=>status==='hashing'));
  assert.equal(h.notified.length,0);
  assert.equal(h.state['job:5'].progress,0);
  assert.deepEqual([...requests[0].algorithms],['sha256','sha512']);
  await h.send({type:'hash-result',id:5,digests:{sha256:'a'.repeat(64),sha512:'b'.repeat(128)}},sender);
  assert.equal(h.state['job:5'].status,'match');
  assert.equal(h.notified.length,1);
});
test('missing checksums yield an unknown result rather than a NO verdict', async () => {
  const h = harness();
  h.listeners.created({ id: 1, url: 'https://publisher.test/file.zip', state: 'complete' });
  await h.send({ type: 'history' }, h.ui);
  assert.equal(h.state['job:1'].status, 'unverified');
  assert.ok(h.state['job:1'].resultAt);
  assert.match(h.notified[0].options.title, /Could not verify/);
});
test('popup policy rejection does not lose the verified result or notification', async () => {
  const h = harness();
  h.chrome.action.openPopup = () => { throw new Error('Blocked by policy'); };
  h.state['job:1'] = { id: 1, status: 'hashing', filename: '/tmp/file.zip', entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }], warnings: [] };
  const response = await h.send({ type: 'hash-result', id: 1, digests: { sha256: 'a'.repeat(64) } }, { url: 'chrome-extension://test/offscreen.html' });
  assert.equal(response.ok, true);
  assert.equal(h.state['job:1'].status, 'match');
  assert.ok(h.state['job:1'].resultAt);
  assert.equal(h.notified.length, 1);
});
test('an explicit recheck can show the same result again after it was dismissed', async () => {
  const h = harness(), sender = { url: 'chrome-extension://test/offscreen.html' };
  h.chrome.extension.isAllowedFileSchemeAccess = async () => true;
  h.chrome.runtime.sendMessage = async () => ({ queued: true });
  h.state['job:1'] = { id: 1, status: 'hashing', filename: '/tmp/file.zip', entries: [{ algorithm: 'sha256', value: 'a'.repeat(64) }], warnings: [] };
  const result = { type: 'hash-result', id: 1, digests: { sha256: 'a'.repeat(64) } };
  await h.send(result, sender);
  await h.send({ type: 'dismiss-result', id: 1, resultAt: h.state['job:1'].resultAt }, h.ui);
  assert.equal((await h.send({ type: 'retry', id: 1 }, h.ui)).ok, true);
  await h.send(result, sender);
  assert.equal(h.notified.length, 2);
  assert.notEqual(h.state['job:1'].resultDismissedAt, h.state['job:1'].resultAt);
});
