#!/usr/bin/env node
/**
 * Resilience boundary guard, run in CI (`npm run lint:resilience`).
 *
 * 1. HttpClient may only be imported by the central API client, the health
 *    probe, and app.config (provider wiring). Feature code must use
 *    ApiClientService so timeouts/retries/classification cannot be bypassed.
 *    The one exception is the self-hosted translation sidecar: it is a
 *    DIFFERENT origin with its own contract (no storefront session, no
 *    circuit breaker, graceful fallback to the original text), so it cannot
 *    share the storefront API boundary — see TRANSLATION_SETUP.md.
 * 2. Every `<img>` must carry the SafeImage guard.
 * 3. Templates must not use CSS background images (they bypass SafeImage).
 *
 * Exit code 1 lists every violation with file:line.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const appDir = join(root, 'src', 'app');

const HTTP_CLIENT_ALLOWLIST = new Set([
  'src/app/core/api/api-client.service.ts',
  'src/app/app.config.ts',
  // Separate origin, separate contract (see the note above).
  'src/app/core/services/libre-translate.service.ts',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const violations = [];
const files = walk(appDir);

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const isSpec = rel.endsWith('.spec.ts');
  if (isSpec) continue;

  if (rel.endsWith('.ts')) {
    const source = readFileSync(file, 'utf8');
    const importsHttpClient =
      /from\s+['"]@angular\/common\/http['"]/.test(source) && /\bHttpClient\b/.test(source);
    if (importsHttpClient && !HTTP_CLIENT_ALLOWLIST.has(rel)) {
      violations.push(`${rel}: imports HttpClient directly (use ApiClientService)`);
    }
    if (/\bnew\s+HttpClient\s*\(/.test(source)) {
      violations.push(`${rel}: constructs HttpClient directly`);
    }
  }

  if (rel.endsWith('.html')) {
    const source = readFileSync(file, 'utf8');
    const lines = source.split(/\r?\n/);
    const imgTags = source.match(/<img\b[^>]*>/gis) ?? [];
    for (const tag of imgTags) {
      if (!/\bappSafeImg\b/.test(tag)) {
        const line = lineOf(source, tag);
        violations.push(`${rel}:${line}: <img> without appSafeImg`);
      }
      if (!/(\[alt\]|\balt\s*=)/.test(tag)) {
        const line = lineOf(source, tag);
        violations.push(`${rel}:${line}: <img> without alt text`);
      }
    }
    lines.forEach((text, index) => {
      if (/\[style\.(backgroundImage|background-image)\]/.test(text)) {
        violations.push(`${rel}:${index + 1}: CSS background image bypasses SafeImage`);
      }
    });
  }
}

function lineOf(source, needle) {
  const index = source.indexOf(needle);
  return source.slice(0, index).split(/\r?\n/).length;
}

if (violations.length) {
  console.error(`Resilience guard: ${violations.length} violation(s)`);
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log('Resilience guard: OK (API boundary + SafeImage + no CSS images)');
