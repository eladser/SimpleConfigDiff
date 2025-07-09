import React, { useState, useRef, useCallback } from 'react';
import { FolderOpen, FileText, AlertCircle, CheckCircle, Upload, X } from 'lucide-react';

interface DirectoryFile {
  path: string;
  file: File;
  relativePath: string;
  isSupported: boolean;
  format?: string;
  size: number;
}

interface DirectoryUploadProps {
  title: string;
  onDirectoryUpload: (files: DirectoryFile[]) => void;
  supportedExtensions?: string[];
  maxFiles?: number;
  maxTotalSize?: number; // in bytes
  className?: string;
}

const DEFAULT_SUPPORTED_EXTENSIONS = [
  '.json', '.yaml', '.yml', '.xml', '.ini', '.toml', '.env', 
  '.hcl', '.tf', '.properties', '.csv', '.config', '.conf'
];

export function DirectoryUpload({
  title,
  onDirectoryUpload,
  supportedExtensions = DEFAULT_SUPPORTED_EXTENSIONS,
  maxFiles = 100,
  maxTotalSize = 50 * 1024 * 1024, // 50MB default
  className = ''
}: DirectoryUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<DirectoryFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList) => {
    setIsProcessing(true);
    setError(null);
    setWarnings([]);

    try {
      const files: DirectoryFile[] = [];
      let totalSize = 0;
      const newWarnings: string[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Skip if exceeds max files
        if (files.length >= maxFiles) {
          newWarnings.push(`Maximum ${maxFiles} files exceeded. Some files were skipped.`);
          break;
        }

        // Get relative path from webkitRelativePath
        const relativePath = file.webkitRelativePath || file.name;
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        const isSupported = supportedExtensions.includes(extension);

        // Check file size
        totalSize += file.size;
        if (totalSize > maxTotalSize) {
          newWarnings.push(`Total size limit (${formatBytes(maxTotalSize)}) exceeded. Some files were skipped.`);
          break;
        }

        // Skip unsupported files but track them
        if (!isSupported) {
          newWarnings.push(`Unsupported file type: ${file.name} (${extension})`);
          continue;
        }

        // Skip empty files
        if (file.size === 0) {
          newWarnings.push(`Empty file skipped: ${file.name}`);
          continue;
        }

        files.push({
          path: file.webkitRelativePath || file.name,
          file,
          relativePath,
          isSupported,
          format: extension.slice(1), // Remove the dot
          size: file.size
        });
      }

      if (files.length === 0) {
        throw new Error('No supported configuration files found in the selected directory');
      }

      setSelectedFiles(files);
      setWarnings(newWarnings);
      onDirectoryUpload(files);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process directory');
      setSelectedFiles([]);
    } finally {
      setIsProcessing(false);
    }
  }, [maxFiles, maxTotalSize, supportedExtensions, onDirectoryUpload]);

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

    const items = e.dataTransfer.items;
    if (items) {
      // Check if directory was dropped
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry && entry.isDirectory) {
            processDirectoryEntry(entry as FileSystemDirectoryEntry);
            return;
          }
        }
      }
    }

    // Fallback to regular file handling
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const processDirectoryEntry = useCallback(async (directoryEntry: FileSystemDirectoryEntry) => {
    setIsProcessing(true);
    setError(null);
    setWarnings([]);

    try {
      const files = await readDirectoryRecursively(directoryEntry);
      
      // Convert to FileList-like structure
      const fileList = {
        length: files.length,
        item: (index: number) => files[index] || null,
        ...files
      } as FileList;

      await processFiles(fileList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read directory');
      setIsProcessing(false);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleClear = useCallback(() => {
    setSelectedFiles([]);
    setError(null);
    setWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTotalSize = () => {
    return selectedFiles.reduce((total, file) => total + file.size, 0);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        {selectedFiles.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          webkitdirectory=""
          directory=""
          multiple
        />

        <div className="flex flex-col items-center gap-4">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Processing directory...</p>
            </>
          ) : (
            <>
              <FolderOpen className="w-12 h-12 text-gray-400" />
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  Drop directory here or click to browse
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Supports: {supportedExtensions.join(', ')}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Max {maxFiles} files, {formatBytes(maxTotalSize)} total
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Select Directory
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}

      {/* Warnings Display */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-300">
            <AlertCircle className="w-4 h-4" />
            Warnings ({warnings.length})
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {warnings.map((warning, index) => (
              <div key={index} className="text-xs text-yellow-600 dark:text-yellow-400 pl-6">
                {warning}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Summary */}
      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="font-medium text-gray-900 dark:text-white">
              {selectedFiles.length} files selected
            </h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div>Total Size: {formatBytes(getTotalSize())}</div>
            <div>Supported Types: {new Set(selectedFiles.map(f => f.format)).size}</div>
          </div>

          <div className="max-h-40 overflow-y-auto">
            <div className="space-y-1">
              {selectedFiles.slice(0, 20).map((file, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3 text-gray-400" />
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {file.relativePath}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500">
                    <span className="bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded text-xs">
                      {file.format}
                    </span>
                    <span>{formatBytes(file.size)}</span>
                  </div>
                </div>
              ))}
              {selectedFiles.length > 20 && (
                <div className="text-xs text-gray-500 dark:text-gray-500 text-center py-2">
                  ... and {selectedFiles.length - 20} more files
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to read directory recursively
async function readDirectoryRecursively(directoryEntry: FileSystemDirectoryEntry): Promise<File[]> {
  const files: File[] = [];
  
  const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
  };

  const processEntry = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      
      // Add webkitRelativePath property
      Object.defineProperty(file, 'webkitRelativePath', {
        value: entry.fullPath.substring(1), // Remove leading slash
        writable: false
      });
      
      files.push(file);
    } else if (entry.isDirectory) {
      const directoryEntry = entry as FileSystemDirectoryEntry;
      const reader = directoryEntry.createReader();
      
      let entries: FileSystemEntry[] = [];
      let readEntries_: FileSystemEntry[];
      
      // Read all entries in the directory
      do {
        readEntries_ = await readEntries(reader);
        entries = entries.concat(readEntries_);
      } while (readEntries_.length > 0);
      
      // Process each entry recursively
      for (const childEntry of entries) {
        await processEntry(childEntry);
      }
    }
  };

  await processEntry(directoryEntry);
  return files;
}
