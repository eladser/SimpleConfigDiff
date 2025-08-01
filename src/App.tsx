import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { AdvancedOptionsPanel } from '@/components/AdvancedOptionsPanel';
import { SideBySideDiff } from '@/components/SideBySideDiff';
import { EnhancedSideBySideDiff } from '@/components/EnhancedSideBySideDiff';
import { Header } from '@/components/Header';
import { FileUploadState, DiffOptions, ComparisonResult, ConfigFormat } from '@/types';
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
  ArrowRight,
  FileText,
  Loader2,
  Sparkles
} from 'lucide-react';

// Lazy load heavy components
const DiffViewer = lazy(() => import('@/components/DiffViewer').then(module => ({ default: module.DiffViewer })));

// Loading skeleton component
const LoadingSkeleton = () => (
  <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 animate-pulse">
    <div className="space-y-4">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/4"></div>
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
        ))}
      </div>
    </div>
  </div>
);

// Memoized statistics component
const StatisticsCards = ({ comparisonResult }: { comparisonResult: ComparisonResult }) => {
  const stats = useMemo(() => [
    {
      value: comparisonResult.summary.added,
      label: 'Added',
      color: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20',
      borderColor: 'border-emerald-200/50 dark:border-emerald-700/50',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-200 dark:bg-emerald-800/50',
      icon: TrendingUp
    },
    {
      value: comparisonResult.summary.removed,
      label: 'Removed',
      color: 'from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20',
      borderColor: 'border-red-200/50 dark:border-red-700/50',
      textColor: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-200 dark:bg-red-800/50',
      icon: TrendingUp,
      iconClass: 'rotate-180'
    },
    {
      value: comparisonResult.summary.changed,
      label: 'Changed',
      color: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
      borderColor: 'border-blue-200/50 dark:border-blue-700/50',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-200 dark:bg-blue-800/50',
      icon: RefreshCw
    },
    {
      value: `${comparisonResult.stats.similarities.toFixed(1)}%`,
      label: 'Similarity',
      color: 'from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20',
      borderColor: 'border-purple-200/50 dark:border-purple-700/50',
      textColor: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-200 dark:bg-purple-800/50',
      icon: BarChart3
    }
  ], [comparisonResult]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <div key={index} className={`bg-gradient-to-br ${stat.color} rounded-xl p-4 border ${stat.borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-3xl font-bold ${stat.textColor}`}>
                {stat.value}
              </div>
              <div className={`text-sm font-medium ${stat.textColor} opacity-80`}>
                {stat.label}
              </div>
            </div>
            <div className={`p-2 ${stat.bgColor} rounded-lg`}>
              <stat.icon className={`w-5 h-5 ${stat.textColor} ${stat.iconClass || ''}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Enhanced view mode toggle
const ViewModeToggle = ({ options, onDiffModeChange, useEnhanced, setUseEnhanced }: { 
  options: DiffOptions; 
  onDiffModeChange: (mode: 'tree' | 'side-by-side' | 'unified') => void;
  useEnhanced: boolean;
  setUseEnhanced: (enhanced: boolean) => void;
}) => {
  const viewModes = useMemo(() => [
    { mode: 'side-by-side', icon: SplitSquareHorizontal, label: 'Side-by-Side' },
    { mode: 'tree', icon: Layers, label: 'Tree' },
    { mode: 'unified', icon: FileText, label: 'Unified' }
  ], []);

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/70 rounded-xl p-1">
        {viewModes.map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => onDiffModeChange(mode as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              options.diffMode === mode 
                ? 'bg-white dark:bg-slate-800 shadow-md text-slate-900 dark:text-slate-100' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      
      {/* Enhanced Mode Toggle */}
      <button
        onClick={() => setUseEnhanced(!useEnhanced)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
          useEnhanced 
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' 
            : 'bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        Enhanced Mode
      </button>
    </div>
  );
};

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
    caseSensitive: false,
    sortKeys: false,
    flattenKeys: false,
    semanticComparison: false,
    ignoreWhitespace: false,
    ignoreComments: false,
    pathRules: [],
    valueTransformations: [],
    diffMode: 'side-by-side',
    showLineNumbers: true,
    contextLines: 3,
    minimalDiff: false
  });
  
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [useEnhanced, setUseEnhanced] = useState(true);

  const handleFileUpload = useCallback((file: File, side: 'left' | 'right') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const format = detectFormat(file.name, content);
      
      // Use requestIdleCallback for non-blocking parsing
      const parseInBackground = () => {
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

      if ('requestIdleCallback' in window) {
        requestIdleCallback(parseInBackground);
      } else {
        setTimeout(parseInBackground, 0);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleTextPaste = useCallback((text: string, format: string, side: 'left' | 'right') => {
    const configFormat = format as ConfigFormat;
    
    // Use requestIdleCallback for non-blocking parsing
    const parseInBackground = () => {
      const parsed = parseConfig(text, configFormat);
      
      const fileState: FileUploadState = {
        file: null,
        content: text,
        format: configFormat,
        isValid: !parsed.error,
        error: parsed.error,
        lineCount: text.split('\n').length,
        size: new Blob([text]).size
      };
      
      if (side === 'left') {
        setLeftFile(fileState);
      } else {
        setRightFile(fileState);
      }
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(parseInBackground);
    } else {
      setTimeout(parseInBackground, 0);
    }
  }, []);

  const performComparison = useCallback(async () => {
    if (!leftFile.isValid || !rightFile.isValid) {
      setError('Please provide two valid configuration files or texts');
      return;
    }
    
    setIsComparing(true);
    setError(null);
    
    try {
      // Use a small delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const leftParsed = parseConfig(leftFile.content, leftFile.format!);
      const rightParsed = parseConfig(rightFile.content, rightFile.format!);
      
      if (leftParsed.error) {
        throw new Error(`Error parsing left file: ${leftParsed.error}`);
      }
      
      if (rightParsed.error) {
        throw new Error(`Error parsing right file: ${rightParsed.error}`);
      }
      
      const leftConfigFile = {
        name: leftFile.file?.name || 'Left Text',
        content: leftFile.content,
        format: leftFile.format!,
        parsedContent: leftParsed.data
      };
      
      const rightConfigFile = {
        name: rightFile.file?.name || 'Right Text',
        content: rightFile.content,
        format: rightFile.format!,
        parsedContent: rightParsed.data
      };
      
      // Run diff generation in background
      const diffGeneration = () => {
        const result = generateDiff(leftConfigFile, rightConfigFile, options);
        setComparisonResult(result);
        setIsComparing(false);
      };

      if ('requestIdleCallback' in window) {
        requestIdleCallback(diffGeneration);
      } else {
        setTimeout(diffGeneration, 0);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during comparison');
      setIsComparing(false);
    }
  }, [leftFile, rightFile, options]);

  const handleCompare = useCallback(() => {
    performComparison();
  }, [performComparison]);

  const handleRecompare = useCallback(() => {
    setComparisonResult(null);
    setError(null);
    setIsComparing(true);
    
    setTimeout(() => {
      performComparison();
    }, 50);
  }, [performComparison]);

  // Debounced options change handler
  const handleOptionsChange = useCallback((newOptions: DiffOptions) => {
    setOptions(newOptions);
    
    if (comparisonResult && leftFile.isValid && rightFile.isValid) {
      const timeoutId = setTimeout(() => {
        performComparison();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [comparisonResult, leftFile.isValid, rightFile.isValid, performComparison]);
  
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
    setShowAdvancedOptions(false);
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

  const generateUnifiedDiff = useCallback(() => {
    if (!comparisonResult) return 'No comparison result available';
    
    const lines = [];
    lines.push(`--- ${leftFile.file?.name || 'Left Text'}`);
    lines.push(`+++ ${rightFile.file?.name || 'Right Text'}`);
    lines.push('');
    
    comparisonResult.changes.forEach((change) => {
      const path = change.path || '';
      
      if (change.type === 'added') {
        lines.push(`+${path}: ${JSON.stringify(change.newValue)}`);
      } else if (change.type === 'removed') {
        lines.push(`-${path}: ${JSON.stringify(change.oldValue)}`);
      } else if (change.type === 'changed') {
        lines.push(`-${path}: ${JSON.stringify(change.oldValue)}`);
        lines.push(`+${path}: ${JSON.stringify(change.newValue)}`);
      }
    });
    
    if (lines.length === 3) {
      lines.push('No differences found');
    }
    
    return lines.join('\n');
  }, [comparisonResult, leftFile, rightFile]);
  
  const canCompare = leftFile.isValid && rightFile.isValid;
  const hasFiles = leftFile.file || rightFile.file || leftFile.content || rightFile.content;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Results Section */}
        {comparisonResult && (
          <div className="mb-8 animate-fade-in">
            
            {/* Results Header */}
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl shadow-lg">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      Comparison Results
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300">
                      Found {comparisonResult.summary.total} differences between your configurations
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleRecompare}
                    disabled={isComparing}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/70 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isComparing ? 'animate-spin' : ''}`} />
                    {isComparing ? 'Re-comparing...' : 'Re-compare'}
                  </button>
                  
                  <button
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm hover:shadow-md ${
                      showAdvancedOptions 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                        : 'bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    {showAdvancedOptions ? 'Hide Options' : 'Advanced Options'}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <Download className="w-4 h-4" />
                      Export
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showExportMenu && (
                      <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xl z-30 animate-scale-in">
                        <div className="py-2">
                          <button
                            onClick={() => handleExport('json')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                          >
                            📄 JSON Report
                          </button>
                          <button
                            onClick={() => handleExport('csv')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                          >
                            📊 CSV Export
                          </button>
                          <button
                            onClick={() => handleExport('html')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                          >
                            🌐 HTML Report
                          </button>
                          <button
                            onClick={() => handleExport('patch')}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                          >
                            📝 Patch File
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Statistics Cards */}
              <StatisticsCards comparisonResult={comparisonResult} />

              {/* Enhanced View Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium">View Mode:</span>
                </div>
                <ViewModeToggle 
                  options={options} 
                  onDiffModeChange={handleDiffModeChange}
                  useEnhanced={useEnhanced}
                  setUseEnhanced={setUseEnhanced}
                />
              </div>
            </div>

            {/* Advanced Options Panel */}
            {showAdvancedOptions && (
              <div className="mb-6 animate-slide-down">
                <AdvancedOptionsPanel
                  options={options}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
            )}

            {/* Enhanced Diff Viewer */}
            <div className="animate-slide-up">
              {options.diffMode === 'side-by-side' ? (
                useEnhanced ? (
                  <EnhancedSideBySideDiff result={comparisonResult} />
                ) : (
                  <SideBySideDiff result={comparisonResult} />
                )
              ) : options.diffMode === 'unified' ? (
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">Unified Diff</h3>
                  <pre className="text-sm font-mono bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl overflow-x-auto whitespace-pre-wrap text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-700/50">
                    {generateUnifiedDiff()}
                  </pre>
                </div>
              ) : (
                <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Tree View - Changes ({comparisonResult.changes.length})
                    </h3>
                  </div>
                  <Suspense fallback={<LoadingSkeleton />}>
                    <DiffViewer
                      result={comparisonResult}
                      options={options}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Hero Section */}
        {!comparisonResult && (
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Compare Configuration Files
              <span className="block text-4xl md:text-5xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mt-2">
                with Intelligence
              </span>
            </h1>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Upload files or paste text to get intelligent, human-readable diffs with advanced analysis and beautiful visualizations
            </p>
          </div>
        )}

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="group">
            <FileUpload
              title="Configuration A"
              fileState={leftFile}
              onFileUpload={(file) => handleFileUpload(file, 'left')}
              onTextPaste={(text, format) => handleTextPaste(text, format, 'left')}
              placeholder="Drop your first config file here or click to browse"
            />
          </div>
          
          <div className="group">
            <FileUpload
              title="Configuration B"
              fileState={rightFile}
              onFileUpload={(file) => handleFileUpload(file, 'right')}
              onTextPaste={(text, format) => handleTextPaste(text, format, 'right')}
              placeholder="Drop your second config file here or click to browse"
            />
          </div>
        </div>

        {/* Upload Status & Compare */}
        {hasFiles && (
          <div className="mb-8 animate-slide-up">
            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-6 border border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-3">
                    {leftFile.isValid ? (
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {leftFile.file?.name || (leftFile.content ? 'Pasted Text' : 'No input')}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {leftFile.isValid ? 'Ready to compare' : 'Invalid format'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-slate-400" />
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {rightFile.isValid ? (
                      <CheckCircle className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {rightFile.file?.name || (rightFile.content ? 'Pasted Text' : 'No input')}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {rightFile.isValid ? 'Ready to compare' : 'Invalid format'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700/70 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-all duration-200 font-medium"
                  >
                    Reset
                  </button>
                  
                  <button
                    onClick={handleCompare}
                    disabled={!canCompare || isComparing}
                    className={`flex items-center gap-3 px-8 py-3 text-lg font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl ${
                      canCompare && !isComparing
                        ? 'bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700 transform hover:scale-105'
                        : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isComparing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Compare
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Error Display */}
        {error && (
          <div className="mb-8 animate-shake">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 backdrop-blur-xl">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mr-3" />
                <div className="text-red-800 dark:text-red-200 font-medium text-lg">Error</div>
              </div>
              <div className="text-red-700 dark:text-red-300 mt-2">{error}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}

export default App;