// Adds the "out for delivery" order status to every storefront locale.
// Run once from the storefront root: node scripts/add-out-for-delivery.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const labels = {
  en: 'Out for delivery',
  ar: 'خرج للتوصيل',
  cs: 'Expedováno',
  de: 'In Zustellung',
  fr: 'En cours de livraison',
  it: 'In consegna',
  pl: 'W drodze do dostawy',
  sk: 'V doručení',
};

const root = process.argv[2] ?? '.';
let changed = 0;

for (const [locale, label] of Object.entries(labels)) {
  const file = join(root, 'src', 'app', 'i18n', `${locale}.ts`);
  const text = readFileSync(file, 'utf8');
  if (text.includes('statusOutfordelivery:')) {
    console.log(`${locale}: already present`);
    continue;
  }

  const marker = /(\n(\s*)statusDelivered:)/;
  if (!marker.test(text)) {
    throw new Error(`${locale}: statusDelivered marker not found`);
  }

  const next = text.replace(marker, (_m, tail, indent) => `\n${indent}statusOutfordelivery: '${label}',${tail}`);
  writeFileSync(file, next, 'utf8');
  changed++;
  console.log(`${locale}: added`);
}

console.log(`${changed} locale file(s) updated.`);
