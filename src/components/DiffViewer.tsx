import { useState } from 'react';
import { ComparisonResult, DiffOptions } from '@/types';
import { DiffSummary } from './DiffSummary';
import { DiffTree } from './DiffTree';
import { FileInfo } from './FileInfo';
import { ExportOptions } from './ExportOptions';
import { BarChart3, List, Grid } from 'lucide-react';

interface DiffViewerProps {
  result: ComparisonResult;
  options: DiffOptions;
}

export function DiffViewer({ result, options }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  
  if (result.changes.length === 0) {
    return (
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-6 animate-fade-in">
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
      </div>
    );
  }
  
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary */}
      <DiffSummary result={result} />
      
      {/* File Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FileInfo
          title="File A"
          file={result.leftFile}
          type="left"
        />
        <FileInfo
          title="File B"
          file={result.rightFile}
          type="right"
        />
      </div>
      
      {/* Controls */}
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">View Mode:</span>
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  viewMode === 'tree'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Grid className="w-4 h-4" />
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
                <List className="w-4 h-4" />
                Flat View
              </button>
            </div>
          </div>
          
          <ExportOptions result={result} />
        </div>
      </div>
      
      {/* Diff Results */}
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Changes ({result.changes.length})
          </h3>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {options.flattenKeys ? 'Flattened keys' : 'Nested structure'}
          </div>
        </div>
        
        <DiffTree
          changes={result.changes}
          viewMode={viewMode}
        />
      </div>
    </div>
  );
}