import React, { useState } from 'react';
import { Calendar, Clock, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import DateTimePickerModal from './DateTimePickerModal';

interface TimeRangeSelectorProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  fromDate: Date | null;
  toDate: Date | null;
  onFromDateChange: (date: Date) => void;
  onToDateChange: (date: Date) => void;
  deleteExisting: boolean;
  onDeleteExistingChange: (delete_: boolean) => void;
  recordsInRangeCount?: number;
  isLoading?: boolean;
}

export default function TimeRangeSelector({
  enabled,
  onEnabledChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  deleteExisting,
  onDeleteExistingChange,
  recordsInRangeCount = 0,
  isLoading = false,
}: TimeRangeSelectorProps) {
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Select date & time';
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isValidRange = fromDate && toDate && fromDate <= toDate;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Time Range Filter</h3>
            <p className="text-sm text-slate-600">Optional: Select date range to process specific records</p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="mb-6">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer"
            disabled={isLoading}
          />
          <span className="font-medium text-slate-800 group-hover:text-blue-700 transition-colors">
            Enable Time Range Filtering
          </span>
        </label>
      </div>

      {/* Time Range Selectors */}
      {enabled && (
        <div className="space-y-6">
          {/* Date Range Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* From Date/Time */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                From Date & Time
              </label>
              <button
                onClick={() => setShowFromPicker(true)}
                disabled={isLoading}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg bg-white hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-700 flex items-center justify-between group disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  {formatDateTime(fromDate)}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>
            </div>

            {/* To Date/Time */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                To Date & Time
              </label>
              <button
                onClick={() => setShowToPicker(true)}
                disabled={isLoading}
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg bg-white hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium text-slate-700 flex items-center justify-between group disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  {formatDateTime(toDate)}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </button>
            </div>
          </div>

          {/* Validation Messages */}
          {fromDate && toDate && !isValidRange && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">
                From date must be before or equal to To date
              </p>
            </div>
          )}

          {isValidRange && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <span className="font-bold">Range Selected:</span> 
                {' '}{fromDate?.toLocaleDateString('vi-VN')} {fromDate?.toLocaleTimeString('vi-VN')} 
                {' '}→{' '}
                {toDate?.toLocaleDateString('vi-VN')} {toDate?.toLocaleTimeString('vi-VN')}
              </p>
            </div>
          )}

          {/* Delete Existing Data Option */}
          <div className="border-t border-blue-200 pt-6">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={deleteExisting}
                onChange={(e) => onDeleteExistingChange(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-red-600 cursor-pointer mt-1"
                disabled={isLoading || !isValidRange}
              />
              <div>
                <span className="font-medium text-slate-800 group-hover:text-red-700 transition-colors flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-600" />
                  Delete Existing Data in Time Range
                </span>
                <p className="text-sm text-slate-600 mt-1">
                  Remove all flights with arrival/departure time within selected range before inserting new data
                </p>
              </div>
            </label>

            {deleteExisting && isValidRange && recordsInRangeCount > 0 && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-600 rounded">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-red-900">
                      ⚠️ Warning: {recordsInRangeCount} records will be deleted
                    </p>
                    <p className="text-sm text-red-700 mt-1">
                      All flights with arrival/departure time in this range will be permanently removed.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date/Time Picker Modals */}
      {showFromPicker && (
        <DateTimePickerModal
          isOpen={showFromPicker}
          initialDate={fromDate ? fromDate.toISOString().split('T')[0] : ''}
          initialTime={fromDate ? fromDate.toTimeString().slice(0, 5) : ''}
          mode="datetime"
          title="Select From Date & Time"
          onConfirm={(dateStr) => {
            if (!dateStr || typeof dateStr !== 'string') return;
            const [dateTime, timeOnly] = dateStr.split('T');
            const [year, month, day] = dateTime.split('-');
            const [hours, minutes] = (timeOnly || '00:00').split(':');
            const newDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hours),
              parseInt(minutes)
            );
            onFromDateChange(newDate);
            setShowFromPicker(false);
          }}
          onClose={() => setShowFromPicker(false)}
        />
      )}

      {showToPicker && (
        <DateTimePickerModal
          isOpen={showToPicker}
          initialDate={toDate ? toDate.toISOString().split('T')[0] : ''}
          initialTime={toDate ? toDate.toTimeString().slice(0, 5) : ''}
          mode="datetime"
          title="Select To Date & Time"
          onConfirm={(dateStr) => {
            if (!dateStr || typeof dateStr !== 'string') return;
            const [dateTime, timeOnly] = dateStr.split('T');
            const [year, month, day] = dateTime.split('-');
            const [hours, minutes] = (timeOnly || '00:00').split(':');
            const newDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hours),
              parseInt(minutes)
            );
            onToDateChange(newDate);
            setShowToPicker(false);
          }}
          onClose={() => setShowToPicker(false)}
        />
      )}
    </div>
  );
}
