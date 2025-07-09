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
}

export interface DiffOptions {
  ignoreKeys: string[];
  caseSensitive: boolean;
  sortKeys: boolean;
  flattenKeys: boolean;
}

export interface ParsedConfig {
  data: Record<string, any>;
  format: ConfigFormat;
  error?: string;
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
}

export interface FileUploadState {
  file: File | null;
  content: string;
  format: ConfigFormat | null;
  isValid: boolean;
  error?: string;
}