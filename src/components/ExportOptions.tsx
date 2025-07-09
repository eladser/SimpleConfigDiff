import React, { useState } from 'react';
import { ComparisonResult } from '@/types';
import { Download, FileText, Code, Share2 } from 'lucide-react';

interface ExportOptionsProps {
  result: ComparisonResult;
}

export function ExportOptions({ result }: ExportOptionsProps) {
  const [isExporting, setIsExporting] = useState(false);
  
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
        
        if (change.type === 'changed') {
          report += `- **Old Value**: ${JSON.stringify(change.oldValue)}\n`;
          report += `- **New Value**: ${JSON.stringify(change.newValue)}\n`;
        } else if (change.type === 'added') {
          report += `- **Value**: ${JSON.stringify(change.newValue)}\n`;
        } else if (change.type === 'removed') {
          report += `- **Value**: ${JSON.stringify(change.oldValue)}\n`;
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
      changes: result.changes
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
  
  const handleExport = async (format: 'text' | 'json') => {
    setIsExporting(true);
    
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      
      if (format === 'text') {
        const content = generateTextReport();
        downloadFile(content, `config-diff-${timestamp}.md`, 'text/markdown');
      } else {
        const content = generateJSONReport();
        downloadFile(content, `config-diff-${timestamp}.json`, 'application/json');
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
  
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport('text')}
        disabled={isExporting}
        className="btn btn-secondary flex items-center gap-2 text-sm"
      >
        <FileText className="w-4 h-4" />
        Export as Markdown
      </button>
      
      <button
        onClick={() => handleExport('json')}
        disabled={isExporting}
        className="btn btn-secondary flex items-center gap-2 text-sm"
      >
        <Code className="w-4 h-4" />
        Export as JSON
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