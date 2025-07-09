import React, { useState, useMemo } from 'react';
import { ComparisonResult, DiffChange, DiffViewSettings, SearchFilters } from '@/types';
import { ChevronRight, ChevronDown, Search, Filter, Eye, EyeOff } from 'lucide-react';

interface SideBySideDiffProps {
  result: ComparisonResult;
  settings: DiffViewSettings;
  onSettingsChange: (settings: DiffViewSettings) => void;
}

interface DiffLine {
  lineNumber: number;
  content: string;
  type: 'context' | 'added' | 'removed' | 'changed';
  path?: string;
  change?: DiffChange;
}

export function SideBySideDiff({ result, settings, onSettingsChange }: SideBySideDiffProps) {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    changeTypes: ['added', 'removed', 'changed'],
    pathPattern: '',
    valuePattern: '',
    severity: ['critical', 'major', 'minor', 'cosmetic'],
    category: ['security', 'performance', 'configuration', 'structure']
  });
  
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const filteredChanges = useMemo(() => {
    return result.changes.filter(change => {
      // Filter by change types
      if (!searchFilters.changeTypes.includes(change.type)) return false;
      
      // Filter by path pattern
      if (searchFilters.pathPattern && !change.path.toLowerCase().includes(searchFilters.pathPattern.toLowerCase())) {
        return false;
      }
      
      // Filter by value pattern
      if (searchFilters.valuePattern) {
        const oldValue = String(change.oldValue || '').toLowerCase();
        const newValue = String(change.newValue || '').toLowerCase();
        const pattern = searchFilters.valuePattern.toLowerCase();
        if (!oldValue.includes(pattern) && !newValue.includes(pattern)) {
          return false;
        }
      }
      
      // Filter by severity
      if (change.severity && !searchFilters.severity.includes(change.severity)) return false;
      
      // Filter by category
      if (change.category && !searchFilters.category.includes(change.category)) return false;
      
      return true;
    });
  }, [result.changes, searchFilters]);

  const leftLines = useMemo(() => generateLines(result.leftFile.content, filteredChanges, 'left'), [result.leftFile.content, filteredChanges]);
  const rightLines = useMemo(() => generateLines(result.rightFile.content, filteredChanges, 'right'), [result.rightFile.content, filteredChanges]);

  const toggleSection = (path: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedSections(newExpanded);
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20';
      case 'major': return 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20';
      case 'minor': return 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20';
      case 'cosmetic': return 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20';
      default: return 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'security': return '🔒';
      case 'performance': return '⚡';
      case 'configuration': return '⚙️';
      case 'structure': return '🏗️';
      default: return '📄';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header with controls */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Side-by-Side Diff</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{filteredChanges.length} changes</span>
              <span>•</span>
              <span className="text-red-600 dark:text-red-400">-{result.summary.removed}</span>
              <span className="text-green-600 dark:text-green-400">+{result.summary.added}</span>
              <span className="text-blue-600 dark:text-blue-400">~{result.summary.changed}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            
            <button
              onClick={() => onSettingsChange({ ...settings, showMinimap: !settings.showMinimap })}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {settings.showMinimap ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              Minimap
            </button>
          </div>
        </div>
        
        {/* Search and filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search Path
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchFilters.pathPattern}
                    onChange={(e) => setSearchFilters(prev => ({ ...prev, pathPattern: e.target.value }))}
                    placeholder="Filter by path..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Search Value
                </label>
                <input
                  type="text"
                  value={searchFilters.valuePattern}
                  onChange={(e) => setSearchFilters(prev => ({ ...prev, valuePattern: e.target.value }))}
                  placeholder="Filter by value..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Change Types
                </label>
                <div className="flex gap-2">
                  {(['added', 'removed', 'changed'] as const).map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={searchFilters.changeTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSearchFilters(prev => ({ 
                              ...prev, 
                              changeTypes: [...prev.changeTypes, type] 
                            }));
                          } else {
                            setSearchFilters(prev => ({ 
                              ...prev, 
                              changeTypes: prev.changeTypes.filter(t => t !== type) 
                            }));
                          }
                        }}
                        className="mr-1"
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* File headers */}
      <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-r border-gray-200 dark:border-gray-700">
          <div className="font-medium text-red-800 dark:text-red-300">{result.leftFile.name}</div>
          <div className="text-sm text-red-600 dark:text-red-400">{result.leftFile.format.toUpperCase()}</div>
        </div>
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20">
          <div className="font-medium text-green-800 dark:text-green-300">{result.rightFile.name}</div>
          <div className="text-sm text-green-600 dark:text-green-400">{result.rightFile.format.toUpperCase()}</div>
        </div>
      </div>

      {/* Diff content */}
      <div className="max-h-96 overflow-auto">
        <div className="grid grid-cols-2">
          <div className="border-r border-gray-200 dark:border-gray-700">
            {leftLines.map((line, index) => (
              <DiffLineComponent
                key={index}
                line={line}
                settings={settings}
                getSeverityColor={getSeverityColor}
                getCategoryIcon={getCategoryIcon}
                onToggleSection={toggleSection}
                isExpanded={expandedSections.has(line.path || '')}
              />
            ))}
          </div>
          <div>
            {rightLines.map((line, index) => (
              <DiffLineComponent
                key={index}
                line={line}
                settings={settings}
                getSeverityColor={getSeverityColor}
                getCategoryIcon={getCategoryIcon}
                onToggleSection={toggleSection}
                isExpanded={expandedSections.has(line.path || '')}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Statistics footer */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <span>Similarity: {result.stats.similarities.toFixed(1)}%</span>
            <span>Characters: {result.stats.totalCharacters.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Time: {result.metadata.comparisonTime.toFixed(2)}ms</span>
            <span>Algorithm: {result.metadata.algorithm}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DiffLineComponentProps {
  line: DiffLine;
  settings: DiffViewSettings;
  getSeverityColor: (severity?: string) => string;
  getCategoryIcon: (category?: string) => string;
  onToggleSection: (path: string) => void;
  isExpanded: boolean;
}

function DiffLineComponent({ line, settings, getSeverityColor, getCategoryIcon, onToggleSection, isExpanded }: DiffLineComponentProps) {
  const getLineClass = () => {
    switch (line.type) {
      case 'added': return 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500';
      case 'removed': return 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500';
      case 'changed': return 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500';
      default: return 'bg-white dark:bg-gray-800';
    }
  };

  return (
    <div className={`px-4 py-2 border-b border-gray-100 dark:border-gray-700 ${getLineClass()}`}>
      <div className="flex items-center gap-2">
        {settings.showLineNumbers && (
          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 flex-shrink-0">
            {line.lineNumber}
          </span>
        )}
        
        {line.change && (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(line.change.severity)}`}>
              {line.change.severity}
            </span>
            <span className="text-sm">{getCategoryIcon(line.change.category)}</span>
          </div>
        )}
        
        <button
          onClick={() => line.path && onToggleSection(line.path)}
          className="flex items-center gap-1 text-sm hover:text-blue-600 dark:hover:text-blue-400"
        >
          {line.path && (
            <>
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-mono">{line.path}</span>
            </>
          )}
        </button>
      </div>
      
      {line.path && isExpanded && (
        <div className="mt-2 pl-8">
          <pre className={`text-sm whitespace-pre-wrap ${settings.wrapLines ? 'break-words' : ''}`}>
            {line.content}
          </pre>
        </div>
      )}
    </div>
  );
}

function generateLines(content: string, changes: DiffChange[], side: 'left' | 'right'): DiffLine[] {
  const lines: DiffLine[] = [];
  let lineNumber = 1;
  
  // This is a simplified implementation
  // In a real implementation, you would need to parse the actual file content
  // and map changes to their corresponding lines
  
  changes.forEach(change => {
    const line: DiffLine = {
      lineNumber: lineNumber++,
      content: side === 'left' ? String(change.oldValue || '') : String(change.newValue || ''),
      type: change.type,
      path: change.path,
      change
    };
    lines.push(line);
  });
  
  return lines;
}