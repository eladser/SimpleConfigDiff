import { ConfigFormat, ParsedConfig } from '@/types';
import { parseJSON } from './parseJSON';
import { parseYAML } from './parseYAML';
import { parseXML } from './parseXML';
import { parseINI } from './parseINI';
import { parseTOML } from './parseTOML';
import { parseENV } from './parseENV';
import { parseHCL } from './parseHCL';
import { parseProperties } from './parseProperties';

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
  properties: 'Properties'
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
  properties: '.properties'
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
    properties: 'Java Properties File'
  };
  
  return descriptions[format] || 'Unknown format';
}