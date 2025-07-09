import * as ini from 'ini';
import { ParsedConfig } from '@/types';

export function parseINI(content: string): ParsedConfig {
  try {
    const data = ini.parse(content);
    
    // Convert boolean strings to actual booleans
    const convertValues = (obj: any): any => {
      if (typeof obj === 'string') {
        if (obj.toLowerCase() === 'true') return true;
        if (obj.toLowerCase() === 'false') return false;
        if (/^\d+$/.test(obj)) return parseInt(obj, 10);
        if (/^\d+\.\d+$/.test(obj)) return parseFloat(obj);
        return obj;
      }
      
      if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = convertValues(value);
        }
        return result;
      }
      
      return obj;
    };
    
    return {
      data: convertValues(data),
      format: 'ini'
    };
  } catch (error) {
    throw new Error(`Invalid INI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}