/**
 * Flight Data Table Page
 * Displays flight data with pagination, filtering, and export capabilities
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Search,
} from 'lucide-react';
import { FilterSidebar } from '../components/FilterSidebar';
import {
  fetchFlightData,
  FlightDataFilter,
  FlightDataResult,
  fetchAllFlightDataForExport,
} from '../utils/flightDataService';
import { exportToExcel, exportToCSV, getDefaultColumns, getAvailableColumns } from '../utils/exportService';
import { fmtDateUTC, fmtTimeUTC, parseDbDate } from '../utils/dateUtils';

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
        const date = parseDbDate(stringValue);
        // Only format as date if the date is valid
        if (date && !isNaN(date.getTime())) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {/* Filter Sidebar */}
      <FilterSidebar
        filters={filters}
        onFiltersChange={setFilters}
        isLoading={isLoading}
        isOpen={sidebarOpen}
        onToggle={setSidebarOpen}
        searchInput={filters.searchTerm || ''}
        onSearchChange={(value) => setFilters((prev) => ({ ...prev, searchTerm: value }))}
        availableColumns={allAvailableColumns}
        selectedColumns={selectedColumns}
        onColumnsChange={setSelectedColumns}
        isExporting={isExporting}
        onExportExcel={() => handleExport('excel')}
        onExportCSV={() => handleExport('csv')}
      />

      {/* Main Content */}
      <div
        className={`flex-1 transition-all duration-300 flex flex-col ${sidebarOpen ? 'ml-64' : 'ml-16'}`}
      >
        {/* Header */}
        <div className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Flight Data Table</h1>
              <p className="text-slate-500 text-sm">View, filter, and export flight schedule data</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors font-medium"
            >
              <Home size={18} />
              Back to Home
            </button>
          </div>
        </div>

        <div className="flex-1 px-4 py-4 space-y-3 overflow-hidden flex flex-col">
          {/* Error Alert */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-sm">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <p className="text-red-700 text-xs">{error}</p>
              </div>
            </div>
          )}

          {/* Data Info */}
          <div className="flex items-center justify-between text-xs text-slate-600 px-2 bg-slate-50 py-2 rounded-lg border border-slate-200">
            <div className="flex gap-4">
              <div>
                <span className="font-semibold">{flightData.total}</span> chuyến bay
              </div>
              <div>
                Hiển thị <span className="font-semibold">{flightData.data.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}</span>-
                <span className="font-semibold">
                  {Math.min(currentPage * PAGE_SIZE, flightData.total)}
                </span>
              </div>
            </div>

            <div>
              <span className="font-semibold">{displayColumns.length}</span> cột
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
            {isLoading && flightData.data.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 size={28} className="animate-spin text-blue-500" />
                  <p className="text-sm text-slate-600">Đang tải dữ liệu...</p>
                </div>
              </div>
            ) : flightData.data.length === 0 ? (
              <div className="flex items-center justify-center flex-1">
                <div className="text-center">
                  <Search size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500">Không tìm thấy dữ liệu. Hãy thay đổi các bộ lọc.</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-300">
                    <tr>
                      {displayColumns.map((column) => (
                        <th
                          key={column}
                          className="px-4 py-3 text-left font-semibold text-slate-700 whitespace-nowrap bg-slate-50 text-xs border-r border-slate-200 last:border-r-0"
                        >
                          {column.replace(/_/g, ' ').toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {flightData.data.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          idx % 2 === 0 ? 'hover:bg-blue-50' : 'bg-slate-50/50 hover:bg-blue-50'
                        }`}
                      >
                        {displayColumns.map((column) => (
                          <td
                            key={`${idx}-${column}`}
                            className="px-4 py-2.5 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis border-r border-slate-200 last:border-r-0"
                            title={String(row[column])}
                          >
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
            <div className="flex items-center justify-between text-xs px-2 py-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-slate-600">
                Trang <span className="font-bold text-slate-900">{currentPage}</span> / <span className="font-bold text-slate-900">{Math.ceil(flightData.total / PAGE_SIZE)}</span>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 active:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  <ChevronLeft size={14} />
                  Trước
                </button>

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(Math.ceil(flightData.total / PAGE_SIZE), currentPage + 1))
                  }
                  disabled={!flightData.hasMore || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 active:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-xs font-medium"
                >
                  Tiếp theo
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FlightDataTable;
