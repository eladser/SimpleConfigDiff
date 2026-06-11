import { useState, useMemo, useCallback } from 'react';
import { ComparisonResult } from '../types';
import { Search, X, ChevronRight, ChevronDown, Copy, Check, EyeOff } from 'lucide-react';

interface SideBySideDiffProps {
  result: ComparisonResult;
  onIgnoreKey?: (path: string) => void;
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
  depth: number;
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

// Handle XML paths like "configuration.connectionStrings.add[@name='db']"
const parseXmlPath = (path: string): { element: string; attribute?: string; fullPath: string } => {
  const parts = path.split('.');
  const lastPart = parts[parts.length - 1];

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

const getBreadcrumbPath = (pathParts: string[]): string => {
  return pathParts.map((part) => {
    const parsed = parseXmlPath(part);
    return parsed.element + (parsed.attribute ? `[${parsed.attribute}]` : '');
  }).join(' › ');
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Common prefix/suffix split for char-level highlight inside a changed value
function charBounds(a: string, b: string) {
  const minLen = Math.min(a.length, b.length);
  let p = 0;
  while (p < minLen && a[p] === b[p]) p++;
  let s = 0;
  while (s < minLen - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { p, s };
}

const charDiffable = (a: string, b: string) =>
  a.length <= 240 && b.length <= 240 && !a.includes('\n') && !b.includes('\n');

const TYPE_BORDER: Record<string, string> = {
  added: 'border-l-added',
  removed: 'border-l-removed',
  changed: 'border-l-changed',
  unchanged: 'border-l-transparent'
};

export function SideBySideDiff({ result, onIgnoreKey }: SideBySideDiffProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'changed'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat' | 'raw'>('grouped');
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1200);
    });
  }, []);

  const isDifferentFormats = result.leftFile.format !== result.rightFile.format;

  const filterCounts = useMemo(() => ({
    all: result.changes.length,
    added: result.changes.filter(c => c.type === 'added').length,
    removed: result.changes.filter(c => c.type === 'removed').length,
    changed: result.changes.filter(c => c.type === 'changed').length
  }), [result.changes]);

  const semanticDiff = useMemo(() => {
    if (!isDifferentFormats && viewMode === 'raw') {
      // Line-by-line for same formats in raw mode
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

    const semanticLines: DiffItem[] = [];

    const changesByPath = new Map<string, any>();
    result.changes.forEach((change) => {
      changesByPath.set(change.path, change);
    });

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

    semanticLines.sort((a: DiffItem, b: DiffItem) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.path.localeCompare(b.path);
    });

    return semanticLines;
  }, [result, isDifferentFormats, viewMode]);

  const groupedDiff = useMemo(() => {
    if (viewMode !== 'grouped') return [] as PathGroup[];

    const groups = new Map<string, PathGroup>();

    semanticDiff.forEach(item => {
      const parentPath = item.parentPath || 'root';

      if (!groups.has(parentPath)) {
        groups.set(parentPath, {
          basePath: parentPath,
          items: [],
          depth: parentPath === 'root' ? 0 : parentPath.split('.').length
        });
      }

      groups.get(parentPath)!.items.push(item);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.basePath.localeCompare(b.basePath);
    });
  }, [semanticDiff, viewMode]);

  const matchesFilters = useCallback((item: DiffItem) => {
    if (filterType !== 'all' && item.type !== filterType) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.path.toLowerCase().includes(q) ||
        item.fullPath.toLowerCase().includes(q) ||
        item.leftContent.toLowerCase().includes(q) ||
        item.rightContent.toLowerCase().includes(q) ||
        item.xmlElement?.toLowerCase().includes(q) ||
        item.xmlAttribute?.toLowerCase().includes(q) ||
        false
      );
    }

    return true;
  }, [filterType, searchTerm]);

  const filteredDiff = useMemo(
    () => semanticDiff.filter(matchesFilters),
    [semanticDiff, matchesFilters]
  );

  const filteredGroups = useMemo(() => {
    if (viewMode !== 'grouped') return [] as PathGroup[];
    return groupedDiff
      .map(g => ({ ...g, items: g.items.filter(matchesFilters) }))
      .filter(g => g.items.length > 0);
  }, [groupedDiff, matchesFilters, viewMode]);

  const visibleCount = viewMode === 'grouped'
    ? filteredGroups.reduce((n, g) => n + g.items.length, 0)
    : filteredDiff.length;

  const highlightSearchTerm = useCallback((text: string) => {
    if (!searchTerm) return text;

    const parts = text.split(new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === searchTerm.toLowerCase() ? (
        <mark key={index} className="bg-accent/25 text-fg rounded-sm px-0.5">
          {part}
        </mark>
      ) : part
    );
  }, [searchTerm]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterType('all');
  };

  const togglePath = (path: string) => {
    const next = new Set(collapsedPaths);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    setCollapsedPaths(next);
  };

  const hasActiveFilters = searchTerm || filterType !== 'all';

  const filterChips = [
    { value: 'all', label: 'all', count: filterCounts.all, color: 'text-fg' },
    { value: 'added', label: 'added', count: filterCounts.added, color: 'text-added' },
    { value: 'removed', label: 'removed', count: filterCounts.removed, color: 'text-removed' },
    { value: 'changed', label: 'changed', count: filterCounts.changed, color: 'text-changed' }
  ] as const;

  // Char-level: when a value changed and both sides are short single lines,
  // highlight only the span that differs instead of coloring the whole value
  const renderValueContent = (item: DiffItem, side: 'left' | 'right') => {
    const own = side === 'left' ? item.leftContent : item.rightContent;
    const other = side === 'left' ? item.rightContent : item.leftContent;

    if (!own) {
      const missing = side === 'left' ? item.type === 'added' : item.type === 'removed';
      return <span className="text-faint">{missing ? '—' : '(empty)'}</span>;
    }

    if (item.type === 'changed' && !searchTerm && own && other && charDiffable(own, other)) {
      const { p, s } = charBounds(item.leftContent, item.rightContent);
      const mid = own.slice(p, own.length - s);
      const markClass = side === 'left'
        ? 'bg-removed/20 text-removed rounded-sm'
        : 'bg-added/20 text-added rounded-sm';
      return (
        <>
          <span className="text-muted">{own.slice(0, p)}</span>
          {mid && <mark className={markClass}>{mid}</mark>}
          <span className="text-muted">{own.slice(own.length - s)}</span>
        </>
      );
    }

    const colorClass = side === 'left'
      ? (item.type === 'removed' || item.type === 'changed' ? 'text-removed' : 'text-muted')
      : (item.type === 'added' || item.type === 'changed' ? 'text-added' : 'text-muted');
    return <span className={colorClass}>{highlightSearchTerm(own)}</span>;
  };

  const renderDiffItem = (item: DiffItem) => {
    const copyValue = item.type === 'removed' ? item.leftContent : item.rightContent;
    return (
      <div key={item.key} className={`group border-l-2 ${TYPE_BORDER[item.type]}`}>
        <div className="px-4 pt-2.5 pb-1 flex items-center gap-2 min-w-0">
          <span className="font-mono text-sm text-fg truncate">
            {item.pathParts.length > 1 && (
              <span className="text-faint">{highlightSearchTerm(getBreadcrumbPath(item.pathParts.slice(0, -1)))} › </span>
            )}
            {highlightSearchTerm(item.xmlElement || item.pathParts[item.pathParts.length - 1])}
            {item.xmlAttribute && (
              <span className="text-muted"> [{highlightSearchTerm(item.xmlAttribute)}]</span>
            )}
          </span>
          {item.description && (
            <span className="text-xs text-faint shrink-0">{item.description}</span>
          )}

          {item.isPath && (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => copyToClipboard(item.fullPath, `${item.key}:path`)}
                className="p-1 text-faint hover:text-fg rounded transition-colors"
                title="Copy path"
              >
                {copiedKey === `${item.key}:path` ? <Check className="w-3 h-3 text-added" /> : <Copy className="w-3 h-3" />}
              </button>
              {copyValue && (
                <button
                  onClick={() => copyToClipboard(copyValue, `${item.key}:value`)}
                  className="p-1 font-mono text-[10px] text-faint hover:text-fg rounded transition-colors"
                  title="Copy value"
                >
                  {copiedKey === `${item.key}:value` ? <Check className="w-3 h-3 text-added" /> : 'val'}
                </button>
              )}
              {onIgnoreKey && (
                <button
                  onClick={() => onIgnoreKey(item.fullPath)}
                  className="p-1 text-faint hover:text-changed rounded transition-colors"
                  title="Ignore this key (adds an ignore rule)"
                >
                  <EyeOff className="w-3 h-3" />
                </button>
              )}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 pb-2.5">
          <div className="px-4 font-mono text-sm overflow-x-auto">
            <pre className="whitespace-pre-wrap">{renderValueContent(item, 'left')}</pre>
          </div>
          <div className="px-4 font-mono text-sm overflow-x-auto border-l border-border">
            <pre className="whitespace-pre-wrap">{renderValueContent(item, 'right')}</pre>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 flex-wrap">
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

        <div className="inline-flex items-center border border-border rounded-md overflow-hidden text-xs">
          {([['grouped', 'Grouped'], ['flat', 'Flat'], ['raw', 'Raw']] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2.5 py-1.5 transition-colors border-r border-border last:border-r-0 ${
                viewMode === mode ? 'bg-elevated text-fg' : 'bg-surface text-muted hover:text-fg'
              }`}
            >
              {label}
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

      {/* Column headers */}
      <div className="grid grid-cols-2 border-b border-border bg-elevated/50">
        <div className="px-4 py-1.5 font-mono text-xs text-faint truncate">{result.leftFile.name}</div>
        <div className="px-4 py-1.5 font-mono text-xs text-faint truncate border-l border-border">{result.rightFile.name}</div>
      </div>

      {/* Diff content */}
      {visibleCount === 0 ? (
        <div className="text-center py-14">
          <p className="font-mono text-sm text-muted">
            {hasActiveFilters ? 'Nothing matches the current filters' : 'No differences'}
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary text-xs mt-4">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {viewMode === 'grouped' ? (
            filteredGroups.map((group) => {
              const isCollapsed = collapsedPaths.has(group.basePath);
              return (
                <div key={group.basePath}>
                  <button
                    onClick={() => togglePath(group.basePath)}
                    className="flex items-center gap-2 w-full text-left px-4 py-2 bg-elevated/40 hover:bg-elevated transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-faint" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-faint" />
                    )}
                    <span className="font-mono text-sm text-fg">
                      {group.basePath === 'root' ? '/' : getBreadcrumbPath(group.basePath.split('.'))}
                    </span>
                    <span className="font-mono text-xs text-faint">
                      {group.items.length}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-border/60">
                      {group.items.map(renderDiffItem)}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            filteredDiff.map(renderDiffItem)
          )}
        </div>
      )}
    </div>
  );
}
