// The exact text of a legal page, as a reader sees it. Consent has to be provable down to what was agreed to
// (Decree 356/2025 Art. 6), so each version is kept in supabase/legal/ and stored in consent_documents.
//   node scripts/legal-text.mjs write    after `npm run build`: writes the current text as the version in legalVersions.ts
//   node scripts/legal-text.mjs check    fails if a page changed and its version didn't (npm run check:legal)
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr', 'entry-server.js')).href);
const versions = fs.readFileSync(path.join(root, 'src/lib/legalVersions.ts'), 'utf8');
const versionOf = (kind) => versions.match(new RegExp(`${kind}: '([^']+)'`))?.[1];
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'", '&nbsp;': ' ' };

export function pageText(html) {
  const start = html.indexOf('<div class="lp-doc">');
  if (start < 0) throw new Error('no legal document in this page');
  const body = html.slice(start).replace(/<nav class="lp-toc"[^]*?<\/nav>/, '').replace(/<footer[^]*$/, '');
  const meta = html.match(/Last updated [^<]*(?:<!-- -->)?[^<]*/)?.[0].replace(/<!-- -->/g, '') ?? '';
  const text = body.replace(/<\/(p|li|h\d|tr|div|section)>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&[#\w]+;/g, (e) => ENTITIES[e] ?? e);
  return [meta, ...text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)].join('\n') + '\n';
}

const mode = process.argv[2];
let bad = 0;
for (const kind of ['privacy', 'terms']) {
  const { html } = render(`/${kind}`);
  const text = pageText(html);
  const file = path.join(root, 'supabase/legal', `${kind}-v${versionOf(kind)}.txt`);
  if (mode === 'write') { fs.writeFileSync(file, text); console.log(`wrote ${path.relative(root, file)}`); continue; }
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) {
    console.log(`${kind}: the page differs from ${path.relative(root, file)}. A changed policy needs a new version in src/lib/legalVersions.ts, a new file here, and a consent_documents row.`);
    bad += 1;
  }
}
if (mode !== 'write' && !bad) console.log('legal pages match their recorded versions');
// The Supabase client in the SSR bundle can keep timers alive.
process.exit(bad ? 1 : 0);
