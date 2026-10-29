import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('scripts/vendor', { recursive: true });
await build({ entryPoints: ['src/core.js'], outfile: 'scripts/core.js', bundle: true,
  format: 'iife', globalName: 'ChecksumCore', target: 'chrome120', legalComments: 'eof' });
await copyFile('node_modules/@noble/hashes/LICENSE', 'scripts/vendor/noble-hashes-LICENSE.txt');
