/**
 * Filter Sidebar Component
 * Sidebar with search, column toggle, export buttons, and collapsible filters
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Search, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { FlightDataFilter } from '../utils/flightDataService';
import {
  fetchUniqueAirlines,
  fetchUniqueGates,
  fetchUniqueStatuses,
} from '../utils/flightDataService';
import { DateTimePickerModal } from './DateTimePickerModal';
import { ColumnToggle } from './ColumnToggle';

interface FilterSidebarProps {
  filters: FlightDataFilter;
  onFiltersChange: (filters: FlightDataFilter) => void;
  isLoading?: boolean;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  searchInput?: string;
  onSearchChange?: (value: string) => void;
  availableColumns?: string[];
  selectedColumns?: string[];
  onColumnsChange?: (columns: string[]) => void;
  isExporting?: boolean;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filters,
  onFiltersChange,
  isLoading = false,
  isOpen = true,
  onToggle,
  searchInput = '',
  onSearchChange,
  availableColumns = [],
  selectedColumns = [],
  onColumnsChange,
  isExporting = false,
  onExportExcel,
  onExportCSV,
}) => {
  const [airlines, setAirlines] = useState<string[]>([]);
  const [gates, setGates] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [openPickerType, setOpenPickerType] = useState<'dateTimeFrom' | 'dateTimeTo' | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('status');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Handle search with debounce
  const handleSearchChange = useCallback((value: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      onSearchChange?.(value);
    }, 300);
  }, [onSearchChange]);

  // Load filter options on mount
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [airlinesData, gatesData, statusesData] = await Promise.all([
          fetchUniqueAirlines(),
          fetchUniqueGates(),
          fetchUniqueStatuses(),
        ]);
        setAirlines(airlinesData);
        setGates(gatesData);
        setStatuses(statusesData);
      } catch (error) {
        console.error('[FilterSidebar] Error loading filter options:', error);
      }
    };

    loadFilterOptions();

    // Cleanup debounce timer on unmount
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const updateFilter = (newFilter: Partial<FlightDataFilter>) => {
    onFiltersChange({ ...filters, ...newFilter });
  };

  const toggleArrayFilter = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter((item) => item !== value);
    } else {
      return [...array, value];
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({
      dateFrom: '',
      dateTo: '',
      timeFrom: '',
      timeTo: '',
      airlines: [],
      gates: [],
      statuses: [],
      searchTerm: '',
      flightType: 'all',
      columnFilters: {},
    });
  };

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.timeFrom ||
    filters.timeTo ||
    (filters.airlines && filters.airlines.length > 0) ||
    (filters.gates && filters.gates.length > 0) ||
    (filters.statuses && filters.statuses.length > 0) ||
    filters.searchTerm ||
    (filters.columnFilters && Object.keys(filters.columnFilters).length > 0);

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    const today = new Date().toISOString().split('T')[0];
    switch (preset) {
      case 'today':
        updateFilter({
          dateFrom: today,
          dateTo: today,
          timeFrom: '00:00',
          timeTo: '23:59',
        });
        break;
      case 'arrived':
        updateFilter({ statuses: ['ARRIVED'] });
        break;
      case 'delayed':
        updateFilter({ statuses: ['DELAYED'] });
        break;
      case 'cancelled':
        updateFilter({ statuses: ['CANCELLED'] });
        break;
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen bg-slate-900 text-white shadow-lg transition-all duration-300 z-40 ${
          isOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Toggle Button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          {isOpen && <h2 className="text-lg font-bold">Filters</h2>}
          <button
            onClick={() => onToggle?.(!isOpen)}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        {/* Content */}
        {isOpen && (
          <div className="overflow-y-auto h-[calc(100vh-70px)] p-4 space-y-4">
            {/* Search Bar */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">🔍 Search</h3>
              <div className="relative group">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Tìm kiếm chuyến bay..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-9 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white disabled:bg-slate-700"
                />
              </div>
            </div>

            {/* Column Toggle and Export Buttons */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-300">⚙️ Controls</h3>
              <div className="space-y-2">
                {onColumnsChange && (
                  <ColumnToggle
                    availableColumns={availableColumns}
                    selectedColumns={selectedColumns}
                    onColumnsChange={onColumnsChange}
                  />
                )}
                
                <button
                  onClick={onExportExcel}
                  disabled={isLoading || isExporting}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors font-medium"
                  title="Export Excel"
                >
                  {isExporting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Excel
                </button>

                <button
                  onClick={onExportCSV}
                  disabled={isLoading || isExporting}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors font-medium"
                  title="Export CSV"
                >
                  {isExporting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  CSV
                </button>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                📅 Date Range
              </h3>
              <button
                onClick={() => setOpenPickerType('dateTimeFrom')}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-left border border-slate-700 transition-colors mb-2"
              >
                {filters.dateFrom ? filters.dateFrom : 'From date...'}
              </button>
              <button
                onClick={() => setOpenPickerType('dateTimeTo')}
                disabled={isLoading}
                className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-left border border-slate-700 transition-colors"
              >
                {filters.dateTo ? filters.dateTo : 'To date...'}
              </button>
            </div>

            {/* Status Filter - Chip based */}
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'status' ? null : 'status')}
                className="w-full text-sm font-semibold text-slate-300 flex items-center justify-between hover:text-white transition-colors mb-3"
              >
                🎯 Status
                <ChevronRight
                  size={16}
                  className={`transition-transform ${expandedSection === 'status' ? 'rotate-90' : ''}`}
                />
              </button>
              {expandedSection === 'status' && (
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        updateFilter({ statuses: toggleArrayFilter(filters.statuses || [], status) })
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        (filters.statuses || []).includes(status)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Gate Filter - Chip based */}
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'gate' ? null : 'gate')}
                className="w-full text-sm font-semibold text-slate-300 flex items-center justify-between hover:text-white transition-colors mb-3"
              >
                🚪 Gate
                <ChevronRight
                  size={16}
                  className={`transition-transform ${expandedSection === 'gate' ? 'rotate-90' : ''}`}
                />
              </button>
              {expandedSection === 'gate' && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {gates.map((gate) => (
                    <label
                      key={gate}
                      className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800 rounded cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={(filters.gates || []).includes(gate)}
                        onChange={() =>
                          updateFilter({ gates: toggleArrayFilter(filters.gates || [], gate) })
                        }
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">{gate}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Airline Filter - Chip based */}
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'airline' ? null : 'airline')}
                className="w-full text-sm font-semibold text-slate-300 flex items-center justify-between hover:text-white transition-colors mb-3"
              >
                ✈️ Airline
                <ChevronRight
                  size={16}
                  className={`transition-transform ${expandedSection === 'airline' ? 'rotate-90' : ''}`}
                />
              </button>
              {expandedSection === 'airline' && (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {airlines.map((airline) => (
                    <button
                      key={airline}
                      onClick={() =>
                        updateFilter({ airlines: toggleArrayFilter(filters.airlines || [], airline) })
                      }
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        (filters.airlines || []).includes(airline)
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {airline}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Flight Type */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Flight Type</h3>
              <div className="space-y-2">
                {['all', 'departure', 'arrival'].map((type) => (
                  <label
                    key={type}
                    className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors ${
                      filters.flightType === type ? 'bg-slate-800' : 'hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="flightType"
                      value={type}
                      checked={filters.flightType === type}
                      onChange={(e) =>
                        updateFilter({
                          flightType: e.target.value as 'all' | 'departure' | 'arrival',
                        })
                      }
                      className="w-4 h-4"
                    />
                    <span className="text-sm capitalize">{type === 'all' ? 'All' : type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <X size={16} />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* DateTime Picker Modals */}
      {openPickerType === 'dateTimeFrom' && (
        <DateTimePickerModal
          isOpen={true}
          mode="datetime"
          initialDate={filters.dateFrom || ''}
          initialTime={filters.timeFrom || ''}
          onConfirm={(value) => {
            const [date, time] = value.split('T');
            updateFilter({
              dateFrom: date,
              timeFrom: time,
            });
            setOpenPickerType(null);
          }}
          onCancel={() => setOpenPickerType(null)}
          title="Select Start Date & Time"
        />
      )}

      {openPickerType === 'dateTimeTo' && (
        <DateTimePickerModal
          isOpen={true}
          mode="datetime"
          initialDate={filters.dateTo || ''}
          initialTime={filters.timeTo || ''}
          onConfirm={(value) => {
            const [date, time] = value.split('T');
            updateFilter({
              dateTo: date,
              timeTo: time,
            });
            setOpenPickerType(null);
          }}
          onCancel={() => setOpenPickerType(null)}
          title="Select End Date & Time"
        />
      )}
    </>
  );
};
