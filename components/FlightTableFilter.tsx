/**
 * Flight Table Filter Component
 * Provides custom filters for flight data with time picker and dynamic column filters
 */

import React, { useState, useEffect } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { FlightDataFilter } from '../utils/flightDataService';
import {
  fetchUniqueAirlines,
  fetchUniqueGates,
  fetchUniqueStatuses,
} from '../utils/flightDataService';
import { DateTimePickerModal } from './DateTimePickerModal';

interface FlightTableFilterProps {
  filters: FlightDataFilter;
  onFiltersChange: (filters: FlightDataFilter) => void;
  isLoading?: boolean;
  selectedColumns?: string[];
}

export const FlightTableFilter: React.FC<FlightTableFilterProps> = ({
  filters,
  onFiltersChange,
  isLoading = false,
  selectedColumns = [],
}) => {
  const [airlines, setAirlines] = useState<string[]>([]);
  const [gates, setGates] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [openPickerType, setOpenPickerType] = useState<'dateTimeFrom' | 'dateTimeTo' | null>(null);

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
        console.error('[FlightTableFilter] Error loading filter options:', error);
      }
    };

    loadFilterOptions();
  }, []);

  const updateFilter = (newFilter: Partial<FlightDataFilter>) => {
    onFiltersChange({ ...filters, ...newFilter });
  };

  const clearFilters = () => {
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

  const updateColumnFilter = (column: string, value: string) => {
    const newColumnFilters = filters.columnFilters || {};
    if (value) {
      newColumnFilters[column] = value;
    } else {
      delete newColumnFilters[column];
    }
    updateFilter({ columnFilters: newColumnFilters });
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      {/* Search Bar */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search flight number or gate..."
            value={filters.searchTerm || ''}
            onChange={(e) => updateFilter({ searchTerm: e.target.value })}
            disabled={isLoading}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
          />
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2 font-medium"
        >
          <span>Filters</span>
          <ChevronDown
            size={18}
            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 font-medium"
          >
            <X size={18} />
            Clear
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="pt-4 border-t border-slate-200">
          {/* Date and Time Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* DateTime From */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                From Date & Time
              </label>
              <button
                type="button"
                onClick={() => setOpenPickerType('dateTimeFrom')}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 cursor-pointer bg-white text-left hover:bg-slate-50 transition-colors"
              >
                {filters.dateFrom && filters.timeFrom
                  ? `${filters.dateFrom} ${filters.timeFrom}`
                  : filters.dateFrom
                  ? filters.dateFrom
                  : 'Select date & time...'}
              </button>
            </div>

            {/* DateTime To */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                To Date & Time
              </label>
              <button
                type="button"
                onClick={() => setOpenPickerType('dateTimeTo')}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 cursor-pointer bg-white text-left hover:bg-slate-50 transition-colors"
              >
                {filters.dateTo && filters.timeTo
                  ? `${filters.dateTo} ${filters.timeTo}`
                  : filters.dateTo
                  ? filters.dateTo
                  : 'Select date & time...'}
              </button>
            </div>
          </div>

          {/* Airline, Gate, Status, Flight Type Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Airline Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Airline
              </label>
              <select
                multiple
                value={filters.airlines || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                  updateFilter({ airlines: selected });
                }}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 h-20"
              >
                {airlines.map((airline) => (
                  <option key={airline} value={airline}>
                    {airline}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Gate Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Gate
              </label>
              <select
                multiple
                value={filters.gates || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                  updateFilter({ gates: selected });
                }}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 h-20"
              >
                {gates.map((gate) => (
                  <option key={gate} value={gate}>
                    {gate}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Status
              </label>
              <select
                multiple
                value={filters.statuses || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                  updateFilter({ statuses: selected });
                }}
                disabled={isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100 h-20"
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Flight Type Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Flight Type
              </label>
              <select
                value={filters.flightType || 'all'}
                onChange={(e) =>
                  updateFilter({
                    flightType: e.target.value as 'all' | 'departure' | 'arrival',
                  })
                }
                disabled={isLoading}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
              >
                <option value="all">All</option>
                <option value="departure">Departure</option>
                <option value="arrival">Arrival</option>
              </select>
            </div>
          </div>

          {/* Dynamic Column Filters */}
          {selectedColumns && selectedColumns.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Column Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedColumns.map((column) => (
                  <div key={column}>
                    <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
                      {column.replace(/_/g, ' ')}
                    </label>
                    <input
                      type="text"
                      placeholder={`Filter ${column}...`}
                      value={filters.columnFilters?.[column] || ''}
                      onChange={(e) => updateColumnFilter(column, e.target.value)}
                      disabled={isLoading}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DateTime Picker Modals */}
      {openPickerType === 'dateTimeFrom' && (
        <DateTimePickerModal
          isOpen={true}
          mode="datetime"
          initialDate={filters.dateFrom || ''}
          initialTime={filters.timeFrom || ''}
          onConfirm={(value) => {
            // value format: "2026-01-14T14:30"
            const [date, time] = value.split('T');
            updateFilter({ 
              dateFrom: date, 
              timeFrom: time 
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
            // value format: "2026-01-14T14:30"
            const [date, time] = value.split('T');
            updateFilter({ 
              dateTo: date, 
              timeTo: time 
            });
            setOpenPickerType(null);
          }}
          onCancel={() => setOpenPickerType(null)}
          title="Select End Date & Time"
        />
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.dateFrom && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              From: {filters.dateFrom} {filters.timeFrom && `@ ${filters.timeFrom}`}
            </span>
          )}
          {filters.dateTo && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              To: {filters.dateTo} {filters.timeTo && `@ ${filters.timeTo}`}
            </span>
          )}
          {filters.airlines && filters.airlines.length > 0 && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Airlines: {filters.airlines.join(', ')}
            </span>
          )}
          {filters.gates && filters.gates.length > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              Gates: {filters.gates.join(', ')}
            </span>
          )}
          {filters.statuses && filters.statuses.length > 0 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
              Status: {filters.statuses.join(', ')}
            </span>
          )}
          {filters.columnFilters && Object.keys(filters.columnFilters).length > 0 && (
            Object.entries(filters.columnFilters).map(([column, value]) => (
              <span key={column} className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                {column}: {String(value)}
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
};
