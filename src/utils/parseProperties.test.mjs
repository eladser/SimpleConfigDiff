// node --test src/utils/parseProperties.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let parseProperties, generateDiff;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ parseProperties } = await server.ssrLoadModule('/src/utils/parseProperties.ts'));
  ({ generateDiff } = await server.ssrLoadModule('/src/utils/generateDiff.ts'));
});

after(() => server?.close());

// the options App.tsx starts with
const DEFAULTS = {
  ignoreKeys: [], caseSensitive: false, sortKeys: false, flattenKeys: false, semanticComparison: false,
  ignoreWhitespace: false, ignoreComments: false, pathRules: [], valueTransformations: [],
  diffMode: 'side-by-side', showLineNumbers: true, contextLines: 3, minimalDiff: false,
};

const evil = '__proto__.isAdmin=true\nconstructor.prototype.polluted=1\n';

test('__proto__ and constructor keys stay keys', () => {
  const { data, error } = parseProperties(evil);
  assert.equal(error, undefined);
  assert.equal(({}).isAdmin, undefined);
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.getPrototypeOf(data), Object.prototype);
  assert.deepEqual(Object.keys(data), ['__proto__', 'constructor']);
  assert.ok(Object.hasOwn(data, '__proto__'));
  assert.ok(Object.hasOwn(data.__proto__, 'isAdmin'));
  assert.equal(data.__proto__.isAdmin, true);
  assert.ok(Object.hasOwn(data.constructor, 'prototype'));
  assert.equal(data.constructor.prototype.polluted, 1);
});

test('the last segment is a key too', () => {
  const { data } = parseProperties('a.__proto__=x,y\n');
  assert.ok(Object.hasOwn(data.a, '__proto__'));
  assert.deepEqual(data.a.__proto__, ['x', 'y']);
  assert.equal(Object.getPrototypeOf(data.a), Object.prototype);
});

test('dotted keys parse as before', () => {
  assert.deepEqual(parseProperties('db.host=x\ndb.port=5432\n').data, { db: { host: 'x', port: 5432 } });
});

test('list.length still resizes a list', () => {
  const { data, error } = parseProperties('list=a,b\nlist.length=3\n');
  assert.equal(error, undefined);
  assert.equal(data.list.length, 3);
  assert.deepEqual(data.list.slice(0, 2), ['a', 'b']);
});

function diff(l, r) {
  const file = (name, content) => ({ name, format: 'properties', content, parsedContent: parseProperties(content).data });
  return generateDiff(file('l.properties', l), file('r.properties', r), DEFAULTS)
    .changes.map((c) => [c.path, c.type, c.oldValue, c.newValue]);
}

test('those keys show as rows with default options', () => {
  assert.deepEqual(diff(evil, 'db.host=x\n'), [
    ['__proto__', 'removed', { isAdmin: true }, undefined],
    ['constructor', 'removed', { prototype: { polluted: 1 } }, undefined],
    ['db', 'added', undefined, { host: 'x' }],
  ]);
  assert.deepEqual(diff(evil, '__proto__.isAdmin=false\nconstructor.prototype.polluted=2\n'), [
    ['__proto__.isAdmin', 'changed', true, false],
    ['constructor.prototype.polluted', 'changed', 1, 2],
  ]);
  assert.equal(({}).isAdmin, undefined);
  assert.equal(({}).polluted, undefined);
});
