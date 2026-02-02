/**
 * Date Time Picker Modal
 * Provides a modal-based date/time picker with calendar UI and side-by-side time picker
 */

import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

interface DateTimePickerModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: (value: string) => void;
  mode: 'date' | 'time' | 'datetime';
  initialDate?: string;
  initialTime?: string;
  title?: string;
}

export const DateTimePickerModal: React.FC<DateTimePickerModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  mode = 'datetime',
  initialDate = '',
  initialTime = '',
  title = 'Select Date & Time'
}) => {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState(initialTime || '00:00');
  const [currentMonth, setCurrentMonth] = useState(
    initialDate ? new Date(initialDate) : new Date()
  );

  // Initialize time in 24-hour format
  const getInitialHours = () => {
    if (!initialTime) return '00';
    const [h, _] = initialTime.split(':');
    return h;
  };

  const [hours, setHours] = useState(getInitialHours());
  const [minutes, setMinutes] = useState(initialTime ? initialTime.split(':')[1] : '00');

  if (!isOpen) return null;

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Use local timezone instead of UTC to avoid date shift
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const dateStr = String(day).padStart(2, '0');
    const dateString = `${year}-${month}-${dateStr}`;
    setSelectedDate(dateString);
  };

  // Time picker handlers (24-hour format internally)
  const incrementHours = () => {
    let h = (parseInt(hours) + 1) % 24;
    setHours(String(h).padStart(2, '0'));
  };

  const decrementHours = () => {
    let h = parseInt(hours) - 1;
    if (h < 0) h = 23;
    setHours(String(h).padStart(2, '0'));
  };

  const incrementMinutes = () => {
    let m = (parseInt(minutes) + 5) % 60;
    setMinutes(String(m).padStart(2, '0'));
  };

  const decrementMinutes = () => {
    let m = (parseInt(minutes) - 5 + 60) % 60;
    setMinutes(String(m).padStart(2, '0'));
  };



  const handleConfirm = () => {
    if (mode === 'date' && !selectedDate) {
      alert('Please select a date');
      return;
    }
    if (mode === 'time' && (!hours || !minutes)) {
      alert('Please select a time');
      return;
    }
    
    if (mode === 'datetime') {
      if (!selectedDate || !hours || !minutes) {
        alert('Please select both date and time');
        return;
      }
      const timeString = `${hours}:${minutes}`;
      onConfirm(`${selectedDate}T${timeString}`);
    } else if (mode === 'date') {
      onConfirm(selectedDate);
    } else if (mode === 'time') {
      const timeString = `${hours}:${minutes}`;
      onConfirm(timeString);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const monthYear = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  // Get previous and next month days for context
  const prevMonthDays = getDaysInMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onCancel || onClose}
            className="p-1 hover:bg-blue-500 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className={`p-6 ${mode === 'datetime' ? 'flex gap-8' : ''}`}>
          {/* Calendar - only show for date/datetime modes */}
          {(mode === 'date' || mode === 'datetime') && (
            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3 className="text-lg font-bold text-slate-900 min-w-[150px] text-center">{monthYear}</h3>
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Weekdays */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-slate-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map(day => {
                  // Use local date formatting to avoid timezone issues
                  const year = currentMonth.getFullYear();
                  const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
                  const dateStr = String(day).padStart(2, '0');
                  const dateString = `${year}-${month}-${dateStr}`;
                  const isSelected = selectedDate === dateString;

                  return (
                    <button
                      key={day}
                      onClick={() => handleDayClick(day)}
                      className={`p-2 rounded-lg font-semibold text-sm transition ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time Picker - only show for time/datetime modes */}
          {(mode === 'time' || mode === 'datetime') && (
            <div className="space-y-4 flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-6">Select Time</h3>
              
              {/* Time Controls Grid */}
              <div className="space-y-4">
                {/* Hours */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase">Hours</label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={decrementHours}
                      className="p-2 hover:bg-slate-100 rounded-lg transition"
                    >
                      <ChevronUp size={20} className="rotate-180" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="23"
                      value={String(hours).padStart(2, '0')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '') {
                          setHours('0');
                        } else {
                          let num = parseInt(val);
                          if (num < 0) num = 0;
                          if (num > 23) num = 23;
                          setHours(String(num).padStart(2, '0'));
                        }
                      }}
                      className="w-16 bg-slate-100 rounded-lg px-3 py-3 text-center text-3xl font-bold text-slate-900 border-2 border-transparent focus:border-blue-500 outline-none"
                    />
                    <button
                      onClick={incrementHours}
                      className="p-2 hover:bg-slate-100 rounded-lg transition"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                </div>

                {/* Minutes */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase">Minutes</label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={decrementMinutes}
                      className="p-2 hover:bg-slate-100 rounded-lg transition"
                    >
                      <ChevronUp size={20} className="rotate-180" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min="0"
                      max="59"
                      value={String(minutes).padStart(2, '0')}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        if (val === '') {
                          setMinutes('0');
                        } else {
                          let num = parseInt(val);
                          if (num < 0) num = 0;
                          if (num > 59) num = 59;
                          setMinutes(String(num).padStart(2, '0'));
                        }
                      }}
                      className="w-16 bg-slate-100 rounded-lg px-3 py-3 text-center text-3xl font-bold text-slate-900 border-2 border-transparent focus:border-blue-500 outline-none"
                    />
                    <button
                      onClick={incrementMinutes}
                      className="p-2 hover:bg-slate-100 rounded-lg transition"
                    >
                      <ChevronDown size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Display */}
        {selectedDate && (mode === 'date' || mode === 'datetime') && (
          <div className="bg-blue-50 border-t border-blue-200 px-6 py-4">
            <p className="text-sm text-slate-600">Selected:</p>
            <p className="text-lg font-bold text-blue-900">
              {(() => {
                // Parse date string locally to avoid timezone issues
                const [year, month, day] = selectedDate.split('-').map(Number);
                const date = new Date(year, month - 1, day);
                return date.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
              })()}
              {(mode === 'datetime') && ` at ${String(hours).padStart(2, '0')}:${minutes}`}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200">
          <button
            onClick={onCancel || onClose}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shadow-md"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default DateTimePickerModal;
