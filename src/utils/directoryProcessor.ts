import { BatchFile } from './batchProcessor';

export interface DirectoryStructure {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: number;
  children?: DirectoryStructure[];
  content?: string;
}

export interface RecursiveOptions {
  maxDepth?: number;
  includeHidden?: boolean;
  followSymlinks?: boolean;
  ignorePatterns?: string[];
  includePatterns?: string[];
  maxFileSize?: number;
  extensions?: string[];
}

export class DirectoryProcessor {
  private options: RecursiveOptions;

  constructor(options: RecursiveOptions = {}) {
    this.options = {
      maxDepth: 10,
      includeHidden: false,
      followSymlinks: false,
      ignorePatterns: ['node_modules', '.git', '.DS_Store', 'dist', 'build'],
      includePatterns: [],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      extensions: ['.json', '.yaml', '.yml', '.xml', '.ini', '.toml', '.env', '.hcl', '.tf', '.properties', '.csv', '.config', '.conf'],
      ...options
    };
  }

  // Simulate recursive directory reading (in browser environment)
  processFileList(files: FileList): Promise<BatchFile[]> {
    return new Promise((resolve) => {
      const batchFiles: BatchFile[] = [];
      const fileArray = Array.from(files);
      let processed = 0;

      if (fileArray.length === 0) {
        resolve(batchFiles);
        return;
      }

      fileArray.forEach((file) => {
        // Check if file should be included
        if (!this.shouldIncludeFile(file.name, file.size)) {
          processed++;
          if (processed === fileArray.length) {
            resolve(batchFiles);
          }
          return;
        }

        const reader = new FileReader();
        
        reader.onload = (e) => {
          const content = e.target?.result as string;
          
          batchFiles.push({
            name: file.name,
            content,
            path: this.getRelativePath(file),
            size: file.size,
            lastModified: file.lastModified
          });
          
          processed++;
          if (processed === fileArray.length) {
            resolve(batchFiles);
          }
        };
        
        reader.onerror = () => {
          processed++;
          if (processed === fileArray.length) {
            resolve(batchFiles);
          }
        };
        
        reader.readAsText(file);
      });
    });
  }

  private getRelativePath(file: File): string {
    // In browser environment, we can access webkitRelativePath
    if ((file as any).webkitRelativePath) {
      return (file as any).webkitRelativePath;
    }
    return file.name;
  }

  private shouldIncludeFile(filename: string, size: number): boolean {
    // Check file size
    if (this.options.maxFileSize && size > this.options.maxFileSize) {
      return false;
    }

    // Check hidden files
    if (!this.options.includeHidden && filename.startsWith('.')) {
      return false;
    }

    // Check ignore patterns
    if (this.options.ignorePatterns) {
      for (const ignorePattern of this.options.ignorePatterns) {
        if (filename.includes(ignorePattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.options.includePatterns && this.options.includePatterns.length > 0) {
      let matches = false;
      for (const includePattern of this.options.includePatterns) {
        if (filename.includes(includePattern)) {
          matches = true;
          break;
        }
      }
      if (!matches) return false;
    }

    // Check extensions
    if (this.options.extensions && this.options.extensions.length > 0) {
      const ext = '.' + filename.split('.').pop()?.toLowerCase();
      if (!this.options.extensions.includes(ext)) {
        return false;
      }
    }

    return true;
  }

  buildDirectoryTree(files: BatchFile[]): DirectoryStructure[] {
    const tree: DirectoryStructure[] = [];
    const pathMap = new Map<string, DirectoryStructure>();

    // Sort files by path for consistent processing
    const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

    for (const file of sortedFiles) {
      const pathParts = file.path.split('/').filter(part => part.length > 0);
      let currentPath = '';
      let currentLevel = tree;

      // Build directory structure
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        let existing = pathMap.get(currentPath);
        
        if (!existing) {
          const isFile = i === pathParts.length - 1;
          
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'directory',
            children: isFile ? undefined : [],
            size: isFile ? file.size : undefined,
            lastModified: isFile ? file.lastModified : undefined,
            content: isFile ? file.content : undefined
          };
          
          pathMap.set(currentPath, existing);
          currentLevel.push(existing);
        }
        
        if (existing.type === 'directory' && existing.children) {
          currentLevel = existing.children;
        }
      }
    }

    return tree;
  }

  findMatchingFiles(files: BatchFile[]): Array<{
    pattern: string;
    files: BatchFile[];
    confidence: number;
  }> {
    const patterns = new Map<string, BatchFile[]>();
    
    for (const file of files) {
      const filePattern = this.extractFilePattern(file.name);
      if (!patterns.has(filePattern)) {
        patterns.set(filePattern, []);
      }
      patterns.get(filePattern)!.push(file);
    }
    
    return Array.from(patterns.entries())
      .map(([filePattern, matchedFiles]) => ({
        pattern: filePattern,
        files: matchedFiles,
        confidence: this.calculatePatternConfidence(filePattern, matchedFiles)
      }))
      .filter(group => group.files.length > 1)
      .sort((a, b) => b.confidence - a.confidence);
  }

  private extractFilePattern(filename: string): string {
    // Remove common versioning patterns
    let filePattern = filename
      .replace(/[-_]v?\d+(\.\d+)*/, '') // version numbers
      .replace(/[-_]\d{4}-\d{2}-\d{2}/, '') // dates
      .replace(/[-_]\d{8}/, '') // date stamps
      .replace(/[-_](old|new|backup|temp|tmp)/, '') // common suffixes
      .replace(/[-_](prod|dev|test|staging)/, '') // environment suffixes
      .replace(/\.[^.]+$/, ''); // extension
    
    return filePattern;
  }

  private calculatePatternConfidence(filePattern: string, files: BatchFile[]): number {
    if (files.length < 2) return 0;
    
    let confidence = 0;
    
    // Higher confidence for more files
    confidence += Math.min(files.length / 5, 1) * 30;
    
    // Higher confidence for similar file sizes
    const sizes = files.map(f => f.size);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const sizeVariance = sizes.reduce((acc, size) => acc + Math.pow(size - avgSize, 2), 0) / sizes.length;
    const sizeStdDev = Math.sqrt(sizeVariance);
    confidence += Math.max(0, 30 - (sizeStdDev / avgSize) * 100);
    
    // Higher confidence for files in same directory
    const directories = files.map(f => f.path.split('/').slice(0, -1).join('/'));
    const uniqueDirs = new Set(directories);
    if (uniqueDirs.size === 1) {
      confidence += 20;
    }
    
    // Higher confidence for consistent naming patterns
    const names = files.map(f => f.name);
    const hasConsistentPattern = this.hasConsistentNamingPattern(names);
    if (hasConsistentPattern) {
      confidence += 20;
    }
    
    return Math.min(confidence, 100);
  }

  private hasConsistentNamingPattern(names: string[]): boolean {
    if (names.length < 2) return false;
    
    // Check for common patterns like version numbers, dates, etc.
    const patterns = [
      /v?\d+(\.\d+)*/,  // version numbers
      /\d{4}-\d{2}-\d{2}/, // dates
      /(old|new|backup|temp|tmp|prod|dev|test|staging)/, // common suffixes
      /\d{8}/ // timestamps
    ];
    
    for (const patternRegex of patterns) {
      let matches = 0;
      for (const name of names) {
        if (patternRegex.test(name)) {
          matches++;
        }
      }
      if (matches >= names.length * 0.8) {
        return true;
      }
    }
    
    return false;
  }

  generateComparisonPairs(files: BatchFile[]): Array<{
    left: BatchFile;
    right: BatchFile;
    reason: string;
    confidence: number;
  }> {
    const pairs: Array<{
      left: BatchFile;
      right: BatchFile;
      reason: string;
      confidence: number;
    }> = [];
    
    // Find matching file groups
    const matchingGroups = this.findMatchingFiles(files);
    
    for (const group of matchingGroups) {
      if (group.files.length >= 2) {
        // Sort by modification time
        const sortedFiles = [...group.files].sort((a, b) => a.lastModified - b.lastModified);
        
        // Create pairs between consecutive versions
        for (let i = 0; i < sortedFiles.length - 1; i++) {
          pairs.push({
            left: sortedFiles[i],
            right: sortedFiles[i + 1],
            reason: `Files match pattern "${group.pattern}" and appear to be sequential versions`,
            confidence: group.confidence
          });
        }
      }
    }
    
    // Add pairs for files in same directory with similar names
    const byDirectory = this.groupByDirectory(files);
    
    for (const [directory, dirFiles] of byDirectory) {
      if (dirFiles.length >= 2) {
        const similarPairs = this.findSimilarNamedFiles(dirFiles);
        
        for (const pair of similarPairs) {
          // Avoid duplicates
          const exists = pairs.some(p => 
            (p.left === pair.left && p.right === pair.right) ||
            (p.left === pair.right && p.right === pair.left)
          );
          
          if (!exists) {
            pairs.push({
              left: pair.left,
              right: pair.right,
              reason: `Files have similar names in directory "${directory}"`,
              confidence: pair.similarity * 100
            });
          }
        }
      }
    }
    
    return pairs.sort((a, b) => b.confidence - a.confidence);
  }

  private groupByDirectory(files: BatchFile[]): Map<string, BatchFile[]> {
    const groups = new Map<string, BatchFile[]>();
    
    for (const file of files) {
      const directory = file.path.split('/').slice(0, -1).join('/') || '/';
      if (!groups.has(directory)) {
        groups.set(directory, []);
      }
      groups.get(directory)!.push(file);
    }
    
    return groups;
  }

  private findSimilarNamedFiles(files: BatchFile[]): Array<{
    left: BatchFile;
    right: BatchFile;
    similarity: number;
  }> {
    const pairs: Array<{
      left: BatchFile;
      right: BatchFile;
      similarity: number;
    }> = [];
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const similarity = this.calculateNameSimilarity(files[i].name, files[j].name);
        
        if (similarity > 0.5) { // 50% similarity threshold
          pairs.push({
            left: files[i],
            right: files[j],
            similarity
          });
        }
      }
    }
    
    return pairs.sort((a, b) => b.similarity - a.similarity);
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    // Remove extensions for comparison
    const base1 = name1.replace(/\.[^.]+$/, '');
    const base2 = name2.replace(/\.[^.]+$/, '');
    
    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(base1.toLowerCase(), base2.toLowerCase());
    const maxLength = Math.max(base1.length, base2.length);
    
    return maxLength > 0 ? (maxLength - distance) / maxLength : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
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

  getDirectoryStatistics(files: BatchFile[]): {
    totalFiles: number;
    totalSize: number;
    averageSize: number;
    extensionCounts: Record<string, number>;
    directoryCounts: Record<string, number>;
    largestFiles: Array<{ name: string; size: number }>;
    oldestFiles: Array<{ name: string; lastModified: number }>;
    newestFiles: Array<{ name: string; lastModified: number }>;
  } {
    const extensionCounts: Record<string, number> = {};
    const directoryCounts: Record<string, number> = {};
    let totalSize = 0;
    
    for (const file of files) {
      totalSize += file.size;
      
      // Count extensions
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '');
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
      
      // Count directories
      const dir = file.path.split('/').slice(0, -1).join('/') || '/';
      directoryCounts[dir] = (directoryCounts[dir] || 0) + 1;
    }
    
    // Sort files by size and modification time
    const sortedBySize = [...files].sort((a, b) => b.size - a.size);
    const sortedByTime = [...files].sort((a, b) => a.lastModified - b.lastModified);
    
    return {
      totalFiles: files.length,
      totalSize,
      averageSize: files.length > 0 ? totalSize / files.length : 0,
      extensionCounts,
      directoryCounts,
      largestFiles: sortedBySize.slice(0, 10).map(f => ({ name: f.name, size: f.size })),
      oldestFiles: sortedByTime.slice(0, 10).map(f => ({ name: f.name, lastModified: f.lastModified })),
      newestFiles: sortedByTime.slice(-10).reverse().map(f => ({ name: f.name, lastModified: f.lastModified }))
    };
  }
}

// Utility functions
export function createIgnorePattern(patterns: string[]): RegExp {
  const escapedPatterns = patterns.map(patternStr => 
    patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
           .replace(/\\\*/g, '.*')
           .replace(/\\\?/g, '.')
  );
  
  return new RegExp(`^(${escapedPatterns.join('|')})$`, 'i');
}

export function filterFilesByPattern(files: BatchFile[], pattern: string): BatchFile[] {
  const regex = new RegExp(pattern, 'i');
  return files.filter(file => regex.test(file.name) || regex.test(file.path));
}

export function getFilesByExtension(files: BatchFile[], extension: string): BatchFile[] {
  const ext = extension.startsWith('.') ? extension : '.' + extension;
  return files.filter(file => file.name.toLowerCase().endsWith(ext.toLowerCase()));
}

export function getFilesModifiedAfter(files: BatchFile[], timestamp: number): BatchFile[] {
  return files.filter(file => file.lastModified > timestamp);
}

export function getFilesLargerThan(files: BatchFile[], size: number): BatchFile[] {
  return files.filter(file => file.size > size);
}