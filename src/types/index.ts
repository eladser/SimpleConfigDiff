export type ConfigFormat = 'json' | 'yaml' | 'xml' | 'ini' | 'toml' | 'env' | 'config' | 'hcl' | 'properties' | 'csv' | 'jinja2' | 'handlebars' | 'mustache';

export interface ConfigFile {
  name: string;
  content: string;
  format: ConfigFormat;
  parsedContent: Record<string, any>;
  size?: number;
  lastModified?: number;
}

export interface DiffChange {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: any;
  newValue?: any;
  oldType?: string;
  newType?: string;
  description?: string;
  // New fields for enhanced diff
  severity?: 'critical' | 'major' | 'minor' | 'cosmetic';
  category?: 'security' | 'performance' | 'configuration' | 'structure';
  lineNumber?: {
    left?: number;
    right?: number;
  };
  // CSV-specific fields
  csvColumn?: string;
  csvRow?: number;
  // Docker Compose-specific fields
  dockerComposeContext?: {
    section: 'services' | 'networks' | 'volumes' | 'secrets' | 'configs';
    serviceName?: string;
    resourceName?: string;
  };
  // Kubernetes-specific fields
  kubernetesContext?: {
    kind: string;
    name: string;
    namespace: string;
    apiVersion: string;
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
  // CSV-specific options
  csvOptions?: {
    delimiter: string;
    headerRow: boolean;
    keyColumn?: string;
    ignoreColumns?: string[];
    compareMode: 'row-by-row' | 'column-aware' | 'value-based';
  };
}

export interface DiffStats {
  linesAdded?: number;
  linesRemoved?: number;
  linesChanged?: number;
  linesLeft?: number;
  linesRight?: number;
  filesCompared?: number;
  totalCharacters?: number;
  similarities: number; // percentage
  // CSV-specific stats
  csvStats?: {
    rowsAdded: number;
    rowsRemoved: number;
    rowsChanged: number;
    columnsAdded: number;
    columnsRemoved: number;
    columnsChanged: number;
  };
  // Docker Compose-specific stats
  dockerComposeStats?: {
    servicesAdded: number;
    servicesRemoved: number;
    servicesChanged: number;
    networksAdded: number;
    networksRemoved: number;
    networksChanged: number;
    volumesAdded: number;
    volumesRemoved: number;
    volumesChanged: number;
  };
  // Kubernetes-specific stats
  kubernetesStats?: {
    resourcesAdded: number;
    resourcesRemoved: number;
    resourcesChanged: number;
    namespacesAdded: number;
    namespacesRemoved: number;
    kindCounts: Record<string, { added: number; removed: number; changed: number }>;
  };
}

export interface ParsedConfig {
  data: Record<string, any>;
  format: ConfigFormat;
  error?: string;
  lineMap?: Map<string, number>; // path -> line number mapping
  // CSV-specific metadata
  csvMetadata?: {
    headers: string[];
    rowCount: number;
    delimiter: string;
    hasHeader: boolean;
  };
  // Docker Compose-specific metadata
  dockerComposeMetadata?: {
    version: string;
    services: Array<{
      name: string;
      image?: string;
      build: boolean;
      ports: number;
      volumes: number;
      environment: number;
      networks: number;
      dependsOn: number;
      restart: string;
      healthcheck: boolean;
      deploy: boolean;
    }>;
    networks: Array<{
      name: string;
      driver: string;
      external: boolean;
    }>;
    volumes: Array<{
      name: string;
      driver: string;
      external: boolean;
    }>;
    secrets: Array<{
      name: string;
      external: boolean;
      file: boolean;
    }>;
    configs: Array<{
      name: string;
      external: boolean;
      file: boolean;
    }>;
    hasXExtensions: boolean;
  };
  // Kubernetes-specific metadata
  kubernetesMetadata?: {
    totalDocuments: number;
    resourceTypes: string[];
    namespaces: string[];
    apiVersions: string[];
    resources: Array<{
      index: number;
      kind: string;
      apiVersion: string;
      name: string;
      namespace: string;
      labels: string[];
      annotations: string[];
      hasStatus: boolean;
    }>;
    summary: {
      deployments: number;
      services: number;
      configMaps: number;
      secrets: number;
      ingresses: number;
      pods: number;
      rbacResources: number;
      networkPolicies: number;
      persistentVolumes: number;
      serviceAccounts: number;
    };
  };
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
    algorithm?: string;
    options?: DiffOptions;
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
  format: 'html' | 'pdf' | 'json' | 'csv' | 'patch' | 'xlsx';
  includeMetadata: boolean;
  includeStats: boolean;
  includeContext: boolean;
  template?: string;
}