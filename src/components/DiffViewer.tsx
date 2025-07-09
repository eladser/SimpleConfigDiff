import React, { useState } from 'react';
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
      <div className="card animate-fade-in">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-8 h-8 text-success-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Differences Found
          </h3>
          <p className="text-gray-600">
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
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">View Mode:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('tree')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid className="w-4 h-4" />
                Tree View
              </button>
              <button
                onClick={() => setViewMode('flat')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'flat'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Changes ({result.changes.length})
          </h3>
          <div className="text-sm text-gray-500">
            {options.flattenKeys ? 'Flattened keys' : 'Nested structure'}
          </div>
        </div>
        
        <DiffTree
          changes={result.changes}
          viewMode={viewMode}
          options={options}
        />
      </div>
    </div>
  );
}