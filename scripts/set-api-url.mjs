#!/usr/bin/env node
/**
 * Injects the deployed API origin into the production Angular environment.
 *
 * Cloudflare Pages (or any CI) runs this before `ng build`. The source file
 * keeps its localhost value so local builds behave exactly as before. Without
 * API_BASE_URL the script is a no-op.
 *
 * Usage: API_BASE_URL=https://pharora-api.onrender.com/api/v1 node scripts/set-api-url.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE = resolve(process.cwd(), 'src/environments/environment.ts');
const raw = process.env.API_BASE_URL?.trim();

if (!raw) {
  console.error('[set-api-url] API_BASE_URL is required for a production deployment.');
  process.exit(1);
}

const apiBaseUrl = raw.replace(/\/+$/, '');
let parsed;
try {
  parsed = new URL(apiBaseUrl);
} catch {
  console.error(`[set-api-url] API_BASE_URL is not a valid URL: ${raw}`);
  process.exit(1);
}

if (parsed.protocol !== 'https:') {
  console.error('[set-api-url] API_BASE_URL must use https:// in a deployed build.');
  process.exit(1);
}

if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
  console.error('[set-api-url] API_BASE_URL must not point at localhost.');
  process.exit(1);
}

if (!apiBaseUrl.endsWith('/api/v1')) {
  console.warn('[set-api-url] API_BASE_URL does not end with /api/v1; the API contract uses that prefix.');
}

const source = readFileSync(ENV_FILE, 'utf8');
const next = source.replace(/apiBaseUrl:\s*'[^']*'/, `apiBaseUrl: '${apiBaseUrl}'`);

if (next === source) {
  console.error(`[set-api-url] No apiBaseUrl assignment found in ${ENV_FILE}.`);
  process.exit(1);
}

writeFileSync(ENV_FILE, next, 'utf8');
console.log(`[set-api-url] apiBaseUrl -> ${apiBaseUrl}`);
