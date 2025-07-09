import React, { useState, useRef, useCallback } from 'react';
import { FileUploadState, ConfigFormat } from '@/types';
import { 
  Upload, 
  File, 
  X, 
  Check, 
  AlertCircle, 
  FileText, 
  Code, 
  Database,
  Settings,
  Globe,
  Coffee,
  Wrench,
  Loader2,
  Eye,
  EyeOff,
  Layers,
  Table,
  Paintbrush
} from 'lucide-react';

interface FileUploadProps {
  title: string;
  fileState: FileUploadState;
  onFileUpload: (file: File) => void;
  onTextPaste: (text: string, format: string) => void;
  placeholder: string;
}

const formatIcons: Record<ConfigFormat, { icon: React.ComponentType<{ className?: string }>, color: string }> = {
  json: { icon: Code, color: 'from-yellow-400 to-orange-400' },
  yaml: { icon: FileText, color: 'from-emerald-400 to-blue-400' },
  xml: { icon: Code, color: 'from-red-400 to-pink-400' },
  ini: { icon: Settings, color: 'from-purple-400 to-blue-400' },
  toml: { icon: Wrench, color: 'from-orange-400 to-red-400' },
  env: { icon: Globe, color: 'from-emerald-400 to-teal-400' },
  properties: { icon: Coffee, color: 'from-amber-400 to-orange-400' },
  config: { icon: Database, color: 'from-slate-400 to-blue-400' },
  hcl: { icon: Layers, color: 'from-purple-400 to-violet-400' },
  csv: { icon: Table, color: 'from-green-400 to-emerald-400' },
  jinja2: { icon: Paintbrush, color: 'from-pink-400 to-rose-400' },
  handlebars: { icon: Paintbrush, color: 'from-orange-400 to-amber-400' },
  mustache: { icon: Paintbrush, color: 'from-yellow-400 to-orange-400' }
};

export function FileUpload({ title, fileState, onFileUpload, onTextPaste, placeholder }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<ConfigFormat>('json');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setIsProcessing(true);
      setTimeout(() => {
        onFileUpload(files[0]);
        setIsProcessing(false);
      }, 500);
    }
  }, [onFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      setTimeout(() => {
        onFileUpload(file);
        setIsProcessing(false);
      }, 500);
    }
  }, [onFileUpload]);

  const handleTextSubmit = useCallback(() => {
    if (textInput.trim()) {
      setIsProcessing(true);
      setTimeout(() => {
        onTextPaste(textInput, selectedFormat);
        setShowTextInput(false);
        setTextInput('');
        setIsProcessing(false);
      }, 300);
    }
  }, [textInput, selectedFormat, onTextPaste]);

  const clearFile = useCallback(() => {
    setTextInput('');
    setShowTextInput(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const getFormatIcon = (format: ConfigFormat | null) => {
    if (!format) return File;
    const formatInfo = formatIcons[format];
    return formatInfo ? formatInfo.icon : File;
  };

  const getFormatColor = (format: ConfigFormat | null) => {
    if (!format) return 'from-slate-400 to-slate-500';
    const formatInfo = formatIcons[format];
    return formatInfo ? formatInfo.color : 'from-slate-400 to-slate-500';
  };

  const getFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const previewText = fileState.content || textInput;
  const previewLines = previewText.split('\n').slice(0, 10);
  const hasMoreLines = previewText.split('\n').length > 10;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {fileState.content && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700/70 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
            >
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? 'Hide' : 'Preview'}
            </button>
          )}
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-200"
          >
            <Code className="w-3 h-3" />
            {showTextInput ? 'Hide Text' : 'Paste Text'}
          </button>
        </div>
      </div>

      {/* Main Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-105 shadow-lg'
            : fileState.isValid
            ? 'border-emerald-300 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20'
            : fileState.error
            ? 'border-red-300 dark:border-red-600 bg-red-50/50 dark:bg-red-900/20'
            : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Processing...</span>
            </div>
          </div>
        )}

        {/* Drag Animation Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center z-5">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                Drop your file here
              </p>
            </div>
          </div>
        )}

        {/* File Upload Content */}
        {!fileState.file && !fileState.content ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <p className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              {placeholder}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Supports JSON, YAML, XML, INI, TOML, ENV, Properties, Config, HCL, CSV, and template files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Choose File
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info */}
            <div className="flex items-center gap-4">
              <div className={`p-3 bg-gradient-to-r ${getFormatColor(fileState.format)} rounded-xl shadow-lg`}>
                {React.createElement(getFormatIcon(fileState.format), {
                  className: "w-6 h-6 text-white"
                })}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    {fileState.file?.name || 'Pasted Text'}
                  </h4>
                  {fileState.isValid ? (
                    <Check className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <span>Format: {fileState.format?.toUpperCase()}</span>
                  {fileState.size && <span>Size: {getFileSize(fileState.size)}</span>}
                  {fileState.lineCount && <span>Lines: {fileState.lineCount}</span>}
                </div>
              </div>
              <button
                onClick={clearFile}
                className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {fileState.error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-300">Parse Error</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{fileState.error}</p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".json,.yaml,.yml,.xml,.ini,.toml,.env,.properties,.conf,.config,.hcl,.csv,.j2,.jinja2,.hbs,.handlebars,.mustache"
          className="hidden"
        />
      </div>

      {/* Text Input Panel */}
      {showTextInput && (
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-lg animate-slide-down">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                Paste Configuration Text
              </h4>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Format:
                </label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as ConfigFormat)}
                  className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="xml">XML</option>
                  <option value="ini">INI</option>
                  <option value="toml">TOML</option>
                  <option value="env">ENV</option>
                  <option value="properties">Properties</option>
                  <option value="config">Config</option>
                  <option value="hcl">HCL</option>
                  <option value="csv">CSV</option>
                  <option value="jinja2">Jinja2</option>
                  <option value="handlebars">Handlebars</option>
                  <option value="mustache">Mustache</option>
                </select>
              </div>
            </div>
            
            <textarea
              ref={textAreaRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={`Paste your ${selectedFormat.toUpperCase()} configuration here...`}
              className="w-full h-40 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || isProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isProcessing ? 'Processing...' : 'Submit'}
              </button>
              <button
                onClick={() => setShowTextInput(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-700/70 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Panel */}
      {showPreview && previewText && (
        <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-lg animate-slide-down">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                Content Preview
              </h4>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-all duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
              <pre className="text-sm font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap overflow-x-auto">
                {previewLines.join('\n')}
                {hasMoreLines && (
                  <div className="text-slate-500 dark:text-slate-400 italic mt-2">
                    ... and {previewText.split('\n').length - 10} more lines
                  </div>
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}