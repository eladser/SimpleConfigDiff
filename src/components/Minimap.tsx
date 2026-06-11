import { useMemo, useRef, useEffect, useState } from 'react';
import { DiffChange } from '@/types';

interface MinimapProps {
  changes: DiffChange[];
  totalLines: number;
  currentViewport: {
    start: number;
    end: number;
  };
  onViewportChange: (start: number, end: number) => void;
  className?: string;
}

interface MinimapLine {
  lineNumber: number;
  type: 'added' | 'removed' | 'changed' | 'context';
  severity?: 'critical' | 'major' | 'minor' | 'cosmetic';
}

export function Minimap({ changes, totalLines, currentViewport, onViewportChange, className = '' }: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ y: 0, viewportStart: 0 });

  // Convert changes to minimap lines
  const minimapLines = useMemo(() => {
    const lines: MinimapLine[] = [];
    const changesByLine = new Map<number, DiffChange>();
    
    // Map changes to line numbers
    changes.forEach(change => {
      if (change.lineNumber?.left) {
        changesByLine.set(change.lineNumber.left, change);
      }
      if (change.lineNumber?.right) {
        changesByLine.set(change.lineNumber.right, change);
      }
    });

    // Generate lines array
    for (let i = 1; i <= totalLines; i++) {
      const change = changesByLine.get(i);
      lines.push({
        lineNumber: i,
        type: change ? change.type : 'context',
        severity: change?.severity
      });
    }

    return lines;
  }, [changes, totalLines]);

  // Calculate minimap dimensions
  const minimapHeight = 300; // Fixed height for minimap
  const lineHeight = minimapHeight / totalLines;
  const viewportHeight = (currentViewport.end - currentViewport.start) * lineHeight;

  const getLineColor = (line: MinimapLine): string => {
    if (line.type === 'context') {
      return 'bg-gray-100 dark:bg-gray-700';
    }

    // Color based on severity if available
    if (line.severity) {
      switch (line.severity) {
        case 'critical': return 'bg-red-600 dark:bg-red-500';
        case 'major': return 'bg-orange-500 dark:bg-orange-400';
        case 'minor': return 'bg-yellow-500 dark:bg-yellow-400';
        case 'cosmetic': return 'bg-blue-500 dark:bg-blue-400';
      }
    }

    // Default colors based on change type
    switch (line.type) {
      case 'added': return 'bg-green-500 dark:bg-green-400';
      case 'removed': return 'bg-red-500 dark:bg-red-400';
      case 'changed': return 'bg-blue-500 dark:bg-blue-400';
      default: return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      y: e.clientY,
      viewportStart: currentViewport.start
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const deltaY = e.clientY - dragStart.y;
    const deltaLines = Math.round((deltaY / minimapHeight) * totalLines);
    
    const newStart = Math.max(0, Math.min(totalLines - (currentViewport.end - currentViewport.start), 
      dragStart.viewportStart + deltaLines));
    const newEnd = newStart + (currentViewport.end - currentViewport.start);

    onViewportChange(newStart, newEnd);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const clickY = e.clientY - containerRect.top;
    const clickLine = Math.round((clickY / minimapHeight) * totalLines);
    
    const viewportSize = currentViewport.end - currentViewport.start;
    const newStart = Math.max(0, Math.min(totalLines - viewportSize, clickLine - viewportSize / 2));
    const newEnd = newStart + viewportSize;

    onViewportChange(newStart, newEnd);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, currentViewport, totalLines]);

  return (
    <div className={`relative bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md ${className}`}>
      {/* Header */}
      <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 rounded-t-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Minimap
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Removed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Added</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Changed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Minimap content */}
      <div 
        ref={containerRef}
        className="relative cursor-pointer"
        style={{ height: minimapHeight }}
        onClick={handleClick}
      >
        {/* Minimap lines */}
        <div className="absolute inset-0">
          {minimapLines.map((line, index) => (
            <div
              key={line.lineNumber}
              className={`absolute w-full transition-opacity hover:opacity-80 ${getLineColor(line)}`}
              style={{
                height: Math.max(1, lineHeight),
                top: index * lineHeight,
                opacity: line.type === 'context' ? 0.3 : 0.8
              }}
              title={`Line ${line.lineNumber}: ${line.type}${line.severity ? ` (${line.severity})` : ''}`}
            />
          ))}
        </div>

        {/* Viewport indicator */}
        <div
          className="absolute left-0 right-0 bg-blue-200 dark:bg-blue-700 border-2 border-blue-400 dark:border-blue-500 rounded-sm opacity-60 cursor-grab active:cursor-grabbing"
          style={{
            top: currentViewport.start * lineHeight,
            height: Math.max(10, viewportHeight)
          }}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-0.5 bg-blue-500 dark:bg-blue-400 opacity-70"></div>
          </div>
        </div>

        {/* Change indicators */}
        <div className="absolute right-0 top-0 bottom-0 w-1">
          {changes.map((change, index) => {
            const lineNumber = change.lineNumber?.left || change.lineNumber?.right || 0;
            if (lineNumber === 0) return null;

            return (
              <div
                key={index}
                className={`absolute w-1 h-1 ${getLineColor({ 
                  lineNumber, 
                  type: change.type, 
                  severity: change.severity 
                })}`}
                style={{
                  top: (lineNumber - 1) * lineHeight,
                }}
                title={`${change.path}: ${change.type}${change.severity ? ` (${change.severity})` : ''}`}
              />
            );
          })}
        </div>
      </div>

      {/* Statistics */}
      <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 rounded-b-md">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>Lines: {totalLines}</span>
          <span>Changes: {changes.length}</span>
          <span>
            View: {currentViewport.start + 1}-{currentViewport.end} ({Math.round(((currentViewport.end - currentViewport.start) / totalLines) * 100)}%)
          </span>
        </div>
      </div>
    </div>
  );
}