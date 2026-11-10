# SimpleConfigDiff CLI Tool

A command-line interface for comparing configuration files with support for multiple formats.

## Requirements

Node.js 22.22.2+ or 24.15+.

## Installation

```bash
npm install -g simple-config-diff
```

Or use directly with npx:

```bash
npx simple-config-diff config1.json config2.json
```

## Usage

### Basic Usage

```bash
configdiff <left-file> <right-file>
```

### Options

- `-V, --version` - Output the version number
- `-f, --format <format>` - Force specific format (json, yaml, xml, ini, toml, env, properties)
- `-o, --output <format>` - Output format (json, csv, table, summary) [default: table]
- `-w, --watch` - Watch files for changes and recompare
- `--output-file <file>` - Write output to file instead of stdout
- `--force` - Force comparison even if file formats differ
- `--no-color` - Disable colored output
- `--ignore-case` - Ignore case when comparing values
- `--ignore-whitespace` - Ignore whitespace differences
- `--ignore <pattern>` - Ignore a path or glob like `build.*` or `**.password` (repeatable)
- `--show-secrets` - Print values under keys like password, token or api_key instead of masking them
- `-h, --help` - Display help for command

### Examples

#### Basic comparison with table output
```bash
configdiff config1.json config2.json
```

#### JSON output format
```bash
configdiff app.yml prod.yml -o json
```

#### Summary output
```bash
configdiff .env.local .env.prod -o summary
```

#### Save results to file
```bash
configdiff package.json package-lock.json -o json --output-file diff.json
```

#### Watch mode for continuous comparison
```bash
configdiff terraform.tf terraform.prod.tf --watch
```

#### Force comparison between different formats
```bash
configdiff config.yaml config.json --force
```

## Supported Formats

- **JSON** (`.json`)
- **YAML** (`.yaml`, `.yml`)
- **XML** (`.xml`)
- **INI** (`.ini`)
- **TOML** (`.toml`)
- **Environment Variables** (`.env`)
- **HCL/Terraform** (`.hcl`, `.tf`)
- **Properties** (`.properties`)
- **CSV** (`.csv`)
- **Config** (`.config`, `.conf`)

## Output Formats

### Table (Default)
Human-readable table format with colored output:
```
Path               | Type    | Old Value | New Value
database.host      | changed | localhost | prod-db
database.port      | added   |           | 5432
debug.enabled      | removed | true      |
```

### JSON
Structured JSON format for programmatic use:
```json
[
  {
    "path": "database.host",
    "type": "changed",
    "oldValue": "localhost",
    "newValue": "prod-db"
  }
]
```

### CSV
Comma-separated values for spreadsheet import:
```csv
Path,Type,Old Value,New Value
database.host,changed,localhost,prod-db
database.port,added,,5432
debug.enabled,removed,true,
```

### Summary
High-level overview of changes:
```
Configuration Diff Summary
==============================
Added: 1
Removed: 1
Changed: 1
Total: 3
```

## Watch Mode

The CLI tool can watch files for changes and automatically recompare them:

```bash
configdiff config.dev.json config.prod.json --watch
```

This is useful for:
- Development workflows
- CI/CD pipelines
- Real-time monitoring of configuration changes

## Exit Codes

- `0` - Files are identical
- `1` - Files have differences or an error occurred

This makes it suitable for use in scripts and CI/CD pipelines:

```bash
if configdiff config.json config.prod.json; then
  echo "Configurations are identical"
else
  echo "Configurations differ"
fi
```

## Integration Examples

### CI/CD Pipeline
```yaml
# GitHub Actions example
- name: Compare configurations
  run: |
    configdiff config/staging.json config/production.json -o summary
    if [ $? -eq 1 ]; then
      echo "::warning::Configuration differences detected"
    fi
```

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit
configdiff config.json config.example.json --force
```

### Development Script
```bash
#!/bin/bash
# compare-configs.sh
echo "Comparing development vs production configs..."
configdiff .env.development .env.production -o table --no-color
```

## Error Handling

The CLI tool provides clear error messages for common issues:

- **File not found**: `Error: Left file 'config.json' does not exist`
- **Format mismatch**: `Error: File formats differ (json vs yaml). Use --force to compare anyway.`
- **Parse errors**: `Error: Failed to parse app.yaml as yaml at line 4, column 1`. Line and column show when the parser reports them, and none of the file's text is printed since it could hold secrets. `--show-secrets` prints the parser's full message instead.
- **Invalid options**: `Error: Invalid output format 'xml'. Valid formats: json, csv, table, summary`

## Advanced Features

### Ignore Patterns
`--ignore` takes a dotted path from the root or a glob, and can be repeated. `*` stays inside one key, `**` crosses levels, and array items count as keys, so `servers.*.host` works. An ignored path drops out of the output and the exit code, along with everything under it.

```bash
configdiff app.json app.prod.json --ignore version --ignore 'build.*'
configdiff app.yaml app.prod.yaml --ignore '**.password'
```

Rules you want on every run can live in `.configdiffrc.json` in the working directory, and they add up with any `--ignore` flags:

```json
{ "ignore": ["version", "build.*"] }
```

The CLI only reads the file from the directory you run it in, not from the compared files' folders or parent directories. If it isn't valid JSON, or `ignore` isn't a list of strings, the CLI prints an error and exits with `1`.

### Case and Whitespace
```bash
# Ignore case differences
configdiff config1.json config2.json --ignore-case

# Ignore whitespace differences
configdiff config1.yml config2.yml --ignore-whitespace
```

### Secret Masking
Values under keys like `password`, `token` or `api_key` print as dots, in every output format and in `--output-file`, but still count toward the exit code. `--show-secrets` prints them as they are.

```
db.password | changed | •••••• | ••••••
```

A key counts as secret when `password`, `passwd`, `pwd`, `secret`, `token`, `api_key`, `private_key`, `credential` or `auth` (or its plural) ends a word in it, so `dbPassword`, `AUTH_TOKEN` and `client_secret` match while `author` and `tokenizer` don't. Token counts like `max_tokens` or `tokenLimit` and a bare `PWD` stay visible. Everything under a secret key is masked too, and so are the values under `data` and `stringData` in a Kubernetes `kind: Secret` and the `value` of an XML `<add key="DbPassword" value="..."/>` whose key looks secret.

### Color
Output is colored when it goes to a terminal. Color is off with `--no-color`, when `NO_COLOR` is set to anything non-empty, and when stdout isn't a terminal (piped or redirected). Error messages follow the same rules for stderr. Files written with `--output-file` never contain color codes.

### Format Detection
The tool automatically detects file formats based on extensions, and env files are also recognized by name (`.env`, `.env.local`, `.env.production`), but you can override:

```bash
# Force YAML parsing for files without .yml extension
configdiff config-a config-b --format yaml
```

### Batch Processing
For comparing multiple files, use shell scripting:

```bash
#!/bin/bash
for file in configs/*.json; do
  echo "Comparing $file with production..."
  configdiff "$file" "configs/production.json" -o summary
done
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   ```bash
   chmod +x bin/configdiff.js
   ```

2. **Node.js Not Found**
   - Ensure Node.js is installed: `node --version`
   - Install Node.js from [nodejs.org](https://nodejs.org/)

3. **Module Not Found**
   - Install dependencies: `npm install`
   - Check global installation: `npm list -g simple-config-diff`

## Contributing

The CLI tool is part of the SimpleConfigDiff project. See the main README for contribution guidelines.

## License

MIT License - see LICENSE file for details.
