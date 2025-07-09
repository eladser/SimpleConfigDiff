import React, { useCallback, useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X } from 'lucide-react';
import { FileUploadState } from '@/types';
import { getFormatLabel, getFormatIcon, getSupportedExtensions } from '@/utils/parsers';

interface FileUploadProps {
  title: string;
  fileState: FileUploadState;
  onFileUpload: (file: File) => void;
  placeholder: string;
}

export function FileUpload({ title, fileState, onFileUpload, placeholder }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  
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
    // Reset file input
    const input = document.getElementById(`file-input-${title}`) as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  }, [title]);
  
  const supportedExtensions = getSupportedExtensions();
  
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {fileState.format && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{getFormatIcon(fileState.format)}</span>
            <span>{getFormatLabel(fileState.format)} detected</span>
          </div>
        )}
      </div>
      
      {!fileState.file ? (
        <div
          className={`file-dropzone ${isDragOver ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-input-${title}`)?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <Upload className="w-12 h-12 text-gray-400" />
            <div className="text-center">
              <p className="text-lg font-medium text-gray-700 mb-1">
                {placeholder}
              </p>
              <p className="text-sm text-gray-500">
                Supported formats: {supportedExtensions.join(', ')}
              </p>
            </div>
          </div>
          
          <input
            id={`file-input-${title}`}
            type="file"
            accept={supportedExtensions.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <File className="w-5 h-5 text-gray-500" />
              <div>
                <p className="font-medium text-gray-900">{fileState.file.name}</p>
                <p className="text-sm text-gray-500">
                  {(fileState.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {fileState.isValid ? (
                <CheckCircle className="w-5 h-5 text-success-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-danger-600" />
              )}
              
              <button
                onClick={handleRemoveFile}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
          
          {fileState.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-700 font-medium">Parse Error</span>
              </div>
              <p className="text-sm text-red-600 mt-1">{fileState.error}</p>
            </div>
          )}
          
          {fileState.isValid && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700 font-medium">
                  File parsed successfully
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}