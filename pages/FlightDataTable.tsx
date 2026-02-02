/**
 * Flight Data Table Page
 * Displays flight data with pagination, filtering, and export capabilities
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Download,
  FileSpreadsheet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { FlightTableFilter } from '../components/FlightTableFilter';
import { ColumnToggle } from '../components/ColumnToggle';
import {
  fetchFlightData,
  FlightDataFilter,
  FlightDataResult,
  fetchAllFlightDataForExport,
} from '../utils/flightDataService';
import { exportToExcel, exportToCSV, getDefaultColumns, getAvailableColumns } from '../utils/exportService';
import { fmtDateUTC, fmtTimeUTC } from '../utils/dateUtils';

const PAGE_SIZE = 100;

const FlightDataTable: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [filters, setFilters] = useState<FlightDataFilter>({
    dateFrom: '',
    dateTo: '',
    airlines: [],
    gates: [],
    statuses: [],
    searchTerm: '',
    flightType: 'all',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [flightData, setFlightData] = useState<FlightDataResult>({
    data: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    hasMore: false,
  });

  const [selectedColumns, setSelectedColumns] = useState<string[]>(getDefaultColumns());
  const [allAvailableColumns, setAllAvailableColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data when filters or page changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchFlightData(filters, {
          page: currentPage,
          pageSize: PAGE_SIZE,
        });
        setFlightData(result);

        // Get available columns from first load
        if (allAvailableColumns.length === 0 && result.data.length > 0) {
          const available = getAvailableColumns(result.data);
          setAllAvailableColumns(available);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('[FlightDataTable] Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [filters, currentPage, allAvailableColumns.length]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Handle export
  const handleExport = async (format: 'excel' | 'csv') => {
    setIsExporting(true);
    try {
      const exportData = await fetchAllFlightDataForExport(filters);
      if (exportData.length === 0) {
        setError('No data to export');
        return;
      }

      if (format === 'excel') {
        exportToExcel(exportData, {
          selectedColumns,
          filename: 'flight_data',
        });
      } else {
        exportToCSV(exportData, {
          selectedColumns,
          filename: 'flight_data',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      console.error('[FlightDataTable] Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Display columns (only selected ones)
  const displayColumns = useMemo(() => {
    return selectedColumns.filter((col) => allAvailableColumns.includes(col));
  }, [selectedColumns, allAvailableColumns]);

  // Format cell value for display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') {
      // Handle objects - only convert to JSON if they're not dates
      if (value instanceof Date) {
        try {
          return `${fmtDateUTC(value)} ${fmtTimeUTC(value)}`;
        } catch {
          return 'Invalid Date';
        }
      }
      return JSON.stringify(value);
    }
    
    const stringValue = String(value).trim();
    
    // Check if it's a valid ISO date string (contains T and looks like a date)
    if (stringValue.includes('T') && /^\d{4}-\d{2}-\d{2}T/.test(stringValue)) {
      try {
        const date = new Date(stringValue);
        // Only format as date if the date is valid
        if (!isNaN(date.getTime())) {
          return `${fmtDateUTC(date)} ${fmtTimeUTC(date)}`;
        }
      } catch {
        // If date parsing fails, return the original string
        return stringValue;
      }
    }
    
    return stringValue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Flight Data Table</h1>
          <p className="text-slate-600">View, filter, and export flight data from database</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors font-medium"
        >
          <Home size={18} />
          Back to Home
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <FlightTableFilter 
          filters={filters} 
          onFiltersChange={setFilters} 
          isLoading={isLoading}
          selectedColumns={selectedColumns}
        />
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-3">
        <ColumnToggle
          availableColumns={allAvailableColumns}
          selectedColumns={selectedColumns}
          onColumnsChange={setSelectedColumns}
        />

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => handleExport('excel')}
            disabled={isLoading || isExporting || flightData.data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 transition-colors font-medium"
          >
            {isExporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Download size={18} />
            )}
            Export Excel
          </button>

          <button
            onClick={() => handleExport('csv')}
            disabled={isLoading || isExporting || flightData.data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 transition-colors font-medium"
          >
            {isExporting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={18} />
            )}
            Export CSV
          </button>
        </div>
      </div>

      {/* Data Info */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Showing <span className="font-semibold">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
          <span className="font-semibold">
            {Math.min(currentPage * PAGE_SIZE, flightData.total)}
          </span>{' '}
          of <span className="font-semibold">{flightData.total}</span> flights
        </div>

        <div className="text-sm text-slate-600">
          <span className="font-semibold">{displayColumns.length}</span> columns selected
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {isLoading && flightData.data.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={32} className="animate-spin text-slate-400" />
          </div>
        ) : flightData.data.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-500 text-lg">No data found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {displayColumns.map((column) => (
                    <th
                      key={column}
                      className="px-6 py-3 text-left font-semibold text-slate-700 bg-slate-50 whitespace-nowrap"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flightData.data.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    {displayColumns.map((column) => (
                      <td key={`${idx}-${column}`} className="px-6 py-3 text-slate-700">
                        {formatCellValue(row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {flightData.total > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Page <span className="font-semibold">{currentPage}</span> of{' '}
            <span className="font-semibold">{Math.ceil(flightData.total / PAGE_SIZE)}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
            >
              <ChevronLeft size={18} />
              Previous
            </button>

            <button
              onClick={() =>
                setCurrentPage(Math.min(Math.ceil(flightData.total / PAGE_SIZE), currentPage + 1))
              }
              disabled={!flightData.hasMore || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
            >
              Next
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlightDataTable;
