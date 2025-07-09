import { ComparisonResult, DiffOptions, ExportOptions } from '@/types';

export class ExcelExporter {
  private result: ComparisonResult;
  private options: DiffOptions;

  constructor(result: ComparisonResult, options: DiffOptions) {
    this.result = result;
    this.options = options;
  }

  export(exportOptions: Partial<ExportOptions> = {}): string {
    const fullOptions: ExportOptions = {
      format: 'xlsx',
      includeMetadata: exportOptions.includeMetadata ?? true,
      includeStats: exportOptions.includeStats ?? true,
      includeContext: exportOptions.includeContext ?? true,
      template: exportOptions.template
    };

    return this.generateExcelXML(fullOptions);
  }

  private generateExcelXML(options: ExportOptions): string {
    const worksheets = this.generateWorksheets(options);
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Configuration Diff Report</Title>
    <Author>SimpleConfigDiff</Author>
    <Created>${new Date().toISOString()}</Created>
    <Company>SimpleConfigDiff</Company>
    <Version>1.0</Version>
  </DocumentProperties>
  <OfficeDocumentSettings xmlns="urn:schemas-microsoft-com:office:office">
    <AllowPNG/>
  </OfficeDocumentSettings>
  <ExcelWorkbook xmlns="urn:schemas-microsoft-com:office:excel">
    <WindowHeight>12345</WindowHeight>
    <WindowWidth>28800</WindowWidth>
    <WindowTopX>240</WindowTopX>
    <WindowTopY>75</WindowTopY>
    <ProtectStructure>False</ProtectStructure>
    <ProtectWindows>False</ProtectWindows>
  </ExcelWorkbook>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Borders/>
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
      <Interior ss:Color="#E6E6E6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Added">
      <Interior ss:Color="#D4EDDA" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Removed">
      <Interior ss:Color="#F8D7DA" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Changed">
      <Interior ss:Color="#D1ECF1" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Critical">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#721C24" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Major">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#856404" ss:Bold="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Minor">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#155724"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Regular">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;

    return xml;
  }

  private generateWorksheets(options: ExportOptions): string {
    let worksheets = '';
    
    // Main changes worksheet
    worksheets += this.generateChangesWorksheet();
    
    // Summary worksheet
    worksheets += this.generateSummaryWorksheet();
    
    // Statistics worksheet (if enabled)
    if (options.includeStats) {
      worksheets += this.generateStatisticsWorksheet();
    }
    
    // Metadata worksheet (if enabled)
    if (options.includeMetadata) {
      worksheets += this.generateMetadataWorksheet();
    }
    
    return worksheets;
  }

  private generateChangesWorksheet(): string {
    let xml = `
  <Worksheet ss:Name="Changes">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Path</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Old Value</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">New Value</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Old Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">New Type</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Severity</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Category</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
      </Row>`;

    for (const change of this.result.changes) {
      const typeStyle = this.getTypeStyleID(change.type);
      const severityStyle = this.getSeverityStyleID(change.severity);
      
      xml += `
      <Row>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(change.path)}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(change.type)}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(this.formatValueForExcel(change.oldValue))}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(this.formatValueForExcel(change.newValue))}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(change.oldType || '')}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(change.newType || '')}</Data></Cell>
        <Cell ss:StyleID="${severityStyle}"><Data ss:Type="String">${this.escapeXml(change.severity || 'N/A')}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(change.category || 'N/A')}</Data></Cell>
        <Cell ss:StyleID="${typeStyle}"><Data ss:Type="String">${this.escapeXml(change.description || '')}</Data></Cell>
      </Row>`;
    }

    xml += `
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <Selected/>
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <Panes>
        <Pane>
          <Number>3</Number>
        </Pane>
        <Pane>
          <Number>2</Number>
          <ActiveRow>1</ActiveRow>
        </Pane>
      </Panes>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>`;

    return xml;
  }

  private generateSummaryWorksheet(): string {
    const summary = this.result.summary;
    const stats = this.result.stats;
    
    return `
  <Worksheet ss:Name="Summary">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">File Information</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Left File</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${this.escapeXml(this.result.leftFile.name)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Right File</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${this.escapeXml(this.result.rightFile.name)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Left Format</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${this.escapeXml(this.result.leftFile.format)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Right Format</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${this.escapeXml(this.result.rightFile.format)}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Change Summary</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Count</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Total Changes</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${summary.total}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Added"><Data ss:Type="String">Added</Data></Cell>
        <Cell ss:StyleID="Added"><Data ss:Type="Number">${summary.added}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Removed"><Data ss:Type="String">Removed</Data></Cell>
        <Cell ss:StyleID="Removed"><Data ss:Type="Number">${summary.removed}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Changed"><Data ss:Type="String">Changed</Data></Cell>
        <Cell ss:StyleID="Changed"><Data ss:Type="Number">${summary.changed}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Metrics</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Similarity</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.similarities.toFixed(2)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Comparison Time (ms)</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${this.result.metadata.comparisonTime.toFixed(2)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Generated At</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${new Date().toLocaleString()}</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>`;
  }

  private generateStatisticsWorksheet(): string {
    const stats = this.result.stats;
    
    return `
  <Worksheet ss:Name="Statistics">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Metric</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Description</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Similarity Score</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.similarities.toFixed(4)}</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Percentage of similarity between files</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Total Lines Left</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.linesLeft || 0}</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Number of lines in left file</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Total Lines Right</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.linesRight || 0}</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Number of lines in right file</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Lines Added</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.linesAdded || 0}</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Number of lines added</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Lines Removed</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.linesRemoved || 0}</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Number of lines removed</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Lines Changed</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${stats.linesChanged || 0}</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Number of lines modified</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>`;
  }

  private generateMetadataWorksheet(): string {
    const metadata = this.result.metadata;
    
    return `
  <Worksheet ss:Name="Metadata">
    <Table>
      <Row>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Property</Data></Cell>
        <Cell ss:StyleID="Header"><Data ss:Type="String">Value</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Comparison Time (ms)</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="Number">${metadata.comparisonTime.toFixed(2)}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Algorithm</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${this.escapeXml(metadata.algorithm || 'default')}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Options</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${this.escapeXml(JSON.stringify(this.options))}</Data></Cell>
      </Row>
      <Row>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">Export Time</Data></Cell>
        <Cell ss:StyleID="Regular"><Data ss:Type="String">${new Date().toISOString()}</Data></Cell>
      </Row>
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>`;
  }

  private getTypeStyleID(type: string): string {
    switch (type) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'changed':
        return 'Changed';
      default:
        return 'Regular';
    }
  }

  private getSeverityStyleID(severity?: string): string {
    switch (severity) {
      case 'critical':
        return 'Critical';
      case 'major':
        return 'Major';
      case 'minor':
        return 'Minor';
      default:
        return 'Regular';
    }
  }

  private formatValueForExcel(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export function exportExcel(
  result: ComparisonResult,
  options: DiffOptions,
  exportOptions: Partial<ExportOptions> = {}
): string {
  const exporter = new ExcelExporter(result, options);
  return exporter.export(exportOptions);
}

export function downloadExcel(
  result: ComparisonResult,
  options: DiffOptions,
  exportOptions: Partial<ExportOptions> = {}
): void {
  const content = exportExcel(result, options, exportOptions);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `diff-${timestamp}.xlsx`;
  
  const blob = new Blob([content], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}