#!/usr/bin/env node
// Tells IndexNow search engines (Bing, Yandex and others) about our pages, so they recrawl soon instead of eventually.
// Bing's index feeds Copilot and ChatGPT search. Google does not use IndexNow: use Search Console for it.
// Run AFTER deploying, since the engines fetch the key file from the live site: npm run indexnow
// With no arguments it submits every URL in the live sitemap, posts included; or name paths: npm run indexnow -- /faq /blog/my-article
const HOST = 'thefluencytalks.com';
const KEY = '1e0f0f5e1000373aba1474d71cde01c4';   // Public by design. The matching file is public/<key>.txt.

const paths = process.argv.slice(2);
const urlList = paths.length
  ? paths.map((p) => `https://${HOST}${p}`)
  : [...(await (await fetch(`https://${HOST}/sitemap.xml`)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} URLs, HTTP ${res.status}`);
if (!res.ok) { console.error(await res.text()); process.exit(1); }
