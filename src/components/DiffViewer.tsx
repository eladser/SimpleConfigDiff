import { useState } from 'react';
import { ComparisonResult, DiffOptions } from '@/types';
import { DiffTree } from './DiffTree';
import { BarChart3 } from 'lucide-react';

interface DiffViewerProps {
  result: ComparisonResult;
  options: DiffOptions;
}

export function DiffViewer({ result, options }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  
  if (result.changes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          No Differences Found
        </h3>
        <p className="text-slate-600 dark:text-slate-300">
          The configuration files are identical with the current comparison settings.
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* View Mode Toggle - simplified for tree view */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Display Mode:</span>
          <div className="flex bg-slate-100 dark:bg-slate-700/70 rounded-xl p-1">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                viewMode === 'flat'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Flat View
            </button>
          </div>
        </div>
        
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {options.flattenKeys ? 'Flattened keys' : 'Nested structure'}
        </div>
      </div>
      
      {/* Diff Results */}
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
        <DiffTree
          changes={result.changes}
          viewMode={viewMode}
        />
      </div>
    </div>
  );
}