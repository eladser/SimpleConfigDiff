import React, { useCallback, useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X, Sparkles, FileText, Clipboard, Edit3 } from 'lucide-react';
import { FileUploadState } from '@/types';
import { getFormatLabel, getFormatIcon } from '@/utils/parsers';

interface FileUploadProps {
  title: string;
  fileState: FileUploadState;
  onFileUpload: (file: File) => void;
  onTextPaste: (text: string, format: string) => void;
  placeholder: string;
}

export function FileUpload({ 
  title, 
  fileState, 
  onFileUpload, 
  onTextPaste,
  placeholder
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('json');
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  }, [onFileUpload]);
  
  const handleRemoveFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const fileInput = document.getElementById(`file-input-${title}`) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    // Reset state
    setPastedText('');
    setShowTextInput(false);
  }, [title]);
  
  const openFileDialog = useCallback(() => {
    document.getElementById(`file-input-${title}`)?.click();
  }, [title]);

  const handlePasteText = useCallback(() => {
    if (pastedText.trim()) {
      onTextPaste(pastedText, selectedFormat);
      setShowTextInput(false);
    }
  }, [pastedText, selectedFormat, onTextPaste]);

  const handleQuickPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setPastedText(text);
        setShowTextInput(true);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      setShowTextInput(true);
    }
  }, []);
  
  return (
    <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {fileState.format && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/70 px-3 py-1 rounded-full">
            <span>{getFormatIcon(fileState.format)}</span>
            <span>{getFormatLabel(fileState.format)}</span>
          </div>
        )}
      </div>
      
      {!fileState.file && !showTextInput ? (
        <div className="space-y-4">
          <div
            className={`file-dropzone group ${isDragOver ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Upload className={`w-16 h-16 transition-all duration-300 ${
                  isDragOver ? 'text-blue-500 scale-110' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'
                }`} />
                {isDragOver && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-blue-500 animate-pulse" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className={`text-lg font-medium mb-2 transition-colors duration-300 ${
                  isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  {isDragOver ? 'Drop your file here' : placeholder}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Drag and drop or click to select
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={openFileDialog}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <File className="w-5 h-5" />
              Choose File
            </button>
            
            <button
              onClick={handleQuickPaste}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Clipboard className="w-5 h-5" />
              Paste Text
            </button>
          </div>
          
          <button
            onClick={() => setShowTextInput(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-all duration-200"
          >
            <Edit3 className="w-4 h-4" />
            Type or paste text manually
          </button>
          
          <input
            id={`file-input-${title}`}
            type="file"
            accept=".json,.yaml,.yml,.xml,.ini,.toml,.env,.properties,.config,.hcl,.tf,.conf"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : showTextInput ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Format:</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="json">JSON</option>
              <option value="yaml">YAML</option>
              <option value="xml">XML</option>
              <option value="ini">INI</option>
              <option value="toml">TOML</option>
              <option value="env">ENV</option>
              <option value="properties">Properties</option>
              <option value="config">Config</option>
            </select>
          </div>
          
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={`Paste your ${selectedFormat.toUpperCase()} configuration here...`}
            className="w-full h-64 p-4 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          
          <div className="flex gap-3">
            <button
              onClick={handlePasteText}
              disabled={!pastedText.trim()}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
                pastedText.trim()
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                  : 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed'
              }`}
            >
              <FileText className="w-5 h-5" />
              Use Text
            </button>
            
            <button
              onClick={() => {
                setShowTextInput(false);
                setPastedText('');
              }}
              className="px-6 py-3 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-600/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                {fileState.file ? (
                  <File className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {fileState.file?.name || 'Pasted Text'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {fileState.file ? 
                    `${(fileState.file.size / 1024).toFixed(1)} KB` : 
                    'Text input'
                  }
                  {fileState.lineCount && ` • ${fileState.lineCount} lines`}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {fileState.isValid ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Valid</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Invalid</span>
                </div>
              )}
              
              <button
                onClick={handleRemoveFile}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors ml-2"
              >
                <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>
          
          {fileState.error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl animate-shake">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-800 dark:text-red-200 font-medium">Parse Error</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">{fileState.error}</p>
            </div>
          )}
          
          {fileState.isValid && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl animate-bounce-in">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                  {fileState.file ? 'File parsed successfully' : 'Text parsed successfully'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}