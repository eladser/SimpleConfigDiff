// node --test src/utils/maskSecrets.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let isSecretKey, maskResult, MASK, generateDiff, exportDiff, exportExcel, parseConfig;

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
  ({ parseConfig } = await server.ssrLoadModule('/src/utils/parsers.ts'));
});

after(() => server?.close());

test('the mask is six U+2022 bullets', () => {
  assert.equal(MASK, '\u2022'.repeat(6));
});

test('secret keys by word part', () => {
  const yes = [
    'password', 'db.password', 'DB_PASSWORD', 'passwd', 'secret', 'clientSecret', 'client-secret',
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

const oddCase = ['PassWord', 'PassWd', 'DbPassWord', 'SecretKey', 'PrivateKEY', 'PassWordHash'];
const counts = ['max_tokens', 'maxTokens', 'max_output_tokens', 'tokens_per_minute', 'token_count', 'num_tokens', 'tokenLimit'];
const tokens = ['token', 'tokens', 'authToken', 'NPM_TOKEN', 'access_token', 'api_tokens', 'refreshTokens'];
const pwds = ['DB_PWD', 'db_pwd', 'pwdHash'];
// the count and PWD exceptions only lift those terms, the others still hit
const stillSecret = ['max_password_length', 'auth_token_count', 'auth.max_tokens', 'secrets.PWD', 'tokenLimit.password'];

test('a term split by camelCase still matches', () => {
  for (const k of oddCase) assert.equal(isSecretKey(k), true, k);
});

test('token counts and a bare PWD are not secret, other tokens and pwds are', () => {
  for (const k of [...counts, 'PWD', 'pwd', 'env.PWD']) assert.equal(isSecretKey(k), false, k);
  for (const k of [...tokens, ...pwds, ...stillSecret]) assert.equal(isSecretKey(k), true, k);
  // the count word has to sit in the same key as the token
  for (const k of ['rate_limit.token', 'max.tokens']) assert.equal(isSecretKey(k), true, k);
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

test('dotted top-level secret keys mask, lowercased by generateDiff or not', () => {
  for (const opts of [{}, { flattenKeys: true }, { caseSensitive: true }]) {
    const label = JSON.stringify(opts);
    const m = maskResult(diff(
      { 'aws.secretKey': 'S3CR3T-1', 'jwt.passwordHash': 'S3CR3T-2', passwordHistory: ['S3CR3T-3'], host: 'a' },
      { 'aws.secretKey': 'S3CR3T-4', 'jwt.passwordHash': 'S3CR3T-5', passwordHistory: ['S3CR3T-6'], host: 'b' },
      opts));
    const byPath = Object.fromEntries(m.changes.map((c) => [c.path, c]));
    for (const k of ['aws.secretKey', 'jwt.passwordHash', 'passwordHistory[0]']) {
      const p = opts.caseSensitive ? k : k.toLowerCase();
      assert.equal(byPath[p].oldValue, MASK, `${p} ${label}`);
      assert.equal(byPath[p].newValue, MASK, `${p} ${label}`);
    }
    assert.equal(byPath.host.newValue, 'b');
    for (const fmt of ['json', 'csv', 'html', 'patch']) {
      assert.ok(!exportDiff(m, DEFAULTS, fmt).includes('S3CR3T'), `${fmt} ${label}`);
    }
    assert.ok(!exportExcel(m, DEFAULTS).includes('S3CR3T'), label);
  }
});

test('a secret that only sits nested still masks', () => {
  const m = maskResult(diff({ db: { host: 'a', password: 'S3CR3T-1' } }, { db: { host: 'b', password: 'S3CR3T-2' } }));
  const pw = m.changes.find((c) => c.path === 'db.password');
  assert.equal(pw.oldValue, MASK);
  assert.equal(pw.newValue, MASK);
  assert.ok(!JSON.stringify(m).includes('S3CR3T'));
});

test('secret keys in an array of objects mask in place', () => {
  const m = maskResult(diff({ app: 'x' }, { app: 'x', extra: { replicas: [{ host: 'h', password: 'S3CR3T-1' }] } }));
  assert.deepEqual(m.changes.find((c) => c.path === 'extra').newValue, { replicas: [{ host: 'h', password: MASK }] });
});

function diffText(format, l, r) {
  const file = (name, content) => ({ name, format, content, parsedContent: parseConfig(content, format).data });
  return generateDiff(file(`l.${format}`, l), file(`r.${format}`, r), DEFAULTS);
}

test('dates beside a password come through masking untouched', () => {
  const pairs = {
    yaml: ['db:\n  password: S3CR3T-1\n  released: 2024-01-01\n',
      'db:\n  password: S3CR3T-2\n  released: 2024-01-01\nextra:\n  password: S3CR3T-3\n  at: 2024-02-02\n'],
    toml: ['[db]\npassword = "S3CR3T-1"\nreleased = 2024-01-01\n',
      '[db]\npassword = "S3CR3T-2"\nreleased = 2024-01-01\n[extra]\npassword = "S3CR3T-3"\nat = 2024-02-02\n'],
  };
  for (const [fmt, [l, r]] of Object.entries(pairs)) {
    const res = diffText(fmt, l, r);
    const m = maskResult(res);
    const date = res.leftFile.parsedContent.db.released;
    assert.ok(date instanceof Date, fmt);
    assert.equal(m.leftFile.parsedContent.db.released, date, fmt);
    assert.equal(m.changes.find((c) => c.path === 'db.password').newValue, MASK, fmt);

    const extra = m.changes.find((c) => c.path === 'extra').newValue;
    assert.equal(extra.password, MASK, fmt);
    assert.equal(extra.at, res.changes.find((c) => c.path === 'extra').newValue.at, fmt);
    assert.ok(exportDiff(m, DEFAULTS, 'json').includes('2024-02-02'), fmt);
  }
});

test('masking goes by the key as written, also after generateDiff lowercases it', () => {
  const shown = [...counts, 'PWD'];
  const hidden = [...oddCase, ...tokens, ...pwds, 'max_password_length', 'auth_token_count'];
  const side = (s) => ({
    ...Object.fromEntries(shown.map((k) => [k, `${k}-${s}`])),
    ...Object.fromEntries(hidden.map((k) => [k, `S3CR3T-${k}-${s}`])),
    llm: { maxTokens: `llm-${s}`, PassWord: `S3CR3T-llm-${s}` },
    auth: { max_tokens: `S3CR3T-auth-${s}` },
  });
  for (const opts of [{}, { flattenKeys: true }, { caseSensitive: true }]) {
    const label = JSON.stringify(opts);
    const m = maskResult(diff(side('l'), side('r'), opts));
    const byPath = Object.fromEntries(m.changes.map((c) => [c.path, c]));
    const p = (k) => (opts.caseSensitive ? k : k.toLowerCase());
    for (const k of shown) assert.equal(byPath[p(k)].newValue, `${k}-r`, `${k} ${label}`);
    for (const k of hidden) assert.equal(byPath[p(k)].newValue, MASK, `${k} ${label}`);
    assert.equal(byPath['llm.maxTokens'].newValue, 'llm-r', label);
    assert.equal(byPath['llm.PassWord'].newValue, MASK, label);
    assert.equal(byPath['auth.max_tokens'].newValue, MASK, label);
    assert.ok(!JSON.stringify(m).includes('S3CR3T'), label);
  }

  // PassWord used to be the only secret here, so nothing got masked
  const m = maskResult(diff({ PassWord: 'S3CR3T-1', host: 'a' }, { PassWord: 'S3CR3T-2', host: 'b' }));
  assert.ok(!JSON.stringify(m).includes('S3CR3T'));
});

test('web and CLI matchers agree on the same keys and share the regex source', () => {
  const lits = (f) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')
    .match(/^const (SECRET_KEY|COUNT_WORDS) = .*$/gm);
  assert.equal(lits('./maskSecrets.ts').length, 2);
  assert.deepEqual(lits('../../bin/configdiff.js'), lits('./maskSecrets.ts'));

  // the quick pre-filter in front of each matcher has to let every term through
  const line = lits('./maskSecrets.ts').find((s) => s.startsWith('const SECRET_KEY'));
  const terms = line.match(/\/\(([^)]*)\)/)[1].split('|').map((t) => t.replaceAll('[-_]?', ''));
  for (const t of terms) {
    // a bare pwd is left out on purpose, so check it inside a longer key
    assert.equal(isSecretKey(t === 'pwd' ? 'db_pwd' : t), true, t);
    assert.equal(isSecretKey(`${t}s`), true, `${t}s`);
  }

  const words = ['max', 'db', 'Pass', 'Word', 'Wd', 'pwd', 'PWD', 'token', 'TOKENS', 'Count', 'per', 'auth', 'or', 'secret', 'Key'];
  const keys = new Set([...oddCase, ...counts, ...tokens, ...pwds, ...stillSecret, 'PWD', 'pwd', 'env.PWD', 'author', 'authority',
    ...terms, ...terms.map((t) => `${t}s`)]);
  for (const a of words) {
    for (const sep of ['', '_', '-', '.']) {
      for (const b of words) keys.add(a + sep + b);
    }
  }

  const dir = mkdtempSync(join(tmpdir(), 'mask-parity-'));
  try {
    const l = join(dir, 'l.json');
    const r = join(dir, 'r.json');
    writeFileSync(l, '{}');
    writeFileSync(r, JSON.stringify(Object.fromEntries([...keys].map((k) => [k, 'v']))));
    const cli = fileURLToPath(new URL('../../bin/configdiff.js', import.meta.url));
    const res = spawnSync(process.execPath, [cli, l, r, '-o', 'json'], { encoding: 'utf8' });
    const changes = JSON.parse(res.stdout);
    assert.equal(changes.length, keys.size);
    for (const c of changes) assert.equal(c.newValue === MASK, isSecretKey(c.path), c.path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
