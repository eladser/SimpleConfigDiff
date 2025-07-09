import { ParsedConfig } from '@/types';

export function parseJSON(content: string): ParsedConfig {
  try {
    const data = JSON.parse(content);
    return {
      data,
      format: 'json'
    };
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}