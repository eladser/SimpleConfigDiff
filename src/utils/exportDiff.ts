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
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
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
    html = html.replace('{{TITLE}}', `Diff Report: ${this.result.leftFile.name} vs ${this.result.rightFile.name}`);
    html = html.replace('{{LEFT_FILE}}', this.result.leftFile.name);
    html = html.replace('{{RIGHT_FILE}}', this.result.rightFile.name);
    html = html.replace('{{TIMESTAMP}}', new Date().toLocaleString());
    
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
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .files { display: flex; gap: 20px; margin-bottom: 20px; }
        .file { flex: 1; padding: 10px; background: #f5f5f5; border-radius: 5px; }
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
    </style>
</head>
<body>
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
    
    {{CHANGES_TABLE}}
    
    {{STATS_SECTION}}
</body>
</html>
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
        <h3>Statistics</h3>
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