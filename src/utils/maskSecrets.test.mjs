// node --test src/utils/maskSecrets.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let isSecretKey, maskResult, MASK, generateDiff, exportDiff, exportExcel;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ isSecretKey, maskResult, MASK } = await server.ssrLoadModule('/src/utils/maskSecrets.ts'));
  ({ generateDiff } = await server.ssrLoadModule('/src/utils/generateDiff.ts'));
  ({ exportDiff } = await server.ssrLoadModule('/src/utils/exportDiff.ts'));
  ({ exportExcel } = await server.ssrLoadModule('/src/utils/exportExcel.ts'));
});

after(() => server?.close());

test('secret keys by word part', () => {
  const yes = [
    'password', 'db.password', 'DB_PASSWORD', 'passwd', 'pwd', 'secret', 'clientSecret', 'client-secret',
    'token', 'AUTH_TOKEN', 'authToken', 'accessToken', 'auth', 'basicAuth', 'apiKey', 'api_key', 'api-key',
    'APIKey', 'apikey', 'x-api-key', 'privateKey', 'private_key', 'PRIVATE-KEY', 'credential', 'credentials',
    'tokens', 'tokens.0', 'tokens[0]', 'secrets.db', 'auth.user', 'dbpassword', 'clientsecret', 'password2',
    'secretKey', 'passwordHash', '@_password',
  ];
  for (const k of yes) assert.equal(isSecretKey(k), true, k);
});

test('author, authority and other near misses are not secret', () => {
  const no = [
    'author', 'authority', 'Author', 'AUTHORITY', 'authorName', 'author.name', 'authority_url',
    'secretary', 'tokenizer', 'passwordless', 'key', 'monkey', 'host', 'db.host', 'tags.0', '',
  ];
  for (const k of no) assert.equal(isSecretKey(k), false, k);
});

const DEFAULTS = {
  ignoreKeys: [], caseSensitive: false, sortKeys: false, flattenKeys: false, semanticComparison: false,
  ignoreWhitespace: false, ignoreComments: false, pathRules: [], valueTransformations: [],
  diffMode: 'unified', showLineNumbers: true, contextLines: 3, minimalDiff: false,
};

function diff(left, right, opts = {}) {
  const file = (name, data) => ({ name, format: 'json', content: JSON.stringify(data, null, 2), parsedContent: data });
  return generateDiff(file('l.json', left), file('r.json', right), { ...DEFAULTS, ...opts });
}

// every secret value carries the marker, so one includes() check covers a whole export
const left = {
  db: { host: 'a', password: 'S3CR3T-1' }, author: 'alice', clientSecret: 'S3CR3T-2', secretKey: 'S3CR3T-3',
  auth: { user: 'u', pass: 'S3CR3T-4' }, tokens: ['S3CR3T-5', 'S3CR3T-6'], pin: null,
};
const right = {
  db: { host: 'b', password: 'S3CR3T-7' }, author: 'bob', clientSecret: 'S3CR3T-8', secretKey: 'S3CR3T-9',
  auth: { user: 'u', pass: 'S3CR3T-10' }, tokens: ['S3CR3T-5', 'S3CR3T-11'], pin: null,
  extra: { password: 'S3CR3T-12', port: 1 },
};

test('masked result keeps change types and counts, hides every secret value', () => {
  const res = diff(left, right);
  const m = maskResult(res);
  const byPath = Object.fromEntries(m.changes.map((c) => [c.path, c]));

  assert.deepEqual(m.summary, res.summary);
  assert.deepEqual(m.changes.map((c) => [c.path, c.type]), res.changes.map((c) => [c.path, c.type]));

  for (const p of ['db.password', 'clientsecret', 'secretkey', 'auth.pass', 'tokens[1]']) {
    assert.equal(byPath[p].type, 'changed', p);
    assert.equal(byPath[p].oldValue, MASK, p);
    assert.equal(byPath[p].newValue, MASK, p);
  }
  assert.equal(byPath.author.oldValue, 'alice');
  assert.equal(byPath.author.newValue, 'bob');
  assert.equal(byPath['db.host'].newValue, 'b');
  assert.deepEqual(byPath.extra.newValue, { password: MASK, port: 1 });
  assert.equal(byPath.extra.oldValue, undefined);

  assert.ok(!JSON.stringify(m).includes('S3CR3T'));
  assert.equal(m.leftFile.content, '');
  assert.equal(m.unifiedDiff, undefined);
  // the real result is left alone for Show secrets
  assert.ok(JSON.stringify(res).includes('S3CR3T'));
});

test('case-sensitive mode keeps camelCase paths and masks them the same', () => {
  const m = maskResult(diff(left, right, { caseSensitive: true }));
  const byPath = Object.fromEntries(m.changes.map((c) => [c.path, c]));
  assert.equal(byPath.clientSecret.newValue, MASK);
  assert.equal(byPath.secretKey.newValue, MASK);
  assert.ok(!JSON.stringify(m).includes('S3CR3T'));
});

test('every export of a masked result is masked', () => {
  const m = maskResult(diff(left, right));
  for (const fmt of ['json', 'csv', 'html', 'patch']) {
    const out = exportDiff(m, DEFAULTS, fmt);
    assert.ok(!out.includes('S3CR3T'), fmt);
    assert.ok(out.includes(MASK), fmt);
    assert.ok(out.includes('alice'), fmt);
  }
  assert.ok(!exportExcel(m, DEFAULTS).includes('S3CR3T'));
});

test('a result without secret keys comes back as is', () => {
  const res = diff({ host: 'a', author: 'alice' }, { host: 'b', author: 'bob' });
  assert.equal(maskResult(res), res);
});
