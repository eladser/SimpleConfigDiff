import { ParsedConfig, ConfigFormat } from '@/types';

export function parseProperties(content: string): ParsedConfig {
  try {
    const lines = content.split('\n');
    const result: Record<string, any> = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
        continue;
      }
      
      // Handle key-value pairs with = or :
      const separatorMatch = trimmed.match(/^([^=:]+)([=:])(.*)$/);
      if (separatorMatch) {
        const [, key, , value] = separatorMatch;
        const cleanKey = key.trim();
        const cleanValue = value.trim();
        
        // Handle nested properties (dot notation)
        if (cleanKey.includes('.')) {
          setNestedProperty(result, cleanKey, parsePropertyValue(cleanValue));
        } else {
          result[cleanKey] = parsePropertyValue(cleanValue);
        }
      }
    }
    
    return {
      data: result,
      format: 'properties' as ConfigFormat
    };
  } catch (error) {
    return {
      data: {},
      format: 'properties' as ConfigFormat,
      error: error instanceof Error ? error.message : 'Failed to parse Properties'
    };
  }
}

function parsePropertyValue(value: string): any {
  // Remove leading/trailing whitespace
  const trimmed = value.trim();
  
  // Handle empty values
  if (!trimmed) return '';
  
  // Handle boolean values
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  
  // Handle numbers
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }
  
  if (/^\d+\.\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  
  // Handle arrays (comma-separated values)
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(item => parsePropertyValue(item.trim()));
  }
  
  // Handle escaped characters
  return trimmed
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\');
}

// Plain assignment to __proto__ would set the prototype instead of a key
function setOwn(obj: Record<string, any>, key: string, value: any): void {
  if (Object.hasOwn(obj, key)) {
    obj[key] = value;
  } else {
    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
  }
}

function setNestedProperty(obj: Record<string, any>, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  // Navigate to the parent object
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    
    if (!Object.hasOwn(current, key)) {
      setOwn(current, key, {});
    } else if (typeof current[key] !== 'object' || current[key] === null) {
      // If the property exists but is not an object, convert it to an object
      setOwn(current, key, {});
    }
    
    current = current[key];
  }
  
  // Set the final value
  setOwn(current, keys[keys.length - 1], value);
}