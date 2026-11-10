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
