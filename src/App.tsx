import { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DirectoryUpload } from '@/components/DirectoryUpload';
import { DirectoryComparison } from '@/components/DirectoryComparison';
import { DiffViewer } from '@/components/DiffViewer';
import { AdvancedOptionsPanel } from '@/components/AdvancedOptionsPanel';
import { SideBySideDiff } from '@/components/SideBySideDiff';
import { Header } from '@/components/Header';
import { FileUploadState, DiffOptions, ComparisonResult, DiffViewSettings } from '@/types';
import { detectFormat, parseConfig } from '@/utils/parsers';
import { generateDiff } from '@/utils/generateDiff';
import { downloadDiff, downloadPDFDiff } from '@/utils/exportDiff';
import { downloadExcel } from '@/utils/exportExcel';
import { RefreshCw, Download, BarChart3, Layers, SplitSquareHorizontal, ChevronDown, Files, Folder } from 'lucide-react';

interface DirectoryFile {
  path: string;
  file: File;
  relativePath: string;
  isSupported: boolean;
  format?: string;
  size: number;
}

type ComparisonMode = 'files' | 'directories';

function App() {
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('files');
  
  // File comparison state
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

  // Directory comparison state
  const [leftDirectory, setLeftDirectory] = useState<DirectoryFile[]>([]);
  const [rightDirectory, setRightDirectory] = useState<DirectoryFile[]>([]);
  const [selectedDirectoryFiles, setSelectedDirectoryFiles] = useState<{
    left?: DirectoryFile;
    right?: DirectoryFile;
  }>({});
  
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
    showLineNumbers: true,
    wrapLines: true,
    fontSize: 14,
    theme: 'vs-dark'
  });
  
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const readFileContent = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);
  
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

  const handleDirectoryUpload = useCallback((files: DirectoryFile[], side: 'left' | 'right') => {
    if (side === 'left') {
      setLeftDirectory(files);
    } else {
      setRightDirectory(files);
    }
  }, []);

  const handleDirectoryFileSelect = useCallback((leftFile?: DirectoryFile, rightFile?: DirectoryFile) => {
    setSelectedDirectoryFiles({ left: leftFile, right: rightFile });
    
    // Auto-compare the selected files
    if (leftFile || rightFile) {
      compareDirectoryFiles(leftFile, rightFile);
    }
  }, []);

  const compareDirectoryFiles = useCallback(async (leftFile?: DirectoryFile, rightFile?: DirectoryFile) => {
    if (!leftFile && !rightFile) return;
    
    setIsComparing(true);
    setError(null);
    
    try {
      // Read file contents
      const leftContent = leftFile ? await readFileContent(leftFile.file) : '';
      const rightContent = rightFile ? await readFileContent(rightFile.file) : '';
      
      // Parse contents
      const leftFormat = leftFile ? detectFormat(leftFile.file.name, leftContent) : null;
      const rightFormat = rightFile ? detectFormat(rightFile.file.name, rightContent) : null;
      
      const leftParsed = leftContent && leftFormat ? parseConfig(leftContent, leftFormat) : { data: {}, format: leftFormat };
      const rightParsed = rightContent && rightFormat ? parseConfig(rightContent, rightFormat) : { data: {}, format: rightFormat };
      
      if (leftParsed.error) {
        throw new Error(`Error parsing left file: ${leftParsed.error}`);
      }
      
      if (rightParsed.error) {
        throw new Error(`Error parsing right file: ${rightParsed.error}`);
      }
      
      const leftConfigFile = {
        name: leftFile?.file.name || 'Empty',
        content: leftContent,
        format: leftFormat || 'text',
        parsedContent: leftParsed.data
      };
      
      const rightConfigFile = {
        name: rightFile?.file.name || 'Empty',
        content: rightContent,
        format: rightFormat || 'text',
        parsedContent: rightParsed.data
      };
      
      const result = generateDiff(leftConfigFile, rightConfigFile, options);
      setComparisonResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during comparison');
    } finally {
      setIsComparing(false);
    }
  }, [options, readFileContent]);
  
  const handleCompare = useCallback(async () => {
    if (comparisonMode === 'files') {
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
    } else {
      // Directory comparison mode
      if (leftDirectory.length === 0 && rightDirectory.length === 0) {
        setError('Please upload directories to compare');
        return;
      }
      
      // For directory mode, we'll show the directory comparison view
      setComparisonResult(null);
    }
  }, [comparisonMode, leftFile, rightFile, leftDirectory, rightDirectory, options]);
  
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
    setLeftDirectory([]);
    setRightDirectory([]);
    setSelectedDirectoryFiles({});
    setComparisonResult(null);
    setError(null);
  }, []);

  const handleExport = useCallback(async (format: 'json' | 'csv' | 'html' | 'patch' | 'pdf' | 'xlsx') => {
    if (!comparisonResult) return;
    
    const exportOptions = {
      includeMetadata: true,
      includeStats: true,
      includeContext: true
    };
    
    try {
      if (format === 'pdf') {
        await downloadPDFDiff(comparisonResult, options, exportOptions);
      } else if (format === 'xlsx') {
        downloadExcel(comparisonResult, options, exportOptions);
      } else {
        downloadDiff(comparisonResult, options, format, exportOptions);
      }
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
      setError(`${format.toUpperCase()} export failed. Please try again.`);
    }
    
    setShowExportMenu(false);
  }, [comparisonResult, options]);

  const handleDiffModeChange = useCallback((mode: 'tree' | 'side-by-side' | 'unified') => {
    setOptions(prev => ({ ...prev, diffMode: mode }));
  }, []);

  const handleModeChange = useCallback((mode: ComparisonMode) => {
    setComparisonMode(mode);
    setComparisonResult(null);
    setError(null);
  }, []);
  
  const canCompare = comparisonMode === 'files' 
    ? leftFile.isValid && rightFile.isValid 
    : leftDirectory.length > 0 || rightDirectory.length > 0;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode Toggle */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => handleModeChange('files')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                comparisonMode === 'files' 
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Files className="w-4 h-4" />
              Compare Files
            </button>
            <button
              onClick={() => handleModeChange('directories')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                comparisonMode === 'directories' 
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Folder className="w-4 h-4" />
              Compare Directories
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {comparisonMode === 'files' ? (
            <>
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
            </>
          ) : (
            <>
              <DirectoryUpload
                title="Directory A"
                onDirectoryUpload={(files) => handleDirectoryUpload(files, 'left')}
              />
              
              <DirectoryUpload
                title="Directory B"
                onDirectoryUpload={(files) => handleDirectoryUpload(files, 'right')}
              />
            </>
          )}
        </div>

        {/* Directory Comparison View */}
        {comparisonMode === 'directories' && (leftDirectory.length > 0 || rightDirectory.length > 0) && (
          <div className="mb-8">
            <DirectoryComparison
              leftFiles={leftDirectory}
              rightFiles={rightDirectory}
              onFileSelect={handleDirectoryFileSelect}
              selectedComparison={selectedDirectoryFiles.left || selectedDirectoryFiles.right ? {
                leftFile: selectedDirectoryFiles.left,
                rightFile: selectedDirectoryFiles.right,
                relativePath: selectedDirectoryFiles.left?.relativePath || selectedDirectoryFiles.right?.relativePath || '',
                status: 'unchanged'
              } : undefined}
            />
          </div>
        )}
        
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
                  {comparisonMode === 'files' ? 'Compare Files' : 'Compare Directories'}
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
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn btn-secondary px-4 py-3 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showExportMenu && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                    <div className="py-1">
                      <button
                        onClick={() => handleExport('json')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        📄 JSON Report
                      </button>
                      <button
                        onClick={() => handleExport('csv')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        📊 CSV Export
                      </button>
                      <button
                        onClick={() => handleExport('html')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        🌐 HTML Report
                      </button>
                      <button
                        onClick={() => handleExport('patch')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        📝 Patch File
                      </button>
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                      <button
                        onClick={() => handleExport('pdf')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        📄 PDF Report
                      </button>
                      <button
                        onClick={() => handleExport('xlsx')}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        📊 Excel Export
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
      
      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}

export default App;