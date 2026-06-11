import * as yaml from 'js-yaml';
import { ParsedConfig } from '@/types';

export function parseYAML(content: string): ParsedConfig {
  try {
    const data = yaml.load(content) as Record<string, any>;
    return {
      data: data || {},
      format: 'yaml'
    };
  } catch (error) {
    throw new Error(`Invalid YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}