import { ParsedConfig, ConfigFormat } from '@/types';

export function parseHCL(content: string): ParsedConfig {
  try {
    // Simple HCL parser - basic implementation
    // In a real app, you'd use a proper HCL parser library
    const lines = content.split('\n');
    const result: Record<string, any> = {};
    let currentSection = result;
    const sectionStack: any[] = [result];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }
      
      // Handle blocks like: resource "aws_instance" "example" {
      const blockMatch = trimmed.match(/^(\w+)\s+"?([^"]+)"?\s*"?([^"]*)"?\s*{?/);
      if (blockMatch) {
        const [, blockType, name, identifier] = blockMatch;
        
        if (!currentSection[blockType]) {
          currentSection[blockType] = {};
        }
        
        let blockKey = name;
        if (identifier) {
          blockKey = `${name}.${identifier}`;
        }
        
        currentSection[blockType][blockKey] = {};
        sectionStack.push(currentSection[blockType][blockKey]);
        currentSection = currentSection[blockType][blockKey];
        continue;
      }
      
      // Handle closing braces
      if (trimmed === '}') {
        sectionStack.pop();
        currentSection = sectionStack[sectionStack.length - 1];
        continue;
      }
      
      // Handle key-value pairs
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        currentSection[key] = parseHCLValue(value);
        continue;
      }
      
      // Handle simple assignments
      const simpleMatch = trimmed.match(/^(\w+)\s+(.+)$/);
      if (simpleMatch) {
        const [, key, value] = simpleMatch;
        currentSection[key] = parseHCLValue(value);
      }
    }
    
    return {
      data: result,
      format: 'hcl' as ConfigFormat
    };
  } catch (error) {
    return {
      data: {},
      format: 'hcl' as ConfigFormat,
      error: error instanceof Error ? error.message : 'Failed to parse HCL'
    };
  }
}

function parseHCLValue(value: string): any {
  const trimmed = value.trim();
  
  // Remove trailing comma if present
  const cleanValue = trimmed.replace(/,$/, '');
  
  // Boolean values
  if (cleanValue === 'true') return true;
  if (cleanValue === 'false') return false;
  
  // Numbers
  if (/^\d+$/.test(cleanValue)) {
    return parseInt(cleanValue, 10);
  }
  
  if (/^\d+\.\d+$/.test(cleanValue)) {
    return parseFloat(cleanValue);
  }
  
  // Arrays
  if (cleanValue.startsWith('[') && cleanValue.endsWith(']')) {
    const arrayContent = cleanValue.slice(1, -1);
    if (!arrayContent.trim()) return [];
    
    return arrayContent.split(',').map(item => parseHCLValue(item.trim()));
  }
  
  // Objects
  if (cleanValue.startsWith('{') && cleanValue.endsWith('}')) {
    const objectContent = cleanValue.slice(1, -1);
    const obj: Record<string, any> = {};
    
    // Simple object parsing (would need more sophisticated parsing for complex objects)
    const pairs = objectContent.split(',');
    for (const pair of pairs) {
      const [key, val] = pair.split(':').map(s => s.trim());
      if (key && val) {
        obj[key.replace(/"/g, '')] = parseHCLValue(val);
      }
    }
    
    return obj;
  }
  
  // Strings (remove quotes)
  if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
      (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
    return cleanValue.slice(1, -1);
  }
  
  // Default: return as string
  return cleanValue;
}