# SimpleConfigDiff CLI Tool

A command-line interface for comparing configuration files with support for multiple formats.

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

- `-f, --format <format>` - Force specific format (json, yaml, xml, ini, toml, env, properties)
- `-o, --output <format>` - Output format (json, csv, table, summary) [default: table]
- `-w, --watch` - Watch files for changes and recompare
- `--output-file <file>` - Write output to file instead of stdout
- `--force` - Force comparison even if file formats differ
- `--no-color` - Disable colored output
- `--ignore-case` - Ignore case when comparing values
- `--ignore-whitespace` - Ignore whitespace differences

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
- **Format mismatch**: `Warning: File formats differ (json vs yaml). Use --force to compare anyway.`
- **Parse errors**: `Error: Failed to parse json file: Unexpected token`
- **Invalid options**: `Error: Invalid output format 'xml'. Valid formats: json, csv, table, summary`

## Advanced Features

### Ignore Patterns
```bash
# Ignore case differences
configdiff config1.json config2.json --ignore-case

# Ignore whitespace differences
configdiff config1.yml config2.yml --ignore-whitespace
```

### Format Detection
The tool automatically detects file formats based on extensions, but you can override:

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

### Debug Mode
Set DEBUG environment variable for verbose output:
```bash
DEBUG=configdiff configdiff file1.json file2.json
```

## Contributing

The CLI tool is part of the SimpleConfigDiff project. See the main README for contribution guidelines.

## License

MIT License - see LICENSE file for details.
