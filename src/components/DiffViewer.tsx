import { useState } from 'react';
import { ComparisonResult, DiffOptions } from '@/types';
import { DiffTree } from './DiffTree';

interface DiffViewerProps {
  result: ComparisonResult;
  options: DiffOptions;
}

export function DiffViewer({ result, options }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');

  if (result.changes.length === 0) {
    return (
      <div className="text-center py-14">
        <p className="font-mono text-sm text-muted">
          No differences with the current settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center border border-border rounded-md overflow-hidden text-xs">
          {([['tree', 'Tree'], ['flat', 'Flat']] as const).map(([mode, label]) => (
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

        <span className="font-mono text-xs text-faint">
          {options.flattenKeys ? 'flattened keys' : 'nested'}
        </span>
      </div>

      <DiffTree changes={result.changes} viewMode={viewMode} />
    </div>
  );
}
