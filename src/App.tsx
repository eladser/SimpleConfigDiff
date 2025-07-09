import { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DiffViewer } from '@/components/DiffViewer';
import { AdvancedOptionsPanel } from '@/components/AdvancedOptionsPanel';
import { SideBySideDiff } from '@/components/SideBySideDiff';
import { Header } from '@/components/Header';
import { FileUploadState, DiffOptions, ComparisonResult, DiffViewSettings } from '@/types';
import { detectFormat, parseConfig } from '@/utils/parsers';
import { generateDiff } from '@/utils/generateDiff';
import { downloadDiff, downloadPDFDiff } from '@/utils/exportDiff';
import { downloadExcel } from '@/utils/exportExcel';
import { 
  RefreshCw, 
  Download, 
  BarChart3, 
  Layers, 
  SplitSquareHorizontal, 
  ChevronDown, 
  Settings,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Zap,
  ArrowRight
} from 'lucide-react';

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

  // Updated default options with all features disabled by default
  const [options, setOptions] = useState<DiffOptions>({
    ignoreKeys: [],
    caseSensitive: false,
    sortKeys: false,
    flattenKeys: false,
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

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
      
      // Smooth scroll to results
      setTimeout(() => {
        document.getElementById('comparison-results')?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
      
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

  const handleRecompare = useCallback(() => {
    if (comparisonResult) {
      handleCompare();
    }
  }, [comparisonResult, handleCompare]);
  
  const canCompare = leftFile.isValid && rightFile.isValid;
  const hasFiles = leftFile.file || rightFile.file;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Compare Configuration Files
            <span className="text-gradient"> with Ease</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Upload two configuration files and get intelligent, human-readable diffs with advanced analysis
          </p>
        </div>

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="transform transition-all duration-300 hover:scale-105">
            <FileUpload
              title="Configuration File A"
              fileState={leftFile}
              onFileUpload={(file) => handleFileUpload(file, 'left')}
              placeholder="Drop your first config file here or click to browse"
            />
          </div>
          
          <div className="transform transition-all duration-300 hover:scale-105">
            <FileUpload
              title="Configuration File B"
              fileState={rightFile}
              onFileUpload={(file) => handleFileUpload(file, 'right')}
              placeholder="Drop your second config file here or click to browse"
            />
          </div>
        </div>

        {/* Upload Status */}
        {hasFiles && (
          <div className="mb-8 animate-slide-up">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {leftFile.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      File A: {leftFile.file?.name || 'No file selected'}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <div className="flex items-center space-x-2">
                    {rightFile.isValid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      File B: {rightFile.file?.name || 'No file selected'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Advanced Options
                  </button>
                  
                  <button
                    onClick={handleCompare}
                    disabled={!canCompare || isComparing}
                    className={`flex items-center gap-2 px-8 py-3 text-lg font-semibold rounded-xl transition-all duration-200 ${
                      canCompare && !isComparing
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transform'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isComparing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Compare Files
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Options Panel */}
        {showAdvancedOptions && (
          <div className="mb-8 animate-slide-down">
            <AdvancedOptionsPanel
              options={options}
              onOptionsChange={setOptions}
            />
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mb-8 animate-shake">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                <div className="text-red-800 dark:text-red-300 font-medium">Error</div>
              </div>
              <div className="text-red-700 dark:text-red-300 mt-1">{error}</div>
            </div>
          </div>
        )}
        
        {/* Results Section */}
        {comparisonResult && (
          <div id="comparison-results" className="space-y-6 animate-fade-in">
            
            {/* Results Header */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Comparison Complete
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Found {comparisonResult.summary.total} differences
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRecompare}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Re-compare
                  </button>
                  
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Reset
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                    >
                      <Download className="w-4 h-4" />
                      Export
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showExportMenu && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 animate-scale-in">
                        <div className="py-2">
                          <button
                            onClick={() => handleExport('json')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            📄 JSON Report
                          </button>
                          <button
                            onClick={() => handleExport('csv')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            📊 CSV Export
                          </button>
                          <button
                            onClick={() => handleExport('html')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            🌐 HTML Report
                          </button>
                          <button
                            onClick={() => handleExport('patch')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            📝 Patch File
                          </button>
                          <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                          <button
                            onClick={() => handleExport('pdf')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            📄 PDF Report
                          </button>
                          <button
                            onClick={() => handleExport('xlsx')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            📊 Excel Export
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {comparisonResult.summary.added}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">Added</div>
                    </div>
                    <div className="p-2 bg-green-200 dark:bg-green-800 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {comparisonResult.summary.removed}
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300">Removed</div>
                    </div>
                    <div className="p-2 bg-red-200 dark:bg-red-800 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-red-600 dark:text-red-400 rotate-180" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {comparisonResult.summary.changed}
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">Changed</div>
                    </div>
                    <div className="p-2 bg-blue-200 dark:bg-blue-800 rounded-lg">
                      <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {comparisonResult.stats.similarities.toFixed(1)}%
                      </div>
                      <div className="text-sm text-purple-700 dark:text-purple-300">Similarity</div>
                    </div>
                    <div className="p-2 bg-purple-200 dark:bg-purple-800 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>Choose view mode:</span>
                </div>
                
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => handleDiffModeChange('tree')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                      options.diffMode === 'tree' 
                        ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Tree
                  </button>
                  <button
                    onClick={() => handleDiffModeChange('side-by-side')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                      options.diffMode === 'side-by-side' 
                        ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <SplitSquareHorizontal className="w-4 h-4" />
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => handleDiffModeChange('unified')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                      options.diffMode === 'unified' 
                        ? 'bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-white' 
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    Unified
                  </button>
                </div>
              </div>
            </div>

            {/* Diff Viewer */}
            <div className="animate-slide-up">
              {options.diffMode === 'side-by-side' ? (
                <SideBySideDiff
                  result={comparisonResult}
                  settings={viewSettings}
                  onSettingsChange={setViewSettings}
                />
              ) : options.diffMode === 'unified' ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Unified Diff</h3>
                  <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
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
          </div>
        )}
      </div>
      
      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}

export default App;