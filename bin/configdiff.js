#!/usr/bin/env node

/**
 * SimpleConfigDiff CLI Tool
 * Command-line interface for comparing configuration files
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');

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

/**
 * Colorize text for terminal output
 */
function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
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
        // Would need yaml parser in real implementation
        return JSON.parse(content); // Fallback
      case 'xml':
        // Would need xml parser in real implementation
        return { content }; // Fallback
      case 'ini':
        // Would need ini parser in real implementation
        return { content }; // Fallback
      case 'toml':
        // Would need toml parser in real implementation
        return { content }; // Fallback
      case 'env':
        // Parse environment variables
        const env = {};
        content.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim();
          }
        });
        return env;
      case 'properties':
        // Parse properties files
        const props = {};
        content.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            props[key.trim()] = valueParts.join('=').trim();
          }
        });
        return props;
      default:
        return { content };
    }
  } catch (error) {
    throw new Error(`Failed to parse ${format} file: ${error.message}`);
  }
}

/**
 * Compare two configuration objects
 */
function compareConfigs(left, right, path = '') {
  const changes = [];
  
  // Get all unique keys
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  
  for (const key of allKeys) {
    const currentPath = path ? `${path}.${key}` : key;
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
      changes.push(...compareConfigs(leftValue, rightValue, currentPath));
    } else if (leftValue !== rightValue) {
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
  switch (format) {
    case 'json':
      return JSON.stringify(changes, null, 2);
    
    case 'csv':
      const csvHeader = 'Path,Type,Old Value,New Value\n';
      const csvRows = changes.map(change => 
        `"${change.path}","${change.type}","${change.oldValue || ''}","${change.newValue || ''}"`
      ).join('\n');
      return csvHeader + csvRows;
    
    case 'table':
      // Simple table format for terminal
      const maxPathLength = Math.max(...changes.map(c => c.path.length), 4);
      const maxTypeLength = Math.max(...changes.map(c => c.type.length), 4);
      
      let table = '';
      table += `${'Path'.padEnd(maxPathLength)} | ${'Type'.padEnd(maxTypeLength)} | Old Value | New Value\n`;
      table += `${'-'.repeat(maxPathLength)} | ${'-'.repeat(maxTypeLength)} | --------- | ---------\n`;
      
      changes.forEach(change => {
        const typeColor = change.type === 'added' ? 'green' : 
                         change.type === 'removed' ? 'red' : 'yellow';
        table += `${change.path.padEnd(maxPathLength)} | ${colorize(change.type.padEnd(maxTypeLength), typeColor)} | ${change.oldValue || ''} | ${change.newValue || ''}\n`;
      });
      
      return table;
    
    case 'summary':
      const summary = changes.reduce((acc, change) => {
        acc[change.type] = (acc[change.type] || 0) + 1;
        return acc;
      }, {});
      
      return `
${colorize('Configuration Diff Summary', 'bright')}
${colorize('='.repeat(30), 'dim')}
${colorize('Added:', 'green')} ${summary.added || 0}
${colorize('Removed:', 'red')} ${summary.removed || 0}
${colorize('Changed:', 'yellow')} ${summary.changed || 0}
${colorize('Total:', 'bright')} ${changes.length}
      `.trim();
    
    default:
      return JSON.stringify(changes, null, 2);
  }
}

/**
 * Main comparison function
 */
async function compareFiles(leftPath, rightPath, options) {
  try {
    // Read files
    const leftContent = fs.readFileSync(leftPath, 'utf8');
    const rightContent = fs.readFileSync(rightPath, 'utf8');
    
    // Detect formats
    const leftFormat = options.format || detectFormat(leftPath);
    const rightFormat = options.format || detectFormat(rightPath);
    
    if (leftFormat !== rightFormat && !options.force) {
      console.warn(colorize(`Warning: File formats differ (${leftFormat} vs ${rightFormat}). Use --force to compare anyway.`, 'yellow'));
      process.exit(1);
    }
    
    // Parse configurations
    const leftConfig = parseConfig(leftContent, leftFormat);
    const rightConfig = parseConfig(rightContent, rightFormat);
    
    // Compare
    const changes = compareConfigs(leftConfig, rightConfig);
    
    // Output results
    const output = formatOutput(changes, options.output, options);
    
    if (options.outputFile) {
      fs.writeFileSync(options.outputFile, output);
      console.log(colorize(`Results written to ${options.outputFile}`, 'green'));
    } else {
      console.log(output);
    }
    
    // Exit with appropriate code
    process.exit(changes.length > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(colorize(`Error: ${error.message}`, 'red'));
    process.exit(1);
  }
}

/**
 * Watch files for changes
 */
function watchFiles(leftPath, rightPath, options) {
  console.log(colorize(`Watching ${leftPath} and ${rightPath} for changes...`, 'cyan'));
  
  const watcher = fs.watch(path.dirname(leftPath), { recursive: false }, (eventType, filename) => {
    if (filename === path.basename(leftPath) || filename === path.basename(rightPath)) {
      console.log(colorize(`File ${filename} changed, recomparing...`, 'yellow'));
      compareFiles(leftPath, rightPath, options);
    }
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(colorize('\nStopping file watcher...', 'cyan'));
    watcher.close();
    process.exit(0);
  });
}

// CLI Setup
program
  .name('configdiff')
  .description('Compare configuration files and output differences')
  .version('1.0.0')
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
  .action(async (leftFile, rightFile, options) => {
    // Validate files exist
    if (!fs.existsSync(leftFile)) {
      console.error(colorize(`Error: Left file '${leftFile}' does not exist`, 'red'));
      process.exit(1);
    }
    
    if (!fs.existsSync(rightFile)) {
      console.error(colorize(`Error: Right file '${rightFile}' does not exist`, 'red'));
      process.exit(1);
    }
    
    // Validate output format
    const validOutputFormats = ['json', 'csv', 'table', 'summary'];
    if (!validOutputFormats.includes(options.output)) {
      console.error(colorize(`Error: Invalid output format '${options.output}'. Valid formats: ${validOutputFormats.join(', ')}`, 'red'));
      process.exit(1);
    }
    
    // Start comparison
    if (options.watch) {
      // Initial comparison
      await compareFiles(leftFile, rightFile, options);
      // Start watching
      watchFiles(leftFile, rightFile, options);
    } else {
      await compareFiles(leftFile, rightFile, options);
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
`);

program.parse();
