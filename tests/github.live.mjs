// Optional public-network integration. Never downloads release binaries.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)).replaceAll('\\','/').replace(/\/$/,'');
await mkdir(`${root}/test-results`,{recursive:true});
const context=await chromium.launchPersistentContext(`${root}/test-results/github-live-${Date.now()}`,{
  executablePath:process.env.CHROMIUM_EXECUTABLE||chromium.executablePath(),headless:true,acceptDownloads:false,
  args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`]
});
try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const page=await context.newPage();await page.goto(`chrome-extension://${new URL(worker.url()).host}/report.html`);
  const result=await page.evaluate(()=>chrome.runtime.sendMessage({type:'discover-catalog',page:'https://github.com/cli/cli/releases/latest'}));
  assert.ok(!result.error,result.error);assert.ok(result.entries?.length>0,'No published release digests returned');
  for(const entry of result.entries){
    assert.equal(entry.algorithm,'sha256');assert.match(entry.value,/^[a-f\d]{64}$/);
    assert.ok(entry.downloadURL.startsWith('https://github.com/cli/cli/releases/download/'));
    assert.ok(result.files.some(file=>file.url===entry.downloadURL));
  }
  console.log(`PASS live GitHub release: ${result.files.length} artifacts, ${result.entries.length} URL-bound SHA-256 digests; no binaries downloaded.`);
}finally{await context.close();}
