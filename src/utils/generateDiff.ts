import * as deepDiff from 'deep-diff';
import { DiffChange, DiffOptions, ComparisonResult, ConfigFile } from '@/types';

export function flattenObject(obj: any, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(flattened, flattenObject(obj[key], newKey));
      } else {
        flattened[newKey] = obj[key];
      }
    }
  }
  
  return flattened;
}

export function unflattenObject(obj: Record<string, any>): any {
  const result: any = {};
  
  for (const key in obj) {
    const keys = key.split('.');
    let current = result;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = obj[key];
  }
  
  return result;
}

export function processObject(obj: any, options: DiffOptions): any {
  let processed = { ...obj };
  
  // Apply case sensitivity
  if (!options.caseSensitive) {
    const newObj: any = {};
    Object.keys(processed).forEach(key => {
      newObj[key.toLowerCase()] = processed[key];
    });
    processed = newObj;
  }
  
  // Remove ignored keys
  if (options.ignoreKeys.length > 0) {
    const filtered: any = {};
    Object.keys(processed).forEach(key => {
      const shouldIgnore = options.ignoreKeys.some(ignoreKey => 
        options.caseSensitive ? key === ignoreKey : key.toLowerCase() === ignoreKey.toLowerCase()
      );
      if (!shouldIgnore) {
        filtered[key] = processed[key];
      }
    });
    processed = filtered;
  }
  
  // Sort keys if requested
  if (options.sortKeys) {
    const sortedKeys = Object.keys(processed).sort();
    const sorted: any = {};
    sortedKeys.forEach(key => {
      sorted[key] = processed[key];
    });
    processed = sorted;
  }
  
  return processed;
}

export function getValueType(value: any): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function formatValue(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `\"${value}\"`;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.map(formatValue).join(', ')}]`;
    }
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function generateDiff(leftFile: ConfigFile, rightFile: ConfigFile, options: DiffOptions): ComparisonResult {
  // Process both objects according to options
  const leftData = processObject(leftFile.parsedContent, options);
  const rightData = processObject(rightFile.parsedContent, options);
  
  // Flatten if requested
  const leftProcessed = options.flattenKeys ? flattenObject(leftData) : leftData;
  const rightProcessed = options.flattenKeys ? flattenObject(rightData) : rightData;
  
  // Generate diff using deep-diff
  const differences = deepDiff.diff(leftProcessed, rightProcessed) || [];
  
  const changes: DiffChange[] = [];
  
  differences.forEach(diff => {
    const path = Array.isArray(diff.path) ? diff.path.join('.') : String(diff.path || '');
    
    switch (diff.kind) {
      case 'N': // New
        changes.push({
          path,
          type: 'added',
          newValue: diff.rhs,
          newType: getValueType(diff.rhs)
        });
        break;
        
      case 'D': // Deleted
        changes.push({
          path,
          type: 'removed',
          oldValue: diff.lhs,
          oldType: getValueType(diff.lhs)
        });
        break;
        
      case 'E': // Edited
        changes.push({
          path,
          type: 'changed',
          oldValue: diff.lhs,
          newValue: diff.rhs,
          oldType: getValueType(diff.lhs),
          newType: getValueType(diff.rhs)
        });
        break;
        
      case 'A': // Array change
        const arrayPath = path + `[${diff.index}]`;
        if (diff.item.kind === 'N') {
          changes.push({
            path: arrayPath,
            type: 'added',
            newValue: diff.item.rhs,
            newType: getValueType(diff.item.rhs)
          });
        } else if (diff.item.kind === 'D') {
          changes.push({
            path: arrayPath,
            type: 'removed',
            oldValue: diff.item.lhs,
            oldType: getValueType(diff.item.lhs)
          });
        } else if (diff.item.kind === 'E') {
          changes.push({
            path: arrayPath,
            type: 'changed',
            oldValue: diff.item.lhs,
            newValue: diff.item.rhs,
            oldType: getValueType(diff.item.lhs),
            newType: getValueType(diff.item.rhs)
          });
        }
        break;
    }
  });
  
  // Calculate summary
  const summary = {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    changed: changes.filter(c => c.type === 'changed').length,
    total: changes.length
  };
  
  return {
    changes: changes.sort((a, b) => a.path.localeCompare(b.path)),
    summary,
    leftFile,
    rightFile
  };
}