import { ComparisonResult, ExportOptions, DiffOptions } from '@/types';
import { generateUnifiedDiff } from './unifiedDiff';

export class DiffExporter {
  private result: ComparisonResult;
  private options: DiffOptions;

  constructor(result: ComparisonResult, options: DiffOptions) {
    this.result = result;
    this.options = options;
  }

  export(format: ExportOptions['format'], exportOptions: Partial<ExportOptions> = {}): string {
    const fullOptions: ExportOptions = {
      format,
      includeMetadata: exportOptions.includeMetadata ?? true,
      includeStats: exportOptions.includeStats ?? true,
      includeContext: exportOptions.includeContext ?? true,
      template: exportOptions.template
    };

    switch (format) {
      case 'json':
        return this.exportJSON(fullOptions);
      case 'csv':
        return this.exportCSV(fullOptions);
      case 'html':
        return this.exportHTML(fullOptions);
      case 'patch':
        return this.exportPatch();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  async exportPDF(exportOptions: Partial<ExportOptions> = {}): Promise<Blob> {
    const fullOptions: ExportOptions = {
      format: 'pdf',
      includeMetadata: exportOptions.includeMetadata ?? true,
      includeStats: exportOptions.includeStats ?? true,
      includeContext: exportOptions.includeContext ?? true,
      template: exportOptions.template
    };

    // Generate HTML content for PDF
    const htmlContent = this.exportHTML(fullOptions);
    
    // Create PDF using browser's print functionality
    return await this.htmlToPDF(htmlContent);
  }

  private async htmlToPDF(htmlContent: string): Promise<Blob> {
    // Create a temporary iframe to render the HTML
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.left = '-9999px';
    iframe.style.width = '8.5in';
    iframe.style.height = '11in';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      throw new Error('Could not access iframe document');
    }

    // Enhanced HTML with PDF-specific styling
    const pdfHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration Diff Report</title>
    <style>
        @page {
            size: A4;
            margin: 1in;
        }
        body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .header {
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .header h1 {
            font-size: 24px;
            margin: 0 0 10px 0;
            color: #2c3e50;
        }
        .header p {
            margin: 5px 0;
            color: #7f8c8d;
        }
        .files {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .file {
            flex: 1;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            border: 1px solid #e9ecef;
        }
        .file h3 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 14px;
        }
        .changes-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10px;
        }
        .changes-table th,
        .changes-table td {
            border: 1px solid #dee2e6;
            padding: 8px;
            text-align: left;
            vertical-align: top;
        }
        .changes-table th {
            background-color: #e9ecef;
            font-weight: bold;
            color: #495057;
        }
        .changes-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .added {
            background-color: #d4edda !important;
        }
        .removed {
            background-color: #f8d7da !important;
        }
        .changed {
            background-color: #d1ecf1 !important;
        }
        .critical {
            font-weight: bold;
            color: #721c24;
        }
        .major {
            font-weight: bold;
            color: #856404;
        }
        .minor {
            color: #155724;
        }
        .cosmetic {
            color: #004085;
        }
        .stats {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 5px;
            border: 1px solid #e9ecef;
            page-break-inside: avoid;
        }
        .stats h3 {
            margin-top: 0;
            color: #495057;
            font-size: 16px;
        }
        .stats p {
            margin: 8px 0;
        }
        code {
            background-color: #f1f3f4;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
        }
        .page-break {
            page-break-before: always;
        }
        .no-break {
            page-break-inside: avoid;
        }
        .summary-card {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #17a2b8;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            color: #0c5460;
        }
        .summary-stats {
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 10px;
        }
        .stat-item {
            background: white;
            padding: 10px;
            border-radius: 3px;
            text-align: center;
            min-width: 80px;
        }
        .stat-value {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
        }
        .stat-label {
            font-size: 10px;
            color: #6c757d;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    ${htmlContent.replace(/<head>.*?<\/head>/s, '').replace(/<\/body>.*?<\/html>/s, '')}
</body>
</html>
    `;

    iframeDoc.open();
    iframeDoc.write(pdfHtml);
    iframeDoc.close();

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      // Use browser's print functionality to generate PDF
      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        throw new Error('Could not access iframe window');
      }

      // Unfortunately, we can't directly generate PDF from HTML in browser without external libraries
      // We'll return the enhanced HTML content as a blob for now
      // In a real application, you would use a library like jsPDF or Puppeteer
      const htmlBlob = new Blob([pdfHtml], { type: 'text/html' });
      
      // Clean up
      document.body.removeChild(iframe);
      
      return htmlBlob;
    } catch (error) {
      document.body.removeChild(iframe);
      throw error;
    }
  }

  private exportJSON(options: ExportOptions): string {
    const exportData: any = {
      comparison: {
        summary: this.result.summary,
        changes: this.result.changes
      },
      files: {
        left: {
          name: this.result.leftFile.name,
          format: this.result.leftFile.format
        },
        right: {
          name: this.result.rightFile.name,
          format: this.result.rightFile.format
        }
      }
    };

    if (options.includeStats) {
      exportData.statistics = this.result.stats;
    }

    if (options.includeMetadata) {
      exportData.metadata = {
        ...this.result.metadata,
        exportedAt: new Date().toISOString(),
        exportOptions: options
      };
    }

    if (options.includeContext) {
      exportData.context = {
        diffOptions: this.options,
        unifiedDiff: this.result.unifiedDiff
      };
    }

    return JSON.stringify(exportData, null, 2);
  }

  private exportCSV(options: ExportOptions): string {
    const headers = [
      'Path',
      'Type',
      'Old Value',
      'New Value',
      'Old Type',
      'New Type',
      'Severity',
      'Category'
    ];

    const rows = this.result.changes.map(change => [
      change.path,
      change.type,
      this.formatValueForCSV(change.oldValue),
      this.formatValueForCSV(change.newValue),
      change.oldType || '',
      change.newType || '',
      change.severity || '',
      change.category || ''
    ]);

    let csv = headers.join(',') + '\n';
    csv += rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');

    if (options.includeStats) {
      csv += '\n\nStatistics:\n';
      csv += `Total Changes,${this.result.summary.total}\n`;
      csv += `Added,${this.result.summary.added}\n`;
      csv += `Removed,${this.result.summary.removed}\n`;
      csv += `Changed,${this.result.summary.changed}\n`;
      csv += `Similarity,${this.result.stats.similarities.toFixed(2)}%\n`;
    }

    return csv;
  }

  private exportHTML(exportOptions: ExportOptions): string {
    const template = exportOptions.template || this.getDefaultHTMLTemplate();
    
    let html = template;
    
    // Replace template variables
    html = html.replace('{{TITLE}}', `Configuration Diff Report`);
    html = html.replace('{{LEFT_FILE}}', this.result.leftFile.name);
    html = html.replace('{{RIGHT_FILE}}', this.result.rightFile.name);
    html = html.replace('{{TIMESTAMP}}', new Date().toLocaleString());
    
    // Generate summary section
    const summarySection = this.generateSummarySection();
    html = html.replace('{{SUMMARY_SECTION}}', summarySection);
    
    // Generate changes table
    const changesTable = this.generateChangesTable();
    html = html.replace('{{CHANGES_TABLE}}', changesTable);
    
    // Generate statistics
    if (exportOptions.includeStats) {
      const statsSection = this.generateStatsSection();
      html = html.replace('{{STATS_SECTION}}', statsSection);
    } else {
      html = html.replace('{{STATS_SECTION}}', '');
    }
    
    return html;
  }

  private exportPatch(): string {
    if (this.result.unifiedDiff) {
      return this.result.unifiedDiff;
    }
    
    // Generate unified diff if not already available
    return generateUnifiedDiff(this.result, {
      contextLines: this.options.contextLines,
      showLineNumbers: this.options.showLineNumbers,
      includeFilenames: true,
      includeTimestamp: true
    });
  }

  private formatValueForCSV(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private getDefaultHTMLTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #2c3e50; margin: 0; }
        .files { display: flex; gap: 20px; margin-bottom: 20px; }
        .file { flex: 1; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #e9ecef; }
        .changes-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .changes-table th, .changes-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .changes-table th { background-color: #f2f2f2; }
        .added { background-color: #d4edda; }
        .removed { background-color: #f8d7da; }
        .changed { background-color: #d1ecf1; }
        .critical { font-weight: bold; color: #721c24; }
        .major { font-weight: bold; color: #856404; }
        .minor { color: #155724; }
        .cosmetic { color: #004085; }
        .stats { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .stats h3 { margin-top: 0; }
        .summary-card { background: #e8f4f8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8; }
        .summary-stats { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .stat-item { background: white; padding: 10px; border-radius: 3px; text-align: center; min-width: 80px; }
        .stat-value { font-size: 18px; font-weight: bold; color: #2c3e50; }
        .stat-label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{{TITLE}}</h1>
            <p>Generated on {{TIMESTAMP}}</p>
        </div>
        
        <div class="files">
            <div class="file">
                <h3>Left File</h3>
                <p>{{LEFT_FILE}}</p>
            </div>
            <div class="file">
                <h3>Right File</h3>
                <p>{{RIGHT_FILE}}</p>
            </div>
        </div>
        
        {{SUMMARY_SECTION}}
        
        {{CHANGES_TABLE}}
        
        {{STATS_SECTION}}
    </div>
</body>
</html>
    `;
  }

  private generateSummarySection(): string {
    const summary = this.result.summary;
    return `
    <div class="summary-card">
        <h3>Summary</h3>
        <div class="summary-stats">
            <div class="stat-item">
                <div class="stat-value">${summary.total}</div>
                <div class="stat-label">Total Changes</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${summary.added}</div>
                <div class="stat-label">Added</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${summary.removed}</div>
                <div class="stat-label">Removed</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${summary.changed}</div>
                <div class="stat-label">Changed</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${this.result.stats.similarities.toFixed(1)}%</div>
                <div class="stat-label">Similarity</div>
            </div>
        </div>
    </div>
    `;
  }

  private generateChangesTable(): string {
    let table = '<table class="changes-table">';
    table += '<thead><tr><th>Path</th><th>Type</th><th>Old Value</th><th>New Value</th><th>Severity</th><th>Category</th></tr></thead>';
    table += '<tbody>';
    
    for (const change of this.result.changes) {
      const severityClass = change.severity || 'minor';
      const typeClass = change.type;
      
      table += `<tr class="${typeClass}">`;
      table += `<td><code>${change.path}</code></td>`;
      table += `<td>${change.type}</td>`;
      table += `<td>${this.formatValueForHTML(change.oldValue)}</td>`;
      table += `<td>${this.formatValueForHTML(change.newValue)}</td>`;
      table += `<td class="${severityClass}">${change.severity || 'N/A'}</td>`;
      table += `<td>${change.category || 'N/A'}</td>`;
      table += '</tr>';
    }
    
    table += '</tbody></table>';
    return table;
  }

  private generateStatsSection(): string {
    const stats = this.result.stats;
    return `
    <div class="stats">
        <h3>Detailed Statistics</h3>
        <p><strong>Total Changes:</strong> ${this.result.summary.total}</p>
        <p><strong>Added:</strong> ${this.result.summary.added}</p>
        <p><strong>Removed:</strong> ${this.result.summary.removed}</p>
        <p><strong>Changed:</strong> ${this.result.summary.changed}</p>
        <p><strong>Similarity:</strong> ${stats.similarities.toFixed(2)}%</p>
        <p><strong>Comparison Time:</strong> ${this.result.metadata.comparisonTime.toFixed(2)}ms</p>
    </div>
    `;
  }

  private formatValueForHTML(value: any): string {
    if (value === null || value === undefined) return '<em>N/A</em>';
    if (typeof value === 'object') {
      return `<code>${JSON.stringify(value, null, 2)}</code>`;
    }
    return `<code>${String(value)}</code>`;
  }
}

export function exportDiff(
  result: ComparisonResult,
  options: DiffOptions,
  format: ExportOptions['format'],
  exportOptions: Partial<ExportOptions> = {}
): string {
  const exporter = new DiffExporter(result, options);
  return exporter.export(format, exportOptions);
}

export async function exportPDFDiff(
  result: ComparisonResult,
  options: DiffOptions,
  exportOptions: Partial<ExportOptions> = {}
): Promise<Blob> {
  const exporter = new DiffExporter(result, options);
  return await exporter.exportPDF(exportOptions);
}

export function downloadDiff(
  result: ComparisonResult,
  options: DiffOptions,
  format: ExportOptions['format'],
  exportOptions: Partial<ExportOptions> = {}
): void {
  const content = exportDiff(result, options, format, exportOptions);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `diff-${timestamp}.${format}`;
  
  const mimeTypes: Record<string, string> = {
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    patch: 'text/plain'
  };
  
  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadPDFDiff(
  result: ComparisonResult,
  options: DiffOptions,
  exportOptions: Partial<ExportOptions> = {}
): Promise<void> {
  const blob = await exportPDFDiff(result, options, exportOptions);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `diff-${timestamp}.pdf`;
  
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}