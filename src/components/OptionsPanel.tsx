import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronUp, X, Plus } from 'lucide-react';
import { DiffOptions } from '@/types';

interface OptionsPanelProps {
  options: DiffOptions;
  onOptionsChange: (options: DiffOptions) => void;
}

export function OptionsPanel({ options, onOptionsChange }: OptionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newIgnoreKey, setNewIgnoreKey] = useState('');
  
  const handleToggleOption = (key: keyof DiffOptions) => {
    onOptionsChange({
      ...options,
      [key]: !options[key]
    });
  };
  
  const handleAddIgnoreKey = () => {
    if (newIgnoreKey.trim() && !options.ignoreKeys.includes(newIgnoreKey.trim())) {
      onOptionsChange({
        ...options,
        ignoreKeys: [...options.ignoreKeys, newIgnoreKey.trim()]
      });
      setNewIgnoreKey('');
    }
  };
  
  const handleRemoveIgnoreKey = (key: string) => {
    onOptionsChange({
      ...options,
      ignoreKeys: options.ignoreKeys.filter(k => k !== key)
    });
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddIgnoreKey();
    }
  };
  
  return (
    <div className="card mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Comparison Options</h3>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-6 space-y-6">
          {/* Toggle Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.caseSensitive}
                onChange={() => handleToggleOption('caseSensitive')}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Case Sensitive</span>
                <p className="text-xs text-gray-500">Compare keys with case sensitivity</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.sortKeys}
                onChange={() => handleToggleOption('sortKeys')}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Sort Keys</span>
                <p className="text-xs text-gray-500">Sort keys alphabetically before comparing</p>
              </div>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.flattenKeys}
                onChange={() => handleToggleOption('flattenKeys')}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Flatten Keys</span>
                <p className="text-xs text-gray-500">Convert nested objects to dot notation</p>
              </div>
            </label>
          </div>
          
          {/* Ignore Keys Section */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Ignore Keys
              <span className="text-xs text-gray-500 ml-2">
                Keys to ignore during comparison
              </span>
            </label>
            
            <div className="space-y-3">
              {/* Add new ignore key */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newIgnoreKey}
                  onChange={(e) => setNewIgnoreKey(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter key name (e.g., timestamp, version)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500 text-sm"
                />
                <button
                  onClick={handleAddIgnoreKey}
                  disabled={!newIgnoreKey.trim()}
                  className="btn btn-primary px-3 py-2 text-sm flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              
              {/* Display existing ignore keys */}
              {options.ignoreKeys.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {options.ignoreKeys.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-sm"
                    >
                      {key}
                      <button
                        onClick={() => handleRemoveIgnoreKey(key)}
                        className="hover:text-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Common ignore keys suggestions */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">Common keys:</span>
                {['timestamp', 'updatedAt', 'version', 'lastModified', 'createdAt'].map((key) => (
                  !options.ignoreKeys.includes(key) && (
                    <button
                      key={key}
                      onClick={() => onOptionsChange({
                        ...options,
                        ignoreKeys: [...options.ignoreKeys, key]
                      })}
                      className="text-xs text-primary-600 hover:text-primary-800 underline"
                    >
                      {key}
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}