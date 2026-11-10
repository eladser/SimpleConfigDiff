// node --test test/configdiff.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/configdiff.js', import.meta.url));
// spawned stdout/stderr are pipes, so pretend they're terminals to test the flags on their own
const tty = '--import=data:text/javascript,process.stdout.isTTY=true;process.stderr.isTTY=true';

let dir, a, b, plain, evil;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'configdiff-'));
  a = join(dir, 'a.json');
  b = join(dir, 'b.json');
  writeFileSync(a, '{"host":"a","port":1,"old":true}');
  writeFileSync(b, '{"host":"b","port":1,"new":true}');
  plain = join(dir, 'plain.json');
  evil = join(dir, 'evil.json');
  writeFileSync(plain, '{"clip":"a","clear":"a"}');
  writeFileSync(evil, JSON.stringify({ clip: '\u001b]52;c;aGk=\u0007', clear: '\u001b[2J' }));
});

after(() => rmSync(dir, { recursive: true, force: true }));

function run(args, { fakeTty = false, env = {}, cwd } = {}) {
  const base = { ...process.env };
  delete base.NO_COLOR;
  const pre = fakeTty ? [tty] : [];
  return spawnSync(process.execPath, [...pre, cli, ...args], {
    encoding: 'utf8',
    env: { ...base, ...env },
    cwd,
  });
}

const esc = '\x1b';

test('terminal output is colored by default', () => {
  const r = run([a, b], { fakeTty: true });
  assert.ok(r.stdout.includes(esc));
});

test('--no-color gives plain table and summary', () => {
  for (const o of ['table', 'summary']) {
    const r = run([a, b, '-o', o, '--no-color'], { fakeTty: true });
    assert.match(r.stdout, /added/i);
    assert.ok(!r.stdout.includes(esc), `${o} has escape codes`);
  }
});

test('NO_COLOR gives plain output', () => {
  const r = run([a, b], { fakeTty: true, env: { NO_COLOR: '1' } });
  assert.ok(!r.stdout.includes(esc));
});

test('non-TTY stdout gives plain output', () => {
  const r = run([a, b]);
  assert.match(r.stdout, /added/);
  assert.ok(!r.stdout.includes(esc));
});

test('errors follow --no-color', () => {
  const r = run([a, join(dir, 'missing.json'), '--no-color'], { fakeTty: true });
  assert.match(r.stderr, /does not exist/);
  assert.ok(!r.stderr.includes(esc));
});

test('--output-file content is never colored', () => {
  const out = join(dir, 'out.txt');
  for (const o of ['table', 'summary']) {
    run([a, b, '-o', o, '--output-file', out], { fakeTty: true });
    assert.ok(!readFileSync(out, 'utf8').includes(esc), `${o} file has escape codes`);
  }
});

test('control characters in values print as escapes, color on and off', () => {
  for (const color of [true, false]) {
    const r = run([plain, evil, ...(color ? [] : ['--no-color'])], { fakeTty: true });
    assert.equal(r.stdout.includes('\x1b[33m'), color);
    // drop the table's own yellow for "changed", nothing else may carry ESC
    const rest = r.stdout.replace(/\x1b\[(0|33)m/g, '');
    assert.ok(!rest.includes(esc), `raw ESC, color ${color}`);
    assert.ok(!rest.includes('\x07'), `raw BEL, color ${color}`);
    assert.ok(rest.includes('\\x1b]52;c;aGk=\\x07'));
    assert.ok(rest.includes('\\x1b[2J'));
  }
});

test('csv cells and parse errors escape control characters too', () => {
  const csv = run([plain, evil, '-o', 'csv']).stdout;
  assert.ok(csv.includes('"\\x1b[2J"'));
  assert.ok(!csv.includes(esc));

  const bad = join(dir, 'bad.yaml');
  writeFileSync(bad, 'a: 1\n b: "\x1b[2J"\n');
  const r = run([bad, bad, '--show-secrets']);
  assert.match(r.stderr, /Failed to parse yaml/);
  assert.ok(r.stderr.includes('\\x1b[2J'));
  assert.ok(!r.stderr.includes(esc));
});

function pair(name, left, right) {
  const l = join(dir, `${name}-l.json`);
  const r = join(dir, `${name}-r.json`);
  writeFileSync(l, JSON.stringify(left));
  writeFileSync(r, JSON.stringify(right));
  return [l, r];
}

const paths = (r) => JSON.parse(r.stdout).map((c) => c.path);

test('--ignore-case drops values that differ only by case', () => {
  const [l, r] = pair('case', { level: 'Debug', n: 'A' }, { level: 'debug', n: 'B' });
  assert.deepEqual(paths(run([l, r, '-o', 'json'])), ['level', 'n']);
  assert.deepEqual(paths(run([l, r, '-o', 'json', '--ignore-case'])), ['n']);
});

test('--ignore-whitespace trims and collapses runs, but a space still counts', () => {
  const [l, r] = pair('ws', { a: 'a b', b: 'x\ty', c: 'ab' }, { a: ' a  b ', b: 'x y', c: 'a b' });
  assert.deepEqual(paths(run([l, r, '-o', 'json'])), ['a', 'b', 'c']);
  assert.deepEqual(paths(run([l, r, '-o', 'json', '--ignore-whitespace'])), ['c']);
});

test('exit code is 0 once only ignored differences are left', () => {
  const [l, r] = pair('exit', { level: 'Debug', name: 'a b' }, { level: 'debug', name: ' a  b ' });
  assert.equal(run([l, r]).status, 1);
  assert.equal(run([l, r, '--ignore-case']).status, 1);
  assert.equal(run([l, r, '--ignore-whitespace']).status, 1);
  assert.equal(run([l, r, '--ignore-case', '--ignore-whitespace']).status, 0);
});

test('ignore flags fold nested strings, not numbers, booleans or keys', () => {
  const [l, r] = pair('deep',
    { db: { host: 'DB.local ' }, tags: ['A'], port: 1, on: true, Key: 'x' },
    { db: { host: 'db.local' }, tags: ['a'], port: '1', on: 'TRUE', key: 'x' });
  const res = run([l, r, '-o', 'json', '--ignore-case', '--ignore-whitespace']);
  assert.deepEqual(paths(res), ['port', 'on', 'Key', 'key']);
  assert.equal(res.status, 1);
});

const ignore = (l, r, ...pats) => paths(run([l, r, '-o', 'json', ...pats.flatMap((p) => ['--ignore', p])]));

test('--ignore takes exact paths, case-sensitive, and drops what is under them', () => {
  const [l, r] = pair('exact',
    { version: 1, Version: 1, app: { version: 1 }, build: { time: 1, sha: 1 }, old: 1 },
    { version: 2, Version: 2, app: { version: 2 }, build: { time: 2, sha: 2 }, new: 1 });
  assert.deepEqual(ignore(l, r, 'version'), ['Version', 'app.version', 'build.time', 'build.sha', 'old', 'new']);
  assert.deepEqual(ignore(l, r, 'app.version', 'build', 'old', 'new'), ['version', 'Version']);
});

test('--ignore * matches one segment, array items included', () => {
  const [l, r] = pair('star',
    { password: 1, db: { password: 1 }, a: { b: { password: 1 } }, servers: [{ host: 'a', port: 1 }] },
    { password: 2, db: { password: 2 }, a: { b: { password: 2 } }, servers: [{ host: 'b', port: 2 }] });
  assert.deepEqual(ignore(l, r, '*.password'), ['password', 'a.b.password', 'servers.0.host', 'servers.0.port']);
  assert.deepEqual(ignore(l, r, 'servers.*.host'), ['password', 'db.password', 'a.b.password', 'servers.0.port']);
});

test('--ignore ** crosses segments, and like the web app **.x skips a top-level x', () => {
  const [l, r] = pair('globstar',
    { password: 1, db: { password: 1 }, a: { b: { password: 1, user: 1 } } },
    { password: 2, db: { password: 2 }, a: { b: { password: 2, user: 2 } } });
  assert.deepEqual(ignore(l, r, '**.password'), ['password', 'a.b.user']);
  assert.deepEqual(ignore(l, r, 'a.**'), ['password', 'db.password']);
  assert.deepEqual(ignore(l, r, '**'), []);
});

test('--ignore treats regex characters in a pattern literally', () => {
  const [l, r] = pair('literal', { a: { b: 1 }, axb: 1, 'c++': 1 }, { a: { b: 2 }, axb: 2, 'c++': 2 });
  assert.deepEqual(ignore(l, r, 'a.b'), ['axb', 'c++']);
  assert.deepEqual(ignore(l, r, 'c++'), ['a.b', 'axb']);
});

test('ignored paths stay out of every output format', () => {
  const [l, r] = pair('formats', { version: 1, host: 'a' }, { version: 2, host: 'b' });
  const out = join(dir, 'formats.out');
  for (const o of ['table', 'csv', 'json', 'summary']) {
    const res = run([l, r, '-o', o, '--ignore', 'version']);
    assert.ok(res.stdout.includes(o === 'summary' ? 'Total: 1' : 'host'), o);
    assert.ok(!res.stdout.includes('version'), `${o} shows version`);
    run([l, r, '-o', o, '--ignore', 'version', '--output-file', out]);
    assert.ok(!readFileSync(out, 'utf8').includes('version'), `${o} file shows version`);
  }
  assert.match(run([l, r, '-o', 'summary', '--ignore', 'version']).stdout, /Changed: 1\s+Total: 1/);
});

test('exit code is 0 when only ignored paths differ, from flags or .configdiffrc.json', () => {
  const [l, r] = pair('rc', { version: '1.0', build: { time: 1 }, name: 'x' }, { version: '1.1', build: { time: 2 }, name: 'x' });
  const cwd = join(dir, 'rc');
  mkdirSync(cwd);
  assert.equal(run([l, r]).status, 1);
  assert.equal(run([l, r, '--ignore', 'version']).status, 1);
  assert.equal(run([l, r, '--ignore', 'version', '--ignore', 'build.*']).status, 0);

  writeFileSync(join(cwd, '.configdiffrc.json'), JSON.stringify({ ignore: ['version', 'build.*'] }));
  assert.equal(run([l, r], { cwd }).status, 0);
  assert.equal(run([l, r]).status, 1);

  writeFileSync(join(cwd, '.configdiffrc.json'), '\ufeff' + JSON.stringify({ ignore: ['version', 'build.*'] }));
  assert.equal(run([l, r], { cwd }).status, 0);

  // the rc file and flags add up
  writeFileSync(join(cwd, '.configdiffrc.json'), JSON.stringify({ ignore: ['version'] }));
  assert.equal(run([l, r], { cwd }).status, 1);
  assert.equal(run([l, r, '--ignore', 'build.*'], { cwd }).status, 0);
});

test('a malformed .configdiffrc.json is a one-line error', () => {
  const [l, r] = pair('badrc', { a: 1 }, { a: 1 });
  const cwd = join(dir, 'badrc');
  mkdirSync(cwd);
  for (const body of ['{"ignore": ["a",]}', '{"ignore": "a"}', '{"ignore": [1]}', '["a"]', 'null', '{}']) {
    writeFileSync(join(cwd, '.configdiffrc.json'), body);
    const res = run([l, r], { cwd });
    assert.equal(res.status, 1, body);
    assert.match(res.stderr, /^Error: .*\.configdiffrc\.json/, body);
    assert.equal(res.stderr.trim().split('\n').length, 1, body);
    assert.equal(res.stdout, '', body);
  }
});

test('--help lists --ignore', () => {
  assert.match(run(['--help']).stdout, /--ignore <pattern>/);
});

const MASK = '\u2022'.repeat(6);

// secret values all carry S3CR3T so one includes() check covers a whole output
const secretPair = () => pair('secrets',
  { db: { host: 'a', password: 'S3CR3T-1' }, author: 'alice', AUTH_TOKEN: 'S3CR3T-2', clientSecret: 'S3CR3T-3',
    secretKey: 'S3CR3T-7', passwordHash: 'S3CR3T-8' },
  { db: { host: 'b', password: 'S3CR3T-4' }, author: 'bob', AUTH_TOKEN: 'S3CR3T-5', clientSecret: 'S3CR3T-6',
    secretKey: 'S3CR3T-9', passwordHash: 'S3CR3T-10' });

test('secret values are masked in every output format', () => {
  const [l, r] = secretPair();
  const out = join(dir, 'secrets.out');
  for (const o of ['table', 'csv', 'json']) {
    const res = run([l, r, '-o', o]);
    assert.ok(!res.stdout.includes('S3CR3T'), `${o} shows a secret`);
    assert.ok(res.stdout.includes(MASK), o);
    assert.ok(res.stdout.includes('alice') && res.stdout.includes('bob'), `${o} masks author`);
    run([l, r, '-o', o, '--output-file', out]);
    assert.ok(!readFileSync(out, 'utf8').includes('S3CR3T'), `${o} file shows a secret`);
  }
});

test('a masked secret still counts as changed', () => {
  const [l, r] = secretPair();
  const res = run([l, r, '-o', 'json']);
  assert.equal(res.status, 1);
  assert.deepEqual(JSON.parse(res.stdout), [
    { path: 'db.host', type: 'changed', oldValue: 'a', newValue: 'b' },
    { path: 'db.password', type: 'changed', oldValue: MASK, newValue: MASK },
    { path: 'author', type: 'changed', oldValue: 'alice', newValue: 'bob' },
    { path: 'AUTH_TOKEN', type: 'changed', oldValue: MASK, newValue: MASK },
    { path: 'clientSecret', type: 'changed', oldValue: MASK, newValue: MASK },
    { path: 'secretKey', type: 'changed', oldValue: MASK, newValue: MASK },
    { path: 'passwordHash', type: 'changed', oldValue: MASK, newValue: MASK },
  ]);
  assert.match(run([l, r, '-o', 'summary']).stdout, /Changed: 7\s+Total: 7/);

  const [same1, same2] = pair('samesecret', { password: 'S3CR3T' }, { password: 'S3CR3T' });
  assert.equal(run([same1, same2]).status, 0);
});

test('--show-secrets prints the real values', () => {
  const [l, r] = secretPair();
  for (const o of ['table', 'csv', 'json']) {
    const res = run([l, r, '-o', o, '--show-secrets']);
    assert.ok(res.stdout.includes('S3CR3T-1') && res.stdout.includes('S3CR3T-6'), o);
    assert.ok(!res.stdout.includes(MASK), o);
  }
});

test('everything under a secret key masks, and secret keys inside added objects', () => {
  const [l, r] = pair('nested',
    { auth: { user: 'u', pass: 'S3CR3T-1' }, tokens: ['S3CR3T-2'], servers: [{ host: 'a' }] },
    { auth: { user: 'u', pass: 'S3CR3T-3' }, tokens: ['S3CR3T-4'], servers: [{ host: 'a' }, { host: 'b', apiKey: 'S3CR3T-5' }],
      db: { host: 'h', password: 'S3CR3T-6' } });
  assert.deepEqual(JSON.parse(run([l, r, '-o', 'json']).stdout), [
    { path: 'auth.pass', type: 'changed', oldValue: MASK, newValue: MASK },
    { path: 'tokens.0', type: 'changed', oldValue: MASK, newValue: MASK },
    { path: 'servers.1', type: 'added', newValue: { host: 'b', apiKey: MASK } },
    { path: 'db', type: 'added', newValue: { host: 'h', password: MASK } },
  ]);

  const [l2, r2] = pair('replicas', { app: 'x' }, { app: 'x', extra: { replicas: [{ host: 'h', password: 'S3CR3T-7' }] } });
  assert.deepEqual(JSON.parse(run([l2, r2, '-o', 'json']).stdout), [
    { path: 'extra', type: 'added', newValue: { replicas: [{ host: 'h', password: MASK }] } },
  ]);
});

test('values with nothing secret under them print as before, dates included', () => {
  const l = join(dir, 'date-l.yaml');
  const r = join(dir, 'date-r.yaml');
  writeFileSync(l, 'name: app\n');
  writeFileSync(r, 'name: app\nreleased: 2024-01-01\nbuild:\n  at: 2024-02-02\n');
  assert.deepEqual(JSON.parse(run([l, r, '-o', 'json']).stdout), [
    { path: 'released', type: 'added', newValue: '2024-01-01T00:00:00.000Z' },
    { path: 'build', type: 'added', newValue: { at: '2024-02-02T00:00:00.000Z' } },
  ]);
});

test('odd casing masks, token counts and a bare PWD show their values', () => {
  const hidden = ['PassWord', 'PassWd', 'DbPassWord', 'SecretKey', 'PrivateKEY', 'token', 'tokens', 'authToken',
    'NPM_TOKEN', 'access_token', 'api_tokens', 'refreshTokens', 'DB_PWD', 'db_pwd', 'pwdHash',
    'max_password_length', 'auth_token_count'];
  const shown = ['max_tokens', 'maxTokens', 'max_output_tokens', 'tokens_per_minute', 'token_count', 'num_tokens',
    'tokenLimit', 'PWD', 'pwd', 'author', 'authority'];
  const side = (s) => ({
    ...Object.fromEntries([...hidden, ...shown].map((k) => [k, `${k}-${s}`])),
    auth: { max_tokens: `auth-${s}` },
    secrets: { PWD: `secrets-${s}` },
  });
  const [l, r] = pair('casing', side('l'), side('r'));
  const got = Object.fromEntries(JSON.parse(run([l, r, '-o', 'json']).stdout).map((c) => [c.path, c.newValue]));
  for (const k of hidden) assert.equal(got[k], MASK, k);
  for (const k of shown) assert.equal(got[k], `${k}-r`, k);
  assert.equal(got['auth.max_tokens'], MASK);
  assert.equal(got['secrets.PWD'], MASK);
});

test('masking works with --ignore and control character escapes', () => {
  const [l, r] = pair('mixed',
    { password: '\u001b[2J', token: 'S3CR3T-1', host: 'a' },
    { password: '\u001b]52;c;aGk=\u0007', token: 'S3CR3T-2', host: 'b' });
  const res = run([l, r, '--ignore', 'token']);
  assert.ok(!res.stdout.includes('token'));
  assert.ok(res.stdout.includes(`| ${MASK} | ${MASK}`));
  assert.ok(!res.stdout.includes(esc));
  assert.ok(!res.stdout.includes('\\x1b'));

  const shown = run([l, r, '--ignore', 'token', '--show-secrets']).stdout;
  assert.ok(shown.includes('\\x1b[2J'));
  assert.ok(!shown.includes(esc));
});

test('--help lists --show-secrets', () => {
  assert.match(run(['--help']).stdout, /--show-secrets/);
});

// table rows as [path, type, old, new], csv rows as raw lines, headers dropped
const tableRows = (out) => out.trimEnd().split('\n').slice(2).map((line) => line.split(' | ').map((s) => s.trimEnd()));
const csvRows = (out) => out.trimEnd().split('\n').slice(1);

test('table and csv show false, 0, null and "" as values, objects and lists as JSON, dates as ISO', () => {
  const l = join(dir, 'cells-l.yaml');
  const r = join(dir, 'cells-r.yaml');
  writeFileSync(l, 'debug: true\nport: 1\ntimeout: null\nname: x\n');
  writeFileSync(r, "debug: false\nport: 0\ntimeout: 1\nname: ''\nb:\n  c: 2\nlist: [1, 2]\nreleased: 2024-01-01\n");
  assert.deepEqual(tableRows(run([l, r]).stdout), [
    ['debug', 'changed', 'true', 'false'],
    ['port', 'changed', '1', '0'],
    ['timeout', 'changed', 'null', '1'],
    ['name', 'changed', 'x', '""'],
    ['b', 'added', '', '{"c":2}'],
    ['list', 'added', '', '[1,2]'],
    ['released', 'added', '', '2024-01-01T00:00:00.000Z'],
  ]);
  assert.deepEqual(csvRows(run([l, r, '-o', 'csv']).stdout), [
    '"debug","changed","true","false"',
    '"port","changed","1","0"',
    '"timeout","changed","null","1"',
    '"name","changed","x",""""""',
    '"b","added","","{""c"":2}"',
    '"list","added","","[1,2]"',
    '"released","added","","2024-01-01T00:00:00.000Z"',
  ]);
});

function filePair(name, ext, left, right) {
  const l = join(dir, `${name}-l.${ext}`);
  const r = join(dir, `${name}-r.${ext}`);
  writeFileSync(l, left);
  writeFileSync(r, right);
  return [l, r];
}

// js-yaml and smol-toml both parse these to Date objects, printed as toISOString()
const dates = {
  'yaml date': ['yaml', 'released: 2024-01-01\n', 'released: 2025-06-01\n', '2024-01-01T00:00:00.000Z', '2025-06-01T00:00:00.000Z'],
  'yaml datetime': ['yaml', 'deployed: 2024-01-01T10:00:00Z\n', 'deployed: 2024-01-01T10:30:00Z\n',
    '2024-01-01T10:00:00.000Z', '2024-01-01T10:30:00.000Z'],
  'toml date': ['toml', 'released = 2024-01-01\n', 'released = 2025-06-01\n', '2024-01-01', '2025-06-01'],
  'toml datetime': ['toml', 'deployed = 2024-01-01T10:00:00Z\n', 'deployed = 2024-01-01T10:30:00Z\n',
    '2024-01-01T10:00:00.000Z', '2024-01-01T10:30:00.000Z'],
  'toml local datetime': ['toml', 'at = 2024-01-01T10:00:00\n', 'at = 2024-01-01T10:30:00\n',
    '2024-01-01T10:00:00.000', '2024-01-01T10:30:00.000'],
  'toml local time': ['toml', 't = 07:32:00\n', 't = 07:33:00\n', '07:32:00.000', '07:33:00.000'],
};

test('a changed date is one changed row and exit 1, an equal one is nothing and exit 0', () => {
  for (const [name, [ext, left, right, a, b]] of Object.entries(dates)) {
    const key = left.split(/[:= ]/)[0];
    const [l, r] = filePair(name.replaceAll(' ', '-'), ext, left, right);
    const res = run([l, r, '-o', 'json']);
    assert.deepEqual(JSON.parse(res.stdout), [{ path: key, type: 'changed', oldValue: a, newValue: b }], name);
    assert.equal(res.status, 1, name);
    assert.deepEqual(tableRows(run([l, r]).stdout), [[key, 'changed', a, b]], name);

    const same = run([l, l, '-o', 'json']);
    assert.deepEqual(JSON.parse(same.stdout), [], name);
    assert.equal(same.status, 0, name);
  }
});

test('dates compare by time, nested and in arrays too', () => {
  const [l, r] = filePair('date-instant', 'yaml', 'deployed: 2024-01-01 12:00:00 +02:00\n', 'deployed: 2024-01-01T10:00:00Z\n');
  assert.equal(run([l, r]).status, 0);

  const [l2, r2] = filePair('date-nested', 'toml',
    '[build]\nat = 2024-01-01T10:00:00Z\ndays = [2024-01-01, 2024-01-02]\n',
    '[build]\nat = 2024-01-01T11:00:00Z\ndays = [2024-01-01, 2024-01-03]\n');
  assert.deepEqual(JSON.parse(run([l2, r2, '-o', 'json']).stdout), [
    { path: 'build.at', type: 'changed', oldValue: '2024-01-01T10:00:00.000Z', newValue: '2024-01-01T11:00:00.000Z' },
    { path: 'build.days.1', type: 'changed', oldValue: '2024-01-02', newValue: '2024-01-03' },
  ]);
});

test('a date against a string, a number or an object is still a change', () => {
  for (const [other, shown] of [["'2024-01-01'", '2024-01-01'], ['1704067200000', 1704067200000], ['{ day: 1 }', { day: 1 }]]) {
    const [l, r] = filePair('date-vs', 'yaml', `released: ${other}\n`, 'released: 2024-01-01\n');
    const res = run([l, r, '-o', 'json']);
    assert.deepEqual(JSON.parse(res.stdout), [
      { path: 'released', type: 'changed', oldValue: shown, newValue: '2024-01-01T00:00:00.000Z' },
    ], other);
    assert.equal(res.status, 1, other);
  }
});

test('added INI sections print as JSON in table and csv, masked or not', () => {
  const l = join(dir, 'sections-l.ini');
  const r = join(dir, 'sections-r.ini');
  writeFileSync(l, '[a]\nx=1\n');
  writeFileSync(r, '[a]\nx=1\n\n[b]\ny=2\n\n[c]\nuser=u\npassword=S3CR3T-1\n');
  for (const [flags, pw] of [[[], MASK], [['--show-secrets'], 'S3CR3T-1']]) {
    const table = run([l, r, ...flags]);
    assert.equal(table.stderr, '');
    assert.deepEqual(tableRows(table.stdout), [
      ['b', 'added', '', '{"y":"2"}'],
      ['c', 'added', '', `{"user":"u","password":"${pw}"}`],
    ]);
    const csv = run([l, r, '-o', 'csv', ...flags]);
    assert.equal(csv.stderr, '');
    assert.deepEqual(csvRows(csv.stdout), [
      '"b","added","","{""y"":""2""}"',
      `"c","added","","{""user"":""u"",""password"":""${pw}""}"`,
    ]);
  }
});

// hunter2 sits next to the syntax error, so each parser's own message quotes it
const broken = {
  yaml: ['user: admin\npassword: hunter2\n  port: 1\n', 'line 3, column 7'],
  toml: ['user = "admin"\npassword = "hunter2"\nport = = 1\n', 'line 3, column 8'],
};

test('a parse error is one line with the file and position and nothing from the file', () => {
  for (const [fmt, [text, at]] of Object.entries(broken)) {
    const [l, r] = filePair(`parse-${fmt}`, fmt, '', text);
    const res = run([l, r]);
    assert.equal(res.stderr, `Error: Failed to parse ${r} as ${fmt} at ${at}\n`, fmt);
    assert.equal(res.status, 1, fmt);

    const full = run([l, r, '--show-secrets']);
    assert.match(full.stderr, new RegExp(`^Error: Failed to parse ${fmt} file: `), fmt);
    assert.ok(full.stderr.includes('hunter2'), fmt);
    assert.equal(full.status, 1, fmt);
  }
});

test('JSON parse errors give a position when the message has one and never the excerpt', () => {
  const [l, r] = filePair('parse-json', 'json', '{}', '{\n  "user": "admin",\n  "password": "hunter2"\n  "port": 1\n}\n');
  const res = run([l, r]);
  assert.equal(res.stderr, `Error: Failed to parse ${r} as json at line 4, column 3\n`);
  assert.equal(res.status, 1);
  assert.match(run([l, r, '--show-secrets']).stderr, /^Error: Failed to parse json file: .* at position 47/);

  // here V8 quotes the text around the bad token instead of giving a position
  const [l2, r2] = filePair('parse-json-token', 'json', '{}', '{\n  "password": hunter2\n}\n');
  const res2 = run([l2, r2]);
  assert.equal(res2.stderr, `Error: Failed to parse ${r2} as json\n`);
  assert.equal(res2.status, 1);
  assert.ok(run([l2, r2, '--show-secrets']).stderr.includes('hunter2'));

  // the excerpt can itself say "at position", which isn't V8's position
  const [l3, r3] = filePair('parse-json-spoof', 'json', '{}', '{"x": at position 5}');
  assert.equal(run([l3, r3]).stderr, `Error: Failed to parse ${r3} as json\n`);

  // V8 counts a lone CR as a line break
  const [l4, r4] = filePair('parse-json-cr', 'json', '{}', '{\r"pw": "hunter2"\r"port": 1\r}');
  assert.equal(run([l4, r4]).stderr, `Error: Failed to parse ${r4} as json at line 3, column 1\n`);
});

test('--watch prints the same line, on the first run and after a change', { timeout: 10000 }, async () => {
  const [l, r] = filePair('parse-watch', 'yaml', '', broken.yaml[0]);
  const p = spawn(process.execPath, [cli, l, r, '--watch']);
  let out = '', err = '';
  p.stdout.on('data', (s) => { out += s; });
  p.stderr.on('data', (s) => { err += s; });
  const until = async (ok) => { while (!ok()) await new Promise((res) => setTimeout(res, 20)); };
  try {
    await until(() => out.includes('Watching') && err.includes('\n'));
    writeFileSync(r, broken.yaml[0] + 'more: 1\n');
    await until(() => out.includes('recomparing') && err.split('\n').length > 2);
  } finally {
    p.kill();
  }
  for (const ln of err.trimEnd().split('\n')) {
    assert.equal(ln, `Error: Failed to parse ${r} as yaml at line 3, column 7`);
  }
});

// DB_PASS and conn aren't secret names, only kind: Secret makes them so
const manifest = {
  yaml: (kind, s) => `apiVersion: v1\nkind: ${kind}\nmetadata:\n  name: db-${s}\ndata:\n  DB_PASS: aHVudGVy${s}\n` +
    `stringData:\n  conn: Server=x;Password=hunter${s}\n`,
  json: (kind, s) => JSON.stringify({ apiVersion: 'v1', kind, metadata: { name: `db-${s}` },
    data: { DB_PASS: `aHVudGVy${s}` }, stringData: { conn: `Server=x;Password=hunter${s}` } }),
};

const webConfig = (adds) => `<?xml version="1.0"?>
<configuration>
  <appSettings>
${adds.map(([k, v]) => `    <add key="${k}" value="${v}" />`).join('\n')}
  </appSettings>
</configuration>
`;

// rows as [path, type, old, new] give the same cells in table, csv and json
function sameInEveryFormat(l, r, rows, label) {
  assert.deepEqual(tableRows(run([l, r]).stdout), rows, label);
  assert.deepEqual(csvRows(run([l, r, '-o', 'csv']).stdout), rows.map((row) => row.map((c) => `"${c}"`).join(',')), label);
  assert.deepEqual(JSON.parse(run([l, r, '-o', 'json']).stdout),
    rows.map(([path, type, oldValue, newValue]) => ({ path, type, oldValue, newValue })), label);
}

test('a Secret masks data and stringData in table, csv and json, a ConfigMap with the same keys does not', () => {
  for (const [ext, text] of Object.entries(manifest)) {
    for (const kind of ['Secret', 'ConfigMap']) {
      const [l, r] = filePair(`k8s-${kind}`, ext, text(kind, 1), text(kind, 2));
      const hide = (v) => (kind === 'Secret' ? MASK : v);
      sameInEveryFormat(l, r, [
        ['metadata.name', 'changed', 'db-1', 'db-2'],
        ['data.DB_PASS', 'changed', hide('aHVudGVy1'), hide('aHVudGVy2')],
        ['stringData.conn', 'changed', hide('Server=x;Password=hunter1'), hide('Server=x;Password=hunter2')],
      ], `${kind} ${ext}`);
    }
  }

  // data that shows up whole is masked whole
  const [l, r] = pair('k8s-added', { kind: 'Secret' }, { kind: 'Secret', data: { DB_PASS: 'aHVudGVy1' } });
  assert.deepEqual(tableRows(run([l, r]).stdout), [['data', 'added', '', MASK]]);
  assert.deepEqual(JSON.parse(run([l, r, '-o', 'json']).stdout), [{ path: 'data', type: 'added', newValue: MASK }]);
});

test('an XML add masks its value in table, csv and json when the key is a secret name', () => {
  const [l, r] = filePair('webconfig', 'xml',
    webConfig([['DbPassword', 'hunter2'], ['Theme', 'dark']]),
    webConfig([['DbPassword', 'hunter3'], ['Theme', 'light']]));
  sameInEveryFormat(l, r, [
    ['configuration.appSettings.add.0.@_value', 'changed', MASK, MASK],
    ['configuration.appSettings.add.1.@_value', 'changed', 'dark', 'light'],
  ]);

  // one add parses to an object, not an array
  const [l1, r1] = filePair('webconfig-one', 'xml', webConfig([['DbPassword', 'hunter2']]), webConfig([['DbPassword', 'hunter3']]));
  sameInEveryFormat(l1, r1, [['configuration.appSettings.add.@_value', 'changed', MASK, MASK]]);
  const [l2, r2] = filePair('webconfig-theme', 'xml', webConfig([['Theme', 'dark']]), webConfig([['Theme', 'light']]));
  sameInEveryFormat(l2, r2, [['configuration.appSettings.add.@_value', 'changed', 'dark', 'light']]);

  const [l3, r3] = filePair('webconfig-added', 'xml',
    webConfig([['Theme', 'dark'], ['Mode', 'x']]),
    webConfig([['Theme', 'dark'], ['Mode', 'x'], ['ApiKey', 'hunter4']]));
  assert.deepEqual(JSON.parse(run([l3, r3, '-o', 'json']).stdout), [
    { path: 'configuration.appSettings.add.2', type: 'added', newValue: { '@_key': 'ApiKey', '@_value': MASK } },
  ]);
});

test('--show-secrets prints Secret data and XML add values, and masking keeps types and counts', () => {
  const pairs = {
    secret: filePair('k8s-shown', 'yaml', manifest.yaml('Secret', 2), manifest.yaml('Secret', 3)),
    xml: filePair('webconfig-shown', 'xml', webConfig([['DbPassword', 'hunter2']]), webConfig([['DbPassword', 'hunter3'], ['Theme', 'x']])),
  };
  for (const [name, [l, r]] of Object.entries(pairs)) {
    for (const o of ['table', 'csv', 'json']) {
      const masked = run([l, r, '-o', o]).stdout;
      assert.ok(!masked.includes('hunter'), `${name} ${o}`);
      const shown = run([l, r, '-o', o, '--show-secrets']).stdout;
      assert.ok(shown.includes('hunter2') && shown.includes('hunter3'), `${name} ${o}`);
      assert.ok(!shown.includes(MASK), `${name} ${o}`);
    }
    const types = (flags) => {
      const res = run([l, r, '-o', 'json', ...flags]);
      return [res.status, JSON.parse(res.stdout).map((c) => [c.path, c.type])];
    };
    assert.deepEqual(types([]), types(['--show-secrets']), name);
    assert.equal(run([l, r, '-o', 'summary']).stdout, run([l, r, '-o', 'summary', '--show-secrets']).stdout, name);
  }
});
