#!/usr/bin/env node
// Quick Judge0 connectivity check:  npm run judge0:check
//
// Reads JUDGE0_URL / JUDGE0_API_KEY from .env, then:
//   1. hits  <url>/about      to confirm the instance is up
//   2. hits  <url>/languages  and shows which Judge0 ids your six editor
//      languages will map to
//
// Works from Windows PowerShell/CMD or from inside WSL — it only needs Node.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isJudge0Configured, judge0Url, buildHeaders, pickLanguageIds } from '../server/src/services/execution/Judge0Service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  console.log(`Loaded ${envPath}`);
} else {
  console.log('No .env found next to package.json — using the current environment.');
}

console.log(`JUDGE0_URL:     ${process.env.JUDGE0_URL || '(not set)'}`);
console.log(`JUDGE0_API_KEY: ${process.env.JUDGE0_API_KEY ? '(set)' : '(not set)'}`);

if (!isJudge0Configured()) {
  console.log('\nJudge0 is NOT configured, so code will run locally on this machine instead.');
  console.log('To use Judge0, set JUDGE0_URL in .env — for the bundled Docker stack that is:');
  console.log('    JUDGE0_URL=http://localhost:2358');
  process.exit(0);
}

const base = judge0Url();
const headers = buildHeaders();

const describeError = (error) => {
  const code = error?.cause?.code || error?.code;
  if (code === 'ECONNREFUSED') return 'Nothing is listening on that address. Is the Judge0 container running?  (npm run judge0:up)';
  if (code === 'ENOTFOUND') return 'That host name could not be resolved. Check the URL.';
  if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') return 'The connection timed out. Is Docker running and the port reachable?';
  return error?.message || String(error);
};

try {
  console.log(`\nChecking ${base}/about ...`);
  const aboutResponse = await fetch(`${base}/about`, { headers });
  if (!aboutResponse.ok) {
    console.log(`  HTTP ${aboutResponse.status} — the instance answered but rejected the request.`);
    if (aboutResponse.status === 401 || aboutResponse.status === 403) {
      console.log('  That usually means JUDGE0_API_KEY is missing or wrong.');
    }
    process.exit(1);
  }
  const about = await aboutResponse.json().catch(() => ({}));
  console.log(`  OK — Judge0 ${about.version || '(version unknown)'}`);

  console.log(`\nChecking ${base}/languages ...`);
  const languagesResponse = await fetch(`${base}/languages`, { headers });
  if (!languagesResponse.ok) {
    console.log(`  HTTP ${languagesResponse.status}`);
    process.exit(1);
  }
  const list = await languagesResponse.json();
  const ids = pickLanguageIds(list);
  const byId = new Map(list.map((item) => [item.id, item.name]));
  console.log(`  OK — ${list.length} languages reported.`);
  console.log('\nYour editor languages map to:');
  for (const [language, id] of Object.entries(ids)) {
    console.log(`  ${language.padEnd(11)} -> id ${String(id).padEnd(4)} ${byId.get(id) || '(fallback id)'}`);
  }
  console.log('\nAll good — set JUDGE0_URL in .env, restart the backend, and press the refresh icon in the terminal panel.');
} catch (error) {
  console.log(`\nFAILED: ${describeError(error)}`);
  process.exit(1);
}
