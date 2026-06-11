import { useRef, useMemo } from 'react';
import CodeMirror, { type Extension } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { xml } from '@codemirror/lang-xml';
import { StreamLanguage, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { tags } from '@lezer/highlight';
import { AlertCircle, FolderOpen, X } from 'lucide-react';
import { ConfigFormat } from '@/types';

const chrome = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-fg)',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: 'var(--font-mono)',
    caretColor: 'var(--color-accent)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in oklch, var(--color-accent) 22%, transparent)',
  },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklch, var(--color-accent) 14%, transparent)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.025)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-faint)',
    border: 'none',
    borderRight: '1px solid var(--color-border)',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-muted)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)' },
}, { dark: true });

const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: [tags.propertyName, tags.attributeName, tags.definition(tags.name)], color: '#62c5bd' },
  { tag: [tags.string, tags.attributeValue], color: '#9dc08b' },
  { tag: [tags.number], color: '#d6a14e' },
  { tag: [tags.bool, tags.null, tags.keyword, tags.atom], color: '#e08a8f' },
  { tag: [tags.comment, tags.meta], color: '#6a7177', fontStyle: 'italic' },
  { tag: [tags.punctuation, tags.bracket, tags.separator], color: '#9aa1a7' },
  { tag: [tags.tagName], color: '#62c5bd' },
  { tag: [tags.heading, tags.labelName], color: '#62c5bd' },
]));

function languageFor(format: ConfigFormat | null): Extension[] {
  switch (format) {
    case 'json': return [json()];
    case 'yaml': return [yaml()];
    case 'xml': return [xml()];
    case 'toml': return [StreamLanguage.define(toml)];
    case 'ini':
    case 'env':
    case 'properties':
    case 'config': return [StreamLanguage.define(properties)];
    default: return [];
  }
}

const FORMATS: ConfigFormat[] = [
  'json', 'yaml', 'xml', 'ini', 'toml', 'env', 'properties', 'config', 'hcl', 'csv'
];

const ACCEPT = '.json,.yaml,.yml,.xml,.ini,.toml,.env,.properties,.conf,.config,.hcl,.tf,.csv';

interface EditorPaneProps {
  label: string;
  name: string | null;
  content: string;
  format: ConfigFormat | null;
  formatOverride: ConfigFormat | null;
  parseError: string | null;
  isDropTarget: boolean;
  onChange: (content: string) => void;
  onFormatOverride: (format: ConfigFormat | null) => void;
  onOpenFile: (file: File) => void;
  onClear: () => void;
}

export function EditorPane({
  label, name, content, format, formatOverride, parseError, isDropTarget,
  onChange, onFormatOverride, onOpenFile, onClear,
}: EditorPaneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extensions = useMemo(
    () => [chrome, highlight, EditorView.lineWrapping, ...languageFor(format)],
    [format]
  );

  return (
    <div className={`flex flex-col bg-surface border rounded-lg overflow-hidden transition-colors ${
      isDropTarget ? 'border-accent' : parseError ? 'border-removed/40' : 'border-border'
    }`}>
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border shrink-0">
        <span className="font-mono text-xs text-faint uppercase tracking-wider">{label}</span>
        {name && <span className="font-mono text-xs text-muted truncate">{name}</span>}

        <div className="ml-auto flex items-center gap-1">
          {content && (
            <select
              value={formatOverride ?? 'auto'}
              onChange={(e) => onFormatOverride(e.target.value === 'auto' ? null : e.target.value as ConfigFormat)}
              className="px-1.5 py-0.5 font-mono text-xs border border-border rounded bg-elevated text-muted focus:border-accent"
              title="Format (auto-detected, override if wrong)"
            >
              <option value="auto">auto: {format ?? '?'}</option>
              {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted hover:text-fg rounded transition-colors"
          >
            <FolderOpen className="w-3 h-3" />
            Open
          </button>
          {content && (
            <button
              onClick={onClear}
              className="p-1 text-faint hover:text-removed rounded transition-colors"
              aria-label={`Clear ${label}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <CodeMirror
        value={content}
        onChange={onChange}
        extensions={extensions}
        theme="none"
        height="46vh"
        placeholder={`Paste ${label.toLowerCase()} config, drop a file, or use Open`}
        basicSetup={{
          foldGutter: false,
          autocompletion: false,
          searchKeymap: false,
          highlightSelectionMatches: false,
        }}
      />

      {parseError && (
        <div className="flex items-start gap-2 px-3 py-2 border-t border-removed/30 bg-removed/5 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-removed shrink-0 mt-0.5" />
          <span className="font-mono text-xs text-removed">{parseError}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onOpenFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
