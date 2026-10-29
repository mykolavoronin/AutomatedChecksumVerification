'use strict';
importScripts('core.js');
self.onmessage = async ({ data }) => {
  try {
    let last = 0;
    const digests = await ChecksumCore.hashBlob(data.file, data.algorithms, (done, total) => {
      if (Date.now() - last > 750) { last = Date.now(); self.postMessage({ progress: total ? Math.round(done / total * 100) : 100 }); }
    });
    self.postMessage({ digests });
  } catch (error) { self.postMessage({ error: error.message }); }
};
