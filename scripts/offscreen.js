'use strict';
const pending = new Set();
let chain = Promise.resolve();
function readFile(url) {
  return new Promise((resolve, reject) => {
    // Chrome's Fetch API does not support file: URLs. XHR lives in this extension
    // document, never in a service worker or an untrusted webpage.
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.timeout = 120000;
    xhr.onload = () => xhr.response instanceof Blob && (xhr.status === 0 || xhr.status === 200) ? resolve(xhr.response) : reject(new Error('Could not read the downloaded file.'));
    xhr.onerror = xhr.ontimeout = () => reject(new Error('Chrome denied or timed out local file access. Choose the file manually in the extension.'));
    xhr.send();
  });
}
async function run(request) {
  let worker;
  try {
    const file = await readFile(request.url);
    if (request.size >= 0 && file.size !== request.size) throw new Error('The file size has changed since download. Verify the selected file manually.');
    worker = new Worker(chrome.runtime.getURL('scripts/hash-worker.js'));
    const digests = await new Promise((resolve, reject) => {
      worker.onerror = () => reject(new Error('Checksum worker failed.'));
      worker.onmessage = ({ data }) => {
        if (data.digests) resolve(data.digests);
        else if (data.error) reject(new Error(data.error));
        else chrome.runtime.sendMessage({ type: 'hash-progress', id: request.id, progress: data.progress }).catch(() => {});
      };
      worker.postMessage({ file, algorithms: request.algorithms });
    });
    pending.delete(request.id);
    await chrome.runtime.sendMessage({ type: 'hash-result', id: request.id, digests });
  } catch (error) {
    pending.delete(request.id);
    await chrome.runtime.sendMessage({ type: 'hash-result', id: request.id, error: error.message }).catch(() => {});
  } finally { worker?.terminate(); pending.delete(request.id); }
}
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('scripts/background.js') || request?.target !== 'offscreen' || request.type !== 'hash') return;
  if (!/^file:\/\/\//.test(request.url) || !Number.isSafeInteger(request.id)) { respond({ error: 'Invalid file request.' }); return; }
  if (!pending.has(request.id)) {
    pending.add(request.id);
    chain = chain.then(() => run(request)).catch(() => { pending.delete(request.id); });
  }
  respond({ queued: true });
});
