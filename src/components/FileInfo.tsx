import React from 'react';
import { ConfigFile } from '@/types';
import { File, Calendar, Hash } from 'lucide-react';
import { getFormatLabel, getFormatIcon } from '@/utils/parsers';

interface FileInfoProps {
  title: string;
  file: ConfigFile;
  type: 'left' | 'right';
}

export function FileInfo({ title, file, type }: FileInfoProps) {
  const getObjectKeys = (obj: any): number => {
    if (typeof obj !== 'object' || obj === null) return 0;
    
    let count = 0;
    const traverse = (current: any) => {
      if (typeof current === 'object' && current !== null) {
        if (Array.isArray(current)) {
          count += current.length;
          current.forEach(item => traverse(item));
        } else {
          const keys = Object.keys(current);
          count += keys.length;
          keys.forEach(key => traverse(current[key]));
        }
      }
    };
    
    traverse(obj);
    return count;
  };
  
  const keyCount = getObjectKeys(file.parsedContent);
  
  return (
    <div className={`card ${type === 'left' ? 'border-l-4 border-l-primary-500' : 'border-r-4 border-r-primary-500'}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{getFormatIcon(file.format)}</span>
          <span>{getFormatLabel(file.format)}</span>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <File className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-900 font-medium">{file.name}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <Hash className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            {keyCount} configuration keys
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">
            {(file.content.length / 1024).toFixed(1)} KB
          </span>
        </div>
      </div>
      
      {/* Preview of structure */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="text-xs text-gray-500 mb-2">Structure preview:</div>
        <div className="text-sm text-gray-700 font-mono max-h-24 overflow-y-auto">
          {JSON.stringify(file.parsedContent, null, 2).slice(0, 200)}
          {JSON.stringify(file.parsedContent, null, 2).length > 200 && '...'}
        </div>
      </div>
    </div>
  );
}