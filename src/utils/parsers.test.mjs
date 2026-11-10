// node --test src/utils/parsers.test.mjs
// parsers.ts uses the @/ alias and extensionless imports, so load it through vite.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let server;
let detectFormat;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
  });
  ({ detectFormat } = await server.ssrLoadModule('/src/utils/parsers.ts'));
});

after(() => server?.close());

const toml = {
  'table with quoted strings': `# app
[server]
host = "localhost"
name = 'literal'
`,
  'dotted tables with an inline table': `[server]
host = "example.com"

[server.tls]
enabled = true
cert = { path = "/etc/ssl/a.pem", key = "/etc/ssl/a.key" }
`,
  'array of tables': `[[servers]]
name = "alpha"
ip = "10.0.0.1"

[[servers]]
name = "beta"
ip = "10.0.0.2"
`,
  'typed values without quotes': `[server]
port = 8080
enabled = true
timeout = 2.5
ports = [8080, 8081]
started = 2024-05-01T10:00:00Z
`,
};

const ini = {
  'section with bare values': `[section]
key=value
path=/var/lib/app
`,
  'semicolon comments': `[app]
; shown in the title bar
name = "quoted"
debug = true
port = 5432
`,
  'typed looking values next to bare ones': `[server]
name = "quoted"
debug = true
host = 127.0.0.1

[server.ssl]
cert = /etc/ssl/server.pem
`,
};

for (const [name, content] of Object.entries(toml)) {
  test(`pasted toml: ${name}`, () => {
    assert.equal(detectFormat('', content), 'toml');
  });
}

for (const [name, content] of Object.entries(ini)) {
  test(`pasted ini: ${name}`, () => {
    assert.equal(detectFormat('', content), 'ini');
  });
}
