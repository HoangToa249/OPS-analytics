
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  PointElement,
  LineElement,
  Filler,
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { Home, Layout, BarChart2, FileSpreadsheet, RotateCw, Printer, Settings, AlertTriangle, Plane, ChevronDown, ChevronUp, Plus, Trash2, X, GripHorizontal, Edit, Zap, Save, AlertCircle, ZoomIn, ZoomOut, Loader2, Users, DoorOpen, CalendarClock, ListFilter, Wifi, WifiOff, Cloud } from 'lucide-react';

import FileUpload from '../components/FileUpload';
import RoleManagerModal from '../components/RoleManagerModal';
import { DateTimePickerModal } from '../components/DateTimePickerModal';
import { parseExcelDate, toISOLocal, fmtTime, fmtTimeUTC, fmtDateUTC, getFlightColor } from '../utils/dateUtils';
import { sanitizeFlightId, sanitizeGate, sanitizeCounter, safeLog } from '../utils/securityUtils';
import { hasPermission, isAdmin, logAudit } from '../utils/permissionUtils';
import { Flight, CheckinData, AC_CODE_MAP } from '../types';
import { supabase } from '../supabaseClient';
import { exportGateGanttCSV, exportCheckinGanttCSV, exportCombinedGanttCSV } from '../utils/ganttExportService';

// Register ChartJS components locally for this page
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const QUEUE_CARD_WIDTH = 130; 

const Dispatch: React.FC = () => {
  const navigate = useNavigate();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [step, setStep] = useState(0); // 0: Choose load mode, 1.5: Load from cloud, 2: Working
  const [loadMode, setLoadMode] = useState<'cloud' | 'import' | null>(null);
  const [tab, setTab] = useState<'gate' | 'checkin' | 'peak'>('gate');
  const [canImportFlights, setCanImportFlights] = useState(false);
  
  // Realtime Status
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
    // Which table to read/write from. Default to legacy `flight_schedule` but
    // allow runtime fallback to `flights` if the configured DB uses that name.
  const [dataTable, setDataTable] = useState<string>('flight_schedule');
  // Track actual column names detected for gate/counters to write back correctly
  const [gateColumn, setGateColumn] = useState<string>('gate');
  const [countersColumn, setCountersColumn] = useState<string>('counters');
  
  // Peak Analysis Mode
  const [peakMode, setPeakMode] = useState<'density' | 'gate' | 'checkin'>('density');
  // New: Peak Granularity State
  const [peakGranularity, setPeakGranularity] = useState<'15m' | '1h'>('15m');

  // Zoom Control state
  const [zoom, setZoom] = useState(3); 

  // Expanded Gate List - Default to 10 Gates
  const [activeGates, setActiveGates] = useState<string[]>(
    Array.from({length: 10}, (_, i) => `G${String(i + 1).padStart(2, '0')}`)
  );
  
  // Time Controls
  const [gStart, setGStart] = useState<string>('');
  const [gEnd, setGEnd] = useState<string>('');
  const [cloudLoadTimePicker, setCloudLoadTimePicker] = useState<{isOpen: boolean, mode: 'datetime', initialDate: string, initialTime: string, field: 'start' | 'end'} | null>(null);
  
  // Specific Time Controls for Peak Analysis
  const [peakStart, setPeakStart] = useState<string>('');
  const [peakEnd, setPeakEnd] = useState<string>('');

  const [bufS, setBufS] = useState(40);
  const [bufE, setBufE] = useState(15);
  const [isQueueOpen, setIsQueueOpen] = useState(true);
  
  // Queue Resizing State
  const [queueHeight, setQueueHeight] = useState(220); 
  const [isResizing, setIsResizing] = useState(false);

  // Modals & Interactivity
  const [dragFlight, setDragFlight] = useState<{idx: number, isCk: boolean, ckIdx?: number} | null>(null);
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [checkinModal, setCheckinModal] = useState<{idx: number, ckIdx?: number} | null>(null);
  const [peakDetail, setPeakDetail] = useState<{d: string, h: number, flights: Flight[]} | null>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  
  // Gantt CSV Export State
  const [showGanttExportModal, setShowGanttExportModal] = useState(false);
  const [ganttExportType, setGanttExportType] = useState<'gate' | 'checkin' | 'combined'>('gate');
  const [ganttExportDateFrom, setGanttExportDateFrom] = useState<string>('');
  const [ganttExportDateTo, setGanttExportDateTo] = useState<string>('');
  const [ganttExportGates, setGanttExportGates] = useState<string[]>([]);
  const [ganttExportCounters, setGanttExportCounters] = useState<string[]>([]);
  const [isGanttExporting, setIsGanttExporting] = useState(false);

  // Permission & Admin State
  const [canEdit, setCanEdit] = useState(true);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);

  // Cloud data mapping state for manual column parsing
  const [showCloudMapping, setShowCloudMapping] = useState(false);
  const [cloudRawRows, setCloudRawRows] = useState<any[]>([]);
  const [cloudColumns, setCloudColumns] = useState<string[]>([]);
  const [cloudMapping, setCloudMapping] = useState<Record<string, string>>({});

  // Refs for Scrolling
  const gateScrollRef = useRef<HTMLDivElement>(null);
  const gateHeaderRef = useRef<HTMLDivElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  
  const ckScrollRef = useRef<HTMLDivElement>(null);
  const ckHeaderRef = useRef<HTMLDivElement>(null);

  // Initialize Counters: 01-54 and M01-M07
  const [ckRows] = useState([
      ...Array.from({length:54},(_,i)=>String(i+1).padStart(2,'0')), 
      ...Array.from({length:7},(_,i)=>"M"+String(i+1).padStart(2,'0'))
  ]);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      const canEditFlights = await hasPermission('edit', 'flights');
      const canManage = await isAdmin();
      const canImport = await hasPermission('import', 'flights');
      
      console.log('[Dispatch] Permission check - canEdit:', canEditFlights, 'isAdmin:', canManage, 'canImport:', canImport);
      
      setCanEdit(canEditFlights);
      setCanManageRoles(canManage);
      setCanImportFlights(canImport);
    };

    checkPermissions();
  }, []);

  // Handle Window Resize Events for Queue
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const offsetTop = 128;
      const newH = e.clientY - offsetTop;
      if (newH > 60 && newH < window.innerHeight - 200) {
        setQueueHeight(newH);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // --- SUPABASE INTEGRATION ---

    // Convert `datetime-local` (user input) to UTC ISO but KEEP the clock time.
    // Example: input "2025-01-01T09:40" -> "2025-01-01T09:40:00.000Z"
    // This avoids shifting by local timezone (no "-7h" offset).
    const localClockToUTCISOString = (s: string | null): string | null => {
        if (!s) return s;
        const normalized = s.replace(' ', 'T');
        const re = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
        const m = normalized.match(re);
        if (!m) return normalized;
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10) - 1;
        const day = parseInt(m[3], 10);
        const hour = parseInt(m[4], 10);
        const minute = parseInt(m[5], 10);
        const second = m[6] ? parseInt(m[6], 10) : 0;
        return new Date(Date.UTC(year, month, day, hour, minute, second)).toISOString();
    };

    // Helper to parse TEXT or ISO timestamp — create local Date with original clock time
    const parseTextTimestamp = (timeStr: string | null): Date => {
        if (!timeStr) return new Date();
        try {
            // Preserve timezone offset if present (PostgREST returns ISO with offset/Z)
            if (/[+-]\d{2}:?\d{2}$/.test(timeStr) || timeStr.endsWith('Z')) {
                const d = new Date(timeStr as string);
                if (!isNaN(d.getTime())) return d;
            }

            // Handle plain "YYYY-MM-DD HH:MM[:SS]" (no offset)
            const re = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/;
            const match = (timeStr || '').match(re);
            if (match) {
                const year = parseInt(match[1], 10);
                const month = parseInt(match[2], 10) - 1;
                const day = parseInt(match[3], 10);
                const hour = parseInt(match[4], 10);
                const minute = parseInt(match[5], 10);
                const second = match[6] ? parseInt(match[6], 10) : 0;
                return new Date(Date.UTC(year, month, day, hour, minute, second));
            }

            // Fallback
            return new Date(timeStr as string);
        } catch (e) {
            console.error('Error parsing timestamp:', timeStr, e);
            return new Date();
        }
    };

  // Helper to format Date to TEXT timestamp for database
  // Store exactly as provided, without timezone conversion
  // Database stores as "timestamp without time zone" so we preserve exact values
  const formatDateToTextTimestamp = (date: Date): string => {
    // ✅ FIX: Use local getters if data was parsed as local time
    // NOT UTC getters to avoid -7 hour shift
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}+00`;
  };

    // Helper to map DB row to Flight object
    const mapDbToFlight = (row: any): Flight => {
        // Helper: try multiple possible column names and return first non-empty
        const getField = (r: any, ...names: string[]) => {
            for (const n of names) {
                const v = r[n];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
            return undefined;
        };

        // Prefer scheduled departure time; fallback to sta/etd if std missing
        const targetTimeStr = getField(
            row,
            'std',
            'etd',
            'sta',
            'atd'
        );
        let targetDate = parseTextTimestamp(targetTimeStr as string);
        // Fallback: if still invalid but std exists, try direct Date parse
        if ((!targetDate || isNaN(targetDate.getTime())) && row.std) {
            const d = new Date(row.std as string);
            if (!isNaN(d.getTime())) targetDate = d;
        }


    const parsedCheckin: CheckinData[] = [];
    try {
      // row.counters may be stored as:
      // - an array of {ctr, start, end}
      // - an array of strings ["C01","C02"]
      // - a JSON string (stringified array)
      // - a comma-separated string: "C40, C41, C42"
      const normalizeCounters = (raw: any): any[] => {
        if (!raw && raw !== 0) return [];

        try {
          let parsed: any[] = [];

          if (Array.isArray(raw)) {
            parsed = raw;
          } else if (typeof raw === 'string') {
            const s = raw.trim();
            if ((s.startsWith('[') && s.endsWith(']')) || (s.startsWith('{') && s.endsWith('}'))) {
              try {
                const obj = JSON.parse(s);
                parsed = Array.isArray(obj) ? obj : [obj];
              } catch (parseErr) {
                console.warn('[normalizeCounters] Failed to parse JSON string:', s, parseErr);
                return [];
              }
            } else {
              // Accept comma-separated values like "C01, C02"
              const parts = s.split(',').map(x => x.trim()).filter(x => x.length > 0);
              if (parts.length > 0) return parts;
              console.warn('[normalizeCounters] String is not JSON and not comma-separated, skipping:', s);
              return [];
            }
          } else {
            return [];
          }

          const valid: any[] = [];
          parsed.forEach((item: any) => {
            try {
              if (!item || typeof item !== 'object') {
                console.warn('[normalizeCounters] Item nao eh objeto:', item);
                return;
              }
              if (!item.ctr || typeof item.ctr !== 'string') {
                console.warn('[normalizeCounters] Counter sem ctr valido:', item);
                return;
              }
              if (!item.start || !item.end) {
                console.warn('[normalizeCounters] Counter sem start/end:', item);
                return;
              }
              const startDate = new Date(item.start);
              const endDate = new Date(item.end);
              if (isNaN(startDate.getTime())) {
                console.warn('[normalizeCounters] Start date invalida:', item.start);
                return;
              }
              if (isNaN(endDate.getTime())) {
                console.warn('[normalizeCounters] End date invalida:', item.end);
                return;
              }
              valid.push({ctr: item.ctr.trim().toUpperCase(), start: item.start, end: item.end});
            } catch (err) {
              console.warn('[normalizeCounters] Erro processando item:', item, err);
            }
          });
          console.log('[normalizeCounters] Validadas', valid.length, 'entradas de', parsed.length);
          return valid;
        } catch (e) {
          console.error('[normalizeCounters] Erro geral:', e);
          return [];
        }
      };

      const rawCounters = normalizeCounters(row.counters);
      console.log('[mapDbToFlight] rawCounters normalized:', rawCounters);

      rawCounters.forEach((c: any) => {
        try {
          // If entry is object with start/end
          if (c && typeof c === 'object' && (c.start || c.end || c.ctr)) {
            const s = c.start ? parseTextTimestamp(String(c.start)) : null;
            const e = c.end ? parseTextTimestamp(String(c.end)) : null;
            const ctr = c.ctr || (typeof c === 'string' ? String(c) : '01');
            if (s && e) parsedCheckin.push({ ctr: ctr, start: s, end: e });
            else if (ctr) {
              // create default window around targetDate if times missing
              const defStart = new Date(targetDate.getTime() - 180 * 60000);
              const defEnd = new Date(targetDate.getTime() - 50 * 60000);
              parsedCheckin.push({ ctr: ctr, start: defStart, end: defEnd });
            }
          } else if (typeof c === 'string') {
            const ctr = c;
            const defStart = new Date(targetDate.getTime() - 180 * 60000);
            const defEnd = new Date(targetDate.getTime() - 50 * 60000);
            parsedCheckin.push({ ctr, start: defStart, end: defEnd });
          }
        } catch (err) {
          console.warn('[mapDbToFlight] Failed to parse counter entry:', c, err);
        }
      });

      console.log('[mapDbToFlight] Parsed counters count:', parsedCheckin.length);
    } catch (e) {
      console.warn('[mapDbToFlight] Counter parsing error:', e);
    }

    // Prefer departure flight; only fall back to arrival if dep is missing
    const flightId = getField(row, 'dep_flight', 'dep_flt', 'flight', 'flight_no') || getField(row, 'arr_flight', 'arr_flt') || `${row.id}`;

    // DEBUG: Track FD635
    if (flightId === 'FD635') {
      console.log('[DEBUG FD635] mapDbToFlight:', {
        id: flightId,
        std: row.std,
        sta: row.sta,
        targetTimeStr,
        targetDate: targetDate?.toISOString(),
        gate: getField(row, 'gate', 'dep_stand') || 'UNASSIGNED',
        counters: row.counters
      });
    }

    return {
      id: flightId,
      recordId: row.id,
      gate: getField(row, gateColumn, 'gate', 'dep_stand', 'stand') || 'UNASSIGNED',
      target: targetDate,
      isEtd: !!row.std, // True if this is a departure (STD exists)
      acType: row.ac_type,
      acCode: row.aircraft || row.ac_code || getField(row, 'ac_code'), // Try common names
      checkinData: parsedCheckin,
      // Map raw fields (support alternate column names)
      arrFlt: getField(row, 'arr_flight', 'arr_flt'),
      depFlt: getField(row, 'dep_flight', 'dep_flt'),
      cap: row.arr_config || row.dep_config || row.cap, // Capacity from config
      alCode: row.al_code || '',
      date: targetDate,
      // Additional flight_schedule specific fields
      arrPax: row.arr_pax || row.arr_pax || 0,
      depPax: row.dep_pax || row.dep_pax || 0,
      from: row.flight_from || row.from,
      to: row.flight_to || row.to,
      arrSts: row.arr_status || row.arr_sts,
      depSts: row.dep_status || row.dep_sts
    };
  };

    // Persist counters array to DB and return the updated row
    const persistCounters = async (recordId: number | string, countersPayload: any[]) => {
        try {
            // Check edit permission
            if (!canEdit) {
                const error = new Error('❌ You do not have permission to edit flight data. Contact your administrator.');
                console.error('[persistCounters] Permission denied:', error.message);
                setFetchError(error.message);
                throw error;
            }

            console.log('[persistCounters] Iniciando save:', {
                recordId,
                payloadCount: countersPayload.length,
                firstItem: countersPayload[0]
            });

            // Log audit event
            await logAudit('UPDATE_COUNTERS', 'flight', String(recordId), { countersCount: countersPayload.length });
            
            const { data, error } = await supabase
                .from(dataTable)
                .update({ [countersColumn]: countersPayload })
                .eq('id', recordId)
                .select('*')
                .maybeSingle();
            
            if (error) {
                throw new Error(`[persistCounters] DB Error: ${error.message} (code: ${error.code})`);
            }
            
            if (!data) {
                throw new Error('[persistCounters] Không tìm thấy bản ghi sau khi cập nhật (có thể RLS chặn hoặc id không khớp)');
            }
            
            console.log('[persistCounters] Save bem-sucedido:', {
                recordId,
                returnedCounters: data.counters,
                type: typeof data.counters
            });
            
            return data;
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : JSON.stringify(e);
            console.error('[persistCounters] Erro ao persistir:', {
                recordId,
                error: errorMsg,
                payload: countersPayload
            });
            if (errorMsg.toLowerCase().includes('row-level security') || errorMsg.toLowerCase().includes('permission')) {
                alert('Supabase từ chối cập nhật (RLS). Hãy thêm policy UPDATE cho vai trò đang dùng hoặc sử dụng service key.');
            }
            if (errorMsg.toLowerCase().includes('column') && errorMsg.toLowerCase().includes('does not exist')) {
                alert(`Cột counters '${countersColumn}' không tồn tại trong bảng ${dataTable}. Hãy cập nhật tên cột counters đúng (vd: counters).`);
            }
            throw e;
        }
    };

  // Load Data and Subscribe
  useEffect(() => {
    if (!gStart || !gEnd) return;
    
    setIsLoading(true);
    const fetchFlights = async () => {
        console.log('[fetchFlights] gStart:', gStart, 'gEnd:', gEnd);
        // Convert datetime-local (local clock) to real UTC ISO instants
        // and use them directly for range filtering.
        const queryStart = localClockToUTCISOString(gStart) || null;
        const queryEnd = localClockToUTCISOString(gEnd) || null;
        console.log('[fetchFlights] queryStart:', queryStart, 'queryEnd:', queryEnd);

        // Only use dep_flight + std for loading, per requirement
        let allData: any[] = [];
        let hadQueryError = false;
        const pageSize = 1000;
        let page = 0;
        let hasMoreData = true;

        try {
            // Fetch data with pagination to handle datasets larger than 1000 rows
            while (hasMoreData) {
                const from = page * pageSize;
                const to = from + pageSize - 1;
                
                console.log(`[fetchFlights] Fetching page ${page} (rows ${from}-${to})`);
                
                const { data, error } = await supabase
                    .from(dataTable)
                    .select('*', { count: 'exact' })
                    .not('dep_flight', 'is', null)
                    .neq('dep_flight', '')
                    .gte('std', queryStart)
                    .lte('std', queryEnd)
                    .order('std', { ascending: true })
                    .range(from, to);

                if (error) {
                    console.error('[fetchFlights] pagination query error on page', page, ':', error);
                    setFetchError(error.message || JSON.stringify(error));
                    hadQueryError = true;
                    break; // Stop pagination if there's an error
                } else {
                    setFetchError(null);
                    const pageData = data || [];
                    console.log(`[fetchFlights] Page ${page} returned ${pageData.length} rows`);
                    
                    allData = allData.concat(pageData);
                    
                    // If this page returned fewer rows than pageSize, we've reached the end
                    if (pageData.length < pageSize) {
                        hasMoreData = false;
                        console.log('[fetchFlights] ✓ All data fetched. Total rows:', allData.length);
                    } else {
                        page++;
                    }
                }
            }
        } catch (err) {
            console.error('[fetchFlights] Unexpected fetch error:', err);
            const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
            setFetchError(errMsg);
            hadQueryError = true;
        }

        // If the date-range query returned no rows but no error, try a fallback
        // sample query to verify the table contains rows and to help diagnose
        // whether the OR/date filter expression is being interpreted correctly
        if ((!allData || allData.length === 0) && !hadQueryError) {
            try {
                console.warn('[fetchFlights] Primary date-range query returned 0 rows — running fallback sample query to assist debugging');
                const { data: sampleRows, error: sampleErr } = await supabase
                    .from(dataTable)
                    .select('*')
                    .limit(200);

                console.log('[fetchFlights] fallback sampleRows:', sampleRows, 'sampleErr:', sampleErr);
                if (sampleErr) {
                    console.error('[fetchFlights] fallback query error:', sampleErr);
                    // surface error to UI
                    setFetchError(sampleErr.message || JSON.stringify(sampleErr));
                } else if (sampleRows && sampleRows.length > 0) {
                    // We have rows in the table but date-range returned none — likely
                    // a mismatch in column names / timestamp formats or the OR filter
                    // string encoding. Show a clear message to the user in the UI.
                    setFetchError('Table has data but date-range returned none — showing first 200 rows. Check time columns (std/sta/scheduled_time/departure) and timestamp formats.');
                    allData = sampleRows; // show something so flights are not empty
                } else {
                    setFetchError(`No rows found in '${dataTable}' for sample query`);
                }
            } catch (e) {
                console.error('[fetchFlights] fallback query failed:', e);
                const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
                setFetchError(errMsg);
            }
        }

        // If we still have no rows, and we're not already using the alternate
        // table name, try the commonly used `flights` table as a last resort.
        if ((!allData || allData.length === 0) && !hadQueryError && dataTable !== 'flights') {
            try {
                console.warn('[fetchFlights] No rows found on', dataTable, '- trying fallback table `flights`');

                let fallbackData: any[] = [];
                page = 0;
                hasMoreData = true;

                // Also use pagination for fallback table
                while (hasMoreData) {
                    const from = page * pageSize;
                    const to = from + pageSize - 1;
                    
                    const { data: data2, error: err2 } = await supabase
                        .from('flights')
                        .select('*', { count: 'exact' })
                        .not('dep_flight', 'is', null)
                        .neq('dep_flight', '')
                        .gte('std', queryStart)
                        .lte('std', queryEnd)
                        .order('std', { ascending: true })
                        .range(from, to);

                    if (err2) {
                        console.warn('[fetchFlights] flights fallback query error on page', page, ':', err2);
                        break;
                    }

                    const pageData = data2 || [];
                    fallbackData = fallbackData.concat(pageData);
                    
                    if (pageData.length < pageSize) {
                        hasMoreData = false;
                    } else {
                        page++;
                    }
                }

                if (fallbackData.length > 0) {
                    console.log('[fetchFlights] Found rows on `flights` with pagination, switching dataTable to flights. Total rows:', fallbackData.length);
                    setDataTable('flights');
                    allData = fallbackData;
                    setFetchError(null);
                } else {
                    const { data: sampleRows2, error: sampleErr2 } = await supabase
                        .from('flights')
                        .select('*')
                        .limit(200);
                    if (sampleErr2) {
                        console.warn('[fetchFlights] fallback flights sample err', sampleErr2);
                    } else if (sampleRows2 && sampleRows2.length > 0) {
                        console.log('[fetchFlights] `flights` table has rows; switching dataTable to flights');
                        setDataTable('flights');
                        allData = sampleRows2;
                        setFetchError('Using `flights` table for data (date filter returned none)');
                    } else {
                        console.warn('[fetchFlights] No rows in both', dataTable, 'and flights');
                        setFetchError(`No rows found in ${dataTable} or flights for sample query`);
                    }
                }
            } catch (e) {
                console.error('[fetchFlights] Error while trying fallback table `flights`:', e);
            }
        }

        // Detect column names for writing back
        try {
            if (allData && allData.length > 0) {
                const cols = Array.from(new Set(allData.flatMap(Object.keys)));
                const pickGate = () => {
                    const known = ['gate', 'dep_stand', 'stand'];
                    for (const k of known) { if (cols.includes(k)) return k; }
                    return gateColumn;
                };
                const pickCounters = () => {
                    const known = ['counters', 'checkin_counters'];
                    for (const k of known) { if (cols.includes(k)) return k; }
                    return countersColumn;
                };
                const newGateCol = pickGate();
                const newCtrCol = pickCounters();
                if (newGateCol !== gateColumn) setGateColumn(newGateCol);
                if (newCtrCol !== countersColumn) setCountersColumn(newCtrCol);
            }
        } catch (e) {
            console.warn('[fetchFlights] detect columns failed', e);
        }

        // Map rows to flights and detect whether any departure flights exist
        const mappedFlights = allData.map(mapDbToFlight);
        const departureFlights = mappedFlights.filter(f => f.depFlt && String(f.depFlt).trim() !== '');

        if (allData.length > 0) {
            // If there are rows but none contain departure identifiers, warn the user
            if (departureFlights.length === 0) {
                console.warn('No departure flights found in date range (no dep_flight/dep_flt values)');
                setFetchError('No departure flights found in date range (missing dep_flight/dep_flt)');
            }

            // Show cloud mapping modal for manual column parsing
            setCloudRawRows(allData);
            const cols = Array.from(new Set(allData.flatMap(Object.keys)));
            setCloudColumns(cols);
            // Auto-detect basic mapping
            const detect = (names: string[]) => {
                const lower = names.map(n => n.toLowerCase());
                return (candidates: string[]) => {
                    for (const cand of candidates) {
                        const idx = lower.findIndex(h => h.includes(cand));
                        if (idx !== -1) return names[idx];
                    }
                    return '';
                };
            };
            const pick = detect(cols);
            const autoMap: Record<string, string> = {
                flight: pick(['dep_flight', 'dep_flt', 'flight', 'flight_no', 'flt']),
                gate: pick(['gate', 'dep_stand', 'stand']),
                std: pick(['std', 'scheduled_time', 'departure']),
                sta: pick(['sta', 'arrival', 'eta']),
                ac: pick(['ac_type', 'aircraft', 'type'])
            };
            setCloudMapping(autoMap);
            // Always show mapping modal for manual review (similar to Excel import)
            setCloudRawRows(allData);
            setCloudColumns(cols);
            setShowCloudMapping(true);
        } else {
            console.log('No flights found in date range');
        }
        setIsLoading(false);
    };
    
    fetchFlights();
    
    // Realtime subscription
    const channel = supabase
        .channel('dispatch_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: dataTable }, (payload) => {
            if (payload.eventType === 'UPDATE') {
                console.log('[Realtime] UPDATE event:', {
                    recordId: payload.new.id,
                    countersLength: Array.isArray(payload.new.counters) ? payload.new.counters.length : 'unknown',
                    rawCounters: payload.new.counters
                });
                
                setFlights(prev => {
                    return prev.map(f => {
                        if (f.recordId === payload.new.id) {
                            try {
                                const updated = mapDbToFlight(payload.new);
                                
                                console.log('[Realtime] Flight atualizado:', {
                                    id: updated.id,
                                    gate: updated.gate,
                                    checkinsCount: updated.checkinData.length,
                                    checkins: updated.checkinData
                                });
                                
                                return updated;
                            } catch (err) {
                                console.error('[Realtime] Erro ao mapear flight:', {
                                    recordId: payload.new.id,
                                    error: err,
                                    message: err instanceof Error ? err.message : String(err)
                                });
                                
                                return f;
                            }
                        }
                        return f;
                    });
                });
            } else if (payload.eventType === 'INSERT') {
                const newF = mapDbToFlight(payload.new);
                // Check if the new flight falls within our current view window (use UTC conversion)
                const sDate = gStart ? new Date(localClockToUTCISOString(gStart) as string) : null;
                const eDate = gEnd ? new Date(localClockToUTCISOString(gEnd) as string) : null;
                if ((!sDate || newF.target >= sDate) && (!eDate || newF.target <= eDate)) {
                    console.log('[Realtime] INSERT event for new flight', newF.id);
                    setFlights(prev => [...prev, newF]);
                }
            } else if (payload.eventType === 'DELETE') {
                console.log('[Realtime] DELETE event for record', payload.old.id);
                setFlights(prev => prev.filter(f => f.recordId !== payload.old.id));
            }
        })
        .subscribe((status) => {
            setIsLive(status === 'SUBSCRIBED');
        });
        
    return () => { supabase.removeChannel(channel); };
    }, [gStart, gEnd, dataTable]);

  // Apply cloud mapping and load flights (manual mode with modal)
  const applyCloudMapping = () => {
    try {
      // Validate required fields
      if (!cloudMapping.flight) {
        alert('Please map Flight column before applying.');
        return;
      }
      // Require at least one time column: STD (preferred) or STA (fallback)
      if (!cloudMapping.std && !cloudMapping.sta) {
        alert('Please map at least one time column: STD or STA before applying.');
        return;
      }

      // Debug: show what columns are mapped
      console.log('[Cloud Mapping] Column Mappings:', cloudMapping);
      console.log('[Cloud Mapping] Total cloud rows:', cloudRawRows.length);

      const parsedFlights = cloudRawRows.map(row => {
        const flightVal = row[cloudMapping.flight];
        const stdVal = cloudMapping.std ? row[cloudMapping.std] : null;
        const staVal = cloudMapping.sta ? row[cloudMapping.sta] : null;

        if (!flightVal || (!stdVal && !staVal)) {
          return null;
        }

        const mappedRow = {
          ...row,
          dep_flight: String(flightVal).trim(),
          std: stdVal || staVal,
          sta: staVal,
          gate: cloudMapping.gate ? String(row[cloudMapping.gate] ?? '').toUpperCase().trim() : 'UNASSIGNED',
          ac_type: cloudMapping.ac ? String(row[cloudMapping.ac]).trim() : '',
        };

        return mapDbToFlight(mappedRow);
      }).filter(Boolean) as Flight[];


      console.log('[Cloud Mapping] After mapping and parsing - valid flights:', parsedFlights.length);
      if (parsedFlights.length > 0) {
        console.log('[Cloud Mapping] Sample valid flight:', parsedFlights[0]);
      }

      if (parsedFlights.length === 0) {
        alert(`No valid rows after mapping. Check console for details.`);
        return;
      }

      // Store selected gate column for write-back
      if (cloudMapping.gate) {
        setGateColumn(cloudMapping.gate);
      }
      setFlights(parsedFlights);
      setShowCloudMapping(false);
      setCloudRawRows([]);

      // Debug: summary of loaded flights and whether they're in the current view window
      try {
        const sDate = gStart ? new Date(localClockToUTCISOString(gStart) as string) : null;
        const eDate = gEnd ? new Date(localClockToUTCISOString(gEnd) as string) : null;
        const inRangeCount = parsedFlights.filter(f => (!sDate || f.target >= sDate) && (!eDate || f.target <= eDate)).length;
        console.log('[Cloud Mapping] ✓ loaded flights:', parsedFlights.length, 'inRange:', inRangeCount, 'gStart:', gStart, 'gEnd:', gEnd);
        console.log('[Cloud Mapping] Sample flights (up to 20):', parsedFlights.slice(0, 20).map(f => ({ id: f.id, dep: f.depFlt || f.id, gate: f.gate, targetISO: f.target?.toISOString(), targetMs: f.target?.getTime() })));
      } catch (e) {
        console.warn('[Cloud Mapping] debug logging failed', e);
      }

      if (parsedFlights.length === 0) {
        alert('Warning: No valid flights loaded after date parsing. Check console for details.');
      } else {
        console.log(`[Cloud Mapping] ✓ Successfully loaded ${parsedFlights.length} dep_flights`);
      }
    } catch (e) {
      console.error('Failed to apply cloud mapping', e);
      alert('Error applying mapping: ' + String(e));
    }
  };

  // Auto-sync Peak Analysis time range with main schedule range
  useEffect(() => {
    if (gStart && gEnd && (!peakStart || !peakEnd)) {
      setPeakStart(gStart);
      setPeakEnd(gEnd);
    }
  }, [gStart, gEnd, peakStart, peakEnd]);

  // Excel import moved to DataSync.tsx

  const getACCode = (t: string) => {
    if(!t) return 'UNK';
    const s = String(t).toUpperCase().trim();
    for(const k in AC_CODE_MAP) { if(s.includes(k)) return AC_CODE_MAP[k]; }
    return 'UNK';
  };

  // Sync scrolling
  const handleScroll = (sourceRef: React.RefObject<HTMLDivElement>) => {
    if(!sourceRef.current) return;
    const left = sourceRef.current.scrollLeft;
    
    const refs = [gateScrollRef, gateHeaderRef, queueScrollRef, ckScrollRef, ckHeaderRef];
    refs.forEach(r => {
        if(r.current && r !== sourceRef) {
            r.current.scrollLeft = left;
        }
    });
  };

  const calculatePos = (time: Date, start: Date) => {
    const min = (time.getTime() - start.getTime()) / 60000;
    return min * zoom;
  };

  // --- ACTIONS (UPDATED FOR SUPABASE) ---
  const handleDropGate = async (flightIdx: number, gateName: string) => {
    if (flightIdx < 0 || flightIdx >= flights.length) return;
    const f = flights[flightIdx];
    if(!f.recordId) return;

    // Optimistic Update
    const oldGate = f.gate;
    const updated = [...flights];
    updated[flightIdx] = { ...f, gate: gateName };
    setFlights(updated);

    const payloadUpdate: Record<string, any> = { [gateColumn]: gateName };

    const { error } = await supabase.from(dataTable).update(payloadUpdate).eq('id', f.recordId);
    if(error) {
        console.error("Update failed", error);
        if ((error.message || '').toLowerCase().includes('row-level security') || (error.message || '').toLowerCase().includes('permission')) {
            alert('Supabase từ chối cập nhật (RLS). Cần policy UPDATE cho vai trò hiện tại hoặc dùng service key.');
        }
        if ((error.message || '').toLowerCase().includes('column') && (error.message || '').toLowerCase().includes('does not exist')) {
            alert(`Cột gate '${gateColumn}' không tồn tại trong bảng ${dataTable}. Hãy chọn đúng cột gate khi mapping (vd: dep_stand).`);
        }
        // Revert
        updated[flightIdx] = { ...f, gate: oldGate };
        setFlights(updated);
    }
  };

  const handleDropCheckin = async (flightIdx: number, ctrName: string, ctrIdx?: number) => {
     if (flightIdx < 0 || flightIdx >= flights.length) return;
     const f = flights[flightIdx];
     if(!f.recordId) return;
     let newData: CheckinData[] = [];
     // If ctrIdx is undefined, treat as adding a new check-in counter
     if (ctrIdx === undefined) {
         const defStart = new Date(f.target.getTime() - 180 * 60000);
         const defEnd = new Date(f.target.getTime() - 50 * 60000);
         newData = [...f.checkinData, { ctr: ctrName, start: defStart, end: defEnd }];
     } else {
         if (!f.checkinData[ctrIdx]) return;
         newData = f.checkinData.map((c, i) => i === ctrIdx ? { ...c, ctr: ctrName } : c);
     }

     // Serialize dates for DB using ISO 8601 format
     const payloadUp = newData.map(c => ({
        ctr: c.ctr.trim().toUpperCase(),
        start: c.start.toISOString(),
        end: c.end.toISOString()
    }));
     console.log('[handleDropCheckin] Saving payload:', payloadUp);

         // Save to DB FIRST (pessimistic pattern) and read back canonical row
         try {
             const updatedRow = await persistCounters(f.recordId, payloadUp);
             const mapped = mapDbToFlight(updatedRow);
             console.log('[handleDropCheckin] Persisted row, updating UI with canonical data', mapped.id, mapped.checkinData.length);
             setFlights(prev => prev.map(p => p.recordId === mapped.recordId ? mapped : p));
         } catch (e) {
             console.error('[handleDropCheckin] Update FAILED:', e, { payload: payloadUp, recordId: f.recordId });
             const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
             alert('Failed to assign check-in counter: ' + errMsg);
             return;
         }
  };

  const handleUnassign = async (flightIdx: number, isCk: boolean, ckIdx?: number) => {
     if (flightIdx < 0 || flightIdx >= flights.length) return;
     const f = flights[flightIdx];
     if(!f.recordId) return;

     if (isCk) {
         // Unassign check-in counter
         if (ckIdx === undefined || !f.checkinData[ckIdx]) return;

         const newData = f.checkinData.filter((_, i) => i !== ckIdx);

         const payload = newData.map(c => ({
            ctr: c.ctr.trim().toUpperCase(),
            start: c.start.toISOString(),
            end: c.end.toISOString()
        }));
         console.log('[handleUnassign] Saving payload (checkin):', payload);

                // Save to DB FIRST (pessimistic pattern) and read back canonical row
                try {
                    const updatedRow = await persistCounters(f.recordId, payload);
                    const mapped = mapDbToFlight(updatedRow);
                    console.log('[handleUnassign] Persisted row, updating UI with canonical data', mapped.id, mapped.checkinData.length);
                    setFlights(prev => prev.map(p => p.recordId === mapped.recordId ? mapped : p));
                } catch (e) {
                    console.error('[handleUnassign] Update FAILED (checkin):', e, { payload, recordId: f.recordId });
                    const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
                    alert('Failed to unassign check-in counter: ' + errMsg);
                    return;
                }
     } else {
         // Unassign gate
         const payloadGateUnset: Record<string, any> = { [gateColumn]: "UNASSIGNED" };
         const { error } = await supabase.from(dataTable).update(payloadGateUnset).eq('id', f.recordId);
         if(error) {
             console.error('[handleUnassign] Update FAILED (gate):', JSON.stringify(error), { recordId: f.recordId });
             if ((error.message || '').toLowerCase().includes('row-level security') || (error.message || '').toLowerCase().includes('permission')) {
                 alert('Supabase từ chối cập nhật (RLS). Cần policy UPDATE cho vai trò hiện tại hoặc dùng service key.');
             }
             if ((error.message || '').toLowerCase().includes('column') && (error.message || '').toLowerCase().includes('does not exist')) {
                 alert(`Cột gate '${gateColumn}' không tồn tại trong bảng ${dataTable}. Hãy chọn đúng cột gate khi mapping (vd: dep_stand).`);
             }
             alert('Failed to unassign gate: ' + (error.message || JSON.stringify(error)));
             return;
         }

         // Apply UI update ONLY after server confirms success
         console.log('[handleUnassign] Success (gate) - updating UI');
         const updated = [...flights];
         updated[flightIdx] = { ...f, gate: "UNASSIGNED" };
         setFlights(updated);
     }
  };

  const saveCheckinConfig = async (idx: number, data: CheckinData[]) => {
      const f = flights[idx];
      
      if (!f.recordId) {
          alert('Erro: Flight nao tem ID valido');
          return;
      }
      
      // Allow empty counters array (user can delete all counters)
      if (!Array.isArray(data)) {
          alert('Erro: Data must be an array');
          return;
      }

      const validationErrors: string[] = [];
      for (let i = 0; i < data.length; i++) {
          const counter = data[i];
          
          if (!counter.ctr || counter.ctr.trim().length === 0) {
              validationErrors.push(`Counter #${i+1}: ID nao pode estar vazio`);
          }
          
          if (!(counter.start instanceof Date) || isNaN(counter.start.getTime())) {
              validationErrors.push(`Counter #${i+1} (${counter.ctr}): Data de abertura invalida`);
          }
          
          if (!(counter.end instanceof Date) || isNaN(counter.end.getTime())) {
              validationErrors.push(`Counter #${i+1} (${counter.ctr}): Data de fechamento invalida`);
          }
          
          if (counter.start instanceof Date && counter.end instanceof Date && counter.start >= counter.end) {
              validationErrors.push(`Counter #${i+1} (${counter.ctr}): Abertura deve ser antes do fechamento`);
          }
      }
      
      if (validationErrors.length > 0) {
          alert('Erros de validacao:\n' + validationErrors.join('\n'));
          return;
      }
      
      const payload = data.map(c => ({
          ctr: c.ctr.trim().toUpperCase(),
          start: c.start.toISOString(),
          end: c.end.toISOString()
      }));
      
      console.log('[saveCheckinConfig] Payload validado:', {
          recordId: f.recordId,
          numCounters: payload.length,
          payload
      });
      
      try {
          setCheckinModal(null);
          
          const updatedRow = await persistCounters(f.recordId as string, payload);
          const mapped = mapDbToFlight(updatedRow);
          
          console.log('[saveCheckinConfig] Salvo com sucesso:', {
              flight: mapped.id,
              checkinsCount: mapped.checkinData.length,
              data: mapped.checkinData
          });
          
          setFlights(prev => prev.map(p => p.recordId === mapped.recordId ? mapped : p));
      } catch (e) {
          console.error('[saveCheckinConfig] Erro ao salvar:', {
              flight: f.id,
              error: e,
              message: e instanceof Error ? e.message : String(e)
          });
          
          const errorMsg = e instanceof Error ? e.message : 'Erro desconhecido';
          alert(`Erro ao salvar: ${errorMsg}`);
          
          setCheckinModal({ idx });
          return;
      }
  };

  // --- EXPORT FUNCTIONALITY ---
  const handleExportPDF = async () => {
      if (!gStart || !gEnd) {
        alert("Please set the View Window (TO/FROM) first.");
        return;
      }
      
      setIsExporting(true);

      setTimeout(async () => {
          if (!exportRef.current) {
              console.error("Export container not loaded.");
              setIsExporting(false);
              return;
          }

          try {
              const pdf = new jsPDF('l', 'mm', 'a4');
              const pageWidth = 297;
              const pageHeight = 210;
              const margin = 10;
              const printWidth = pageWidth - (margin * 2);
              const printHeight = pageHeight - (margin * 2);
              
              const pages = Array.from(exportRef.current.children);
              
              for (let i = 0; i < pages.length; i++) {
                  const pageElement = pages[i] as HTMLElement;
                  
                  const canvas = await html2canvas(pageElement, { 
                      scale: 2.0, 
                      logging: false,
                      useCORS: true,
                      backgroundColor: '#ffffff'
                  });
                  
                  const imgData = canvas.toDataURL('image/jpeg', 0.70);
                  const imgProps = pdf.getImageProperties(imgData);
                  
                  const pdfRatio = printWidth / printHeight;
                  const imgRatio = imgProps.width / imgProps.height;
                  
                  let finalWidth, finalHeight;
                  
                  if (imgRatio > pdfRatio) {
                      finalWidth = printWidth;
                      finalHeight = printWidth / imgRatio;
                  } else {
                      finalHeight = printHeight;
                      finalWidth = printHeight * imgRatio;
                  }
                  
                  const x = margin + (printWidth - finalWidth) / 2;
                  const y = margin + (printHeight - finalHeight) / 2;
                  
                  if (i > 0) pdf.addPage();
                  pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);
              }

              pdf.save(`${tab === 'gate' ? 'Gate' : 'Checkin'}_Plan_${new Date().toISOString().split('T')[0]}.pdf`);
          } catch (error) {
              console.error("Export failed", error);
              alert("Export failed. Please try again.");
          } finally {
              setIsExporting(false);
          }
      }, 1000);
  };

  // --- GANTT CSV EXPORT FUNCTIONALITY ---
  const handleExportGanttCSV = () => {
    if (!flights.length) {
      alert('No flights to export');
      return;
    }

    try {
      setIsGanttExporting(true);

      // Filter flights based on export settings
      let filteredFlights = [...flights];

      // Filter by date range if specified
      if (ganttExportDateFrom) {
        const dateFrom = new Date(ganttExportDateFrom);
        filteredFlights = filteredFlights.filter(f => f.target >= dateFrom);
      }
      if (ganttExportDateTo) {
        const dateTo = new Date(ganttExportDateTo);
        dateTo.setHours(23, 59, 59, 999); // End of day
        filteredFlights = filteredFlights.filter(f => f.target <= dateTo);
      }

      // Filter by gates if specified
      if (ganttExportGates.length > 0 && ganttExportType !== 'checkin') {
        filteredFlights = filteredFlights.filter(
          f => f.gate && ganttExportGates.includes(f.gate)
        );
      }

      // Filter by counters if specified
      if (ganttExportCounters.length > 0 && ganttExportType !== 'gate') {
        filteredFlights = filteredFlights.filter(f =>
          f.checkinData.some(ck => ganttExportCounters.includes(ck.ctr))
        );
      }

      if (!filteredFlights.length) {
        alert('No flights match the selected filters');
        setIsGanttExporting(false);
        return;
      }

      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Gate_Plan_${dateStr}.csv`;

      // Export based on type
      if (ganttExportType === 'gate') {
        exportGateGanttCSV(filteredFlights, bufS, bufE, filename);
      } else if (ganttExportType === 'checkin') {
        exportCheckinGanttCSV(filteredFlights, filename);
      } else {
        exportCombinedGanttCSV(filteredFlights, bufS, bufE, filename);
      }

      console.log(`[Dispatch] Exported ${ganttExportType} Gantt CSV with ${filteredFlights.length} flights`);
      setShowGanttExportModal(false);
    } catch (error) {
      console.error('[Dispatch] Gantt CSV export error:', error);
      alert('Failed to export Gantt CSV. Check console for details.');
    } finally {
      setIsGanttExporting(false);
    }
  };


  // --- DATA PREP ---
    const unassignedFlights = useMemo(() => {
        if (!gStart || !gEnd) return [];
        const sDate = new Date(localClockToUTCISOString(gStart) as string);
        const eDate = new Date(localClockToUTCISOString(gEnd) as string);
        
        // Normalize targets so flights without gate still appear (like check-in)
        const normalized = flights.map((f, i) => {
            let tgt = f.target;
            if (!tgt || isNaN(tgt.getTime())) {
                const fb = f.std || f.sta || (f as any).etd || (f as any).atd;
                if (fb instanceof Date) tgt = fb;
            }
            if (!tgt || isNaN(tgt.getTime())) {
                return { ...f, target: new Date(0), targetMissing: true, originalIndex: i };
            }
            return { ...f, target: tgt, targetMissing: false, originalIndex: i };
        });

        const result = normalized
            .filter(f => {
                // Gate tab: treat flights with gate missing OR gate not in current list as queue items
                const gateMissingOrHidden = !f.gate || f.gate === 'UNASSIGNED' || (tab === 'gate' && activeGates.indexOf(f.gate) === -1);
                const isUnassigned = tab === 'gate' ? gateMissingOrHidden : (!f.checkinData || f.checkinData.length === 0);
                const inRange = !f.targetMissing && f.target >= sDate && f.target <= eDate;
                const allowMissing = tab === 'gate' && f.targetMissing; // still show in gate queue if target missing
                return isUnassigned && (inRange || allowMissing);
            })
            .sort((a, b) => a.target.getTime() - b.target.getTime());
        
        return result;
    }, [flights, tab, gStart, gEnd]);

    const packedQueue = useMemo(() => {
        if (!gStart) return { items: [], lanes: 0 };
        const s = new Date(localClockToUTCISOString(gStart) as string);
    const lanes: number[] = []; 
    
    const getQueueTime = (f: Flight) => {
        if(tab === 'checkin' && f.checkinData.length > 0) {
             const minStart = new Date(Math.min(...f.checkinData.map(c => c.start.getTime())));
             return minStart;
        }
        if(tab === 'checkin') return new Date(f.target.getTime() - 180 * 60000); 
        return f.target; 
    };

    const items = unassignedFlights.map(f => {
       const displayTime = getQueueTime(f);
       const x = Math.max(0, calculatePos(displayTime, s));
       
       let laneIdx = -1;
       for(let i=0; i<lanes.length; i++) {
           if (lanes[i] + 10 < x) { 
               laneIdx = i;
               break;
           }
       }
       if (laneIdx === -1) {
           laneIdx = lanes.length;
           lanes.push(0);
       }
       lanes[laneIdx] = x + QUEUE_CARD_WIDTH;
       return { ...f, x, laneIdx, displayTime };
    });

    return { items, lanes: lanes.length };
  }, [unassignedFlights, gStart, tab, zoom]);

  // Note: Removed auto-expand gate list - user manages activeGates manually via Gate Manager modal
  // Flights with gates not in activeGates will appear in Queue only, not on stands

  // Step 0: Choose load mode (Cloud or Import)
  if(step === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Load Dispatch Data</h2>
            <button 
              onClick={() => navigate('/home')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={28} />
            </button>
          </div>

          <p className="text-slate-300 mb-8 text-lg">
            How would you like to load your flight data?
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Load from Cloud */}
            <div 
              onClick={() => {
                setLoadMode('cloud');
                setStep(1.5); // special step for loading
              }}
              className="group bg-gradient-to-br from-blue-600/20 to-blue-400/20 border border-blue-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-blue-400/60 hover:from-blue-600/30 hover:to-blue-400/30 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <Cloud className="w-10 h-10 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Load from Cloud</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Load existing data from Supabase. Set date range to retrieve synchronized data.
              </p>
              <ul className="text-xs text-slate-400 space-y-2">
                <li>✓ No file upload needed</li>
                <li>✓ Realtime collaboration</li>
                <li>✓ Previously synced data</li>
              </ul>
            </div>

            {/* Import Local Excel File */}
            {canImportFlights && (
              <div 
                onClick={() => {
                  setLoadMode('import');
                  setStep(1);
                }}
                className="group bg-gradient-to-br from-amber-600/20 to-amber-400/20 border border-amber-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-amber-400/60 hover:from-amber-600/30 hover:to-amber-400/30 hover:shadow-lg hover:shadow-amber-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <FileSpreadsheet className="w-10 h-10 text-amber-400" />
                  <h3 className="text-xl font-bold text-white">Import Local File</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Upload Excel file from your computer. Load data locally for this session.
                </p>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>✓ Import Excel file (.xlsx, .xls)</li>
                  <li>✓ Load locally (no sync)</li>
                  <li>✓ Quick testing & preview</li>
                </ul>
              </div>
            )}

            {/* No Permission Message */}
            {!canImportFlights && (
              <div className="bg-slate-700/50 border border-amber-500/30 p-8 rounded-2xl">
                <div className="flex items-start gap-4">
                  <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">Import Permission Required</h3>
                    <p className="text-slate-300 text-sm mb-3">
                      You don't have permission to import flight data locally. 
                    </p>
                    <p className="text-slate-400 text-sm">
                      Please contact your administrator to request import permissions, or use the <strong>Load from Cloud</strong> option to access previously synced data.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 text-center mt-8">
            To sync data to cloud, use <strong>Data Sync</strong> tab. You can change data source anytime from the home screen.
          </p>
        </div>
      </div>
    );
  }

  // Step 1: Import Local Excel File
  const handleLocalExcelImport = async (rawData: any[], headers: string[], map: Record<string, number>, config: any) => {
    try {
      setIsLoading(true);
      
      // Check import permission
      const canImport = await hasPermission('import', 'flights');
      if (!canImport) {
        const error = new Error('❌ You do not have permission to import flight data. Contact your administrator.');
        console.error('[handleLocalExcelImport] Permission denied:', error.message);
        setFetchError(error.message);
        setIsLoading(false);
        return;
      }
      
      const newFlights: Flight[] = [];

      for(let i=1; i<rawData.length; i++) {
        const r = rawData[i];
        
        // Get flight identifiers (ARR or DEP)
        const arrFlt = map['arrFlt'] !== -1 ? String(r[map['arrFlt']] || "").trim() : "";
        const depFlt = map['depFlt'] !== -1 ? String(r[map['depFlt']] || "").trim() : "";
        
        if(!arrFlt && !depFlt) continue;
        
        // Get times
        const sta = map['sta'] !== -1 ? parseExcelDate(r[map['sta']], 'auto', config.fixTz) : null;
        const std = map['std'] !== -1 ? parseExcelDate(r[map['std']], 'auto', config.fixTz) : null;
        const ata = map['ata'] !== -1 ? parseExcelDate(r[map['ata']], 'auto', config.fixTz) : null;
        const atd = map['atd'] !== -1 ? parseExcelDate(r[map['atd']], 'auto', config.fixTz) : null;
        
        const target = sta || std || ata || atd;
        if(!target) continue;
        
        // Get gate info
        const gate = map['gate'] !== -1 ? String(r[map['gate']] || "").trim() : "";
        const depGate = map['depGate'] !== -1 ? String(r[map['depGate']] || "").trim() : "";
        const countersStr = map['counters'] !== -1 ? String(r[map['counters']] || "").trim() : "";
        
        // Get aircraft type
        const acType = map['acType'] !== -1 ? String(r[map['acType']] || "").trim() : "UNK";
        const acCode = getACCode(acType);
        
        // Skip cancelled flights
        const depSts = map['depSts'] !== -1 ? String(r[map['depSts']] || "").toUpperCase() : "";
        const arrSts = map['arrSts'] !== -1 ? String(r[map['arrSts']] || "").toUpperCase() : "";
        if(depSts.includes('CX') || depSts.includes('CNL') || arrSts.includes('CX') || arrSts.includes('CNL')) continue;
        
        // Parse counters if provided
        const parsedCheckin: CheckinData[] = [];
        if(countersStr) {
          const counterList = countersStr.split(',').map(c => c.trim()).filter(c => c);
          counterList.forEach(ctr => {
            const defStart = new Date(target.getTime() - 180 * 60000);
            const defEnd = new Date(target.getTime() - 50 * 60000);
            parsedCheckin.push({ ctr: ctr.toUpperCase(), start: defStart, end: defEnd });
          });
        }
        
        const fltId = depFlt || arrFlt;
        newFlights.push({
          id: fltId,
          gate: gate || depGate || 'UNASSIGNED',
          target,
          isEtd: !!std,
          acType,
          acCode,
          checkinData: parsedCheckin,
          date: target
        });
      }

      if(newFlights.length === 0) {
        alert("No valid flights found in Excel file.");
        setIsLoading(false);
        return;
      }

      // Calculate date range
      const dates = newFlights.map(f => f.target.getTime());
      const minTime = Math.min(...dates);
      const min = new Date(minTime);
      min.setUTCHours(min.getUTCHours() - 2);
      const defaultEnd = new Date(min.getTime() + 12 * 60 * 60 * 1000);
      
      const isoStart = toISOLocal(min);
      const isoEnd = toISOLocal(defaultEnd);

      // Load flights to memory (no DB sync)
      setGStart(isoStart);
      setGEnd(isoEnd);
      setPeakStart(isoStart);
      setPeakEnd(isoEnd);
      setFlights(newFlights);
      
      alert(`✅ Successfully loaded ${newFlights.length} flights from Excel!\n\n📌 Data is loaded locally. Changes will not be saved to cloud.`);
      setIsLoading(false);
      setStep(2);
    } catch(e: any) {
      console.error(e);
      alert("Error parsing Excel file: " + e.message);
      setIsLoading(false);
    }
  };

  if(step === 1) {
    return (
        <div className="relative">
             {isLoading && (
                 <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center flex-col">
                     <Loader2 className="animate-spin text-blue-600 mb-2" size={40}/>
                     <p className="font-bold text-slate-600">Loading Excel data...</p>
                 </div>
             )}
            <FileUpload 
              title="Import Flight Data from Excel" 
              mappings={[
                { key: 'arrFlt', label: 'Arr Flight', optional: true },
                { key: 'depFlt', label: 'Dep Flight', optional: true },
                { key: 'sta', label: 'STA (Scheduled Arrival)', optional: true },
                { key: 'std', label: 'STD (Scheduled Departure)', optional: true },
                { key: 'ata', label: 'ATA (Estimated Arrival)', optional: true },
                { key: 'atd', label: 'ATD (Actual Departure)', optional: true },
                { key: 'acType', label: 'Aircraft Type', optional: true },
                { key: 'gate', label: 'Gate / Dep Stand', optional: true },
                { key: 'depGate', label: 'Dep Gate', optional: true },
                { key: 'counters', label: 'Counters (comma-separated)', optional: true },
                { key: 'depSts', label: 'Departure Status', optional: true },
                { key: 'arrSts', label: 'Arrival Status', optional: true }
              ]} 
              onDataReady={handleLocalExcelImport}
              extraConfig={
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-4">
                      <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                          <AlertTriangle size={18}/>
                          <span>Local Load Mode</span>
                      </div>
                      <p className="text-xs text-amber-700 leading-relaxed">
                          Data will be loaded to this session only. Changes are NOT saved to cloud. To sync data to Supabase, use Data Sync tab.
                      </p>
                  </div>
              }
            />
        </div>
    );
  }

  // Step 1.5: Load from Cloud - Set date range
  if(step === 1.5) {
    return (
      <div className="relative min-h-screen bg-slate-50 p-8">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={() => setStep(0)}
            className="mb-6 text-slate-500 hover:text-slate-700 flex items-center gap-2"
          >
            ← Back
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
                  <Cloud className="text-blue-500" size={28} />
                  Load Data from Cloud
                </h2>
                <p className="text-slate-600">
                  Select the date range to load your flight data from Supabase.
                </p>
              </div>
              <button 
                onClick={() => navigate('/home')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Back to Home"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Date & Time</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="YYYY-MM-DD HH:MM"
                    value={gStart}
                    onChange={(e) => setGStart(e.target.value)}
                    className="flex-1 border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={() => {
                      const [date, time] = gStart.split(' ');
                      setCloudLoadTimePicker({
                        isOpen: true,
                        mode: 'datetime',
                        initialDate: date || '',
                        initialTime: time || '00:00',
                        field: 'start'
                      });
                    }}
                    className="px-3 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors"
                    title="Pick from calendar"
                  >
                    📅
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">End Date & Time</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="YYYY-MM-DD HH:MM"
                    value={gEnd}
                    onChange={(e) => setGEnd(e.target.value)}
                    className="flex-1 border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={() => {
                      const [date, time] = gEnd.split(' ');
                      setCloudLoadTimePicker({
                        isOpen: true,
                        mode: 'datetime',
                        initialDate: date || '',
                        initialTime: time || '00:00',
                        field: 'end'
                      });
                    }}
                    className="px-3 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors"
                    title="Pick from calendar"
                  >
                    📅
                  </button>
                </div>
              </div>

              <button 
                onClick={() => {
                  if(gStart && gEnd) {
                    setStep(2);
                  } else {
                    alert('Please select both start and end date');
                  }
                }}
                disabled={!gStart || !gEnd}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Load Data
              </button>
            </div>

            {isLoading && (
              <div className="mt-6 flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="animate-spin" size={20} />
                <span>Loading data from Supabase...</span>
              </div>
            )}

            {fetchError && (
              <div className="mt-4 text-red-700 bg-red-100 p-3 rounded">
                <strong className="block">Cloud fetch error:</strong>
                <div className="text-sm mt-1">{fetchError}</div>
              </div>
            )}
          </div>
          {cloudLoadTimePicker && (
            <DateTimePickerModal
              isOpen={cloudLoadTimePicker.isOpen}
              mode={cloudLoadTimePicker.mode}
              initialDate={cloudLoadTimePicker.initialDate}
              initialTime={cloudLoadTimePicker.initialTime}
              title={cloudLoadTimePicker.field === 'start' ? "Select Start Date & Time" : "Select End Date & Time"}
              onConfirm={(datetime) => {
                const formattedDateTime = datetime.replace('T', ' ');
                if (cloudLoadTimePicker.field === 'start') {
                  setGStart(formattedDateTime);
                } else {
                  setGEnd(formattedDateTime);
                }
                setCloudLoadTimePicker(null);
              }}
              onCancel={() => setCloudLoadTimePicker(null)}
              onClose={() => setCloudLoadTimePicker(null)}
            />
          )}
        </div>
      </div>
    );
  }



  // --- INTERNAL COMPONENTS ---
  // (Modals omitted for brevity, logic unchanged)
  const GateManagerModal = () => {
    // ... (Keep existing implementation)
    const [newGate, setNewGate] = useState('');
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
          <div className="bg-slate-800 p-4 flex justify-between items-center">
             <h3 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={20}/> Manage Gates</h3>
             <button onClick={() => setGateModalOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
          </div>
          <div className="p-6">
             <div className="flex gap-2 mb-6">
                <input 
                  value={newGate} 
                  onChange={e => setNewGate(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                      if(e.key === 'Enter' && newGate && !activeGates.includes(newGate)) {
                          setActiveGates([...activeGates, newGate].sort());
                          setNewGate('');
                      }
                  }}
                  placeholder="e.g. G21"
                  className="border-2 border-slate-200 p-2.5 rounded-lg flex-1 uppercase font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" 
                />
                <button 
                  onClick={() => {
                    if(newGate && !activeGates.includes(newGate)) {
                      setActiveGates([...activeGates, newGate].sort());
                      setNewGate('');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} /> Add
                </button>
             </div>
             
             <div className="text-xs font-bold text-slate-400 uppercase mb-2">Active Gates List</div>
             <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50 grid grid-cols-3 gap-2">
                {activeGates.map(g => (
                  <div key={g} className="bg-white border border-slate-200 p-2 rounded-lg flex justify-between items-center text-sm font-bold text-slate-700 shadow-sm group">
                     {g}
                     <button onClick={() => setActiveGates(activeGates.filter(x => x !== g))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                  </div>
                ))}
             </div>
          </div>
          <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => setGateModalOpen(false)} className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors">Done</button>
          </div>
        </div>
      </div>
    );
  };

  const CheckinEditModal = () => {
    // ... (Keep existing implementation)
     if(!checkinModal) return null;
     const f = flights[checkinModal.idx];
     const [rows, setRows] = useState<CheckinData[]>(
        f.checkinData.length > 0 
        ? f.checkinData.map(c => ({...c})) 
        : Array.from({length:3}, (_,i) => ({
            ctr: '01', 
            start: new Date(f.target.getTime()-180*60000), 
            end: new Date(f.target.getTime()-50*60000)
          }))
     );
     
     const [startCounter, setStartCounter] = useState(rows[0]?.ctr || '01');
     const [editingTime, setEditingTime] = useState<{isOpen: boolean, mode: 'datetime', initialDate: string, initialTime: string, idx: number, isStart: boolean} | null>(null);
     const [editingInputs, setEditingInputs] = useState<{startInputs: {[key: number]: string}, endInputs: {[key: number]: string}}>({startInputs: {}, endInputs: {}});

     const checkOverlap = (ctr: string, start: Date, end: Date) => {
         let isOverlap = false;
         flights.forEach((otherF, otherIdx) => {
             if(otherIdx === checkinModal.idx) return; 
             otherF.checkinData.forEach(c => {
                 if(c.ctr === ctr) {
                     if(start < c.end && end > c.start) {
                         isOverlap = true;
                     }
                 }
             });
         });
         return isOverlap;
     };

     const updateRow = (i: number, field: keyof CheckinData, val: any) => {
         const cp = [...rows];
         (cp[i] as any)[field] = val;
         setRows(cp);
     };

     const handleAutoSequence = () => {
         const newStart = new Date(f.target.getTime() - 180 * 60000);
         const newEnd = new Date(f.target.getTime() - 50 * 60000);
         
         const idx = ckRows.indexOf(startCounter);
         const baseIdx = idx >= 0 ? idx : 0;
         
         const newRows = rows.map((r, i) => ({
             ...r,
             ctr: ckRows[baseIdx + i] || r.ctr,
             start: newStart,
             end: newEnd
         }));
         setRows(newRows);
     };

     return (
         <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                 <div className="p-5 flex justify-between items-center border-b border-slate-100">
                     <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                         Quản lý Quầy: <span className="text-blue-600">{sanitizeFlightId(f.id)}</span>
                     </h3>
                     <button onClick={() => setCheckinModal(null)} className="text-slate-400 hover:text-slate-600">
                         <X size={24}/>
                     </button>
                 </div>
                 
                 <div className="p-6 overflow-y-auto">
                     <div className="bg-orange-50 border border-orange-100 rounded-lg p-5 mb-6">
                         <div className="text-xs font-bold text-orange-800 uppercase mb-3">THAO TÁC NHANH</div>
                         <div className="flex gap-3 flex-wrap">
                             <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold py-2 px-4 rounded-md shadow-sm hover:shadow hover:bg-slate-50 transition-all text-sm">
                                 <Edit size={16} className="text-orange-500"/> Sửa
                             </button>
                             <button 
                                onClick={() => {
                                    const lastRow = rows[rows.length-1];
                                    setRows([...rows, {...lastRow}]);
                                }}
                                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-all text-sm"
                             >
                                 <Plus size={16}/> Thêm quầy
                             </button>
                             <button 
                                onClick={() => {
                                    if(window.confirm("Xóa toàn bộ kế hoạch quầy của chuyến bay này?")) {
                                        setRows([]);
                                    }
                                }}
                                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-md shadow-sm transition-all text-sm"
                             >
                                 <Trash2 size={16}/> Xóa quầy này
                             </button>
                         </div>
                     </div>

                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-6">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                             <div>
                                 <label className="text-xs font-bold text-slate-500 mb-1.5 block">Số lượng quầy</label>
                                 <div className="flex gap-2">
                                     <input 
                                        type="number" 
                                        min="0" 
                                        max="50" 
                                        value={rows.length} 
                                        onChange={e => {
                                            const qty = parseInt(e.target.value) || 0;
                                            const newRows = [...rows];
                                            if(qty > rows.length) {
                                                for(let k=rows.length; k<qty; k++) {
                                                    const prev = rows[rows.length-1] || {ctr:'01', start: new Date(f.target.getTime()-180*60000), end: new Date(f.target.getTime()-50*60000)};
                                                    newRows.push({...prev});
                                                }
                                            } else if(qty < rows.length) {
                                                // Only remove excess counters (from index qty onwards)
                                                newRows.splice(qty, rows.length - qty);
                                            }
                                            setRows(newRows);
                                        }}
                                        className="flex-1 border border-slate-300 bg-white text-slate-900 rounded-md p-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                     />
                                     {rows.length > 0 && (
                                         <button
                                            onClick={() => setRows([])}
                                            className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-md text-xs transition-colors"
                                            title="Delete all counters"
                                         >
                                             Delete All
                                         </button>
                                     )}
                                 </div>
                             </div>
                             <div>
                                 <label className="text-xs font-bold text-slate-500 mb-1.5 block">Bắt đầu từ</label>
                                 <select 
                                    value={startCounter}
                                    onChange={e => setStartCounter(e.target.value)}
                                    className="w-full border border-slate-300 bg-white text-slate-900 rounded-md p-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                 >
                                    {ckRows.map(k => <option key={k} value={k}>{k}</option>)}
                                 </select>
                             </div>
                             <div>
                                 <button 
                                    onClick={handleAutoSequence}
                                    className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-600 text-slate-600 font-bold py-2.5 rounded-md shadow-sm transition-all text-sm"
                                 >
                                     <Zap size={16} className="text-amber-500"/> Điền tự động
                                 </button>
                             </div>
                         </div>
                     </div>

                     <div className="space-y-3">
                         {rows.map((r, i) => {
                             const isOverlap = checkOverlap(r.ctr, r.start, r.end);
                             return (
                                 <div key={i} className={`flex flex-col md:flex-row gap-3 items-center p-2 rounded-lg border ${isOverlap ? 'border-red-300 bg-red-50' : 'border-slate-100 bg-white'}`}>
                                     <span className="text-xs font-black text-slate-400 w-8 md:text-right">#{i+1}</span>
                                     <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                                         <div>
                                             <select 
                                                value={r.ctr} 
                                                onChange={e => updateRow(i, 'ctr', e.target.value)} 
                                                className={`w-full p-2 border rounded-md font-bold text-slate-800 text-sm bg-white ${isOverlap ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                                             >
                                                 {ckRows.map(k => <option key={k} value={k}>{k}</option>)}
                                             </select>
                                         </div>
                                         <div className="relative">
                                             <div className="flex gap-1 items-center">
                                                 <input
                                                    type="text"
                                                    placeholder="YYYY-MM-DD HH:MM"
                                                    value={editingInputs.startInputs[i] !== undefined ? editingInputs.startInputs[i] : toISOLocal(r.start).replace('T', ' ')}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        setEditingInputs(prev => ({
                                                            ...prev,
                                                            startInputs: {...prev.startInputs, [i]: raw}
                                                        }));
                                                        
                                                        const cleaned = raw.replace(/[^\d\-\s:]/g, '');
                                                        
                                                        // Try multiple format matches
                                                        if (cleaned.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
                                                            const isoStr = localClockToUTCISOString(cleaned.replace(' ', 'T'));
                                                            if (isoStr) updateRow(i, 'start', new Date(isoStr));
                                                        } else if (cleaned.match(/^\d{4}-\d{2}-\d{2} \d{2}$/) && cleaned.length === 13) {
                                                            const isoStr = localClockToUTCISOString(`${cleaned}:00`.replace(' ', 'T'));
                                                            if (isoStr) updateRow(i, 'start', new Date(isoStr));
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        // Clear editing state on blur to show formatted value
                                                        setEditingInputs(prev => {
                                                            const newState = {...prev};
                                                            delete newState.startInputs[i];
                                                            return newState;
                                                        });
                                                    }}
                                                    className={`flex-1 p-2 border rounded-md text-xs font-mono font-medium text-slate-900 bg-white ${isOverlap ? 'border-red-400 bg-red-50' : 'border-slate-300'} focus:ring-2 focus:ring-blue-400 outline-none`}
                                                 />
                                                 <button
                                                    onClick={() => {
                                                        setEditingTime({
                                                            isOpen: true,
                                                            mode: 'datetime',
                                                            initialDate: toISOLocal(r.start).split('T')[0],
                                                            initialTime: toISOLocal(r.start).split('T')[1],
                                                            idx: i,
                                                            isStart: true
                                                        });
                                                    }}
                                                    className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-bold transition-colors"
                                                    title="Pick from calendar"
                                                 >
                                                     📅
                                                 </button>
                                             </div>
                                         </div>
                                         <div className="relative">
                                             <div className="flex gap-1 items-center">
                                                 <input
                                                    type="text"
                                                    placeholder="YYYY-MM-DD HH:MM"
                                                    value={editingInputs.endInputs[i] !== undefined ? editingInputs.endInputs[i] : toISOLocal(r.end).replace('T', ' ')}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        setEditingInputs(prev => ({
                                                            ...prev,
                                                            endInputs: {...prev.endInputs, [i]: raw}
                                                        }));
                                                        
                                                        const cleaned = raw.replace(/[^\d\-\s:]/g, '');
                                                        
                                                        // Try multiple format matches
                                                        if (cleaned.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
                                                            const isoStr = localClockToUTCISOString(cleaned.replace(' ', 'T'));
                                                            if (isoStr) updateRow(i, 'end', new Date(isoStr));
                                                        } else if (cleaned.match(/^\d{4}-\d{2}-\d{2} \d{2}$/) && cleaned.length === 13) {
                                                            const isoStr = localClockToUTCISOString(`${cleaned}:00`.replace(' ', 'T'));
                                                            if (isoStr) updateRow(i, 'end', new Date(isoStr));
                                                        }
                                                    }}
                                                    onBlur={(e) => {
                                                        // Clear editing state on blur to show formatted value
                                                        setEditingInputs(prev => {
                                                            const newState = {...prev};
                                                            delete newState.endInputs[i];
                                                            return newState;
                                                        });
                                                    }}
                                                    className={`flex-1 p-2 border rounded-md text-xs font-mono font-medium text-slate-900 bg-white ${isOverlap ? 'border-red-400 bg-red-50' : 'border-slate-300'} focus:ring-2 focus:ring-blue-400 outline-none`}
                                                 />
                                                 <button
                                                    onClick={() => {
                                                        setEditingTime({
                                                            isOpen: true,
                                                            mode: 'datetime',
                                                            initialDate: toISOLocal(r.end).split('T')[0],
                                                            initialTime: toISOLocal(r.end).split('T')[1],
                                                            idx: i,
                                                            isStart: false
                                                        });
                                                    }}
                                                    className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-xs font-bold transition-colors"
                                                    title="Pick from calendar"
                                                 >
                                                     📅
                                                 </button>
                                             </div>
                                         </div>
                                     </div>
                                     {isOverlap && (
                                         <div className="text-red-500 animate-pulse" title="Overlap Detected">
                                             <AlertCircle size={20}/>
                                         </div>
                                     )}
                                     <button 
                                        onClick={() => {
                                            const newRows = [...rows];
                                            newRows.splice(i, 1);
                                            setRows(newRows);
                                        }}
                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                     >
                                         <Trash2 size={16}/>
                                     </button>
                                 </div>
                             );
                         })}
                     </div>
                 </div>
                 <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
                     <button onClick={() => setCheckinModal(null)} className="px-6 py-2.5 border border-slate-300 text-slate-600 font-bold text-sm rounded-md hover:bg-slate-50 transition-colors">Hủy bỏ</button>
                     <button onClick={() => saveCheckinConfig(checkinModal.idx, rows)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-md font-bold text-sm hover:bg-blue-700 shadow-md hover:shadow-blue-500/30 transition-all"><Save size={16}/> Lưu thay đổi</button>
                 </div>
             </div>
             {editingTime && (
               <DateTimePickerModal
                 isOpen={editingTime.isOpen}
                 mode={editingTime.mode}
                 initialDate={editingTime.initialDate}
                 initialTime={editingTime.initialTime}
                 title={editingTime.isStart ? "Select Check-in Start Time" : "Select Check-in End Time"}
                 onConfirm={(datetime) => {
                   const [dateStr, timeStr] = datetime.split('T');
                   const isoStr = localClockToUTCISOString(`${dateStr}T${timeStr}`);
                   if (isoStr) {
                     updateRow(editingTime.idx, editingTime.isStart ? 'start' : 'end', new Date(isoStr));
                   }
                   setEditingTime(null);
                 }}
                 onCancel={() => setEditingTime(null)}
                 onClose={() => setEditingTime(null)}
               />
             )}
         </div>
     );
  };

  // --- RENDER FUNCTIONS ---
  const renderExportView = () => {
    // ... (Keep existing implementation)
    if (!gStart || !gEnd) return null;
    const s = new Date(localClockToUTCISOString(gStart) as string);
    const e = new Date(localClockToUTCISOString(gEnd) as string);
      
      const totalWidth = 1800; 
      const sidebarWidth = 100;
      const timelineWidth = totalWidth - sidebarWidth;
      
      const totalMin = (e.getTime() - s.getTime()) / 60000;
      const exportZoom = timelineWidth / totalMin; 
      
      const isGate = tab === 'gate';
      const rowHeight = isGate ? 60 : 40; 
      const fontSizeId = isGate ? 'text-sm' : 'text-[12px]';
      const fontSizeTime = 'text-[11px]';

      const renderSheet = (sheetTitle: string, rows: string[]) => (
          <div className="bg-white p-4 font-sans mb-8 border-4 border-slate-100" style={{ width: totalWidth + 50 }}>
              <div className="text-center mb-6">
                  <h1 className="text-3xl font-bold text-slate-900 mb-2 uppercase tracking-wide">{sheetTitle}</h1>
                  <p className="text-slate-500 font-bold text-lg">Period: {fmtDateUTC(s)} {fmtTimeUTC(s)} - {fmtDateUTC(e)} {fmtTimeUTC(e)}</p>
              </div>

              <div className="flex border-2 border-slate-800">
                  <div className="flex-shrink-0 bg-slate-100 border-r-2 border-slate-800" style={{ width: sidebarWidth }}>
                      <div className="h-10 border-b-2 border-slate-800 flex items-center justify-center font-black text-sm bg-slate-200">
                          {tab === 'gate' ? 'GATE' : 'CTR'}
                      </div>
                      {rows.map(r => (
                          <div key={r} className="flex items-center justify-center font-black text-sm text-slate-900 border-b border-slate-300" style={{ height: rowHeight }}>
                              {r}
                          </div>
                      ))}
                  </div>

                  <div className="relative bg-white" style={{ width: timelineWidth }}>
                      <div className="h-10 border-b-2 border-slate-800 relative bg-slate-50 overflow-hidden">
                          {Array.from({length: Math.ceil(totalMin/30) + 1}).map((_, i) => {
                              const m = i * 30;
                              const t = new Date(s.getTime() + m * 60000);
                              const isHour = m % 60 === 0;
                              const left = m * exportZoom;
                              
                              if (left > timelineWidth) return null;

                              return (
                                  <React.Fragment key={i}>
                                      <div className={`absolute top-0 bottom-0 border-l ${isHour ? 'border-slate-400' : 'border-slate-200'}`} style={{ left }}></div>
                                      <div className="absolute bottom-1 text-xs font-bold text-slate-700 transform -translate-x-1/2" style={{ left }}>
                                          {isHour && (
                                              <div className="text-center">
                                                  <div className="text-[9px] text-slate-500 leading-none mb-0.5">{t.getUTCDate()}/{t.getUTCMonth()+1}</div>
                                                  <div>{fmtTimeUTC(t)}</div>
                                              </div>
                                          )}
                                          {!isHour && <span className="text-[9px] text-slate-400">{fmtTimeUTC(t)}</span>}
                                      </div>
                                  </React.Fragment>
                              );
                          })}
                      </div>

                      <div className="relative" style={{ height: rows.length * rowHeight }}>
                          {Array.from({length: Math.ceil(totalMin/30) + 1}).map((_, i) => (
                              <div key={`vgrid-${i}`} className={`absolute top-0 bottom-0 border-l ${i % 2 === 0 ? 'border-slate-300' : 'border-slate-100 dashed'}`} style={{ left: i * 30 * exportZoom }}></div>
                          ))}

                          {rows.map((row, rIdx) => {
                              let items: any[] = [];
                              if (tab === 'gate') {
                                  items = flights
                                     .filter(f => f.gate === row && activeGates.indexOf(f.gate || '') !== -1 && f.target >= s && f.target <= e)
                                     .map(f => ({
                                      ...f, 
                                      start: new Date(f.target.getTime() - bufS * 60000),
                                      end: new Date(f.target.getTime() + bufE * 60000)
                                  }));
                              } else {
                                  flights.forEach((f) => {
                                      f.checkinData.forEach((ck) => {
                                          if(ck.ctr === row && ck.end > s && ck.start < e) {
                                              items.push({ ...f, start: ck.start, end: ck.end });
                                          }
                                      });
                                  });
                              }

                              return (
                                  <div key={row} className="border-b border-slate-300 relative" style={{ height: rowHeight }}>
                                      {items.map((it, idx) => {
                                          const startOffset = Math.max(0, (it.start.getTime() - s.getTime()) / 60000);
                                          const duration = (it.end.getTime() - it.start.getTime()) / 60000;
                                          const left = startOffset * exportZoom;
                                          const width = Math.max(10, duration * exportZoom);
                                          const color = getFlightColor(it.id);

                                          return (
                                              <div 
                                                  key={idx}
                                                  className="absolute top-0.5 bottom-0.5 rounded border border-slate-500 flex items-center justify-center shadow-sm"
                                                  style={{ left, width, backgroundColor: color }}
                                              >
                                                  <div className={`${fontSizeId} font-black text-slate-900 z-10 leading-none text-center`}>{sanitizeFlightId(it.id)}</div>
                                                  
                                                  {width > 25 && (
                                                      <>
                                                          <div className={`absolute top-0.5 left-1 ${fontSizeTime} font-bold text-slate-700 leading-none`}>
                                                              {fmtTimeUTC(it.start)}
                                                          </div>
                                                          <div className={`absolute bottom-0.5 right-1 ${fontSizeTime} font-bold text-slate-700 leading-none`}>
                                                              {fmtTimeUTC(it.end)}
                                                          </div>
                                                      </>
                                                  )}
                                              </div>
                                          );
                                      })}
                                  </div>
                              );
                          })}
                      </div>
                  </div>
              </div>
          </div>
      );

      let sheets = [];
      if (tab === 'gate') {
          sheets.push({ title: 'Gate Allocation Plan', rows: activeGates });
      } else {
          const wingARows = ckRows.filter(r => {
             const n = parseInt(r);
             return (!isNaN(n) && n >= 1 && n <= 27) || ['M01', 'M02', 'M03', 'M07'].includes(r);
          }).sort((a, b) => {
             const topM = ['M01', 'M02', 'M03'];
             if(topM.includes(a) && !topM.includes(b)) return -1;
             if(!topM.includes(a) && topM.includes(b)) return 1;
             if(topM.includes(a) && topM.includes(b)) return a.localeCompare(b);
             if(a === 'M07') return 1; if(b === 'M07') return -1;
             return a.localeCompare(b);
          });
          const wingBRows = ckRows.filter(r => {
             const n = parseInt(r);
             return (!isNaN(n) && n >= 28 && n <= 54) || ['M04', 'M05', 'M06'].includes(r);
          }).sort((a, b) => {
             if(!a.startsWith('M') && b.startsWith('M')) return -1;
             if(a.startsWith('M') && !b.startsWith('M')) return 1;
             return a.localeCompare(b);
          });
          sheets.push({ title: 'Wing A Check-in Counter Allocation', rows: wingARows });
          sheets.push({ title: 'Wing B Check-in Counter Allocation', rows: wingBRows });
      }

      return (
          <div ref={exportRef}>
              {sheets.map((s, i) => <div key={i}>{renderSheet(s.title, s.rows)}</div>)}
          </div>
      );
  };

  const renderGantt = (type: 'gate' | 'checkin') => {
    // ... (Keep existing implementation)
    if(!gStart || !gEnd) return null;
    const s = new Date(localClockToUTCISOString(gStart) as string);
    const e = new Date(localClockToUTCISOString(gEnd) as string);
    const totalMin = (e.getTime() - s.getTime()) / 60000;
    const totalWidth = totalMin * zoom;
    
    const ticks = [];
    const hourLabels = [];
    
    for(let m=0; m<=totalMin; m+=5) {
      const t = new Date(s.getTime() + m * 60000);
      const isHour = m % 60 === 0;
      const isHalf = m % 30 === 0;
      let borderClass = 'border-slate-100'; 
      if (isHour) borderClass = 'border-slate-300';
      else if (isHalf) borderClass = 'border-slate-200 border-dashed';

      ticks.push(<div key={`tick-${m}`} className={`absolute top-0 bottom-0 border-l ${borderClass}`} style={{ left: m * zoom }} />);

      if(isHalf) {
          hourLabels.push(
              <div key={`lbl-${m}`} className={`absolute bottom-0 mb-1 px-1.5 py-0.5 rounded border shadow-sm transform -translate-x-1/2 flex flex-col items-center justify-center ${isHour ? 'bg-slate-800 text-white border-slate-700 z-10' : 'bg-white text-slate-500 border-slate-200 text-[10px]'}`} style={{ left: m * zoom }}>
                  <span className={isHour ? "text-xs font-bold" : "font-medium"}>{fmtTimeUTC(t)}</span>
                  {isHour && <div className="absolute -bottom-2 w-0.5 h-2 bg-slate-800"></div>}
              </div>
          );
      }
    }

    const rows = type === 'gate' ? activeGates : ckRows;
    const scrollRef = type === 'gate' ? gateScrollRef : ckScrollRef;
    const headerRef = type === 'gate' ? gateHeaderRef : ckHeaderRef;
    const currentQueueHeight = isQueueOpen ? queueHeight : 45;
    const rowHeightClass = "h-[50px]"; 

    return (
        <div className="flex flex-col h-full bg-white border-t border-slate-300 flex-1 min-h-0">
             {tab !== 'peak' && (
                <div 
                  className="flex border-b border-slate-300 bg-slate-50 flex-shrink-0 relative transition-none" 
                  style={{ height: currentQueueHeight }}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.backgroundColor = 'rgba(254, 243, 199, 0.5)'; }}
                  onDragLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
                  onDrop={e => {
                     e.preventDefault();
                     e.currentTarget.style.backgroundColor = '';
                     if(dragFlight) handleUnassign(dragFlight.idx, dragFlight.isCk, dragFlight.ckIdx);
                  }}
                >
                    <div className="w-28 flex-shrink-0 border-r border-slate-300 p-2 bg-slate-100 flex flex-col items-center justify-start pt-4 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                         <div className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setIsQueueOpen(!isQueueOpen)}>
                             <div className={`p-2 rounded-lg ${isQueueOpen ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}><AlertTriangle size={20} /></div>
                             <span className="text-[10px] font-black text-slate-500 uppercase text-center leading-tight">Queue</span>
                             <span className="bg-slate-800 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">{unassignedFlights.length}</span>
                             {isQueueOpen ? <ChevronUp size={14} className="text-slate-400 mt-1"/> : <ChevronDown size={14} className="text-slate-400 mt-1"/>}
                         </div>
                    </div>
                    {isQueueOpen && (
                        <div ref={queueScrollRef} onScroll={() => handleScroll(queueScrollRef)} className="flex-1 overflow-x-hidden overflow-y-auto relative bg-slate-50/50">
                             <div className="relative" style={{ width: totalWidth, minHeight: '100%' }}>
                                 {ticks}
                                 {packedQueue.items.map((it, i) => (
                                     <div
                                         key={i}
                                         draggable
                                         onDragStart={() => setDragFlight({ idx: (it as any).originalIndex, isCk: tab === 'checkin' })}
                                         onClick={() => { if(tab==='checkin') setCheckinModal({ idx: (it as any).originalIndex }) }}
                                         className="absolute rounded border border-slate-300 bg-white shadow-sm hover:shadow-md cursor-move flex flex-col justify-between p-1.5 hover:ring-2 hover:ring-blue-400 group transition-all"
                                         style={{ left: it.x, top: it.laneIdx * 45 + 10, width: QUEUE_CARD_WIDTH, height: 38 }}
                                         title={`STD: ${fmtTimeUTC(it.target)}`}
                                     >
                                         <div className="flex justify-between items-center">
                                             <span className="font-black text-xs text-slate-800">{sanitizeFlightId(it.id)}</span>
                                             <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 rounded">{it.acCode}</span>
                                         </div>
                                         <div className="flex justify-between items-center mt-1">
                                               {tab === 'checkin' ? (
                                            <div className="flex items-center gap-1 text-[9px] font-mono font-bold text-blue-600">
                                                <span>{fmtTimeUTC(new Date(it.displayTime))}</span>
                                                <span className="text-slate-400">-</span>
                                                <span>{fmtTimeUTC(new Date(it.displayTime.getTime() + (140 * 60000)))}</span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-mono font-bold text-blue-600">{fmtTimeUTC(it.target)}</span>
                                        )}
                                             <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getFlightColor(it.id) }}></div>
                                         </div>
                                     </div>
                                 ))}
                                 {packedQueue.items.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-bold italic text-sm pointer-events-none">Drop flights here to unassign</div>}
                             </div>
                        </div>
                    )}
                    {isQueueOpen && (
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-transparent hover:bg-blue-400/20 cursor-row-resize flex items-center justify-center z-30 group" onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}>
                             <div className="w-12 h-1 rounded-full bg-slate-300 group-hover:bg-blue-400 transition-colors"></div>
                        </div>
                    )}
                </div>
             )}

             <div className="flex border-b border-slate-400 bg-slate-100 shadow-sm z-10 h-14 flex-shrink-0">
                 <div className="w-28 flex-shrink-0 border-r border-slate-300 p-2 font-black text-xs text-slate-800 flex items-center justify-center bg-slate-200 uppercase tracking-wider shadow-inner">
                     {type === 'gate' ? 'Resource' : 'Counter'}
                 </div>
                 <div ref={headerRef} className="flex-1 overflow-hidden relative bg-slate-50">
                     <div className="absolute top-0 bottom-0 pointer-events-none" style={{ width: totalWidth }}>
                         {hourLabels}
                         {Array.from({length: Math.ceil(totalMin/5) + 1}).map((_, i) => {
                             const isBig = i % 12 === 0; 
                             const isMed = i % 6 === 0;
                             const h = isBig ? 'h-3' : (isMed ? 'h-2' : 'h-1');
                             const color = isBig ? 'border-slate-600' : 'border-slate-300';
                             return <div key={`htick-${i}`} className={`absolute bottom-0 border-l ${color} ${h}`} style={{ left: i * 5 * zoom }}></div>
                         })}
                     </div>
                 </div>
             </div>

             <div ref={scrollRef} onScroll={() => handleScroll(scrollRef)} className="flex-1 overflow-auto bg-slate-50 relative flex flex-col">
                 <div className="flex" style={{ width: `max-content`, minWidth: '100%' }}>
                     {/* Sticky Sidebar */}
                     <div className="sticky left-0 z-[60] w-28 flex-shrink-0 border-r border-slate-300 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                         {rows.map(r => (
                             <div key={r} className={`${rowHeightClass} border-b border-slate-200 flex items-center justify-center text-sm font-bold text-slate-900 relative ${r.includes('AUTO') ? 'bg-amber-50 border-l-4 border-amber-500' : 'bg-white hover:bg-slate-50'}`}>
                                 {r}
                                 <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                             </div>
                         ))}
                     </div>
                     
                     {/* Gantt Content */}
                     <div className="relative" style={{ width: totalWidth, height: rows.length * 50 }}>
                         <div className="absolute inset-0 pointer-events-none z-0">{ticks}</div>
                         {rows.map((row, rIdx) => {
                             let items: any[] = [];
                             if (type === 'gate') {
                                 items = flights
                                    .map((f, i) => ({ ...f, originalIndex: i }))
                                    .filter(f => f.gate === row && activeGates.indexOf(f.gate || '') !== -1 && f.target >= s && f.target <= e)
                                    .map(f => ({ ...f, start: new Date(f.target.getTime() - bufS * 60000), end: new Date(f.target.getTime() + bufE * 60000) }));
                             } else {
                                 flights.forEach((f, fIdx) => {
                                     f.checkinData.forEach((ck, ckIdx) => {
                                         if(ck.ctr === row && ck.end > s && ck.start < e) {
                                             items.push({ ...f, start: ck.start, end: ck.end, ckIdx, fIdx });
                                         }
                                     });
                                 });
                             }
                             
                             items.forEach((it, i) => {
                                 for(let j=i+1; j<items.length; j++) {
                                     if(it.start < items[j].end && it.end > items[j].start) {
                                         it.conflict = true; items[j].conflict = true;
                                     }
                                 }
                             });

                             return (
                                 <div 
                                    key={row} 
                                    className={`${rowHeightClass} border-b border-slate-200 relative group z-10 hover:bg-blue-50/20 transition-colors`}
                                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'; }}
                                    onDragLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
                                    onDrop={e => {
                                        e.preventDefault();
                                        e.currentTarget.style.backgroundColor = '';
                                        if (dragFlight) {
                                            if (type === 'gate' && !dragFlight.isCk) handleDropGate(dragFlight.idx, row);
                                            if (type === 'checkin' && dragFlight.isCk) handleDropCheckin(dragFlight.idx, row, dragFlight.ckIdx);
                                        }
                                    }}
                                 >
                                     {items.map((it, idx) => {
                                         const x = Math.max(0, calculatePos(it.start, s));
                                         const w = Math.max(20, ((it.end.getTime() - it.start.getTime())/60000) * zoom);
                                         const bgStyle = it.conflict ? 'repeating-linear-gradient(45deg, #fee2e2, #fee2e2 10px, #fecaca 10px, #fecaca 20px)' : getFlightColor(it.id);

                                         return (
                                             <div
                                                 key={idx}
                                                 draggable
                                                 onDragStart={() => setDragFlight({ idx: type === 'gate' ? it.originalIndex : it.fIdx, isCk: type === 'checkin', ckIdx: it.ckIdx })}
                                                 onClick={(e) => { e.stopPropagation(); if(type === 'checkin') setCheckinModal({ idx: it.fIdx, ckIdx: it.ckIdx }); }}
                                                 className={`absolute top-2 bottom-2 rounded-md px-2 flex flex-col justify-center cursor-move border transition-all hover:z-50 hover:shadow-xl hover:scale-[1.02] overflow-hidden select-none ${it.conflict ? 'border-red-500 text-red-900 shadow-sm' : 'border-slate-300/50 text-slate-800 shadow-md'} ${it.isEtd ? 'border-dashed border-slate-600' : ''}`}
                                                 style={{ left: x, width: w, background: it.conflict ? bgStyle : undefined, backgroundColor: !it.conflict ? bgStyle : undefined }}
                                                 title={`${sanitizeFlightId(it.id)} | ${it.acType} | ${fmtTimeUTC(it.start)} - ${fmtTimeUTC(it.end)}`}
                                             >
                                                 <div className="flex items-center gap-1.5 w-full">
                                                     <div className="flex items-center gap-1 overflow-hidden">
                                                        {w > 40 && <Plane size={11} className="text-slate-600 opacity-60 flex-shrink-0"/>}
                                                        <span className="font-black text-[12px] truncate leading-tight">{sanitizeFlightId(it.id)}</span>
                                                     </div>
                                                     {w > 70 && (
                                                         <div className="flex items-center gap-1 text-[12px] font-mono font-bold opacity-85 flex-shrink-0 ml-auto">
                                                             <span>{fmtTimeUTC(it.start)}</span>
                                                             <span className="opacity-60">-</span>
                                                             <span>{fmtTimeUTC(it.end)}</span>
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             </div>
        </div>
    );
  };

  const renderPeakMatrix = () => {
    // ... (Keep existing implementation, logic remains valid with flight data)
    // Use Peak specific range if set, otherwise fallback to null
    if(!peakStart || !peakEnd) return null;
    // Convert possible datetime-local strings into UTC-based Date objects
    const s = peakStart ? new Date(localClockToUTCISOString(peakStart) as string) : new Date(0);
    const e = peakEnd ? new Date(localClockToUTCISOString(peakEnd) as string) : new Date(0);
    
    // --- MODE SWITCHER & HEADER ---
    const Header = () => (
        <div className="w-full max-w-6xl flex flex-col gap-4 mb-6">
            <div className="flex justify-between items-end">
                <h3 className="font-bold text-2xl text-slate-900 flex items-center gap-2">
                    <BarChart2 className="text-blue-600"/> 
                    {peakMode === 'density' ? 'Flight Density Analysis' : (peakMode === 'gate' ? 'Gate Capacity Planning' : 'Check-in Counter Demand')}
                </h3>
                <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                    <button 
                        onClick={() => setPeakMode('density')} 
                        className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${peakMode === 'density' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Plane size={14}/> Flight Density
                    </button>
                    <button 
                        onClick={() => setPeakMode('gate')} 
                        className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${peakMode === 'gate' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <DoorOpen size={14}/> Gate Load
                    </button>
                    <button 
                        onClick={() => setPeakMode('checkin')} 
                        className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${peakMode === 'checkin' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Users size={14}/> Counter Load
                    </button>
                </div>
            </div>

            {/* Time Controls for Peak Analysis */}
            <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 border-r border-slate-200 pr-4">
                         <CalendarClock size={18} className="text-slate-400"/>
                         <span className="text-xs font-bold text-slate-500 uppercase">Analysis Period</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400">FROM</label>
                            <input 
                                type="text"
                                placeholder="YYYY-MM-DD HH:MM"
                                value={peakStart} 
                                onChange={e => setPeakStart(e.target.value)} 
                                className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-500 shadow-sm"
                            />
                        </div>
                        <span className="text-slate-300">➜</span>
                        <div className="flex flex-col">
                             <label className="text-[10px] font-bold text-slate-400">TO</label>
                             <input 
                                type="text"
                                placeholder="YYYY-MM-DD HH:MM"
                                value={peakEnd} 
                                onChange={e => setPeakEnd(e.target.value)} 
                                className="border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-900 bg-white outline-none focus:border-blue-500 shadow-sm"
                             />
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                             setPeakStart(gStart);
                             setPeakEnd(gEnd);
                        }}
                        className="ml-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Reset to Schedule Range"
                    >
                        <RotateCw size={14}/>
                    </button>
                </div>

                {/* Granularity Control - Only for Resource Modes */}
                {peakMode !== 'density' && (
                    <div className="flex items-center gap-2 pl-6 border-l border-slate-200">
                        <ListFilter size={16} className="text-slate-400"/>
                        <span className="text-xs font-bold text-slate-500 uppercase">Resolution:</span>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                             <button 
                                onClick={() => setPeakGranularity('15m')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${peakGranularity === '15m' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                             >
                                15 Mins
                             </button>
                             <button 
                                onClick={() => setPeakGranularity('1h')}
                                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${peakGranularity === '1h' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                             >
                                Hourly Peak
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (peakMode === 'density') {
        // --- DENSITY MODE (EXISTING) ---
        const sub = flights.filter(f => f.target >= s && f.target <= e);
        const matrix: Record<string, Record<number, {count: number, flts: Flight[]}>> = {};
        const hourlyAggregates = Array(24).fill(0);

        sub.forEach(f => {
           const d = fmtDateUTC(f.target);
           if(!matrix[d]) matrix[d] = {};
           const h = f.target.getUTCHours();
           if(!matrix[d][h]) matrix[d][h] = {count: 0, flts: []};
           matrix[d][h].count++;
           matrix[d][h].flts.push(f);
           hourlyAggregates[h]++;
        });

            const hours = Array.from({length: 24}, (_, i) => i);
        const chartData = {
            labels: hours.map(h => `${h}h`),
            datasets: [{
                label: 'Tổng số chuyến bay',
                data: hourlyAggregates,
                backgroundColor: '#3b82f6',
                borderRadius: 6,
            }]
        };

        return (
            <div id="peak-wrapper" className="p-8 overflow-auto bg-slate-100 h-full flex flex-col items-center gap-8">
                <Header />
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-full max-w-6xl h-80 flex flex-col">
                     <h4 className="font-bold text-sm text-slate-500 mb-4 uppercase tracking-wider">Biểu đồ phân bổ chuyến bay theo giờ</h4>
                     <div className="flex-1 relative">
                         <Bar data={chartData} options={{ maintainAspectRatio: false, responsive: true, scales: { y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', padding: 12, cornerRadius: 8 } } }} />
                     </div>
                </div>
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 w-full max-w-6xl">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Heatmap mật độ chi tiết</h4>
                        <div className="flex gap-4 text-xs font-medium bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-700">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-slate-300"></span> 0</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-100 border border-green-200"></span> 1-2</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-200"></span> 3-4</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 text-white shadow-sm"></span> 5-6</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-600 text-white shadow-sm"></span> 7+</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-4 border-b-2 border-slate-300 text-left bg-slate-100 text-slate-800 font-bold sticky top-0 min-w-[120px]">Date / Time</th>
                                    {hours.map(h => <th key={h} className="p-2 border-b-2 border-slate-300 bg-slate-100 w-10 text-center text-slate-800 font-semibold">{h}h</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                    {Object.keys(matrix).sort().map(date => (
                                    <tr key={date} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 border-b border-slate-200 font-bold text-slate-800 bg-white">{date}</td>
                                        {hours.map(h => {
                                            const cell = matrix[date][h];
                                            const c = cell ? cell.count : 0;
                                            let bg = 'bg-white';
                                            if(c > 0) bg = 'bg-green-100 text-green-900 border-green-200';
                                            if(c > 2) bg = 'bg-yellow-100 text-yellow-900 border-yellow-200';
                                            if(c > 4) bg = 'bg-orange-400 text-white font-bold shadow-sm';
                                            if(c > 6) bg = 'bg-red-600 text-white font-bold shadow-md';
                                            return <td key={h} className={`border border-slate-200 text-center cursor-pointer transition-transform hover:scale-110 ${bg}`} onClick={() => { if(c>0) setPeakDetail({d: date, h, flights: cell.flts}) }} title={`${c} flights`}>{c || ''}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    } else {
        // --- RESOURCE OCCUPANCY MODE (GATE/COUNTER) ---
        let labels: string[] = [];
        let dataPoints: number[] = [];
        const timePoints: Date[] = [];
        
        // 1. Generate 15-minute base intervals
        let curr = new Date(s.getTime());
        curr.setUTCMinutes(Math.floor(curr.getUTCMinutes() / 15) * 15, 0, 0);

        while(curr <= e) {
            timePoints.push(new Date(curr));
            curr = new Date(curr.getTime() + 15 * 60000);
        }

        // 2. Calculate Raw Occupancy (15 min)
        const rawOccupancy = timePoints.map(t => {
            const timeVal = t.getTime();
            if (peakMode === 'gate') {
                return flights.filter(f => {
                    if (f.target < s || f.target > e) return false;
                    const start = f.target.getTime() - (bufS * 60000);
                    const end = f.target.getTime() + (bufE * 60000);
                    return timeVal >= start && timeVal <= end;
                }).length;
            } else {
                let count = 0;
                flights.forEach(f => {
                    if (f.checkinData.length > 0) {
                        f.checkinData.forEach(ck => {
                            if (timeVal >= ck.start.getTime() && timeVal <= ck.end.getTime()) {
                                count++;
                            }
                        });
                    }
                });
                return count;
            }
        });

        // 3. Apply Granularity Logic
        if (peakGranularity === '1h') {
             // Aggregate to Hourly Peaks (Max value in the hour)
             const hourlyMap: Record<string, { max: number, time: Date }> = {};
             
             timePoints.forEach((t, i) => {
                 const hourKey = `${t.getUTCDate()}/${t.getUTCMonth()+1} ${t.getUTCHours()}:00`;
                 if (!hourlyMap[hourKey]) hourlyMap[hourKey] = { max: 0, time: t };
                 if (rawOccupancy[i] > hourlyMap[hourKey].max) {
                     hourlyMap[hourKey].max = rawOccupancy[i];
                 }
             });

             const aggregated = Object.entries(hourlyMap); // Ordered by insertion naturally if iterating time
             labels = aggregated.map(([k]) => k);
             dataPoints = aggregated.map(([_, v]) => v.max);
        } else {
            // Keep 15m resolution
            labels = timePoints.map(t => fmtTimeUTC(t));
            dataPoints = rawOccupancy;
        }

        const maxVal = Math.max(...dataPoints, 5); 
        const limitLine = peakMode === 'gate' ? activeGates.length : ckRows.length;
        
        // Dynamic Chart Width for Horizontal Scrolling
        // If we have many points (e.g., > 40), expand width. 
        // 1 point approx 20px wide ensures readability.
        const minChartWidth = dataPoints.length > 40 ? dataPoints.length * 20 : '100%';

        const chartData = {
            labels,
            datasets: [
                {
                    label: peakMode === 'gate' ? 'Gate Occupancy' : 'Active Counters',
                    data: dataPoints,
                    fill: true,
                    backgroundColor: peakMode === 'gate' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                    borderColor: peakMode === 'gate' ? '#2563eb' : '#059669',
                    pointRadius: peakGranularity === '1h' ? 4 : 2,
                    pointHoverRadius: 6,
                    tension: 0.3,
                }
            ]
        };

        return (
            <div id="peak-wrapper" className="p-8 overflow-auto bg-slate-100 h-full flex flex-col items-center gap-8">
                <Header />
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 w-full max-w-6xl flex-1 min-h-[500px] flex flex-col relative overflow-hidden">
                     <div className="absolute top-6 right-6 z-10 bg-white/80 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-sm">
                         <div className="text-xs font-bold text-slate-500 uppercase mb-1">Current Capacity</div>
                         <div className="text-2xl font-black text-slate-800">
                             {limitLine} <span className="text-sm font-medium text-slate-400">{peakMode === 'gate' ? 'Gates' : 'Counters'}</span>
                         </div>
                     </div>

                     <h4 className="font-bold text-sm text-slate-500 mb-6 uppercase tracking-wider flex items-center gap-2">
                         {peakMode === 'gate' 
                            ? `Gate Resource Demand (${peakGranularity === '1h' ? 'Hourly Peak' : '15m Detail'})` 
                            : `Check-in Counter Resource Demand (${peakGranularity === '1h' ? 'Hourly Peak' : '15m Detail'})`
                         }
                     </h4>
                     
                     {/* SCROLLABLE CHART CONTAINER */}
                     <div className="flex-1 relative overflow-x-auto overflow-y-hidden">
                         <div style={{ width: minChartWidth, height: '100%', minHeight: '350px' }}>
                             <Line 
                                data={chartData} 
                                options={{ 
                                    maintainAspectRatio: false, 
                                    responsive: true, 
                                    interaction: { mode: 'index', intersect: false },
                                    scales: { 
                                        y: { 
                                            beginAtZero: true, 
                                            suggestedMax: maxVal + 2,
                                            grid: { color: '#f1f5f9' },
                                            title: { display: true, text: 'Units Occupied' }
                                        }, 
                                        x: { 
                                            grid: { display: false },
                                            ticks: { maxTicksLimit: peakGranularity === '1h' ? 48 : 24 } // Show more ticks if scrolled
                                        } 
                                    }, 
                                    plugins: { 
                                        legend: { display: false }, 
                                        tooltip: { 
                                            backgroundColor: '#1e293b', 
                                            padding: 12, 
                                            cornerRadius: 8,
                                            callbacks: {
                                                label: (ctx) => `${ctx.formattedValue} ${peakMode === 'gate' ? 'Gates' : 'Counters'} (Max)`
                                            }
                                        }
                                    } 
                                }} 
                             />
                         </div>
                         
                         {/* Overlay Limit Line - Needs to match chart area, simplified here as fixed overlay might look odd on scroll */}
                         {/* For scrollable charts, standard chartjs annotation is better, but simple overlay works if width is 100%. 
                             If scrolled, we disable the CSS overlay to avoid visual glitches. */}
                         {minChartWidth === '100%' && (
                            <div 
                                className="absolute left-0 right-0 border-t-2 border-red-500/30 border-dashed pointer-events-none flex items-end justify-end pr-2"
                                style={{ 
                                    top: `${(1 - (limitLine / (Math.max(maxVal, limitLine) * 1.1))) * 100}%`, 
                                    height: 0 
                                }}
                            >
                                <span className="text-[10px] font-bold text-red-500 bg-white/80 px-1 -mt-3">Capacity Limit ({limitLine})</span>
                            </div>
                         )}
                     </div>
                     
                     <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
                         <strong>Methodology:</strong> 
                         {peakGranularity === '1h' 
                            ? " Shows the MAXIMUM number of resources required simultaneously within each hour hour. This ensures peak demand is not hidden by averaging."
                            : " Detailed view showing resource demand at every 15-minute interval."
                         }
                     </div>
                </div>
            </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 text-slate-900 relative">
      {/* EXPORT HIDDEN CONTAINER */}
      {isExporting && (
          <div style={{ position: 'fixed', top: '-10000px', left: '-10000px' }}>
              {renderExportView()}
          </div>
      )}

      {/* Top Nav */}
      <div className="h-16 bg-slate-900 flex items-center justify-between px-6 shadow-md z-30 flex-shrink-0">
          <div className="flex items-center gap-8">
              <span className="font-black text-white flex items-center gap-2 text-xl tracking-tight">
                  <Plane className="text-blue-400"/> OpsMaster <span className="text-slate-500 font-light">| Dispatch</span>
              </span>
              <div className="flex gap-2 bg-slate-800/50 p-1 rounded-lg">
                  <button onClick={() => navigate('/home')} className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all"><Home size={16}/> Home</button>
                  <button className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 shadow-lg shadow-blue-500/20 rounded-md"><Layout size={16}/> Dispatch</button>
                  <button onClick={() => navigate('/analytics')} className="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all"><BarChart2 size={16}/> Analytics</button>
              </div>
          </div>
          <div className="flex items-center gap-4">
               {step > 1 && (
                   <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isLive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-700 text-slate-400'}`}>
                       {isLive ? <Wifi size={14} className="animate-pulse"/> : <WifiOff size={14}/>}
                       {isLive ? 'Realtime Connected' : 'Connecting...'}
                   </div>
               )}
              <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white transition-colors" title="Import New File"><FileSpreadsheet size={20}/></button>
              <button onClick={() => window.location.reload()} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold text-xs px-4 py-2 border border-red-500/20 rounded-lg transition-all">Exit Session</button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
                {/* Cloud Data Mapping Modal */}
                {showCloudMapping && (
                    <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-6">
                        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-auto max-h-[90vh]">
                            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">Map Cloud Data Columns</h3>
                                    <p className="text-sm text-slate-500 mt-1">Select which column from the cloud data maps to each field.</p>
                                </div>
                                <button onClick={() => setShowCloudMapping(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Column Mapping Selects */}
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-100">
                                    <h4 className="text-sm font-black text-slate-800 mb-4 uppercase tracking-wide flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Column Mapping
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                            <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                                Flight Number <span className="text-red-500">*</span>
                                            </label>
                                            <select 
                                                className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                                    cloudMapping.flight 
                                                        ? 'border-green-500 bg-green-50' 
                                                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                                }`}
                                                value={cloudMapping.flight || ''}
                                                onChange={e => setCloudMapping({...cloudMapping, flight: e.target.value})}
                                            >
                                                <option value="">-- Select Column --</option>
                                                {cloudColumns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            {cloudMapping.flight && (
                                                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <span>✓</span> Mapped to: <span className="font-bold">{cloudMapping.flight}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                            <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                                STD (Scheduled Departure) <span className="text-red-500">*</span>
                                            </label>
                                            <select 
                                                className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                                    cloudMapping.std 
                                                        ? 'border-green-500 bg-green-50' 
                                                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                                }`}
                                                value={cloudMapping.std || ''}
                                                onChange={e => setCloudMapping({...cloudMapping, std: e.target.value})}
                                            >
                                                <option value="">-- Select Column --</option>
                                                {cloudColumns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            {cloudMapping.std && (
                                                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <span>✓</span> Mapped to: <span className="font-bold">{cloudMapping.std}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                            <label className="block text-sm font-bold text-slate-800 mb-2">Gate</label>
                                            <select 
                                                className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                                    cloudMapping.gate 
                                                        ? 'border-green-500 bg-green-50' 
                                                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                                }`}
                                                value={cloudMapping.gate || ''}
                                                onChange={e => setCloudMapping({...cloudMapping, gate: e.target.value})}
                                            >
                                                <option value="">-- Select Column --</option>
                                                {cloudColumns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            {cloudMapping.gate && (
                                                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <span>✓</span> Mapped to: <span className="font-bold">{cloudMapping.gate}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                            <label className="block text-sm font-bold text-slate-800 mb-2">STA (Scheduled Arrival)</label>
                                            <select 
                                                className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                                    cloudMapping.sta 
                                                        ? 'border-green-500 bg-green-50' 
                                                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                                }`}
                                                value={cloudMapping.sta || ''}
                                                onChange={e => setCloudMapping({...cloudMapping, sta: e.target.value})}
                                            >
                                                <option value="">-- Select Column --</option>
                                                {cloudColumns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            {cloudMapping.sta && (
                                                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <span>✓</span> Mapped to: <span className="font-bold">{cloudMapping.sta}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                            <label className="block text-sm font-bold text-slate-800 mb-2">Aircraft Type</label>
                                            <select 
                                                className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                                    cloudMapping.ac 
                                                        ? 'border-green-500 bg-green-50' 
                                                        : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                                }`}
                                                value={cloudMapping.ac || ''}
                                                onChange={e => setCloudMapping({...cloudMapping, ac: e.target.value})}
                                            >
                                                <option value="">-- Select Column --</option>
                                                {cloudColumns.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            {cloudMapping.ac && (
                                                <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                                                    <span>✓</span> Mapped to: <span className="font-bold">{cloudMapping.ac}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Sample Data Preview - Filtered by dep_flight */}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <span>Sample Data</span>
                                        <span className="text-xs font-normal text-slate-500">(First 20 rows with dep_flight)</span>
                                    </h4>
                                    <div className="overflow-auto max-h-96 border-2 border-slate-200 rounded-xl shadow-inner bg-white">
                                        <table className="w-full text-xs border-collapse">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
                                                    {cloudColumns.map(c => {
                                                        const isMapped = Object.values(cloudMapping).includes(c);
                                                        const mapType = Object.entries(cloudMapping).find(([_, v]) => v === c)?.[0];
                                                        return (
                                                            <th 
                                                                key={c} 
                                                                className={`p-3 text-left font-bold border-r border-slate-600 ${
                                                                    isMapped ? 'bg-blue-600 text-white' : ''
                                                                }`}
                                                                title={isMapped ? `Mapped to: ${mapType}` : ''}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {c}
                                                                    {isMapped && (
                                                                        <span className="text-[10px] bg-blue-500 px-1.5 py-0.5 rounded-full">
                                                                            {mapType}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </th>
                                                        );
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cloudRawRows
                                                    .filter(r => {
                                                        const flightCol = cloudMapping.flight || 'dep_flight';
                                                        return r[flightCol] && String(r[flightCol]).trim() !== '';
                                                    })
                                                    .slice(0, 20)
                                                    .map((r, ri) => (
                                                        <tr key={ri} className="hover:bg-blue-50/50 transition-colors border-b border-slate-100">
                                                            {cloudColumns.map(c => {
                                                                const isMapped = Object.values(cloudMapping).includes(c);
                                                                const value = String(r[c] ?? '');
                                                                return (
                                                                    <td 
                                                                        key={c} 
                                                                        className={`p-2.5 border-r border-slate-100 text-slate-700 ${
                                                                            isMapped ? 'bg-blue-50 font-medium' : ''
                                                                        }`}
                                                                        title={value.length > 30 ? value : ''}
                                                                    >
                                                                        <span className={value.length > 30 ? 'truncate block max-w-[200px]' : ''}>
                                                                            {value.substring(0, 30)}{value.length > 30 ? '...' : ''}
                                                                        </span>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {cloudRawRows.filter(r => {
                                        const flightCol = cloudMapping.flight || 'dep_flight';
                                        return r[flightCol] && String(r[flightCol]).trim() !== '';
                                    }).length === 0 && (
                                        <div className="text-center py-8 text-slate-400 italic">
                                            No rows with dep_flight found. Please check your data.
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-4 border-t-2 border-slate-200">
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="text-red-500 font-bold">*</span>
                                        <span>= Required fields</span>
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => { setShowCloudMapping(false); setCloudRawRows([]); }} 
                                            className="px-6 py-3 border-2 border-slate-300 rounded-lg text-slate-700 font-bold hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button 
                                            onClick={applyCloudMapping}
                                            disabled={!cloudMapping.flight || (!cloudMapping.std && !cloudMapping.sta)}
                                            className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${
                                                (!cloudMapping.flight || (!cloudMapping.std && !cloudMapping.sta))
                                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-xl transform hover:-translate-y-0.5'
                                            }`}
                                        >
                                            <span>Apply Mapping & Load</span>
                                            <span className="text-lg">→</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
          {/* Toolbar */}
          <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-6 flex-shrink-0 z-20 shadow-sm">
              <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                  <button onClick={() => setTab('gate')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'gate' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Gate Gantt</button>
                  <button onClick={() => setTab('checkin')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'checkin' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Check-in View</button>
                  <button onClick={() => setTab('peak')} className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'peak' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Peak Analysis</button>
              </div>

              <div className="w-px h-8 bg-slate-200"></div>

              {tab !== 'peak' && (
                  <>
                    {tab === 'gate' && (
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-black text-slate-500 uppercase">Buffer (Pre/Post)</label>
                                <div className="flex items-center gap-1">
                                    <input type="number" value={bufS} onChange={e => setBufS(parseInt(e.target.value))} className="w-14 border border-slate-600 bg-slate-700 text-white rounded px-1 py-0.5 text-xs text-center font-bold focus:border-blue-500 outline-none"/>
                                    <span className="text-slate-400 text-xs">/</span>
                                    <input type="number" value={bufE} onChange={e => setBufE(parseInt(e.target.value))} className="w-14 border border-slate-600 bg-slate-700 text-white rounded px-1 py-0.5 text-xs text-center font-bold focus:border-blue-500 outline-none"/>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 border-l pl-4 border-slate-200">
                         <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-500 uppercase">View Window</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="datetime-local" 
                                    value={gStart} 
                                    onChange={e => setGStart(e.target.value)} 
                                    onClick={(e) => e.currentTarget.showPicker()}
                                    className="border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-bold bg-slate-50 focus:border-blue-500 outline-none cursor-pointer"
                                />
                                <span className="text-slate-400 text-[10px] font-bold">TO</span>
                                <input 
                                    type="datetime-local" 
                                    value={gEnd} 
                                    onChange={e => setGEnd(e.target.value)} 
                                    onClick={(e) => e.currentTarget.showPicker()}
                                    className="border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800 font-bold bg-slate-50 focus:border-blue-500 outline-none cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                  </>
              )}

              <div className="flex-1"></div>
              
              <div className="flex gap-3 items-center">
                  {/* Zoom Controls */}
                  {tab !== 'peak' && (
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
                          <button onClick={() => setZoom(Math.max(1, zoom - 1))} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors" title="Zoom Out"><ZoomOut size={16}/></button>
                          <span className="text-xs font-bold text-slate-700 w-8 text-center">{zoom}x</span>
                          <button onClick={() => setZoom(Math.min(10, zoom + 1))} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded transition-colors" title="Zoom In"><ZoomIn size={16}/></button>
                      </div>
                  )}

                  <button onClick={() => {}} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"><RotateCw size={20} /></button>
                  {tab === 'gate' && <button onClick={() => setGateModalOpen(true)} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"><Settings size={20} /></button>}
                  {canManageRoles && <button onClick={() => setRoleManagerOpen(true)} className="p-2.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100" title="Manage Roles & Permissions"><Users size={20} /></button>}
                  <button 
                    onClick={handleExportPDF} 
                    disabled={isExporting}
                    className={`flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all ${isExporting ? 'cursor-wait opacity-80' : ''}`}
                  >
                      {isExporting ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16} />} 
                      {isExporting ? 'Generating PDF...' : 'Export PDF'}
                  </button>
                  <button 
                    onClick={() => setShowGanttExportModal(true)}
                    disabled={isGanttExporting}
                    className={`flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all ${isGanttExporting ? 'cursor-wait opacity-80' : ''}`}
                    title="Export Gantt timeline data as CSV for Power BI"
                  >
                      {isGanttExporting ? <Loader2 size={16} className="animate-spin"/> : <FileSpreadsheet size={16} />}
                      {isGanttExporting ? 'Exporting...' : 'Export CSV'}
                  </button>
              </div>
          </div>

          {/* Canvas Area */}
          <div id="dispatch-gantt" className="flex-1 overflow-hidden flex flex-col relative bg-white">
              {tab !== 'peak' && (
                 <>
                   {renderGantt(tab)}
                 </>
              )}
              {tab === 'peak' && renderPeakMatrix()}
          </div>
      </div>

      {/* Modals */}
      {checkinModal && <CheckinEditModal />}
      {gateModalOpen && <GateManagerModal />}
      {roleManagerOpen && <RoleManagerModal isOpen={roleManagerOpen} onClose={() => setRoleManagerOpen(false)} />}
      {peakDetail && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-2xl overflow-hidden w-96 animate-in fade-in zoom-in duration-200">
                  <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                      <h3 className="font-bold">{peakDetail.d} <span className="opacity-50">|</span> {peakDetail.h}:00 - {peakDetail.h}:59</h3>
                      <button onClick={() => setPeakDetail(null)} className="hover:text-red-300 text-xl font-bold">×</button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                      {peakDetail.flights.map((f, i) => (
                          <div key={i} className="flex justify-between items-center text-sm p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                              <div>
                                  <div className="font-bold text-slate-800">{sanitizeFlightId(f.id)}</div>
                                  <div className="text-xs text-slate-500">{f.acType}</div>
                              </div>
                              <div className="text-right">
                                  <div className="font-mono font-bold text-blue-600">{fmtTime(f.target)}</div>
                                  <div className="text-[10px] text-slate-400 uppercase">{f.gate || 'N/A'}</div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Gantt CSV Export Modal */}
      {showGanttExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-6 flex justify-between items-center">
              <h2 className="text-xl font-bold">Export Gantt CSV</h2>
              <button
                onClick={() => setShowGanttExportModal(false)}
                className="p-1 hover:bg-emerald-500 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Export Type Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">Export Type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ganttExportType"
                      value="gate"
                      checked={ganttExportType === 'gate'}
                      onChange={(e) => setGanttExportType(e.target.value as 'gate' | 'checkin' | 'combined')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">Gate Timeline</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ganttExportType"
                      value="checkin"
                      checked={ganttExportType === 'checkin'}
                      onChange={(e) => setGanttExportType(e.target.value as 'gate' | 'checkin' | 'combined')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">Check-in Timeline</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="ganttExportType"
                      value="combined"
                      checked={ganttExportType === 'combined'}
                      onChange={(e) => setGanttExportType(e.target.value as 'gate' | 'checkin' | 'combined')}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">Combined</span>
                  </label>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700">Date Range (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="date"
                      value={ganttExportDateFrom}
                      onChange={(e) => setGanttExportDateFrom(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                      placeholder="From"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={ganttExportDateTo}
                      onChange={(e) => setGanttExportDateTo(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
                      placeholder="To"
                    />
                  </div>
                </div>
              </div>

              {/* Gate Filter */}
              {ganttExportType !== 'checkin' && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">Gates (Optional)</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {activeGates.map((gate) => (
                      <label key={gate} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ganttExportGates.includes(gate)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGanttExportGates([...ganttExportGates, gate]);
                            } else {
                              setGanttExportGates(ganttExportGates.filter(g => g !== gate));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-slate-700">{gate}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Counter Filter */}
              {ganttExportType !== 'gate' && ckRows && ckRows.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">Counters (Optional)</label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-3">
                    {ckRows.map((counter) => (
                      <label key={counter} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ganttExportCounters.includes(counter)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGanttExportCounters([...ganttExportCounters, counter]);
                            } else {
                              setGanttExportCounters(ganttExportCounters.filter(c => c !== counter));
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <span className="text-xs text-slate-700">{counter}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Message */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-xs text-emerald-900">
                  <span className="font-bold">Note:</span> Only assigned flights will be exported. Unassigned flights are excluded.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200">
              <button
                onClick={() => setShowGanttExportModal(false)}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 font-bold rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExportGanttCSV}
                disabled={isGanttExporting}
                className={`px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition shadow-md flex items-center gap-2 ${
                  isGanttExporting ? 'opacity-80 cursor-wait' : ''
                }`}
              >
                {isGanttExporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={16} />
                    Export CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dispatch;

