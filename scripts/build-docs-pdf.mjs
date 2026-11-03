#!/usr/bin/env node
// Builds the shareable PDF from docs/PROJECT_DOCUMENTATION.md: npm run docs:pdf
// Uses the Chrome installed on this machine. Links to other docs point at GitHub, since those files don't travel with a PDF.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = path.join(ROOT, 'docs');
const SOURCE = path.join(DOCS, 'PROJECT_DOCUMENTATION.md');
const OUT = path.join(DOCS, 'The-Fluency-Talks-Project-Documentation.pdf');
const REPO = 'https://github.com/KIMGITO/FluencyTalks/blob/main';

const slug = (text) => text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

const marked = new Marked({
  renderer: {
    heading({ tokens, depth }) {
      const inner = this.parser.parseInline(tokens);
      return `<h${depth} id="${slug(inner)}">${inner}</h${depth}>\n`;
    },
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const to = href.startsWith('../') ? `${REPO}/${href.slice(3)}` : href.endsWith('.md') ? `${REPO}/docs/${href}` : href;
      return `<a href="${to}">${inner}</a>`;
    },
    image({ href, text }) {
      return `<img src="${pathToFileURL(path.join(DOCS, href)).href}" alt="${text}">`;
    },
  },
});

// The title and date move to the cover, so the body starts at the contents.
const source = fs.readFileSync(SOURCE, 'utf8');
const stamp = source.match(/\*\*Status as of:\*\* ([^\n]+)/)?.[1] ?? '';
const body = source.slice(source.indexOf('## Contents'));
const icon = fs.readFileSync(path.join(ROOT, 'public/icon-512.png')).toString('base64');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>The Fluency Talks: project documentation</title>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,500;1,6..72,500&family=Source+Sans+3:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  :root { --ink:#1f1e33; --deep:#1b1a55; --muted:#5a5870; --line:#ded6c7; --paper:#faf6ee; --coral:#ff6a4d; }
  * { box-sizing:border-box; }
  body { margin:0; color:var(--ink); font:10.5pt/1.55 'Source Sans 3','Segoe UI',Arial,sans-serif; }
  .cover { height:247mm; display:flex; flex-direction:column; justify-content:center; break-after:page; }
  .cover img { width:26mm; height:26mm; margin-bottom:12mm; }
  .cover h1 { font:500 36pt/1.1 'Newsreader',Georgia,serif; color:var(--deep); margin:0; border:0; }
  .cover .sub { font:500 19pt/1.3 'Newsreader',Georgia,serif; color:var(--muted); margin:3mm 0 10mm; }
  .cover .rule { width:24mm; height:1.2mm; background:var(--coral); margin-bottom:8mm; }
  .cover p { margin:0 0 1.5mm; font-size:11.5pt; }
  h2,h3 { font-family:'Newsreader',Georgia,serif; font-weight:500; color:var(--deep); break-after:avoid; }
  h2 { font-size:19pt; line-height:1.2; margin:9mm 0 3mm; padding-top:2mm; border-top:0.6mm solid var(--deep); }
  h2#contents { margin-top:0; border:0; }
  #contents + ol { columns:2; column-gap:8mm; }
  h3 { font-size:13.5pt; margin:5mm 0 1.5mm; }
  p { margin:0 0 2.6mm; } ul,ol { margin:0 0 3mm; padding-left:5.5mm; } li { margin-bottom:1mm; }
  a { color:var(--deep); text-decoration-color:var(--coral); text-underline-offset:0.5mm; }
  code { font-family:'DejaVu Sans Mono',Menlo,Consolas,monospace; font-size:8.6pt; background:var(--paper); padding:0 0.8mm; border-radius:0.5mm; }
  table { width:100%; border-collapse:collapse; margin:2mm 0 4mm; font-size:9.6pt; line-height:1.4; }
  th { text-align:left; color:var(--deep); font-weight:700; border-bottom:0.4mm solid var(--deep); padding:1.2mm 2mm 1.2mm 0; }
  td { border-bottom:0.2mm solid var(--line); padding:1.2mm 2mm 1.2mm 0; vertical-align:top; }
  tr { break-inside:avoid; } thead { display:table-header-group; }
  thead th:empty { display:none; }
  img { display:block; max-width:100%; margin:2mm 0 4mm; }
  p > em:only-child { color:var(--muted); font-size:9.5pt; }
</style></head><body>
<section class="cover">
  <img src="data:image/png;base64,${icon}" alt="">
  <h1>The Fluency Talks</h1>
  <div class="sub">Project documentation</div>
  <div class="rule"></div>
  <p><a href="https://thefluencytalks.com">thefluencytalks.com</a></p>
  <p>Status as of ${stamp}</p>
</section>
${marked.parse(body)}
</body></html>`;

const tmp = path.join(DOCS, '.project-documentation.tmp.html');
fs.writeFileSync(tmp, html);
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const small = 'font-size:8px;width:100%;padding:0 18mm;color:#5a5870;font-family:Arial,sans-serif;display:flex;justify-content:space-between';
  await page.pdf({
    path: OUT,
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    printBackground: true,
    outline: true,
    tagged: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="${small}"><span>The Fluency Talks: project documentation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  });
} finally {
  await browser.close();
  fs.rmSync(tmp, { force: true });
}
console.log(`Wrote ${path.relative(ROOT, OUT)} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
