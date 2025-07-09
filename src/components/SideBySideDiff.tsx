import { useState, useMemo } from 'react';
import { ComparisonResult } from '@/types';
import { Search, ChevronRight, ChevronDown, Plus, Minus, Edit3, Eye, EyeOff } from 'lucide-react';

interface SideBySideDiffProps {
  result: ComparisonResult;
}

interface DiffEntry {
  path: string;
  leftValue: any;
  rightValue: any;
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  leftLine?: number;
  rightLine?: number;
}

export function SideBySideDiff({ result }: SideBySideDiffProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(true);

  // Generate diff entries from changes
  const diffEntries = useMemo(() => {
    const entries: DiffEntry[] = [];
    
    // Add changed/removed/added entries
    result.changes.forEach(change => {
      entries.push({
        path: change.path,
        leftValue: change.oldValue,
        rightValue: change.newValue,
        type: change.type,
        leftLine: change.lineNumber?.left,
        rightLine: change.lineNumber?.right
      });
    });

    // If showing all content, we'd need to merge with unchanged content
    // For now, we'll just show the changes in a clear format
    
    return entries;
  }, [result.changes]);

  const filteredEntries = useMemo(() => {
    let filtered = diffEntries;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(entry => 
        entry.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(entry.leftValue || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(entry.rightValue || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by differences only
    if (showOnlyDifferences) {
      filtered = filtered.filter(entry => entry.type !== 'unchanged');
    }

    return filtered;
  }, [diffEntries, searchQuery, showOnlyDifferences]);

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const formatValue = (value: any) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'added': return <Plus className="w-4 h-4 text-emerald-600" />;
      case 'removed': return <Minus className="w-4 h-4 text-red-600" />;
      case 'changed': return <Edit3 className="w-4 h-4 text-blue-600" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'added': return 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500';
      case 'removed': return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500';
      case 'changed': return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500';
      default: return 'bg-white dark:bg-slate-800';
    }
  };

  const getCellColor = (type: string, side: 'left' | 'right') => {
    if (type === 'added') {
      return side === 'right' ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-50 dark:bg-slate-800/50';
    }
    if (type === 'removed') {
      return side === 'left' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-50 dark:bg-slate-800/50';
    }
    if (type === 'changed') {
      return side === 'left' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30';
    }
    return 'bg-white dark:bg-slate-800';
  };

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50/90 dark:bg-slate-700/90 backdrop-blur-xl px-6 py-4 border-b border-slate-200/50 dark:border-slate-600/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Beyond Compare View
            </h3>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                {result.summary.added} Added
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                {result.summary.removed} Removed
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                {result.summary.changed} Changed
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                showOnlyDifferences 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                  : 'bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {showOnlyDifferences ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showOnlyDifferences ? 'Show All' : 'Differences Only'}
            </button>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search paths, keys, or values..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* File Headers */}
      <div className="grid grid-cols-2 border-b border-slate-200/50 dark:border-slate-600/50">
        <div className="px-6 py-3 bg-red-50/50 dark:bg-red-900/10 border-r border-slate-200/50 dark:border-slate-600/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {result.leftFile.name}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {result.leftFile.format.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-3 bg-emerald-50/50 dark:bg-emerald-900/10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            <div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {result.rightFile.name}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {result.rightFile.format.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diff Content */}
      <div className="max-h-[600px] overflow-auto">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-500 dark:text-slate-400">
              {searchQuery ? 'No matches found' : 'No differences to show'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-200/50 dark:divide-slate-600/50">
            {filteredEntries.map((entry, index) => (
              <div
                key={index}
                className={`transition-all duration-200 ${getTypeColor(entry.type)}`}
              >
                {/* Path Header */}
                <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-700/50">
                  <button
                    onClick={() => togglePath(entry.path)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 w-full text-left"
                  >
                    {expandedPaths.has(entry.path) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    {getTypeIcon(entry.type)}
                    <span className="font-mono text-slate-900 dark:text-slate-100">{entry.path}</span>
                  </button>
                </div>

                {/* Content */}
                {expandedPaths.has(entry.path) && (
                  <div className="grid grid-cols-2">
                    {/* Left Side */}
                    <div className={`px-6 py-4 border-r border-slate-200/50 dark:border-slate-600/50 ${getCellColor(entry.type, 'left')}`}>
                      {entry.leftLine && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          Line {entry.leftLine}
                        </div>
                      )}
                      <div className="flex items-center justify-center min-h-[80px]">
                        <div className="w-full max-w-full">
                          <pre className="text-sm font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words text-center">
                            {entry.type === 'added' ? (
                              <span className="text-slate-400 dark:text-slate-500 italic">
                                (not present)
                              </span>
                            ) : (
                              formatValue(entry.leftValue)
                            )}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {/* Right Side */}
                    <div className={`px-6 py-4 ${getCellColor(entry.type, 'right')}`}>
                      {entry.rightLine && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          Line {entry.rightLine}
                        </div>
                      )}
                      <div className="flex items-center justify-center min-h-[80px]">
                        <div className="w-full max-w-full">
                          <pre className="text-sm font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words text-center">
                            {entry.type === 'removed' ? (
                              <span className="text-slate-400 dark:text-slate-500 italic">
                                (not present)
                              </span>
                            ) : (
                              formatValue(entry.rightValue)
                            )}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50/90 dark:bg-slate-700/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-600/50">
        <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-4">
            <span>Total Changes: {result.summary.total}</span>
            <span>Similarity: {result.stats.similarities.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Showing {filteredEntries.length} of {diffEntries.length} entries</span>
            <button
              onClick={() => {
                if (expandedPaths.size === filteredEntries.length) {
                  setExpandedPaths(new Set());
                } else {
                  setExpandedPaths(new Set(filteredEntries.map(entry => entry.path)));
                }
              }}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
            >
              {expandedPaths.size === filteredEntries.length ? 'Collapse All' : 'Expand All'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}