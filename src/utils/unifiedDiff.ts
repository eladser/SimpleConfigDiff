import { DiffChange, ComparisonResult } from '@/types';

export interface UnifiedDiffOptions {
  contextLines: number;
  showLineNumbers: boolean;
  includeTimestamp: boolean;
  includeFilenames: boolean;
}

export class UnifiedDiffGenerator {
  private options: UnifiedDiffOptions;

  constructor(options: UnifiedDiffOptions) {
    this.options = options;
  }

  /**
   * Generates a unified diff string from comparison results
   */
  generate(result: ComparisonResult): string {
    const { leftFile, rightFile, changes } = result;
    
    let diff = '';
    
    // Add file headers
    if (this.options.includeFilenames) {
      diff += `--- ${leftFile.name}\n`;
      diff += `+++ ${rightFile.name}\n`;
    }
    
    // Add timestamp if requested
    if (this.options.includeTimestamp) {
      const timestamp = new Date().toISOString();
      diff += `@@ timestamp: ${timestamp} @@\n`;
    }
    
    // Group changes by proximity for better context
    const changeGroups = this.groupChangesByProximity(changes);
    
    for (const group of changeGroups) {
      diff += this.generateHunk(group, leftFile.content, rightFile.content);
    }
    
    return diff;
  }

  private groupChangesByProximity(changes: DiffChange[]): DiffChange[][] {
    if (changes.length === 0) return [];
    
    const groups: DiffChange[][] = [];
    let currentGroup: DiffChange[] = [changes[0]];
    
    for (let i = 1; i < changes.length; i++) {
      const prevChange = changes[i - 1];
      const currentChange = changes[i];
      
      // Simple proximity check based on path similarity
      if (this.arePathsProximate(prevChange.path, currentChange.path)) {
        currentGroup.push(currentChange);
      } else {
        groups.push(currentGroup);
        currentGroup = [currentChange];
      }
    }
    
    groups.push(currentGroup);
    return groups;
  }

  private arePathsProximate(path1: string, path2: string): boolean {
    const parts1 = path1.split('.');
    const parts2 = path2.split('.');
    
    // Consider paths proximate if they share the same parent or are in the same section
    const commonParts = Math.min(parts1.length, parts2.length);
    let sharedParts = 0;
    
    for (let i = 0; i < commonParts; i++) {
      if (parts1[i] === parts2[i]) {
        sharedParts++;
      } else {
        break;
      }
    }
    
    // Consider proximate if they share at least 50% of path components
    return sharedParts / Math.max(parts1.length, parts2.length) >= 0.5;
  }

  private generateHunk(changes: DiffChange[], leftContent: string, rightContent: string): string {
    let hunk = '';
    
    // Generate hunk header
    const startLine = this.getStartLine(changes);
    const changeCount = changes.length;
    hunk += `@@ -${startLine},${changeCount} +${startLine},${changeCount} @@\n`;
    
    // Add context lines before changes
    if (this.options.contextLines > 0) {
      hunk += this.getContextLines(leftContent, startLine, -this.options.contextLines);
    }
    
    // Add the actual changes
    for (const change of changes) {
      hunk += this.formatChange(change);
    }
    
    // Add context lines after changes
    if (this.options.contextLines > 0) {
      hunk += this.getContextLines(rightContent, startLine + changeCount, this.options.contextLines);
    }
    
    return hunk;
  }

  private getStartLine(changes: DiffChange[]): number {
    // Simple implementation - in a real scenario, you'd need line number mapping
    // For now, we'll use a hash of the path as a pseudo-line number
    const firstPath = changes[0]?.path || '';
    return Math.abs(this.hashString(firstPath)) % 1000 + 1;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  private getContextLines(content: string, startLine: number, count: number): string {
    const lines = content.split('\n');
    const contextLines = [];
    
    const start = Math.max(0, startLine + (count < 0 ? count : 0));
    const end = Math.min(lines.length, startLine + (count < 0 ? 0 : count));
    
    for (let i = start; i < end; i++) {
      contextLines.push(` ${lines[i]}`);
    }
    
    return contextLines.join('\n') + (contextLines.length > 0 ? '\n' : '');
  }

  private formatChange(change: DiffChange): string {
    const path = change.path;
    let result = '';
    
    switch (change.type) {
      case 'added':
        result += `+${path}: ${this.formatValue(change.newValue)}\n`;
        break;
      case 'removed':
        result += `-${path}: ${this.formatValue(change.oldValue)}\n`;
        break;
      case 'changed':
        result += `-${path}: ${this.formatValue(change.oldValue)}\n`;
        result += `+${path}: ${this.formatValue(change.newValue)}\n`;
        break;
    }
    
    return result;
  }

  private formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }
}

export function generateUnifiedDiff(
  result: ComparisonResult,
  options: Partial<UnifiedDiffOptions> = {}
): string {
  const defaultOptions: UnifiedDiffOptions = {
    contextLines: 3,
    showLineNumbers: true,
    includeTimestamp: false,
    includeFilenames: true
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  const generator = new UnifiedDiffGenerator(mergedOptions);
  
  return generator.generate(result);
}