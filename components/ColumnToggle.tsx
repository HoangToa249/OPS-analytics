/**
 * Column Toggle Component
 * Allows users to select which columns to display in the table
 */

import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

interface ColumnToggleProps {
  availableColumns: string[];
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export const ColumnToggle: React.FC<ColumnToggleProps> = ({
  availableColumns,
  selectedColumns,
  onColumnsChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleColumn = (column: string) => {
    if (selectedColumns.includes(column)) {
      onColumnsChange(selectedColumns.filter((col) => col !== column));
    } else {
      onColumnsChange([...selectedColumns, column]);
    }
  };

  const selectAll = () => {
    onColumnsChange(availableColumns);
  };

  const deselectAll = () => {
    onColumnsChange([]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
      >
        <span className="text-sm font-medium">
          Columns ({selectedColumns.length}/{availableColumns.length})
        </span>
        <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 z-50 w-64 max-h-96 overflow-y-auto">
            {/* Controls */}
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 p-3 flex gap-2">
              <button
                onClick={selectAll}
                className="flex-1 text-xs font-medium px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="flex-1 text-xs font-medium px-2 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Column List */}
            <div className="p-2">
              {availableColumns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-slate-100 rounded cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700 font-mono break-all">
                    {column}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
