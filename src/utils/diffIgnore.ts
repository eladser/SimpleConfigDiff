import { BatchFile } from './batchProcessor';

export interface DiffIgnoreRule {
  pattern: string;
  type: 'glob' | 'regex' | 'exact';
  negate: boolean;
  directory: boolean;
  comment?: string;
}

export class DiffIgnoreProcessor {
  private rules: DiffIgnoreRule[] = [];
  private defaultRules: DiffIgnoreRule[] = [
    { pattern: '.git', type: 'exact', negate: false, directory: true },
    { pattern: '.gitignore', type: 'exact', negate: false, directory: false },
    { pattern: '.DS_Store', type: 'exact', negate: false, directory: false },
    { pattern: 'node_modules', type: 'exact', negate: false, directory: true },
    { pattern: 'dist', type: 'exact', negate: false, directory: true },
    { pattern: 'build', type: 'exact', negate: false, directory: true },
    { pattern: '*.log', type: 'glob', negate: false, directory: false },
    { pattern: '*.tmp', type: 'glob', negate: false, directory: false },
    { pattern: '*.temp', type: 'glob', negate: false, directory: false },
    { pattern: '.env.local', type: 'exact', negate: false, directory: false },
    { pattern: '.env.*.local', type: 'glob', negate: false, directory: false },
  ];

  constructor(diffIgnoreContent?: string, useDefaults: boolean = true) {
    if (useDefaults) {
      this.rules = [...this.defaultRules];
    }
    
    if (diffIgnoreContent) {
      this.parseDiffIgnore(diffIgnoreContent);
    }
  }

  parseDiffIgnore(content: string): void {
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      const rule = this.parseRule(trimmed);
      if (rule) {
        this.rules.push(rule);
      }
    }
  }

  private parseRule(line: string): DiffIgnoreRule | null {
    let pattern = line;
    let negate = false;
    let directory = false;
    
    // Handle negation
    if (pattern.startsWith('!')) {
      negate = true;
      pattern = pattern.slice(1);
    }
    
    // Handle directory marker
    if (pattern.endsWith('/')) {
      directory = true;
      pattern = pattern.slice(0, -1);
    }
    
    // Determine pattern type
    let type: 'glob' | 'regex' | 'exact' = 'exact';
    
    if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
      type = 'glob';
    } else if (pattern.startsWith('/') && pattern.endsWith('/')) {
      type = 'regex';
      pattern = pattern.slice(1, -1);
    }
    
    return {
      pattern,
      type,
      negate,
      directory
    };
  }

  shouldIgnore(filePath: string): boolean {
    const pathParts = filePath.split('/').filter(part => part.length > 0);
    const fileName = pathParts[pathParts.length - 1];
    
    let ignored = false;
    
    for (const rule of this.rules) {
      const matches = this.matchesRule(rule, filePath, fileName, pathParts);
      
      if (matches) {
        ignored = !rule.negate;
      }
    }
    
    return ignored;
  }

  private matchesRule(rule: DiffIgnoreRule, filePath: string, fileName: string, pathParts: string[]): boolean {
    const { pattern, type, directory } = rule;
    
    // For directory rules, check if any path segment matches
    if (directory) {
      return pathParts.some(part => this.matchPattern(pattern, part, type));
    }
    
    // For file rules, check against filename and full path
    return this.matchPattern(pattern, fileName, type) || 
           this.matchPattern(pattern, filePath, type);
  }

  private matchPattern(pattern: string, text: string, type: 'glob' | 'regex' | 'exact'): boolean {
    switch (type) {
      case 'exact':
        return text === pattern;
      
      case 'glob':
        return this.matchGlob(pattern, text);
      
      case 'regex':
        try {
          const regex = new RegExp(pattern);
          return regex.test(text);
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  private matchGlob(pattern: string, text: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*/g, '.*') // * matches any characters
      .replace(/\?/g, '.') // ? matches single character
      .replace(/\\\[([^\]]*)\\\]/g, '[$1]'); // Character classes
    
    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(text);
    } catch {
      return false;
    }
  }

  filterFiles(files: BatchFile[]): BatchFile[] {
    return files.filter(file => !this.shouldIgnore(file.path));
  }

  addRule(pattern: string, options: {
    type?: 'glob' | 'regex' | 'exact';
    negate?: boolean;
    directory?: boolean;
    comment?: string;
  } = {}): void {
    this.rules.push({
      pattern,
      type: options.type || 'exact',
      negate: options.negate || false,
      directory: options.directory || false,
      comment: options.comment
    });
  }

  removeRule(pattern: string): void {
    this.rules = this.rules.filter(rule => rule.pattern !== pattern);
  }

  getRules(): DiffIgnoreRule[] {
    return [...this.rules];
  }

  clearRules(): void {
    this.rules = [];
  }

  resetToDefaults(): void {
    this.rules = [...this.defaultRules];
  }

  generateDiffIgnoreContent(): string {
    const lines: string[] = [];
    
    lines.push('# .diffignore file');
    lines.push('# Patterns to ignore when comparing files');
    lines.push('# Similar to .gitignore format');
    lines.push('');
    
    const groupedRules = this.groupRulesByType();
    
    for (const [groupName, rules] of Object.entries(groupedRules)) {
      if (rules.length > 0) {
        lines.push(`# ${groupName}`);
        
        for (const rule of rules) {
          let line = '';
          
          if (rule.negate) {
            line += '!';
          }
          
          line += rule.pattern;
          
          if (rule.directory) {
            line += '/';
          }
          
          if (rule.comment) {
            line += ` # ${rule.comment}`;
          }
          
          lines.push(line);
        }
        
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  private groupRulesByType(): Record<string, DiffIgnoreRule[]> {
    const groups: Record<string, DiffIgnoreRule[]> = {
      'Version Control': [],
      'Build Artifacts': [],
      'Dependencies': [],
      'Temporary Files': [],
      'Environment Files': [],
      'IDE Files': [],
      'Custom Rules': []
    };
    
    for (const rule of this.rules) {
      const group = this.categorizeRule(rule);
      groups[group].push(rule);
    }
    
    return groups;
  }

  private categorizeRule(rule: DiffIgnoreRule): string {
    const pattern = rule.pattern.toLowerCase();
    
    if (pattern.includes('git') || pattern.includes('svn') || pattern.includes('hg')) {
      return 'Version Control';
    }
    
    if (pattern.includes('dist') || pattern.includes('build') || pattern.includes('out') || 
        pattern.includes('target') || pattern.includes('bin')) {
      return 'Build Artifacts';
    }
    
    if (pattern.includes('node_modules') || pattern.includes('vendor') || 
        pattern.includes('packages') || pattern.includes('lib')) {
      return 'Dependencies';
    }
    
    if (pattern.includes('tmp') || pattern.includes('temp') || pattern.includes('log') || 
        pattern.includes('cache') || pattern.includes('pid')) {
      return 'Temporary Files';
    }
    
    if (pattern.includes('env') || pattern.includes('config')) {
      return 'Environment Files';
    }
    
    if (pattern.includes('vscode') || pattern.includes('idea') || pattern.includes('eclipse') || 
        pattern.includes('.ds_store') || pattern.includes('thumbs.db')) {
      return 'IDE Files';
    }
    
    return 'Custom Rules';
  }

  getStatistics(files: BatchFile[]): {
    totalFiles: number;
    ignoredFiles: number;
    includedFiles: number;
    ignoredByRule: Record<string, number>;
    largestIgnoredFiles: Array<{ name: string; size: number; rule: string }>;
  } {
    const stats = {
      totalFiles: files.length,
      ignoredFiles: 0,
      includedFiles: 0,
      ignoredByRule: {} as Record<string, number>,
      largestIgnoredFiles: [] as Array<{ name: string; size: number; rule: string }>
    };
    
    const ignoredFiles: Array<{ file: BatchFile; rule: string }> = [];
    
    for (const file of files) {
      const ignoringRule = this.findIgnoringRule(file.path);
      
      if (ignoringRule) {
        stats.ignoredFiles++;
        stats.ignoredByRule[ignoringRule.pattern] = (stats.ignoredByRule[ignoringRule.pattern] || 0) + 1;
        ignoredFiles.push({ file, rule: ignoringRule.pattern });
      } else {
        stats.includedFiles++;
      }
    }
    
    // Sort ignored files by size and take top 10
    stats.largestIgnoredFiles = ignoredFiles
      .sort((a, b) => b.file.size - a.file.size)
      .slice(0, 10)
      .map(({ file, rule }) => ({
        name: file.name,
        size: file.size,
        rule
      }));
    
    return stats;
  }

  private findIgnoringRule(filePath: string): DiffIgnoreRule | null {
    const pathParts = filePath.split('/').filter(part => part.length > 0);
    const fileName = pathParts[pathParts.length - 1];
    
    for (const rule of this.rules) {
      const matches = this.matchesRule(rule, filePath, fileName, pathParts);
      
      if (matches && !rule.negate) {
        return rule;
      }
    }
    
    return null;
  }

  validatePattern(pattern: string, type: 'glob' | 'regex' | 'exact'): {
    isValid: boolean;
    error?: string;
  } {
    try {
      switch (type) {
        case 'exact':
          return { isValid: true };
        
        case 'glob':
          // Test glob pattern by converting to regex
          const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\\\[([^\]]*)\\\]/g, '[$1]');
          new RegExp(`^${regexPattern}$`);
          return { isValid: true };
        
        case 'regex':
          new RegExp(pattern);
          return { isValid: true };
        
        default:
          return { isValid: false, error: 'Invalid pattern type' };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid pattern'
      };
    }
  }

  findDiffIgnoreFile(files: BatchFile[]): BatchFile | null {
    return files.find(file => 
      file.name === '.diffignore' || 
      file.name === '.configdiffignore' ||
      file.path.endsWith('/.diffignore') ||
      file.path.endsWith('/.configdiffignore')
    ) || null;
  }

  static createFromFiles(files: BatchFile[], useDefaults: boolean = true): DiffIgnoreProcessor {
    const processor = new DiffIgnoreProcessor(undefined, useDefaults);
    
    const diffIgnoreFile = processor.findDiffIgnoreFile(files);
    if (diffIgnoreFile) {
      processor.parseDiffIgnore(diffIgnoreFile.content);
    }
    
    return processor;
  }

  static getRecommendedRules(files: BatchFile[]): DiffIgnoreRule[] {
    const recommendations: DiffIgnoreRule[] = [];
    const extensions = new Set<string>();
    const directories = new Set<string>();
    
    // Analyze files to suggest rules
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext) {
        extensions.add(ext);
      }
      
      const pathParts = file.path.split('/');
      pathParts.forEach((part, index) => {
        if (index < pathParts.length - 1) { // Not the filename
          directories.add(part);
        }
      });
    }
    
    // Suggest rules based on common patterns
    if (extensions.has('log')) {
      recommendations.push({
        pattern: '*.log',
        type: 'glob',
        negate: false,
        directory: false,
        comment: 'Log files'
      });
    }
    
    if (extensions.has('tmp') || extensions.has('temp')) {
      recommendations.push({
        pattern: '*.tmp',
        type: 'glob',
        negate: false,
        directory: false,
        comment: 'Temporary files'
      });
    }
    
    if (directories.has('test') || directories.has('tests')) {
      recommendations.push({
        pattern: 'test',
        type: 'exact',
        negate: false,
        directory: true,
        comment: 'Test directories'
      });
    }
    
    if (directories.has('backup') || directories.has('backups')) {
      recommendations.push({
        pattern: 'backup*',
        type: 'glob',
        negate: false,
        directory: true,
        comment: 'Backup directories'
      });
    }
    
    return recommendations;
  }
}

// Utility functions
export function findIgnorePatterns(files: BatchFile[]): string[] {
  const patterns = new Set<string>();
  
  for (const file of files) {
    const name = file.name.toLowerCase();
    
    // Common ignore patterns
    if (name.includes('ignore') || name.includes('exclude')) {
      patterns.add(file.path);
    }
  }
  
  return Array.from(patterns);
}

export function createDiffIgnoreFromGitignore(gitignoreContent: string): string {
  const lines = gitignoreContent.split('\n');
  const diffIgnoreLines: string[] = [];
  
  diffIgnoreLines.push('# Generated from .gitignore');
  diffIgnoreLines.push('# Additional patterns for diff comparison');
  diffIgnoreLines.push('');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed && !trimmed.startsWith('#')) {
      diffIgnoreLines.push(trimmed);
    }
  }
  
  return diffIgnoreLines.join('\n');
}