// node --test src/utils/shareLink.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let encodeShare, decodeShare, generateDiff, parseConfig;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ encodeShare, decodeShare } = await server.ssrLoadModule('/src/utils/shareLink.ts'));
  ({ generateDiff } = await server.ssrLoadModule('/src/utils/generateDiff.ts'));
  ({ parseConfig } = await server.ssrLoadModule('/src/utils/parsers.ts'));
});

after(() => server?.close());

const DEFAULTS = {
  ignoreKeys: [], caseSensitive: false, sortKeys: false, flattenKeys: false, semanticComparison: false,
  ignoreWhitespace: false, ignoreComments: false, pathRules: [], valueTransformations: [],
  diffMode: 'side-by-side', showLineNumbers: true, contextLines: 3, minimalDiff: false,
};

const OPTS = {
  ...DEFAULTS,
  caseSensitive: true,
  semanticComparison: true,
  ignoreKeys: ['build_id'],
  pathRules: [{ pattern: '*.timestamp', type: 'glob', action: 'ignore', description: 'Ignore timestamp fields' }],
  valueTransformations: [{ name: 'Normalize URLs', pattern: 'https?://', replacement: 'http://', enabled: true, description: '' }],
};

const shared = (left, right, leftFormat, rightFormat, options = OPTS) => ({ left, right, leftFormat, rightFormat, options });

const sharedOptions = (o) => {
  const { diffMode: _d, showLineNumbers: _s, contextLines: _c, minimalDiff: _m, ...rest } = o;
  return rest;
};

test('round trip keeps both configs, formats and the comparison options', async () => {
  const s = shared('{"name": "a", "port": 80}', 'name: b\nport: 81\n', 'json', 'yaml');
  const d = await encodeShare(s);
  assert.match(d, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeShare(d), { ...s, options: sharedOptions(OPTS) });
});

test('unicode survives', async () => {
  const left = 'title: שלום עולם\nemoji: "🔑🚀 👩🏽‍💻"\ncjk: 設定ファイル\naccent: "é"\nnul: "a\u0000b"\n';
  const right = '{"title": "مرحبا", "astral": "𝄞𐍈", "bom": "﻿x", "rtl": "‮abc"}';
  const s = shared(left, right, 'yaml', 'json');
  const out = await decodeShare(await encodeShare(s));
  assert.equal(out.left, left);
  assert.equal(out.right, right);
});

test('empty sides round trip', async () => {
  for (const [l, r, lf, rf] of [['', '', null, null], ['', 'a: 1\n', null, 'yaml'], ['a=1\n', '', 'ini', null], ['  \n', '', null, null]]) {
    const s = shared(l, r, lf, rf, DEFAULTS);
    assert.deepEqual(await decodeShare(await encodeShare(s)), { ...s, options: sharedOptions(DEFAULTS) }, JSON.stringify([l, r]));
  }
});

test('view-only options stay out of the link', async () => {
  const d = await encodeShare(shared('a: 1\n', 'a: 2\n', 'yaml', 'yaml', { ...OPTS, diffMode: 'tree', showSecrets: true }));
  const out = await decodeShare(d);
  for (const k of ['diffMode', 'showLineNumbers', 'contextLines', 'minimalDiff', 'showSecrets']) {
    assert.equal(k in out.options, false, k);
  }
});

test('a big config round trips and the decoded side gives the same diff', async () => {
  // pseudo-random values so it doesn't compress down to nothing
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31).toString(36).slice(2, 10);
  const obj = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`key_${i}`, { value: rnd(), url: `https://${rnd()}.example.com` }]));
  const left = JSON.stringify(obj(4000), null, 2);
  const right = JSON.stringify({ ...obj(4000), build_id: 1 }, null, 2);
  const s = shared(left, right, 'json', 'json');
  const d = await encodeShare(s);
  assert.ok(d.length > 0x8000 * 2, `encoded ${d.length}`);

  const out = await decodeShare(d);
  assert.equal(out.left, left);
  assert.equal(out.right, right);

  const run = (x, opts) => {
    const file = (name, content, format) => ({ name, content, format, parsedContent: parseConfig(content, format).data });
    return generateDiff(file('left', x.left, x.leftFormat), file('right', x.right, x.rightFormat), opts).changes;
  };
  assert.deepEqual(run(out, { ...DEFAULTS, ...out.options }), run(s, OPTS));
});

async function deflate(text) {
  const st = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return Buffer.from(await new Response(st).arrayBuffer()).toString('base64url');
}

test('bad, truncated or tampered payloads throw', async () => {
  const good = await encodeShare(shared('a: 1\n', 'a: 2\n', 'yaml', 'yaml'));
  const okJson = JSON.stringify({ ...shared('a', 'b', 'yaml', 'yaml'), options: sharedOptions(OPTS) });
  const tweak = (fn) => { const p = JSON.parse(okJson); fn(p); return JSON.stringify(p); };

  // the untouched base works, so the cases below fail for the reason they say
  assert.equal((await decodeShare(await deflate(okJson))).right, 'b');

  const bad = {
    'empty': '',
    'not base64': '!!!not*base64!!!',
    'half of it': good.slice(0, Math.floor(good.length / 2)),
    'last bytes cut': good.slice(0, -8),
    'not deflate': Buffer.from('hello world, plain text').toString('base64url'),
    'not json': await deflate('left: a, right: b'),
    'json array': await deflate('[1, 2]'),
    'left is a number': await deflate(tweak((p) => { p.left = 1; })),
    'right missing': await deflate(tweak((p) => { delete p.right; })),
    'unknown format': await deflate(tweak((p) => { p.leftFormat = 'exe'; })),
    'prototype key as format': await deflate(tweak((p) => { p.rightFormat = 'toString'; })),
    'options missing': await deflate(tweak((p) => { delete p.options; })),
    'flag not a boolean': await deflate(tweak((p) => { p.options.sortKeys = 'yes'; })),
    'ignore key not a string': await deflate(tweak((p) => { p.options.ignoreKeys = [{}]; })),
    'bad rule type': await deflate(tweak((p) => { p.options.pathRules[0].type = 'eval'; })),
    'rule pattern an object': await deflate(tweak((p) => { p.options.pathRules[0].pattern = { a: 1 }; })),
    'transform not enabled flag': await deflate(tweak((p) => { delete p.options.valueTransformations[0].enabled; })),
  };
  for (const [label, d] of Object.entries(bad)) {
    await assert.rejects(decodeShare(d), Error, label);
  }
});

test('a link that inflates past the cap is refused', async () => {
  const bomb = await deflate(JSON.stringify({ ...shared('0'.repeat(60_000_000), '', 'yaml', null), options: sharedOptions(OPTS) }));
  assert.ok(bomb.length < 200_000, `bomb is ${bomb.length} chars`);
  await assert.rejects(decodeShare(bomb), /too large/);
});
