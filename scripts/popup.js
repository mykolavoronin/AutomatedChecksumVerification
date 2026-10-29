'use strict';
const C = ChecksumCore;
const $ = id => document.getElementById(id);
const statusLabels = { match: 'Integrity verified', 'weak-match': 'Limited-strength checksum matched — weak assurance', mismatch: 'Checksum mismatch — do not run this file', conflict: 'Conflicting publisher checksums', unverified: 'Integrity unverified', manual: 'Select the file to verify', downloading: 'Downloading', hashing: 'Computing checksums', interrupted: 'Download interrupted', deleted: 'Downloaded file deleted', held: 'Paused for approval', blocked: 'Download blocked', canceled: 'Canceled by you', error: 'Verification failed' };
const modeHelp = { dangerous: 'Automatically cancel downloads Chrome identifies as malicious or harmful. Other files download and are verified normally.', 'require-checksum': 'Pause downloads without a strong expected digest. They resume automatically when one is found, or when you choose Allow once. A digest’s presence is not proof that its file is safe.', 'hold-all': 'Pause every new download. Review it in Downloads and choose Allow once or Cancel download.', off: 'Let downloads proceed and report verification results. Your blocked-host list still applies.' };
let currentSettings = C.sanitizeSettings();
let snapshot = { jobs: [], page: null };
let settingsDirty = false;
let settingsRevision = 0;
let lastHistory = '', lastFiles = '';
let initialRouteApplied = false;
let manualActivity = '', manualOutcome = null, shownOutcome = null;
const outcomeCopy = {
  match: ['YES — Checksum matches', 'The downloaded file matches the publisher’s checksum. This confirms integrity, not that the file is malware-free.'],
  mismatch: ['NO — Checksum mismatch', 'This file does not match the expected checksum. Avoid opening it.'],
  conflict: ['NO — Conflicting checksums', 'The publisher supplied different values for the same algorithm. This file has not passed verification.'],
  unverified: ['Couldn’t verify', 'No supported checksum was found. This is an unknown result, not a match or a mismatch.'],
  manual: ['Couldn’t verify automatically', 'Choose the downloaded file in Verify a file, or enable local file access in Chrome.'],
  error: ['Couldn’t verify', 'The check could not be completed. Open the details to try again.'],
  'weak-match': ['Limited-strength checksum matches', 'The digest matches, but this algorithm or output length provides limited tamper protection.']
};
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function algorithmLabel(key) {
  if (/^shake(128|256)(128|256|512)$/.test(key)) return key.replace(/^shake(128|256)(.*)$/, 'SHAKE$1-$2');
  if (/^blake2[bs]\d/.test(key)) return key.replace(/^(blake2[bs])(.*)$/, (_, family, bits) => family.replace('blake', 'BLAKE') + '-' + bits);
  if (/^sha3\d/.test(key)) return key.replace('sha3', 'SHA3-');
  if (/^sha512\d/.test(key)) return key.replace('sha512', 'SHA-512/');
  if (/^sha\d/.test(key)) return key.replace('sha', 'SHA-');
  return ({ blake2b: 'BLAKE2b-512', blake2s: 'BLAKE2s-256', blake3: 'BLAKE3-256', ripemd160: 'RIPEMD-160', keccak256: 'Keccak-256' })[key] || key.toUpperCase();
}
function hostname(url) { try { return new URL(url).hostname; } catch { return 'Unknown source'; } }
function bytes(size) { return size >= 0 ? size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB` : ''; }
function showError(error) { $('error').textContent = error.message; $('error').hidden = false; }
function feedback(text) { $('feedback').textContent = text; }
async function send(request) {
  $('error').hidden = true;
  const response = await chrome.runtime.sendMessage(request);
  if (response?.error) throw new Error(response.error);
  return response;
}
function showPanel(name, focus = false) {
  if (name === 'files' && currentSettings.interfaceMode === 'basic') name = 'downloads';
  for (const tab of document.querySelectorAll('[role=tab]')) {
    const selected = tab.dataset.panel === name;
    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    $(tab.getAttribute('aria-controls')).hidden = !selected;
    if (selected && focus) tab.focus();
  }
  renderActivity();renderOutcome();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
for (const tab of document.querySelectorAll('[role=tab]')) {
  tab.addEventListener('click', () => showPanel(tab.dataset.panel));
  tab.addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('[role=tab]')].filter(item => item.getClientRects().length), index = tabs.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); showPanel(tabs[next].dataset.panel, true); }
  });
}
function applyInterfaceMode() {
  document.documentElement.dataset.mode = currentSettings.interfaceMode;
  $('mode-basic').setAttribute('aria-pressed', String(currentSettings.interfaceMode === 'basic'));
  $('mode-advanced').setAttribute('aria-pressed', String(currentSettings.interfaceMode === 'advanced'));
  $('mode-description').textContent = currentSettings.interfaceMode === 'basic' ? 'Automatic checks, clear results.' : 'File discovery and detailed controls.';
  if (currentSettings.interfaceMode === 'basic') {
    $('search').value = ''; $('filter').value = 'all';
    if ($('tab-files').getAttribute('aria-selected') === 'true') showPanel('downloads');
  }
}
for (const mode of ['basic', 'advanced']) $('mode-' + mode).addEventListener('click', async () => {
  try { currentSettings = (await send({ type: 'save-settings', settings: { ...currentSettings, interfaceMode: mode } })).settings; applyInterfaceMode(); await refresh(); } catch (error) { showError(error); }
});
function theme(value) {
  document.documentElement.dataset.theme = value;
}
function fillSettings(settings) {
  for (const key of ['linkedPages', 'crossOriginChecksums', 'guessSidecars', 'revealChecksums', 'notifications', 'resultPopups', 'downloadPanels']) $('settings-form').elements.namedItem(key).checked = settings[key];
  $('block-mode').value = settings.blockMode;
  $('blocked-hosts').value = settings.blockedHosts.join('\n');
  $('theme').value = settings.theme;
  $('history-limit').value = String(settings.historyLimit);
  $('mode-help').textContent = modeHelp[settings.blockMode];
}
$('settings-form').addEventListener('input', () => { settingsRevision++; settingsDirty = true; $('settings-status').textContent = 'Unsaved changes'; $('mode-help').textContent = modeHelp[$('block-mode').value]; });
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const revision = settingsRevision;
  const blockedHosts = $('blocked-hosts').value.split(/[\s,]+/).filter(Boolean).map(host => host.toLowerCase());
  const settings = { ...currentSettings, blockMode: $('block-mode').value, theme: $('theme').value, historyLimit: Number($('history-limit').value), blockedHosts };
  for (const key of ['linkedPages', 'crossOriginChecksums', 'guessSidecars', 'revealChecksums', 'notifications', 'resultPopups', 'downloadPanels']) settings[key] = $('settings-form').elements.namedItem(key).checked;
  if (C.sanitizeSettings(settings).blockedHosts.length !== new Set(blockedHosts).size) { showError(new Error('Use exact hostnames without a URL path, port, or wildcard. Maximum: 100 hosts.')); return; }
  $('save-settings').disabled = true;
  try {
    currentSettings = (await send({ type: 'save-settings', settings })).settings;
    theme(currentSettings.theme);
    settingsDirty = revision !== settingsRevision;
    if (!settingsDirty) fillSettings(currentSettings);
    $('settings-status').textContent = settingsDirty ? 'Unsaved changes' : 'Settings saved'; await refresh();
  } catch (error) { showError(error); } finally { $('save-settings').disabled = false; }
});
$('reset-settings').addEventListener('click', async () => {
  if (!confirm('Restore all protection settings and clear the blocked-host list?')) return;
  try { currentSettings = (await send({ type: 'save-settings', settings: C.DEFAULT_SETTINGS })).settings; settingsDirty = false; fillSettings(currentSettings); theme(currentSettings.theme); $('settings-status').textContent = 'Defaults restored'; await refresh(); } catch (error) { showError(error); }
});
$('protection-toggle').addEventListener('click', async () => {
  try { currentSettings = (await send({ type: 'save-settings', settings: { ...currentSettings, enabled: !currentSettings.enabled } })).settings; await refresh(); } catch (error) { showError(error); }
});
$('open-permissions').addEventListener('click', () => send({ type: 'open-extension-settings' }).catch(showError));
function action(label, type, id, className = 'secondary') {
  const button = node('button', label, className); button.type = 'button'; button.dataset.action = `${id}:${type}`;
  ChecksumIcons.decorate(button, ({pause:'pause',resume:'play',cancel:'stop',retry:'retry',delete:'trash','allow-once':'check','block-host':'shield'})[type] || 'report');
  button.addEventListener('click', async () => {
    button.disabled = true;
    try { await send({ type, id }); await refresh(); } catch (error) { showError(error); } finally { button.disabled = false; }
  });
  return button;
}
function empty(title, description) { const el = node('div', '', 'empty'); el.append(node('h3', title), node('p', description)); return el; }
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
function meterTrack(mode, value, label) {
  const track = node('div', '', 'meter-track');
  track.append(node('span', '', 'meter-bar'));
  paintMeter(track, mode, value, label);
  track.setAttribute('role', 'progressbar');
  track.setAttribute('aria-valuemin', '0');
  track.setAttribute('aria-valuemax', '100');
  return track;
}
function renderActivity() {
  const panel=document.querySelector('[role=tab][aria-selected=true]')?.dataset.panel;
  const jobs = snapshot.jobs.filter(job => ['downloading', 'finding', 'hashing'].includes(job.status) || ((job.lookupPending || job.needsRecheck) && !['held', 'blocked', 'canceled', 'deleted', 'interrupted'].includes(job.status)));
  const active = (panel==='downloads'||panel==='verify') && Boolean(manualActivity || jobs.length);
  $('verification-activity').hidden = !active;
  $('verification-activity').setAttribute('aria-busy', String(active));
  if (manualActivity) {
    const percent = Number(manualActivity.match(/(\d+)%$/)?.[1]);
    const named = Number.isFinite(percent);
    $('activity-title').textContent = named ? `Verifying your file… ${percent}%` : 'Verifying your file…';
    $('activity-detail').textContent = manualActivity.replace(/ · \d+%$/, '');
    paintSteps($('activity-steps'), 'verify', true);
    paintMeter($('activity-progress'), named ? 'determinate' : 'indeterminate', percent, 'Local checksum calculation');
    return;
  }
  if (!jobs.length) return;
  const job = jobs.find(item => item.status === 'hashing') || jobs[0];
  const stage = job.status === 'downloading' ? 'download' : job.status === 'hashing' ? 'verify' : 'find';
  const phase = snapshot.page?.scan?.phase;
  const findingTitle = phase === 'scanning' ? 'Scanning this page…' : phase === 'fetching' ? 'Reading checksum links…' : 'Finding the publisher’s checksum…';
  $('activity-title').textContent = stage === 'download' ? 'Downloading your file…' : stage === 'verify' ? `Verifying checksum… ${job.progress || 0}%` : findingTitle;
  const name = C.basename(job.filename || '') || C.urlFilename(job.url);
  const others = jobs.length > 1 ? ` · ${jobs.length} checks running` : '';
  const next = stage === 'download' ? ' · Verification starts when the download finishes.' : stage === 'find' ? ' · No result until a checksum is found.' : '';
  $('activity-detail').textContent = `${name}${others}${next}`;
  paintSteps($('activity-steps'), stage, true);
  paintMeter($('activity-progress'), stage === 'verify' ? 'determinate' : 'indeterminate', job.progress || 0, stage === 'verify' ? 'Local checksum calculation' : stage === 'download' ? 'Download in progress' : 'Checksum search in progress');
}
function renderOutcome() {
  const panel=document.querySelector('[role=tab][aria-selected=true]')?.dataset.panel;
  const latest = snapshot.jobs.filter(job => outcomeCopy[job.status] && job.resultAt && !job.lookupPending && !job.needsRecheck).sort((a, b) => b.resultAt - a.resultAt)[0];
  const newerCheck = latest && snapshot.jobs.some(job => (['downloading', 'finding', 'hashing'].includes(job.status) || job.lookupPending || job.needsRecheck) && job.created > latest.resultAt);
  shownOutcome = panel==='verify' ? manualOutcome : panel==='downloads' ? (!manualActivity && latest && !newerCheck && latest.resultDismissedAt !== latest.resultAt ? latest : null) : null;
  $('result-popup').hidden = !shownOutcome;
  if (!shownOutcome) return;
  $('result-popup').dataset.outcome = shownOutcome.status;
  $('result-title').textContent = outcomeCopy[shownOutcome.status][0];
  $('result-file').textContent = C.basename(shownOutcome.filename || '') || C.urlFilename(shownOutcome.url || '');
  $('result-description').textContent = shownOutcome.error || outcomeCopy[shownOutcome.status][1];
}
$('dismiss-result').addEventListener('click', async () => {
  if (!shownOutcome) return;
  if (shownOutcome.manual) { manualOutcome = null; renderOutcome(); return; }
  try { await send({ type: 'dismiss-result', id: shownOutcome.id, resultAt: shownOutcome.resultAt }); await refresh(); } catch (error) { showError(error); }
});
$('view-result').addEventListener('click', () => {
  if (!shownOutcome) return;
  if (shownOutcome.manual) { showPanel('verify'); $('manual-result').scrollIntoView({ block: 'nearest' }); return; }
  showPanel('downloads'); $('search').value = ''; $('filter').value = 'all'; lastHistory = ''; renderHistory();
  const article = [...$('history').querySelectorAll('article.job')].find(item => item.dataset.job === String(shownOutcome.id));
  const details = article?.querySelector('details');
  if (details) { details.open = true; details.querySelector('summary').focus(); article.scrollIntoView({ block: 'nearest' }); }
});
function digestBlock(algorithm, text, value) {
  const el = node('div', '', 'digest'), head = node('div', '', 'digest-head');
  head.append(node('strong', algorithmLabel(algorithm)));
  if (value) {
    const copy = node('button', 'Copy digest', 'text-button'); copy.type = 'button';
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(value); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy digest'; }, 1500); feedback(`${algorithmLabel(algorithm)} copied`); } catch { showError(new Error('Clipboard access was denied. Select the digest to copy it manually.')); } });
    head.append(copy);
  }
  el.append(head, node('pre', text)); return el;
}
function useChecksums(job) {
  $('expected').value = job.entries.map(e => `${e.algorithm} (${C.basename(job.filename) || e.filename}) = ${e.value}`).join('\n');
  showPanel('verify'); $('file').focus(); feedback('Expected checksums loaded. Choose the downloaded file.');
}
function renderHistory() {
  const query = $('search').value.trim().toLowerCase(), filter = $('filter').value;
  const filtered = snapshot.jobs.filter(job => {
    const search = `${job.filename || ''} ${job.url || ''}`.toLowerCase().includes(query);
    const attention = ['held', 'blocked', 'mismatch', 'conflict', 'error', 'manual', 'unverified', 'weak-match', 'interrupted'].includes(job.status);
    return search && (filter === 'all' || (filter === 'attention' && attention) || (filter === 'match' && job.status === 'match' && !job.lookupPending) || (filter !== 'match' && filter === job.status));
  });
  const signature = JSON.stringify(filtered);
  if (signature === lastHistory) return;
  lastHistory = signature;
  const open = new Set([...$('history').querySelectorAll('details[open]')].map(el => el.dataset.job));
  const focused = document.activeElement?.dataset.action;
  $('history').replaceChildren();
  if (!filtered.length) {
    $('history').append(empty(snapshot.jobs.length ? 'No matching downloads' : 'Downloads are checked automatically', snapshot.jobs.length ? 'Try a different filename or filter.' : 'Download a file from a publisher’s page. We’ll look for its checksum, verify it locally, and flag problems here.'));
    return;
  }
  for (const job of filtered) {
    const article = node('article', '', 'job'), top = node('div', '', 'job-top'); article.dataset.job = job.id; article.dataset.status=job.status;
    const title = C.basename(job.filename || '') || C.urlFilename(job.url) || 'Download';
    const awaitingLookup = job.lookupPending && !['held', 'blocked', 'canceled', 'deleted', 'interrupted'].includes(job.status);
    top.append(node('h3', title), node('span', awaitingLookup ? 'Checking' : ({ match: 'Verified', held: 'Paused', mismatch: 'Mismatch', conflict: 'Conflict', blocked: 'Blocked', canceled: 'Canceled', downloading: 'Downloading', finding: 'Finding checksum', hashing: 'Checking', manual: 'Needs access', unverified: 'Unverified', 'weak-match': 'Weak match', interrupted: 'Interrupted', deleted: 'Deleted' })[job.status] || 'Check failed', `pill ${awaitingLookup ? 'finding' : job.status}`));
    article.append(top, node('p', `${hostname(job.finalUrl || job.url)}${bytes(job.fileSize) ? ` · ${bytes(job.fileSize)}` : ''}`, 'job-meta'));
    const finding = job.status === 'finding' || ((job.lookupPending || job.needsRecheck) && !['downloading', 'hashing', 'held', 'blocked', 'canceled', 'deleted', 'interrupted'].includes(job.status));
    const stage = finding ? 'Finding checksum…' : statusLabels[job.status] || job.status;
    article.append(node('p', `${stage}${job.status === 'hashing' ? ` · ${job.progress || 0}%` : ''}`, `status ${job.status}`));
    if (job.status === 'hashing' || job.status === 'downloading' || finding) {
      article.append(meterTrack(job.status === 'hashing' ? 'determinate' : 'indeterminate', job.progress || 0, job.status === 'hashing' ? 'Local checksum calculation' : job.status === 'downloading' ? 'Download in progress' : 'Checksum search in progress'));
    }
    if (job.blockReason) article.append(node('p', job.blockReason, 'hint'));
    if (job.error) article.append(node('p', job.error, 'hint'));
    const chromeWarning = job.warnings?.find(warning => warning.startsWith('Chrome download warning'));
    if (chromeWarning && job.status !== 'blocked') article.append(node('p', chromeWarning, 'status error'));
    const actions = node('div', '', 'actions');
    if (job.status === 'held') actions.append(action('Allow once', 'resume-download', job.id, ''), action('Cancel download', 'cancel-download', job.id, 'secondary'));
    if (job.status === 'downloading') actions.append(action('Pause download', 'pause-download', job.id), action('Cancel download', 'cancel-download', job.id));
    if (actions.childElementCount) article.append(actions);
    const details = node('details'); details.dataset.job = String(job.id); details.open = open.has(String(job.id)); details.append(node('summary', 'Checksums, sources, and security notes'));
    if (job.warnings?.length) { const list = node('ul'); job.warnings.forEach(w => list.append(node('li', w))); details.append(list); }
    details.append(node('p', `Publisher page: ${job.source || job.referrer || 'No associated page'}`, 'hint'));
    for (const e of job.entries || []) {
      const actual = job.results?.find(result => result.algorithm === e.algorithm)?.actual;
      details.append(digestBlock(e.algorithm, `Expected: ${e.value}${actual ? `\nComputed: ${actual}` : ''}\nSource: ${e.source || job.source}\nRecognition: ${e.format || 'Publisher digest'}${e.inferred ? ' · algorithm inferred from digest length' : ' · algorithm explicitly specified'}`, actual || e.value));
    }
    const more = node('div', '', 'actions');
    if (!['blocked', 'deleted', 'canceled'].includes(job.status)) {
      const block = action('Block host', 'block-host', job.id);
      block.title = `Block future downloads from ${hostname(job.finalUrl || job.url)}`;
      more.append(block);
    }
    if (job.entries?.length && !['downloading', 'finding', 'hashing', 'held', 'blocked', 'canceled', 'deleted'].includes(job.status)) {
      const use = node('button', 'Verify selected file', 'secondary'); use.type = 'button'; use.addEventListener('click', () => useChecksums(job)); more.append(use, action('Recheck download', 'retry', job.id));
    }
    if (['mismatch', 'conflict'].includes(job.status)) {
      const remove = node('button', 'Delete downloaded file', 'danger'); remove.type = 'button';
      remove.addEventListener('click', async () => { if (!confirm(`Permanently delete ${title} from disk?`)) return; try { await send({ type: 'delete', id: job.id }); await refresh(); } catch (error) { showError(error); } }); more.append(remove);
    }
    if (more.childElementCount) details.append(more);
    article.append(details); $('history').append(article);
  }
  if (focused) [...$('history').querySelectorAll('button')].find(button => button.dataset.action === focused)?.focus({ preventScroll: true });
}
function renderFiles() {
  const page = snapshot.page;
  const signature = JSON.stringify({ page, enabled: currentSettings.enabled });
  if (signature === lastFiles) return;
  lastFiles = signature;
  $('file-count').textContent = page?.files?.length || 0;
  $('page-source').textContent = page ? hostname(page.page) : 'Open a publisher’s download page to begin.';
  $('page-files').replaceChildren();
  if (page?.scan) {
    const scan = node('div', '', 'scan-summary'), copy = node('div', '', 'scan-copy');
    if (page.scan.phase !== 'complete') { const loader = node('span', '', 'loader'); loader.setAttribute('aria-hidden', 'true'); scan.append(loader); }
    copy.append(node('strong', page.scan.phase === 'complete' ? 'Page scan complete' : page.scan.phase === 'fetching' ? 'Reading checksum sources…' : 'Scanning page content…'));
    copy.append(node('span', `${page.scan.contexts} document/shadow contexts · ${page.files?.length || 0} files · ${page.scan.checksumSources} checksum sources`));
    scan.append(copy);
    $('page-files').append(scan);
  }
  if (!page?.files?.length) { $('page-files').append(empty('No downloadable files found yet', 'Open or reload the publisher’s page, reveal its platform downloads, then choose Scan again. Hidden URLs are detected when they are present in the page’s HTML or data.')); return; }
  for (const file of page.files) {
    const row = node('article', '', 'file-row'), top = node('div', '', 'job-top');
    const entries = page.records?.find(record => record.url === file.url)?.entries || C.forFile(page.entries || [], C.urlFilename(file.url));
    top.append(node('h3', C.urlFilename(file.url)), node('span', entries.length ? `${entries.length} checksum${entries.length > 1 ? 's' : ''}` : 'No checksum yet', `pill ${entries.length ? 'available' : 'unverified'}`));
    row.append(top, node('p', `${file.foundIn} · ${hostname(file.url)}`, 'job-meta'));
    const details = node('details'); details.append(node('summary', 'Show file URL'), node('pre', file.url));
    if (file.checksumURL) details.append(node('pre', `Checksum: ${file.checksumURL}`)); row.append(details);
    const download = node('button', 'Download & verify', 'secondary'); download.type = 'button';
    download.disabled = !currentSettings.enabled;
    if (download.disabled) download.title = 'Turn on protection to download and verify this file.';
    download.addEventListener('click', async () => { download.disabled = true; try { await send({ type: 'download-file', tabId: page.tabId, url: file.url }); showPanel('downloads'); feedback('Download started. Your blocking and verification settings apply.'); } catch (error) { showError(error); } finally { download.disabled = false; } });
    const actions = node('div', '', 'actions'); actions.append(download); row.append(actions); $('page-files').append(row);
  }
}
async function refresh() {
  snapshot = await send({ type: 'history' });
  currentSettings = snapshot.settings;
  applyInterfaceMode();
  theme(currentSettings.theme);
  if (!settingsDirty) fillSettings(currentSettings);
  ChecksumIcons.decorate($('protection-toggle'),'power',currentSettings.enabled ? 'Protection on' : 'Protection off',true);
  $('protection-toggle').setAttribute('aria-pressed', String(currentSettings.enabled));
  $('protection-summary').textContent = !currentSettings.enabled ? 'New downloads are not monitored or blocked.' : ({ dangerous: 'Automatic verification · Chrome-flagged threats blocked', 'require-checksum': 'Automatic verification · Pausing files without strong checksums', 'hold-all': 'Approval required for every download', off: 'Automatic verification · Monitor-only mode' })[currentSettings.blockMode];
  $('setup').hidden = snapshot.fileAccess || !currentSettings.enabled;
  $('access').textContent = snapshot.fileAccess ? 'Local file access enabled' : 'Local file access needs permission';
  $('download-count').textContent = snapshot.jobs.length;
  renderHistory(); renderFiles(); renderActivity(); renderOutcome();
  if (!initialRouteApplied) {
    initialRouteApplied = true;
    const params = new URLSearchParams(location.search), panel = params.get('panel');
    if (['downloads', 'files', 'verify', 'settings'].includes(panel)) showPanel(panel);
    const id = params.get('download');
    if (id && /^\d+$/.test(id)) {
      showPanel('downloads');
      const item = [...$('history').querySelectorAll('article.job')].find(article => article.dataset.job === id);
      if (item) { item.querySelector('details').open = true; item.scrollIntoView({ block: 'center' }); }
    }
  }
}
$('search').addEventListener('input', renderHistory); $('filter').addEventListener('change', renderHistory);
$('clear').addEventListener('click', () => send({ type: 'clear' }).then(() => { feedback('Completed download history cleared.'); return refresh(); }).catch(showError));
$('rescan').addEventListener('click', async () => {
  try { await send({ type: 'rescan-page', tabId: snapshot.page?.tabId }); feedback('Scanning page links and embedded download data…'); } catch (error) { showError(error); }
});
for (const name of Object.keys(C.ALGORITHMS)) { const option = node('option', algorithmLabel(name)); option.value = name; $('algorithm').append(option); }
$('algorithm').value = 'sha256';
async function loadChecksum() {
  const url = $('checksum-url').value.trim();
  if (!C.sidecarInfo(url)) throw new Error('Enter a checksum URL ending in .sha256, .sha512, or another supported checksum suffix.');
  $('load-checksum').disabled = true;
  try {
    const result = await send({ type: 'fetch-checksum', url, page: url });
    if (!result.entries?.length) throw new Error('No supported checksum was found at this link.');
    $('expected').value = result.entries.map(e => e.filename ? `${e.algorithm} (${e.filename}) = ${e.value}` : `${e.algorithm}: ${e.value}`).join('\n');
    feedback(`Loaded ${result.entries.length} checksum${result.entries.length > 1 ? 's' : ''}. Choose the matching local file to verify.`);
  } finally { $('load-checksum').disabled = false; }
}
$('load-checksum').addEventListener('click', () => loadChecksum().catch(showError));
let worker;
function finishManual() { worker?.terminate(); worker = null; manualActivity = ''; renderActivity(); $('verify').disabled = false; $('cancel').hidden = true; }
function displayResult(result, digests) {
  manualOutcome = { status: result.status, filename: $('file').files[0]?.name || '', manual: true }; renderOutcome();
  $('manual-result').replaceChildren(node('p', statusLabels[result.status], `status ${result.status}`));
  for (const row of result.results) $('manual-result').append(digestBlock(row.algorithm, `${row.match ? 'MATCH' : 'MISMATCH / CONFLICT'}\nExpected: ${row.expected.join('\n')}\nComputed: ${row.actual}`, row.actual));
  if (!result.results.length) for (const [name, value] of Object.entries(digests)) $('manual-result').append(digestBlock(name, value, value));
}
$('verify').addEventListener('click', () => {
  const file = $('file').files[0];
  if (!file) { $('manual-result').textContent = 'Choose a downloaded file first.'; $('file').focus(); return; }
  const text = $('expected').value.trim();
  const parsed = C.parseChecksums(text, { algorithm: currentSettings.interfaceMode === 'advanced' && /^[a-f\d]+$/i.test(text) ? $('algorithm').value : '' });
  const entries = C.forFile(parsed, file.name, true);
  if (text && !entries.length) { $('manual-result').textContent = 'No supported checksum matches this filename. Check the algorithm, digest length, and filename in the list.'; return; }
  $('verify').disabled = true; $('cancel').hidden = false; $('manual-result').textContent = 'Computing locally…';
  manualOutcome = null; manualActivity = file.name; renderActivity(); renderOutcome();
  worker = new Worker(chrome.runtime.getURL('scripts/hash-worker.js'));
  worker.onerror = () => { $('manual-result').textContent = 'The checksum worker failed. Please try again.'; manualOutcome = { status: 'error', filename: file.name, manual: true }; renderOutcome(); finishManual(); };
  worker.onmessage = ({ data }) => {
    if (data.digests) {
      displayResult(C.verify(entries, data.digests), data.digests);
      const warnings = C.securityWarnings({ filename: file.name }, entries);
      if (warnings.length) { const list = node('ul'); warnings.forEach(w => list.append(node('li', w))); $('manual-result').append(list); }
      finishManual();
    } else if (data.error) { $('manual-result').textContent = data.error; manualOutcome = { status: 'error', filename: file.name, error: data.error, manual: true }; renderOutcome(); finishManual(); }
    else { manualActivity = `${file.name} · ${data.progress}%`; renderActivity(); $('manual-result').textContent = `Computing locally… ${data.progress}%`; }
  };
  worker.postMessage({ file, algorithms: entries.length ? entries.map(e => e.algorithm) : ['sha256'] });
});
$('cancel').addEventListener('click', () => { finishManual(); $('manual-result').textContent = 'Verification canceled.'; });
let refreshTimer;
chrome.storage.onChanged.addListener((_changes, area) => { if (area === 'session' || area === 'local') { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => refresh().catch(showError), 120); } });
refresh().catch(showError);

for (const [id,icon] of [["tab-downloads","download"],["tab-files","folder"],["tab-verify","file"],["tab-settings","settings"]]) { const button=$(id);if(button)ChecksumIcons.decorate(button,icon); }
