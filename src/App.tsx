import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { EditorPane } from '@/components/EditorPane';
import { AdvancedOptionsPanel } from '@/components/AdvancedOptionsPanel';
import { SideBySideDiff } from '@/components/SideBySideDiff';
import { Header } from '@/components/Header';
import { DiffOptions, ComparisonResult, ConfigFormat } from '@/types';
import { detectFormat, parseConfig } from '@/utils/parsers';
import { generateDiff } from '@/utils/generateDiff';
import { downloadDiff, downloadPDFDiff } from '@/utils/exportDiff';
import { downloadExcel } from '@/utils/exportExcel';
import { SAMPLE_LEFT, SAMPLE_RIGHT } from '@/sampleData';
import {
  Download,
  Layers,
  SplitSquareHorizontal,
  ChevronDown,
  Settings,
  ArrowLeftRight,
  FileText,
  FlaskConical
} from 'lucide-react';

const DiffViewer = lazy(() => import('@/components/DiffViewer').then(module => ({ default: module.DiffViewer })));

const LoadingSkeleton = () => (
  <div className="bg-surface border border-border rounded-lg p-6">
    <div className="space-y-3">
      <div className="skeleton h-5 w-1/4"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton h-4 w-full"></div>
      ))}
    </div>
  </div>
);

const SUPPORTED_FORMATS = ['JSON', 'YAML', 'TOML', 'XML', 'INI', 'ENV', 'HCL', 'Properties', 'CSV'];

interface PaneState {
  name: string | null;
  content: string;
  formatOverride: ConfigFormat | null;
}

const EMPTY_PANE: PaneState = { name: null, content: '', formatOverride: null };

function usePane(initial: PaneState = EMPTY_PANE) {
  const [pane, setPane] = useState<PaneState>(initial);

  const derived = useMemo(() => {
    if (!pane.content.trim()) return { format: null, error: null, ready: false };
    const format = pane.formatOverride ?? detectFormat(pane.name ?? '', pane.content);
    try {
      const parsed = parseConfig(pane.content, format, pane.name ?? '');
      return { format, error: parsed.error ?? null, ready: !parsed.error };
    } catch (err) {
      return { format, error: err instanceof Error ? err.message : 'Parse failed', ready: false };
    }
  }, [pane]);

  return { pane, setPane, ...derived };
}

const StatsRow = ({ comparisonResult }: { comparisonResult: ComparisonResult }) => {
  const stats = [
    { value: comparisonResult.summary.added, label: 'added', color: 'text-added' },
    { value: comparisonResult.summary.removed, label: 'removed', color: 'text-removed' },
    { value: comparisonResult.summary.changed, label: 'changed', color: 'text-changed' },
    { value: `${comparisonResult.stats.similarities.toFixed(1)}%`, label: 'similar', color: 'text-muted' }
  ];

  return (
    <div className="flex items-stretch divide-x divide-border border-y border-border my-5">
      {stats.map((stat) => (
        <div key={stat.label} className="flex-1 px-4 py-3 first:pl-0">
          <div className={`text-2xl font-mono font-semibold ${stat.color}`}>{stat.value}</div>
          <div className="text-xs text-faint mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
};

function App() {
  const left = usePane();
  const right = usePane();

  const [options, setOptions] = useState<DiffOptions>({
    ignoreKeys: [],
    caseSensitive: false,
    sortKeys: false,
    flattenKeys: false,
    semanticComparison: false,
    ignoreWhitespace: false,
    ignoreComments: false,
    pathRules: [],
    valueTransformations: [],
    diffMode: 'side-by-side',
    showLineNumbers: true,
    contextLines: 3,
    minimalDiff: false
  });

  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [dropTarget, setDropTarget] = useState<'left' | 'right' | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const runCompare = useCallback(() => {
    if (!left.ready || !right.ready) {
      setComparisonResult(null);
      return;
    }

    try {
      const leftParsed = parseConfig(left.pane.content, left.format!);
      const rightParsed = parseConfig(right.pane.content, right.format!);

      const result = generateDiff(
        {
          name: left.pane.name || 'left',
          content: left.pane.content,
          format: left.format!,
          parsedContent: leftParsed.data
        },
        {
          name: right.pane.name || 'right',
          content: right.pane.content,
          format: right.format!,
          parsedContent: rightParsed.data
        },
        options
      );
      setComparisonResult(result);
      setDiffError(null);
    } catch (err) {
      setDiffError(err instanceof Error ? err.message : 'Comparison failed');
      setComparisonResult(null);
    }
  }, [left.ready, right.ready, left.pane, right.pane, left.format, right.format, options]);

  // Live compare, debounced. Options changes re-run it too.
  useEffect(() => {
    const id = setTimeout(runCompare, 350);
    return () => clearTimeout(id);
  }, [runCompare]);

  const openFile = useCallback((file: File, side: 'left' | 'right') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) ?? '';
      const setPane = side === 'left' ? left.setPane : right.setPane;
      setPane({ name: file.name, content, formatOverride: null });
    };
    reader.readAsText(file);
  }, [left.setPane, right.setPane]);

  // Drag a file anywhere on the page; the half you're over receives it
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      setDropTarget(e.clientX < window.innerWidth / 2 ? 'left' : 'right');
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDropTarget(null);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      const side = e.clientX < window.innerWidth / 2 ? 'left' : 'right';
      openFile(e.dataTransfer.files[0], side);
      setDropTarget(null);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [openFile]);

  // Ctrl+Enter compares immediately and jumps to results
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCompare();
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runCompare]);

  const swapSides = useCallback(() => {
    const l = left.pane;
    left.setPane(right.pane);
    right.setPane(l);
  }, [left, right]);

  const loadSample = useCallback(() => {
    left.setPane({ name: 'staging.yaml', content: SAMPLE_LEFT, formatOverride: null });
    right.setPane({ name: 'production.yaml', content: SAMPLE_RIGHT, formatOverride: null });
  }, [left, right]);

  const handleOptionsChange = useCallback((newOptions: DiffOptions) => {
    setOptions(newOptions);
  }, []);

  const ignoreKey = useCallback((path: string) => {
    setOptions(prev => ({
      ...prev,
      pathRules: [...prev.pathRules, { pattern: path, type: 'exact', action: 'ignore', description: 'Ignored from diff row' }]
    }));
  }, []);

  const handleExport = useCallback(async (format: 'json' | 'csv' | 'html' | 'patch' | 'pdf' | 'xlsx') => {
    if (!comparisonResult) return;

    const exportOptions = {
      includeMetadata: true,
      includeStats: true,
      includeContext: true
    };

    try {
      if (format === 'pdf') {
        await downloadPDFDiff(comparisonResult, options, exportOptions);
      } else if (format === 'xlsx') {
        downloadExcel(comparisonResult, options, exportOptions);
      } else {
        downloadDiff(comparisonResult, options, format, exportOptions);
      }
    } catch (error) {
      console.error(`${format} export failed:`, error);
      setDiffError(`Export to ${format.toUpperCase()} failed`);
    }

    setShowExportMenu(false);
  }, [comparisonResult, options]);

  const handleDiffModeChange = useCallback((mode: 'tree' | 'side-by-side' | 'unified') => {
    setOptions(prev => ({ ...prev, diffMode: mode }));
  }, []);

  const generateUnifiedDiff = useCallback(() => {
    if (!comparisonResult) return 'No comparison result available';

    const lines = [];
    lines.push(`--- ${left.pane.name || 'left'}`);
    lines.push(`+++ ${right.pane.name || 'right'}`);
    lines.push('');

    comparisonResult.changes.forEach((change) => {
      const path = change.path || '';

      if (change.type === 'added') {
        lines.push(`+${path}: ${JSON.stringify(change.newValue)}`);
      } else if (change.type === 'removed') {
        lines.push(`-${path}: ${JSON.stringify(change.oldValue)}`);
      } else if (change.type === 'changed') {
        lines.push(`-${path}: ${JSON.stringify(change.oldValue)}`);
        lines.push(`+${path}: ${JSON.stringify(change.newValue)}`);
      }
    });

    if (lines.length === 3) {
      lines.push('No differences found');
    }

    return lines.join('\n');
  }, [comparisonResult, left.pane.name, right.pane.name]);

  const bothEmpty = !left.pane.content.trim() && !right.pane.content.trim();

  const viewModes = [
    { mode: 'side-by-side', icon: SplitSquareHorizontal, label: 'Side by side' },
    { mode: 'tree', icon: Layers, label: 'Tree' },
    { mode: 'unified', icon: FileText, label: 'Unified' }
  ] as const;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <Header />

      <div className="max-w-370 mx-auto px-4 sm:px-6 py-6">

        {/* Intro — only while empty */}
        {bothEmpty && (
          <div className="mb-6 animate-fade-in max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Diff config files, structurally.
              <span className="terminal-cursor" aria-hidden="true" />
            </h1>
            <p className="text-muted mt-2 text-sm leading-relaxed">
              Compared by parsed structure, not by line — reordered keys and re-indentation
              aren't noise. Everything runs in your browser.
            </p>
            <p className="mt-2 font-mono text-xs text-faint">
              {SUPPORTED_FORMATS.join(' · ')}
            </p>
          </div>
        )}

        {/* Workspace toolbar */}
        <div className="flex items-center gap-2 mb-3">
          {bothEmpty && (
            <button onClick={loadSample} className="btn-secondary text-xs">
              <FlaskConical className="w-3.5 h-3.5" />
              Try a sample
            </button>
          )}
          {!bothEmpty && (
            <button onClick={swapSides} className="btn-secondary text-xs" title="Swap sides">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Swap
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline font-mono text-xs text-faint mr-1">ctrl+enter → results</span>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className={`btn-secondary text-xs ${showAdvancedOptions ? 'border-accent/40 text-accent' : ''}`}
            >
              <Settings className="w-3.5 h-3.5" />
              Options
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!comparisonResult}
                className="btn-secondary text-xs disabled:opacity-40 disabled:pointer-events-none"
              >
                <Download className="w-3.5 h-3.5" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>

              {showExportMenu && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-elevated rounded-md border border-border-strong z-30 animate-scale-in shadow-lg shadow-black/40">
                  <div className="py-1">
                    {([
                      ['json', 'JSON report'],
                      ['csv', 'CSV'],
                      ['html', 'HTML report'],
                      ['patch', 'Patch file'],
                    ] as const).map(([fmt, label]) => (
                      <button
                        key={fmt}
                        onClick={() => handleExport(fmt)}
                        className="w-full px-3 py-1.5 text-left text-sm text-muted hover:text-fg hover:bg-surface transition-colors font-mono"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Editors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
          <EditorPane
            label="Left"
            name={left.pane.name}
            content={left.pane.content}
            format={left.format}
            formatOverride={left.pane.formatOverride}
            parseError={left.error}
            isDropTarget={dropTarget === 'left'}
            onChange={(content) => left.setPane(p => ({ ...p, content }))}
            onFormatOverride={(f) => left.setPane(p => ({ ...p, formatOverride: f }))}
            onOpenFile={(f) => openFile(f, 'left')}
            onClear={() => left.setPane(EMPTY_PANE)}
          />
          <EditorPane
            label="Right"
            name={right.pane.name}
            content={right.pane.content}
            format={right.format}
            formatOverride={right.pane.formatOverride}
            parseError={right.error}
            isDropTarget={dropTarget === 'right'}
            onChange={(content) => right.setPane(p => ({ ...p, content }))}
            onFormatOverride={(f) => right.setPane(p => ({ ...p, formatOverride: f }))}
            onOpenFile={(f) => openFile(f, 'right')}
            onClear={() => right.setPane(EMPTY_PANE)}
          />
        </div>

        {/* Options */}
        {showAdvancedOptions && (
          <div className="mb-4 animate-slide-up">
            <AdvancedOptionsPanel
              options={options}
              onOptionsChange={handleOptionsChange}
            />
          </div>
        )}

        {/* Diff error */}
        {diffError && (
          <div className="mb-4 animate-shake">
            <div className="border border-removed/30 border-l-2 border-l-removed rounded-md px-4 py-3 bg-removed/5">
              <p className="text-sm text-removed font-medium font-mono">{diffError}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {comparisonResult && (
          <div ref={resultsRef} className="mb-10 animate-fade-in scroll-mt-16">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold">
                  {comparisonResult.summary.total === 0
                    ? 'No differences'
                    : `${comparisonResult.summary.total} ${comparisonResult.summary.total === 1 ? 'difference' : 'differences'}`}
                </h2>
                <p className="text-sm text-muted mt-0.5 font-mono">
                  {left.pane.name || 'left'} → {right.pane.name || 'right'}
                </p>
              </div>

              <div className="inline-flex items-center border border-border rounded-md overflow-hidden">
                {viewModes.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => handleDiffModeChange(mode)}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors border-r border-border last:border-r-0 ${
                      options.diffMode === mode
                        ? 'bg-elevated text-fg'
                        : 'bg-surface text-muted hover:text-fg'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <StatsRow comparisonResult={comparisonResult} />

            <div className="animate-slide-up">
              {options.diffMode === 'side-by-side' ? (
                <SideBySideDiff result={comparisonResult} onIgnoreKey={ignoreKey} />
              ) : options.diffMode === 'unified' ? (
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 border-b border-border text-xs text-faint font-mono">unified</div>
                  <pre className="text-sm font-mono p-4 overflow-x-auto whitespace-pre-wrap text-fg">
                    {generateUnifiedDiff()}
                  </pre>
                </div>
              ) : (
                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                  <div className="px-4 py-2 border-b border-border text-xs text-faint font-mono">
                    tree · {comparisonResult.changes.length} changes
                  </div>
                  <div className="p-4">
                    <Suspense fallback={<LoadingSkeleton />}>
                      <DiffViewer
                        result={comparisonResult}
                        options={options}
                      />
                    </Suspense>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showExportMenu && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
}

export default App;
