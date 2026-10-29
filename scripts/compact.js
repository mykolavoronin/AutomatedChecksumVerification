'use strict';
const C = ChecksumCore, $ = id => document.getElementById(id);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)document.getAnimations().forEach(animation=>animation.cancel());});
let data = { jobs: [], settings: C.sanitizeSettings(), page: null }, selected = null, timer;
const copy = {
  match: ['Verified', 'YES — Checksum matches', 'The saved file matches the publisher’s expected checksum.'],
  mismatch: ['Mismatch', 'NO — Checksum mismatch', 'The saved file differs from the expected checksum. Avoid opening it.'],
  conflict: ['Conflicting expectations', 'NO — Conflicting checksums', 'The publisher’s checksum values disagree. This file has not passed verification.'],
  unverified: ['Not verified', 'Couldn’t verify this file', 'No supported checksum was found. This is an unknown result, not a failed comparison.'],
  manual: ['File access needed', 'Complete the check locally', 'Enable local file access, or select the downloaded file in the report.'],
  error: ['Check incomplete', 'Couldn’t finish checking', 'Open the report to review the error and try again.'],
  'weak-match': ['Limited assurance', 'Limited-strength checksum matches', 'The digest matches, but this older algorithm provides weak tamper protection.'],
  held: ['Paused', 'Your download needs approval', 'Choose Allow once or Cancel download in the report.'],
  blocked: ['Blocked', 'Download canceled by a rule', 'Open the report to see which protection rule applied.'],
  canceled: ['Canceled', 'Download canceled', 'No completed file was verified.'],
  interrupted: ['Interrupted', 'Download did not finish', 'Resume or restart the download before checking its integrity.']
};
function element(tag, text, className) { const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el; }
function safeName(job) { return (C.basename(job.filename || '') || C.urlFilename(job.url || '') || 'Download').replace(/[\u202a-\u202e\u2066-\u2069]/g, char=>'\\u'+char.charCodeAt(0).toString(16)); }
async function send(request) { const result=await chrome.runtime.sendMessage(request);if(result?.error)throw new Error(result.error);return result; }
function error(problem) { $('compact-error').textContent=problem.message;$('compact-error').hidden=false; }
async function report(panel='downloads', id=selected?.id) { await send({type:'open-report',panel,id}); }
function busy(job) { return ['downloading','finding','hashing'].includes(job.status)||((job.lookupPending||job.needsRecheck)&&!['held','blocked','canceled','deleted','interrupted'].includes(job.status)); }
function findCopy(page) {
  if (page?.scan?.phase === 'scanning') return ['Scanning this page…', 'Reading text, tables, and embedded checksum data. No result yet.'];
  if (page?.scan?.phase === 'fetching') return ['Reading checksum links…', 'Following checksum links from this page. No result yet.'];
  return ['Finding the checksum…', 'Searching publisher checksums for this file. No result is assumed while this runs.'];
}
function paintSteps(list, stage, active) {
  const order = ['download', 'find', 'verify'], index = order.indexOf(stage);
  for (const item of list.children) {
    const step = order.indexOf(item.dataset.step);
    item.dataset.active = String(active && step === index);
    item.dataset.done = String(active && step < index);
  }
}
function paintMeter(track, mode, value, label) {
  track.hidden = mode === 'off';
  track.dataset.mode = mode;
  track.setAttribute('aria-label', label);
  const bar = track.querySelector('.meter-bar');
  if (mode === 'determinate') {
    const amount = Math.max(0, Math.min(100, value || 0));
    track.setAttribute('aria-valuenow', String(amount));
    bar.style.setProperty('--meter-value',String(amount/100));
  } else {
    track.removeAttribute('aria-valuenow');
    bar.style.width = '';
    bar.style.removeProperty('--meter-value');
  }
}
function liveLabel(job) {
  if (!busy(job)) return copy[job.status]?.[0] || job.status;
  if (job.status === 'downloading') return 'Downloading';
  if (job.status === 'hashing') return `Verifying ${job.progress || 0}%`;
  return 'Finding checksum';
}
function render() {
  const {jobs,settings}=data;
  document.documentElement.dataset.theme=settings.theme;
  ChecksumIcons.decorate($('compact-toggle'),'power',settings.enabled?'Protection on':'Protection off',true);$('compact-toggle').setAttribute('aria-pressed',String(settings.enabled));
  for(const mode of ['basic','advanced'])$('compact-'+mode).setAttribute('aria-pressed',String(settings.interfaceMode===mode));
  const working=jobs.filter(busy), latest=jobs.filter(job=>job.resultAt&&copy[job.status]&&!job.lookupPending&&!job.needsRecheck).sort((a,b)=>b.resultAt-a.resultAt)[0];
  selected=working.find(job=>job.status==='hashing')||working[0]||(latest?.resultDismissedAt!==latest?.resultAt?latest:null)||jobs.find(job=>job.status==='held')||(!latest?jobs.find(job=>['blocked','interrupted'].includes(job.status)):null)||null;
  const state=$('compact-state'), active=selected&&busy(selected), result=selected&&copy[selected.status];
  state.dataset.state=active?'checking':selected?.status||'ready';state.setAttribute('aria-busy',String(!!active));
  const identity=`${selected?.id ?? 'ready'}:${active ? selected.status : selected?.status || settings.enabled}`;
  if(state.dataset.identity!==identity){
    const previous=state.dataset.identity;state.dataset.identity=identity;
    if(previous&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const heading=state.querySelector('h2');heading.getAnimations().forEach(animation=>animation.cancel());
      heading.animate([{opacity:.55,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
    }
  }
  state.querySelector('.compact-state-top').hidden=!active;
  $('compact-loader').hidden=!active;$('compact-file').hidden=!selected;$('compact-file').textContent=selected?safeName(selected):'';
  $('compact-steps').hidden=!active;$('compact-dismiss').hidden=!selected?.resultAt||!!active;
  const stage=selected?.status==='downloading'?'download':selected?.status==='hashing'?'verify':'find';
  paintSteps($('compact-steps'), stage, active);
  paintMeter($('compact-progress'), active ? (selected.status==='hashing'?'determinate':'indeterminate') : 'off', selected?.progress||0, selected?.status==='hashing'?'Local checksum calculation':selected?.status==='downloading'?'Download in progress':'Checksum search in progress');
  if(active){
    const others=working.length-1;
    const finding=findCopy(data.page);
    $('compact-state-label').textContent=working.length>1?`${working.length} checks running`:stage==='download'?'Downloading':stage==='verify'?'Verifying locally':'Looking up checksum';
    $('compact-title').textContent=stage==='download'?'Downloading your file…':stage==='verify'?`Verifying file… ${selected.progress||0}%`:finding[0];
    $('compact-description').textContent=(stage==='download'?'Verification starts after the download finishes.':stage==='verify'?'Comparing the saved file with its expected digest.':finding[1])+(others?` ${others} other check${others>1?'s are':' is'} still running.`:'');
  }else if(result){$('compact-state-label').textContent=result[0];$('compact-title').textContent=result[1];$('compact-description').textContent=selected.error||selected.blockReason||result[2];}
  else{$('compact-state-label').textContent=settings.enabled?'Ready':'Paused';$('compact-title').textContent=settings.enabled?'Download a file. We’ll check it.':'Automatic checks are paused';$('compact-description').textContent=settings.enabled?'We find the publisher’s checksum and compare it with the file saved on your device.':'Turn protection on to resume discovery, download rules, and verification.';}
  const entry=selected?.entries?.[0];$('compact-source').hidden=!entry;
  if(entry){let host='publisher';try{host=new URL(entry.source).hostname;}catch{}$('compact-source').textContent=`Expected checksum from ${host}${entry.inferred?' · algorithm inferred by length':''}`;}
  $('compact-details').textContent=selected?'View file report':'Open full report';
  ChecksumIcons.decorate($('compact-details'),'report');
  $('compact-permission').hidden=data.fileAccess||!settings.enabled;
  $('compact-access').textContent=data.fileAccess?'Files stay on this device':'Automatic verification needs local file access';
  const signature=jobs.slice(0,3).map(job=>job.id).join(':');
  if($('compact-history').dataset.signature!==signature){
    $('compact-history').dataset.signature=signature;$('compact-history').replaceChildren();
    for(const job of jobs.slice(0,3)){
      const button=element('button','', 'compact-history-row');button.type='button';button.append(element('span',safeName(job),'compact-history-name'),element('span',liveLabel(job),'compact-history-status '+job.status));button.addEventListener('click',()=>report('downloads',job.id).catch(error));$('compact-history').append(button);
    }
    if(!jobs.length)$('compact-history').append(element('p','No downloads checked yet. Start a download or choose a local file.','hint'));
  }
  for(const [index,job] of jobs.slice(0,3).entries()){
    const row=$('compact-history').children[index],name=row.querySelector('.compact-history-name'),status=row.querySelector('.compact-history-status'),label=liveLabel(job);
    if(name.textContent!==safeName(job))name.textContent=safeName(job);
    if(status.textContent!==label)status.textContent=label;
    status.className='compact-history-status '+job.status;
  }
}
async function refresh(){data=await send({type:'history'});render();}
$('compact-toggle').addEventListener('click',async()=>{try{await send({type:'save-settings',settings:{...data.settings,enabled:!data.settings.enabled}});await refresh();}catch(problem){error(problem);}});
$('compact-basic').addEventListener('click',async()=>{try{await send({type:'save-settings',settings:{...data.settings,interfaceMode:'basic'}});await refresh();}catch(problem){error(problem);}});
$('compact-advanced').addEventListener('click',async()=>{try{await send({type:'save-settings',settings:{...data.settings,interfaceMode:'advanced'}});await report('files');}catch(problem){error(problem);}});
$('compact-details').addEventListener('click',()=>report().catch(error));$('compact-all').addEventListener('click',()=>report('downloads').catch(error));
$('compact-files').addEventListener('click',async()=>{try{await send({type:'save-settings',settings:{...data.settings,interfaceMode:'advanced'}});await report('files');}catch(problem){error(problem);}});
$('compact-settings').addEventListener('click',()=>report('settings').catch(error));$('compact-manual').addEventListener('click',()=>report('verify').catch(error));
$('compact-permission-button').addEventListener('click',()=>send({type:'open-extension-settings'}).catch(error));
$('compact-dismiss').addEventListener('click',async()=>{try{await send({type:'dismiss-result',id:selected.id,resultAt:selected.resultAt});await refresh();}catch(problem){error(problem);}});
chrome.storage.onChanged.addListener((_changes,area)=>{if(['session','local'].includes(area)){clearTimeout(timer);timer=setTimeout(()=>refresh().catch(error),80);}});
refresh().catch(error);

for (const [id,icon,only] of [["compact-settings","settings",true],["compact-manual","file",false],["compact-files","folder",false],["compact-all","arrow",true],["compact-dismiss","close",true],["compact-permission-button","shield",false]]) { const button=$(id);ChecksumIcons.decorate(button,icon,button.textContent.trim(),only); }
