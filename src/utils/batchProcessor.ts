import { ConfigFile, ComparisonResult, DiffOptions } from '@/types';
import { generateDiff } from './generateDiff';
import { detectFormat, parseConfig } from './parsers';

export interface BatchFile {
  name: string;
  content: string;
  path: string;
  size: number;
  lastModified: number;
}

export interface BatchComparisonResult {
  files: BatchFile[];
  comparisons: Array<{
    leftFile: string;
    rightFile: string;
    result: ComparisonResult;
    similarity: number;
  }>;
  summary: {
    totalFiles: number;
    totalComparisons: number;
    filesWithChanges: number;
    averageSimilarity: number;
    processingTime: number;
  };
  errors: Array<{
    file: string;
    error: string;
  }>;
}

export interface BatchOptions extends DiffOptions {
  // Batch-specific options
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  includeExtensions?: string[];
  excludeExtensions?: string[];
  pairBy?: 'name' | 'path' | 'custom';
  customPairing?: Array<{ left: string; right: string }>;
  compareAllPairs?: boolean;
  skipIdenticalFiles?: boolean;
  parallelProcessing?: boolean;
  outputFormat?: 'detailed' | 'summary' | 'minimal';
}

export class BatchProcessor {
  private options: BatchOptions;
  private startTime: number = 0;

  constructor(options: BatchOptions = {} as BatchOptions) {
    this.options = {
      maxFiles: 50,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      includeExtensions: [],
      excludeExtensions: [],
      pairBy: 'name',
      compareAllPairs: false,
      skipIdenticalFiles: true,
      parallelProcessing: false,
      outputFormat: 'detailed',
      ...options
    };
  }

  async compareFiles(files: BatchFile[]): Promise<BatchComparisonResult> {
    this.startTime = performance.now();
    
    const errors: Array<{ file: string; error: string }> = [];
    const validFiles: BatchFile[] = [];
    
    // Filter and validate files
    for (const file of files) {
      try {
        // Check file size
        if (this.options.maxFileSize && file.size > this.options.maxFileSize) {
          errors.push({
            file: file.name,
            error: `File size ${file.size} exceeds limit of ${this.options.maxFileSize} bytes`
          });
          continue;
        }
        
        // Check extensions
        if (!this.shouldIncludeFile(file.name)) {
          continue;
        }
        
        validFiles.push(file);
        
        // Check max files limit
        if (this.options.maxFiles && validFiles.length >= this.options.maxFiles) {
          break;
        }
      } catch (error) {
        errors.push({
          file: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Generate file pairs
    const pairs = this.generatePairs(validFiles);
    
    // Process comparisons
    const comparisons = await this.processComparisons(pairs, errors);
    
    // Calculate summary
    const summary = this.calculateSummary(validFiles, comparisons);
    
    return {
      files: validFiles,
      comparisons,
      summary,
      errors
    };
  }

  private shouldIncludeFile(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    // Check include extensions
    if (this.options.includeExtensions && this.options.includeExtensions.length > 0) {
      return this.options.includeExtensions.includes(ext);
    }
    
    // Check exclude extensions
    if (this.options.excludeExtensions && this.options.excludeExtensions.length > 0) {
      return !this.options.excludeExtensions.includes(ext);
    }
    
    return true;
  }

  private generatePairs(files: BatchFile[]): Array<{ left: BatchFile; right: BatchFile }> {
    const pairs: Array<{ left: BatchFile; right: BatchFile }> = [];
    
    if (this.options.customPairing) {
      // Use custom pairing
      for (const pair of this.options.customPairing) {
        const leftFile = files.find(f => f.name === pair.left || f.path === pair.left);
        const rightFile = files.find(f => f.name === pair.right || f.path === pair.right);
        
        if (leftFile && rightFile) {
          pairs.push({ left: leftFile, right: rightFile });
        }
      }
    } else if (this.options.compareAllPairs) {
      // Compare all combinations
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          pairs.push({ left: files[i], right: files[j] });
        }
      }
    } else {
      // Auto-pair by name or path
      const grouped = this.groupFiles(files);
      
      for (const group of Object.values(grouped)) {
        if (group.length >= 2) {
          // Sort by modification time to get consistent pairing
          group.sort((a, b) => a.lastModified - b.lastModified);
          
          // Pair consecutive files
          for (let i = 0; i < group.length - 1; i++) {
            pairs.push({ left: group[i], right: group[i + 1] });
          }
        }
      }
    }
    
    return pairs;
  }

  private groupFiles(files: BatchFile[]): Record<string, BatchFile[]> {
    const grouped: Record<string, BatchFile[]> = {};
    
    for (const file of files) {
      let key: string;
      
      if (this.options.pairBy === 'name') {
        // Remove extension and version numbers for grouping
        key = file.name.replace(/\.[^.]+$/, '').replace(/[-_]v?\d+(\.\d+)*$/, '');
      } else if (this.options.pairBy === 'path') {
        // Use directory path for grouping
        key = file.path.split('/').slice(0, -1).join('/');
      } else {
        // Default to name
        key = file.name;
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(file);
    }
    
    return grouped;
  }

  private async processComparisons(
    pairs: Array<{ left: BatchFile; right: BatchFile }>,
    errors: Array<{ file: string; error: string }>
  ): Promise<Array<{
    leftFile: string;
    rightFile: string;
    result: ComparisonResult;
    similarity: number;
  }>> {
    const comparisons: Array<{
      leftFile: string;
      rightFile: string;
      result: ComparisonResult;
      similarity: number;
    }> = [];
    
    if (this.options.parallelProcessing) {
      // Process in parallel (simulated with Promise.all)
      const promises = pairs.map(async (pair) => {
        try {
          return await this.compareFilePair(pair.left, pair.right);
        } catch (error) {
          errors.push({
            file: `${pair.left.name} vs ${pair.right.name}`,
            error: error instanceof Error ? error.message : 'Comparison failed'
          });
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      comparisons.push(...results.filter(r => r !== null) as any[]);
    } else {
      // Process sequentially
      for (const pair of pairs) {
        try {
          const result = await this.compareFilePair(pair.left, pair.right);
          comparisons.push(result);
        } catch (error) {
          errors.push({
            file: `${pair.left.name} vs ${pair.right.name}`,
            error: error instanceof Error ? error.message : 'Comparison failed'
          });
        }
      }
    }
    
    return comparisons;
  }

  private async compareFilePair(left: BatchFile, right: BatchFile): Promise<{
    leftFile: string;
    rightFile: string;
    result: ComparisonResult;
    similarity: number;
  }> {
    // Parse files
    const leftFormat = detectFormat(left.name, left.content);
    const rightFormat = detectFormat(right.name, right.content);
    
    const leftParsed = parseConfig(left.content, leftFormat, left.name);
    const rightParsed = parseConfig(right.content, rightFormat, right.name);
    
    if (leftParsed.error || rightParsed.error) {
      throw new Error(`Parsing failed: ${leftParsed.error || rightParsed.error}`);
    }
    
    // Create ConfigFile objects
    const leftFile: ConfigFile = {
      name: left.name,
      content: left.content,
      format: leftFormat,
      parsedContent: leftParsed.data
    };
    
    const rightFile: ConfigFile = {
      name: right.name,
      content: right.content,
      format: rightFormat,
      parsedContent: rightParsed.data
    };
    
    // Skip identical files if requested
    if (this.options.skipIdenticalFiles && left.content === right.content) {
      const emptyResult: ComparisonResult = {
        changes: [],
        summary: { added: 0, removed: 0, changed: 0, total: 0 },
        leftFile,
        rightFile,
        stats: {
          linesAdded: 0,
          linesRemoved: 0,
          linesChanged: 0,
          filesCompared: 2,
          totalCharacters: left.content.length + right.content.length,
          similarities: 100
        },
        metadata: {
          comparisonTime: 0,
          algorithm: 'identical-skip',
          options: this.options
        }
      };
      
      return {
        leftFile: left.name,
        rightFile: right.name,
        result: emptyResult,
        similarity: 100
      };
    }
    
    // Generate diff
    const result = generateDiff(leftFile, rightFile, this.options);
    
    return {
      leftFile: left.name,
      rightFile: right.name,
      result,
      similarity: result.stats.similarities
    };
  }

  private calculateSummary(
    files: BatchFile[],
    comparisons: Array<{
      leftFile: string;
      rightFile: string;
      result: ComparisonResult;
      similarity: number;
    }>
  ): {
    totalFiles: number;
    totalComparisons: number;
    filesWithChanges: number;
    averageSimilarity: number;
    processingTime: number;
  } {
    const filesWithChanges = new Set<string>();
    let totalSimilarity = 0;
    
    for (const comparison of comparisons) {
      if (comparison.result.changes.length > 0) {
        filesWithChanges.add(comparison.leftFile);
        filesWithChanges.add(comparison.rightFile);
      }
      totalSimilarity += comparison.similarity;
    }
    
    return {
      totalFiles: files.length,
      totalComparisons: comparisons.length,
      filesWithChanges: filesWithChanges.size,
      averageSimilarity: comparisons.length > 0 ? totalSimilarity / comparisons.length : 100,
      processingTime: performance.now() - this.startTime
    };
  }
}

// Utility functions for batch processing
export function createBatchFileFromFile(file: File): Promise<BatchFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve({
        name: file.name,
        content,
        path: file.name, // Browser files don't have real paths
        size: file.size,
        lastModified: file.lastModified
      });
    };
    
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

export function createBatchFilesFromFileList(files: FileList): Promise<BatchFile[]> {
  const promises = Array.from(files).map(createBatchFileFromFile);
  return Promise.all(promises);
}

export function filterFilesByExtension(files: BatchFile[], extensions: string[]): BatchFile[] {
  return files.filter(file => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return extensions.includes(ext);
  });
}

export function groupFilesByDirectory(files: BatchFile[]): Record<string, BatchFile[]> {
  const grouped: Record<string, BatchFile[]> = {};
  
  for (const file of files) {
    const dir = file.path.split('/').slice(0, -1).join('/') || '/';
    if (!grouped[dir]) {
      grouped[dir] = [];
    }
    grouped[dir].push(file);
  }
  
  return grouped;
}

export function sortFilesByModification(files: BatchFile[]): BatchFile[] {
  return [...files].sort((a, b) => b.lastModified - a.lastModified);
}

export function findSimilarFiles(files: BatchFile[], threshold: number = 0.8): Array<{
  file1: BatchFile;
  file2: BatchFile;
  similarity: number;
}> {
  const similar: Array<{
    file1: BatchFile;
    file2: BatchFile;
    similarity: number;
  }> = [];
  
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const similarity = calculateTextSimilarity(files[i].content, files[j].content);
      if (similarity >= threshold) {
        similar.push({
          file1: files[i],
          file2: files[j],
          similarity
        });
      }
    }
  }
  
  return similar.sort((a, b) => b.similarity - a.similarity);
}

function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1.0;
  
  // Simple character-based similarity
  const longer = text1.length > text2.length ? text1 : text2;
  const shorter = text1.length > text2.length ? text2 : text1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}