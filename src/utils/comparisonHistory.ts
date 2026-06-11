import { ComparisonResult, DiffOptions } from '@/types';

export interface ComparisonHistoryEntry {
  id: string;
  timestamp: number;
  title: string;
  description?: string;
  leftFile: {
    name: string;
    format: string;
    size: number;
    lastModified: number;
  };
  rightFile: {
    name: string;
    format: string;
    size: number;
    lastModified: number;
  };
  result: ComparisonResult;
  options: DiffOptions;
  tags?: string[];
  favorite?: boolean;
}

export interface ComparisonHistoryStats {
  totalComparisons: number;
  totalFiles: number;
  commonFormats: Array<{ format: string; count: number }>;
  averageChanges: number;
  recentActivity: Array<{ date: string; count: number }>;
}

export class ComparisonHistory {
  private static readonly STORAGE_KEY = 'simpleConfigDiff_history';
  private static readonly MAX_ENTRIES = 1000;
  private static readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024; // 50MB
  
  private entries: ComparisonHistoryEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  add(
    result: ComparisonResult,
    options: DiffOptions,
    title?: string,
    description?: string,
    tags?: string[]
  ): string {
    const id = this.generateId();
    const entry: ComparisonHistoryEntry = {
      id,
      timestamp: Date.now(),
      title: title || this.generateTitle(result),
      description,
      leftFile: {
        name: result.leftFile.name,
        format: result.leftFile.format,
        size: result.leftFile.size || 0,
        lastModified: result.leftFile.lastModified || Date.now()
      },
      rightFile: {
        name: result.rightFile.name,
        format: result.rightFile.format,
        size: result.rightFile.size || 0,
        lastModified: result.rightFile.lastModified || Date.now()
      },
      result,
      options,
      tags: tags || [],
      favorite: false
    };

    this.entries.unshift(entry);
    this.cleanup();
    this.saveToStorage();
    
    return id;
  }

  get(id: string): ComparisonHistoryEntry | null {
    return this.entries.find(entry => entry.id === id) || null;
  }

  getAll(): ComparisonHistoryEntry[] {
    return [...this.entries];
  }

  getRecent(limit: number = 10): ComparisonHistoryEntry[] {
    return this.entries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getFavorites(): ComparisonHistoryEntry[] {
    return this.entries.filter(entry => entry.favorite);
  }

  search(query: string, filters?: {
    format?: string;
    tags?: string[];
    dateRange?: { start: number; end: number };
  }): ComparisonHistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    
    return this.entries.filter(entry => {
      // Text search
      const matchesQuery = !query || 
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.description?.toLowerCase().includes(lowerQuery) ||
        entry.leftFile.name.toLowerCase().includes(lowerQuery) ||
        entry.rightFile.name.toLowerCase().includes(lowerQuery);

      // Format filter
      const matchesFormat = !filters?.format || 
        entry.leftFile.format === filters.format ||
        entry.rightFile.format === filters.format;

      // Tags filter
      const matchesTags = !filters?.tags?.length ||
        filters.tags.some(tag => entry.tags?.includes(tag));

      // Date range filter
      const matchesDateRange = !filters?.dateRange ||
        (entry.timestamp >= filters.dateRange.start &&
         entry.timestamp <= filters.dateRange.end);

      return matchesQuery && matchesFormat && matchesTags && matchesDateRange;
    });
  }

  update(id: string, updates: Partial<ComparisonHistoryEntry>): boolean {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index === -1) return false;

    this.entries[index] = {
      ...this.entries[index],
      ...updates,
      id, // Prevent ID changes
      timestamp: this.entries[index].timestamp, // Preserve original timestamp
      result: this.entries[index].result, // Preserve result
      options: this.entries[index].options // Preserve options
    };

    this.saveToStorage();
    return true;
  }

  delete(id: string): boolean {
    const index = this.entries.findIndex(entry => entry.id === id);
    if (index === -1) return false;

    this.entries.splice(index, 1);
    this.saveToStorage();
    return true;
  }

  toggleFavorite(id: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;

    entry.favorite = !entry.favorite;
    this.saveToStorage();
    return true;
  }

  addTag(id: string, tag: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;

    if (!entry.tags) entry.tags = [];
    if (!entry.tags.includes(tag)) {
      entry.tags.push(tag);
      this.saveToStorage();
    }
    return true;
  }

  removeTag(id: string, tag: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry || !entry.tags) return false;

    const index = entry.tags.indexOf(tag);
    if (index > -1) {
      entry.tags.splice(index, 1);
      this.saveToStorage();
    }
    return true;
  }

  getAllTags(): string[] {
    const tags = new Set<string>();
    this.entries.forEach(entry => {
      entry.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  getStats(): ComparisonHistoryStats {
    const formatCounts = new Map<string, number>();
    const dailyCounts = new Map<string, number>();
    let totalChanges = 0;

    this.entries.forEach(entry => {
      // Format counts
      const leftFormat = entry.leftFile.format;
      const rightFormat = entry.rightFile.format;
      formatCounts.set(leftFormat, (formatCounts.get(leftFormat) || 0) + 1);
      formatCounts.set(rightFormat, (formatCounts.get(rightFormat) || 0) + 1);

      // Daily counts
      const date = new Date(entry.timestamp).toDateString();
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);

      // Total changes
      totalChanges += entry.result.summary.total;
    });

    const commonFormats = Array.from(formatCounts.entries())
      .map(([format, count]) => ({ format, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentActivity = Array.from(dailyCounts.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30);

    return {
      totalComparisons: this.entries.length,
      totalFiles: this.entries.length * 2, // Each comparison has 2 files
      commonFormats,
      averageChanges: this.entries.length > 0 ? totalChanges / this.entries.length : 0,
      recentActivity
    };
  }

  export(): string {
    const exportData = {
      version: '1.0',
      exported: new Date().toISOString(),
      entries: this.entries.map(entry => ({
        ...entry,
        // Remove large result data for export
        result: {
          summary: entry.result.summary,
          metadata: entry.result.metadata
        }
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  import(data: string): { success: boolean; imported: number; errors: string[] } {
    const result = { success: false, imported: 0, errors: [] as string[] };

    try {
      const importData = JSON.parse(data);
      
      if (!importData.entries || !Array.isArray(importData.entries)) {
        result.errors.push('Invalid import format: missing entries array');
        return result;
      }

      const validEntries = importData.entries.filter((entry: any) => {
        return entry.id && entry.timestamp && entry.title && entry.leftFile && entry.rightFile;
      });

      if (validEntries.length === 0) {
        result.errors.push('No valid entries found in import data');
        return result;
      }

      // Merge with existing entries, avoiding duplicates
      const existingIds = new Set(this.entries.map(e => e.id));
      const newEntries = validEntries.filter((entry: any) => !existingIds.has(entry.id));

      this.entries.push(...newEntries);
      this.cleanup();
      this.saveToStorage();

      result.success = true;
      result.imported = newEntries.length;
      
      if (validEntries.length > newEntries.length) {
        result.errors.push(`${validEntries.length - newEntries.length} entries were skipped (duplicates)`);
      }

    } catch (error) {
      result.errors.push(`Failed to parse import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  clear(): void {
    this.entries = [];
    this.saveToStorage();
  }

  private generateId(): string {
    return `comparison_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTitle(result: ComparisonResult): string {
    const leftName = result.leftFile.name.split('.')[0];
    const rightName = result.rightFile.name.split('.')[0];
    
    if (leftName === rightName) {
      return `${leftName} (${result.summary.total} changes)`;
    }
    
    return `${leftName} vs ${rightName} (${result.summary.total} changes)`;
  }

  private cleanup(): void {
    // Remove excess entries
    if (this.entries.length > ComparisonHistory.MAX_ENTRIES) {
      this.entries = this.entries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, ComparisonHistory.MAX_ENTRIES);
    }

    // Check storage size and remove old entries if needed
    const storageSize = this.calculateStorageSize();
    if (storageSize > ComparisonHistory.MAX_STORAGE_SIZE) {
      this.entries = this.entries
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, Math.floor(ComparisonHistory.MAX_ENTRIES * 0.8));
    }
  }

  private calculateStorageSize(): number {
    try {
      return JSON.stringify(this.entries).length;
    } catch {
      return 0;
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(ComparisonHistory.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (Array.isArray(data)) {
          this.entries = data;
        }
      }
    } catch (error) {
      console.warn('Failed to load comparison history from storage:', error);
      this.entries = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(ComparisonHistory.STORAGE_KEY, JSON.stringify(this.entries));
    } catch (error) {
      console.warn('Failed to save comparison history to storage:', error);
      // If storage fails, try to free up space by removing old entries
      this.entries = this.entries.slice(0, Math.floor(this.entries.length * 0.5));
      try {
        localStorage.setItem(ComparisonHistory.STORAGE_KEY, JSON.stringify(this.entries));
      } catch {
        // If it still fails, clear the history
        this.entries = [];
      }
    }
  }
}

// Singleton instance
export const comparisonHistory = new ComparisonHistory();

// Utility functions
export function saveComparison(
  result: ComparisonResult,
  options: DiffOptions,
  title?: string,
  description?: string,
  tags?: string[]
): string {
  return comparisonHistory.add(result, options, title, description, tags);
}

export function loadComparison(id: string): ComparisonHistoryEntry | null {
  return comparisonHistory.get(id);
}

export function searchComparisons(query: string, filters?: {
  format?: string;
  tags?: string[];
  dateRange?: { start: number; end: number };
}): ComparisonHistoryEntry[] {
  return comparisonHistory.search(query, filters);
}

export function getRecentComparisons(limit: number = 10): ComparisonHistoryEntry[] {
  return comparisonHistory.getRecent(limit);
}

export function getFavoriteComparisons(): ComparisonHistoryEntry[] {
  return comparisonHistory.getFavorites();
}

export function getComparisonStats(): ComparisonHistoryStats {
  return comparisonHistory.getStats();
}

export function exportHistory(): string {
  return comparisonHistory.export();
}

export function importHistory(data: string): { success: boolean; imported: number; errors: string[] } {
  return comparisonHistory.import(data);
}

export function clearHistory(): void {
  comparisonHistory.clear();
}