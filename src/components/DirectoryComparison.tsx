import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FileText, FolderOpen, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DirectoryFile {
  path: string;
  file: File;
  relativePath: string;
  isSupported: boolean;
  format?: string;
  size: number;
}

interface FileComparison {
  leftFile?: DirectoryFile;
  rightFile?: DirectoryFile;
  relativePath: string;
  status: 'added' | 'removed' | 'modified' | 'unchanged' | 'type_changed' | 'error';
  error?: string;
  similarity?: number;
  hasChanges?: boolean;
}

interface DirectoryComparisonProps {
  leftFiles: DirectoryFile[];
  rightFiles: DirectoryFile[];
  onFileSelect: (leftFile?: DirectoryFile, rightFile?: DirectoryFile) => void;
  selectedComparison?: FileComparison;
  className?: string;
}

export function DirectoryComparison({ 
  leftFiles, 
  rightFiles, 
  onFileSelect, 
  selectedComparison,
  className = '' 
}: DirectoryComparisonProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'size'>('name');

  // Create file comparison mapping
  const fileComparisons = useMemo(() => {
    const leftMap = new Map<string, DirectoryFile>();
    const rightMap = new Map<string, DirectoryFile>();

    // Build maps of relative paths
    leftFiles.forEach(file => {
      leftMap.set(file.relativePath, file);
    });

    rightFiles.forEach(file => {
      rightMap.set(file.relativePath, file);
    });

    // Get all unique paths
    const allPaths = new Set([...leftMap.keys(), ...rightMap.keys()]);
    
    const comparisons: FileComparison[] = [];

    allPaths.forEach(path => {
      const leftFile = leftMap.get(path);
      const rightFile = rightMap.get(path);

      let status: FileComparison['status'] = 'unchanged';
      let error: string | undefined;

      if (leftFile && rightFile) {
        // Both files exist
        if (leftFile.format !== rightFile.format) {
          status = 'type_changed';
        } else if (leftFile.size !== rightFile.size) {
          status = 'modified';
        } else {
          // Files have same size, would need content comparison for definitive answer
          status = 'unchanged';
        }
      } else if (leftFile && !rightFile) {
        status = 'removed';
      } else if (!leftFile && rightFile) {
        status = 'added';
      }

      // Check for unsupported files
      if ((leftFile && !leftFile.isSupported) || (rightFile && !rightFile.isSupported)) {
        status = 'error';
        error = 'Unsupported file format';
      }

      comparisons.push({
        leftFile,
        rightFile,
        relativePath: path,
        status,
        error,
        similarity: status === 'unchanged' ? 100 : undefined
      });
    });

    return comparisons;
  }, [leftFiles, rightFiles]);

  // Filter and sort comparisons
  const filteredComparisons = useMemo(() => {
    let filtered = fileComparisons;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(comp => comp.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.relativePath.localeCompare(b.relativePath);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'size':
          const aSize = (a.leftFile?.size || 0) + (a.rightFile?.size || 0);
          const bSize = (b.leftFile?.size || 0) + (b.rightFile?.size || 0);
          return bSize - aSize;
        default:
          return 0;
      }
    });

    return filtered;
  }, [fileComparisons, filterStatus, sortBy]);

  // Group files by directory
  const groupedFiles = useMemo(() => {
    const groups: Record<string, FileComparison[]> = {};
    
    filteredComparisons.forEach(comparison => {
      const pathParts = comparison.relativePath.split('/');
      const dir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '/';
      
      if (!groups[dir]) {
        groups[dir] = [];
      }
      groups[dir].push(comparison);
    });

    return groups;
  }, [filteredComparisons]);

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const getStatusIcon = (status: FileComparison['status']) => {
    switch (status) {
      case 'added':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'removed':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'modified':
        return <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      case 'type_changed':
        return <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <CheckCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: FileComparison['status']) => {
    switch (status) {
      case 'added':
        return 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      case 'modified':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
      case 'type_changed':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusCounts = () => {
    const counts = {
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
      type_changed: 0,
      error: 0
    };

    fileComparisons.forEach(comp => {
      counts[comp.status]++;
    });

    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Directory Comparison
          </h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {filteredComparisons.length} of {fileComparisons.length} files
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
          <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {statusCounts.added}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Added</div>
          </div>
          <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {statusCounts.removed}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">Removed</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
              {statusCounts.modified}
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400">Modified</div>
          </div>
          <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {statusCounts.type_changed}
            </div>
            <div className="text-xs text-orange-600 dark:text-orange-400">Type Changed</div>
          </div>
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-900/20 rounded">
            <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
              {statusCounts.unchanged}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Unchanged</div>
          </div>
          <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {statusCounts.error}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">Errors</div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Files</option>
            <option value="added">Added</option>
            <option value="removed">Removed</option>
            <option value="modified">Modified</option>
            <option value="type_changed">Type Changed</option>
            <option value="unchanged">Unchanged</option>
            <option value="error">Errors</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'status' | 'size')}
            className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
            <option value="size">Sort by Size</option>
          </select>
        </div>
      </div>

      {/* File List */}
      <div className="max-h-96 overflow-y-auto">
        {Object.entries(groupedFiles).map(([dir, files]) => (
          <div key={dir} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            {/* Directory Header */}
            {dir !== '/' && (
              <button
                onClick={() => toggleFolder(dir)}
                className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {expandedFolders.has(dir) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <FolderOpen className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {dir}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({files.length} files)
                </span>
              </button>
            )}

            {/* Files in Directory */}
            {(dir === '/' || expandedFolders.has(dir)) && (
              <div className="space-y-1">
                {files.map((comparison) => (
                  <div
                    key={comparison.relativePath}
                    className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      selectedComparison?.relativePath === comparison.relativePath
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                        : ''
                    }`}
                    onClick={() => onFileSelect(comparison.leftFile, comparison.rightFile)}
                  >
                    {dir !== '/' && <div className="w-4" />}
                    
                    <div className="flex-shrink-0">
                      {getStatusIcon(comparison.status)}
                    </div>

                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {comparison.relativePath.split('/').pop()}
                      </div>
                      {comparison.error && (
                        <div className="text-xs text-red-600 dark:text-red-400 truncate">
                          {comparison.error}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(comparison.status)}`}>
                        {comparison.status.replace('_', ' ')}
                      </span>
                      
                      {comparison.leftFile && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {comparison.leftFile.format}
                        </span>
                      )}
                      
                      {comparison.rightFile && comparison.leftFile?.format !== comparison.rightFile?.format && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          → {comparison.rightFile.format}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* No files message */}
      {filteredComparisons.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <p>No files match the current filter</p>
        </div>
      )}
    </div>
  );
}
