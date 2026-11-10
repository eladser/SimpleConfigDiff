#!/usr/bin/env node

/**
 * SimpleConfigDiff CLI Tool
 * Command-line interface for comparing configuration files
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { version } = require('../package.json');

// Configuration formats mapping
const FORMAT_EXTENSIONS = {
  json: ['.json'],
  yaml: ['.yaml', '.yml'],
  xml: ['.xml'],
  ini: ['.ini'],
  toml: ['.toml'],
  env: ['.env'],
  hcl: ['.hcl', '.tf'],
  properties: ['.properties'],
  csv: ['.csv'],
  config: ['.config', '.conf']
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

// Set once options are parsed. Each stream only gets color when it's a terminal.
let colorOut = false;
let colorErr = false;

/**
 * Colorize text for terminal output
 */
function colorize(text, color, on = colorOut) {
  if (!on) return text;
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Show control characters (C0, DEL, C1) as escapes. Keys, values and parser
 * messages come from files that may not be ours, and raw ESC bytes would
 * drive the terminal. Newlines stay real only for multi-line parser errors.
 */
function printable(text, keepNewlines = false) {
  return String(text).replace(/[\x00-\x1f\x7f-\x9f]/g, (c) => {
    if (c === '\n') return keepNewlines ? c : '\\n';
    if (c === '\t') return '\\t';
    return '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0');
  });
}

/**
 * A value as table and CSV cells show it. Only a missing side is blank, so
 * false, 0 and null still read as values and "" shows as "". Objects go
 * through JSON since INI sections and TOML tables have no toString.
 */
function cellText(v) {
  if (v === undefined) return '';
  if (v === '') return '""';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Detect file format based on extension
 */
function detectFormat(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  for (const [format, extensions] of Object.entries(FORMAT_EXTENSIONS)) {
    if (extensions.includes(ext)) {
      return format;
    }
  }
  
  return 'unknown';
}

/**
 * Parse configuration file content
 */
function parseConfig(content, format) {
  try {
    switch (format) {
      case 'json':
        return JSON.parse(content);
      case 'yaml':
        return require('js-yaml').load(content) || {};
      case 'xml': {
        const { XMLParser } = require('fast-xml-parser');
        return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(content);
      }
      case 'ini':
      case 'config':
        return require('ini').parse(content);
      case 'toml':
        return require('smol-toml').parse(content);
      case 'hcl':
      case 'env':
      case 'properties': {
        // key=value lines; # and ; comments
        const obj = {};
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) return;
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            obj[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          }
        });
        return obj;
      }
      default:
        return { content };
    }
  } catch (error) {
    throw new Error(`Failed to parse ${format} file: ${error.message}`);
  }
}

/**
 * Fold strings for --ignore-case and --ignore-whitespace the way the web app's
 * case and whitespace options do. Other types compare as they are.
 */
function fold(value, options) {
  if (typeof value !== 'string') return value;
  let v = value;
  if (options.ignoreWhitespace) v = v.trim().replace(/\s+/g, ' ');
  if (options.ignoreCase) v = v.toLowerCase();
  return v;
}

/**
 * Turn an --ignore pattern into a regex with the same rules as the web app's
 * glob path rules (PathMatcher.globMatch in src/utils/advancedComparison.ts):
 * * stays inside one segment, ** crosses segments, ? is one non-dot character.
 * Array items are segments too, so tags.0 or servers.*.host.
 */
function globToRegExp(pattern) {
  const DOUBLE_STAR = '\x00';
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .split('**').join(DOUBLE_STAR)
    .replace(/\*/g, '[^.]*')
    .split(DOUBLE_STAR).join('.*')
    .replace(/\?/g, '[^.]');
  return new RegExp(`^${re}$`);
}

// Same rule as isSecretKey in src/utils/maskSecrets.ts, keep the two in step.
// A term counts when it ends a word, so dbPassword, AUTH_TOKEN and tokens.0
// match while author, authority, secretary and tokenizer don't.
const SECRET_KEY = /(password|passwd|pwd|secret|token|api[-_]?key|private[-_]?key|credential|auth)s?(?![a-z])/g;
// A token key with any of these words in it is a count (max_output_tokens, tokenLimit)
const COUNT_WORDS = /^(max|min|num|total|count|limit|per|budget|usage|length|size)$/;
const MASK = '\u2022'.repeat(6);

/**
 * Takes a key or a dotted path. A path is secret when any key on it is,
 * which masks everything under a secret key too.
 */
function isSecretKey(key) {
  // Quick way out for most keys: every term above has one of these in it
  if (!/pass|pwd|secret|token|key|credential|auth/.test(String(key).toLowerCase().replaceAll('\0', ''))) return false;
  return String(key).split('.').some((seg) => {
    // a bare PWD is the shell's working directory
    if (seg.toLowerCase() === 'pwd') return false;
    const low = seg
      .replace(/([a-z\d])([A-Z])/g, '$1\0$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1\0$2')
      .toLowerCase();
    const counted = low.split(/[^a-z\d]+/).some((w) => COUNT_WORDS.test(w));
    // Test the key up to each camelCase break with the breaks taken out, so a
    // term can run across one (PassWord) but still has to end a word
    const words = low.split('\0');
    return words.some((_, i) =>
      [...words.slice(0, i + 1).join('').matchAll(SECRET_KEY)].some((m) => m[1] !== 'token' || !counted));
  });
}

/**
 * Only arrays and plain objects get walked, null-prototype ones too (INI
 * sections, TOML tables). Dates and other class values pass through.
 */
function walkable(v) {
  if (v === null || typeof v !== 'object') return false;
  const p = Object.getPrototypeOf(v);
  return Array.isArray(v) || p === Object.prototype || p === null;
}

function hasSecrets(value) {
  return walkable(value) && Object.entries(value).some(([k, v]) => isSecretKey(k) || hasSecrets(v));
}

/**
 * Swap values under secret keys for dots, nested ones included. Missing and
 * null values stay as they are, and a value with nothing secret under it
 * comes back as the same value.
 */
function maskValue(value, key) {
  if (value === null || value === undefined) return value;
  if (isSecretKey(key)) return MASK;
  if (!hasSecrets(value)) return value;
  if (Array.isArray(value)) return value.map((v) => maskValue(v, ''));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskValue(v, k)]));
}

const RC_FILE = '.configdiffrc.json';

/**
 * Ignore patterns from .configdiffrc.json in the working directory, if there is one
 */
function readRc() {
  const file = path.join(process.cwd(), RC_FILE);
  if (!fs.existsSync(file)) return [];

  let rc;
  try {
    // PowerShell 5.1 writes UTF-8 with a BOM
    rc = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`Can't read ${RC_FILE}: ${printable(error.message)}`);
  }
  if (!rc || !Array.isArray(rc.ignore) || !rc.ignore.every((p) => typeof p === 'string')) {
    throw new Error(`${RC_FILE} should look like { "ignore": ["pattern", ...] }`);
  }
  return rc.ignore;
}

/**
 * Compare two configuration objects
 */
function compareConfigs(left, right, path = '', options = {}) {
  const changes = [];
  
  // Get all unique keys
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
    // an ignored path takes its whole subtree with it, added and removed keys too
    if ((options.ignoreRules || []).some((re) => re.test(currentPath))) continue;

    const leftValue = left[key];
    const rightValue = right[key];
    
    if (!(key in left)) {
      changes.push({
        path: currentPath,
        type: 'added',
        oldValue: undefined,
        newValue: rightValue
      });
    } else if (!(key in right)) {
      changes.push({
        path: currentPath,
        type: 'removed',
        oldValue: leftValue,
        newValue: undefined
      });
    } else if (typeof leftValue === 'object' && typeof rightValue === 'object' && 
               leftValue !== null && rightValue !== null) {
      // Recursively compare objects
      changes.push(...compareConfigs(leftValue, rightValue, currentPath, options));
    } else if (fold(leftValue, options) !== fold(rightValue, options)) {
      changes.push({
        path: currentPath,
        type: 'changed',
        oldValue: leftValue,
        newValue: rightValue
      });
    }
  }
  
  return changes;
}

/**
 * Format output for different export formats
 */
function formatOutput(changes, format, options) {
  const on = colorOut && !options.outputFile;

  switch (format) {
    case 'json':
      return JSON.stringify(changes, null, 2);
    
    case 'csv': {
      const cell = (s) => `"${printable(s).replace(/"/g, '""')}"`;
      const csvHeader = 'Path,Type,Old Value,New Value\n';
      const csvRows = changes.map(change =>
        [cell(change.path), cell(change.type), cell(cellText(change.oldValue)), cell(cellText(change.newValue))].join(',')
      ).join('\n');
      return csvHeader + csvRows;
    }
    
    case 'table':
      // Simple table format for terminal
      const maxPathLength = Math.max(...changes.map(c => printable(c.path).length), 4);
      const maxTypeLength = Math.max(...changes.map(c => c.type.length), 4);
      
      let table = '';
      table += `${'Path'.padEnd(maxPathLength)} | ${'Type'.padEnd(maxTypeLength)} | Old Value | New Value\n`;
      table += `${'-'.repeat(maxPathLength)} | ${'-'.repeat(maxTypeLength)} | --------- | ---------\n`;
      
      changes.forEach(change => {
        const typeColor = change.type === 'added' ? 'green' : 
                         change.type === 'removed' ? 'red' : 'yellow';
        table += `${printable(change.path).padEnd(maxPathLength)} | ${colorize(change.type.padEnd(maxTypeLength), typeColor, on)} | ${printable(cellText(change.oldValue))} | ${printable(cellText(change.newValue))}\n`;
      });
      
      return table;
    
    case 'summary':
      const summary = changes.reduce((acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      }, {});
      
      return `
${colorize('Configuration Diff Summary', 'bright', on)}
${colorize('='.repeat(30), 'dim', on)}
${colorize('Added:', 'green', on)} ${summary.added || 0}
${colorize('Removed:', 'red', on)} ${summary.removed || 0}
${colorize('Changed:', 'yellow', on)} ${summary.changed || 0}
${colorize('Total:', 'bright', on)} ${changes.length}
      `.trim();
    
    default:
      return JSON.stringify(changes, null, 2);
  }
}

/**
 * Main comparison function
 */
async function compareFiles(leftPath, rightPath, options) {
  // Read files
  const leftContent = fs.readFileSync(leftPath, 'utf8');
  const rightContent = fs.readFileSync(rightPath, 'utf8');

  // Detect formats
  const leftFormat = options.format || detectFormat(leftPath);
  const rightFormat = options.format || detectFormat(rightPath);

  if (leftFormat !== rightFormat && !options.force) {
    throw new Error(`File formats differ (${leftFormat} vs ${rightFormat}). Use --force to compare anyway.`);
  }

  // Parse configurations
  const leftConfig = parseConfig(leftContent, leftFormat);
  const rightConfig = parseConfig(rightContent, rightFormat);

  // Compare
  const changes = compareConfigs(leftConfig, rightConfig, '', options);

  // Output results. Masking is display only, the comparison above saw the real values.
  const shown = options.showSecrets ? changes : changes.map((c) => ({
    ...c,
    oldValue: maskValue(c.oldValue, c.path),
    newValue: maskValue(c.newValue, c.path)
  }));
  const output = formatOutput(shown, options.output, options);

  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, output);
    console.log(colorize(`Results written to ${printable(options.outputFile)}`, 'green'));
  } else {
    console.log(output);
  }

  return changes.length;
}

/**
 * Watch files for changes
 */
function watchFiles(leftPath, rightPath, options) {
  console.log(colorize(`Watching ${printable(leftPath)} and ${printable(rightPath)} for changes...`, 'cyan'));

  const recompare = (filename) => {
    console.log(colorize(`File ${printable(filename)} changed, recomparing...`, 'yellow'));
    compareFiles(leftPath, rightPath, options).catch((error) => {
      console.error(colorize(`Error: ${printable(error.message, true)}`, 'red', colorErr));
    });
  };

  // Watch each file's directory; both files can live in different places
  const dirs = [...new Set([path.dirname(leftPath), path.dirname(rightPath)])];
  const names = [path.basename(leftPath), path.basename(rightPath)];
  const watchers = dirs.map((dir) =>
    fs.watch(dir, { recursive: false }, (eventType, filename) => {
      if (names.includes(filename)) recompare(filename);
    })
  );

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(colorize('\nStopping file watcher...', 'cyan'));
    watchers.forEach((w) => w.close());
    process.exit(0);
  });
}

// CLI Setup
program
  .name('configdiff')
  .description('Compare configuration files and output differences')
  .version(version)
  .argument('<left-file>', 'Left configuration file to compare')
  .argument('<right-file>', 'Right configuration file to compare')
  .option('-f, --format <format>', 'Force specific format (json, yaml, xml, ini, toml, env, properties)')
  .option('-o, --output <format>', 'Output format (json, csv, table, summary)', 'table')
  .option('-w, --watch', 'Watch files for changes and recompare')
  .option('--output-file <file>', 'Write output to file instead of stdout')
  .option('--force', 'Force comparison even if file formats differ')
  .option('--no-color', 'Disable colored output')
  .option('--ignore-case', 'Ignore case when comparing values')
  .option('--ignore-whitespace', 'Ignore whitespace differences')
  .option('--ignore <pattern>', 'Ignore a path or glob like build.* or **.password (repeatable)', (p, prev = []) => [...prev, p])
  .option('--show-secrets', 'Print values under keys like password, token or api_key instead of masking them')
  .action(async (leftFile, rightFile, options) => {
    // https://no-color.org: any non-empty NO_COLOR turns color off
    const color = options.color && !process.env.NO_COLOR;
    colorOut = color && Boolean(process.stdout.isTTY);
    colorErr = color && Boolean(process.stderr.isTTY);

    // Validate files exist
    if (!fs.existsSync(leftFile)) {
      console.error(colorize(`Error: Left file '${printable(leftFile)}' does not exist`, 'red', colorErr));
      process.exit(1);
    }
    
    if (!fs.existsSync(rightFile)) {
      console.error(colorize(`Error: Right file '${printable(rightFile)}' does not exist`, 'red', colorErr));
      process.exit(1);
    }
    
    // Validate output format
    const validOutputFormats = ['json', 'csv', 'table', 'summary'];
    if (!validOutputFormats.includes(options.output)) {
      console.error(colorize(`Error: Invalid output format '${printable(options.output)}'. Valid formats: ${validOutputFormats.join(', ')}`, 'red', colorErr));
      process.exit(1);
    }
    
    // Start comparison
    try {
      options.ignoreRules = [...readRc(), ...(options.ignore || [])].map(globToRegExp);

      if (options.watch) {
        await compareFiles(leftFile, rightFile, options).catch((error) => {
          console.error(colorize(`Error: ${printable(error.message, true)}`, 'red', colorErr));
        });
        watchFiles(leftFile, rightFile, options);
      } else {
        const diffCount = await compareFiles(leftFile, rightFile, options);
        process.exit(diffCount > 0 ? 1 : 0);
      }
    } catch (error) {
      console.error(colorize(`Error: ${printable(error.message, true)}`, 'red', colorErr));
      process.exit(1);
    }
  });

// Add help examples
program.addHelpText('after', `
Examples:
  configdiff config1.json config2.json
  configdiff app.yml prod.yml -o summary
  configdiff .env.local .env.prod --output json --output-file diff.json
  configdiff terraform.tf terraform.prod.tf --watch
  configdiff package.json package-lock.json --force
  configdiff a.json b.json --ignore version --ignore 'build.*'

Ignore patterns can also live in ${RC_FILE} in the working directory:
  { "ignore": ["version", "build.*"] }
`);

program.parse();
