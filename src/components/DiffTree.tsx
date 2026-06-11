import { useState, useMemo } from 'react';
import { DiffChange } from '@/types';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Minus, 
  RefreshCw, 
  Folder, 
  FolderOpen,
  Search,
  Filter,
  X
} from 'lucide-react';
import { formatValue } from '@/utils/generateDiff';

interface DiffTreeProps {
  changes: DiffChange[];
  viewMode: 'tree' | 'flat';
}

interface TreeNode {
  path: string;
  key: string;
  children: TreeNode[];
  change?: DiffChange;
  isFolder: boolean;
}

export function DiffTree({ changes, viewMode }: DiffTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'changed'>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  // Filter and search changes
  const filteredChanges = useMemo(() => {
    let filtered = changes;

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
  }, [changes, filterType, searchTerm]);

  const buildTree = (changes: DiffChange[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();
    
    // Create root nodes for each change
    changes.forEach(change => {
      const pathParts = change.path.split('.');
      let currentPath = '';
      
      pathParts.forEach((part, index) => {
        const isLast = index === pathParts.length - 1;
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        
        if (!nodeMap.has(currentPath)) {
          const node: TreeNode = {
            path: currentPath,
            key: part,
            children: [],
            change: isLast ? change : undefined,
            isFolder: !isLast
          };
          
          nodeMap.set(currentPath, node);
          
          if (parentPath) {
            const parent = nodeMap.get(parentPath);
            if (parent) {
              parent.children.push(node);
            }
          } else {
            tree.push(node);
          }
        } else if (isLast) {
          // Update existing node with change
          const node = nodeMap.get(currentPath)!;
          node.change = change;
          node.isFolder = false;
        }
      });
    });
    
    return tree;
  };
  
  const getChangeIcon = (type: DiffChange['type']) => {
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
  
  const getChangeClass = (type: DiffChange['type']) => {
    switch (type) {
      case 'added':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 dark:border-emerald-400';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 dark:border-red-400';
      case 'changed':
        return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400';
      default:
        return '';
    }
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800/50 rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  const getFilterCounts = () => {
    const counts = {
      all: changes.length,
      added: changes.filter(c => c.type === 'added').length,
      removed: changes.filter(c => c.type === 'removed').length,
      changed: changes.filter(c => c.type === 'changed').length
    };
    return counts;
  };

  const filterCounts = getFilterCounts();
  const hasActiveFilters = searchTerm || filterType !== 'all';
  
  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.path);
    const hasChildren = node.children.length > 0;
    
    return (
      <div key={node.path} className="select-none">
        <div
          className={`flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
            node.change ? getChangeClass(node.change.type) : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleNode(node.path)}
              className="flex items-center justify-center w-4 h-4 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              ) : (
                <ChevronRight className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              )}
            </button>
          )}
          
          {!hasChildren && <div className="w-4" />}
          
          {node.isFolder ? (
            isExpanded ? (
              <FolderOpen className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            ) : (
              <Folder className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            )
          ) : (
            node.change && getChangeIcon(node.change.type)
          )}
          
          <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
            {highlightSearchTerm(node.key)}
          </span>
          
          {node.change && (
            <div className="flex items-center gap-2 ml-auto">
              {node.change.type === 'changed' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                    {highlightSearchTerm(formatValue(node.change.oldValue))}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">→</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                    {highlightSearchTerm(formatValue(node.change.newValue))}
                  </span>
                </div>
              )}
              
              {node.change.type === 'added' && (
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                  {highlightSearchTerm(formatValue(node.change.newValue))}
                </span>
              )}
              
              {node.change.type === 'removed' && (
                <span className="text-red-600 dark:text-red-400 font-mono text-sm bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                  {highlightSearchTerm(formatValue(node.change.oldValue))}
                </span>
              )}
            </div>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  
  const renderFlatView = () => {
    return (
      <div className="space-y-2">
        {filteredChanges.map((change, index) => (
          <div
            key={index}
            className={`flex items-center gap-3 p-3 rounded-lg ${getChangeClass(change.type)}`}
          >
            {getChangeIcon(change.type)}
            
            <div className="flex-1">
              <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
                {highlightSearchTerm(change.path)}
              </div>
              
              <div className="flex items-center gap-2 mt-1 text-sm">
                {change.type === 'changed' && (
                  <>
                    <span className="text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                      {highlightSearchTerm(formatValue(change.oldValue))}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500">→</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                      {highlightSearchTerm(formatValue(change.newValue))}
                    </span>
                  </>
                )}
                
                {change.type === 'added' && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                    {highlightSearchTerm(formatValue(change.newValue))}
                  </span>
                )}
                
                {change.type === 'removed' && (
                  <span className="text-red-600 dark:text-red-400 font-mono bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                    {highlightSearchTerm(formatValue(change.oldValue))}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search changes, paths, or values..."
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

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
        <span>
          Showing {filteredChanges.length} of {changes.length} changes
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
              Filtered
            </span>
          )}
        </span>
        {filteredChanges.length === 0 && hasActiveFilters && (
          <span className="text-amber-600 dark:text-amber-400">
            No matches found
          </span>
        )}
      </div>

      {/* Results */}
      {filteredChanges.length === 0 && hasActiveFilters ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No Results Found
          </h3>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Try adjusting your search terms or filters
          </p>
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'flat' ? (
            renderFlatView()
          ) : (
            <div className="space-y-1">
              {buildTree(filteredChanges).map(node => renderTreeNode(node))}
            </div>
          )}
        </>
      )}

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