import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Trash2,
  DownloadCloud,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart2,
  FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { hasPermission } from '../utils/permissionUtils';
import FileUpload from '../components/FileUpload';
import ImportProgressModal from '../components/ImportProgressModal';
import { parseExcelDate } from '../utils/dateUtils';
import { deleteRecordsInTimeRange } from '../utils/importDataService';

interface ImportProgress {
  processed: number;
  total: number;
  deleted: number;
  inserted: number;
  failed: number;
}

interface UpdatePreview {
  totalRows: number;
  arrFlightCount: number;
  depFlightCount: number;
  rowsInRange: number;
}

export default function DataSync() {
  const navigate = useNavigate();
  const [canImportFlights, setCanImportFlights] = useState(false);

  // Excel data state
  const [excelData, setExcelData] = useState<any[] | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[] | null>(null);
  const [excelMapping, setExcelMapping] = useState<Record<string, number> | null>(null);

  // Time range state
  const [timeRangeFrom, setTimeRangeFrom] = useState<Date | null>(null);
  const [timeRangeTo, setTimeRangeTo] = useState<Date | null>(null);

  // Action state
  const [activeAction, setActiveAction] = useState<'none' | 'delete' | 'update'>('none');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<UpdatePreview | null>(null);

  // Progress state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    processed: 0,
    total: 0,
    deleted: 0,
    inserted: 0,
    failed: 0,
  });
  const [importStatus, setImportStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [importMessage, setImportMessage] = useState('');

  // Check permission on mount
  useEffect(() => {
    checkImportPermission();
  }, []);

  const checkImportPermission = async () => {
    const hasImportPerm = await hasPermission('import', 'flights');
    setCanImportFlights(hasImportPerm);
  };

  // Parse Excel data to generate rows for insertion
  // Returns: { rows, skippedCount, metrics }
  const parseExcelRows = (rawData: any[], headers: string[], map: Record<string, number>, timeFrom: Date, timeTo: Date) => {
    const rows: any[] = [];
    const metrics = {
      total: rawData.length - 1,
      noValidPair: 0,
      outsideTimeRange: 0,
      cancelled: 0,
      parsed: 0,
    };

    for (let i = 1; i < rawData.length; i++) {
      const r = rawData[i];

      // Parse flight numbers
      const arrFlt = map['arrFlt'] !== -1 && map['arrFlt'] !== undefined ? String(r[map['arrFlt']] || '').trim() : '';
      const depFlt = map['depFlt'] !== -1 && map['depFlt'] !== undefined ? String(r[map['depFlt']] || '').trim() : '';

      // Parse times
      const sta = map['sta'] !== -1 && map['sta'] !== undefined ? parseExcelDate(r[map['sta']], 'auto', true) : null;
      const ata = map['ata'] !== -1 && map['ata'] !== undefined ? parseExcelDate(r[map['ata']], 'auto', true) : null;
      const std = map['std'] !== -1 && map['std'] !== undefined ? parseExcelDate(r[map['std']], 'auto', true) : null;
      const atd = map['atd'] !== -1 && map['atd'] !== undefined ? parseExcelDate(r[map['atd']], 'auto', true) : null;

      // NEW LOGIC: Check for valid flight+time pairs
      // A row is valid if it has EITHER:
      // 1. Arrival pair: arr_flight + sta
      // 2. Departure pair: dep_flight + std
      let hasArrivalPair = arrFlt && sta;
      let hasDeparturePair = depFlt && std;
      
      if (!hasArrivalPair && !hasDeparturePair) {
        metrics.noValidPair++;
        continue; // Skip row if it has no valid data pair
      }

      // Check if times are in range
      let outsideRangeCount = 0;
      
      // Debug: log raw values for rows around 02/13
      if (sta && (sta.getDate() === 13 || sta.getDate() === 12)) {
        console.log(`[DEBUG Row ${i}] Raw STA: ${r[map['sta']]} -> Parsed: ${sta.toISOString()} (local: ${sta.toLocaleString()}) vs Range: ${timeFrom.toLocaleString()} ~ ${timeTo.toLocaleString()}`);
      }
      if (std && (std.getDate() === 13 || std.getDate() === 12)) {
        console.log(`[DEBUG Row ${i}] Raw STD: ${r[map['std']]} -> Parsed: ${std.toISOString()} (local: ${std.toLocaleString()}) vs Range: ${timeFrom.toLocaleString()} ~ ${timeTo.toLocaleString()}`);
      }
      
      if (hasArrivalPair && sta && (sta < timeFrom || sta > timeTo)) {
        // Skip arrival if outside range
        console.warn(`[parseExcelRows] Row ${i}: STA ${sta.toISOString()} OUTSIDE range [${timeFrom.toISOString()}, ${timeTo.toISOString()}]`);
        hasArrivalPair = false;
        outsideRangeCount++;
      }
      if (hasDeparturePair && std && (std < timeFrom || std > timeTo)) {
        // Skip departure if outside range
        console.warn(`[parseExcelRows] Row ${i}: STD ${std.toISOString()} OUTSIDE range [${timeFrom.toISOString()}, ${timeTo.toISOString()}]`);
        hasDeparturePair = false;
        outsideRangeCount++;
      }

      // After time range check, ensure still have at least 1 valid pair
      if (!hasArrivalPair && !hasDeparturePair) {
        metrics.outsideTimeRange++;
        continue;
      }

      // Skip cancelled flights (use correct mapping keys: arrStatus and depStatus)
      const depStatus = map['depStatus'] !== -1 && map['depStatus'] !== undefined ? String(r[map['depStatus']] || '').toUpperCase() : '';
      const arrStatus = map['arrStatus'] !== -1 && map['arrStatus'] !== undefined ? String(r[map['arrStatus']] || '').toUpperCase() : '';
      if (depStatus.includes('CX') || depStatus.includes('CNL') || arrStatus.includes('CX') || arrStatus.includes('CNL')) {
        metrics.cancelled++;
        continue;
      }

      // Build row with correct mapping keys
      const depGate = map['depGate'] !== -1 && map['depGate'] !== undefined ? String(r[map['depGate']] || '').trim() : '';
      const arrBelt = map['arrBelt'] !== -1 && map['arrBelt'] !== undefined ? String(r[map['arrBelt']] || '').trim() : '';
      const arrStand = map['arrStand'] !== -1 && map['arrStand'] !== undefined ? String(r[map['arrStand']] || '').trim() : '';
      const depStand = map['depStand'] !== -1 && map['depStand'] !== undefined ? String(r[map['depStand']] || '').trim() : '';
      const counters = map['counters'] !== -1 && map['counters'] !== undefined ? String(r[map['counters']] || '').trim() : '';
      const gate = map['gate'] !== -1 && map['gate'] !== undefined ? String(r[map['gate']] || '').trim() : '';

      const acType = map['acType'] !== -1 && map['acType'] !== undefined ? String(r[map['acType']] || '').trim() : 'UNK';
      const arrPax = map['arrPax'] !== -1 && map['arrPax'] !== undefined ? parseInt(r[map['arrPax']]) || 0 : 0;
      const depPax = map['depPax'] !== -1 && map['depPax'] !== undefined ? parseInt(r[map['depPax']]) || 0 : 0;
      const fromLoc = map['from'] !== -1 && map['from'] !== undefined ? String(r[map['from']] || '').trim().toUpperCase() : '';
      const toLoc = map['to'] !== -1 && map['to'] !== undefined ? String(r[map['to']] || '').trim().toUpperCase() : '';

      const dbRow: any = {
        // Only include flight number if it has the pair
        arr_flight: hasArrivalPair ? arrFlt : null,
        dep_flight: hasDeparturePair ? depFlt : null,
        arr_status: arrStatus || (hasArrivalPair ? 'SCHEDULED' : null),
        dep_status: depStatus || (hasDeparturePair ? 'SCHEDULED' : null),
        arr_pax: arrPax || 0,
        dep_pax: depPax || 0,
        arr_stand: arrStand || null,
        carousel: arrBelt || null,
        flight_from: fromLoc || null,
        dep_stand: depStand || depGate || null,
        gate: gate || depGate || null,
        flight_to: toLoc || null,
        ac_type: acType || 'UNK',
        counters: counters || null,
      };

      // Only include times if they have valid pairs
      if (hasArrivalPair && sta) dbRow.sta = formatDateToUTC(sta);
      if (hasDeparturePair && std) dbRow.std = formatDateToUTC(std);
      if (ata) dbRow.ata = formatDateToUTC(ata);
      if (atd) dbRow.atd = formatDateToUTC(atd);

      metrics.parsed++;
      rows.push(dbRow);
    }

    console.log('[parseExcelRows] Metrics:', metrics);
    return { rows, metrics };
  };

  // Format date to database string for storage
  // Date objects created with local constructor: new Date(year, month, day, hour, min, sec)
  // These objects represent LOCAL time (e.g., 2026-02-13 00:30 Vietnam time UTC+7)
  // Store with explicit timezone offset so database knows it's +07:00
  const formatDateToUTC = (date: Date): string => {
    // Use LOCAL getters to get the time values we see in the Date object
    const year = date.getFullYear();      // Local year
    const month = String(date.getMonth() + 1).padStart(2, '0');      // Local month
    const day = String(date.getDate()).padStart(2, '0');             // Local day
    const hour = String(date.getHours()).padStart(2, '0');           // Local hour
    const minute = String(date.getMinutes()).padStart(2, '0');       // Local minute
    const second = String(date.getSeconds()).padStart(2, '0');       // Local second
    // Return local timestamp with Vietnam timezone offset (+07:00)
    // This tells database: "này là 2026-02-13 00:30 ở múi giờ +07:00"
    // Database sẽ store và convert correctly
    return `${year}-${month}-${day}T${hour}:${minute}:${second}+07:00`;
  };

  // Handle Excel data ready
  const handleDataReady = async (rawData: any[], headers: string[], map: Record<string, number>) => {
    try {
      const canImport = await hasPermission('import', 'flights');
      if (!canImport) {
        alert('❌ You do not have permission to import flight data. Contact your administrator.');
        return;
      }

      setExcelData(rawData);
      setExcelHeaders(headers);
      setExcelMapping(map);

      // Generate preview
      if (timeRangeFrom && timeRangeTo) {
        console.log('[handleDataReady] Time range:', {
          from: timeRangeFrom.toLocaleString(),
          to: timeRangeTo.toLocaleString(),
          fromISO: timeRangeFrom.toISOString(),
          toISO: timeRangeTo.toISOString(),
        });
        
        const parseResult = parseExcelRows(rawData, headers, map, timeRangeFrom, timeRangeTo);
        const rowsInRange = parseResult.rows;
        const metrics = parseResult.metrics;

        let arrCount = 0;
        let depCount = 0;

        rowsInRange.forEach(row => {
          if (row.arr_flight) arrCount++;
          if (row.dep_flight) depCount++;
        });

        setPreviewData({
          totalRows: rawData.length - 1,
          arrFlightCount: arrCount,
          depFlightCount: depCount,
          rowsInRange: rowsInRange.length,
        });

        // Log metrics for debugging
        console.log('[handleDataReady] Excel parsing metrics:', {
          total: metrics.total,
          parsed: metrics.parsed,
          skipped: {
            noValidPair: metrics.noValidPair,
            outsideTimeRange: metrics.outsideTimeRange,
            cancelled: metrics.cancelled,
          }
        });
      }
    } catch (error) {
      console.error('Error preparing data:', error);
      alert('Error preparing data: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Execute DELETE
  const handleDelete = async () => {
    if (deleteConfirmation !== 'delete') {
      alert('❌ Please type "delete" to confirm');
      return;
    }

    if (!timeRangeFrom || !timeRangeTo) {
      alert('❌ Please select time range');
      return;
    }

    try {
      setShowProgressModal(true);
      setIsProcessing(true);
      setImportStatus('processing');
      setImportMessage('🗑️ Deleting records...');
      setImportProgress({
        processed: 0,
        total: 0,
        deleted: 0,
        inserted: 0,
        failed: 0,
      });

      // Convert dates to local format (RPC function will handle timezone)
      const fromStr = formatLocalDateTime(timeRangeFrom);
      const toStr = formatLocalDateTime(timeRangeTo);

      const result = await deleteRecordsInTimeRange(supabase, 'flight_schedule', fromStr, toStr);

      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }

      setIsProcessing(false);
      setImportStatus('success');
      setImportMessage(`✅ Successfully deleted ${result.deletedCount} records`);
      setImportProgress({
        processed: result.deletedCount,
        total: result.deletedCount,
        deleted: result.deletedCount,
        inserted: 0,
        failed: 0,
      });
      console.log(`Deleted ${result.deletedCount} records`);

      // Reset after 2 seconds
      setTimeout(() => {
        setDeleteConfirmation('');
        setActiveAction('none');
      }, 2000);
    } catch (error) {
      console.error('Delete error:', error);
      setIsProcessing(false);
      setImportStatus('error');
      setImportMessage('❌ Delete failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Execute UPDATE (delete + insert)
  const handleUpdate = async () => {
    if (!excelData || !excelHeaders || !excelMapping) {
      alert('❌ No Excel data loaded');
      return;
    }

    if (!timeRangeFrom || !timeRangeTo) {
      alert('❌ Please select time range');
      return;
    }

    try {
      setShowProgressModal(true);
      setIsProcessing(true);
      setShowPreview(false);
      setImportStatus('processing');
      setImportMessage('🗑️ Deleting old records...');
      setImportProgress({ processed: 0, total: previewData?.rowsInRange || 0, deleted: 0, inserted: 0, failed: 0 });

      // STEP 1: Delete old records
      const fromStr = formatLocalDateTime(timeRangeFrom);
      const toStr = formatLocalDateTime(timeRangeTo);

      const deleteResult = await deleteRecordsInTimeRange(supabase, 'flight_schedule', fromStr, toStr);

      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Delete failed');
      }

      setImportProgress(prev => ({ ...prev, deleted: deleteResult.deletedCount, processed: deleteResult.deletedCount }));
      setImportMessage(`✅ Deleted ${deleteResult.deletedCount} records. 📥 Importing new data...`);

      // STEP 2: Parse and insert new rows
      const parseResult = parseExcelRows(excelData, excelHeaders, excelMapping, timeRangeFrom, timeRangeTo);
      const rowsToInsert = parseResult.rows;
      const metrics = parseResult.metrics;

      console.log('[handleUpdate] Parse result:', {
        rowsToInsert: rowsToInsert.length,
        metrics
      });

      if (rowsToInsert.length === 0) {
        setIsProcessing(false);
        setImportStatus('success');
        const skippedSummary = `Skipped: ${metrics.noValidPair} no pair, ${metrics.outsideTimeRange} outside range, ${metrics.cancelled} cancelled`;
        setImportMessage(`✅ Completed: Deleted ${deleteResult.deletedCount} records, no rows to insert. (${skippedSummary})`);
        setImportProgress(prev => ({ ...prev, total: 0, processed: 0 }));
        setActiveAction('none');
        setTimeout(() => {
          setShowProgressModal(false);
        }, 2000);
        return;
      }

      setImportProgress(prev => ({ ...prev, total: rowsToInsert.length }));

      // Batch insert
      const BATCH_SIZE = 100;
      let insertedCount = 0;
      let failedCount = 0;
      const failedErrors: string[] = [];

      for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
        const batch = rowsToInsert.slice(i, i + BATCH_SIZE);

        const { error, count } = await supabase.from('flight_schedule').insert(batch).select('id', { count: 'exact' });

        if (error) {
          console.error(`[handleUpdate] Insert batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error);
          failedCount += batch.length;
          if (failedErrors.length < 3) {
            failedErrors.push(error.message);
          }
        } else {
          insertedCount += batch.length;
        }

        setImportProgress(prev => ({
          ...prev,
          processed: i + batch.length,
          inserted: insertedCount,
          failed: failedCount,
        }));
      }

      // STEP 3: Verify actual inserted count from database
      console.log('[handleUpdate] After insert - before verification:', { insertedCount, failedCount });
      
      // Query to verify actual count in database
      let actualDbCount = 0;
      try {
        const { count } = await supabase
          .from('flight_schedule')
          .select('id', { count: 'exact', head: true })
          .gte('sta', formatLocalDateTime(timeRangeFrom))
          .lte('sta', formatLocalDateTime(timeRangeTo));
        
        actualDbCount = count || 0;
        console.log('[handleUpdate] Actual database count in time range:', actualDbCount);
      } catch (err) {
        console.error('[handleUpdate] Failed to verify count:', err);
      }

      setIsProcessing(false);
      setImportStatus('success');
      
      // Build comprehensive message
      const message = `✅ Completed:\n- Deleted: ${deleteResult.deletedCount}\n- To Insert: ${rowsToInsert.length}\n- Inserted: ${insertedCount}\n- Failed: ${failedCount}\n- Actual in DB: ${actualDbCount}\n- Skipped: ${metrics.outsideTimeRange + metrics.cancelled} (range/cancelled)`;
      
      if (failedErrors.length > 0) {
        console.error('[handleUpdate] Insert errors:', failedErrors);
      }

      setImportMessage(message);
      setImportProgress(prev => ({ ...prev, inserted: actualDbCount }));
      setActiveAction('none');
      
      setTimeout(() => {
        setShowProgressModal(false);
      }, 3000);
    } catch (error) {
      console.error('Update error:', error);
      setIsProcessing(false);
      setImportStatus('error');
      setImportMessage('❌ Update failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // Format date to local datetime string
  const formatLocalDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}`;
  };

  // CRITICAL: Parse datetime-local input as LOCAL time, not UTC
  // HTML datetime-local gives us "2026-02-12T05:00" which we must interpret as LOCAL time
  const parseLocalDateTimeFromInput = (isoString: string): Date => {
    if (!isoString) return new Date();
    const [datePart, timePart] = isoString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    // Create Date as LOCAL time, matching how Excel dates are parsed with fixTz=true
    return new Date(year, month - 1, day, hour, minute || 0, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/home')} className="p-2 hover:bg-slate-700/50 rounded-lg transition">
              <Home size={24} />
            </button>
            <h1 className="text-2xl font-bold">📊 Data Sync</h1>
          </div>
          <p className="text-sm text-slate-400">Simplified Excel Import: Delete or Update by Time Range</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: File Upload & Config */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileSpreadsheet size={24} className="text-blue-400" />
                1. Upload Excel File
              </h2>

              <FileUpload
                title="Flight Schedule Data"
                mappings={[
                  { key: 'arrFlt', label: 'Arrival Flight' },
                  { key: 'depFlt', label: 'Departure Flight' },
                  { key: 'sta', label: 'STA (Scheduled Arrival)' },
                  { key: 'std', label: 'STD (Scheduled Departure)' },
                  { key: 'ata', label: 'ATA (Actual Arrival)', optional: true },
                  { key: 'atd', label: 'ATD (Actual Departure)', optional: true },
                  { key: 'arrStatus', label: 'Arrival Status', optional: true },
                  { key: 'depStatus', label: 'Departure Status', optional: true },
                  { key: 'arrBelt', label: 'Carousel/Belt', optional: true },
                  { key: 'arrStand', label: 'Arrival Stand', optional: true },
                  { key: 'depGate', label: 'Departure Gate', optional: true },
                  { key: 'depStand', label: 'Departure Stand', optional: true },
                  { key: 'counters', label: 'Counters', optional: true },
                  { key: 'gate', label: 'Gate', optional: true },
                  { key: 'acType', label: 'Aircraft Type', optional: true },
                  { key: 'arrPax', label: 'Arrival PAX', optional: true },
                  { key: 'depPax', label: 'Departure PAX', optional: true },
                  { key: 'from', label: 'From Location', optional: true },
                  { key: 'to', label: 'To Location', optional: true },
                ]}
                onDataReady={handleDataReady}
              />
            </div>
          </div>

          {/* Right: Time Range & Actions */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Clock size={20} className="text-amber-400" />
                  2. Time Range
                </h2>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-slate-300">From:</label>
                    <input
                      type="datetime-local"
                      value={timeRangeFrom ? formatLocalDateTime(timeRangeFrom) : ''}
                      onChange={(e) => setTimeRangeFrom(e.target.value ? parseLocalDateTimeFromInput(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">To:</label>
                    <input
                      type="datetime-local"
                      value={timeRangeTo ? formatLocalDateTime(timeRangeTo) : ''}
                      onChange={(e) => setTimeRangeTo(e.target.value ? parseLocalDateTimeFromInput(e.target.value) : null)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <DownloadCloud size={20} className="text-green-400" />
                  3. Action
                </h2>

                <div className="space-y-3">
                  {/* DELETE Button */}
                  <button
                    onClick={() => {
                      if (activeAction !== 'delete') {
                        setActiveAction('delete');
                        setDeleteConfirmation('');
                      }
                    }}
                    disabled={!timeRangeFrom || !timeRangeTo}
                    className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:opacity-50 rounded-lg font-semibold transition flex items-center gap-2 justify-center"
                  >
                    <Trash2 size={18} />
                    Delete Range
                  </button>

                  {/* UPDATE Button */}
                  <button
                    onClick={() => {
                      if (activeAction !== 'update') {
                        setActiveAction('update');
                        setShowPreview(true);
                      }
                    }}
                    disabled={!excelData || !timeRangeFrom || !timeRangeTo}
                    className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:opacity-50 rounded-lg font-semibold transition flex items-center gap-2 justify-center"
                  >
                    <DownloadCloud size={18} />
                    Update Range
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DELETE Confirmation Modal */}
      {activeAction === 'delete' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle size={28} className="text-red-500" />
              Confirm Delete
            </h3>

            <p className="text-slate-300">
              This will delete all records with arrival or departure times in the selected range:
              <br />
              <span className="font-mono text-amber-400">
                {timeRangeFrom?.toLocaleString()} to {timeRangeTo?.toLocaleString()}
              </span>
            </p>

            <p className="text-red-300 font-semibold">⚠️ This action cannot be undone!</p>

            <div>
              <label className="text-sm text-slate-300">Type "delete" to confirm:</label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="delete"
                className="w-full px-3 py-2 mt-1 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setActiveAction('none');
                  setDeleteConfirmation('');
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmation !== 'delete'}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-semibold transition"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE Preview Modal */}
      {activeAction === 'update' && showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <BarChart2 size={28} className="text-blue-400" />
              Update Preview
            </h3>

            <div className="bg-slate-700/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Total rows in Excel:</span>
                <span className="font-bold text-blue-400">{previewData.totalRows}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Rows in time range:</span>
                <span className="font-bold text-green-400">{previewData.rowsInRange}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Arrival flights:</span>
                <span className="font-bold text-amber-400">{previewData.arrFlightCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Departure flights:</span>
                <span className="font-bold text-purple-400">{previewData.depFlightCount}</span>
              </div>
            </div>

            <p className="text-slate-300 text-sm">
              This will delete existing records in the time range and insert {previewData.rowsInRange} new rows.
            </p>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setActiveAction('none');
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Modal */}
      <ImportProgressModal
        show={showProgressModal}
        isLoading={isProcessing}
        status={importStatus}
        message={importMessage}
        progress={importProgress}
        onClose={() => {
          setShowProgressModal(false);
          setIsProcessing(false);
          setDeleteConfirmation('');
          setActiveAction('none');
          setPreviewData(null);
        }}
      />
    </div>
  );
}
