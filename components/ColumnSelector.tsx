import React, { useState } from 'react';
import { Columns3, ChevronDown, Check, X } from 'lucide-react';

interface ColumnSelectorProps {
  availableColumns: Array<{ key: string; label: string }>;
  selectedColumns: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  isLoading?: boolean;
}

export default function ColumnSelector({
  availableColumns,
  selectedColumns,
  onSelectionChange,
  isLoading = false,
}: ColumnSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleColumn = (key: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedColumns.size === availableColumns.length) {
      // Deselect all
      onSelectionChange(new Set());
    } else {
      // Select all
      onSelectionChange(new Set(availableColumns.map((col) => col.key)));
    }
  };

  const allSelected = selectedColumns.size === availableColumns.length;
  const someSelected = selectedColumns.size > 0 && selectedColumns.size < availableColumns.length;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-amber-100 rounded-lg">
          <Columns3 className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Selective Column Update</h3>
          <p className="text-sm text-slate-600">Choose which columns to update (if empty, update all)</p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-4 p-3 bg-amber-100 rounded-lg border border-amber-200">
        <p className="text-sm font-medium text-amber-900">
          {selectedColumns.size === 0
            ? '📝 All columns will be updated'
            : `✅ ${selectedColumns.size} of ${availableColumns.length} columns selected`}
        </p>
      </div>

      {/* Main Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={isLoading}
        className="w-full px-4 py-3 bg-white border-2 border-amber-300 rounded-lg hover:border-amber-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all font-medium text-slate-700 flex items-center justify-between group disabled:opacity-50"
      >
        <span className="flex items-center gap-2">
          <Columns3 className="w-4 h-4 text-amber-600" />
          {isExpanded ? 'Hide Column Options' : 'Show Column Options'}
          {selectedColumns.size > 0 && (
            <span className="ml-2 px-2 py-1 bg-amber-200 text-amber-900 text-xs font-bold rounded">
              {selectedColumns.size}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 group-hover:text-amber-600 transition-all ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-amber-200 pt-4">
          {/* Select All / Deselect All */}
          <button
            onClick={handleSelectAll}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors font-medium text-amber-900 text-sm flex items-center justify-center gap-2"
          >
            {allSelected ? (
              <>
                <X className="w-4 h-4" />
                Deselect All
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Select All
              </>
            )}
          </button>

          {/* Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
            {availableColumns.map((column) => {
              const isSelected = selectedColumns.has(column.key);
              return (
                <label
                  key={column.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-100 border-amber-400 shadow-md'
                      : 'bg-white border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleColumn(column.key)}
                    disabled={isLoading}
                    className="w-5 h-5 rounded border-slate-300 text-amber-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 text-sm">{column.label}</p>
                    <p className="text-xs text-slate-500">{column.key}</p>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-amber-600 font-bold" />
                  )}
                </label>
              );
            })}
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <p className="font-medium mb-1">💡 How it works:</p>
            <ul className="space-y-1 text-xs">
              <li>• <strong>If you select columns:</strong> Only those columns will be updated, others preserved</li>
              <li>• <strong>If you select nothing:</strong> All columns from file will be updated</li>
              <li>• <strong>With Smart Upsert:</strong> Matching records are partially updated</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
