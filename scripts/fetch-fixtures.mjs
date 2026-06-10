import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FIXTURES = [
  ['wikipedia-fr-lecture', 'https://fr.wikipedia.org/wiki/Lecture'],
  ['wikipedia-en-reading', 'https://en.wikipedia.org/wiki/Reading'],
  [
    'mdn-intersection-observer',
    'https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API',
  ],
  ['web-dev-cls', 'https://web.dev/articles/cls'],
  ['chrome-dev-mv3', 'https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3'],
  ['martinfowler-microservices', 'https://martinfowler.com/articles/microservices.html'],
  ['bbc-news', 'https://www.bbc.com/news/science-environment-56837908'],
  ['npr-text', 'https://text.npr.org/'],
  ['lemonde-pixels', 'https://www.lemonde.fr/pixels/'],
  ['francetvinfo', 'https://www.francetvinfo.fr/'],
  [
    'ars-technica',
    'https://arstechnica.com/gadgets/2024/01/what-i-learned-from-using-a-raspberry-pi-5-as-my-main-computer-for-two-weeks/',
  ],
  ['effective-go', 'https://go.dev/doc/effective_go'],
  ['python-tutorial', 'https://docs.python.org/3/tutorial/introduction.html'],
  ['daringfireball-markdown', 'https://daringfireball.net/projects/markdown/syntax'],
  ['paulgraham-essay', 'https://paulgraham.com/words.html'],
  ['overreacted', 'https://overreacted.io/the-two-reacts/'],
  [
    'joelonsoftware',
    'https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/',
  ],
  ['korben-blog', 'https://korben.info/'],
  ['react-dev-learn', 'https://react.dev/learn/thinking-in-react'],
  ['nodejs-blog', 'https://nodejs.org/en/blog/announcements/v22-release-announce'],
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const outDir = resolve(import.meta.dirname, '..', 'fixtures');
mkdirSync(outDir, { recursive: true });

const manifest = [];

for (const [slug, url] of FIXTURES) {
  process.stdout.write(`${slug} ... `);
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    writeFileSync(resolve(outDir, `${slug}.html`), html);
    manifest.push({ slug, url, fetchedAt: new Date().toISOString(), bytes: html.length });
    console.log(`ok (${Math.round(html.length / 1024)} KB)`);
  } catch (err) {
    manifest.push({ slug, url, error: String(err.message ?? err) });
    console.log(`FAILED: ${err.message ?? err}`);
  }
}

writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const failed = manifest.filter((m) => m.error).length;
console.log(`\n${manifest.length - failed}/${manifest.length} fixtures saved to fixtures/`);
process.exitCode = failed === manifest.length ? 1 : 0;
