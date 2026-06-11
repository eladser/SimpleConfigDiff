import { useState, useMemo, useCallback } from 'react';
import { ComparisonResult } from '../types';
import { 
  Plus, 
  Minus, 
  RefreshCw, 
  Search, 
  Filter, 
  X, 
  GitBranch,
  ChevronRight,
  ChevronDown,
  Code2,
  Map as MapIcon,
  Eye,
  EyeOff
} from 'lucide-react';

interface SideBySideDiffProps {
  result: ComparisonResult;
}

interface DiffItem {
  key: string;
  path: string;
  fullPath: string;
  leftContent: string;
  rightContent: string;
  type: 'unchanged' | 'added' | 'removed' | 'changed';
  isPath: boolean;
  description?: string;
  pathParts: string[];
  depth: number;
  parentPath?: string;
  xmlAttribute?: string;
  xmlElement?: string;
}

interface PathGroup {
  basePath: string;
  items: DiffItem[];
  isExpanded: boolean;
  depth: number;
}

// Helper function to format values for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

// Helper function to parse XML-like paths
const parseXmlPath = (path: string): { element: string; attribute?: string; fullPath: string } => {
  // Handle XML paths like "configuration.connectionStrings.add[@name='aioDatabaseConnectionString']"
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];
  
  // Check if last part has attributes
  const attributeMatch = lastPart.match(/^([^[]+)\[@([^=]+)=['"]([^'"]+)['"]]/);
  if (attributeMatch) {
    return {
      element: attributeMatch[1],
      attribute: `${attributeMatch[2]}="${attributeMatch[3]}"`,
      fullPath: path
    };
  }
  
  return {
    element: lastPart,
    fullPath: path
  };
};

// Helper function to get breadcrumb path
const getBreadcrumbPath = (pathParts: string[]): string => {
  return pathParts.map((part) => {
    const parsed = parseXmlPath(part);
    return parsed.element + (parsed.attribute ? `[${parsed.attribute}]` : '');
  }).join(' › ');
};

export function EnhancedSideBySideDiff({ result }: SideBySideDiffProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'changed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'semantic' | 'raw' | 'hierarchical'>('hierarchical');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [showFullPaths, setShowFullPaths] = useState(true);
  const [groupByPath, setGroupByPath] = useState(true);

  // Check if files have different formats
  const isDifferentFormats = result.leftFile.format !== result.rightFile.format;

  // Memoized filter counts
  const filterCounts = useMemo(() => ({
    all: result.changes.length,
    added: result.changes.filter(c => c.type === 'added').length,
    removed: result.changes.filter(c => c.type === 'removed').length,
    changed: result.changes.filter(c => c.type === 'changed').length
  }), [result.changes]);

  // Enhanced semantic diff with better path handling
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
          fullPath: `Line ${i + 1}`,
          leftContent: leftLine,
          rightContent: rightLine,
          type,
          isPath: false,
          pathParts: [`Line ${i + 1}`],
          depth: 0
        });
      }
      
      return lines;
    }

    // Enhanced semantic diff with better path structure
    const semanticLines: DiffItem[] = [];
    
    // Group changes by path for better organization
    const changesByPath = new Map<string, any>();
    result.changes.forEach((change) => {
      changesByPath.set(change.path, change);
    });

    // Create semantic comparison entries with enhanced path info
    changesByPath.forEach((change: any, path: string) => {
      const pathParts = path.split('.');
      const xmlInfo = parseXmlPath(path);
      
      semanticLines.push({
        key: path,
        path: path,
        fullPath: path,
        leftContent: change.type === 'added' ? '' : formatValue(change.oldValue),
        rightContent: change.type === 'removed' ? '' : formatValue(change.newValue),
        type: change.type,
        isPath: true,
        description: change.description,
        pathParts,
        depth: pathParts.length - 1,
        parentPath: pathParts.slice(0, -1).join('.'),
        xmlAttribute: xmlInfo.attribute,
        xmlElement: xmlInfo.element
      });
    });

    // Sort by path for consistent ordering
    semanticLines.sort((a: DiffItem, b: DiffItem) => {
      // First by depth, then by path
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.path.localeCompare(b.path);
    });

    return semanticLines;
  }, [result.leftFile.content, result.rightFile.content, result.changes, isDifferentFormats, viewMode]);

  // Group items by path hierarchy
  const groupedDiff = useMemo(() => {
    if (!groupByPath || viewMode !== 'hierarchical') return [] as PathGroup[];

    const groups = new Map<string, PathGroup>();
    const items = [...semanticDiff];

    items.forEach(item => {
      const parentPath = item.parentPath || 'root';
      
      if (!groups.has(parentPath)) {
        groups.set(parentPath, {
          basePath: parentPath,
          items: [],
          isExpanded: expandedPaths.has(parentPath),
          depth: parentPath === 'root' ? 0 : parentPath.split('.').length
        });
      }
      
      const group = groups.get(parentPath);
      if (group) {
        group.items.push(item);
      }
    });

    const groupsArray = Array.from(groups.values()) as PathGroup[];
    return groupsArray.sort((a: PathGroup, b: PathGroup) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.basePath.localeCompare(b.basePath);
    });
  }, [semanticDiff, groupByPath, viewMode, expandedPaths]);

  // Memoized filtered diff
  const filteredDiff = useMemo(() => {
    let filtered = viewMode === 'hierarchical' && groupByPath ? 
      groupedDiff.flatMap((group: PathGroup) => group.items) : 
      semanticDiff;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const pathMatch = item.path.toLowerCase().includes(searchLower);
        const fullPathMatch = item.fullPath.toLowerCase().includes(searchLower);
        const leftMatch = item.leftContent.toLowerCase().includes(searchLower);
        const rightMatch = item.rightContent.toLowerCase().includes(searchLower);
        const elementMatch = item.xmlElement?.toLowerCase().includes(searchLower);
        const attributeMatch = item.xmlAttribute?.toLowerCase().includes(searchLower);
        
        return pathMatch || fullPathMatch || leftMatch || rightMatch || elementMatch || attributeMatch;
      });
    }

    return filtered;
  }, [semanticDiff, groupedDiff, filterType, searchTerm, viewMode, groupByPath]);

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

  const togglePathExpansion = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const hasActiveFilters = searchTerm || filterType !== 'all';

  const renderPathHeader = (group: PathGroup) => (
    <div className="bg-slate-100 dark:bg-slate-900/50 px-4 py-3 border-b border-slate-200/50 dark:border-slate-700/50">
      <button
        onClick={() => togglePathExpansion(group.basePath)}
        className="flex items-center gap-2 w-full text-left hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg p-2 transition-colors"
      >
        {group.isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        )}
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {group.basePath === 'root' ? 'Root Level' : getBreadcrumbPath(group.basePath.split('.'))}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          ({group.items.length} change{group.items.length !== 1 ? 's' : ''})
        </span>
      </button>
    </div>
  );

  const renderDiffItem = (item: DiffItem) => (
    <div key={item.key} className={`transition-colors ${getItemTypeClass(item.type)}`}>
      {/* Path/Key header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-2">
          {getItemIcon(item.type)}
          <div className="flex-1 min-w-0">
            {showFullPaths ? (
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {highlightSearchTerm(getBreadcrumbPath(item.pathParts))}
                </div>
                <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.xmlElement && (
                    <span className="text-blue-600 dark:text-blue-400">
                      {highlightSearchTerm(item.xmlElement)}
                    </span>
                  )}
                  {item.xmlAttribute && (
                    <span className="text-purple-600 dark:text-purple-400 ml-2">
                      [{highlightSearchTerm(item.xmlAttribute)}]
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                {highlightSearchTerm(item.path)}
              </div>
            )}
          </div>
          {item.description && (
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
              {item.description}
            </span>
          )}
        </div>
      </div>
      
      {/* Content comparison */}
      <div className="grid grid-cols-2 gap-0">
        {/* Left content */}
        <div className="px-4 py-3 font-mono text-sm text-slate-800 dark:text-slate-200 overflow-x-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              {result.leftFile.name}
            </span>
          </div>
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
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
              {result.rightFile.name}
            </span>
          </div>
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
  );

  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Enhanced Side-by-Side Comparison
          </h3>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>Showing {filteredDiff.length} changes</span>
            {hasActiveFilters && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
                Filtered
              </span>
            )}
          </div>
        </div>

        {/* Enhanced Controls */}
        <div className="space-y-4 mb-6">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">View Mode:</span>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg p-1">
                {[
                  { mode: 'hierarchical', icon: MapIcon, label: 'Hierarchical' },
                  { mode: 'semantic', icon: GitBranch, label: 'Semantic' },
                  { mode: 'raw', icon: Code2, label: 'Raw' }
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === mode 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFullPaths(!showFullPaths)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  showFullPaths 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                    : 'bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400'
                }`}
              >
                {showFullPaths ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Full Paths
              </button>

              {viewMode === 'hierarchical' && (
                <button
                  onClick={() => setGroupByPath(!groupByPath)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    groupByPath 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                      : 'bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Group by Path
                </button>
              )}
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search in paths, elements, attributes, or values..."
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
              {viewMode === 'hierarchical' && groupByPath ? (
                groupedDiff.map((group: PathGroup) => (
                  <div key={group.basePath}>
                    {renderPathHeader(group)}
                    {group.isExpanded && (
                      <div className="divide-y divide-slate-200 dark:divide-slate-700">
                        {group.items.map(renderDiffItem)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                filteredDiff.map(renderDiffItem)
              )}
            </div>
          )}
        </div>

        {/* Enhanced Statistics */}
        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Total changes: {semanticDiff.length} | Filtered: {filteredDiff.length}
            </span>
            <div className="flex items-center gap-4">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{filterCounts.added} added
              </span>
              <span className="text-red-600 dark:text-red-400">
                -{filterCounts.removed} removed
              </span>
              <span className="text-blue-600 dark:text-blue-400">
                ~{filterCounts.changed} changed
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
