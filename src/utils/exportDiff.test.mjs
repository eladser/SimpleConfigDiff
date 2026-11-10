// node --test src/utils/exportDiff.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let exportDiff, generateDiff, maskResult, MASK;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ exportDiff } = await server.ssrLoadModule('/src/utils/exportDiff.ts'));
  ({ generateDiff } = await server.ssrLoadModule('/src/utils/generateDiff.ts'));
  ({ maskResult, MASK } = await server.ssrLoadModule('/src/utils/maskSecrets.ts'));
});

after(() => server?.close());

const DEFAULTS = {
  ignoreKeys: [], caseSensitive: false, sortKeys: false, flattenKeys: false, semanticComparison: false,
  ignoreWhitespace: false, ignoreComments: false, pathRules: [], valueTransformations: [],
  diffMode: 'unified', showLineNumbers: true, contextLines: 3, minimalDiff: false,
};

const BAD = '<script>alert(1)</script><img src=x onerror=alert(2)>"';
const ESC = '&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt;&quot;';

function diff(lname, left, rname, right) {
  const file = (name, data) => ({ name, format: 'json', content: JSON.stringify(data, null, 2), parsedContent: data });
  return generateDiff(file(lname, left), file(rname, right), DEFAULTS);
}

function noRaw(out) {
  assert.ok(!out.includes('<script>alert'), out);
  assert.ok(!out.includes('<img src=x'), out);
}

test('html export escapes paths, values and file names', () => {
  const res = diff(
    `l${BAD}.json`, { [`k${BAD}`]: `old${BAD}`, password: 'S3CR3T' },
    `r${BAD}.json`, { [`k${BAD}`]: `new${BAD}`, password: 'S3CR3T-2', obj: { v: BAD } },
  );
  const out = exportDiff(maskResult(res), DEFAULTS, 'html');
  noRaw(out);
  assert.ok(out.includes(`<p>l${ESC}.json</p>`));
  assert.ok(out.includes(`<p>r${ESC}.json</p>`));
  assert.ok(out.includes(`<td><code>k${ESC}</code></td>`));
  assert.ok(out.includes(`<td><code>old${ESC}</code></td>`));
  assert.ok(out.includes(`<td><code>new${ESC}</code></td>`));
  // object values go through JSON.stringify, which adds its own backslash before the quote
  assert.ok(out.includes(`&quot;v&quot;: &quot;${ESC.replace('&quot;', '\\&quot;')}&quot;`));
  // masking still runs first
  assert.ok(out.includes(`<td><code>${MASK}</code></td>`));
  assert.ok(!out.includes('S3CR3T'));
});

test('html export escapes type, severity and category', () => {
  const res = diff('l.json', { a: 1 }, 'r.json', { a: 2 });
  const out = exportDiff({ ...res, changes: res.changes.map((c) => ({ ...c, type: BAD, severity: BAD, category: BAD })) }, DEFAULTS, 'html');
  noRaw(out);
  assert.ok(out.includes(`<tr class="${ESC}">`));
  assert.ok(out.includes(`<td>${ESC}</td><td><code>1</code></td><td><code>2</code></td><td class="${ESC}">${ESC}</td><td>${ESC}</td>`));
});
