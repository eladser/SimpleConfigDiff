// node --test src/utils/generateDiff.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let generateDiff, formatValue, exportDiff, exportExcel, parseConfig;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ generateDiff, formatValue } = await server.ssrLoadModule('/src/utils/generateDiff.ts'));
  ({ exportDiff } = await server.ssrLoadModule('/src/utils/exportDiff.ts'));
  ({ exportExcel } = await server.ssrLoadModule('/src/utils/exportExcel.ts'));
  ({ parseConfig } = await server.ssrLoadModule('/src/utils/parsers.ts'));
});

after(() => server?.close());

const DEFAULTS = {
  ignoreKeys: [], caseSensitive: false, sortKeys: false, flattenKeys: false, semanticComparison: false,
  ignoreWhitespace: false, ignoreComments: false, pathRules: [], valueTransformations: [],
  diffMode: 'unified', showLineNumbers: true, contextLines: 3, minimalDiff: false,
};

function diff(format, l, r, opts = {}) {
  const file = (name, content) => ({ name, format, content, parsedContent: parseConfig(content, format).data });
  return generateDiff(file(`l.${format}`, l), file(`r.${format}`, r), { ...DEFAULTS, ...opts });
}

const modes = [{}, { semanticComparison: true }];

// js-yaml and smol-toml both parse these to Date objects
const changed = {
  'yaml date': ['yaml', 'released: 2024-01-01\n', 'released: 2025-06-01\n'],
  'yaml datetime': ['yaml', 'deployed: 2024-01-01T10:00:00Z\n', 'deployed: 2024-01-01T10:30:00Z\n'],
  'toml date': ['toml', 'released = 2024-01-01\n', 'released = 2025-06-01\n'],
  'toml datetime': ['toml', 'deployed = 2024-01-01T10:00:00Z\n', 'deployed = 2024-01-01T10:30:00Z\n'],
  'toml local datetime': ['toml', 'at = 2024-01-01T10:00:00\n', 'at = 2024-01-01T10:30:00\n'],
  'toml local time': ['toml', 't = 07:32:00\n', 't = 07:33:00\n'],
};

test('a changed date is one changed row, semantic mode or not', () => {
  for (const [name, [fmt, l, r]] of Object.entries(changed)) {
    for (const opts of modes) {
      const label = `${name} ${JSON.stringify(opts)}`;
      const res = diff(fmt, l, r, opts);
      assert.deepEqual(res.summary, { added: 0, removed: 0, changed: 1, total: 1 }, label);
      assert.ok(res.changes[0].oldValue instanceof Date, label);
      assert.ok(res.changes[0].newValue instanceof Date, label);
    }
  }
});

test('equal dates give nothing, also written another way', () => {
  const pairs = [
    ...Object.values(changed).map(([fmt, l]) => [fmt, l, l]),
    ['yaml', 'deployed: 2024-01-01 12:00:00 +02:00\n', 'deployed: 2024-01-01T10:00:00Z\n'],
  ];
  for (const [fmt, l, r] of pairs) {
    for (const opts of modes) {
      assert.equal(diff(fmt, l, r, opts).summary.total, 0, `${l} ${JSON.stringify(opts)}`);
    }
  }
});

test('a date against a string, a number or an object stays one changed row', () => {
  for (const other of ["'2024-01-01'", '1704067200000', '{}', '{ day: 1 }']) {
    for (const opts of modes) {
      const res = diff('yaml', `released: ${other}\n`, 'released: 2024-01-01\n', opts);
      assert.deepEqual(res.changes.map((c) => [c.path, c.type]), [['released', 'changed']], `${other} ${JSON.stringify(opts)}`);
      assert.ok(res.changes[0].newValue instanceof Date);
    }
  }
});

test('dates in tables and arrays, and with flattened keys', () => {
  const l = '[build]\nat = 2024-01-01T10:00:00Z\ndays = [2024-01-01, 2024-01-02]\n';
  const r = '[build]\nat = 2024-01-01T11:00:00Z\ndays = [2024-01-01, 2024-01-03]\n';
  assert.deepEqual(diff('toml', l, r).changes.map((c) => [c.path, c.type]), [['build.at', 'changed'], ['build.days[1]', 'changed']]);
  assert.deepEqual(diff('toml', l, r, { flattenKeys: true }).changes.map((c) => [c.path, c.type]),
    [['build.at', 'changed'], ['build.days[1]', 'changed']]);
  assert.equal(diff('toml', l, l, { flattenKeys: true }).summary.total, 0);
});

test('views and exports show a date as its ISO string', () => {
  const cases = [
    [diff('yaml', 'released: 2024-01-01\n', 'released: 2025-06-01\n'), '2024-01-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z'],
    // smol-toml keeps a local date as written
    [diff('toml', 'released = 2024-01-01\n', 'released = 2025-06-01\n'), '2024-01-01', '2025-06-01'],
  ];
  for (const [res, a, b] of cases) {
    const { oldValue, newValue } = res.changes[0];
    // the tree view's formatter
    assert.equal(formatValue(oldValue), `"${a}"`);
    assert.equal(formatValue(newValue), `"${b}"`);
    assert.ok(res.unifiedDiff.includes(`-released: "${a}"`) && res.unifiedDiff.includes(`+released: "${b}"`));
    const outs = [...['json', 'csv', 'html', 'patch'].map((f) => [f, exportDiff(res, DEFAULTS, f)]), ['xlsx', exportExcel(res, DEFAULTS)]];
    for (const [f, out] of outs) {
      assert.ok(out.includes(a) && out.includes(b), f);
      assert.ok(!out.includes('GMT'), f);
    }
    assert.match(exportDiff(res, DEFAULTS, 'csv'), new RegExp(`^"released","changed","""${a}""","""${b}"""`, 'm'));
  }
});
