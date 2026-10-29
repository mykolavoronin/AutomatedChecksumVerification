import { md5, sha1, ripemd160 } from '@noble/hashes/legacy.js';
import { sha224, sha256, sha384, sha512, sha512_224, sha512_256 } from '@noble/hashes/sha2.js';
import { sha3_224, sha3_256, sha3_384, sha3_512, keccak_256, shake128, shake256 } from '@noble/hashes/sha3.js';
import { blake2b, blake2s } from '@noble/hashes/blake2.js';
import { blake3 } from '@noble/hashes/blake3.js';
import { sidecarInfo as lookupSidecar, isDownloadURL as supportedDownloadURL } from './discovery.js';
export { DEFAULT_SETTINGS, sanitizeSettings, sidecarInfo, isDownloadURL, discoverURLs, sidecarCandidates, isPublicHTTPS, downloadDecision, catalogForPage } from './discovery.js';

class CRC32 {
  constructor() { this.value = 0xffffffff; }
  update(bytes) {
    for (const byte of bytes) {
      this.value ^= byte;
      for (let i = 0; i < 8; i++) this.value = (this.value >>> 1) ^ (0xedb88320 & -(this.value & 1));
    }
    return this;
  }
  digest() {
    const value = (this.value ^ 0xffffffff) >>> 0;
    return Uint8Array.of(value >>> 24, value >>> 16, value >>> 8, value);
  }
}
export const ALGORITHMS = Object.freeze({
  crc32: { bytes: 4, weak: true, create: () => new CRC32() },
  md5: { bytes: 16, weak: true, create: md5.create },
  sha1: { bytes: 20, weak: true, create: sha1.create },
  ripemd160: { bytes: 20, weak: true, create: ripemd160.create },
  sha224: { bytes: 28, create: sha224.create },
  sha256: { bytes: 32, create: sha256.create },
  sha384: { bytes: 48, create: sha384.create },
  sha512: { bytes: 64, create: sha512.create },
  sha512224: { bytes: 28, create: sha512_224.create },
  sha512256: { bytes: 32, create: sha512_256.create },
  sha3224: { bytes: 28, create: sha3_224.create },
  sha3256: { bytes: 32, create: sha3_256.create },
  sha3384: { bytes: 48, create: sha3_384.create },
  sha3512: { bytes: 64, create: sha3_512.create },
  keccak256: { bytes: 32, create: keccak_256.create },
  shake128128: { bytes: 16, weak: true, create: () => shake128.create({ dkLen: 16 }) },
  shake128256: { bytes: 32, create: () => shake128.create({ dkLen: 32 }) },
  shake256256: { bytes: 32, create: () => shake256.create({ dkLen: 32 }) },
  shake256512: { bytes: 64, create: () => shake256.create({ dkLen: 64 }) },
  blake2b128: { bytes: 16, weak: true, create: () => blake2b.create({ dkLen: 16 }) },
  blake2b160: { bytes: 20, weak: true, create: () => blake2b.create({ dkLen: 20 }) },
  blake2b224: { bytes: 28, create: () => blake2b.create({ dkLen: 28 }) },
  blake2b256: { bytes: 32, create: () => blake2b.create({ dkLen: 32 }) },
  blake2b384: { bytes: 48, create: () => blake2b.create({ dkLen: 48 }) },
  blake2s128: { bytes: 16, weak: true, create: () => blake2s.create({ dkLen: 16 }) },
  blake2s160: { bytes: 20, weak: true, create: () => blake2s.create({ dkLen: 20 }) },
  blake2s224: { bytes: 28, create: () => blake2s.create({ dkLen: 28 }) },
  blake2b: { bytes: 64, create: blake2b.create },
  blake2s: { bytes: 32, create: blake2s.create },
  blake3: { bytes: 32, create: blake3.create }
});
export function normalizeAlgorithm(value) {
  const key = String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ({ sha2256: 'sha256', sha2224: 'sha224', sha2384: 'sha384', sha2512: 'sha512',
    blake2b512: 'blake2b', blake2s256: 'blake2s', blake3256: 'blake3' })[key] || key;
}
export function validEntry(entry) {
  return !!entry && Object.hasOwn(ALGORITHMS, entry.algorithm) && typeof entry.value === 'string' &&
    entry.value.length === ALGORITHMS[entry.algorithm].bytes * 2 && /^[a-f\d]+$/i.test(entry.value);
}
export function basename(value) { return String(value).replace(/\\/g, '/').split('/').pop(); }
export function urlFilename(value) {
  try { return decodeURIComponent(basename(new URL(value).pathname)); } catch { return ''; }
}
export function canonicalURL(value) {
  try {
    if (typeof value !== 'string' || value.length > 4096) return null;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
/** Read static JSON data only: never evaluate scripts from a download page. */
export function parseStructuredChecksums(text, source = '', filenameHint = '') {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) return [];
  let root;
  try { root = JSON.parse(text); } catch {
    // Accept JSON-shaped assignment payloads without interpreting JavaScript.
    const assignment = text.match(/(?:^|[;\n])\s*(?:(?:const|let|var)\s+)?[\w.$]+\s*=\s*([\[{][\s\S]*[\]}])\s*;?\s*$/);
    if (!assignment) return [];
    try { root = JSON.parse(assignment[1]); } catch { return []; }
  }
  const queue = [{ value: root, filename: String(filenameHint), algorithm: '', downloadURL:'' }], entries = [];
  let visited = 0;
  while (queue.length && visited++ < 5000 && entries.length < 2000) {
    const { value, filename: inherited, algorithm: inheritedAlgorithm,downloadURL:inheritedURL } = queue.shift();
    if (!value || typeof value !== 'object') continue;
    const identity = value.filename || value.fileName || value.file || value.path;
    const url = value.downloadUrl || value.download_url || value.browser_download_url || value.url;
    const itemAlgorithm = normalizeAlgorithm(value.algorithm || value.hashAlgorithm || value.checksumType || value.type || inheritedAlgorithm);
    const filename = typeof identity === 'string' ? basename(identity) :
      typeof url === 'string' ? urlFilename(url) : typeof value.name === 'string' ? basename(value.name) : inherited;
    const downloadURL=canonicalURL(url)||(filename===inherited?inheritedURL:'');
    const append=parsed=>entries.push(...parsed.map(entry=>({...entry,downloadURL})));
    for (const [key, child] of Object.entries(value).slice(0, 500)) {
      const algorithm = normalizeAlgorithm(key);
      if (filename && Object.hasOwn(ALGORITHMS, algorithm) && typeof child === 'string') {
        append(parseChecksums(child, { algorithm, filename, source }));
      }
      if (filename && /^(?:checksum|digest|hash|value)$/i.test(key) && typeof child === 'string') {
        const hint = itemAlgorithm;
        append(parseChecksums(child, { algorithm: hint, filename, source }));
      }
      const keyFilename=/^[^\s{}\[\]"<>]+\.[a-z\d]{1,12}$/i.test(key)?basename(key):'';
      if(keyFilename&&typeof child==='string')append(parseChecksums(child,{algorithm:itemAlgorithm,filename:keyFilename,source}));
      if (child && typeof child === 'object') {
        queue.push({ value: child, filename: keyFilename || filename, algorithm: Object.hasOwn(ALGORITHMS, algorithm) ? algorithm : itemAlgorithm,downloadURL:keyFilename&&keyFilename!==filename?'':downloadURL });
      }
    }
  }
  return entries.filter(validEntry).slice(0, 2000).map(entry => ({ ...entry, format: 'Structured JSON' }));
}
/** Accept only published asset identities from this exact GitHub release. */
export function githubReleaseAssets(data,catalog){
  const files=new Map(),entries=[];
  if(catalog?.provider!=='github'||!data||data.draft||typeof data.tag_name!=='string'||!Array.isArray(data.assets)||!data.tag_name)return{files:[],entries:[]};
  if(catalog.tag&&catalog.tag!==data.tag_name)return{files:[],entries:[]};
  for(const asset of data.assets.slice(0,200)){
    const url=canonicalURL(asset?.browser_download_url);
    if(!url||new URL(url).origin!=='https://github.com'||typeof asset.name!=='string'||urlFilename(url)!==asset.name||asset.state!=='uploaded')continue;
    const identity=new URL(url).pathname.match(/^\/([^/]+)\/([^/]+)\/releases\/download\/(.+)\/[^/]+$/);
    if(!identity||`${identity[1]}/${identity[2]}`.toLowerCase()!==catalog.repository.toLowerCase())continue;
    try{if(decodeURIComponent(identity[3])!==data.tag_name)continue;}catch{continue;}
    const sidecar=lookupSidecar(url);
    const target=sidecar?.fileURL||url;
    if(!supportedDownloadURL(target))continue;
    const previous=files.get(target);
    files.set(target,{url:target,checksumURL:sidecar?.url||previous?.checksumURL||'',foundIn:'Publisher catalog'});
    if(target===url&&typeof asset.digest==='string'&&/^sha256:[a-f\d]{64}$/i.test(asset.digest)){
      entries.push({algorithm:'sha256',value:asset.digest.slice(7).toLowerCase(),filename:asset.name,downloadURL:url,source:catalog.url,inferred:false,format:'GitHub release digest'});
    }
  }
  return{files:[...files.values()],entries};
}
const DEFAULTS = { 32: 'md5', 40: 'sha1', 56: 'sha224', 64: 'sha256', 96: 'sha384', 128: 'sha512' };
const LABEL = /\b(?:sha(?:[-_ ]?3[-_ ]?(?:224|256|384|512)|[-_ ]?512[\/_-](?:224|256)|[-_ ]?2[-_ ]?(?:224|256|384|512)|[-_ ]?(?:1|224|256|384|512))|shake[-_ ]?(?:128[-_ /](?:128|256)|256[-_ /](?:256|512))|md5|crc[-_ ]?32|ripemd[-_ ]?160|blake2[bs](?:[-_ ]?(?:128|160|224|256|384|512))?|blake3(?:[-_ ]?256)?|keccak[-_ ]?256)\b/ig;
function joinWrappedDigests(text) {
  const lines = text.split(/\r?\n/), result = [];
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].trim().match(/^([a-z][a-z\d/_ -]*):?\s*$/i);
    const algorithm = heading && normalizeAlgorithm(heading[1]);
    result.push(lines[index]);
    if (!algorithm || !Object.hasOwn(ALGORITHMS, algorithm)) continue;
    let joined = '', end = index;
    for (let next = index + 1; next < Math.min(index + 10, lines.length); next++) {
      const part = lines[next].trim();
      if (!/^[a-f\d ]{8,}$/i.test(part)) break;
      joined += part.replace(/\s/g, ''); end = next;
      if (joined.length >= ALGORITHMS[algorithm].bytes * 2) break;
    }
    if (joined.length === ALGORITHMS[algorithm].bytes * 2) { result.push(joined); index = end; }
  }
  return result.join('\n');
}
/** Parse GNU/BSD lists, SFV, labeled hex, and SRI. Bound all untrusted work. */
export function parseChecksums(text, { source = '', algorithm = '', filename = '' } = {}) {
  if (typeof text !== 'string') return [];
  const entries = [];
  const push = (algo, value, file = '', inferred = false, format = 'Labeled digest') => {
    const entry = { algorithm: normalizeAlgorithm(algo), value: value.toLowerCase(), filename: file.trim(), source, inferred, format };
    if (validEntry(entry)) entries.push(entry);
  };
  const hint = normalizeAlgorithm(algorithm);
  let sectionHint = hint;
  let input=text.slice(0,2*1024*1024);
  if(input.includes('\0'))input=input.split('\0').filter(Boolean).map(record=>'\\'+record.replace(/\\/g,'\\\\').replace(/\r/g,'\\r').replace(/\n/g,'\\n')).join('\n');
  for (const raw of joinWrappedDigests(input).split(/\r?\n/).slice(0, 20000)) {
    const escaped=raw.startsWith('\\');
    const line = (escaped?raw.slice(1):raw).trim().slice(0, 8192);
    const fileName=value=>escaped?value.replace(/\\([\\nr])/g,(_,letter)=>letter==='n'?'\n':letter==='r'?'\r':'\\'):value;
    if (!line || /^[;#]/.test(line)) continue;
    const heading = line.match(/^([a-z][a-z\d/_ -]*):?$/i);
    if (heading && Object.hasOwn(ALGORITHMS, normalizeAlgorithm(heading[1]))) {
      sectionHint = normalizeAlgorithm(heading[1]); continue;
    }
    let match = line.match(/^(.+?)\s*\((.+)\)\s*=\s*([a-z\d+/]+={0,2})$/i);
    if (match) {
      const named=normalizeAlgorithm(match[1]),value=match[3];
      if(Object.hasOwn(ALGORITHMS,named)){
        if(/^[a-f\d]+$/i.test(value)&&value.length===ALGORITHMS[named].bytes*2)push(named,value,fileName(match[2]),false,'BSD checksum list');
        else try{push(named,[...atob(value)].map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join(''),fileName(match[2]),false,'Tagged base64 checksum');}catch{}
      }
      continue;
    }
    const unique = [...new Set([...line.matchAll(LABEL)].map(m => normalizeAlgorithm(m[0])))];
    if (unique.some(name => !Object.hasOwn(ALGORITHMS, name))) continue;
    const labeled = unique.length === 1 ? unique[0] : '';
    const grouped = line.match(/^[a-z][a-z\d/_ -]*\s*[:=]\s*([a-f\d]+(?:[ \t]+[a-f\d]+)+)$/i);
    if (labeled && grouped) { push(labeled, grouped[1].replace(/\s/g, ''), filename); continue; }
    const base64 = line.match(/^[a-z][a-z\d/_ -]*\s*[:=]\s*([A-Za-z\d+/]+={0,2})$/i);
    if (labeled && base64 && (!/^[a-f\d]+$/i.test(base64[1]) || base64[1].length !== ALGORITHMS[labeled].bytes * 2)) {
      try { push(labeled, [...atob(base64[1])].map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(''), filename, false, 'Base64 digest'); } catch { /* Invalid encoding. */ }
      continue;
    }
    for (const sri of line.matchAll(/\b(sha(?:256|384|512))-([A-Za-z0-9+/]+={0,2})(?=\s|$|["'])/g)) {
      try { push(sri[1], [...atob(sri[2])].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''), filename); } catch { /* invalid base64 */ }
    }
    match = line.match(/^([a-f\d]{8,128})[ \t]+[* ]?(.+)$/i);
    if (match) {
      // Filenames can contain algorithm names: they must not select the hash.
      const algo = sectionHint || DEFAULTS[match[1].length];
      if (algo) push(algo, match[1], fileName(match[2]), !sectionHint, 'GNU checksum list');
      continue;
    }
    match = line.match(/^(.+?)[ \t]+([a-f\d]{8})$/i);
    if (match && (!sectionHint || sectionHint === 'crc32') && (!labeled || labeled === 'crc32')) { push('crc32', match[2], match[1]); continue; }
    if (unique.length > 1) continue;
    const filenameFirst = line.match(/^([^\s:]+\.[a-z\d.]+)\s*(?::|[ \t])\s*([a-f\d]{32,128})$/i);
    if (filenameFirst) {
      const algo = labeled || sectionHint || DEFAULTS[filenameFirst[2].length];
      if (algo) push(algo, filenameFirst[2], filenameFirst[1], !labeled && !sectionHint, 'Filename checksum record');
      continue;
    }
    if (!labeled && /[a-z][a-z\d_-]*\s*[:=]/i.test(line)) continue;
    for (const token of line.matchAll(/(?<![a-z\d])([a-f\d]{8,128})(?![a-z\d])/ig)) {
      const algo = labeled || sectionHint || DEFAULTS[token[1].length];
      if (algo) push(algo, token[1], filename, !labeled && !sectionHint);
    }
    if (entries.length >= 2000) break;
  }
  return [...new Map(entries.map(e => [`${e.algorithm}:${e.value}:${e.filename}`, e])).values()].slice(0, 2000);
}
export function forFile(entries, filename, allowUnbound = false) {
  return entries.filter(e => validEntry(e) && (e.filename ? basename(e.filename) === filename : allowUnbound));
}
export function verify(entries, digests) {
  const grouped = new Map();
  for (const entry of entries.filter(validEntry)) {
    if (!grouped.has(entry.algorithm)) grouped.set(entry.algorithm, new Set());
    grouped.get(entry.algorithm).add(entry.value.toLowerCase());
  }
  const conflicts = [...grouped].filter(([, values]) => values.size > 1).map(([algorithm]) => algorithm);
  const results = [...grouped].map(([algorithm, values]) => ({ algorithm, expected: [...values],
    actual: digests[algorithm] || '', match: values.size === 1 && values.has(digests[algorithm]) }));
  const status = !results.length ? 'unverified' : conflicts.length ? 'conflict' :
    results.every(r => r.match) ? (results.every(r => ALGORITHMS[r.algorithm].weak) ? 'weak-match' : 'match') : 'mismatch';
  return { status, results, conflicts };
}
export async function hashBlob(blob, algorithms, progress = () => {}) {
  const names = [...new Set(algorithms)];
  if (!names.length || names.some(a => !Object.hasOwn(ALGORITHMS, a))) throw new Error('Unsupported checksum algorithm.');
  const hashers = names.map(a => ALGORITHMS[a].create());
  const chunkSize = 1024 * 1024;
  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const bytes = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer());
    hashers.forEach(h => h.update(bytes));
    progress(Math.min(offset + chunkSize, blob.size), blob.size);
  }
  const digests = {};
  names.forEach((a, i) => { digests[a] = Array.from(hashers[i].digest(), b => b.toString(16).padStart(2, '0')).join(''); });
  return digests;
}
export function fileURL(path) {
  if (typeof path !== 'string') throw new Error('Missing download path.');
  const normalized = path.replace(/\\/g, '/');
  if (/^[a-z]:\//i.test(normalized)) return 'file:///' + normalized.split('/').map((s, i) => i ? encodeURIComponent(s) : s).join('/');
  if (normalized.startsWith('//')) throw new Error('Network file paths require manual verification.');
  if (normalized.startsWith('/')) return 'file://' + normalized.split('/').map(encodeURIComponent).join('/');
  throw new Error('The download path is not absolute.');
}
export function securityWarnings(item, entries = []) {
  const warnings = [];
  if (item.danger && !['safe', 'deepScannedSafe', 'allowlistedByPolicy'].includes(item.danger)) warnings.push(`Chrome download warning: ${item.danger}`);
  for (const [label, url] of [['Download', item.finalUrl || item.url], ['Checksum page', item.referrer]]) {
    if (url?.startsWith('http:')) warnings.push(`${label} uses insecure HTTP; its contents can be changed in transit.`);
  }
  const name = basename(item.filename || '').toLowerCase();
  if (/\.(?:exe|msi|msix|scr|com|bat|cmd|ps1|vbs|js|jar|dmg|pkg|app|deb|rpm|apk)$/.test(name)) warnings.push('Executable or installer: only run software from a trusted publisher.');
  if (/\.(?:pdf|docx?|xlsx?|png|jpe?g|txt)\.(?:exe|scr|com|bat|cmd|js|vbs)$/i.test(name)) warnings.push('Misleading double extension: this file may be disguised as a document.');
  if (/[\u202a-\u202e\u2066-\u2069]/u.test(name)) warnings.push('The filename contains direction-changing characters that can disguise its type.');
  if (entries.some(e => ALGORITHMS[e.algorithm]?.weak)) warnings.push('These legacy or short-output checksums provide limited assurance; use a stronger publisher digest when available.');
  if (entries.some(e => e.inferred)) warnings.push('An unlabeled digest was interpreted using conventional hash lengths; confirm the publisher’s algorithm.');
  if (!entries.length) warnings.push('No checksum could be associated with this file. Integrity is unverified.');
  return warnings;
}
