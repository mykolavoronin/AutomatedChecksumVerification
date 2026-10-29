// Pure discovery and policy helpers. Never execute downloaded page code.
export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true, revealChecksums: true, linkedPages: true, crossOriginChecksums: true,
  guessSidecars: true, notifications: false, resultPopups: false, downloadPanels: true, blockMode: 'dangerous', theme: 'light',
  historyLimit: 100, blockedHosts: [], interfaceMode: 'basic'
});
export function sanitizeSettings(input = {}) {
  if (!input || typeof input !== 'object') input = {};
  const result = { ...DEFAULT_SETTINGS, blockedHosts: [] };
  for (const key of ['enabled', 'revealChecksums', 'linkedPages', 'crossOriginChecksums', 'guessSidecars', 'notifications', 'resultPopups', 'downloadPanels']) {
    if (typeof input[key] === 'boolean') result[key] = input[key];
  }
  if (['off', 'dangerous', 'require-checksum', 'hold-all'].includes(input.blockMode)) result.blockMode = input.blockMode;
  if (['system', 'light', 'dark'].includes(input.theme)) result.theme = input.theme;
  if (['basic', 'advanced'].includes(input.interfaceMode)) result.interfaceMode = input.interfaceMode;
  if ([25, 50, 100].includes(input.historyLimit)) result.historyLimit = input.historyLimit;
  if (Array.isArray(input.blockedHosts)) result.blockedHosts = [...new Set(input.blockedHosts.filter(host => typeof host === 'string')
    .map(host => host.trim().toLowerCase()).filter(host => /^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)*[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(host) && host.length <= 253))].slice(0, 100);
  return result;
}
const SUFFIX = /\.(md5|sha-?1|sha-?224|sha-?256|sha-?384|sha-?512|sha512[-_]224|sha512[-_]256|sha3[-_](?:224|256|384|512)|blake2b(?:[-_]?(?:128|160|224|256|384|512))?|blake2s(?:[-_]?(?:128|160|224|256))?|shake128[-_](?:128|256)|shake256[-_](?:256|512)|blake3|b3|crc32|sfv|ripemd160|keccak256)(?:sum)?(?:\.txt)?$/i;
const FILE = /\.(?:exe|msi|msix|msixbundle|zip|7z|rar|tar(?:\.(?:gz|xz|bz2|zst))?|tgz|dmg|pkg|iso|deb|rpm|apk|appimage|bin|jar|whl|nupkg)$/i;
function safeURL(value, base) {
  try {
    if (typeof value !== 'string' || value.length > 4096) return null;
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = ''; return url;
  } catch { return null; }
}
export function sidecarInfo(value, base) {
  const url = safeURL(value, base);
  if (!url) return null;
  const aggregate=url.pathname.split('/').pop().match(/^(?:(sha-?(?:1|224|256|384|512)|md5|blake3)(?:sums?|checksums?)|checksums?|hashes|digests)(?:[._-](sha-?(?:1|224|256|384|512)|md5|blake3))?(?:\.(?:txt|json|asc))?$/i);
  if(aggregate)return{url:url.href,fileURL:'',filename:'',algorithm:aggregate[1]||aggregate[2]||''};
  const match = url.pathname.match(SUFFIX);
  if (match) {
    const artifact = new URL(url);
    artifact.pathname = artifact.pathname.slice(0, -match[0].length);
    let filename;
    try { filename = decodeURIComponent(artifact.pathname.split('/').pop()); } catch { return null; }
    const algorithm = ({ sfv: 'crc32', b3: 'blake3' })[match[1].toLowerCase()] || match[1];
    return { url: url.href, fileURL: artifact.href, filename, algorithm };
  }
  const name = url.pathname.split('/').pop();
  if (/^(?:(?:sha-?(?:1|224|256|384|512)|md5|blake3)(?:sums?|checksums?)|checksums?)(?:\.(?:txt|json))?$/i.test(name)) {
    return { url: url.href, fileURL: '', filename: '', algorithm: name.match(/^(sha-?(?:1|224|256|384|512)|md5|blake3)/i)?.[1] || '' };
  }
  return null;
}
export function isDownloadURL(value, base) {
  const url = safeURL(value, base);
  return !!url && FILE.test(url.pathname);
}
export function catalogForPage(value) {
  const page = safeURL(value);
  if(page?.protocol==='https:'&&page.hostname==='github.com'){
    const match=page.pathname.match(/^\/([a-z\d_.-]+)\/([a-z\d_.-]+)\/releases(?:\/(latest|tag\/(.+)|download\/(.+)\/[^/]+))?\/?$/i);
    if(match){
      let tag='';try{tag=decodeURIComponent(match[4]||match[5]||'');}catch{return null;}
      const repository=`${match[1]}/${match[2]}`;
      return{name:'GitHub release',provider:'github',repository,tag,url:`https://api.github.com/repos/${repository}/releases/${tag?'tags/'+encodeURIComponent(tag):'latest'}`};
    }
  }
  if (page && ['www.jetbrains.com', 'jetbrains.com'].includes(page.hostname) && /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?toolbox(?:-app)?(?:\/|$)/i.test(page.pathname)) {
    return { name: 'JetBrains Toolbox', url: 'https://data.services.jetbrains.com/products/releases?code=TBA&latest=true&type=release' };
  }
  return null;
}
export function discoverURLs(text, base) {
  if (typeof text !== 'string') return [];
  // Decode URL escapes only; this is a string scan, not a JavaScript interpreter.
  const source = text.slice(0, 2 * 1024 * 1024).replace(/\\u002f/ig, '/').replace(/\\u003a/ig, ':')
    .replace(/\\u0026/ig, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
  const found = new Map();
  const patterns = [/https?:\/\/[^\s"'<>`\\]+/ig, /["'`]((?:\/|\.\.\/|\.\/)[^\s"'<>`\\]+)["'`]/g];
  for (const pattern of patterns) for (const match of source.matchAll(pattern)) {
    const url = safeURL(match[1] || match[0], base);
    if (!url) continue;
    const sidecar = sidecarInfo(url.href);
    if (sidecar?.fileURL && isDownloadURL(sidecar.fileURL)) found.set(sidecar.fileURL, { url: sidecar.fileURL, checksumURL: sidecar.url, foundIn: 'Page code' });
    else if (isDownloadURL(url.href)) found.set(url.href, { url: url.href, checksumURL: '', foundIn: 'Page code' });
    if (found.size >= 200) return [...found.values()];
  }
  return [...found.values()];
}
export function sidecarCandidates(item) {
  const candidates = new Set();
  for (const value of [item.url, item.finalUrl]) {
    const url = safeURL(value);
    if (!url || !FILE.test(url.pathname)) continue;
    for (const suffix of ['.sha256', '.sha512']) {
      const sidecar = new URL(url); sidecar.pathname += suffix; candidates.add(sidecar.href);
    }
  }
  const first = safeURL(item.finalUrl || item.url);
  if (first && FILE.test(first.pathname)) {
    const stem = new URL(first); stem.pathname = stem.pathname.replace(/\.[^.\/]+$/, '.sha256'); candidates.add(stem.href);
    for (const name of ['SHA256SUMS', 'SHA512SUMS', 'checksums.txt', 'checksums.sha256', 'SHA256SUMS.txt', 'checksums.json']) {
      const list = new URL(first); list.pathname = list.pathname.replace(/[^/]+$/, name); candidates.add(list.href);
    }
  }
  return [...candidates].slice(0, 10);
}
export function isPublicHTTPS(value) {
  const url = safeURL(value);
  if (!url || url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  // Cross-origin lookups must not turn the extension into a local-network proxy.
  return host.includes('.') && !/^[\d.]+$/.test(host) && !host.includes(':') &&
    !/(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host);
}
const DANGEROUS = new Set(['url', 'content', 'host', 'unwanted', 'sensitiveContentBlock', 'deepScannedOpenedDangerous', 'accountCompromise', 'blockedScanFailed']);
export function downloadDecision(item, entries, settings, algorithms) {
  if (!settings.enabled) return { action: 'allow', reason: '' };
  const hosts = [item.url, item.finalUrl].map(value => safeURL(value)?.hostname.toLowerCase()).filter(Boolean);
  if (hosts.some(host => settings.blockedHosts.includes(host))) return { action: 'cancel', reason: 'This download host is on your blocklist.' };
  if (settings.blockMode !== 'off' && DANGEROUS.has(item.danger)) return { action: 'cancel', reason: `Chrome flagged this download: ${item.danger}.` };
  if (settings.blockMode === 'hold-all') return { action: 'hold', reason: 'Your settings require approval for every download.' };
  if (settings.blockMode === 'require-checksum') {
    const grouped = new Map();
    for (const entry of entries) {
      if (!grouped.has(entry.algorithm)) grouped.set(entry.algorithm, new Set());
      grouped.get(entry.algorithm).add(entry.value);
    }
    if ([...grouped.values()].some(values => values.size > 1)) return { action: 'hold', reason: 'Publisher checksum values conflict. Review them before allowing this download.' };
  }
  if (settings.blockMode === 'require-checksum' && !entries.some(e => algorithms[e.algorithm] && !algorithms[e.algorithm].weak)) {
    return { action: 'hold', reason: 'No strong publisher checksum is associated with this file yet.' };
  }
  return { action: 'allow', reason: '' };
}
