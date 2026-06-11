import { ParsedConfig } from '@/types';

export function parseCSV(content: string): ParsedConfig {
  try {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      return {
        data: {},
        format: 'csv',
        error: 'Empty CSV file'
      };
    }

    // Auto-detect delimiter
    const delimiter = detectDelimiter(content);
    
    // Parse first line to determine if it's a header
    const firstLine = lines[0].trim();
    const hasHeader = detectHeader(firstLine, delimiter);
    
    let headers: string[] = [];
    let dataRows: string[][] = [];
    
    if (hasHeader) {
      headers = parseCSVLine(firstLine, delimiter);
      dataRows = lines.slice(1).map(line => parseCSVLine(line, delimiter));
    } else {
      // Generate generic headers
      const firstRow = parseCSVLine(firstLine, delimiter);
      headers = firstRow.map((_, index) => `Column${index + 1}`);
      dataRows = lines.map(line => parseCSVLine(line, delimiter));
    }

    // Convert to structured data
    const data: Record<string, any> = {};
    
    // Create rows object
    const rows: Record<string, any>[] = [];
    const columnData: Record<string, any[]> = {};
    
    // Initialize column data
    headers.forEach(header => {
      columnData[header] = [];
    });
    
    // Process each row
    dataRows.forEach((row, rowIndex) => {
      const rowData: Record<string, any> = {};
      
      headers.forEach((header, colIndex) => {
        const value = row[colIndex] || '';
        const parsedValue = parseValue(value);
        
        rowData[header] = parsedValue;
        columnData[header].push(parsedValue);
      });
      
      rows.push(rowData);
      data[`row_${rowIndex + 1}`] = rowData;
    });
    
    // Add metadata
    data['_metadata'] = {
      headers,
      rowCount: dataRows.length,
      delimiter,
      hasHeader
    };
    
    // Add column-wise data for easier comparison
    data['_columns'] = columnData;
    data['_rows'] = rows;

    return {
      data,
      format: 'csv',
      csvMetadata: {
        headers,
        rowCount: dataRows.length,
        delimiter,
        hasHeader
      }
    };
  } catch (error) {
    return {
      data: {},
      format: 'csv',
      error: error instanceof Error ? error.message : 'Failed to parse CSV'
    };
  }
}

function detectDelimiter(content: string): string {
  const delimiters = [',', ';', '\t', '|'];
  const sampleLines = content.split('\n').slice(0, 5); // Check first 5 lines
  
  let bestDelimiter = ',';
  let maxConsistency = 0;
  
  for (const delimiter of delimiters) {
    const columnCounts = sampleLines.map(line => {
      if (!line.trim()) return 0;
      return parseCSVLine(line, delimiter).length;
    }).filter(count => count > 0);
    
    if (columnCounts.length === 0) continue;
    
    // Check consistency (all lines should have similar column counts)
    const avgColumns = columnCounts.reduce((sum, count) => sum + count, 0) / columnCounts.length;
    const consistency = columnCounts.filter(count => Math.abs(count - avgColumns) <= 1).length / columnCounts.length;
    
    if (consistency > maxConsistency && avgColumns > 1) {
      maxConsistency = consistency;
      bestDelimiter = delimiter;
    }
  }
  
  return bestDelimiter;
}

function detectHeader(firstLine: string, delimiter: string): boolean {
  const cells = parseCSVLine(firstLine, delimiter);
  
  // Check if all cells look like headers (non-numeric, reasonable length)
  const headerLikeCount = cells.filter(cell => {
    const trimmed = cell.trim();
    return trimmed.length > 0 && 
           trimmed.length < 50 && 
           isNaN(Number(trimmed)) && 
           !trimmed.match(/^\d{4}-\d{2}-\d{2}/) && // Not a date
           !trimmed.match(/^\d+[.,]\d+$/); // Not a decimal
  }).length;
  
  return headerLikeCount >= cells.length * 0.7; // 70% of cells look like headers
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  
  return result;
}

function parseValue(value: string): any {
  const trimmed = value.trim();
  
  if (trimmed === '') {
    return null;
  }
  
  // Remove quotes
  const unquoted = trimmed.replace(/^"(.*)"$/, '$1');
  
  // Try to parse as number
  if (!isNaN(Number(unquoted)) && unquoted !== '') {
    return Number(unquoted);
  }
  
  // Try to parse as boolean
  if (unquoted.toLowerCase() === 'true') return true;
  if (unquoted.toLowerCase() === 'false') return false;
  
  // Try to parse as date
  const dateMatch = unquoted.match(/^\d{4}-\d{2}-\d{2}/)
  if (dateMatch) {
    const date = new Date(unquoted);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Return as date string
    }
  }
  
  return unquoted;
}

// CSV-specific comparison utilities
export function compareCSVData(left: Record<string, any>, right: Record<string, any>): {
  changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    csvColumn?: string;
    csvRow?: number;
  }>;
  stats: {
    rowsAdded: number;
    rowsRemoved: number;
    rowsChanged: number;
    columnsAdded: number;
    columnsRemoved: number;
    columnsChanged: number;
  };
} {
  const changes: Array<{
    type: 'added' | 'removed' | 'changed';
    path: string;
    oldValue?: any;
    newValue?: any;
    csvColumn?: string;
    csvRow?: number;
  }> = [];
  
  const leftMeta = left._metadata;
  const rightMeta = right._metadata;
  const leftRows = left._rows || [];
  const rightRows = right._rows || [];
  
  const stats = {
    rowsAdded: 0,
    rowsRemoved: 0,
    rowsChanged: 0,
    columnsAdded: 0,
    columnsRemoved: 0,
    columnsChanged: 0
  };
  
  // Compare headers
  if (leftMeta && rightMeta) {
    const leftHeaders = new Set(leftMeta.headers as string[]);
    const rightHeaders = new Set(rightMeta.headers as string[]);
    
    // Check for added/removed columns
    for (const header of rightHeaders) {
      if (!leftHeaders.has(header)) {
        changes.push({
          type: 'added',
          path: `column.${header}`,
          newValue: header,
          csvColumn: header
        });
        stats.columnsAdded++;
      }
    }
    
    for (const header of leftHeaders) {
      if (!rightHeaders.has(header)) {
        changes.push({
          type: 'removed',
          path: `column.${header}`,
          oldValue: header,
          csvColumn: header
        });
        stats.columnsRemoved++;
      }
    }
  }
  
  // Compare rows
  const maxRows = Math.max(leftRows.length, rightRows.length);
  
  for (let i = 0; i < maxRows; i++) {
    const leftRow = leftRows[i];
    const rightRow = rightRows[i];
    
    if (!leftRow && rightRow) {
      // Row added
      changes.push({
        type: 'added',
        path: `row_${i + 1}`,
        newValue: rightRow,
        csvRow: i + 1
      });
      stats.rowsAdded++;
    } else if (leftRow && !rightRow) {
      // Row removed
      changes.push({
        type: 'removed',
        path: `row_${i + 1}`,
        oldValue: leftRow,
        csvRow: i + 1
      });
      stats.rowsRemoved++;
    } else if (leftRow && rightRow) {
      // Compare row cells
      const allColumns = new Set([...Object.keys(leftRow), ...Object.keys(rightRow)]);
      let rowChanged = false;
      
      for (const column of allColumns) {
        const leftValue = leftRow[column];
        const rightValue = rightRow[column];
        
        if (leftValue !== rightValue) {
          changes.push({
            type: 'changed',
            path: `row_${i + 1}.${column}`,
            oldValue: leftValue,
            newValue: rightValue,
            csvColumn: column,
            csvRow: i + 1
          });
          rowChanged = true;
        }
      }
      
      if (rowChanged) {
        stats.rowsChanged++;
      }
    }
  }
  
  return { changes, stats };
}