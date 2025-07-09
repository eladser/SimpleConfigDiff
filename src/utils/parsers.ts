import { ConfigFormat, ParsedConfig } from '@/types';
import { parseJSON } from './parseJSON';
import { parseYAML } from './parseYAML';
import { parseXML } from './parseXML';
import { parseINI } from './parseINI';
import { parseTOML } from './parseTOML';
import { parseENV } from './parseENV';

export function detectFormat(filename: string, content: string): ConfigFormat {
  // Try to detect by file extension first
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (extension === 'json') return 'json';
  if (extension === 'yaml' || extension === 'yml') return 'yaml';
  if (extension === 'xml') return 'xml';
  if (extension === 'config') return 'config';
  if (extension === 'ini') return 'ini';
  if (extension === 'toml') return 'toml';
  if (extension === 'env') return 'env';
  
  // Try to detect by content
  const trimmed = content.trim();
  
  // JSON detection
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return 'json';
  }
  
  // XML detection
  if (trimmed.startsWith('<') && trimmed.includes('</')) {
    return 'xml';
  }
  
  // YAML detection (key: value pattern)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*:\s*/.test(trimmed)) {
    return 'yaml';
  }
  
  // INI detection (sections with [header])
  if (/^\[.*\]$/m.test(trimmed)) {
    return 'ini';
  }
  
  // ENV detection (KEY=value pattern)
  if (/^[A-Z_][A-Z0-9_]*=/.test(trimmed)) {
    return 'env';
  }
  
  // TOML detection (key = value pattern)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(trimmed)) {
    return 'toml';
  }
  
  // Default to JSON
  return 'json';
}

export function parseConfig(content: string, format: ConfigFormat): ParsedConfig {
  try {
    switch (format) {
      case 'json':
        return parseJSON(content);
      case 'yaml':
        return parseYAML(content);
      case 'xml':
      case 'config':
        return parseXML(content);
      case 'ini':
        return parseINI(content);
      case 'toml':
        return parseTOML(content);
      case 'env':
        return parseENV(content);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  } catch (error) {
    return {
      data: {},
      format,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

export function getFormatLabel(format: ConfigFormat): string {
  const labels: Record<ConfigFormat, string> = {
    json: 'JSON',
    yaml: 'YAML',
    xml: 'XML',
    config: '.config',
    ini: 'INI',
    toml: 'TOML',
    env: 'ENV'
  };
  return labels[format];
}

export function getFormatIcon(format: ConfigFormat): string {
  const icons: Record<ConfigFormat, string> = {
    json: '{}',
    yaml: '📄',
    xml: '</>',
    config: '⚙️',
    ini: '📝',
    toml: '🔧',
    env: '🌍'
  };
  return icons[format];
}

export function getSupportedExtensions(): string[] {
  return ['.json', '.yaml', '.yml', '.xml', '.config', '.ini', '.toml', '.env'];
}