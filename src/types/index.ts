export type ConfigFormat = 'json' | 'yaml' | 'xml' | 'ini' | 'toml' | 'env' | 'config';

export interface ConfigFile {
  name: string;
  content: string;
  format: ConfigFormat;
  parsedContent: Record<string, any>;
}

export interface DiffChange {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: any;
  newValue?: any;
  oldType?: string;
  newType?: string;
  // New fields for enhanced diff
  severity?: 'critical' | 'major' | 'minor' | 'cosmetic';
  category?: 'security' | 'performance' | 'configuration' | 'structure';
  lineNumber?: {
    left?: number;
    right?: number;
  };
}

export interface PathRule {
  pattern: string;
  type: 'regex' | 'glob' | 'exact';
  action: 'ignore' | 'semantic' | 'strict';
  description?: string;
}

export interface ValueTransformation {
  name: string;
  pattern: string;
  replacement: string;
  enabled: boolean;
  description?: string;
}

export interface DiffOptions {
  ignoreKeys: string[];
  caseSensitive: boolean;
  sortKeys: boolean;
  flattenKeys: boolean;
  // New advanced options
  semanticComparison: boolean;
  ignoreWhitespace: boolean;
  ignoreComments: boolean;
  pathRules: PathRule[];
  valueTransformations: ValueTransformation[];
  diffMode: 'unified' | 'side-by-side' | 'tree';
  showLineNumbers: boolean;
  contextLines: number;
  minimalDiff: boolean;
}

export interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  filesCompared: number;
  totalCharacters: number;
  similarities: number; // percentage
}

export interface ParsedConfig {
  data: Record<string, any>;
  format: ConfigFormat;
  error?: string;
  lineMap?: Map<string, number>; // path -> line number mapping
}

export interface ComparisonResult {
  changes: DiffChange[];
  summary: {
    added: number;
    removed: number;
    changed: number;
    total: number;
  };
  leftFile: ConfigFile;
  rightFile: ConfigFile;
  // New enhanced result data
  stats: DiffStats;
  unifiedDiff?: string;
  metadata: {
    comparisonTime: number;
    algorithm: string;
    options: DiffOptions;
  };
}

export interface FileUploadState {
  file: File | null;
  content: string;
  format: ConfigFormat | null;
  isValid: boolean;
  error?: string;
  lineCount?: number;
  size?: number;
}

// New types for UI enhancements
export interface DiffViewSettings {
  highlightSyntax: boolean;
  showMinimap: boolean;
  showLineNumbers: boolean;
  wrapLines: boolean;
  fontSize: number;
  theme: 'vs' | 'vs-dark' | 'hc-black';
}

export interface SearchFilters {
  changeTypes: ('added' | 'removed' | 'changed')[];
  pathPattern: string;
  valuePattern: string;
  severity: ('critical' | 'major' | 'minor' | 'cosmetic')[];
  category: ('security' | 'performance' | 'configuration' | 'structure')[];
}

export interface ExportOptions {
  format: 'html' | 'pdf' | 'json' | 'csv' | 'patch';
  includeMetadata: boolean;
  includeStats: boolean;
  includeContext: boolean;
  template?: string;
}