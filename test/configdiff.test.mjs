// node --test test/configdiff.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
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

function run(args, { fakeTty = false, env = {} } = {}) {
  const base = { ...process.env };
  delete base.NO_COLOR;
  const pre = fakeTty ? [tty] : [];
  return spawnSync(process.execPath, [...pre, cli, ...args], {
    encoding: 'utf8',
    env: { ...base, ...env },
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
