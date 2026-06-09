#!/usr/bin/env node
/**
 * Regenera src/app/data/thermoKingMp4000Alarms.json desde dhilreefer.blogspot.com
 * Uso: node scripts/scrapeThermoKingAlarms.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const INDEX_URL = 'https://dhilreefer.blogspot.com/p/blog-page_277.html';
const OUT_FRONT = join(dirname(fileURLToPath(import.meta.url)), '../src/app/data/thermoKingMp4000Alarms.json');
const OUT_SERVER = join(dirname(fileURLToPath(import.meta.url)), '../server/src/data/thermoKingMp4000Alarms.json');
const UA = 'Mozilla/5.0 (compatible; RiperAlarmScraper/1.0)';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

function htmlToText(fragment) {
  return fragment
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/h3>/gi, '\n\n')
    .replace(/<h3[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[m.slice(1, -1).toLowerCase()] ?? m))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanText(s) {
  return s.replace(/\n<div class=['"].*/s, '').trim();
}

function parseIndex(html) {
  const rows = [];
  for (const part of html.split('<tr>')) {
    if (!part.includes('text-align: center')) continue;
    const url = part.match(/text-align: center.*?href="([^"]+)"/s)?.[1];
    const code = part.match(/text-align: center.*?>(\d+)\s*<\/span>/s)?.[1];
    const title = part.match(/text-align: left.*?&nbsp;([^<]+)<\/span>/s)?.[1]?.trim();
    if (url && code && title) rows.push({ code: Number(code), url, titleEn: title });
  }
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return [...byCode.values()].sort((a, b) => a.code - b.code);
}

function parseDetail(html) {
  const idx = html.indexOf('Description');
  if (idx < 0) return { descriptionEn: '', correctiveActionEn: '' };
  const start = html.lastIndexOf('<div dir="ltr"', idx);
  const end = html.indexOf('<div class="post-footer', idx);
  const body = end > start ? html.slice(start, end) : html.slice(idx, idx + 15000);
  const text = htmlToText(body);
  let descriptionEn = text;
  let correctiveActionEn = '';
  if (text.includes('Corrective Action')) {
    const parts = text.split(/\n\nCorrective Action\s*\n\n?/);
    if (parts.length === 2) {
      correctiveActionEn = cleanText(parts[1]);
      descriptionEn = cleanText(parts[0].replace(/^Description\s*\n\n?/, ''));
    }
  } else {
    descriptionEn = cleanText(text.replace(/^Description\s*\n\n?/, ''));
  }
  return { descriptionEn, correctiveActionEn };
}

const TITLE_ES = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'thermoKingAlarmTitlesEs.json'), 'utf8'));

function translateEs(en) {
  const phrases = [
    ['Open circuit', 'Circuito abierto'],
    ['Short circuit', 'Cortocircuito'],
    ['Defective or wrong sensor', 'Sensor defectuoso o incorrecto'],
    ['Defective wiring', 'Cableado defectuoso'],
    ['Defective controller', 'Controlador defectuoso'],
    ['Check for damaged sensor wires', 'Verificar cables del sensor dañados'],
    ['Indicates:', 'Indica:'],
    ['Corrective Action', 'Acción correctiva'],
  ];
  let s = en;
  for (const [a, b] of phrases) s = s.split(a).join(b);
  return s;
}

const indexHtml = await fetchText(INDEX_URL);
const indexRows = parseIndex(indexHtml);
console.log(`Index: ${indexRows.length} alarm codes`);

const alarms = [];
for (const row of indexRows) {
  let detail = { descriptionEn: '', correctiveActionEn: '' };
  try {
    detail = parseDetail(await fetchText(row.url));
    await new Promise((r) => setTimeout(r, 300));
  } catch (e) {
    detail.scrapeError = String(e);
  }
  alarms.push({
    code: row.code,
    titleEn: row.titleEn,
    titleEs: TITLE_ES[String(row.code)] ?? row.titleEn,
    url: row.url,
    descriptionEn: detail.descriptionEn,
    descriptionEs: translateEs(detail.descriptionEn),
    correctiveActionEn: detail.correctiveActionEn,
    correctiveActionEs: translateEs(detail.correctiveActionEn),
    model: 'MP4000',
    source: 'dhilreefer.blogspot.com',
  });
  console.log(`  ${row.code} ${row.titleEn.slice(0, 40)}`);
}

const payload = JSON.stringify(
  {
    meta: {
      sourceUrl: INDEX_URL,
      model: 'Thermo King MP4000',
      scrapedAt: new Date().toISOString().slice(0, 10),
      count: alarms.length,
    },
    alarms,
  },
  null,
  2
);

writeFileSync(OUT_FRONT, payload, 'utf8');
writeFileSync(OUT_SERVER, payload, 'utf8');
console.log(`Wrote ${OUT_FRONT}`);
console.log(`Wrote ${OUT_SERVER}`);
