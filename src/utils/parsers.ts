import { ConfigFormat, ParsedConfig } from '@/types';
import { parseJSON } from './parseJSON';
import { parseYAML } from './parseYAML';
import { parseXML } from './parseXML';
import { parseINI } from './parseINI';
import { parseTOML } from './parseTOML';
import { parseENV } from './parseENV';
import { parseHCL } from './parseHCL';
import { parseProperties } from './parseProperties';
import { parseCSV } from './parseCSV';

export function detectFormat(filename: string, content: string): ConfigFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // Check file extension first
  switch (ext) {
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'xml':
      return 'xml';
    case 'ini':
      return 'ini';
    case 'toml':
      return 'toml';
    case 'env':
      return 'env';
    case 'hcl':
    case 'tf':
      return 'hcl';
    case 'properties':
      return 'properties';
    case 'csv':
      return 'csv';
    case 'config':
    case 'conf':
      return 'config';
    default:
      return detectFormatByContent(content);
  }
}

function detectFormatByContent(content: string): ConfigFormat {
  const trimmed = content.trim();
  
  // JSON detection
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not JSON, continue
    }
  }
  
  // XML detection
  if (trimmed.startsWith('<') && trimmed.includes('>')) {
    return 'xml';
  }
  
  // CSV detection (simple heuristic)
  const lines = trimmed.split('\n');
  if (lines.length > 1) {
    const firstLine = lines[0];
    const delimiters = [',', ';', '\t', '|'];
    
    for (const delimiter of delimiters) {
      if (firstLine.includes(delimiter)) {
        // Check if multiple lines have the same delimiter pattern
        const firstCount = firstLine.split(delimiter).length;
        const consistentLines = lines.slice(1, Math.min(5, lines.length))
          .filter(line => Math.abs(line.split(delimiter).length - firstCount) <= 1);
        
        if (consistentLines.length >= Math.min(2, lines.length - 1)) {
          return 'csv';
        }
      }
    }
  }
  
  // YAML detection (common patterns)
  if (trimmed.includes('---') || 
      /^[a-zA-Z_][a-zA-Z0-9_]*\s*:\s*/.test(trimmed) ||
      /^\s*-\s+/.test(trimmed)) {
    return 'yaml';
  }
  
  // HCL detection (Terraform patterns)
  if (trimmed.includes('resource "') || 
      trimmed.includes('provider "') ||
      trimmed.includes('variable "') ||
      trimmed.includes('data "')) {
    return 'hcl';
  }
  
  // Properties detection
  if (/^[^=:]+[=:]/.test(trimmed) && !trimmed.includes('[')) {
    return 'properties';
  }
  
  // INI detection
  if (trimmed.includes('[') && trimmed.includes(']') && trimmed.includes('=')) {
    return 'ini';
  }
  
  // TOML detection
  if (trimmed.includes('[[') || 
      (trimmed.includes('[') && trimmed.includes('=') && trimmed.includes('"'))) {
    return 'toml';
  }
  
  // ENV detection
  if (/^[A-Z_][A-Z0-9_]*=/.test(trimmed)) {
    return 'env';
  }
  
  // Default to config
  return 'config';
}

export function parseConfig(content: string, format: ConfigFormat): ParsedConfig {
  switch (format) {
    case 'json':
      return parseJSON(content);
    case 'yaml':
      return parseYAML(content);
    case 'xml':
      return parseXML(content);
    case 'ini':
      return parseINI(content);
    case 'toml':
      return parseTOML(content);
    case 'env':
      return parseENV(content);
    case 'hcl':
      return parseHCL(content);
    case 'properties':
      return parseProperties(content);
    case 'csv':
      return parseCSV(content);
    case 'config':
      return parseINI(content); // Default to INI for generic config files
    default:
      return {
        data: {},
        format,
        error: `Unsupported format: ${format}`
      };
  }
}

export const formatNames: Record<ConfigFormat, string> = {
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  config: 'Config',
  ini: 'INI',
  toml: 'TOML',
  env: 'Environment',
  hcl: 'HCL/Terraform',
  properties: 'Properties',
  csv: 'CSV'
};

export const formatExtensions: Record<ConfigFormat, string> = {
  json: '.json',
  yaml: '.yaml/.yml',
  xml: '.xml',
  config: '.config/.conf',
  ini: '.ini',
  toml: '.toml',
  env: '.env',
  hcl: '.hcl/.tf',
  properties: '.properties',
  csv: '.csv'
};

export function getFormatDescription(format: ConfigFormat): string {
  const descriptions: Record<ConfigFormat, string> = {
    json: 'JavaScript Object Notation',
    yaml: 'YAML Ain\'t Markup Language',
    xml: 'eXtensible Markup Language',
    config: 'Generic Configuration File',
    ini: 'Initialization File',
    toml: 'Tom\'s Obvious, Minimal Language',
    env: 'Environment Variables',
    hcl: 'HashiCorp Configuration Language',
    properties: 'Java Properties File',
    csv: 'Comma-Separated Values'
  };
  
  return descriptions[format] || 'Unknown format';
}

// Add missing exports that are being used in components
export function getFormatLabel(format: ConfigFormat): string {
  return formatNames[format] || format.toUpperCase();
}

export function getFormatIcon(format: ConfigFormat): string {
  const icons: Record<ConfigFormat, string> = {
    json: '{}',
    yaml: '📄',
    xml: '</>',
    config: '⚙️',
    ini: '📝',
    toml: '🔧',
    env: '🌍',
    hcl: '🏗️',
    properties: '☕',
    csv: '📊'
  };
  
  return icons[format] || '📄';
}

export function getSupportedExtensions(): string[] {
  return [
    '.json',
    '.yaml', '.yml',
    '.xml',
    '.ini',
    '.toml',
    '.env',
    '.hcl', '.tf',
    '.properties',
    '.csv',
    '.config', '.conf'
  ];
}