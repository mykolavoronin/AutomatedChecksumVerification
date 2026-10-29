/* Runs in Chrome's isolated content-script world. Page data is always untrusted. */
(() => {
  'use strict';
  const C = ChecksumCore;
  const MAX_TEXT = 2 * 1024 * 1024;
  let timer;
  let generation = 0;
  let lastSignature = '';
  let lastAcknowledged = 0;
  let lastPage = location.href;
  let contexts = [];
  let scanState = { phase: 'scanning', contexts: 1, checksumSources: 0 };
  const observedRoots = new WeakSet();
  const observedFrames = new WeakSet();
  const sidecars = new Map();
  const nestedSources = new Set();
  let manifestEntries = [];
  let linkedEntries = [];
  let namedEntries = [];
  let discoveredFiles = [];
  let settings = { ...C.DEFAULT_SETTINGS };
  let catalogFiles = [];
  let catalogEntries = [];
  let catalogLoaded = false;
  let isProbe = false;
  let probeReportTimer;
  const clicked = new WeakSet();
  let clickBudget = 8;
  const requestedProbes = new Set();
  const ALGO_SUFFIX = '(?:md5|sha1|sha224|sha256|sha384|sha512|sha512-224|sha512-256|sha3-(?:224|256|384|512)|blake2b(?:128|160|224|256|384|512)?|blake2s(?:128|160|224|256)?|shake128-(?:128|256)|shake256-(?:256|512)|blake3|b3|ripemd160|keccak256|crc32|sfv)';
  function scanContexts() {
    const found = [{ root: document, doc: document, source: location.href }];
    for (let index = 0; index < found.length && found.length < 32; index++) {
      const context = found[index];
      if (!observedRoots.has(context.root)) {
        observedRoots.add(context.root);
        new MutationObserver(schedule).observe(context.root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['href', 'download', 'integrity', 'data-url', 'data-download-url', 'data-href', 'data-download', 'data-checksum', 'data-hash', 'data-checksum-value', 'data-md5', 'data-sha1', 'data-sha256', 'data-sha512', 'data-blake3', 'onclick'] });
      }
      for (const element of Array.from(context.root.querySelectorAll('*')).slice(0, 8000)) {
        if (element.shadowRoot && !found.some(item => item.root === element.shadowRoot)) found.push({ ...context, root: element.shadowRoot });
        if (element.tagName === 'IFRAME') {
          if (!observedFrames.has(element)) { observedFrames.add(element); element.addEventListener('load', schedule); }
          try {
            const doc = element.contentDocument;
            if (doc?.body && (new URL(doc.URL).origin === location.origin || ['about:srcdoc', 'about:blank'].includes(doc.URL)) && !found.some(item => item.root === doc)) found.push({ root: doc, doc, source: doc.URL.startsWith('about:') ? context.source : doc.URL });
          } catch { /* Cross-origin frame contents are intentionally inaccessible. */ }
        }
        if (found.length >= 32) break;
      }
    }
    return found.slice(0, 32);
  }
  function elements(selector) { return contexts.flatMap(context => [...context.root.querySelectorAll(selector)]).slice(0, 2500); }
  function dedupeEntries(entries) {
    const selected = new Map();
    const score = entry => (entry.inferred ? 0 : 4) + (entry.filename ? 2 : 0) + (entry.format === 'HTML table' ? 1 : 0);
    for (const entry of entries) {
      const key = `${entry.algorithm}:${entry.value}`, previous = selected.get(key);
      if (!previous || score(entry) > score(previous)) selected.set(key, entry);
    }
    return [...selected.values()].slice(0, 32);
  }
  function checksumLabel(label, link = false) {
    const prefix = link ? /^(?:view|show|download|verify|see)\s+/i : /^(?:show|view|reveal|display|expand)\s+/i;
    const name = label.trim().replace(prefix, '').replace(/^file\s+/i, '').replace(/\s+(?:checksums?|hashes|digests|file|verification)$/i, '').trim();
    return /^(?:checksums?|hashes|digests)$/i.test(name) || Object.hasOwn(C.ALGORITHMS, C.normalizeAlgorithm(name));
  }
  const isSidecar = url => /(?:^|\/)[\w.-]*(?:checksums?|sums)(?:\.txt)?$/i.test(new URL(url).pathname) || new RegExp('\\.' + ALGO_SUFFIX + '(?:\\.txt)?$', 'i').test(new URL(url).pathname);
  function isChecksumLink(link) {
    const url = C.canonicalURL(link.href);
    if (!url) return false;
    if (new URL(url).origin !== location.origin) return settings.crossOriginChecksums && !!C.sidecarInfo(url) && C.isPublicHTTPS(url);
    const label = (link.textContent || '').trim();
    return !!C.sidecarInfo(url) || isSidecar(url) || checksumLabel(label, true);
  }
  function codeEntries(doc, source) {
    const result = [];
    for (const script of Array.from(doc.querySelectorAll('script')).slice(0, 100)) {
      const text = (script.textContent || '').slice(0, MAX_TEXT);
      result.push(...C.parseStructuredChecksums(text, source));
      // Explicit filename-bearing checksum records in code/comments are usable;
      // arbitrary bare hex constants are not associated with a file.
      result.push(...C.parseChecksums(text, { source }).filter(e => e.filename));
    }
    return result.slice(0, 2000);
  }
  function columnAlgorithm(text) {
    const raw = text.replace(/\s+/g, ' ').trim();
    const named = C.normalizeAlgorithm(raw.replace(/checksums?|digests?|hashes?|sums?/ig, ' '));
    if (Object.hasOwn(C.ALGORITHMS, named)) return named;
    // Common download tables label the column only "Checksum" and rely on digest length.
    if (/\b(?:checksums?|digests?|hashes?|sums?)\b/i.test(raw)) return '*';
    return '';
  }
  function tableEntries(context) {
    const result = [];
    for (const table of Array.from(context.root.querySelectorAll('table')).slice(0, 30)) {
      const rows = Array.from(table.rows).slice(0, 150), headers = Array.from(rows[0]?.cells || []).map(cell => columnAlgorithm(cell.textContent || ''));
      if (!headers.some(Boolean)) continue;
      for (const row of rows.slice(1)) {
        const link = [...row.querySelectorAll('a[href]')].find(anchor => {
          const url = C.canonicalURL(anchor.href);
          return url && C.isDownloadURL(url) && !isChecksumLink(anchor);
        });
        const filename = link ? link.getAttribute('download') || C.urlFilename(link.href) : C.basename((row.cells[0]?.textContent || '').trim());
        if (!filename || (!link && !/\.[a-z\d]{1,12}$/i.test(filename))) continue;
        for (let column = 0; column < headers.length; column++) {
          const algorithm = headers[column], cell = row.cells[column];
          if (!cell || !algorithm) continue;
          const clone = cell.cloneNode(true); clone.querySelectorAll('button,script,style').forEach(node => node.remove());
          result.push(...C.parseChecksums(clone.textContent, { source: context.source, algorithm: algorithm === '*' ? '' : algorithm, filename }).map(entry => ({ ...entry, filename: entry.filename || filename, downloadURL: link ? C.canonicalURL(link.href) : '', format: 'HTML table' })));
        }
        if (result.length >= 2000) return result.slice(0, 2000);
      }
    }
    return result;
  }
  function revealChecksums() {
    if (!settings.revealChecksums) return;
    let count = 0;
    for (const control of elements('button,[role="button"],summary,input[type="button"]')) {
      if (count >= 4 || clickBudget <= 0 || clicked.has(control) || control.disabled || control.closest('form') || control.getAttribute('aria-expanded') === 'true') continue;
      const label = (control.getAttribute('aria-label') || control.textContent || control.value || '').trim();
      if (!checksumLabel(label)) continue;
      if (!control.getClientRects().length || getComputedStyle(control).visibility === 'hidden') continue;
      if (control.matches('summary') && control.parentElement?.open) continue;
      clicked.add(control); count++; clickBudget--;
      control.click();
    }
  }
  function hint(url) {
    const known = C.sidecarInfo(url);
    if (known?.algorithm) return known.algorithm;
    const name = C.urlFilename(url);
    const m = name.match(new RegExp('(?:^|[._-])(' + ALGO_SUFFIX + ')(?:sums?|\\.txt)?$', 'i')) || name.match(new RegExp('^(' + ALGO_SUFFIX + ')SUMS', 'i'));
    return m ? ({ sfv: 'crc32', b3: 'blake3' }[m[1].toLowerCase()] || m[1]) : '';
  }
  function targetFilename(link) {
    const known = C.sidecarInfo(link.href);
    if (known?.fileURL) return known.filename;
    const stripped = C.urlFilename(link.href).replace(new RegExp('\\.' + ALGO_SUFFIX + '(?:\\.txt)?$', 'i'), '');
    if (stripped !== C.urlFilename(link.href)) return stripped;
    for (let parent = link.parentElement, depth = 0; parent && parent !== document.body && depth < 3; parent = parent.parentElement, depth++) {
      const targets = [...parent.querySelectorAll('a[href]')].filter(a => C.canonicalURL(a.href) && !isChecksumLink(a));
      if (targets.length === 1) return targets[0].getAttribute('download') || C.urlFilename(targets[0].href);
      if (targets.length > 1) break;
    }
    return '';
  }
  function looksProvisional(text, entries) {
    if (entries.length) return false;
    const sample = text.replace(/\s+/g, ' ').trim().slice(0, 1500);
    if (!sample || sample.length > 800) return false;
    return /\b(?:loading|please wait|calculating|generating|preparing|one moment)\b/i.test(sample);
  }
  async function readSidecar(url, target = '', depth = 0) {
    const cacheKey = `${url}|${target}|${depth}`;
    if (sidecars.has(cacheKey)) return sidecars.get(cacheKey);
    const promise = (async () => {
      const outcome = await loadSidecar(url, target, depth);
      if (!outcome.provisional) return outcome.entries;
      const attempts = (readSidecar.retries.get(url) || 0) + 1;
      readSidecar.retries.set(url, attempts);
      if (attempts <= 4) setTimeout(() => { sidecars.delete(cacheKey); schedule(); }, 1200);
      return [];
    })();
    sidecars.set(cacheKey, promise);
    try { return await promise; }
    catch { sidecars.delete(cacheKey); return []; }
  }
  readSidecar.retries = new Map();
  async function loadSidecar(url, target = '', depth = 0) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const outcome = await fetchSidecarOnce(url, target, depth);
      if (!outcome.provisional || attempt === 3) return outcome;
      await new Promise(resolve => setTimeout(resolve, 700));
    }
    return { entries: [], provisional: false };
  }
  async function fetchSidecarOnce(url, target = '', depth = 0) {
    const finish = (entries, text = '') => ({ entries, provisional: looksProvisional(text, entries) });
    try {
      if (C.sidecarInfo(url)) {
        const result = await chrome.runtime.sendMessage({ type: 'fetch-checksum', url });
        if (!result?.error) return finish((result?.entries || []).filter(C.validEntry));
        // A generic checksum URL may be an interactive HTML page.
        // Same-origin pages stay available for DOM discovery. A loading placeholder is retried.
        if (new URL(url).origin !== location.origin) return finish([]);
      }
      const response = await fetch(url, { credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok || Number(response.headers.get('content-length')) > MAX_TEXT) return finish([]);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let text = '', size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_TEXT) { await reader.cancel(); return finish([]); }
          text += decoder.decode(value, { stream: true });
        }
      } finally { reader.releaseLock(); }
      text += decoder.decode();
      const contentType = response.headers.get('content-type') || '';
      if (/html/i.test(contentType) || /^\s*<!doctype|^\s*<html/i.test(text)) {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const embedded = codeEntries(doc, url);
        const interactive = !!doc.querySelector('script,button,[role="button"],summary');
        doc.querySelectorAll('script,style,noscript').forEach(element => element.remove());
        const visible = pageText(doc);
        const entries = [...C.parseChecksums(visible, { source: url, filename: target }), ...embedded];
        if(depth===0){
          const children=[];
          for(const anchor of Array.from(doc.querySelectorAll('a[href]')).slice(0,200)){
            let child;try{child=C.canonicalURL(new URL(anchor.getAttribute('href'),url).href);}catch{continue;}
            if(!child||child===url||!C.sidecarInfo(child))continue;
            if(new URL(child).origin!==location.origin&&(!settings.crossOriginChecksums||!C.isPublicHTTPS(child)))continue;
            if(!nestedSources.has(child)&&nestedSources.size>=4)continue;
            nestedSources.add(child);children.push(child);if(children.length>=4)break;
          }
          entries.push(...(await Promise.all([...new Set(children)].map(child=>readSidecar(child,target,1)))).flat());
        }
        if (depth===0 && interactive && settings.linkedPages && !isProbe && requestedProbes.size < 2 && !requestedProbes.has(url)) {
          requestedProbes.add(url);
          chrome.runtime.sendMessage({ type: 'load-checksum-page', url, filename: target }).catch(() => {});
        }
        return finish(entries, visible);
      }
      const sidecarName = C.urlFilename(url).replace(new RegExp('\\.' + ALGO_SUFFIX + '(?:\\.txt)?$', 'i'), '');
      const filename = sidecarName !== C.urlFilename(url) ? sidecarName : target;
      const entries = [...C.parseChecksums(text, { source: url, algorithm: hint(url), filename }), ...C.parseStructuredChecksums(text, url)];
      return finish(entries, text);
    } catch {
      // Navigation can resolve same-origin checksum redirects and session-backed
      // pages that a cookie-free text request cannot read. The worker validates
      // the final origin and never allows nested crawling.
      if (depth===0 && settings.linkedPages && !isProbe && new URL(url).origin === location.origin && requestedProbes.size < 2 && !requestedProbes.has(url)) {
        requestedProbes.add(url);
        chrome.runtime.sendMessage({ type: 'load-checksum-page', url, filename: target }).catch(() => {});
      }
      return finish([]);
    }
  }
  function pageText(input = document) {
    const doc = input.doc || input, root = input.root || doc.body;
    if (!root) return '';
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('script,style,noscript,textarea,input,[hidden],[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    let text = '', node, count = 0;
    let lastBlock = null;
    while ((node = walker.nextNode()) && text.length < MAX_TEXT && count++ < 50000) {
      const block = node.parentElement?.closest('pre,p,li,tr,td,div,section,article,dd,dt,h1,h2,h3,h4');
      if (text && block !== lastBlock) text += '\n';
      text += node.textContent;
      if (node.parentElement?.tagName === 'BR') text += '\n';
      lastBlock = block;
    }
    return text.slice(0, MAX_TEXT);
  }
  function discoverFiles() {
    const files = new Map();
    const add = (value, foundIn) => {
      let url;
      try { url = C.canonicalURL(new URL(value, location.href).href); } catch { return; }
      if (!url) return;
      const checksum = C.sidecarInfo(url);
      const fileURL = checksum?.fileURL || url;
      if (!C.isDownloadURL(fileURL)) return;
      const previous = files.get(fileURL);
      files.set(fileURL, { url: fileURL, checksumURL: checksum?.url || previous?.checksumURL || '', foundIn: previous?.foundIn || (checksum ? 'Checksum link' : foundIn) });
    };
    for (const element of elements('a[href],area[href],link[href],[data-url],[data-download-url],[data-href],[data-download]')) {
      for (const attr of ['href', 'data-url', 'data-download-url', 'data-href', 'data-download']) {
        const value = element.getAttribute(attr);
        if (value) { try { add(new URL(value, element.ownerDocument.baseURI).href, attr === 'href' ? (element.getClientRects().length ? 'Page link' : 'Hidden link') : 'HTML attribute'); } catch { /* Invalid URL attribute. */ } }
      }
    }
    for (const file of contexts.flatMap(context => C.discoverURLs(context.root === context.doc ? context.doc.documentElement.outerHTML : context.root.innerHTML, context.source)).slice(0, 200)) {
      if (!files.has(file.url)) files.set(file.url, file);
      else if (file.checksumURL && !files.get(file.url).checksumURL) files.get(file.url).checksumURL = file.checksumURL;
    }
    for (const file of catalogFiles) if (!files.has(file.url)) files.set(file.url, file);
    return [...files.values()].slice(0, 200);
  }
  function collect() {
    if (!document.body) return [];
    const allEntries = contexts.flatMap(context => [...tableEntries(context), ...C.parseChecksums(pageText(context), { source: context.source }), ...codeEntries(context.root, context.source)]).slice(0, 2000);
    namedEntries = [...allEntries, ...manifestEntries, ...linkedEntries, ...catalogEntries].filter(e => e.filename).slice(0, 2000);
    const records = new Map();
    const byName = new Map();
    const nameTargets = new Map();
    for (const file of discoveredFiles) {
      const name = C.urlFilename(file.url);
      if (!nameTargets.has(name)) nameTargets.set(name, new Set());
      nameTargets.get(name).add(file.url);
    }
    const entriesForURL = (name, url) => (byName.get(name) || []).filter(entry => entry.downloadURL ? entry.downloadURL === url : (nameTargets.get(name)?.size || 0) <= 1);
    for (const entry of namedEntries) {
      const key = C.basename(entry.filename);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(entry);
    }
    for (const link of elements('a[href]')) {
      const url = C.canonicalURL(link.href);
      if (!url || isChecksumLink(link)) continue;
      const name = link.getAttribute('download') || C.urlFilename(url);
      let entries = [...entriesForURL(name, url)];
      // Only associate unlabeled local text when the container contains this one download.
      let scope = link.parentElement;
      for (let depth = 0; scope && depth < 4 && scope !== link.ownerDocument.body; depth++, scope = scope.parentElement) {
        const links = [...scope.querySelectorAll('a[href]')].filter(a => C.canonicalURL(a.href) && !isChecksumLink(a));
        const text = scope.innerText || '';
        if (links.length === 1 && text.length <= 8192) {
          entries.push(...C.forFile(C.parseChecksums(text, { source: link.ownerDocument.URL }), name, true));
        }
      }
      if (link.getAttribute('integrity')) entries.push(...C.parseChecksums(link.getAttribute('integrity'), { source: location.href }));
      for (const element of [link, link.parentElement, ...Array.from(link.parentElement?.querySelectorAll('*') || []).slice(0, 20)].filter(Boolean)) {
        if (element !== link && (link.parentElement?.querySelectorAll('a[href]').length || 0) !== 1) continue;
        for (const attr of Array.from(element.attributes).slice(0, 32)) {
          if (!attr.name.startsWith('data-')) continue;
          const key = C.normalizeAlgorithm(attr.name.slice(5).replace(/[-_](?:checksum|hash|sum)$/i, ''));
          const generic = ['data-checksum', 'data-hash', 'data-integrity', 'data-checksum-value'].includes(attr.name);
          if (!generic && !Object.hasOwn(C.ALGORITHMS, key)) continue;
          const algorithm = Object.hasOwn(C.ALGORITHMS, key) ? key : element.getAttribute('data-algorithm') || element.getAttribute('data-checksum-type') || '';
          const parsed = [...C.parseChecksums(attr.value, { source: link.ownerDocument.URL, algorithm }), ...C.parseStructuredChecksums(attr.value, link.ownerDocument.URL, name)];
          entries.push(...C.forFile(parsed, name, true));
        }
      }
      entries = dedupeEntries(entries);
      if (entries.length) {
        const previous = records.get(url) || { url, entries: [] };
        previous.entries = dedupeEntries([...previous.entries, ...entries]);
        records.set(url, previous);
      }
      if (records.size >= 300) break;
    }
    for (const file of discoveredFiles) {
      const entries = entriesForURL(C.urlFilename(file.url), file.url);
      const current = records.get(file.url);
      if (entries.length) records.set(file.url, { url: file.url, entries: dedupeEntries([...(current?.entries || []), ...entries]) });
    }
    return [...records.values()];
  }
  function register(records) {
    const documents = [...new Set(contexts.map(context => context.source))];
    const signature = JSON.stringify({ records, entries: namedEntries, files: discoveredFiles, documents, scan: scanState });
    if (signature === lastSignature && Date.now() - lastAcknowledged < 60000) return;
    chrome.runtime.sendMessage({ type: 'register', page: location.href, records, entries: namedEntries, files: discoveredFiles, documents, scan: scanState }).then(response => {
      if (response?.ok) { lastSignature = signature; lastAcknowledged = Date.now(); }
      else setTimeout(schedule, 1500);
    }).catch(() => { setTimeout(schedule, 1500); });
  }
  async function scan() {
    if (!settings.enabled) return;
    if (lastPage !== location.href) {
      lastPage = location.href; lastSignature = ''; sidecars.clear(); nestedSources.clear(); manifestEntries = []; linkedEntries = []; catalogFiles = []; catalogEntries = []; catalogLoaded = false; requestedProbes.clear();
    }
    contexts = scanContexts();
    scanState = { phase: 'scanning', contexts: contexts.length, checksumSources: 0 };
    revealChecksums();
    if (isProbe) {
      clearTimeout(probeReportTimer);
      probeReportTimer = setTimeout(() => {
        const entries = [...C.parseChecksums(document.body?.innerText || '', { source: location.href }), ...codeEntries(document, location.href)];
        chrome.runtime.sendMessage({ type: 'probe-result', entries }).catch(() => {});
      }, 2500);
      return;
    }
    const current = ++generation;
    discoveredFiles = discoverFiles();
    register(collect());
    if (!settings.linkedPages) { scanState.phase = 'complete'; register(collect()); return; }
    if (!catalogLoaded && settings.crossOriginChecksums && C.catalogForPage(location.href)) {
      catalogLoaded = true;
      try {
        const result = await chrome.runtime.sendMessage({ type: 'discover-catalog' });
        catalogFiles = result?.files || [];
        catalogEntries = (result?.entries || []).filter(C.validEntry);
        if (current !== generation) return;
        discoveredFiles = discoverFiles(); register(collect());
      } catch { /* Catalog discovery falls back to normal page and download URLs. */ }
    }
    const links = [...new Map([
      ...elements('a[href]').filter(isChecksumLink).map(a => [C.canonicalURL(a.href), targetFilename(a)]),
      ...discoveredFiles.filter(file => file.checksumURL).map(file => [file.checksumURL, C.urlFilename(file.url)])
    ]).entries()].slice(0, 8);
    scanState = { phase: links.length ? 'fetching' : 'complete', contexts: contexts.length, checksumSources: links.length }; register(collect());
    const entries = (await Promise.all(links.map(([url, target]) => readSidecar(url, target)))).flat();
    if (current === generation) { manifestEntries = entries; scanState.checksumSources=links.length+nestedSources.size; scanState.phase = 'complete'; register(collect()); }
  }
  function schedule() { clearTimeout(timer); timer = setTimeout(scan, 500); }
  document.addEventListener('click', event => {
    if (event.isTrusted && event.target.closest?.('a[href]')) {
      // Refresh immediately before a download; Chrome's download handler also rechecks registrations.
      scan();
    }
  }, true);
  window.addEventListener('popstate', schedule);
  window.navigation?.addEventListener('navigatesuccess', schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  setInterval(() => { if (!document.hidden && (location.href !== lastPage || scanContexts().length !== contexts.length)) schedule(); }, 5000);
  chrome.runtime.onMessage.addListener(request => {
    if (request?.type === 'rescan') { sidecars.clear(); nestedSources.clear(); catalogLoaded = false; lastSignature = ''; schedule(); }
    if (request?.type === 'settings-changed') { settings = C.sanitizeSettings(request.settings); sidecars.clear(); nestedSources.clear(); catalogLoaded = false; requestedProbes.clear(); lastSignature = ''; schedule(); }
    if (request?.type === 'linked-checksums' && Array.isArray(request.entries)) {
      linkedEntries = [...linkedEntries, ...request.entries.filter(C.validEntry)].slice(0, 2000); schedule();
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) { settings = C.sanitizeSettings(changes.settings.newValue); sidecars.clear(); nestedSources.clear(); catalogLoaded = false; lastSignature = ''; schedule(); }
  });
  chrome.runtime.sendMessage({ type: 'probe-context' }).then(result => { isProbe = !!result?.probe; settings = C.sanitizeSettings(result?.settings); scan(); }).catch(scan);
})();
