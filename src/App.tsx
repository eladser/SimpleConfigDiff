import React, { useState, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DiffViewer } from '@/components/DiffViewer';
import { OptionsPanel } from '@/components/OptionsPanel';
import { Header } from '@/components/Header';
import { FileUploadState, DiffOptions, ComparisonResult } from '@/types';
import { detectFormat, parseConfig } from '@/utils/parsers';
import { generateDiff } from '@/utils/generateDiff';
import { RefreshCw } from 'lucide-react';

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
    flattenKeys: false
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
        error: parsed.error
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
  
  const canCompare = leftFile.isValid && rightFile.isValid;
  
  return (
    <div className=\"min-h-screen bg-gray-50\">
      <Header />
      
      <div className=\"max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8\">
        {/* File Upload Section */}
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8\">
          <FileUpload
            title=\"Configuration File A\"
            fileState={leftFile}
            onFileUpload={(file) => handleFileUpload(file, 'left')}
            placeholder=\"Drop your first config file here or click to browse\"
          />
          
          <FileUpload
            title=\"Configuration File B\"
            fileState={rightFile}
            onFileUpload={(file) => handleFileUpload(file, 'right')}
            placeholder=\"Drop your second config file here or click to browse\"
          />
        </div>
        
        {/* Options Panel */}
        <OptionsPanel
          options={options}
          onOptionsChange={setOptions}
        />
        
        {/* Controls */}
        <div className=\"flex items-center justify-between mb-8\">
          <div className=\"flex items-center gap-4\">
            <button
              onClick={handleCompare}
              disabled={!canCompare || isComparing}
              className={`btn btn-primary flex items-center gap-2 px-6 py-3 text-lg font-semibold ${
                !canCompare || isComparing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isComparing ? (
                <>
                  <RefreshCw className=\"w-5 h-5 animate-spin\" />
                  Comparing...
                </>
              ) : (
                <>
                  <RefreshCw className=\"w-5 h-5\" />
                  Compare Files
                </>
              )}
            </button>
            
            <button
              onClick={handleReset}
              className=\"btn btn-secondary px-4 py-3\"
            >
              Reset
            </button>
          </div>
          
          {comparisonResult && (
            <div className=\"text-sm text-gray-600\">
              Found {comparisonResult.summary.total} differences
            </div>
          )}
        </div>
        
        {/* Error Display */}
        {error && (
          <div className=\"bg-red-50 border border-red-200 rounded-lg p-4 mb-8\">
            <div className=\"flex items-center\">
              <div className=\"text-red-800 font-medium\">Error</div>
            </div>
            <div className=\"text-red-700 mt-1\">{error}</div>
          </div>
        )}
        
        {/* Results */}
        {comparisonResult && (
          <DiffViewer
            result={comparisonResult}
            options={options}
          />
        )}
      </div>
    </div>
  );
}

export default App;