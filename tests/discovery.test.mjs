import test from 'node:test';
import assert from 'node:assert/strict';
import { ALGORITHMS, DEFAULT_SETTINGS, sanitizeSettings, discoverURLs, sidecarInfo, sidecarCandidates, isPublicHTTPS, downloadDecision, parseChecksums, catalogForPage } from '../src/core.js';
const sample = 'https://download.jetbrains.com/toolbox/jetbrains-toolbox-3.9.0.88839.exe.sha256';

test('GitHub release lookup stays on the official API and exact release',()=>{
  for(const path of ['/owner/project/releases/tag/v2','/owner/project/releases/download/v2/app.zip'])assert.equal(catalogForPage('https://github.com'+path)?.url,'https://api.github.com/repos/owner/project/releases/tags/v2');
  assert.equal(catalogForPage('https://github.com/owner/project/releases/latest')?.url,'https://api.github.com/repos/owner/project/releases/latest');
  for(const url of ['https://github.com.evil.example/owner/project/releases','http://github.com/owner/project/releases','https://github.com/owner/project/issues'])assert.equal(catalogForPage(url),null);
});

test('aggregate manifests are never mistaken for artifact-specific sidecars',()=>{
  for(const name of ['checksums.sha256','SHA256SUMS.txt','SHA256SUMS.asc','hashes.json','checksums.json']){
    const info=sidecarInfo('https://publisher.example/releases/'+name);assert.ok(info);assert.equal(info.fileURL,'');assert.equal(info.filename,'');
  }
  assert.equal(sidecarInfo('https://publisher.example/checksums.sha256').algorithm,'sha256');
});

test('explicit BLAKE2 and SHAKE sidecars preserve the artifact and output length', () => {
  for (const suffix of ['blake2b-128','blake2b-160','blake2b-224','blake2b-256','blake2b-384','blake2s-128','blake2s-160','blake2s-224','shake128-128','shake128-256','shake256-256','shake256-512']) {
    const info = sidecarInfo(`https://publisher.test/releases/archive.zip.${suffix}`);
    assert.equal(info?.fileURL,'https://publisher.test/releases/archive.zip');
    const key=suffix.replaceAll('-','');
    assert.equal(parseChecksums(`${info.algorithm}: ${'a'.repeat(ALGORITHMS[key].bytes*2)}`)[0]?.algorithm,key);
  }
});
test('JetBrains sidecar identifies the exact executable and parses its published record', () => {
  const info = sidecarInfo(sample);
  assert.equal(info.fileURL, sample.slice(0, -7));
  assert.equal(info.filename, 'jetbrains-toolbox-3.9.0.88839.exe');
  assert.equal(info.algorithm, 'sha256');
  const entries = parseChecksums('5600a4fbcc17a1463951f1d1092387bcc6acff34f069629664d65adedb7ffac5 *jetbrains-toolbox-3.9.0.88839.exe', info);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].filename, info.filename);
  assert.equal(entries[0].value.length, 64);
});
test('hidden HTML, escaped JSON and relative code URLs are discovered without evaluation', () => {
  const input = `<a hidden href="${sample}">digest</a><script>const urls={linux:"https:\\/\\/cdn.example.com\\/app.tar.gz",win:"/releases/app.exe"}; throw new Error('must never execute');</script><button data-download-url="/releases/other.msi"></button>`;
  const files = discoverURLs(input, 'https://publisher.example.com/download');
  assert.ok(files.some(file => file.url === sample.slice(0, -7) && file.checksumURL === sample));
  assert.ok(files.some(file => file.url === 'https://cdn.example.com/app.tar.gz'));
  assert.ok(files.some(file => file.url === 'https://publisher.example.com/releases/app.exe'));
  assert.ok(files.some(file => file.url === 'https://publisher.example.com/releases/other.msi'));
  assert.deepEqual(discoverURLs('"javascript:alert(1)" "file:///secret.exe"', 'https://example.com'), []);
});
test('conventional sidecar candidates retain query strings and deduplicate redirects', () => {
  const candidates = sidecarCandidates({ url: 'https://example.com/file.exe?token=x', finalUrl: 'https://example.com/file.exe?token=x' });
  assert.equal(candidates.length, 9);
  assert.deepEqual(candidates.slice(0, 2), ['https://example.com/file.exe.sha256?token=x', 'https://example.com/file.exe.sha512?token=x']);
  assert.ok(candidates.includes('https://example.com/SHA256SUMS?token=x'));
  assert.deepEqual(sidecarCandidates({ url: 'https://example.com/get.php' }), []);
});
test('settings are allowlisted, normalized and resilient to corrupt storage', () => {
  const settings = sanitizeSettings({ enabled: 'yes', theme: 'javascript', blockMode: 'allow-danger', historyLimit: -1, blockedHosts: ['HOST.EXAMPLE.COM', 'host.example.com', 'https://bad.example', '*.example.com'] });
  assert.equal(settings.enabled, true);
  assert.equal(settings.theme, 'light');
  assert.equal(settings.blockMode, 'dangerous');
  assert.equal(settings.historyLimit, 100);
  assert.deepEqual(settings.blockedHosts, ['host.example.com']);
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
});
test('CDN fetching permits public HTTPS hosts and excludes private or credentialed endpoints', () => {
  assert.equal(isPublicHTTPS(sample), true);
  for (const url of ['http://cdn.example.com/a.sha256', 'https://127.0.0.1/a.sha256', 'https://10.0.0.1/a.sha256', 'https://router.local/a.sha256', 'https://localhost/a.sha256', 'https://[::1]/a.sha256', 'https://u:p@example.com/a.sha256']) assert.equal(isPublicHTTPS(url), false, url);
});
test('Toolbox catalog discovery is limited to the actual publisher and product pages', () => {
  assert.ok(catalogForPage('https://www.jetbrains.com/toolbox-app/'));
  assert.ok(catalogForPage('https://www.jetbrains.com/fr-fr/toolbox-app/download/'));
  for (const url of ['https://www.jetbrains.com.evil.example/toolbox-app/', 'https://evil.example/toolbox-app/', 'https://www.jetbrains.com/idea/']) assert.equal(catalogForPage(url), null);
});
test('blocking decisions distinguish known threats, missing digests, conflicts and user approval', () => {
  const file = { url: 'https://downloads.example.com/app.exe', danger: 'safe' };
  const strong = [{ algorithm: 'sha256', value: 'a'.repeat(64) }];
  const weak = [{ algorithm: 'md5', value: 'a'.repeat(32) }];
  const decide = (settings, entries = [], item = file) => downloadDecision(item, entries, { ...DEFAULT_SETTINGS, ...settings }, ALGORITHMS).action;
  assert.equal(decide({}), 'allow');
  assert.equal(decide({}, [], { ...file, danger: 'content' }), 'cancel');
  assert.equal(decide({ blockMode: 'off' }, [], { ...file, danger: 'content' }), 'allow');
  assert.equal(decide({ blockedHosts: ['downloads.example.com'], blockMode: 'off' }), 'cancel');
  assert.equal(decide({ blockMode: 'require-checksum' }), 'hold');
  assert.equal(decide({ blockMode: 'require-checksum' }, weak), 'hold');
  assert.equal(decide({ blockMode: 'require-checksum' }, strong), 'allow');
  assert.equal(decide({ blockMode: 'require-checksum' }, [...strong, { ...strong[0], value: 'b'.repeat(64) }]), 'hold');
  assert.equal(decide({ blockMode: 'hold-all' }, strong), 'hold');
  assert.equal(decide({ enabled: false, blockedHosts: ['downloads.example.com'] }), 'allow');
});
