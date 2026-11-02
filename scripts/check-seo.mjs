#!/usr/bin/env node
// SEO check over the BUILT site (run after `npm run build`): node scripts/check-seo.mjs
// Reads dist/sitemap.xml and every page it lists, and checks what a crawler that does not run JavaScript sees.
// Exits non-zero on any failure, so it can run in CI. Rules come from docs/SEO.md.
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const SITE = 'https://thefluencytalks.com';
const read = (p) => fs.readFileSync(path.join(DIST, p), 'utf8');
const fail = []; const warn = [];
const bad = (url, msg) => fail.push(`${url}  ${msg}`);
const soft = (url, msg) => warn.push(`${url}  ${msg}`);

const sitemap = read('sitemap.xml');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) { console.error('sitemap.xml lists no URLs'); process.exit(1); }

const fileFor = (u) => { const p = new URL(u).pathname.replace(/\/$/, ''); return p === '' ? 'index.html' : `${p.slice(1)}.html`; };
const strip = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const meta = (html, attr, name) => (html.match(new RegExp(`<meta[^>]*${attr}="${name}"[^>]*content="([^"]*)"`, 'i')) || html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${name}"`, 'i')) || [])[1];

const titles = new Map(); const descriptions = new Map(); const known = new Set(urls.map((u) => new URL(u).pathname.replace(/\/$/, '') || '/'));
const linked = new Map();

for (const url of urls) {
  const f = fileFor(url);
  if (!fs.existsSync(path.join(DIST, f))) { bad(url, `no built file ${f}`); continue; }
  const html = read(f);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1]?.trim();
  const desc = meta(html, 'name', 'description');
  const canonical = (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/) || [])[1];
  const h1s = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/g)];
  const robots = meta(html, 'name', 'robots') || '';

  if (!title) bad(url, 'missing <title>'); else {
    if (title.length > 65) soft(url, `title is ${title.length} chars (aim for 60 or fewer): ${title}`);
    if (title.length < 15) bad(url, `title too short: ${title}`);
    if (titles.has(title)) bad(url, `duplicate title also on ${titles.get(title)}`); titles.set(title, url);
  }
  if (!desc) bad(url, 'missing meta description'); else {
    if (desc.length < 70 || desc.length > 170) soft(url, `description is ${desc.length} chars (aim for 120 to 160)`);
    if (descriptions.has(desc)) bad(url, `duplicate description also on ${descriptions.get(desc)}`); descriptions.set(desc, url);
  }
  if (canonical !== url) bad(url, `canonical is ${canonical}, expected ${url}`);
  if (h1s.length !== 1) bad(url, `${h1s.length} <h1> elements (need exactly 1)`);
  if (/noindex/i.test(robots)) bad(url, 'is in the sitemap but has noindex');
  for (const [attr, name] of [['property', 'og:title'], ['property', 'og:description'], ['property', 'og:image'], ['property', 'og:url'], ['name', 'twitter:card']]) if (!meta(html, attr, name)) bad(url, `missing ${name}`);
  if (!/<html[^>]*lang="/.test(html)) bad(url, 'missing <html lang>');
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { JSON.parse(m[1]); } catch { bad(url, 'invalid JSON-LD'); } }
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt=/.test(m[0])) bad(url, `<img> without alt: ${m[0].slice(0, 80)}`);
  const words = strip(html.slice(html.indexOf('<body'))).split(' ').length;
  if (words < 120 && !['/privacy', '/terms'].includes(new URL(url).pathname)) soft(url, `only ${words} words of text without JavaScript`);
  for (const m of html.matchAll(/<a\b[^>]*\bhref="(\/[^"#?]*)/g)) { const p = m[1].replace(/\/$/, '') || '/'; if (!linked.has(p)) linked.set(p, url); }
}

// Links on public pages must lead somewhere real: a public page, an auth page, or a known app route.
const allowed = new Set([...known, '/login', '/signup', '/forgot-password', '/home', '/search', '/messages', '/profile', '/learning', '/library']);
for (const [p, from] of linked) {
  if (/^\/(assets|favicon|logo|og-image|manifest|robots|sitemap|llms)/.test(p) || /\.[a-z0-9]{2,4}$/.test(p)) continue;
  if (!allowed.has(p)) bad(from, `links to ${p}, which is not a public page or a known route`);
}
// Pages that exist but are missing from the sitemap
for (const f of fs.readdirSync(DIST, { recursive: true })) {
  if (!String(f).endsWith('.html') || f === 'index.html') continue;
  const p = '/' + String(f).replace(/\.html$/, '');
  if (!known.has(p)) soft('(build)', `${f} is built but not in the sitemap`);
}
// robots.txt: the sitemap is declared, and auth pages are NOT blocked (they carry noindex, which Google can only read if it may crawl them)
const robots = read('robots.txt');
if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) bad('robots.txt', 'does not declare the sitemap');
for (const p of ['/login', '/signup', '/forgot-password', '/reset-password']) if (new RegExp(`^Disallow:\\s*${p}\\s*$`, 'm').test(robots)) bad('robots.txt', `blocks ${p}; it must stay crawlable so Google can read its noindex`);
for (const p of ['/home', '/messages', '/settings', '/admin']) if (!new RegExp(`^Disallow:\\s*${p}\\s*$`, 'm').test(robots)) bad('robots.txt', `does not block ${p}`);
if (!fs.existsSync(path.join(DIST, 'llms.txt'))) bad('llms.txt', 'missing');

console.log(`checked ${urls.length} pages from sitemap.xml`);
if (warn.length) { console.log(`\n${warn.length} warning(s):`); warn.forEach((w) => console.log('  - ' + w)); }
if (fail.length) { console.log(`\n${fail.length} FAILURE(S):`); fail.forEach((f) => console.log('  x ' + f)); process.exit(1); }
console.log('\nSEO check passed');
