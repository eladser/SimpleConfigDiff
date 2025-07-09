import { useState } from 'react';
import { ComparisonResult, DiffOptions } from '@/types';
import { FileText, Code, Share2, FileSpreadsheet, FileImage, Download } from 'lucide-react';
import { exportDiff, downloadDiff, downloadPDFDiff } from '@/utils/exportDiff';
import { downloadExcel } from '@/utils/exportExcel';

interface ExportOptionsProps {
  result: ComparisonResult;
  options?: DiffOptions;
}

export function ExportOptions({ result, options }: ExportOptionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'html' | 'json' | 'csv' | 'patch' | 'pdf' | 'xlsx'>('html');
  
  const defaultOptions: DiffOptions = {
    ignoreKeys: [],
    caseSensitive: true,
    sortKeys: false,
    flattenKeys: false,
    semanticComparison: false,
    ignoreWhitespace: false,
    ignoreComments: false,
    pathRules: [],
    valueTransformations: [],
    diffMode: 'unified',
    showLineNumbers: true,
    contextLines: 3,
    minimalDiff: false
  };

  const effectiveOptions = options || defaultOptions;
  
  const generateTextReport = () => {
    const { changes, summary, leftFile, rightFile } = result;
    
    let report = `# Configuration Diff Report\n\n`;
    report += `## Files Compared\n`;
    report += `- **File A**: ${leftFile.name} (${leftFile.format.toUpperCase()})\n`;
    report += `- **File B**: ${rightFile.name} (${rightFile.format.toUpperCase()})\n\n`;
    
    report += `## Summary\n`;
    report += `- **Total Changes**: ${summary.total}\n`;
    report += `- **Added**: ${summary.added}\n`;
    report += `- **Removed**: ${summary.removed}\n`;
    report += `- **Changed**: ${summary.changed}\n\n`;
    
    if (changes.length > 0) {
      report += `## Changes\n\n`;
      changes.forEach((change, index) => {
        report += `### ${index + 1}. ${change.path}\n`;
        report += `- **Type**: ${change.type}\n`;
        
        if (change.severity) {
          report += `- **Severity**: ${change.severity}\n`;
        }
        
        if (change.category) {
          report += `- **Category**: ${change.category}\n`;
        }
        
        if (change.type === 'changed') {
          report += `- **Old Value**: ${JSON.stringify(change.oldValue)}\n`;
          report += `- **New Value**: ${JSON.stringify(change.newValue)}\n`;
        } else if (change.type === 'added') {
          report += `- **Value**: ${JSON.stringify(change.newValue)}\n`;
        } else if (change.type === 'removed') {
          report += `- **Value**: ${JSON.stringify(change.oldValue)}\n`;
        }
        
        if (change.description) {
          report += `- **Description**: ${change.description}\n`;
        }
        
        report += `\n`;
      });
    }
    
    report += `---\n`;
    report += `Generated on ${new Date().toLocaleString()}\n`;
    
    return report;
  };
  
  const generateJSONReport = () => {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      files: {
        left: {
          name: result.leftFile.name,
          format: result.leftFile.format
        },
        right: {
          name: result.rightFile.name,
          format: result.rightFile.format
        }
      },
      summary: result.summary,
      changes: result.changes,
      stats: result.stats,
      metadata: result.metadata
    }, null, 2);
  };
  
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleExport = async (format: 'html' | 'json' | 'csv' | 'patch' | 'pdf' | 'xlsx' | 'text') => {
    setIsExporting(true);
    
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      if (format === 'text') {
        const content = generateTextReport();
        downloadFile(content, `config-diff-${timestamp}.md`, 'text/markdown');
      } else if (format === 'json') {
        const content = generateJSONReport();
        downloadFile(content, `config-diff-${timestamp}.json`, 'application/json');
      } else if (format === 'pdf') {
        await downloadPDFDiff(result, effectiveOptions);
      } else if (format === 'xlsx') {
        downloadExcel(result, effectiveOptions);
      } else {
        // Use the new export system
        downloadDiff(result, effectiveOptions, format);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Configuration Diff Report',
          text: `Found ${result.summary.total} differences between ${result.leftFile.name} and ${result.rightFile.name}`,
          url: window.location.href
        });
      } catch (error) {
        console.error('Sharing failed:', error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        // You could show a toast notification here
      } catch (error) {
        console.error('Copy to clipboard failed:', error);
      }
    }
  };
  
  const exportOptions = [
    { value: 'html', label: 'HTML Report', icon: FileText },
    { value: 'json', label: 'JSON Data', icon: Code },
    { value: 'csv', label: 'CSV Spreadsheet', icon: FileSpreadsheet },
    { value: 'xlsx', label: 'Excel Workbook', icon: FileSpreadsheet },
    { value: 'pdf', label: 'PDF Report', icon: FileImage },
    { value: 'patch', label: 'Patch File', icon: FileText }
  ] as const;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2">
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as any)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {exportOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => handleExport(exportFormat)}
          disabled={isExporting}
          className="btn btn-primary flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" />
          {isExporting ? 'Exporting...' : 'Export'}
        </button>
      </div>
      
      <div className="w-px h-6 bg-gray-300" />
      
      <button
        onClick={() => handleExport('text')}
        disabled={isExporting}
        className="btn btn-secondary flex items-center gap-2 text-sm"
      >
        <FileText className="w-4 h-4" />
        Markdown
      </button>
      
      <button
        onClick={handleShare}
        className="btn btn-secondary flex items-center gap-2 text-sm"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>
    </div>
  );
}