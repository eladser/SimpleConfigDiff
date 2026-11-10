// node --test test/configdiff.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
  const r = run([bad, bad]);
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
  { db: { host: 'a', password: 'S3CR3T-1' }, author: 'alice', AUTH_TOKEN: 'S3CR3T-2', clientSecret: 'S3CR3T-3' },
  { db: { host: 'b', password: 'S3CR3T-4' }, author: 'bob', AUTH_TOKEN: 'S3CR3T-5', clientSecret: 'S3CR3T-6' });

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
  ]);
  assert.match(run([l, r, '-o', 'summary']).stdout, /Changed: 5\s+Total: 5/);

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
