/* Isolated-world UI. Publisher markup cannot invoke download controls. */
(() => {
  'use strict';
  let host, root, enabled = true;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.addEventListener('change',event=>{if(event.matches)root?.querySelectorAll('section').forEach(card=>card.getAnimations({subtree:true}).forEach(animation=>animation.cancel()));});
  const cards = new Map(), dismissed = new Set();
  const element = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
  const send = (id, action) => chrome.runtime.sendMessage({ type: 'panel-action', id, action });
  function mount() {
    if (host?.isConnected) return;
    cards.clear();
    host = element('div'); host.id = 'checksum-download-panel';
    host.style.cssText = 'all:initial!important;position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;width:min(340px,calc(100vw - 32px))!important;max-height:calc(100vh - 40px)!important;overflow-y:auto!important;';
    root = host.attachShadow({ mode: 'closed' });
    const style = element('style');
    style.textContent = `:host{color-scheme:light}*{box-sizing:border-box}section{font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202020;background:#fff;border:0;border-radius:18px;box-shadow:0 8px 30px #0002;padding:18px;margin-top:10px}header{display:flex;gap:12px;align-items:start}h2{font-size:15px;line-height:1.4;letter-spacing:-.2px;margin:0;flex:1}p{margin:9px 0;color:#666;overflow-wrap:anywhere}.file{font-weight:500;color:#202020}button{font:inherit;cursor:pointer;border:1px solid #ddd;border-radius:7px;background:#f5f5f5;color:#222;padding:7px 11px;min-height:34px}button:hover{background:#e9e9e9}button:focus-visible{outline:2px solid #202020;outline-offset:3px}.close{padding:0 8px;min-width:32px;background:transparent;font-size:19px}.actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}progress{width:100%;height:5px;accent-color:#333;margin-top:8px}.ui-icon{width:17px;height:17px;vertical-align:middle;margin-right:7px;flex-shrink:0}button{display:inline-flex;align-items:center;justify-content:center}button.close .ui-icon{margin:0}.spinner{display:inline-block;width:12px;height:12px;border:2px solid #ddd;border-top-color:#333;border-radius:50%;margin-right:7px;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}`;
    style.textContent += `section{border-radius:24px;padding:18px 20px;animation:panel-arrive 260ms cubic-bezier(.16,1,.3,1)}header{align-items:center}h2{line-height:1.45;min-width:0}h2>span:first-child{display:inline-flex;vertical-align:middle}button{border-radius:999px;min-height:38px;padding-inline:14px;transition:background-color 140ms ease-out,scale 140ms cubic-bezier(.16,1,.3,1)}button:active{scale:.97}button:disabled{opacity:.5;cursor:wait}button.close{width:34px;min-width:34px;height:34px;min-height:34px;padding:7px;border-radius:50%;flex-shrink:0}.file{margin-top:12px;line-height:1.5}.actions{margin-top:14px}progress[hidden]{display:none}.leaving{pointer-events:none;animation:panel-leave 160ms ease-out forwards}:host{scrollbar-width:thin;scrollbar-color:#ccc transparent}:host([data-hidden]) .spinner{animation-play-state:paused}@keyframes panel-arrive{from{opacity:.3;transform:translateY(8px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes panel-leave{to{opacity:0;transform:translateY(5px)}}@media(prefers-reduced-motion:reduce){section,.leaving{animation:none}button{transition:none}button:active{scale:1}}@media(prefers-reduced-transparency:reduce){section{background:#fff;backdrop-filter:none}}`;
    host.toggleAttribute('data-hidden',document.hidden);
    root.append(style); document.documentElement.append(host);
  }
  const copy = {
    downloading: ['Downloading…', 'Checking begins when the file is saved.'], finding: ['Finding the checksum…', 'Reading publisher checksum sources for this file.'],
    hashing: ['Checking your download…', 'Reading the saved file locally.'], match: ['Checksum matches', 'Integrity verified. A checksum match is not a malware scan.'],
    mismatch: ['Checksum mismatch', 'Avoid opening this file. Its contents do not match the expected checksum.'], conflict: ['Conflicting checksums', 'This file has not passed verification. Review the publisher sources.'],
    unverified: ['Couldn’t verify', 'No supported checksum was found for this file.'], manual: ['File access needed', 'Open the report to select the saved file or enable automatic local access.'],
    'weak-match': ['Limited-strength checksum matches', 'The digest matches, but its algorithm or output length provides limited assurance.'], error: ['Couldn’t verify', 'Open the report for details and retry.'],
    held: ['Download paused', 'Open the report to allow or cancel this download.'], blocked: ['Download blocked', 'Open the report to see the blocking reason.'], canceled: ['Download canceled', 'No verification completed.'], interrupted: ['Download interrupted', 'No verification completed.'], deleted: ['File removed', 'The downloaded file was removed.']
  };
  async function closeCard(job, card) {
    if (card.dataset.closing === 'true') return;
    card.dataset.closing = 'true';
    const result = await send(job.id, 'dismiss').catch(() => null);
    if (!result?.ok) {
      card.dataset.closing = 'false';
      if (!card.querySelector('[role=alert]')) { const error=element('p','Couldn’t dismiss this panel. Try again or reload the page.');error.setAttribute('role','alert');card.append(error); }
      return;
    }
    dismissed.add(job.id); cards.delete(job.id);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) card.remove();
    else { card.classList.add('leaving'); setTimeout(() => card.remove(),160); }
    if (!result.ask) return;
    const prompt = element('section'); prompt.setAttribute('aria-label', 'Download panel preference');
    prompt.append(element('h2', 'Prefer fewer popups?'), element('p', 'Turn off these small download panels? Automatic checking will keep running.'));
    const actions = element('div'); actions.className = 'actions';
    for (const [label, action] of [['Turn off panels', 'disable'], ['Keep showing', 'keep']]) {
      const button = element('button', label); button.onclick = async () => {
        actions.querySelectorAll('button').forEach(control=>control.disabled=true);
        const response = await send(job.id, action).catch(() => null);
        if (response?.ok) { prompt.remove(); if (action === 'disable') { enabled = false; clear(); } }
        else { actions.querySelectorAll('button').forEach(control=>control.disabled=false);if(!prompt.querySelector('[role=alert]')){const error=element('p','Couldn’t save that preference. Try again.');error.setAttribute('role','alert');prompt.append(error);} }
      }; actions.append(button);
    }
    prompt.append(actions); root.insertBefore(prompt,root.children[1] || null); actions.firstChild.focus();
  }
  function clear() { cards.clear(); host?.remove(); }
  function paint(job) {
    if (!enabled || !Number.isSafeInteger(job?.id) || job.dismissed || dismissed.has(job.id)) return false;
    mount(); let view = cards.get(job.id);
    if (!view) {
      const card=element('section'), header=element('header'), heading=element('h2'), symbol=element('span'), title=element('span'), close=element('button');
      card.dataset.downloadId=String(job.id);heading.append(symbol,title);
      close.className='close';close.setAttribute('aria-label','Dismiss download panel');close.title='Dismiss';close.append(ChecksumIcons.icon('close'));
      close.onclick=()=>closeCard(job,card);header.append(heading,close);
      const filename=element('p'), status=element('p'), progress=element('progress'), actions=element('div'), report=element('button','View report');
      filename.className='file';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
      progress.max=100;actions.className='actions';ChecksumIcons.decorate(report,'report');
      report.onclick=()=>send(job.id,'report').catch(()=>{status.textContent='Couldn’t open the report. Open the extension from the toolbar.';});actions.append(report);
      card.append(header,filename,status,progress,actions);root.insertBefore(card,root.children[1] || null);
      view={card,title,symbol,filename,status,progress,stage:''};cards.set(job.id,view);
      if (!root.activeElement) host.scrollTop=0;
    }
    const {card,title,symbol,filename,status,progress}=view;
    if (card.dataset.closing==='true') return false;
    const busy = ['downloading', 'finding', 'hashing'].includes(job.status) || ((job.lookupPending || job.needsRecheck) && !['held','blocked','canceled','deleted','interrupted'].includes(job.status));
    const stage = busy && job.status !== 'downloading' && job.status !== 'hashing' ? 'finding' : job.status;
    const [label, description] = copy[stage] || copy.unverified;
    if (view.stage!==stage) {
      symbol.getAnimations().forEach(animation=>animation.cancel());
      view.stage=stage;card.dataset.stage=stage;card.setAttribute('aria-busy',String(busy));
      title.textContent=label;status.textContent=description;symbol.replaceChildren();
      if (busy) { const spinner=element('span');spinner.className='spinner';spinner.setAttribute('aria-hidden','true');symbol.append(spinner); }
      else symbol.append(ChecksumIcons.icon(job.status==='match'||job.status==='weak-match'?'check':job.status==='mismatch'||job.status==='conflict'?'close':'question'));
      if (card.isConnected && !busy && !matchMedia('(prefers-reduced-motion: reduce)').matches) symbol.animate([{opacity:.25,transform:'scale(.8)'},{opacity:1,transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    const name=String(job.name || 'Download').replace(/[\u202a-\u202e\u2066-\u2069]/g,'');if(filename.textContent!==name)filename.textContent=name;
    progress.hidden=!busy;progress.setAttribute('aria-label',label);
    if (busy && stage==='hashing' && Number.isFinite(job.progress)) progress.value=Math.max(0,Math.min(100,job.progress));
    else progress.removeAttribute('value');
    return true;
  }
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (request?.type === 'download-progress') respond({ shown: request.page === ChecksumCore.canonicalURL(location.href) && paint(request.job) });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) { const wasEnabled=enabled, settings = ChecksumCore.sanitizeSettings(changes.settings.newValue); enabled = settings.enabled && settings.downloadPanels; if (!enabled) clear(); else if (!wasEnabled) restore(); }
  });
  function restore() { chrome.runtime.sendMessage({ type: 'panel-state' }).then(result => { enabled = result?.enabled !== false; for (const job of result?.jobs || []) paint(job); }).catch(() => {}); }
  document.addEventListener('visibilitychange',()=>host?.toggleAttribute('data-hidden',document.hidden));
  restore();
})();
