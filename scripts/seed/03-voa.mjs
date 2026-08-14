/**
 * 03-voa.mjs — VOA Learning English articles -> readingPassage records.
 *
 * Source: https://learningenglish.voanews.com (Voice of America — public domain).
 * Policy: robots.txt is fetched and logged FIRST; if any path we need is
 * Disallow'd for User-agent *, this source stops and reports as blocked.
 * Throttled to 1 request/second. Articles whose byline/credit mentions AP,
 * Reuters or AFP — or that have no identifiable byline — are skipped.
 *
 * Level mapping by section (VOA does not tag articles with machine-readable
 * CEFR levels): American Stories -> A2, core feature sections -> B1,
 * idiom/science sections -> B2. Emits out/readingPassages.jsonl.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  OUT_DIR, CACHE_DIR, ensureDirs, fetchCachedText, stripHtml,
  makeRecord, writeJsonl, sleep, countBy, formatDist,
} from './lib.mjs';

const BASE = 'https://learningenglish.voanews.com';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': BROWSER_UA };

const TARGET_PASSAGES = 25;
const MAX_PER_SECTION = 8;
const THROTTLE_MS = 1000; // 1 request/second
const MIN_TEXT_CHARS = 800;
const MIN_TEXT_WORDS = 100;

const SECTIONS = [
  { name: 'American Stories', path: '/z/1581', level: 'A2' },
  { name: 'As It Is', path: '/z/3521', level: 'B1' },
  { name: 'Arts & Culture', path: '/z/986', level: 'B1' },
  { name: 'Health & Lifestyle', path: '/z/955', level: 'B1' },
  { name: 'Science & Technology', path: '/z/1579', level: 'B2' },
  { name: 'Words & Their Stories', path: '/z/987', level: 'B2' },
];

const ATTRIBUTION = 'Voice of America — public domain';
const WIRE_RE = /associated press|\bAP\b|reuters|agence france[- ]presse|\bAFP\b/i;

function cacheName(url) {
  return join(CACHE_DIR, `voa__${url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]+/g, '_')}.html`);
}

let lastRequestAt = 0;
/** Cached page fetch; the 1 req/s throttle only applies when actually hitting the network. */
async function fetchPage(url) {
  const cachePath = cacheName(url);
  if (existsSync(cachePath)) return fetchCachedText(url, cachePath, { headers: HEADERS });
  if (!url.includes('robots.txt')) {
    const wait = THROTTLE_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
  }
  return fetchCachedText(url, cachePath, { headers: HEADERS });
}

/* ------------------------------ robots.txt ------------------------------ */

function parseRobots(robotsText) {
  // Returns Disallow patterns for the `User-agent: *` group(s) only.
  // Consecutive User-agent lines before any rule belong to the same group.
  const groups = [];
  let current = null;
  for (const rawLine of robotsText.split('\n')) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2];
    if (field === 'user-agent') {
      if (!current || current.disallows.length > 0) {
        current = { agents: [], disallows: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (field === 'disallow' && current) {
      current.disallows.push(value);
    }
  }
  const patterns = [];
  for (const g of groups) if (g.agents.includes('*')) patterns.push(...g.disallows.filter(Boolean));
  return patterns;
}

function robotsPatternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${regex}${anchored ? '$' : ''}`);
}

function isAllowed(path, patterns) {
  for (const p of patterns) if (robotsPatternToRegex(p).test(path)) return false;
  return true;
}

/* ------------------------------ article parsing ------------------------------ */

function extractJsonLd(html) {
  const objs = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      const flat = Array.isArray(parsed) ? parsed : [parsed];
      for (const o of flat) {
        objs.push(o);
        if (o && Array.isArray(o['@graph'])) objs.push(...o['@graph']);
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  return objs;
}

function authorNames(html) {
  const names = [];
  for (const o of extractJsonLd(html)) {
    if (!o || !o.author) continue;
    const authors = Array.isArray(o.author) ? o.author : [o.author];
    for (const a of authors) {
      if (typeof a === 'string') names.push(a);
      else if (a && typeof a.name === 'string') names.push(a.name);
    }
  }
  return names.map((n) => n.trim()).filter(Boolean);
}

function articleTitle(html) {
  for (const o of extractJsonLd(html)) {
    if (o && typeof o.name === 'string' && (o['@type'] === 'NewsArticle' || o.headline)) {
      return o.name.trim();
    }
    if (o && typeof o.headline === 'string') return o.headline.trim();
  }
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].replace(/\s*\|\s*VOA.*$/i, '').trim() : '';
}

/** Extract the balanced <div> element containing `marker`. */
function extractDiv(html, marker) {
  const idx = html.indexOf(marker);
  if (idx < 0) return '';
  const start = html.lastIndexOf('<div', idx);
  if (start < 0) return '';
  const re = /<div\b|<\/div>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}

function articleText(html, title) {
  const frag = extractDiv(html, 'id="article-content"');
  if (!frag) return '';
  const paras = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(frag))) {
    const t = stripHtml(m[1]);
    if (!t) continue;
    if (/^no media source currently available/i.test(t)) continue;
    if (/^(share|see comments|follow us|print|embed)$/i.test(t)) continue; // UI chrome
    if (/^_{5,}$/.test(t)) continue; // separator rule
    if (t.length < 50 && /photo|getty|courtesy|image:|file:/i.test(t)) continue; // photo credits
    if (title && t === title) continue;
    paras.push(t);
  }
  return paras.join('\n\n');
}

/* ------------------------------ main ------------------------------ */

async function main() {
  ensureDirs();
  const outPath = join(OUT_DIR, 'readingPassages.jsonl');

  // 1. robots.txt first — log it and gate the whole source on it.
  let robotsText;
  try {
    robotsText = await fetchPage(`${BASE}/robots.txt`);
  } catch (err) {
    console.error(`BLOCKED: could not fetch robots.txt (${err.message}); refusing to crawl.`);
    writeJsonl(outPath, []);
    return;
  }
  console.log('=== robots.txt (learningenglish.voanews.com) ===');
  console.log(robotsText.trim());
  console.log('=== end robots.txt ===');

  const patterns = parseRobots(robotsText);
  console.log(`Disallow patterns for User-agent *: ${JSON.stringify(patterns)}`);
  const neededPaths = [...SECTIONS.map((s) => s.path), '/a/'];
  for (const p of neededPaths) {
    const ok = isAllowed(p, patterns);
    console.log(`robots check ${p}: ${ok ? 'ALLOWED' : 'DISALLOWED'}`);
    if (!ok) {
      console.error(`BLOCKED: robots.txt disallows ${p}; stopping VOA source.`);
      writeJsonl(outPath, []);
      return;
    }
  }

  // 2. Collect candidate article URLs from section pages.
  const candidates = []; // {url, section}
  for (const section of SECTIONS) {
    let html;
    try {
      html = await fetchPage(`${BASE}${section.path}`);
    } catch (err) {
      console.log(`section ${section.name} (${section.path}) fetch failed: ${err.message}`);
      continue;
    }
    const links = [...new Set(
      [...html.matchAll(/href="(\/a\/[^"?#]+\.html)"/g)].map((m) => m[1]),
    )].slice(0, MAX_PER_SECTION);
    console.log(`section ${section.name}: ${links.length} article links`);
    for (const link of links) candidates.push({ url: `${BASE}${link}`, section });
  }
  console.log(`total candidates: ${candidates.length}`);

  // 3. Fetch articles (1 req/s), filter, extract.
  const records = [];
  const skipped = { wire: 0, noByline: 0, short: 0, fetch: 0 };
  for (const { url, section } of candidates) {
    if (records.length >= TARGET_PASSAGES) break;
    let html;
    try {
      html = await fetchPage(url);
    } catch (err) {
      skipped.fetch++;
      console.log(`SKIP(fetch ${err.message}) ${url}`);
      continue;
    }
    const authors = authorNames(html);
    if (authors.length === 0) {
      skipped.noByline++;
      console.log(`SKIP(no byline) ${url}`);
      continue;
    }
    const title = articleTitle(html);
    const text = articleText(html, title);
    if (authors.some((a) => WIRE_RE.test(a)) || WIRE_RE.test(text)) {
      skipped.wire++;
      console.log(`SKIP(wire credit: ${authors.join(', ')}) ${url}`);
      continue;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    if (text.length < MIN_TEXT_CHARS || words < MIN_TEXT_WORDS) {
      skipped.short++;
      console.log(`SKIP(too short: ${words} words) ${url}`);
      continue;
    }
    records.push(makeRecord({
      blockType: 'readingPassage',
      level: section.level,
      skill: 'reading',
      topic: section.name,
      title: title || url.split('/').pop(),
      body: { text, questions: [] },
      provenance: `voa:${url}`,
      rightsStatus: 'public_domain',
      attribution: ATTRIBUTION,
    }));
    console.log(`OK [${section.level} ${section.name}] "${title}" (${words} words, by: ${authors.join(', ')})`);
  }

  writeJsonl(outPath, records);
  console.log(`wrote out/readingPassages.jsonl: ${records.length} readingPassage records`);
  console.log(`level distribution: ${formatDist(countBy(records, 'level'))}`);
  console.log(`skipped: wire=${skipped.wire} noByline=${skipped.noByline} tooShort=${skipped.short} fetchError=${skipped.fetch}`);
}

main().catch((err) => { console.error(`FAIL: ${err.message}`); process.exit(1); });
