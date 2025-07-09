import { ParsedConfig } from '@/types';

export function parseENV(content: string): ParsedConfig {
  try {
    const data: Record<string, string> = {};
    const lines = content.split('\\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      // Find the first = sign
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        continue; // Skip malformed lines
      }
      
      const key = trimmed.substring(0, equalIndex).trim();
      let value = trimmed.substring(equalIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith(\"'\") && value.endsWith(\"'\"))) {
        value = value.slice(1, -1);
      }
      
      // Convert common boolean and number values
      if (value.toLowerCase() === 'true') {
        data[key] = true as any;
      } else if (value.toLowerCase() === 'false') {
        data[key] = false as any;
      } else if (/^\\d+$/.test(value)) {
        data[key] = parseInt(value, 10) as any;
      } else if (/^\\d+\\.\\d+$/.test(value)) {
        data[key] = parseFloat(value) as any;
      } else {
        data[key] = value;
      }
    }
    
    return {
      data,
      format: 'env'
    };
  } catch (error) {
    throw new Error(`Invalid ENV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}