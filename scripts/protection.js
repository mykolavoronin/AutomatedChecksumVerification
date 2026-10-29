'use strict';
const resourceCache = new Map();
const jobLookups = new Set();
let activeLookups = 0;
const lookupWaiters = [];
function acquireLookup() {
  if (activeLookups < 4) { activeLookups++; return Promise.resolve(); }
  if (lookupWaiters.length >= 24) return Promise.reject(new Error('Too many pending checksum lookups.'));
  return new Promise(resolve => lookupWaiters.push(resolve));
}
function releaseLookup() {
  const next = lookupWaiters.shift();
  if (next) next(); else activeLookups--;
}
async function boundedText(response, limit = 2 * 1024 * 1024) {
  if (!response.ok) throw new Error(`Checksum source returned HTTP ${response.status}.`);
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Checksum source exceeds its size limit.');
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('Checksum source exceeds its size limit.'); }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
  return text + decoder.decode();
}
async function fetchCatalog(page, settings) {
  const catalog = C.catalogForPage(page);
  if (!catalog || !settings.enabled || !settings.linkedPages || !settings.crossOriginChecksums) return { files: [] };
  const key = `catalog:${catalog.url}`;
  const cached = resourceCache.get(key);
  if (cached && Date.now() - cached.time < 600000) return cached.promise;
  const promise = (async () => {
    await acquireLookup();
    try {
      const response = await fetch(catalog.url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
      const data = JSON.parse(await boundedText(response, 512 * 1024));
      if(catalog.provider==='github')return C.githubReleaseAssets(data,catalog);
      const downloads = data?.TBA?.[0]?.downloads;
      const files = Object.values(downloads || {}).slice(0, 20).flatMap(download => {
        const url = C.canonicalURL(download?.link), checksum = C.sidecarInfo(download?.checksumLink);
        if (!url || !C.isDownloadURL(url) || new URL(url).hostname !== 'download.jetbrains.com' || new URL(url).protocol !== 'https:' || checksum?.fileURL !== url) return [];
        return [{ url, checksumURL: checksum.url, foundIn: 'Publisher catalog' }];
      });
      return { files,entries:[] };
    } finally { releaseLookup(); }
  })();
  resourceCache.set(key, { promise, time: Date.now() });
  promise.catch(() => resourceCache.delete(key));
  return promise;
}
async function getSettings() {
  return C.sanitizeSettings((await chrome.storage.local.get('settings')).settings);
}
function cleanEntry(e, source) {
  return { algorithm: e.algorithm, value: e.value.toLowerCase(), filename: String(e.filename || '').slice(0, 512), source: C.canonicalURL(e.source) || source, downloadURL: C.canonicalURL(e.downloadURL) || '', inferred: !!e.inferred, format: String(e.format || 'Publisher digest').slice(0, 48) };
}
function mergeEntries(...groups) {
  return [...new Map(groups.flat().filter(C.validEntry).map(e => [`${e.algorithm}:${e.value}:${e.filename || ''}`, e])).values()].slice(0, 64);
}
async function fetchChecksumResource(value, page, settings) {
  const url = C.canonicalURL(value), source = C.canonicalURL(page), info = C.sidecarInfo(url);
  if (!settings.enabled || !url || !source || !info) throw new Error('Not a recognized checksum resource.');
  const crossOrigin = new URL(url).origin !== new URL(source).origin;
  if (crossOrigin && (!settings.crossOriginChecksums || !C.isPublicHTTPS(url))) throw new Error('Cross-origin lookup is disabled or the host is not a public HTTPS host.');
  const key = `${url}|${new URL(source).origin}`;
  const cached = resourceCache.get(key);
  if (cached && Date.now() - cached.time < 600000) return cached.promise;
  const promise = (async () => {
    await acquireLookup();
    try {
      const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: settings.crossOriginChecksums ? 'follow' : 'error', signal: AbortSignal.timeout(8000), cache: 'no-store' });
      const finalURL = C.canonicalURL(response.url || url);
      if (!finalURL || (new URL(url).protocol === 'https:' && new URL(finalURL).protocol !== 'https:')) throw new Error('An insecure checksum redirect was rejected.');
      if (new URL(finalURL).origin !== new URL(source).origin && !C.isPublicHTTPS(finalURL)) throw new Error('A checksum redirect to a private network was rejected.');
      const text = await boundedText(response);
      if (/html/i.test(response.headers.get('content-type') || '') || /^\s*<(?:!doctype|html)/i.test(text)) throw new Error('The checksum URL returned a web page instead of checksum text.');
      const entries=mergeEntries(C.parseChecksums(text, { source: finalURL, algorithm: info.algorithm, filename: info.filename }), C.parseStructuredChecksums(text, finalURL)).map(entry=>{
        if(!entry.downloadURL&&/[\/\\]/.test(entry.filename)&&!entry.filename.startsWith('/')&&!/^[a-z]:/i.test(entry.filename)){
          try{return{...entry,downloadURL:C.canonicalURL(new URL(entry.filename.replace(/\\/g,'/'),finalURL).href)||''};}catch{}
        }
        return entry;
      });
      return { url, finalURL, entries };
    } finally { releaseLookup(); }
  })();
  resourceCache.set(key, { time: Date.now(), promise });
  if (resourceCache.size > 100) resourceCache.delete(resourceCache.keys().next().value);
  promise.catch(() => resourceCache.delete(key));
  return promise;
}
async function applyDownloadPolicy(job, item, settings) {
  const decision = C.downloadDecision(item, job.entries, settings, C.ALGORITHMS);
  if (decision.action === 'allow' || (decision.action === 'hold' && job.allowedOnce)) return false;
  try {
    if (decision.action === 'cancel') await chrome.downloads.cancel(job.id);
    else await chrome.downloads.pause(job.id);
    const [current] = await chrome.downloads.search({ id: job.id });
    if (current?.state === 'complete') {
      job.warnings.push('This download completed before Chrome could apply the blocking rule.');
      await saveJob(job); return false;
    }
    job.status = decision.action === 'cancel' ? 'blocked' : 'held';
    job.heldBy = 'policy';
    job.blockReason = decision.reason;
    await saveJob(job); await notifyStatus(job); return true;
  } catch (error) {
    job.warnings.push(`Chrome could not ${decision.action === 'cancel' ? 'cancel' : 'pause'} this download: ${error.message}`);
    await saveJob(job); return false;
  }
}
function lookupJob(job) {
  if (jobLookups.has(job.id)) return;
  jobLookups.add(job.id);
  (async () => {
    const settings = await getSettings();
    if (!settings.enabled || !settings.guessSidecars || ['blocked', 'canceled', 'deleted'].includes(job.status)) return;
    const urls = C.sidecarCandidates(job).filter(url => !(job.lookedUp || []).includes(url));
    if (!urls.length) return;
    await serial(async () => {
      const current = await getJob(job.id);
      if (!current || ['blocked', 'canceled', 'deleted', 'interrupted'].includes(current.status)) return;
      current.lookupPending = true;
      if (current.status === 'unverified') current.status = 'finding';
      await saveJob(current);
    });
    const names = new Set([C.urlFilename(job.url), C.urlFilename(job.finalUrl), C.basename(job.filename || '')].filter(Boolean));
    let published=[];
    const catalog=C.catalogForPage(job.url);
    if(catalog?.provider==='github'){
      try{const release=await fetchCatalog(job.url,settings);published=(release.entries||[]).filter(entry=>[C.canonicalURL(job.url),C.canonicalURL(job.finalUrl)].includes(entry.downloadURL));}catch{}
    }
    const entries = published.length?published:(await Promise.all(urls.map(async url => {
      try {
        const found = await fetchChecksumResource(url, job.referrer || job.url, settings);
        const target = C.sidecarInfo(url).filename;
        return found.entries.filter(entry => (!entry.downloadURL||[C.canonicalURL(job.url),C.canonicalURL(job.finalUrl)].includes(entry.downloadURL))&&entry.filename && (names.has(C.basename(entry.filename)) || (target && C.basename(entry.filename) === target && names.has(target))));
      } catch { return []; }
    }))).flat();
    await serial(async () => {
      const current = await getJob(job.id);
      if (!current || ['blocked', 'canceled', 'deleted', 'interrupted'].includes(current.status)) return;
      current.lookedUp = [...new Set([...(current.lookedUp || []), ...urls])];
      current.lookupPending = false;
      if (entries.length) {
        current.entries = mergeEntries(current.entries, entries);
        current.source ||= current.referrer || current.url;
        current.warnings = C.securityWarnings(current, current.entries);
        if (current.status === 'hashing') current.needsRecheck = true;
      }
      const [item] = await chrome.downloads.search({ id: job.id });
      if (current.status === 'held' && current.heldBy === 'policy' && item?.state === 'in_progress' && settings.blockMode === 'require-checksum' && C.downloadDecision(item, current.entries, settings, C.ALGORITHMS).action === 'allow') {
        await chrome.downloads.resume(current.id);
        current.status = 'downloading'; current.blockReason = '';
      }
      await saveJob(current);
      if (entries.length && item?.state === 'complete' && current.status !== 'hashing') await completed(current.id, true);
      else if (item?.state === 'complete' && current.status !== 'hashing') {
        if (current.status === 'finding') { current.status = 'unverified'; await saveJob(current); }
        await announceResult(current);
      }
    });
  })().catch(error => {
    console.warn('Checksum lookup:', error.message);
    return serial(async () => {
      const current = await getJob(job.id);
      if (!current) return;
      current.lookupPending = false;
      if (current.status === 'finding') { current.status = 'unverified'; current.error = 'Checksum discovery could not finish. Try checking again.'; }
      await saveJob(current); await announceResult(current);
    });
  }).finally(() => jobLookups.delete(job.id));
}
