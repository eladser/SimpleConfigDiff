import React, { useState } from 'react';
import { DiffOptions, PathRule, ValueTransformation } from '@/types';
import { Plus, Trash2, ChevronDown, ChevronRight, X } from 'lucide-react';

interface AdvancedOptionsPanelProps {
  options: DiffOptions;
  onOptionsChange: (options: DiffOptions) => void;
}

export function AdvancedOptionsPanel({ options, onOptionsChange }: AdvancedOptionsPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));
  const [newIgnoreKey, setNewIgnoreKey] = useState('');

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections);
    if (next.has(section)) {
      next.delete(section);
    } else {
      next.add(section);
    }
    setExpandedSections(next);
  };

  const addIgnoreKey = () => {
    const key = newIgnoreKey.trim();
    if (key && !options.ignoreKeys.includes(key)) {
      onOptionsChange({ ...options, ignoreKeys: [...options.ignoreKeys, key] });
    }
    setNewIgnoreKey('');
  };

  const addPathRule = () => {
    const newRule: PathRule = { pattern: '', type: 'glob', action: 'ignore', description: '' };
    onOptionsChange({ ...options, pathRules: [...options.pathRules, newRule] });
  };

  const updatePathRule = (index: number, rule: PathRule) => {
    const newRules = [...options.pathRules];
    newRules[index] = rule;
    onOptionsChange({ ...options, pathRules: newRules });
  };

  const removePathRule = (index: number) => {
    onOptionsChange({ ...options, pathRules: options.pathRules.filter((_, i) => i !== index) });
  };

  const addValueTransformation = () => {
    const t: ValueTransformation = { name: '', pattern: '', replacement: '', enabled: true, description: '' };
    onOptionsChange({ ...options, valueTransformations: [...options.valueTransformations, t] });
  };

  const updateValueTransformation = (index: number, t: ValueTransformation) => {
    const next = [...options.valueTransformations];
    next[index] = t;
    onOptionsChange({ ...options, valueTransformations: next });
  };

  const removeValueTransformation = (index: number) => {
    onOptionsChange({
      ...options,
      valueTransformations: options.valueTransformations.filter((_, i) => i !== index)
    });
  };

  const presetRules = [
    { name: 'timestamps', rule: { pattern: '*.timestamp', type: 'glob' as const, action: 'ignore' as const, description: 'Ignore timestamp fields' } },
    { name: 'passwords', rule: { pattern: '*.password', type: 'glob' as const, action: 'ignore' as const, description: 'Ignore password fields' } },
    { name: 'temp keys', rule: { pattern: '/^temp_/', type: 'regex' as const, action: 'ignore' as const, description: 'Ignore temporary keys' } }
  ];

  const presetTransformations = [
    { name: 'normalize URLs', transformation: { name: 'Normalize URLs', pattern: 'https?://', replacement: 'http://', enabled: true, description: 'Treat http and https as equal' } },
    { name: 'collapse whitespace', transformation: { name: 'Collapse whitespace', pattern: '\\s+', replacement: ' ', enabled: true, description: 'Normalize runs of whitespace' } }
  ];

  const basicToggles: Array<{ key: keyof DiffOptions; label: string; help: string }> = [
    { key: 'caseSensitive', label: 'Case sensitive', help: 'Consider case when comparing string values' },
    { key: 'sortKeys', label: 'Sort keys', help: 'Sort object keys before comparison' },
    { key: 'flattenKeys', label: 'Flatten keys', help: 'Flatten nested objects into dot notation' },
    { key: 'semanticComparison', label: 'Semantic comparison', help: "Treat 'true' and true as equal" },
    { key: 'ignoreWhitespace', label: 'Ignore whitespace', help: 'Ignore whitespace differences in values' },
    { key: 'ignoreComments', label: 'Ignore comments', help: 'Strip comments before comparing' }
  ];

  return (
    <div className="bg-surface border border-border rounded-lg divide-y divide-border">
      <Section
        title="Comparison"
        expanded={expandedSections.has('basic')}
        onToggle={() => toggleSection('basic')}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
          {basicToggles.map(({ key, label, help }) => (
            <Toggle
              key={key}
              label={label}
              help={help}
              checked={Boolean(options[key])}
              onChange={(checked) => onOptionsChange({ ...options, [key]: checked })}
            />
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-xs text-faint mb-1.5">Ignored keys</label>
          <div className="flex flex-wrap items-center gap-1.5">
            {options.ignoreKeys.map((key, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-elevated border border-border rounded font-mono text-xs text-fg"
              >
                {key}
                <button
                  onClick={() => onOptionsChange({ ...options, ignoreKeys: options.ignoreKeys.filter((_, i) => i !== index) })}
                  className="text-faint hover:text-removed transition-colors"
                  aria-label={`Stop ignoring ${key}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              type="text"
              value={newIgnoreKey}
              onChange={(e) => setNewIgnoreKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addIgnoreKey(); }}
              onBlur={addIgnoreKey}
              placeholder="key.path"
              className="w-28 px-2 py-0.5 font-mono text-xs border border-dashed border-border rounded bg-transparent text-fg placeholder:text-faint focus:border-accent"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Path rules"
        expanded={expandedSections.has('pathRules')}
        onToggle={() => toggleSection('pathRules')}
        count={options.pathRules.length}
      >
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-xs text-faint mr-1">Presets:</span>
          {presetRules.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onOptionsChange({ ...options, pathRules: [...options.pathRules, preset.rule] })}
              className="px-2 py-0.5 font-mono text-xs border border-border rounded text-muted hover:text-fg hover:border-border-strong transition-colors"
            >
              {preset.name}
            </button>
          ))}
          <button onClick={addPathRule} className="ml-auto btn-secondary text-xs">
            <Plus className="w-3 h-3" />
            Rule
          </button>
        </div>

        <div className="space-y-2">
          {options.pathRules.map((rule, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
              <input
                type="text"
                value={rule.pattern}
                onChange={(e) => updatePathRule(index, { ...rule, pattern: e.target.value })}
                placeholder="*.timestamp"
                className="px-2.5 py-1.5 font-mono text-sm border border-border rounded bg-bg text-fg placeholder:text-faint focus:border-accent"
              />
              <select
                value={rule.type}
                onChange={(e) => updatePathRule(index, { ...rule, type: e.target.value as PathRule['type'] })}
                className="px-2 py-1.5 font-mono text-xs border border-border rounded bg-elevated text-fg focus:border-accent"
              >
                <option value="glob">glob</option>
                <option value="regex">regex</option>
                <option value="exact">exact</option>
              </select>
              <select
                value={rule.action}
                onChange={(e) => updatePathRule(index, { ...rule, action: e.target.value as PathRule['action'] })}
                className="px-2 py-1.5 font-mono text-xs border border-border rounded bg-elevated text-fg focus:border-accent"
              >
                <option value="ignore">ignore</option>
                <option value="semantic">semantic</option>
                <option value="strict">strict</option>
              </select>
              <button
                onClick={() => removePathRule(index)}
                className="p-1.5 text-faint hover:text-removed transition-colors"
                aria-label="Remove rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Value transforms"
        expanded={expandedSections.has('transformations')}
        onToggle={() => toggleSection('transformations')}
        count={options.valueTransformations.length}
      >
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="text-xs text-faint mr-1">Presets:</span>
          {presetTransformations.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onOptionsChange({ ...options, valueTransformations: [...options.valueTransformations, preset.transformation] })}
              className="px-2 py-0.5 font-mono text-xs border border-border rounded text-muted hover:text-fg hover:border-border-strong transition-colors"
            >
              {preset.name}
            </button>
          ))}
          <button onClick={addValueTransformation} className="ml-auto btn-secondary text-xs">
            <Plus className="w-3 h-3" />
            Transform
          </button>
        </div>

        <div className="space-y-2">
          {options.valueTransformations.map((t, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-center">
              <input
                type="text"
                value={t.pattern}
                onChange={(e) => updateValueTransformation(index, { ...t, pattern: e.target.value })}
                placeholder="pattern (regex)"
                className="px-2.5 py-1.5 font-mono text-sm border border-border rounded bg-bg text-fg placeholder:text-faint focus:border-accent"
              />
              <input
                type="text"
                value={t.replacement}
                onChange={(e) => updateValueTransformation(index, { ...t, replacement: e.target.value })}
                placeholder="replacement"
                className="px-2.5 py-1.5 font-mono text-sm border border-border rounded bg-bg text-fg placeholder:text-faint focus:border-accent"
              />
              <button
                onClick={() => updateValueTransformation(index, { ...t, enabled: !t.enabled })}
                className={`px-2 py-1 font-mono text-xs rounded border transition-colors ${
                  t.enabled
                    ? 'border-accent/40 text-accent'
                    : 'border-border text-faint'
                }`}
              >
                {t.enabled ? 'on' : 'off'}
              </button>
              <button
                onClick={() => removeValueTransformation(index)}
                className="p-1.5 text-faint hover:text-removed transition-colors"
                aria-label="Remove transform"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, expanded, onToggle, count, children }: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-elevated/40 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-faint" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-faint" />
        )}
        <span className="text-sm font-medium text-fg">{title}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="font-mono text-xs text-faint">{count}</span>
        )}
      </button>
      {expanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

function Toggle({ label, checked, onChange, help }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: string;
}) {
  return (
    <div className="flex items-center justify-between" title={help}>
      <span className="text-sm text-muted">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-bg transition-transform ${
            checked ? 'translate-x-4.5' : 'translate-x-0.75'
          }`}
        />
      </button>
    </div>
  );
}
