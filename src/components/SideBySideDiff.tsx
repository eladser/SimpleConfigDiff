import { useState, useMemo, useCallback } from 'react';
import { ComparisonResult } from '@/types';
import { 
  Plus, 
  Minus, 
  RefreshCw, 
  Search, 
  Filter, 
  X, 
  Eye, 
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface SideBySideDiffProps {
  result: ComparisonResult;
}

export function SideBySideDiff({ result }: SideBySideDiffProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'changed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Memoized filtered changes
  const filteredChanges = useMemo(() => {
    let filtered = result.changes;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(change => change.type === filterType);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(change => {
        const pathMatch = change.path.toLowerCase().includes(searchLower);
        const oldValueMatch = change.oldValue && 
          String(change.oldValue).toLowerCase().includes(searchLower);
        const newValueMatch = change.newValue && 
          String(change.newValue).toLowerCase().includes(searchLower);
        
        return pathMatch || oldValueMatch || newValueMatch;
      });
    }

    return filtered;
  }, [result.changes, filterType, searchTerm]);

  // Memoized filter counts
  const filterCounts = useMemo(() => ({
    all: result.changes.length,
    added: result.changes.filter(c => c.type === 'added').length,
    removed: result.changes.filter(c => c.type === 'removed').length,
    changed: result.changes.filter(c => c.type === 'changed').length
  }), [result.changes]);

  // Memoized line-by-line diff
  const lineDiff = useMemo(() => {
    const leftLines = result.leftFile.content.split('\n');
    const rightLines = result.rightFile.content.split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);
    
    const lines = [];
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
        lineNumber: i + 1,
        leftContent: leftLine,
        rightContent: rightLine,
        type
      });
    }
    
    return lines;
  }, [result.leftFile.content, result.rightFile.content]);

  // Memoized visible lines (for performance)
  const visibleLines = useMemo(() => {
    let lines = lineDiff;
    
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      lines = lines.filter(line => 
        line.leftContent.toLowerCase().includes(searchLower) ||
        line.rightContent.toLowerCase().includes(searchLower)
      );
    }
    
    // Filter by type
    if (filterType !== 'all') {
      lines = lines.filter(line => line.type === filterType);
    }
    
    // Filter unchanged lines
    if (!showUnchanged) {
      lines = lines.filter(line => line.type !== 'unchanged');
    }
    
    return lines;
  }, [lineDiff, searchTerm, filterType, showUnchanged]);

  const toggleSection = useCallback((path: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(path)) {
      newCollapsed.delete(path);
    } else {
      newCollapsed.add(path);
    }
    setCollapsedSections(newCollapsed);
  }, [collapsedSections]);

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

  const getLineTypeClass = (type: string) => {
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

  const getLineIcon = (type: string) => {
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
    setShowUnchanged(false);
  };

  const hasActiveFilters = searchTerm || filterType !== 'all' || showUnchanged;

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Side-by-Side Comparison
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Showing {visibleLines.length} lines</span>
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
                Filtered
              </span>
            )}
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search in file contents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUnchanged(!showUnchanged)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                showUnchanged
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {showUnchanged ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showUnchanged ? 'Hide' : 'Show'} Unchanged
            </button>

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
                      { value: 'all', label: 'All Lines', count: filterCounts.all },
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
          {visibleLines.length === 0 ? (
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
              {visibleLines.map((line, index) => (
                <div
                  key={index}
                  className={`grid grid-cols-12 gap-0 transition-colors ${getLineTypeClass(line.type)}`}
                >
                  {/* Line numbers */}
                  <div className="col-span-1 px-4 py-2 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    {line.lineNumber}
                  </div>
                  
                  {/* Change indicator */}
                  <div className="col-span-1 px-2 py-2 flex items-center justify-center">
                    {getLineIcon(line.type)}
                  </div>
                  
                  {/* Left content */}
                  <div className="col-span-5 px-4 py-2 font-mono text-sm text-slate-800 dark:text-slate-200 overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {highlightSearchTerm(line.leftContent)}
                    </pre>
                  </div>
                  
                  {/* Right content */}
                  <div className="col-span-5 px-4 py-2 font-mono text-sm text-slate-800 dark:text-slate-200 overflow-x-auto border-l border-slate-200 dark:border-slate-700">
                    <pre className="whitespace-pre-wrap">
                      {highlightSearchTerm(line.rightContent)}
                    </pre>
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
              Total lines compared: {lineDiff.length}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{lineDiff.filter(l => l.type === 'added').length}
              </span>
              <span className="text-red-600 dark:text-red-400">
                -{lineDiff.filter(l => l.type === 'removed').length}
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                ~{lineDiff.filter(l => l.type === 'changed').length}
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