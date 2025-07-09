import { DiffChange, DiffOptions, ComparisonResult, ConfigFile } from '@/types';
import { SemanticComparator, PathMatcher, ValueTransformer, DiffSeverityAnalyzer, DiffStatistics } from './advancedComparison';
import { generateUnifiedDiff } from './unifiedDiff';

// Simple diff implementation to avoid deep-diff dependency issues
interface SimpleDiff {
  kind: 'N' | 'D' | 'E' | 'A';
  path?: string[];
  lhs?: any;
  rhs?: any;
  index?: number;
  item?: SimpleDiff;
}

class AdvancedDiffGenerator {
  private semanticComparator: SemanticComparator;
  private options: DiffOptions;

  constructor(options: DiffOptions) {
    this.options = options;
    this.semanticComparator = new SemanticComparator(options);
  }

  simpleDiff(left: any, right: any, path: string[] = []): SimpleDiff[] {
    const diffs: SimpleDiff[] = [];
    
    // Check if path should be ignored
    const currentPath = path.join('.');
    if (this.shouldIgnorePath(currentPath)) {
      return diffs;
    }
    
    // Apply value transformations
    const transformedLeft = this.applyTransformations(left);
    const transformedRight = this.applyTransformations(right);
    
    // Use semantic comparison if enabled
    if (this.options.semanticComparison && this.semanticComparator.semanticEquals(transformedLeft, transformedRight)) {
      return diffs;
    }
    
    // Regular equality check
    if (transformedLeft === transformedRight) {
      return diffs;
    }
    
    // Handle primitive values
    if (typeof transformedLeft !== 'object' || typeof transformedRight !== 'object' || 
        transformedLeft === null || transformedRight === null) {
      if (transformedLeft === undefined) {
        diffs.push({ kind: 'N', path, rhs: transformedRight });
      } else if (transformedRight === undefined) {
        diffs.push({ kind: 'D', path, lhs: transformedLeft });
      } else {
        diffs.push({ kind: 'E', path, lhs: transformedLeft, rhs: transformedRight });
      }
      return diffs;
    }
    
    // Handle arrays
    if (Array.isArray(transformedLeft) || Array.isArray(transformedRight)) {
      const leftArray = Array.isArray(transformedLeft) ? transformedLeft : [];
      const rightArray = Array.isArray(transformedRight) ? transformedRight : [];
      const maxLength = Math.max(leftArray.length, rightArray.length);
      
      for (let i = 0; i < maxLength; i++) {
        const leftItem = leftArray[i];
        const rightItem = rightArray[i];
        
        if (leftItem === undefined) {
          diffs.push({
            kind: 'A',
            path,
            index: i,
            item: { kind: 'N', rhs: rightItem }
          });
        } else if (rightItem === undefined) {
          diffs.push({
            kind: 'A',
            path,
            index: i,
            item: { kind: 'D', lhs: leftItem }
          });
        } else {
          const subDiffs = this.simpleDiff(leftItem, rightItem, [...path, i.toString()]);
          if (subDiffs.length > 0) {
            diffs.push({
              kind: 'A',
              path,
              index: i,
              item: { kind: 'E', lhs: leftItem, rhs: rightItem }
            });
          }
        }
      }
      return diffs;
    }
    
    // Handle objects
    const leftKeys = Object.keys(transformedLeft);
    const rightKeys = Object.keys(transformedRight);
    const allKeys = new Set([...leftKeys, ...rightKeys]);
    
    for (const key of allKeys) {
      const leftValue = transformedLeft[key];
      const rightValue = transformedRight[key];
      
      if (!(key in transformedLeft)) {
        diffs.push({ kind: 'N', path: [...path, key], rhs: rightValue });
      } else if (!(key in transformedRight)) {
        diffs.push({ kind: 'D', path: [...path, key], lhs: leftValue });
      } else {
        const subDiffs = this.simpleDiff(leftValue, rightValue, [...path, key]);
        diffs.push(...subDiffs);
      }
    }
    
    return diffs;
  }

  private shouldIgnorePath(path: string): boolean {
    for (const rule of this.options.pathRules) {
      if (rule.action === 'ignore' && PathMatcher.matches(path, rule)) {
        return true;
      }
    }
    return false;
  }

  private applyTransformations(value: any): any {
    return ValueTransformer.transform(value, this.options.valueTransformations);
  }
}

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
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.map(formatValue).join(', ')}]`;
    }
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function categorizeChange(path: string): 'security' | 'performance' | 'configuration' | 'structure' {
  const lowerPath = path.toLowerCase();
  
  if (/password|secret|token|key|credential|auth|ssl|tls|cert/.test(lowerPath)) {
    return 'security';
  }
  
  if (/cache|timeout|pool|connection|thread|memory|cpu|limit|throttle|rate/.test(lowerPath)) {
    return 'performance';
  }
  
  if (/config|setting|option|preference|param/.test(lowerPath)) {
    return 'configuration';
  }
  
  return 'structure';
}

export function generateDiff(leftFile: ConfigFile, rightFile: ConfigFile, options: DiffOptions): ComparisonResult {
  const startTime = performance.now();
  
  // Set default values for new options
  const enhancedOptions: DiffOptions = {
    ...options,
    semanticComparison: options.semanticComparison ?? false,
    ignoreWhitespace: options.ignoreWhitespace ?? false,
    ignoreComments: options.ignoreComments ?? false,
    pathRules: options.pathRules ?? [],
    valueTransformations: options.valueTransformations ?? [],
    diffMode: options.diffMode ?? 'tree',
    showLineNumbers: options.showLineNumbers ?? true,
    contextLines: options.contextLines ?? 3,
    minimalDiff: options.minimalDiff ?? false
  };
  
  // Process both objects according to options
  const leftData = processObject(leftFile.parsedContent, enhancedOptions);
  const rightData = processObject(rightFile.parsedContent, enhancedOptions);
  
  // Flatten if requested
  const leftProcessed = enhancedOptions.flattenKeys ? flattenObject(leftData) : leftData;
  const rightProcessed = enhancedOptions.flattenKeys ? flattenObject(rightData) : rightData;
  
  // Generate diff using advanced diff generator
  const diffGenerator = new AdvancedDiffGenerator(enhancedOptions);
  const differences = diffGenerator.simpleDiff(leftProcessed, rightProcessed);
  
  const changes: DiffChange[] = [];
  
  differences.forEach((diff: SimpleDiff) => {
    const path = Array.isArray(diff.path) ? diff.path.join('.') : String(diff.path || '');
    let change: DiffChange;
    
    switch (diff.kind) {
      case 'N': // New
        change = {
          path,
          type: 'added',
          newValue: diff.rhs,
          newType: getValueType(diff.rhs)
        };
        break;
        
      case 'D': // Deleted
        change = {
          path,
          type: 'removed',
          oldValue: diff.lhs,
          oldType: getValueType(diff.lhs)
        };
        break;
        
      case 'E': // Edited
        change = {
          path,
          type: 'changed',
          oldValue: diff.lhs,
          newValue: diff.rhs,
          oldType: getValueType(diff.lhs),
          newType: getValueType(diff.rhs)
        };
        break;
        
      case 'A': // Array change
        const arrayPath = path + `[${diff.index}]`;
        if (diff.item?.kind === 'N') {
          change = {
            path: arrayPath,
            type: 'added',
            newValue: diff.item.rhs,
            newType: getValueType(diff.item.rhs)
          };
        } else if (diff.item?.kind === 'D') {
          change = {
            path: arrayPath,
            type: 'removed',
            oldValue: diff.item.lhs,
            oldType: getValueType(diff.item.lhs)
          };
        } else if (diff.item?.kind === 'E') {
          change = {
            path: arrayPath,
            type: 'changed',
            oldValue: diff.item.lhs,
            newValue: diff.item.rhs,
            oldType: getValueType(diff.item.lhs),
            newType: getValueType(diff.item.rhs)
          };
        } else {
          return; // Skip invalid array changes
        }
        break;
        
      default:
        return; // Skip unknown diff types
    }
    
    // Add severity analysis
    change.severity = DiffSeverityAnalyzer.analyzeSeverity(change);
    
    // Add category based on path
    change.category = categorizeChange(change.path);
    
    changes.push(change);
  });
  
  // Calculate summary
  const summary = {
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    changed: changes.filter(c => c.type === 'changed').length,
    total: changes.length
  };
  
  // Calculate statistics
  const stats = DiffStatistics.calculate(changes, leftFile.content, rightFile.content);
  
  // Generate unified diff if requested
  const result: ComparisonResult = {
    changes: changes.sort((a, b) => a.path.localeCompare(b.path)),
    summary,
    leftFile,
    rightFile,
    stats,
    metadata: {
      comparisonTime: performance.now() - startTime,
      algorithm: 'advanced-semantic',
      options: enhancedOptions
    }
  };
  
  // Generate unified diff if in unified mode
  if (enhancedOptions.diffMode === 'unified') {
    result.unifiedDiff = generateUnifiedDiff(result, {
      contextLines: enhancedOptions.contextLines,
      showLineNumbers: enhancedOptions.showLineNumbers
    });
  }
  
  return result;
}