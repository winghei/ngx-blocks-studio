#!/usr/bin/env node
/**
 * Compile projects/demo/src/master.css (@theme / @compose) into a runtime manifest.
 * Usage: node scripts/compile-master-css.mjs [--watch]
 */
import { watch } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifestJSON } from '@master/css-project/manifest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'projects/demo/src/master.css');
const out = path.join(root, 'projects/demo/src/master-css.manifest.json');
const watchMode = process.argv.includes('--watch');

async function compile() {
  const started = Date.now();
  const result = await loadManifestJSON(entry);
  if (result.warnings?.length) {
    for (const warning of result.warnings) {
      console.warn('[master-css]', warning);
    }
  }
  await writeFile(out, result.json + '\n', 'utf8');
  console.log(
    `[master-css] compiled ${path.relative(root, entry)} → ${path.relative(root, out)} (${Date.now() - started}ms)`,
  );
}

await compile();

if (watchMode) {
  console.log(`[master-css] watching ${path.relative(root, entry)}`);
  let timer;
  watch(entry, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      compile().catch((err) => {
        console.error('[master-css] compile failed', err);
      });
    }, 100);
  });
}
