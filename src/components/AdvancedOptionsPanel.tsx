import React, { useState } from 'react';
import { DiffOptions, PathRule, ValueTransformation } from '@/types';
import { 
  Settings, 
  Plus, 
  Trash2, 
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Eye,
  Zap,
  Shield,
  Filter
} from 'lucide-react';

interface AdvancedOptionsPanelProps {
  options: DiffOptions;
  onOptionsChange: (options: DiffOptions) => void;
}

export function AdvancedOptionsPanel({ options, onOptionsChange }: AdvancedOptionsPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const addPathRule = () => {
    const newRule: PathRule = {
      pattern: '',
      type: 'glob',
      action: 'ignore',
      description: ''
    };
    onOptionsChange({
      ...options,
      pathRules: [...options.pathRules, newRule]
    });
  };

  const updatePathRule = (index: number, rule: PathRule) => {
    const newRules = [...options.pathRules];
    newRules[index] = rule;
    onOptionsChange({
      ...options,
      pathRules: newRules
    });
  };

  const removePathRule = (index: number) => {
    const newRules = options.pathRules.filter((_, i) => i !== index);
    onOptionsChange({
      ...options,
      pathRules: newRules
    });
  };

  const addValueTransformation = () => {
    const newTransformation: ValueTransformation = {
      name: '',
      pattern: '',
      replacement: '',
      enabled: true,
      description: ''
    };
    onOptionsChange({
      ...options,
      valueTransformations: [...options.valueTransformations, newTransformation]
    });
  };

  const updateValueTransformation = (index: number, transformation: ValueTransformation) => {
    const newTransformations = [...options.valueTransformations];
    newTransformations[index] = transformation;
    onOptionsChange({
      ...options,
      valueTransformations: newTransformations
    });
  };

  const removeValueTransformation = (index: number) => {
    const newTransformations = options.valueTransformations.filter((_, i) => i !== index);
    onOptionsChange({
      ...options,
      valueTransformations: newTransformations
    });
  };

  const presetRules = [
    {
      name: 'Ignore Timestamps',
      rule: { pattern: '*.timestamp', type: 'glob' as const, action: 'ignore' as const, description: 'Ignore timestamp fields' }
    },
    {
      name: 'Ignore Passwords',
      rule: { pattern: '*.password', type: 'glob' as const, action: 'ignore' as const, description: 'Ignore password fields' }
    },
    {
      name: 'Ignore Temp Files',
      rule: { pattern: '/^temp_/', type: 'regex' as const, action: 'ignore' as const, description: 'Ignore temporary files' }
    }
  ];

  const presetTransformations = [
    {
      name: 'Normalize URLs',
      transformation: { 
        name: 'Normalize URLs', 
        pattern: 'https?://', 
        replacement: 'http://', 
        enabled: true, 
        description: 'Convert HTTPS to HTTP for comparison' 
      }
    },
    {
      name: 'Remove Whitespace',
      transformation: { 
        name: 'Remove Whitespace', 
        pattern: '\\s+', 
        replacement: ' ', 
        enabled: true, 
        description: 'Normalize whitespace' 
      }
    }
  ];

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Advanced Comparison Options</h2>
      </div>

      <div className="space-y-4">
        {/* Basic Options */}
        <OptionSection
          title="Basic Options"
          icon={<Settings className="w-4 h-4" />}
          expanded={expandedSections.has('basic')}
          onToggle={() => toggleSection('basic')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <OptionToggle
                label="Case Sensitive"
                checked={options.caseSensitive}
                onChange={(checked) => onOptionsChange({ ...options, caseSensitive: checked })}
                helpText="Consider case when comparing string values"
              />
              
              <OptionToggle
                label="Sort Keys"
                checked={options.sortKeys}
                onChange={(checked) => onOptionsChange({ ...options, sortKeys: checked })}
                helpText="Sort object keys before comparison"
              />
              
              <OptionToggle
                label="Flatten Keys"
                checked={options.flattenKeys}
                onChange={(checked) => onOptionsChange({ ...options, flattenKeys: checked })}
                helpText="Flatten nested objects into dot notation"
              />
            </div>
            
            <div className="space-y-3">
              <OptionToggle
                label="Semantic Comparison"
                checked={options.semanticComparison}
                icon={<Zap className="w-4 h-4" />}
                onChange={(checked) => onOptionsChange({ ...options, semanticComparison: checked })}
                helpText="Understand that 'true' and true are equivalent"
              />
              
              <OptionToggle
                label="Ignore Whitespace"
                checked={options.ignoreWhitespace}
                onChange={(checked) => onOptionsChange({ ...options, ignoreWhitespace: checked })}
                helpText="Ignore whitespace differences in string values"
              />
              
              <OptionToggle
                label="Ignore Comments"
                checked={options.ignoreComments}
                onChange={(checked) => onOptionsChange({ ...options, ignoreComments: checked })}
                helpText="Ignore comments when comparing files"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ignored Keys
            </label>
            <div className="flex flex-wrap gap-2">
              {options.ignoreKeys.map((key, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-sm"
                >
                  {key}
                  <button
                    onClick={() => {
                      const newKeys = options.ignoreKeys.filter((_, i) => i !== index);
                      onOptionsChange({ ...options, ignoreKeys: newKeys });
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => {
                  const key = prompt('Enter key to ignore:');
                  if (key) {
                    onOptionsChange({ ...options, ignoreKeys: [...options.ignoreKeys, key] });
                  }
                }}
                className="inline-flex items-center gap-1 px-2 py-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Plus className="w-3 h-3" />
                Add Key
              </button>
            </div>
          </div>
        </OptionSection>

        {/* Diff Display Options */}
        <OptionSection
          title="Display Options"
          icon={<Eye className="w-4 h-4" />}
          expanded={expandedSections.has('display')}
          onToggle={() => toggleSection('display')}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Diff Mode
              </label>
              <select
                value={options.diffMode}
                onChange={(e) => onOptionsChange({ ...options, diffMode: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="tree">Tree View</option>
                <option value="side-by-side">Side-by-Side</option>
                <option value="unified">Unified Diff</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Context Lines
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={options.contextLines}
                onChange={(e) => onOptionsChange({ ...options, contextLines: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div className="mt-4 space-y-3">
            <OptionToggle
              label="Show Line Numbers"
              checked={options.showLineNumbers}
              onChange={(checked) => onOptionsChange({ ...options, showLineNumbers: checked })}
              helpText="Display line numbers in diff view"
            />
            
            <OptionToggle
              label="Minimal Diff"
              checked={options.minimalDiff}
              onChange={(checked) => onOptionsChange({ ...options, minimalDiff: checked })}
              helpText="Show only changed lines without context"
            />
          </div>
        </OptionSection>

        {/* Path Rules */}
        <OptionSection
          title="Path Rules"
          icon={<Filter className="w-4 h-4" />}
          expanded={expandedSections.has('pathRules')}
          onToggle={() => toggleSection('pathRules')}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure rules for handling specific paths during comparison
              </p>
              <button
                onClick={addPathRule}
                className="btn btn-secondary text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Rule
              </button>
            </div>
            
            {/* Preset Rules */}
            <div className="flex flex-wrap gap-2">
              {presetRules.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onOptionsChange({
                      ...options,
                      pathRules: [...options.pathRules, preset.rule]
                    });
                  }}
                  className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30"
                >
                  {preset.name}
                </button>
              ))}
            </div>
            
            {options.pathRules.map((rule, index) => (
              <PathRuleEditor
                key={index}
                rule={rule}
                onUpdate={(updatedRule) => updatePathRule(index, updatedRule)}
                onRemove={() => removePathRule(index)}
              />
            ))}
          </div>
        </OptionSection>

        {/* Value Transformations */}
        <OptionSection
          title="Value Transformations"
          icon={<Shield className="w-4 h-4" />}
          expanded={expandedSections.has('transformations')}
          onToggle={() => toggleSection('transformations')}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Transform values before comparison using regex patterns
              </p>
              <button
                onClick={addValueTransformation}
                className="btn btn-secondary text-sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Transformation
              </button>
            </div>
            
            {/* Preset Transformations */}
            <div className="flex flex-wrap gap-2">
              {presetTransformations.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onOptionsChange({
                      ...options,
                      valueTransformations: [...options.valueTransformations, preset.transformation]
                    });
                  }}
                  className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30"
                >
                  {preset.name}
                </button>
              ))}
            </div>
            
            {options.valueTransformations.map((transformation, index) => (
              <ValueTransformationEditor
                key={index}
                transformation={transformation}
                onUpdate={(updatedTransformation) => updateValueTransformation(index, updatedTransformation)}
                onRemove={() => removeValueTransformation(index)}
              />
            ))}
          </div>
        </OptionSection>
      </div>
    </div>
  );
}

interface OptionSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function OptionSection({ title, icon, expanded, onToggle, children }: OptionSectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {icon}
        <span className="font-medium text-gray-900 dark:text-white">{title}</span>
      </button>
      {expanded && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-600">
          {children}
        </div>
      )}
    </div>
  );
}

interface OptionToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helpText?: string;
  icon?: React.ReactNode;
}

function OptionToggle({ label, checked, onChange, helpText, icon }: OptionToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {helpText && (
          <div className="relative group">
            <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {helpText}
            </div>
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

interface PathRuleEditorProps {
  rule: PathRule;
  onUpdate: (rule: PathRule) => void;
  onRemove: () => void;
}

function PathRuleEditor({ rule, onUpdate, onRemove }: PathRuleEditorProps) {
  return (
    <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pattern
          </label>
          <input
            type="text"
            value={rule.pattern}
            onChange={(e) => onUpdate({ ...rule, pattern: e.target.value })}
            placeholder="e.g., *.timestamp"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Type
          </label>
          <select
            value={rule.type}
            onChange={(e) => onUpdate({ ...rule, type: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="glob">Glob</option>
            <option value="regex">Regex</option>
            <option value="exact">Exact</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Action
          </label>
          <select
            value={rule.action}
            onChange={(e) => onUpdate({ ...rule, action: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="ignore">Ignore</option>
            <option value="semantic">Semantic</option>
            <option value="strict">Strict</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={onRemove}
            className="w-full px-3 py-2 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 border border-red-200 dark:border-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </div>
      
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <input
          type="text"
          value={rule.description || ''}
          onChange={(e) => onUpdate({ ...rule, description: e.target.value })}
          placeholder="Optional description"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );
}

interface ValueTransformationEditorProps {
  transformation: ValueTransformation;
  onUpdate: (transformation: ValueTransformation) => void;
  onRemove: () => void;
}

function ValueTransformationEditor({ transformation, onUpdate, onRemove }: ValueTransformationEditorProps) {
  return (
    <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <input
          type="text"
          value={transformation.name}
          onChange={(e) => onUpdate({ ...transformation, name: e.target.value })}
          placeholder="Transformation name"
          className="font-medium text-sm bg-transparent border-none outline-none text-gray-900 dark:text-white"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate({ ...transformation, enabled: !transformation.enabled })}
            className={`px-2 py-1 text-xs rounded ${
              transformation.enabled 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {transformation.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pattern (Regex)
          </label>
          <input
            type="text"
            value={transformation.pattern}
            onChange={(e) => onUpdate({ ...transformation, pattern: e.target.value })}
            placeholder="e.g., https?://"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Replacement
          </label>
          <input
            type="text"
            value={transformation.replacement}
            onChange={(e) => onUpdate({ ...transformation, replacement: e.target.value })}
            placeholder="e.g., http://"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
          />
        </div>
      </div>
      
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <input
          type="text"
          value={transformation.description || ''}
          onChange={(e) => onUpdate({ ...transformation, description: e.target.value })}
          placeholder="Optional description"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
    </div>
  );
}