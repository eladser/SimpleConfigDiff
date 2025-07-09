import * as toml from '@iarna/toml';
import { ParsedConfig } from '@/types';

export function parseTOML(content: string): ParsedConfig {
  try {
    const data = toml.parse(content);
    return {
      data,
      format: 'toml'
    };
  } catch (error) {
    throw new Error(`Invalid TOML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}