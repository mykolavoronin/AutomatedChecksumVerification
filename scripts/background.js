'use strict';
importScripts('core.js', 'protection.js');
const C = ChecksumCore;
const TTL = 30 * 60 * 1000;
let queue = Promise.resolve();
let creatingOffscreen;
function serial(fn) {
  const operation = queue.then(fn);
  queue = operation.catch(error => console.warn('Checksum verification:', error.message));
  return operation;
}
function trustedUI(sender) {
  if (sender.id !== chrome.runtime.id) return false;
  try {
    const url = new URL(sender.url), base = new URL(chrome.runtime.getURL(''));
    return url.protocol === base.protocol && url.host === base.host && ['/popup.html', '/report.html'].includes(url.pathname);
  } catch { return false; }
}
function trustedPage(sender) {
  return sender.id === chrome.runtime.id && sender.tab && sender.frameId === 0 && C.canonicalURL(sender.url);
}
function pageForSender(sender) {
  const original = C.canonicalURL(sender.url), tab = C.canonicalURL(sender.tab?.url);
  return tab && original && new URL(tab).origin === new URL(original).origin ? tab : original;
}
async function getJob(id) { return (await chrome.storage.session.get(`job:${id}`))[`job:${id}`]; }
function panelJob(job) {
  return { id: job.id, name: (C.basename(job.filename || '') || C.urlFilename(job.url)).slice(0, 240), status: job.status,
    lookupPending: !!job.lookupPending, needsRecheck: !!job.needsRecheck, progress: job.progress, fileSize: job.fileSize, resultAt: job.resultAt || 0,
    dismissed: !!job.pagePanelDismissed };
}
async function publishPanel(job) {
  const settings = await getSettings();
  if (!settings.enabled || !settings.downloadPanels) return false;
  if (!Number.isSafeInteger(job.panelTabId)) {
    const all = await chrome.storage.session.get(null);
    const page = C.canonicalURL(job.referrer || job.source);
    const candidates = Object.entries(all).filter(([key, value]) => key.startsWith('page:') &&
      (page ? value.page === page || value.documents?.includes(page) : value.records?.some(record => record.url === C.canonicalURL(job.url))));
    if (candidates.length !== 1) return false;
    job.panelTabId = Number(candidates[0][0].slice(5));
    job.panelPage = candidates[0][1].page;
  }
  return true;
}
async function saveJob(job) {
  job.updated = Date.now();
  job.panelShown = await publishPanel(job);
  await chrome.storage.session.set({ [`job:${job.id}`]: job });
  // A busy or unresponsive publisher tab must never delay pause/cancel or hashing.
  if (job.panelShown) chrome.tabs.sendMessage(job.panelTabId, { type: 'download-progress', page: job.panelPage, job: panelJob(job) }).catch(() => {});
  const bad = ['mismatch', 'conflict', 'error', 'blocked', 'held'].includes(job.status) || job.warnings?.some(w => w.startsWith('Chrome download warning'));
  const busy = ['downloading', 'finding', 'hashing'].includes(job.status) || (job.lookupPending && !['held', 'blocked', 'canceled', 'deleted', 'interrupted'].includes(job.status));
  await chrome.action.setBadgeText({ text: busy ? '...' : bad ? '!' : job.status === 'match' ? 'YES' : '?' });
  await chrome.action.setBadgeBackgroundColor({ color: '#333333' });
}
async function ensureOffscreen() {
  if (creatingOffscreen) return creatingOffscreen;
  creatingOffscreen = (async () => {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('offscreen.html')] });
    if (!contexts.length) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['BLOBS'], justification: 'Read a completed local download as a Blob for incremental integrity verification.' });
  })();
  try { await creatingOffscreen; } finally { creatingOffscreen = undefined; }
}
async function notifyStatus(job) {
  if (!(await getSettings()).notifications) return;
  const titles = { match: 'YES — Checksum verified', mismatch: 'NO — Checksum mismatch', conflict: 'NO — Conflicting checksums', unverified: 'Could not verify this download', manual: 'Could not verify automatically', error: 'Verification failed', 'weak-match': 'Limited-strength checksum matched', held: 'Download paused for approval', blocked: 'Download blocked' };
  if (!titles[job.status]) return;
  const messages = { match: 'The file matches the publisher’s checksum. This is an integrity result, not a malware verdict.', mismatch: 'The file does not match the expected checksum. Avoid opening it.', conflict: 'Publisher checksum values conflict. Review them before opening this file.', unverified: 'No supported checksum was found. The file has not been verified.', manual: job.error || 'Select the local file in the extension to complete verification.', error: job.error || 'The integrity check could not be completed.', 'weak-match': 'The digest matches, but its algorithm or output length provides limited tamper protection.' };
  await chrome.notifications.create(`checksum:${job.id}`, {
    type: 'basic', iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: titles[job.status],
    message: `${(C.basename(job.filename || '') || C.urlFilename(job.url)).slice(0, 120)}: ${messages[job.status] || job.blockReason}`
  }).catch(() => {});
}
async function announceResult(job) {
  if (job.lookupPending || job.needsRecheck || !['match', 'mismatch', 'conflict', 'unverified', 'manual', 'error', 'weak-match'].includes(job.status)) return;
  const fingerprint = JSON.stringify([job.status, job.results || [], job.error || '']);
  if (job.announcedResult === fingerprint) return;
  job.announcedResult = fingerprint;
  job.resultAt = Math.max(Date.now(), (job.resultAt || 0) + 1);
  await saveJob(job); await notifyStatus(job);
  if (!job.panelShown && (await getSettings()).resultPopups && chrome.action.openPopup) {
    // Older Chrome or browser policy may refuse. The stored result and desktop
    // notification remain available even when opening the action popup fails.
    try { chrome.action.openPopup()?.catch(() => {}); } catch { /* Policy can also reject synchronously. */ }
  }
}
chrome.notifications.onClicked.addListener(id => {
  if (id.startsWith('checksum:')) chrome.tabs.create({ url: chrome.runtime.getURL('report.html') + '?download=' + encodeURIComponent(id.slice(9)) }).catch(() => {});
});
async function dispatch(job) {
  if (!job.entries.length) {
    job.status = job.lookupPending || jobLookups.has(job.id) ? 'finding' : 'unverified';
    await saveJob(job); await announceResult(job); return;
  }
  if (!(await chrome.extension.isAllowedFileSchemeAccess())) {
    job.status = 'manual';
    job.error = 'Enable Allow access to file URLs in Chrome extension details, or choose the downloaded file below.';
    await saveJob(job); await announceResult(job); return;
  }
  try {
    const url = C.fileURL(job.filename);
    job.status = 'hashing';
    job.started = Date.now();
    await saveJob(job);
    await ensureOffscreen();
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'hash', id: job.id, url,
      size: job.fileSize, algorithms: [...new Set(job.entries.map(e => e.algorithm))] });
  } catch (error) {
    job.status = 'manual'; job.error = `Automatic file access failed: ${error.message}. Select the file to verify it locally.`;
    await saveJob(job);
    await announceResult(job);
  }
}
async function associate(item) {
  const data = await chrome.storage.session.get(null);
  const urls = [item.url, item.finalUrl].map(C.canonicalURL).filter(Boolean);
  const page = C.canonicalURL(item.referrer);
  if (!page) return null;
  const pages = Object.entries(data).filter(([key, value]) => key.startsWith('page:') && Date.now() - value.updated < TTL &&
    (value.page === page || value.documents?.includes(page)));
  const candidates = pages.flatMap(([, value]) => {
    const records = value.records.filter(record => urls.includes(record.url));
    if (records.length) return records.map(record => ({ ...record, page: value.page }));
    // Downloads triggered by JavaScript buttons may have no anchor. Use only
    // explicitly named checksums on the exact initiating page, never bare hashes.
    const names = [...new Set([C.urlFilename(item.url), C.urlFilename(item.finalUrl), item.filename ? C.basename(item.filename) : ''].filter(Boolean))];
    const entries = names.map(name => C.forFile(value.entries || [], name).filter(entry => !entry.downloadURL || urls.includes(entry.downloadURL))).find(found => found.length) || [];
    return entries.length ? [{ entries, page: value.page }] : [];
  });
  const unique = [...new Map(candidates.map(c => [JSON.stringify(c.entries), c])).values()];
  // Never guess between different publisher records (including tabs with no referrer).
  return unique.length === 1 ? unique[0] : null;
}
async function created(item) {
  const settings = await getSettings();
  if (!settings.enabled) return;
  const intentKey = `intent:${item.id}`;
  const intent = (await chrome.storage.session.get(intentKey))[intentKey];
  if (intent) { item = { ...item, referrer: intent.page }; await chrome.storage.session.remove(intentKey); }
  const association = await associate(item);
  const entries = association?.entries || [];
  const job = { id: item.id, filename: item.filename, url: item.url, finalUrl: item.finalUrl,
    referrer: item.referrer, fileSize: item.fileSize, danger: item.danger, entries,
    source: association?.page || '', status: 'downloading', created: Date.now(),
    warnings: C.securityWarnings(item, entries) };
  await saveJob(job);
  await applyDownloadPolicy(job, item, settings);
  lookupJob(job);
  // Bound history and metadata, including download paths, to this browser session.
  const all = await chrome.storage.session.get(null);
  const jobs = Object.entries(all).filter(([key]) => key.startsWith('job:')).sort((a, b) => b[1].created - a[1].created);
  await chrome.storage.session.remove(jobs.slice(settings.historyLimit).filter(([, job]) => !['downloading', 'finding', 'hashing', 'held'].includes(job.status) && !job.lookupPending).map(([key]) => key));
  if (item.state === 'complete') await completed(item.id);
}
async function completed(id, force = false) {
  const job = await getJob(id);
  if (!job || ['deleted', 'blocked', 'canceled'].includes(job.status) || (!force && ['match', 'weak-match', 'mismatch', 'conflict'].includes(job.status))) return;
  const [item] = await chrome.downloads.search({ id });
  if (!item) return;
  if (item.state === 'interrupted') { job.status = 'interrupted'; job.error = item.error || 'Download interrupted.'; await saveJob(job); return; }
  if (item.state !== 'complete') return;
  Object.assign(job, { filename: item.filename, fileSize: item.fileSize, finalUrl: item.finalUrl, danger: item.danger });
  // Recheck because a fast download may start while a checksum list is being read.
  const association = await associate(item);
  if (association) { job.entries = mergeEntries(job.entries, association.entries); job.source = association.page; }
  job.warnings = C.securityWarnings(item, job.entries);
  await dispatch(job);
}
chrome.downloads.onCreated.addListener(item => { serial(() => created(item)); });
chrome.downloads.onChanged.addListener(delta => {
  serial(async () => {
    const job = await getJob(delta.id);
    if (!job) return;
    if (delta.danger) {
      job.danger = delta.danger.current;
      job.warnings = C.securityWarnings(job, job.entries);
      await saveJob(job);
      if (!['blocked', 'canceled', 'deleted'].includes(job.status)) {
        const [item] = await chrome.downloads.search({ id: job.id });
        if (item && await applyDownloadPolicy(job, item, await getSettings())) return;
      }
    }
    if (delta.finalUrl && !['blocked', 'canceled', 'deleted'].includes(job.status)) {
      job.finalUrl = delta.finalUrl.current; await saveJob(job);
      const [item] = await chrome.downloads.search({ id: job.id });
      if (item && await applyDownloadPolicy(job, item, await getSettings())) return;
      lookupJob(job);
    }
    if (delta.state && ['complete', 'interrupted'].includes(delta.state.current)) await completed(delta.id);
  });
});
chrome.tabs.onRemoved.addListener(id => { serial(() => chrome.storage.session.remove(`page:${id}`)); });
chrome.tabs.onUpdated.addListener((id, change) => {
  // A location.href download can emit "loading" without committing navigation.
  // Retain its publisher records until Chrome actually changes the page URL.
  if (change.url) serial(async () => {
    const key = `page:${id}`;
    const page = (await chrome.storage.session.get(key))[key];
    if (page && page.page !== C.canonicalURL(change.url)) await chrome.storage.session.remove(key);
  });
});
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request?.target === 'offscreen') return;
  // Network discovery runs outside the download mutation queue so a slow CDN
  // cannot delay a pause/cancel event or a user's download decision.
  if (request?.type === 'fetch-checksum' || request?.type === 'discover-catalog') {
    (async () => {
      if (sender.id !== chrome.runtime.id || (!trustedUI(sender) && !trustedPage(sender))) throw new Error('Invalid checksum source.');
      const source = trustedUI(sender) ? (C.canonicalURL(request.page) || request.url) : pageForSender(sender);
      if (request.type === 'discover-catalog') return fetchCatalog(source, await getSettings());
      return fetchChecksumResource(request.url, source, await getSettings());
    })().then(respond, error => respond({ error: error.message }));
    return true;
  }
  serial(async () => {
    if (sender.id !== chrome.runtime.id) throw new Error('Untrusted sender.');
    if (request?.type === 'panel-state') {
      if (!trustedPage(sender)) throw new Error('Invalid progress page.');
      const settings = await getSettings(), all = await chrome.storage.session.get(null);
      return { enabled: settings.enabled && settings.downloadPanels, jobs: Object.entries(all).filter(([key, job]) => key.startsWith('job:') && job.panelTabId === sender.tab.id && job.panelPage === pageForSender(sender) && !job.pagePanelDismissed).map(([, job]) => panelJob(job)) };
    }
    if (request?.type === 'panel-action') {
      if (!trustedPage(sender) || !Number.isSafeInteger(request.id)) throw new Error('Invalid progress panel.');
      const job = await getJob(request.id);
      if (!job || job.panelTabId !== sender.tab.id || job.panelPage !== pageForSender(sender)) throw new Error('This download belongs to another page.');
      if (request.action === 'report') {
        await chrome.tabs.create({ url: chrome.runtime.getURL('report.html') + '?download=' + job.id });
        return { ok: true };
      }
      const stored = await chrome.storage.local.get('panelDismissals');
      const count = Math.min(3, Number(stored.panelDismissals) || 0);
      if (request.action === 'dismiss') {
        if (job.pagePanelDismissed) return { ok: true, ask: false };
        job.pagePanelDismissed = true;
        await chrome.storage.session.set({ [`job:${job.id}`]: job });
        await chrome.storage.local.set({ panelDismissals: Math.min(3, count + 1) });
        return { ok: true, ask: count + 1 >= 3 };
      }
      if (count >= 3 && ['disable', 'keep'].includes(request.action)) {
        await chrome.storage.local.set({ panelDismissals: 0 });
        if (request.action === 'disable') {
          const settings = { ...await getSettings(), downloadPanels: false };
          await chrome.storage.local.set({ settings });
        }
        return { ok: true };
      }
      throw new Error('Invalid panel action.');
    }
    if (request?.type === 'probe-context') {
      if (!trustedPage(sender)) return { probe: false };
      return { probe: !!(await chrome.storage.session.get(`probe:${sender.tab.id}`))[`probe:${sender.tab.id}`], settings: await getSettings() };
    }
    if (request?.type === 'load-checksum-page') {
      if (!trustedPage(sender)) throw new Error('Invalid checksum source.');
      const settings = await getSettings();
      if (!settings.enabled || !settings.linkedPages) return { ok: false };
      const url = C.canonicalURL(request.url);
      const parentPage = pageForSender(sender);
      if (!url || new URL(url).origin !== new URL(parentPage).origin || url === parentPage) throw new Error('Checksum subpages must use the publisher’s origin.');
      const all = await chrome.storage.session.get(null);
      if (all[`probe:${sender.tab.id}`]) throw new Error('Nested checksum pages are disabled.');
      const probes = Object.entries(all).filter(([key]) => key.startsWith('probe:'));
      if (probes.length >= 4 || probes.filter(([, p]) => p.parent === sender.tab.id).length >= 2) return { ok: false };
      if (probes.some(([, p]) => p.parent === sender.tab.id && p.url === url)) return { ok: true };
      // Start on an inert extension page, persist attribution, then navigate so a
      // fast content script can never run before its probe identity is saved.
      const tab = await chrome.tabs.create({ url: chrome.runtime.getURL('probe.html'), active: false });
      await chrome.storage.session.set({ [`probe:${tab.id}`]: { parent: sender.tab.id, parentPage, url, created: Date.now(), filename: String(request.filename || '').slice(0, 512) } });
      try {
        const navigated=await chrome.tabs.update(tab.id, { url });
        // Chrome may leave a newly created inactive tab unloaded. Starting its
        // pending document explicitly keeps discovery independent of focus.
        if(navigated.status==='unloaded')await chrome.tabs.reload(tab.id);
      } catch(error) {
        await chrome.storage.session.remove(`probe:${tab.id}`);
        await chrome.tabs.remove(tab.id).catch(()=>{});throw error;
      }
      return { ok: true };
    }
    if (request?.type === 'probe-result') {
      if (!trustedPage(sender)) throw new Error('Invalid checksum subpage.');
      const key = `probe:${sender.tab.id}`;
      const probe = (await chrome.storage.session.get(key))[key];
      if (!probe) throw new Error('No pending checksum subpage.');
      const parent = await chrome.tabs.get(probe.parent).catch(() => null);
      // A same-origin redirect is permitted, but parent navigation invalidates it.
      if (parent && C.canonicalURL(parent.url) === probe.parentPage && new URL(sender.url).origin === new URL(probe.url).origin) {
        const entries = Array.isArray(request.entries) ? request.entries.slice(0, 2000).filter(C.validEntry).map(e => ({
          algorithm: e.algorithm, value: e.value.toLowerCase(), filename: String(e.filename || probe.filename || '').slice(0, 512),
          source: C.canonicalURL(sender.url), inferred: !!e.inferred
        })) : [];
        await chrome.tabs.sendMessage(probe.parent, { type: 'linked-checksums', entries }).catch(() => {});
      }
      await chrome.storage.session.remove(key);
      await chrome.tabs.remove(sender.tab.id).catch(() => {});
      return { ok: true };
    }
    if (request?.type === 'register') {
      // An isolated world's sender.url can retain the original URL after a
      // same-document history change. Chrome's tab URL is authoritative here.
      const original = C.canonicalURL(sender.url);
      const page = C.canonicalURL(sender.tab?.url) || original;
      if (!sender.tab || sender.frameId !== 0 || !page || !original || new URL(page).origin !== new URL(original).origin || C.canonicalURL(request.page) !== page) throw new Error('Invalid source page.');
      if (!Array.isArray(request.records)) throw new Error('Invalid checksum records.');
      if (!(await getSettings()).enabled) return { ok: false };
      let budget = 0;
      const records = request.records.slice(0, 300).flatMap(record => {
        const url = C.canonicalURL(record?.url);
        if (!url || !Array.isArray(record.entries)) return [];
        const entries = record.entries.slice(0, 32).filter(C.validEntry).map(e => cleanEntry(e, page));
        budget += JSON.stringify({ url, entries }).length;
        return entries.length && budget <= 250000 ? [{ url, entries }] : [];
      });
      const entries = (Array.isArray(request.entries) ? request.entries : []).slice(0, 2000).filter(C.validEntry).filter(e => e.filename).flatMap(e => {
        const entry = cleanEntry(e, page);
        budget += JSON.stringify(entry).length;
        return budget <= 250000 ? [entry] : [];
      });
      const files = (Array.isArray(request.files) ? request.files : []).slice(0, 200).flatMap(file => {
        const url = C.canonicalURL(file?.url);
        if (!url || !C.isDownloadURL(url)) return [];
        const entry = { url, checksumURL: C.sidecarInfo(file.checksumURL)?.url || '', foundIn: ['Page link', 'Hidden link', 'Page code', 'HTML attribute', 'Checksum link', 'Publisher catalog'].includes(file.foundIn) ? file.foundIn : 'Page code' };
        budget += JSON.stringify(entry).length;
        return budget <= 250000 ? [entry] : [];
      });
      const documents = (Array.isArray(request.documents) ? request.documents : []).slice(0, 8).map(C.canonicalURL).filter(url => url && new URL(url).origin === new URL(page).origin);
      const scan = request.scan && typeof request.scan === 'object' ? {
        phase: ['scanning', 'fetching', 'complete'].includes(request.scan.phase) ? request.scan.phase : 'complete',
        contexts: Math.min(32, Math.max(0, Number(request.scan.contexts) || 0)),
        checksumSources: Math.min(16, Math.max(0, Number(request.scan.checksumSources) || 0))
      } : null;
      await chrome.storage.session.set({ [`page:${sender.tab.id}`]: { page, records, entries, files, documents, scan, updated: Date.now() } });
      const pages = Object.entries(await chrome.storage.session.get(null)).filter(([key]) => key.startsWith('page:')).sort((a, b) => b[1].updated - a[1].updated);
      if (pages.length > 20) await chrome.storage.session.remove(pages.slice(20).map(([key]) => key));
      // A checksum manifest can finish after a very small download.
      const all = await chrome.storage.session.get(null);
      for (const [key, job] of Object.entries(all)) {
        if (key.startsWith('job:') && !['downloading', 'interrupted', 'deleted', 'blocked', 'canceled'].includes(job.status) && Date.now() - job.created < 30000 &&
          C.canonicalURL(job.referrer) === page) {
          const association = await associate(job);
          if (association && JSON.stringify(association.entries) !== JSON.stringify(job.entries)) {
            if (job.status === 'hashing') { job.needsRecheck = true; await saveJob(job); }
            else if (job.status === 'held') {
              job.entries = mergeEntries(job.entries, association.entries);
              const [item] = await chrome.downloads.search({ id: job.id });
              const settings = await getSettings();
              if (job.heldBy === 'policy' && item?.state === 'in_progress' && settings.blockMode === 'require-checksum' && C.downloadDecision(item, job.entries, settings, C.ALGORITHMS).action === 'allow') {
                await chrome.downloads.resume(job.id); job.status = 'downloading'; job.blockReason = '';
              }
              await saveJob(job);
            }
            else await completed(job.id, true);
          }
        }
      }
      return { ok: true };
    }
    if (request?.type === 'hash-result' || request?.type === 'hash-progress') {
      if (sender.url !== chrome.runtime.getURL('offscreen.html') || sender.tab) throw new Error('Invalid hash sender.');
      const job = await getJob(request.id);
      if (!job || job.status !== 'hashing') return { ok: false };
      if (request.type === 'hash-progress') {
        job.progress = Math.max(0, Math.min(100, Number(request.progress) || 0)); await saveJob(job);
      } else if (request.error) {
        job.status = 'manual'; job.error = request.error; await saveJob(job);
        await announceResult(job);
      } else {
        if (job.needsRecheck) {
          // New evidence arrived during hashing. Keep the checking state visible
          // until all required algorithms have been calculated for that evidence.
          job.needsRecheck=false;job.progress=0;job.error='';
          await saveJob(job);await completed(job.id,true);
        } else {
          const result = C.verify(job.entries, request.digests || {});
          Object.assign(job, result, { progress: 100, error: '' });await saveJob(job);
          await announceResult(job);
        }
      }
      return { ok: true };
    }
    if (!trustedUI(sender)) throw new Error('This action is only available in the extension popup.');
    switch (request?.type) {
      case 'open-report': {
        const panel = ['downloads', 'files', 'verify', 'settings'].includes(request.panel) ? request.panel : 'downloads';
        const params = new URLSearchParams({ panel });
        if (Number.isSafeInteger(request.id) && request.id >= 0) params.set('download', String(request.id));
        await chrome.tabs.create({ url: chrome.runtime.getURL('report.html') + '?' + params.toString() });
        return { ok: true };
      }
      case 'dismiss-result': {
        const job = await getJob(request.id);
        if (job && job.resultAt === request.resultAt) { job.resultDismissedAt = job.resultAt; await saveJob(job); }
        return { ok: true };
      }
      case 'get-settings': return { settings: await getSettings() };
      case 'save-settings': {
        const settings = C.sanitizeSettings(request.settings);
        await chrome.storage.local.set({ settings });
        const all = await chrome.storage.session.get(null);
        for (const key of Object.keys(all).filter(key => key.startsWith('page:'))) chrome.tabs.sendMessage(Number(key.slice(5)), { type: 'settings-changed', settings }).catch(() => {});
        return { ok: true, settings };
      }
      case 'open-extension-settings':
        await chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }); return { ok: true };
      case 'rescan-page': {
        if (!Number.isSafeInteger(request.tabId)) throw new Error('Open or reload a publisher’s download page first.');
        await chrome.tabs.sendMessage(request.tabId, { type: 'rescan' });
        return { ok: true };
      }
      case 'history': {
        const all = await chrome.storage.session.get(null);
        const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        const pages = Object.entries(all).filter(([key]) => key.startsWith('page:')).map(([key, page]) => ({ ...page, tabId: Number(key.slice(5)) })).sort((a, b) => b.updated - a.updated);
        const active = pages.find(page => page.tabId === tabs[0]?.id) || pages[0] || null;
        return { jobs: Object.entries(all).filter(([key]) => key.startsWith('job:')).map(([, job]) => job).sort((a, b) => b.created - a.created), page: active, settings: await getSettings(), fileAccess: await chrome.extension.isAllowedFileSchemeAccess() };
      }
      case 'download-file': {
        if (!(await getSettings()).enabled) throw new Error('Turn on protection before using Download & verify.');
        const page = (await chrome.storage.session.get(`page:${request.tabId}`))[`page:${request.tabId}`];
        const file = page?.files?.find(file => file.url === C.canonicalURL(request.url));
        if (!file) throw new Error('This file is no longer registered. Reload the publisher page.');
        const id = await chrome.downloads.download({ url: file.url });
        await chrome.storage.session.set({ [`intent:${id}`]: { page: page.page } });
        return { ok: true, id };
      }
      case 'pause-download':
      case 'resume-download':
      case 'cancel-download': {
        const job = await getJob(request.id);
        const [item] = await chrome.downloads.search({ id: request.id });
        if (!job || item?.state !== 'in_progress') throw new Error('This download is no longer active.');
        if (request.type === 'resume-download') {
          if (C.downloadDecision(item, job.entries, await getSettings(), C.ALGORITHMS).action === 'cancel') throw new Error('Remove the host block or resolve Chrome’s danger warning before resuming.');
          await chrome.downloads.resume(job.id); job.status = 'downloading'; job.allowedOnce = true; job.blockReason = '';
        } else if (request.type === 'cancel-download') {
          await chrome.downloads.cancel(job.id); job.status = 'canceled'; job.blockReason = 'Canceled by you.';
        } else {
          await chrome.downloads.pause(job.id); job.status = 'held'; job.heldBy = 'user'; job.blockReason = 'Paused by you.';
        }
        await saveJob(job); return { ok: true };
      }
      case 'block-host': {
        const job = await getJob(request.id);
        if (!job) throw new Error('Unknown download.');
        const host = new URL(job.finalUrl || job.url).hostname;
        const settings = await getSettings();
        settings.blockedHosts = [...new Set([...settings.blockedHosts, host])];
        await chrome.storage.local.set({ settings: C.sanitizeSettings(settings) });
        const [item] = await chrome.downloads.search({ id: job.id });
        if (item?.state === 'in_progress') await applyDownloadPolicy(job, item, settings);
        return { ok: true, host };
      }
      case 'retry': {
        const job = await getJob(request.id);
        if (!job || ['downloading', 'finding', 'hashing', 'held', 'blocked', 'canceled', 'deleted'].includes(job.status)) throw new Error('This download cannot be retried now.');
        job.announcedResult = ''; job.resultAt = 0; job.resultDismissedAt = 0;
        lookupJob(job);
        job.status = 'manual'; await saveJob(job); await completed(request.id); return { ok: true };
      }
      case 'delete': {
        const job = await getJob(request.id);
        if (!job || !['mismatch', 'conflict'].includes(job.status)) throw new Error('Only a tracked mismatched download can be deleted.');
        await chrome.downloads.removeFile(job.id);
        job.status = 'deleted'; await saveJob(job); return { ok: true };
      }
      case 'clear': {
        const all = await chrome.storage.session.get(null);
        await chrome.storage.session.remove(Object.keys(all).filter(k => k.startsWith('job:') && !['downloading', 'finding', 'hashing', 'held'].includes(all[k].status) && !all[k].lookupPending));
        await chrome.action.setBadgeText({ text: '' }); return { ok: true };
      }
      default: throw new Error('Unknown message.');
    }
  }).then(respond, error => respond({ error: error.message }));
  return true;
});
async function recover() {
  const all = await chrome.storage.session.get(null);
  for (const [key, value] of Object.entries(all)) {
    if (key.startsWith('probe:') && Date.now() - value.created > 20000) {
      await chrome.tabs.remove(Number(key.slice(6))).catch(() => {});
      await chrome.storage.session.remove(key);
    }
    if (key.startsWith('page:') && Date.now() - value.updated >= TTL) await chrome.storage.session.remove(key);
    if (key.startsWith('job:') && (value.lookupPending || value.status === 'finding') && Date.now() - value.updated > 90000) {
      value.lookupPending = false;
      if (value.status === 'finding') value.status = 'unverified';
      await saveJob(value); lookupJob(value);
      if (!C.sidecarCandidates(value).some(url => !(value.lookedUp || []).includes(url))) await announceResult(value);
    }
    if (key.startsWith('job:') && (value.status === 'downloading' || (value.status === 'hashing' && Date.now() - value.updated > 90000))) await completed(value.id);
  }
  const current = await chrome.storage.session.get(null);
  if (!Object.values(current).some(value => value.status === 'hashing')) {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (contexts.length) await chrome.offscreen.closeDocument();
  }
}
chrome.runtime.onInstalled.addListener(details => {
  serial(async () => {
    if(details.reason==='update'&&/^0\.|^1\.[0-3]\./.test(details.previousVersion||'')){
      const settings=await getSettings();
      await chrome.storage.local.set({settings:{...settings,theme:'light'}});
    }
    await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    await chrome.alarms.create('recover', { periodInMinutes: 1 });
    await recover();
    if (details.reason === 'install' && !(await chrome.extension.isAllowedFileSchemeAccess())) {
      const language = chrome.i18n.getUILanguage().startsWith('fr') ? 'fr' : 'en';
      await chrome.tabs.create({ url: chrome.runtime.getURL(`settings/${language}/instructions.html`) });
    }
  });
});
chrome.runtime.onStartup.addListener(() => { serial(async () => { await chrome.alarms.create('recover', { periodInMinutes: 1 }); await recover(); }); });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'recover') serial(recover); });
