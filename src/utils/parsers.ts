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
import { parseDockerCompose } from './parseDockerCompose';
import { parseKubernetes } from './parseKubernetes';
import { parseTemplate, detectTemplateFormat } from './parseTemplate';

export function detectFormat(filename: string, content: string): ConfigFormat {
  const ext = filename.split('.').pop()?.toLowerCase();
  const name = filename.toLowerCase();
  
  // Check for template files first
  const templateFormat = detectTemplateFormat(content, filename);
  if (templateFormat) {
    return templateFormat;
  }
  
  // Check for Docker Compose files
  if (name.includes('docker-compose') || name.includes('compose') || 
      name === 'docker-compose.yml' || name === 'docker-compose.yaml' ||
      name === 'compose.yml' || name === 'compose.yaml') {
    return 'yaml'; // Docker Compose files are YAML-based
  }
  
  // Check file extension
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
    case 'j2':
    case 'jinja':
    case 'jinja2':
      return 'jinja2';
    case 'hbs':
    case 'handlebars':
      return 'handlebars';
    case 'mustache':
      return 'mustache';
    case 'config':
    case 'conf':
      return 'config';
    default:
      return detectFormatByContent(content);
  }
}

function detectFormatByContent(content: string): ConfigFormat {
  const trimmed = content.trim();
  
  // Template detection
  if (trimmed.includes('{%') || trimmed.includes('{#') || trimmed.includes('|')) {
    return 'jinja2';
  }
  
  if (trimmed.includes('{{#') || trimmed.includes('{{!') || trimmed.includes('{{>')) {
    return 'handlebars';
  }
  
  if (trimmed.includes('{{') && trimmed.includes('}}') && !trimmed.includes('{%')) {
    return 'mustache';
  }
  
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

function isDockerComposeFile(filename: string, content: string): boolean {
  const name = filename.toLowerCase();
  
  // Check filename patterns
  if (name.includes('docker-compose') || name.includes('compose') || 
      name === 'docker-compose.yml' || name === 'docker-compose.yaml' ||
      name === 'compose.yml' || name === 'compose.yaml') {
    return true;
  }
  
  // Check content for Docker Compose indicators
  const trimmed = content.trim();
  if (trimmed.includes('version:') && 
      (trimmed.includes('services:') || trimmed.includes('networks:') || trimmed.includes('volumes:'))) {
    return true;
  }
  
  return false;
}

function isKubernetesFile(filename: string, content: string): boolean {
  const name = filename.toLowerCase();
  
  // Check filename patterns
  if (name.includes('k8s') || name.includes('kubernetes') || 
      name.includes('kube') || name.includes('manifest')) {
    return true;
  }
  
  // Check content for Kubernetes indicators
  const trimmed = content.trim();
  if (trimmed.includes('apiVersion:') && trimmed.includes('kind:')) {
    return true;
  }
  
  return false;
}

export function parseConfig(content: string, format: ConfigFormat, filename: string = ''): ParsedConfig {
  // Special handling for Docker Compose files
  if (format === 'yaml' && isDockerComposeFile(filename, content)) {
    return parseDockerCompose(content);
  }
  
  // Special handling for Kubernetes manifests
  if (format === 'yaml' && isKubernetesFile(filename, content)) {
    return parseKubernetes(content);
  }
  
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
    case 'jinja2':
    case 'handlebars':
    case 'mustache':
      const templateResult = parseTemplate(content, filename);
      return {
        data: templateResult ? templateResult.variables : {},
        format,
        error: templateResult ? undefined : 'Failed to parse template'
      };
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
  csv: 'CSV',
  jinja2: 'Jinja2',
  handlebars: 'Handlebars',
  mustache: 'Mustache'
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
  csv: '.csv',
  jinja2: '.j2/.jinja/.jinja2',
  handlebars: '.hbs/.handlebars',
  mustache: '.mustache'
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
    csv: 'Comma-Separated Values',
    jinja2: 'Jinja2 Template',
    handlebars: 'Handlebars Template',
    mustache: 'Mustache Template'
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
    csv: '📊',
    jinja2: '🔧',
    handlebars: '🔧',
    mustache: '🔧'
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
    '.config', '.conf',
    '.j2', '.jinja', '.jinja2',
    '.hbs', '.handlebars',
    '.mustache'
  ];
}

export function isSpecializedFormat(filename: string, content: string): { 
  isSpecialized: boolean; 
  type?: 'docker-compose' | 'kubernetes' | 'template'; 
  description?: string; 
} {
  // Check for templates
  const templateFormat = detectTemplateFormat(content, filename);
  if (templateFormat) {
    return {
      isSpecialized: true,
      type: 'template',
      description: `${templateFormat} template with variable extraction`
    };
  }
  
  // Check for Docker Compose
  if (isDockerComposeFile(filename, content)) {
    return {
      isSpecialized: true,
      type: 'docker-compose',
      description: 'Docker Compose file with semantic understanding'
    };
  }
  
  // Check for Kubernetes manifests
  if (isKubernetesFile(filename, content)) {
    return {
      isSpecialized: true,
      type: 'kubernetes',
      description: 'Kubernetes manifest with semantic understanding'
    };
  }
  
  return { isSpecialized: false };
}