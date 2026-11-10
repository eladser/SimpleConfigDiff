// node --test src/utils/parseHCL.test.mjs
// Loaded through vite like parsers.test.mjs, for the @/ alias.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let parseHCL;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ parseHCL } = await server.ssrLoadModule('/src/utils/parseHCL.ts'));
});

after(() => server?.close());

test('a __proto__ block stays a key', () => {
  const names = Object.getOwnPropertyNames(Object.prototype);
  const { data, error } = parseHCL('__proto__ polluted {\n}\nconstructor app {\n}\n');
  assert.equal(error, undefined);
  assert.deepEqual(Object.getOwnPropertyNames(Object.prototype), names);
  assert.equal(Object.getPrototypeOf(data), Object.prototype);
  assert.ok(Object.hasOwn(data, '__proto__'));
  assert.ok(Object.hasOwn(data, 'constructor'));
});

test('__proto__ assignments and inline keys stay keys', () => {
  const { data, error } = parseHCL('__proto__={isAdmin: true}\ntags={__proto__: x}\n');
  assert.equal(error, undefined);
  assert.equal(({}).isAdmin, undefined);
  assert.equal(Object.getPrototypeOf(data), Object.prototype);
  assert.ok(Object.hasOwn(data, '__proto__'));
  assert.deepEqual(data.__proto__, { isAdmin: true });
  assert.ok(Object.hasOwn(data.tags, '__proto__'));
  assert.equal(data.tags.__proto__, 'x');
});

const tf = `# web
resource "aws_instance" "web" {
ami="ami-123"
count=2
monitoring=true
ports=[80, 443]
tags={Name: "web", env: prod}
ebs_block_device "gp3" "root" {
size=20
}
}

resource "aws_instance" "db" {
count=1
}
`;

test('a terraform file parses as before', () => {
  const { data, error } = parseHCL(tf);
  assert.equal(error, undefined);
  assert.deepEqual(data, {
    resource: {
      'aws_instance.web': {
        ami: 'ami-123', count: 2, monitoring: true, ports: [80, 443], tags: { Name: 'web', env: 'prod' },
        ebs_block_device: { 'gp3.root': { size: 20 } },
      },
      'aws_instance.db': { count: 1 },
    },
  });
});
