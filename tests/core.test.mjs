import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ALGORITHMS, hashBlob, parseChecksums, parseStructuredChecksums, githubReleaseAssets, catalogForPage, forFile, verify, fileURL, canonicalURL, securityWarnings } from '../src/core.js';

const sha = 'a'.repeat(64);
const md5 = 'b'.repeat(32);

test('GitHub release digests bind the exact repository, tag, filename and URL',()=>{
  const catalog=catalogForPage('https://github.com/owner/project/releases/tag/v1.2.3');
  const asset={name:'app.zip',state:'uploaded',browser_download_url:'https://github.com/Owner/Project/releases/download/v1.2.3/app.zip',digest:`sha256:${sha}`};
  const result=githubReleaseAssets({tag_name:'v1.2.3',assets:[asset,{...asset,browser_download_url:'https://github.com/other/project/releases/download/v1.2.3/app.zip'},{...asset,browser_download_url:'https://github.com/owner/project/releases/download/v9/app.zip'},{...asset,name:'wrong.zip'}]},catalog);
  assert.equal(result.files.length,1);assert.equal(result.entries.length,1);
  assert.equal(result.entries[0].downloadURL,asset.browser_download_url);assert.equal(result.entries[0].value,sha);
  assert.equal(githubReleaseAssets({tag_name:'v2',assets:[asset]},catalog).entries.length,0);
  assert.equal(githubReleaseAssets({tag_name:'v1.2.3',draft:true,assets:[asset]},catalog).entries.length,0);
});

test('structured metadata preserves URL identity across nested digests and file maps',()=>{
  const input={assets:[{name:'app.zip',browser_download_url:'https://example.com/linux/app.zip',digest:`sha256:${sha}`},{filename:'app.zip',downloadUrl:'https://example.com/windows/app.zip',digests:{sha256:'c'.repeat(64)}}]};
  const entries=parseStructuredChecksums(JSON.stringify(input));
  assert.equal(entries.length,2);assert.equal(entries[0].downloadURL,'https://example.com/linux/app.zip');assert.equal(entries[1].downloadURL,'https://example.com/windows/app.zip');
  assert.equal(parseStructuredChecksums(JSON.stringify({'archive.zip':`sha256:${sha}`}))[0].filename,'archive.zip');
});

test('GNU escaped filenames, NUL records and tagged base64 lists retain identity',()=>{
  assert.equal(parseChecksums(`\\${sha} *new\\nline.zip`)[0].filename,'new\nline.zip');
  assert.equal(parseChecksums(`${sha} *line\nbreak.zip\0${sha} *other.zip\0`)[0].filename,'line\nbreak.zip');
  const encoded=Buffer.from(sha,'hex').toString('base64');
  assert.equal(parseChecksums(`SHA256 (archive.zip) = ${encoded}`)[0].value,sha);
  assert.deepEqual(parseChecksums('SHA256 (archive.zip) = YWJj'),[]);
});
test('all supported hash algorithms: independent vectors, empty input, and chunk boundaries', async () => {
  const mapping = { md5: 'md5', sha1: 'sha1', ripemd160: 'ripemd160', sha224: 'sha224', sha256: 'sha256', sha384: 'sha384', sha512: 'sha512', sha512224: 'sha512-224', sha512256: 'sha512-256', sha3224: 'sha3-224', sha3256: 'sha3-256', sha3384: 'sha3-384', sha3512: 'sha3-512', blake2b: 'blake2b512', blake2s: 'blake2s256' };
  for (const input of [Buffer.alloc(0), Buffer.from('abc'), Buffer.alloc(1024 * 1024 + 17, 0xa5)]) {
    const actual = await hashBlob(new Blob([input]), Object.keys(mapping));
    for (const [name, openssl] of Object.entries(mapping)) assert.equal(actual[name], createHash(openssl).update(input).digest('hex'), `${name}/${input.length}`);
  }
  assert.equal((await hashBlob(new Blob(['123456789']), ['crc32'])).crc32, 'cbf43926');
  const extra = await hashBlob(new Blob(['abc']), ['keccak256', 'blake3']);
  assert.equal(extra.keccak256, '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(extra.blake3, '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85');
  assert.equal(Object.keys(ALGORITHMS).length, 30);
});

test('parameterized BLAKE2 and explicit-length SHAKE match independent implementations', async () => {
  const { vectors } = JSON.parse(await readFile(new URL('./blake2-vectors.json', import.meta.url), 'utf8'));
  const shakes = { shake128128: ['shake128',16], shake128256: ['shake128',32], shake256256: ['shake256',32], shake256512: ['shake256',64] };
  for (const [label, input] of [['empty',Buffer.alloc(0)],['abc',Buffer.from('abc')],['chunk',Buffer.alloc(1024*1024+17,0xa5)]]) {
    const actual = await hashBlob(new Blob([input]), [...Object.keys(vectors),...Object.keys(shakes)]);
    for (const [name, expected] of Object.entries(vectors)) assert.equal(actual[name],expected[label],`${name}/${label}`);
    for (const [name,[algorithm, outputLength]] of Object.entries(shakes)) assert.equal(actual[name],createHash(algorithm,{outputLength}).update(input).digest('hex'),`${name}/${label}`);
    for (const name of Object.keys(actual)) {
      const human = name.startsWith('shake') ? name.replace(/^(shake(?:128|256))(.*)$/,'$1-$2') : name.replace(/^(blake2[bs])(.*)$/,'$1-$2');
      assert.equal(parseChecksums(`${human}: ${actual[name]}`)[0]?.algorithm,name);
    }
  }
  assert.deepEqual(parseChecksums(`BLAKE2s-512: ${'a'.repeat(128)}`), []);
});
test('GNU, BSD, SFV, headings, SRI, case and explicit algorithm aliases', () => {
  const parsed = parseChecksums(`${sha.toUpperCase()} *first.iso\nSHA-256 (second.iso) = ${sha}\nfile.zip cbf43926\nSHA3-256:\n${sha}\nSHA-512/256 (third.iso) = ${sha}\nBLAKE2b-512 (fourth.iso) = ${'c'.repeat(128)}`);
  assert.ok(parsed.some(e => e.filename === 'first.iso' && e.value === sha));
  assert.ok(parsed.some(e => e.filename === 'second.iso' && e.algorithm === 'sha256'));
  assert.ok(parsed.some(e => e.filename === 'file.zip' && e.algorithm === 'crc32'));
  assert.ok(parsed.some(e => !e.filename && e.algorithm === 'sha3256'));
  assert.ok(parsed.some(e => e.filename === 'third.iso' && e.algorithm === 'sha512256'));
  assert.ok(parsed.some(e => e.filename === 'fourth.iso' && e.algorithm === 'blake2b'));
  assert.equal(parseChecksums(`sha256-${Buffer.from(sha, 'hex').toString('base64')}`)[0].value, sha);
});
test('reject unsupported labels, truncated tokens and wrong digest lengths', () => {
  assert.deepEqual(parseChecksums(`sha999: ${sha}`), []);
  assert.deepEqual(parseChecksums(`SHA-512 (file) = ${sha}`), []);
  assert.deepEqual(parseChecksums('a'.repeat(129)), []);
  assert.deepEqual(parseChecksums(`g${sha}g`), []);
  assert.deepEqual(parseChecksums(`SHA-256: abcdef12`), []);
  assert.deepEqual(parseChecksums(`SHAKE128 (file) = ${sha}`), []);
  assert.equal(parseChecksums(`${sha} file-sha512.zip`)[0].algorithm, 'sha256');
});
test('do not discard valid low-diversity or mixed-case checksums', () => {
  assert.equal(parseChecksums('0'.repeat(64))[0].value, '0'.repeat(64));
  assert.equal(parseChecksums('Ab01'.repeat(16))[0].value, 'ab01'.repeat(16));
});
test('file association excludes unrelated digests and respects filename case', () => {
  const entries = parseChecksums(`${sha} first.iso\n${md5} second.iso\n${'c'.repeat(64)}`);
  assert.equal(forFile(entries, 'first.iso').length, 1);
  assert.equal(forFile(entries, 'FIRST.iso').length, 0);
  assert.equal(forFile(entries, 'second.iso', true).length, 2);
});
test('all checks must match; legacy success cannot override a strong mismatch', () => {
  const entries = parseChecksums(`${sha} first.iso\n${md5} first.iso`);
  assert.equal(verify(entries, { sha256: 'c'.repeat(64), md5 }).status, 'mismatch');
  assert.equal(verify(entries, { sha256: sha, md5 }).status, 'match');
  assert.equal(verify([entries[1]], { md5 }).status, 'weak-match');
  assert.equal(verify([], {}).status, 'unverified');
  assert.equal(verify([...entries, { ...entries[0], value: 'c'.repeat(64) }], { sha256: sha, md5 }).status, 'conflict');
  assert.equal(verify(entries, {}).status, 'mismatch');
});
test('strict URL and path handling prevents credential leakage or network file access', () => {
  assert.equal(canonicalURL('https://example.com/f?a=1#x'), 'https://example.com/f?a=1');
  for (const url of ['javascript:alert(1)', 'file:///secret', 'https://user:pass@example.com/f']) assert.equal(canonicalURL(url), null);
  assert.equal(fileURL('C:\\Users\\file #?.zip'), 'file:///C:/Users/file%20%23%3F.zip');
  assert.equal(fileURL('/tmp/file%.zip'), 'file:///tmp/file%25.zip');
  assert.throws(() => fileURL('\\\\server\\share\\file'));
  assert.throws(() => fileURL('relative.txt'));
});
test('security warnings remain separate from integrity success', () => {
  const warnings = securityWarnings({ filename: 'invoice.pdf.exe', url: 'http://example.com/file', referrer: 'http://example.com', danger: 'accepted' }, parseChecksums(md5));
  assert.ok(warnings.some(w => w.includes('Chrome download warning')));
  assert.ok(warnings.some(w => w.includes('double extension')));
  assert.ok(warnings.some(w => w.includes('insecure HTTP')));
  assert.ok(warnings.some(w => w.includes('legacy')));
  assert.ok(securityWarnings({ filename: 'safe\u202eexe.pdf' }).some(w => w.includes('direction-changing')));
});
test('embedded JSON checksums retain artifact identity without executing code', () => {
  const input = JSON.stringify({ assets: [{ filename: 'file.zip', checksums: { 'SHA-256': sha, md5 } }, { url: 'https://example.com/other.iso', algorithm: 'SHA3-256', checksum: sha }] });
  const entries = parseStructuredChecksums(input, 'https://example.com/download');
  assert.equal(forFile(entries, 'file.zip').length, 2);
  assert.equal(forFile(entries, 'other.iso')[0].algorithm, 'sha3256');
  assert.deepEqual(parseStructuredChecksums('window.x = alert(1)'), []);
  assert.deepEqual(parseStructuredChecksums(JSON.stringify({ sha256: sha })), []);
});
test('wrapped and grouped labeled digests preserve algorithm identity', () => {
  assert.equal(parseChecksums(`SHA-256:\n${sha.slice(0,16)}\n${sha.slice(16,32)}\n${sha.slice(32,48)}\n${sha.slice(48)}`)[0].value, sha);
  assert.equal(parseChecksums(`SHA-256: ${sha.match(/.{8}/g).join(' ')}`)[0].value, sha);
  assert.deepEqual(parseChecksums(`SHA-512: ${sha.match(/.{8}/g).join(' ')}`), []);
});
test('labeled base64 digests are decoded only to the stated algorithm length', () => {
  assert.equal(parseChecksums(`SHA-256: ${Buffer.from(sha,'hex').toString('base64')}`)[0].value, sha);
  assert.equal(parseChecksums(`SHA-384: ${Buffer.alloc(48).toString('base64')}`)[0].value, '0'.repeat(96));
  assert.deepEqual(parseChecksums('SHA-512: YWJj'), []);
});
test('filename-first records do not turn unsupported algorithm labels into hashes', () => {
  assert.equal(parseChecksums(`archive.zip: ${sha}`)[0].filename, 'archive.zip');
  assert.equal(parseChecksums(`archive.zip ${sha}`)[0].value, sha);
  assert.deepEqual(parseChecksums(`sha999: ${sha}`), []);
});
test('JSON filename maps, digest arrays, and JSON-shaped assignments retain file identity', () => {
  const input = { 'archive.zip': { digests: [{ algorithm: 'SHA-256', value: sha }] } };
  const results = parseStructuredChecksums(`window.release = ${JSON.stringify(input)};`);
  assert.equal(results[0].filename, 'archive.zip');
  assert.equal(results[0].algorithm, 'sha256');
  assert.equal(results[0].format, 'Structured JSON');
  assert.deepEqual(parseStructuredChecksums('window.release = {sha256: alert(1)};'), []);
});
