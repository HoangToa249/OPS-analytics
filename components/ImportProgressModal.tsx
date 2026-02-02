/**
 * Import Progress Modal
 * Shows real-time progress of file import operations
 */

import React from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface ImportProgressModalProps {
  isOpen: boolean;
  isLoading: boolean;
  progress?: {
    processed: number;
    total: number;
    inserted: number;
    updated: number;
    failed: number;
  };
  status?: 'processing' | 'success' | 'error';
  message?: string;
  onClose?: () => void;
}

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  isOpen,
  isLoading,
  progress,
  status = 'processing',
  message,
  onClose,
}) => {
  if (!isOpen) return null;

  const progressPercent = progress
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h2 className="text-xl font-bold">Importing Flight Data</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Icon & Message */}
          <div className="flex items-center gap-4">
            {status === 'processing' && (
              <>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center animate-spin">
                  <Loader className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Processing...</p>
                  <p className="text-sm text-slate-600">{message || 'Uploading and processing your data'}</p>
                </div>
              </>
            )}
            {status === 'success' && (
              <>
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-green-900">Import Complete!</p>
                  <p className="text-sm text-green-700">{message || 'Data imported successfully'}</p>
                </div>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-900">Import Failed</p>
                  <p className="text-sm text-red-700">{message || 'An error occurred during import'}</p>
                </div>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {isLoading && progress && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Progress</span>
                  <span className="font-bold text-blue-600">{progressPercent}%</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-slate-600 font-medium uppercase">Processed</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {progress.processed}/{progress.total}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3">
                  <p className="text-xs text-slate-600 font-medium uppercase">Status</p>
                  <p className="text-sm font-semibold text-purple-600">
                    📥 {progress.inserted} new
                  </p>
                  <p className="text-sm font-semibold text-purple-600">
                    ✏️ {progress.updated} updated
                  </p>
                </div>
              </div>

              {progress.failed > 0 && (
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                  <p className="text-sm font-semibold text-amber-800">
                    ⚠️ {progress.failed} records failed to process
                  </p>
                </div>
              )}
            </>
          )}

          {/* Statistics - Success */}
          {!isLoading && status === 'success' && progress && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{progress.inserted}</p>
                <p className="text-xs text-slate-600 font-medium">Inserted</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{progress.updated}</p>
                <p className="text-xs text-slate-600 font-medium">Updated</p>
              </div>
              <div className={`rounded-lg p-3 text-center ${progress.failed > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <p className={`text-2xl font-bold ${progress.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  {progress.failed}
                </p>
                <p className="text-xs text-slate-600 font-medium">Failed</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {(!isLoading || status !== 'processing') && (
          <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-lg transition"
            >
              {status === 'success' ? 'Done' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportProgressModal;
