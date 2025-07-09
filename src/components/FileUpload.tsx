import React, { useCallback, useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, X, Folder, FolderOpen } from 'lucide-react';
import { FileUploadState } from '@/types';
import { getFormatLabel, getFormatIcon, getSupportedExtensions } from '@/utils/parsers';

interface FileUploadProps {
  title: string;
  fileState: FileUploadState;
  onFileUpload: (file: File) => void;
  onFolderUpload?: (files: FileList) => void;
  placeholder: string;
  supportsFolders?: boolean;
}

export function FileUpload({ 
  title, 
  fileState, 
  onFileUpload, 
  onFolderUpload, 
  placeholder, 
  supportsFolders = false 
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'folder' | null>(null);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    
    // Detect if dragged items are files or folders
    const items = Array.from(e.dataTransfer.items);
    const hasDirectories = items.some(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry?.isDirectory;
    });
    
    setDraggedItemType(hasDirectories ? 'folder' : 'file');
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDraggedItemType(null);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDraggedItemType(null);
    
    const files = Array.from(e.dataTransfer.files);
    const items = Array.from(e.dataTransfer.items);
    
    // Check if we have directory entries
    const hasDirectories = items.some(item => {
      const entry = item.webkitGetAsEntry?.();
      return entry?.isDirectory;
    });
    
    if (hasDirectories && supportsFolders && onFolderUpload) {
      // Handle folder upload
      onFolderUpload(e.dataTransfer.files);
    } else if (files.length > 0) {
      // Handle single file upload
      onFileUpload(files[0]);
    }
  }, [onFileUpload, onFolderUpload, supportsFolders]);
  
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (files.length === 1) {
        onFileUpload(files[0]);
      } else if (supportsFolders && onFolderUpload) {
        onFolderUpload(files);
      }
    }
  }, [onFileUpload, onFolderUpload, supportsFolders]);
  
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && supportsFolders && onFolderUpload) {
      onFolderUpload(files);
    }
  }, [onFolderUpload, supportsFolders]);
  
  const handleRemoveFile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Reset file inputs
    const fileInput = document.getElementById(`file-input-${title}`) as HTMLInputElement;
    const folderInput = document.getElementById(`folder-input-${title}`) as HTMLInputElement;
    if (fileInput) fileInput.value = '';
    if (folderInput) folderInput.value = '';
  }, [title]);
  
  const openFileDialog = useCallback(() => {
    document.getElementById(`file-input-${title}`)?.click();
  }, [title]);
  
  const openFolderDialog = useCallback(() => {
    document.getElementById(`folder-input-${title}`)?.click();
  }, [title]);
  
  const supportedExtensions = getSupportedExtensions();
  
  const getDragOverText = () => {
    if (!isDragOver) return placeholder;
    if (draggedItemType === 'folder') {
      return supportsFolders ? 'Drop folder here' : 'Folders not supported - drop individual files';
    }
    return 'Drop file here';
  };
  
  const getDragOverIcon = () => {
    if (!isDragOver) return <Upload className="w-12 h-12 text-gray-400" />;
    if (draggedItemType === 'folder') {
      return supportsFolders ? 
        <FolderOpen className="w-12 h-12 text-blue-500" /> : 
        <Folder className="w-12 h-12 text-gray-400" />;
    }
    return <Upload className="w-12 h-12 text-blue-500" />;
  };
  
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
        <div>
          <div
            className={`file-dropzone ${isDragOver ? 'active' : ''} ${
              isDragOver && draggedItemType === 'folder' && !supportsFolders ? 'border-red-300 bg-red-50' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            <div className="flex flex-col items-center gap-4">
              {getDragOverIcon()}
              <div className="text-center">
                <p className={`text-lg font-medium mb-1 ${
                  isDragOver && draggedItemType === 'folder' && !supportsFolders ? 'text-red-600' : 'text-gray-700'
                }`}>
                  {getDragOverText()}
                </p>
                <p className="text-sm text-gray-500">
                  Supported formats: {supportedExtensions.join(', ')}
                </p>
              </div>
            </div>
          </div>
          
          {/* File upload buttons */}
          <div className={`mt-4 flex gap-2 ${supportsFolders ? 'justify-center' : 'justify-center'}`}>
            <button
              onClick={openFileDialog}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <File className="w-4 h-4" />
              Choose File
            </button>
            
            {supportsFolders && (
              <button
                onClick={openFolderDialog}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Folder className="w-4 h-4" />
                Choose Folder
              </button>
            )}
          </div>
          
          {/* Hidden file inputs */}
          <input
            id={`file-input-${title}`}
            type="file"
            accept={supportedExtensions.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {supportsFolders && (
            <input
              id={`folder-input-${title}`}
              type="file"
              {...({ webkitdirectory: 'true' } as any)}
              multiple
              onChange={handleFolderSelect}
              className="hidden"
            />
          )}
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