#!/usr/bin/env node
/**
 * Generates static AsyncAPI HTML docs for every bounded context that has an
 * apis/asyncapi.yaml, via the official AsyncAPI Generator
 * (@asyncapi/html-template). Output lands in static/asyncapi/<context>/ and
 * is embedded into docs/api-reference/async/<context>.md via an iframe, so
 * it survives a Docusaurus build unmodified as a static asset.
 *
 * Run: npm run gen-async-docs:all  (wired into `npm run build`); pass context
 * names to regenerate only those (node scripts/gen-async-docs.mjs facility-layout).
 * Any failure exits 1.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Every context with a real apis/<context>/asyncapi.yaml in this repo.
const CONTEXTS = [
  'order-management',
  'inventory-storage',
  'wes-work-planning',
  'fulfillment-execution',
  'workforce-management',
  'facility-layout',
  'process-path-management',
  'labor-performance',
  'network-fulfillment',
  'warehouse-planning',
  'product-master',
  'inbound-receiving',
  'slotting-optimization',
  'network-inventory-planning',
  'pick-face-replenishment',
  'task-interleaving',
  'returns-processing',
  'exception-management',
];

const asyncapiBin = path.join(root, 'tools', 'asyncapi-gen', 'node_modules', '.bin', 'asyncapi');
const asyncapiGenCwd = path.join(root, 'tools', 'asyncapi-gen');
const failures = [];

const only = process.argv.slice(2);
for (const ctx of only.length ? CONTEXTS.filter((c) => only.includes(c)) : CONTEXTS) {
  const specPath = path.join(root, 'apis', ctx, 'asyncapi.yaml');
  if (!existsSync(specPath)) {
    console.log(`[gen-async-docs] skip ${ctx}: no asyncapi.yaml`);
    continue;
  }
  const outDir = path.join(root, 'static', 'asyncapi', ctx);
  rmSync(outDir, {recursive: true, force: true});
  mkdirSync(path.dirname(outDir), {recursive: true});
  console.log(`[gen-async-docs] generating ${ctx} -> static/asyncapi/${ctx}`);
  try {
    execFileSync(
      asyncapiBin,
      [
        'generate',
        'fromTemplate',
        specPath,
        '@asyncapi/html-template',
        '-o',
        outDir,
        '--force-write',
      ],
      {stdio: 'inherit', cwd: asyncapiGenCwd},
    );
  } catch (err) {
    failures.push(ctx);
    console.error(`[gen-async-docs] FAILED for ${ctx}: ${err.message}`);
  }
}

if (failures.length > 0) {
  console.error(
    `[gen-async-docs] done with ${failures.length} failure(s): ${failures.join(', ')}`,
  );
  console.error(
    '[gen-async-docs] the output dir of a failed context was deleted before ' +
      'generation, so its embedded AsyncAPI page would ship empty. Run ' +
      '`tools/asyncapi-gen/node_modules/.bin/asyncapi validate apis/<ctx>/asyncapi.yaml` ' +
      'for the real diagnostics and fix the spec in the context repository.',
  );
  process.exitCode = 1; // fatal: a failed context must not reach Pages with a broken embed
} else {
  console.log('[gen-async-docs] done.');
}
