import { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DiffViewer } from '@/components/DiffViewer';
import { AdvancedOptionsPanel } from '@/components/AdvancedOptionsPanel';
import { SideBySideDiff } from '@/components/SideBySideDiff';
import { Header } from '@/components/Header';
import { FileUploadState, DiffOptions, ComparisonResult, DiffViewSettings } from '@/types';
import { detectFormat, parseConfig } from '@/utils/parsers';
import { generateDiff } from '@/utils/generateDiff';
import { RefreshCw, Download, BarChart3, Layers, SplitSquareHorizontal } from 'lucide-react';

function App() {
  const [leftFile, setLeftFile] = useState<FileUploadState>({
    file: null,
    content: '',
    format: null,
    isValid: false
  });
  
  const [rightFile, setRightFile] = useState<FileUploadState>({
    file: null,
    content: '',
    format: null,
    isValid: false
  });
  
  const [options, setOptions] = useState<DiffOptions>({
    ignoreKeys: [],
    caseSensitive: true,
    sortKeys: false,
    flattenKeys: false,
    // New advanced options with defaults
    semanticComparison: false,
    ignoreWhitespace: false,
    ignoreComments: false,
    pathRules: [],
    valueTransformations: [],
    diffMode: 'tree',
    showLineNumbers: true,
    contextLines: 3,
    minimalDiff: false
  });
  
  const [viewSettings, setViewSettings] = useState<DiffViewSettings>({
    highlightSyntax: true,
    showMinimap: false,
    wrapLines: true,
    fontSize: 14,
    theme: 'vs-dark'
  });
  
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleFileUpload = useCallback((file: File, side: 'left' | 'right') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const format = detectFormat(file.name, content);
      const parsed = parseConfig(content, format);
      
      const fileState: FileUploadState = {
        file,
        content,
        format,
        isValid: !parsed.error,
        error: parsed.error,
        lineCount: content.split('\n').length,
        size: file.size
      };
      
      if (side === 'left') {
        setLeftFile(fileState);
      } else {
        setRightFile(fileState);
      }
    };
    reader.readAsText(file);
  }, []);
  
  const handleCompare = useCallback(async () => {
    if (!leftFile.isValid || !rightFile.isValid || !leftFile.file || !rightFile.file) {
      setError('Please upload two valid configuration files');
      return;
    }
    
    setIsComparing(true);
    setError(null);
    
    try {
      const leftParsed = parseConfig(leftFile.content, leftFile.format!);
      const rightParsed = parseConfig(rightFile.content, rightFile.format!);
      
      if (leftParsed.error) {
        throw new Error(`Error parsing left file: ${leftParsed.error}`);
      }
      
      if (rightParsed.error) {
        throw new Error(`Error parsing right file: ${rightParsed.error}`);
      }
      
      const leftConfigFile = {
        name: leftFile.file.name,
        content: leftFile.content,
        format: leftFile.format!,
        parsedContent: leftParsed.data
      };
      
      const rightConfigFile = {
        name: rightFile.file.name,
        content: rightFile.content,
        format: rightFile.format!,
        parsedContent: rightParsed.data
      };
      
      const result = generateDiff(leftConfigFile, rightConfigFile, options);
      setComparisonResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during comparison');
    } finally {
      setIsComparing(false);
    }
  }, [leftFile, rightFile, options]);
  
  const handleReset = useCallback(() => {
    setLeftFile({
      file: null,
      content: '',
      format: null,
      isValid: false
    });
    setRightFile({
      file: null,
      content: '',
      format: null,
      isValid: false
    });
    setComparisonResult(null);
    setError(null);
  }, []);

  const handleExport = useCallback(() => {
    if (!comparisonResult) return;
    
    const exportData = {
      comparison: comparisonResult,
      options,
      timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diff-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [comparisonResult, options]);

  const handleDiffModeChange = useCallback((mode: 'tree' | 'side-by-side' | 'unified') => {
    setOptions(prev => ({ ...prev, diffMode: mode }));
  }, []);
  
  const canCompare = leftFile.isValid && rightFile.isValid;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* File Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <FileUpload
            title="Configuration File A"
            fileState={leftFile}
            onFileUpload={(file) => handleFileUpload(file, 'left')}
            placeholder="Drop your first config file here or click to browse"
          />
          
          <FileUpload
            title="Configuration File B"
            fileState={rightFile}
            onFileUpload={(file) => handleFileUpload(file, 'right')}
            placeholder="Drop your second config file here or click to browse"
          />
        </div>
        
        {/* Advanced Options Panel */}
        <div className="mb-8">
          <AdvancedOptionsPanel
            options={options}
            onOptionsChange={setOptions}
          />
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCompare}
              disabled={!canCompare || isComparing}
              className={`btn btn-primary flex items-center gap-2 px-6 py-3 text-lg font-semibold ${
                !canCompare || isComparing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isComparing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Comparing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Compare Files
                </>
              )}
            </button>
            
            <button
              onClick={handleReset}
              className="btn btn-secondary px-4 py-3"
            >
              Reset
            </button>

            {comparisonResult && (
              <button
                onClick={handleExport}
                className="btn btn-secondary px-4 py-3 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
          </div>
          
          {comparisonResult && (
            <div className="flex items-center gap-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Found {comparisonResult.summary.total} differences
              </div>
              
              {/* Diff Mode Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => handleDiffModeChange('tree')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors ${
                    options.diffMode === 'tree' 
                      ? 'bg-white dark:bg-gray-700 shadow-sm' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Tree
                </button>
                <button
                  onClick={() => handleDiffModeChange('side-by-side')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors ${
                    options.diffMode === 'side-by-side' 
                      ? 'bg-white dark:bg-gray-700 shadow-sm' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <SplitSquareHorizontal className="w-4 h-4" />
                  Side-by-Side
                </button>
                <button
                  onClick={() => handleDiffModeChange('unified')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm transition-colors ${
                    options.diffMode === 'unified' 
                      ? 'bg-white dark:bg-gray-700 shadow-sm' 
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Unified
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <div className="text-red-800 dark:text-red-300 font-medium">Error</div>
            </div>
            <div className="text-red-700 dark:text-red-300 mt-1">{error}</div>
          </div>
        )}
        
        {/* Results */}
        {comparisonResult && (
          <div className="space-y-6">
            {/* Statistics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {comparisonResult.summary.added}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Added</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {comparisonResult.summary.removed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Removed</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {comparisonResult.summary.changed}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Changed</div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {comparisonResult.stats.similarities.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Similarity</div>
              </div>
            </div>

            {/* Diff Viewer */}
            {options.diffMode === 'side-by-side' ? (
              <SideBySideDiff
                result={comparisonResult}
                settings={viewSettings}
                onSettingsChange={setViewSettings}
              />
            ) : options.diffMode === 'unified' ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Unified Diff</h3>
                <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {comparisonResult.unifiedDiff || 'No unified diff available'}
                </pre>
              </div>
            ) : (
              <DiffViewer
                result={comparisonResult}
                options={options}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;