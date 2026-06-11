import { useState, useMemo } from 'react';
import { DiffChange } from '@/types';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
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

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TYPE_MARK: Record<string, { sign: string; color: string }> = {
  added: { sign: '+', color: 'text-added' },
  removed: { sign: '-', color: 'text-removed' },
  changed: { sign: '~', color: 'text-changed' }
};

export function DiffTree({ changes, viewMode }: DiffTreeProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'changed'>('all');

  const toggleNode = (path: string) => {
    const next = new Set(collapsedNodes);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setCollapsedNodes(next);
  };

  const filteredChanges = useMemo(() => {
    let filtered = changes;

    if (filterType !== 'all') {
      filtered = filtered.filter(change => change.type === filterType);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(change =>
        change.path.toLowerCase().includes(q) ||
        (change.oldValue && String(change.oldValue).toLowerCase().includes(q)) ||
        (change.newValue && String(change.newValue).toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [changes, filterType, searchTerm]);

  const buildTree = (changes: DiffChange[]): TreeNode[] => {
    const tree: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

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
            nodeMap.get(parentPath)?.children.push(node);
          } else {
            tree.push(node);
          }
        } else if (isLast) {
          const node = nodeMap.get(currentPath)!;
          node.change = change;
          node.isFolder = false;
        }
      });
    });

    return tree;
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm) return text;

    const parts = text.split(new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-accent/25 text-fg rounded-sm px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  const filterCounts = useMemo(() => ({
    all: changes.length,
    added: changes.filter(c => c.type === 'added').length,
    removed: changes.filter(c => c.type === 'removed').length,
    changed: changes.filter(c => c.type === 'changed').length
  }), [changes]);

  const hasActiveFilters = searchTerm || filterType !== 'all';

  const renderValue = (change: DiffChange) => {
    if (change.type === 'changed') {
      return (
        <span className="flex items-center gap-2 font-mono text-sm min-w-0">
          <span className="text-removed truncate">{highlightSearchTerm(formatValue(change.oldValue))}</span>
          <span className="text-faint shrink-0">→</span>
          <span className="text-added truncate">{highlightSearchTerm(formatValue(change.newValue))}</span>
        </span>
      );
    }
    if (change.type === 'added') {
      return (
        <span className="font-mono text-sm text-added truncate">
          {highlightSearchTerm(formatValue(change.newValue))}
        </span>
      );
    }
    return (
      <span className="font-mono text-sm text-removed truncate">
        {highlightSearchTerm(formatValue(change.oldValue))}
      </span>
    );
  };

  const renderTreeNode = (node: TreeNode, level: number = 0) => {
    const isCollapsed = collapsedNodes.has(node.path);
    const hasChildren = node.children.length > 0;
    const mark = node.change ? TYPE_MARK[node.change.type] : null;

    return (
      <div key={node.path} className="select-none">
        <div
          className="flex items-center gap-2 py-1 pr-2 rounded hover:bg-elevated/60 transition-colors min-w-0"
          style={{ paddingLeft: `${level * 18 + 4}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleNode(node.path)}
              className="flex items-center justify-center w-4 h-4 text-faint hover:text-fg transition-colors shrink-0"
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <span className={`w-4 text-center font-mono text-sm shrink-0 ${mark?.color ?? 'text-faint'}`}>
              {mark?.sign ?? ''}
            </span>
          )}

          <span className={`font-mono text-sm shrink-0 ${node.isFolder ? 'text-muted' : 'text-fg'}`}>
            {highlightSearchTerm(node.key)}
          </span>

          {node.change && (
            <div className="ml-auto pl-4 min-w-0">
              {renderValue(node.change)}
            </div>
          )}
        </div>

        {hasChildren && !isCollapsed && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderFlatView = () => (
    <div className="divide-y divide-border/60">
      {filteredChanges.map((change, index) => {
        const mark = TYPE_MARK[change.type];
        return (
          <div key={index} className="flex items-center gap-3 py-2 min-w-0">
            <span className={`font-mono text-sm w-4 text-center shrink-0 ${mark.color}`}>{mark.sign}</span>
            <span className="font-mono text-sm text-fg shrink-0">
              {highlightSearchTerm(change.path)}
            </span>
            <div className="ml-auto pl-4 min-w-0">
              {renderValue(change)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const filterChips = [
    { value: 'all', label: 'all', count: filterCounts.all, color: 'text-fg' },
    { value: 'added', label: 'added', count: filterCounts.added, color: 'text-added' },
    { value: 'removed', label: 'removed', count: filterCounts.removed, color: 'text-removed' },
    { value: 'changed', label: 'changed', count: filterCounts.changed, color: 'text-changed' }
  ] as const;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search paths or values"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm font-mono border border-border rounded-md bg-bg text-fg placeholder:text-faint focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1 font-mono text-xs">
          {filterChips.map(({ value, label, count, color }) => (
            <button
              key={value}
              onClick={() => setFilterType(value)}
              className={`px-2 py-1 rounded transition-colors ${
                filterType === value
                  ? 'bg-elevated border border-border-strong'
                  : 'border border-transparent hover:bg-elevated'
              }`}
            >
              <span className={color}>{count}</span>
              <span className="text-faint ml-1">{label}</span>
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-fg transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {filteredChanges.length === 0 && hasActiveFilters ? (
        <div className="text-center py-10">
          <p className="font-mono text-sm text-muted">Nothing matches the current filters</p>
          <button onClick={clearFilters} className="btn-secondary text-xs mt-4">
            Clear filters
          </button>
        </div>
      ) : viewMode === 'flat' ? (
        renderFlatView()
      ) : (
        <div>
          {buildTree(filteredChanges).map(node => renderTreeNode(node))}
        </div>
      )}
    </div>
  );
}
