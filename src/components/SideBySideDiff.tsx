import { useState, useMemo, useCallback } from 'react';
import { ComparisonResult } from '@/types';
import { 
  Plus, 
  Minus, 
  RefreshCw, 
  Search, 
  Filter, 
  X, 
  GitBranch,
  FileText
} from 'lucide-react';

interface SideBySideDiffProps {
  result: ComparisonResult;
}

interface DiffItem {
  key: string;
  path: string;
  leftContent: string;
  rightContent: string;
  type: 'unchanged' | 'added' | 'removed' | 'changed';
  isPath: boolean;
  description?: string;
}

export function SideBySideDiff({ result }: SideBySideDiffProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'changed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'semantic' | 'raw'>('semantic');

  // Check if files have different formats
  const isDifferentFormats = result.leftFile.format !== result.rightFile.format;

  // Memoized filter counts
  const filterCounts = useMemo(() => ({
    all: result.changes.length,
    added: result.changes.filter(c => c.type === 'added').length,
    removed: result.changes.filter(c => c.type === 'removed').length,
    changed: result.changes.filter(c => c.type === 'changed').length
  }), [result.changes]);

  // Memoized semantic diff for different formats
  const semanticDiff = useMemo(() => {
    if (!isDifferentFormats && viewMode === 'raw') {
      // Use line-by-line diff for same formats in raw mode
      const leftLines = result.leftFile.content.split('\n');
      const rightLines = result.rightFile.content.split('\n');
      const maxLines = Math.max(leftLines.length, rightLines.length);
      
      const lines: DiffItem[] = [];
      for (let i = 0; i < maxLines; i++) {
        const leftLine = leftLines[i] || '';
        const rightLine = rightLines[i] || '';
        
        let type: 'unchanged' | 'added' | 'removed' | 'changed' = 'unchanged';
        if (leftLine !== rightLine) {
          if (!leftLine && rightLine) type = 'added';
          else if (leftLine && !rightLine) type = 'removed';
          else type = 'changed';
        }
        
        lines.push({
          key: `line-${i}`,
          path: `Line ${i + 1}`,
          leftContent: leftLine,
          rightContent: rightLine,
          type,
          isPath: false
        });
      }
      
      return lines;
    }

    // Use semantic diff based on changes
    const semanticLines: DiffItem[] = [];
    
    // Group changes by path for better organization
    const changesByPath = new Map<string, typeof result.changes[0]>();
    result.changes.forEach(change => {
      changesByPath.set(change.path, change);
    });

    // Create semantic comparison entries
    changesByPath.forEach((change, path) => {
      semanticLines.push({
        key: path,
        path: path,
        leftContent: change.type === 'added' ? '' : formatValue(change.oldValue),
        rightContent: change.type === 'removed' ? '' : formatValue(change.newValue),
        type: change.type,
        isPath: true,
        description: change.description
      });
    });

    // Sort by path for consistent ordering
    semanticLines.sort((a, b) => a.path.localeCompare(b.path));

    return semanticLines;
  }, [result.leftFile.content, result.rightFile.content, result.changes, isDifferentFormats, viewMode]);

  // Helper function to format values for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  // Memoized filtered diff
  const filteredDiff = useMemo(() => {
    let filtered = semanticDiff;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const pathMatch = item.path.toLowerCase().includes(searchLower);
        const leftMatch = item.leftContent.toLowerCase().includes(searchLower);
        const rightMatch = item.rightContent.toLowerCase().includes(searchLower);
        
        return pathMatch || leftMatch || rightMatch;
      });
    }

    return filtered;
  }, [semanticDiff, filterType, searchTerm]);

  const highlightSearchTerm = useCallback((text: string) => {
    if (!searchTerm) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 rounded px-1">
          {part}
        </mark>
      ) : part
    );
  }, [searchTerm]);

  const getItemTypeClass = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 dark:border-emerald-400';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400';
      case 'changed':
        return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400';
      default:
        return 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50';
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'removed':
        return <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'changed':
        return <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  const hasActiveFilters = searchTerm || filterType !== 'all';

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Side-by-Side Comparison
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Showing {filteredDiff.length} {viewMode === 'semantic' ? 'changes' : 'lines'}</span>
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
                Filtered
              </span>
            )}
          </div>
        </div>

        {/* Format Warning & View Mode Toggle */}
        {isDifferentFormats && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span className="font-medium text-amber-700 dark:text-amber-300">
                Different File Formats Detected
              </span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
              Comparing {result.leftFile.format?.toUpperCase()} vs {result.rightFile.format?.toUpperCase()}. 
              Semantic comparison shows meaningful differences in configuration values.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('semantic')}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'semantic'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <GitBranch className="w-4 h-4" />
                Semantic View
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                  viewMode === 'raw'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <FileText className="w-4 h-4" />
                Raw View
              </button>
            </div>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={`Search in ${viewMode === 'semantic' ? 'configuration keys and values' : 'file contents'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  showFilters || filterType !== 'all'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {filterType !== 'all' && (
                  <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5">
                    1
                  </span>
                )}
              </button>
              
              {showFilters && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xl z-30 animate-scale-in">
                  <div className="p-2">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-2">
                      Filter by type:
                    </div>
                    {[
                      { value: 'all', label: 'All Changes', count: filterCounts.all },
                      { value: 'added', label: 'Added', count: filterCounts.added },
                      { value: 'removed', label: 'Removed', count: filterCounts.removed },
                      { value: 'changed', label: 'Changed', count: filterCounts.changed }
                    ].map(({ value, label, count }) => (
                      <button
                        key={value}
                        onClick={() => setFilterType(value as any)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded-lg transition-colors ${
                          filterType === value
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                      >
                        <span>{label}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all duration-200"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* File Headers */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {result.leftFile.name}
            </h4>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Format: {result.leftFile.format?.toUpperCase()} • Lines: {result.leftFile.content.split('\n').length}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
              {result.rightFile.name}
            </h4>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Format: {result.rightFile.format?.toUpperCase()} • Lines: {result.rightFile.content.split('\n').length}
            </div>
          </div>
        </div>

        {/* Diff Content */}
        <div className="border border-slate-200/50 dark:border-slate-700/50 rounded-xl overflow-hidden">
          {filteredDiff.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No Results Found
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-4">
                {hasActiveFilters ? 'Try adjusting your search terms or filters' : 'No differences found'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredDiff.map((item) => (
                <div
                  key={item.key}
                  className={`transition-colors ${getItemTypeClass(item.type)}`}
                >
                  {/* Path/Key header for semantic view */}
                  {viewMode === 'semantic' && (
                    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900/50 border-b border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2">
                        {getItemIcon(item.type)}
                        <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                          {highlightSearchTerm(item.path)}
                        </span>
                        {item.description && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Content comparison */}
                  <div className="grid grid-cols-2 gap-0">
                    {/* Left content */}
                    <div className="px-4 py-3 font-mono text-sm text-slate-800 dark:text-slate-200 overflow-x-auto">
                      <pre className="whitespace-pre-wrap">
                        {item.leftContent ? highlightSearchTerm(item.leftContent) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
                            {item.type === 'added' ? '(not present)' : '(empty)'}
                          </span>
                        )}
                      </pre>
                    </div>
                    
                    {/* Right content */}
                    <div className="px-4 py-3 font-mono text-sm text-slate-800 dark:text-slate-200 overflow-x-auto border-l border-slate-200 dark:border-slate-700">
                      <pre className="whitespace-pre-wrap">
                        {item.rightContent ? highlightSearchTerm(item.rightContent) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">
                            {item.type === 'removed' ? '(not present)' : '(empty)'}
                          </span>
                        )}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              {viewMode === 'semantic' ? 'Total changes' : 'Total lines compared'}: {semanticDiff.length}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{filterCounts.added}
              </span>
              <span className="text-red-600 dark:text-red-400">
                -{filterCounts.removed}
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                ~{filterCounts.changed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Click outside to close filter menu */}
      {showFilters && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}