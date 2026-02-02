/**
 * Export Service
 * Handles exporting flight data to Excel and CSV formats
 */

import * as XLSX from 'xlsx';

export interface ExportOptions {
  filename?: string;
  selectedColumns?: string[];
}

/**
 * Export data to Excel (.xlsx)
 */
export const exportToExcel = (
  data: any[],
  options: ExportOptions = {}
): void => {
  try {
    const { filename = 'flight_data', selectedColumns } = options;

    // Filter columns if specified
    let exportData = data;
    if (selectedColumns && selectedColumns.length > 0) {
      exportData = data.map((row) => {
        const filtered: Record<string, any> = {};
        
        // Create lowercase key map for case-insensitive lookup
        const rowKeysLower = Object.keys(row).reduce((acc: any, key: string) => {
          acc[key.toLowerCase()] = key;
          return acc;
        }, {});

        selectedColumns.forEach((col) => {
          const colLower = col.toLowerCase();
          
          // Special handling for counters - extract counter numbers from JSON
          if (colLower === 'counters') {
            const actualKey = rowKeysLower[colLower];
            filtered[col] = actualKey ? extractCountersFromJSON(row[actualKey]) : '';
          } else {
            const actualKey = rowKeysLower[colLower];
            if (actualKey) {
              filtered[col] = row[actualKey];
            } else {
              filtered[col] = row[col];
            }
          }
        });
        return filtered;
      });
    }

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Flight Data');

    // Auto-size columns
    const colWidths = selectedColumns
      ? selectedColumns.map(() => 15)
      : Object.keys(exportData[0] || {}).map(() => 15);
    worksheet['!cols'] = colWidths.map((width) => ({ wch: width }));

    // Save file
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);

    console.log('[ExportService] Excel export successful');
  } catch (error) {
    console.error('[ExportService] Excel export error:', error);
    throw error;
  }
};

/**
 * Export data to CSV
 */
export const exportToCSV = (
  data: any[],
  options: ExportOptions = {}
): void => {
  try {
    const { filename = 'flight_data', selectedColumns } = options;

    // Filter columns if specified
    let exportData = data;
    if (selectedColumns && selectedColumns.length > 0) {
      exportData = data.map((row) => {
        const filtered: Record<string, any> = {};
        
        // Create lowercase key map for case-insensitive lookup
        const rowKeysLower = Object.keys(row).reduce((acc: any, key: string) => {
          acc[key.toLowerCase()] = key;
          return acc;
        }, {});

        selectedColumns.forEach((col) => {
          const colLower = col.toLowerCase();
          
          // Special handling for counters - extract counter numbers from JSON
          if (colLower === 'counters') {
            const actualKey = rowKeysLower[colLower];
            filtered[col] = actualKey ? extractCountersFromJSON(row[actualKey]) : '';
          } else {
            const actualKey = rowKeysLower[colLower];
            if (actualKey) {
              filtered[col] = row[actualKey];
            } else {
              filtered[col] = row[col];
            }
          }
        });
        return filtered;
      });
    }

    // Create CSV content
    const headers = selectedColumns || Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            // Escape values containing commas or quotes
            if (value === null || value === undefined) return '';
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"')) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(',')
      ),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${timestamp}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('[ExportService] CSV export successful');
  } catch (error) {
    console.error('[ExportService] CSV export error:', error);
    throw error;
  }
};

/**
 * Get all available columns from data
 */
export const getAvailableColumns = (data: any[]): string[] => {
  if (!data || data.length === 0) return [];

  const columnsSet = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((col) => columnsSet.add(col));
  });

  return Array.from(columnsSet).sort();
};

/**
 * Extract counter numbers from counters JSON field
 * Example: [{"ctr":"32","end":"...","start":"..."}] -> "C32, C33, C34"
 */
const extractCountersFromJSON = (countersData: any): string => {
  if (!countersData) return '';
  
  try {
    const parsed = typeof countersData === 'string' ? JSON.parse(countersData) : countersData;
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => `C${item.ctr}`).join(', ');
    }
  } catch (e) {
    // Return empty if JSON parsing fails
  }
  return '';
};

/**
 * Get default columns to display (important ones)
 */
export const getDefaultColumns = (): string[] => {
  return [
    'dep_flight',
    'arr_flight',
    'std',
    'sta',
    'gate',
    'ac_type',
    'arr_pas',
    'dep_pas',
    'from',
    'to',
    'status',
    'counters',
  ];
};
