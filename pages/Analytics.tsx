

import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement, 
  PointElement, 
  LineElement, 
  Filler
} from 'chart.js';
import { Bar, Doughnut, Line, getElementAtEvent as getElementAtEventReact } from 'react-chartjs-2';
import { 
  Home, BarChart2, Printer, 
  Download, Calendar, Filter, RefreshCw, 
  ArrowRight, X, Map as MapIcon, PieChart, List, 
  Plane, ArrowRightLeft, Layout, Maximize2,
  GitCompare, TrendingUp, FileSpreadsheet, PlaneTakeoff, Cloud, HardDrive, Loader2
} from 'lucide-react';
import FileUpload from '../components/FileUpload';
import { AnalyticsConfigModal } from '../components/AnalyticsConfigModal';
import InfrastructureTab from '../components/InfrastructureTab';
import { Flight, AIRLINE_MAP, AIRPORT_NAMES } from '../types';
import { parseExcelDate } from '../utils/dateUtils';
import { loadConfigFromSupabase, saveConfigToSupabase, AnalyticsConfigData } from '../utils/analyticsConfigService';
import { supabase } from '../supabaseClient';

// Get current user from Supabase auth
const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Default configurations from types.ts
const DEFAULT_AIRCRAFT_CONFIG: Record<string, { name: string; seats: number }> = {
  '321': { name: 'A321', seats: 230 },
  '320': { name: 'A320', seats: 180 },
  '319': { name: 'A319', seats: 144 },
  '32N': { name: 'A320neo', seats: 180 },
  '32Q': { name: 'A321neo', seats: 230 },
  '738': { name: 'B737-800', seats: 189 },
  '739': { name: 'B737-900', seats: 189 },
  '7M8': { name: 'B737 MAX8', seats: 210 },
  '7M9': { name: 'B737 MAX9', seats: 220 },
  '789': { name: 'B787-9', seats: 296 },
  '788': { name: 'B787-8', seats: 242 },
  '77W': { name: 'B777-300ER', seats: 350 },
  '333': { name: 'A330-300', seats: 295 },
  '380': { name: 'A380-800', seats: 555 },
  '747': { name: 'B747-400', seats: 416 },
  'AT7': { name: 'ATR72-600', seats: 70 },
};

const DEFAULT_AIRLINE_CONFIG: Record<string, string> = {
  'VN': 'Vietnam Airlines',
  'VJ': 'Vietjet Air',
  'QH': 'Bamboo Airways',
  'VU': 'Vietravel Airlines',
  'EK': 'Emirates',
  'KE': 'Korean Air',
  'SQ': 'Singapore Airlines',
  'BR': 'Eva Air',
  'CI': 'China Airlines',
  'VZ': 'Thai Vietjet',
};

const DEFAULT_AIRPORT_CONFIG: Record<string, string> = {
  'HAN': 'Nội Bài',
  'SGN': 'Tân Sơn Nhất',
  'DAD': 'Đà Nẵng',
  'CXR': 'Cam Ranh',
  'PQC': 'Phú Quốc',
  'ICN': 'Seoul',
  'PUS': 'Busan',
  'BKK': 'Bangkok',
  'SIN': 'Singapore',
  'TPE': 'Taipei',
  'HKG': 'Hong Kong',
  'NRT': 'Narita',
};

// Register ChartJS
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, Filler);

// --- TYPES ---
interface RouteStat {
    code: string;
    name: string;
    total: number;
    arr: number;
    dep: number;
    arrPax: number;
    depPax: number;
    d30: number;
    cancelled: number;
}

interface AirlineStat {
    flights: number;
    pax: number;
    otp: number;
    lf: number;
    cancelRate: number; 
    _d15: number;
    _cancel: number;
    _flown: number;
}

interface AnalyticsMetrics {
    totalFlights: number;
    arrFlights: number;
    depFlights: number;
    totalPax: number;
    loadFactor: number;
    cancelled: number;
    d15: number; 
    d30: number;
    otp: number;
    
    hourlyDistribution: number[];
    hourlyDEP: number[];
    hourlyARR: number[];
    hourlyStats: { totalFlown: number; onTime: number }[];
    aircraftBreakdown: Record<string, number>;
    aircraftByAirline: Record<string, Record<string, number>>; 
    airlineStats: Record<string, AirlineStat>;
    routeStats: Record<string, RouteStat>;
}

type ViewMode = 'overview' | 'compare_time' | 'compare_airline' | 'infrastructure';

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [analyticsSourceModal, setAnalyticsSourceModal] = useState(false);
  const [step, setStep] = useState(0); // 0: Choose load mode, 1: Import file, 1.5: Load cloud
  const [loadMode, setLoadMode] = useState<'cloud' | 'import' | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  
  // Config Management - Load from Supabase (with localStorage fallback)
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [aircraftConfig, setAircraftConfig] = useState<Record<string, {name: string, seats: number}>>(() => {
    try {
      const saved = localStorage.getItem('analytics_aircraftConfig');
      const custom = saved ? JSON.parse(saved) : {};
      // Merge with defaults
      return { ...DEFAULT_AIRCRAFT_CONFIG, ...custom };
    } catch {
      return DEFAULT_AIRCRAFT_CONFIG;
    }
  });
  const [airlineConfig, setAirlineConfig] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('analytics_airlineConfig');
      const custom = saved ? JSON.parse(saved) : {};
      // Merge with defaults
      return { ...DEFAULT_AIRLINE_CONFIG, ...custom };
    } catch {
      return DEFAULT_AIRLINE_CONFIG;
    }
  });
  const [airportConfig, setAirportConfig] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('analytics_airportConfig');
      const custom = saved ? JSON.parse(saved) : {};
      // Merge with defaults
      return { ...DEFAULT_AIRPORT_CONFIG, ...custom };
    } catch {
      return DEFAULT_AIRPORT_CONFIG;
    }
  });
  const [newAcType, setNewAcType] = useState('');
  const [newAcName, setNewAcName] = useState('');
  const [newAcSeats, setNewAcSeats] = useState(180);
  const [newAlCode, setNewAlCode] = useState('');
  const [newAlName, setNewAlName] = useState('');
  const [newApCode, setNewApCode] = useState('');
  const [newApName, setNewApName] = useState('');
  
  // Cloud data mapping state for manual column parsing
  const [showCloudMapping, setShowCloudMapping] = useState(false);
  const [cloudRawRows, setCloudRawRows] = useState<any[]>([]);
  const [cloudDepRows, setCloudDepRows] = useState<any[]>([]); // DEP flight rows (dep_flight+std)
  const [cloudArrRows, setCloudArrRows] = useState<any[]>([]); // ARR flight rows (arr_flight+sta)
  const [cloudColumns, setCloudColumns] = useState<string[]>([]);
  const [cloudMapping, setCloudMapping] = useState<Record<string, string>>({});
  
  // --- CORE STATES ---
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  
  // Date Ranges
  const [rangeA, setRangeA] = useState({ from: '', to: '' }); 
  const [rangeB, setRangeB] = useState({ from: '', to: '' }); 

  // Airline Filters
  const [selectedAirline, setSelectedAirline] = useState('ALL'); 
  const [airlineA, setAirlineA] = useState(''); 
  const [airlineB, setAirlineB] = useState(''); 
  
  // Quick filters for overview tables
  const [airlineFilter, setAirlineFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  
  // Lists
  const [airlineList, setAirlineList] = useState<string[]>([]);

  // Save config to localStorage (debounced)
  React.useEffect(() => {
    const saveConfig = () => {
      try {
        // Save to localStorage only
        const localAircraft = Object.keys(aircraftConfig)
          .filter(k => !DEFAULT_AIRCRAFT_CONFIG[k] || JSON.stringify(aircraftConfig[k]) !== JSON.stringify(DEFAULT_AIRCRAFT_CONFIG[k]))
          .reduce((acc, k) => ({ ...acc, [k]: aircraftConfig[k] }), {});
        
        const localAirline = Object.keys(airlineConfig)
          .filter(k => !DEFAULT_AIRLINE_CONFIG[k] || airlineConfig[k] !== DEFAULT_AIRLINE_CONFIG[k])
          .reduce((acc, k) => ({ ...acc, [k]: airlineConfig[k] }), {});
        
        const localAirport = Object.keys(airportConfig)
          .filter(k => !DEFAULT_AIRPORT_CONFIG[k] || airportConfig[k] !== DEFAULT_AIRPORT_CONFIG[k])
          .reduce((acc, k) => ({ ...acc, [k]: airportConfig[k] }), {});

        localStorage.setItem('analytics_aircraftConfig', JSON.stringify(localAircraft));
        localStorage.setItem('analytics_airlineConfig', JSON.stringify(localAirline));
        localStorage.setItem('analytics_airportConfig', JSON.stringify(localAirport));

        console.log('[Analytics] Config saved to localStorage');
        // Supabase save is now handled by separate useEffect that depends on user
      } catch (error) {
        console.warn('[Analytics] Failed to save config to localStorage:', error);
      }
    };

    // Debounce to avoid too many saves
    const timer = setTimeout(saveConfig, 1000);
    return () => clearTimeout(timer);
  }, [aircraftConfig, airlineConfig, airportConfig]);

  // Load current user and config from Supabase on mount
  React.useEffect(() => {
    const loadUserAndConfig = async () => {
      setIsLoadingConfig(true);
      console.log('[Analytics] 🚀 Starting user/config load...');
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        console.log('[Analytics] User from getUser():', currentUser ? `✅ ${currentUser.id}` : '❌ null');
        setUser(currentUser);
        
        if (currentUser) {
          console.log('[Analytics] 📊 Loading config from Supabase...');
          const config = await loadConfigFromSupabase();
          if (config && Object.keys(config.aircraftConfig).length > 0) {
            console.log('[Analytics] ✅ Loading custom config from Supabase');
            setAircraftConfig(config.aircraftConfig);
            setAirlineConfig(config.airlineConfig);
            setAirportConfig(config.airportConfig);
          } else {
            console.log('[Analytics] ℹ️ No custom config found, using defaults');
          }
        } else {
          console.log('[Analytics] ⚠️ User not logged in, using defaults only');
        }
      } catch (error) {
        console.error('[Analytics] ❌ Failed to load config:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };

    // Load config after longer delay to ensure auth is fully ready
    // Auth can take 2-3 seconds to initialize on some networks
    const timer = setTimeout(loadUserAndConfig, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Save config to Supabase when user is loaded (IMPORTANT!)
  React.useEffect(() => {
    if (!user) return; // Wait for user to be loaded
    
    const saveToSupabase = async () => {
      try {
        console.log('[Analytics] 💾 Saving config to Supabase after user loaded...');
        const configData: AnalyticsConfigData = {
          aircraftConfig,
          airlineConfig,
          airportConfig,
        };
        const success = await saveConfigToSupabase(configData);
        if (success) {
          console.log('[Analytics] ✅ Config successfully saved to Supabase!');
        } else {
          console.warn('[Analytics] ⚠️ Failed to save config to Supabase');
        }
      } catch (error) {
        console.error('[Analytics] ❌ Error saving config to Supabase:', error);
      }
    };

    // Debounce save to avoid too frequent updates
    const timer = setTimeout(saveToSupabase, 1500);
    return () => clearTimeout(timer);
  }, [user, aircraftConfig, airlineConfig, airportConfig]);

  // UI States
  // Config handlers
  const handleAddAircraft = (code: string, name: string, seats: number) => {
    setAircraftConfig({...aircraftConfig, [code]: {name, seats}});
  };

  const handleRemoveAircraft = (code: string) => {
    const newConfig = {...aircraftConfig};
    delete newConfig[code];
    setAircraftConfig(newConfig);
  };

  const handleAddAirline = (code: string, name: string) => {
    setAirlineConfig({...airlineConfig, [code]: name});
  };

  const handleRemoveAirline = (code: string) => {
    const newConfig = {...airlineConfig};
    delete newConfig[code];
    setAirlineConfig(newConfig);
  };

  const handleAddAirport = (code: string, name: string) => {
    setAirportConfig({...airportConfig, [code]: name});
  };

  const handleRemoveAirport = (code: string) => {
    const newConfig = {...airportConfig};
    delete newConfig[code];
    setAirportConfig(newConfig);
  };

  // Get airplane name with fallback
  const getAircraftName = (acType: string) => {
    if (aircraftConfig[acType]) return aircraftConfig[acType].name;
    // Default mappings as fallback
    const defaults: Record<string, string> = {
      '321': 'A321', '320': 'A320', '319': 'A319', '788': 'B787', '789': 'B789',
      '780': 'B780', '777': 'B777', '737': 'B737', '380': 'A380'
    };
    return defaults[acType] || acType;
  };

  // Get airline name with fallback
  const getAirlineName = (code: string) => {
    return airlineConfig[code] || AIRLINE_MAP[code] || code;
  };

  // Get airport name with fallback
  const getAirportName = (code: string) => {
    return airportConfig[code] || AIRPORT_NAMES[code] || code;
  };

  const [marketShareLimit, setMarketShareLimit] = useState<5 | 10>(5);
  const [airlineTableLimit, setAirlineTableLimit] = useState<'top10' | 'full'>('full');
  const [routeTableLimit, setRouteTableLimit] = useState<'top10' | 'full'>('full');
  const [isExporting, setIsExporting] = useState(false);

  // Modals
  const [selectedAircraftDetail, setSelectedAircraftDetail] = useState<string | null>(null);
  const [selectedAirlineDetail, setSelectedAirlineDetail] = useState<string | null>(null);
  const [airlineDetailTab, setAirlineDetailTab] = useState<'routes' | 'flights'>('routes'); // New state for tab switching

  const [selectedRouteDetail, setSelectedRouteDetail] = useState<string | null>(null);
  const [showRouteComparison, setShowRouteComparison] = useState(false);
  
  const aircraftChartRef = useRef<any>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // --- HELPER FUNCTIONS ---
    // Parse TEXT or ISO timestamp from database — construct local Date from components
    const parseTextTimestamp = (timeStr: string | null): Date => {
        if (!timeStr) return new Date();
        try {
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

            return new Date(timeStr as string);
        } catch (e) {
            console.error('Error parsing timestamp:', timeStr, e);
            return new Date();
        }
    };

  // Map database row to Flight object
  const mapDbToFlight = (row: any): Flight => {
    const targetTimeStr = row.std || row.sta;
    const targetDate = parseTextTimestamp(targetTimeStr);

    const getField = (r: any, ...names: string[]) => {
      for (const n of names) {
        const v = r[n];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return undefined;
    };

    // Only use departure flight fields - arr_flight should not be used as flight id
    const flightId = getField(row, 'dep_flight', 'dep_flt', 'flight', 'flight_no') || `${row.id}`;

    return {
      id: flightId,
      recordId: row.id,
      gate: getField(row, 'gate', 'dep_stand') || 'UNASSIGNED',
      target: targetDate,
      isEtd: !!row.std,
      acType: row.ac_type || 'UNK',
      acCode: row.aircraft || row.ac_code || '',
      checkinData: [],
      arrFlt: getField(row, 'arr_flight', 'arr_flt'),
      depFlt: getField(row, 'dep_flight', 'dep_flt'),
      cap: row.arr_config || row.dep_config || row.cap || 180,
      alCode: (flightId || '').substring(0,2).toUpperCase(),
      date: targetDate,
      arrPax: row.arr_pax || 0,
      depPax: row.dep_pax || 0,
      from: row.flight_from || row.from || '',
      to: row.flight_to || row.to || '',
      sta: row.sta ? parseTextTimestamp(row.sta) : null,
      std: row.std ? parseTextTimestamp(row.std) : null,
      ata: row.ata ? parseTextTimestamp(row.ata) : null,
      atd: row.atd ? parseTextTimestamp(row.atd) : null,
      arrSts: row.arr_status || row.arr_sts || row.arr_sts || '',
      depSts: row.dep_status || row.dep_sts || row.dep_sts || ''
    };
  };

  // Load data from cloud (FIXED: Use Dispatch's simple + fallback strategy)
  const loadCloudAnalyticsData = async () => {
    setIsLoadingCloud(true);
    try {
      // Helper: treat datetime-local as a clock and create UTC ISO matching DB clock
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

      const queryStart = localClockToUTCISOString(rangeA.from) || null;
      const queryEnd = localClockToUTCISOString(rangeA.to) || null;

      if (!queryStart || !queryEnd) {
        alert('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc trước khi tải dữ liệu Analytics từ cloud.');
        setIsLoadingCloud(false);
        return;
      }

      console.log('[Analytics] loadCloudAnalyticsData - queryStart:', queryStart, 'queryEnd:', queryEnd);

      // STRATEGY: Query BOTH departure (dep_flight+std) AND arrival (arr_flight+sta) as SEPARATE streams with PAGINATION
      // Supabase PostgREST limits to 1000 rows per request - must paginate
      const depFlightRows: any[] = [];
      const arrFlightRows: any[] = [];
      let hadQueryError = false;

      // Helper: Fetch with pagination
      const fetchAllWithPagination = async (
        flightFilter: { field: string, value: string | null },
        timeFilter: { field: string, start: string, end: string }
      ): Promise<any[]> => {
        const allRows: any[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          try {
            let query = supabase
              .from('flight_schedule')
              .select('*')
              .not(flightFilter.field, 'is', flightFilter.value)
              .neq(flightFilter.field, '')
              .gte(timeFilter.field, timeFilter.start)
              .lte(timeFilter.field, timeFilter.end)
              .range(offset, offset + pageSize - 1);

            const { data, error } = await query;

            if (error) {
              console.error(`[Analytics] Pagination error at offset ${offset}:`, error);
              hasMore = false;
              break;
            }

            const pageData = data || [];
            console.log(`[Analytics] Fetched page offset=${offset}: ${pageData.length} rows`);

            if (pageData.length === 0) {
              hasMore = false;
            } else {
              allRows.push(...pageData);
              if (pageData.length < pageSize) {
                hasMore = false; // Last page
              } else {
                offset += pageSize;
              }
            }
          } catch (err) {
            console.error(`[Analytics] Unexpected error at offset ${offset}:`, err);
            hasMore = false;
            break;
          }
        }

        return allRows;
      };

      // Query 1: Departure flights (dep_flight + std) - with pagination
      try {
        const depData = await fetchAllWithPagination(
          { field: 'dep_flight', value: null },
          { field: 'std', start: queryStart, end: queryEnd }
        );
        console.log('[Analytics] DEP flights (dep_flight+std) - TOTAL after pagination:', depData.length);
        depFlightRows.push(...depData);
      } catch (err) {
        console.error('[Analytics] Unexpected fetch error (dep_flight/std):', err);
        hadQueryError = true;
      }

      // Query 2: Arrival flights (arr_flight + sta) - with pagination (SEPARATE stream)
      try {
        const arrData = await fetchAllWithPagination(
          { field: 'arr_flight', value: null },
          { field: 'sta', start: queryStart, end: queryEnd }
        );
        console.log('[Analytics] ARR flights (arr_flight+sta) - TOTAL after pagination:', arrData.length);
        arrFlightRows.push(...arrData);
      } catch (err) {
        console.error('[Analytics] Unexpected fetch error (arr_flight/sta):', err);
        // Arrival is optional
      }

      // Combine BOTH streams WITHOUT merging/deduplicating by ID
      let allData: any[] = [...depFlightRows, ...arrFlightRows];
      let dataTable = 'flight_schedule'; // Track which table we're using
      const pageSize = 1000; // Pagination size
      console.log('[Analytics] Total rows (DEP + ARR separate):', allData.length, '(', depFlightRows.length, 'DEP,', arrFlightRows.length, 'ARR )');

      // FALLBACK 1: If no rows, try sample query to diagnose
      if ((!allData || allData.length === 0) && !hadQueryError) {
        try {
          console.warn('[Analytics] Primary date-range query returned 0 rows — running fallback sample query');
          const { data: sampleRows, error: sampleErr } = await supabase
            .from('flight_schedule')
            .select('*')
            .limit(200);

          console.log('[Analytics] fallback sampleRows:', sampleRows?.length || 0, 'sampleErr:', sampleErr);
          if (sampleErr) {
            console.error('[Analytics] fallback query error:', sampleErr);
          } else if (sampleRows && sampleRows.length > 0) {
            // Table has data but date-range returned none
            console.warn('[Analytics] Table has data but date-range returned none — showing first 200 rows');
            allData = sampleRows;
          }
        } catch (e) {
          console.error('[Analytics] fallback query failed:', e);
        }
      }

      // FALLBACK 2: Try `flights` table if flight_schedule is empty
      if ((!allData || allData.length === 0) && !hadQueryError) {
        try {
          console.warn('[Analytics] No rows found on flight_schedule - trying fallback table `flights`');
          
          // Use pagination for flights fallback table as well
          let fallbackRows: any[] = [];
          let fallbackOffset = 0;
          let fallbackHasMore = true;

          while (fallbackHasMore) {
            try {
              const { data: data2, error: err2 } = await supabase
                .from('flights')
                .select('*')
                .not('dep_flight', 'is', null)
                .neq('dep_flight', '')
                .gte('std', queryStart)
                .lte('std', queryEnd)
                .order('std', { ascending: true })
                .range(fallbackOffset, fallbackOffset + pageSize - 1);

              if (err2) {
                console.error('[Analytics] Fallback pagination error at offset', fallbackOffset, ':', err2);
                fallbackHasMore = false;
                break;
              }

              const pageData = data2 || [];
              console.log(`[Analytics] Fallback fetched page offset=${fallbackOffset}: ${pageData.length} rows`);

              if (pageData.length === 0) {
                fallbackHasMore = false;
              } else {
                fallbackRows.push(...pageData);
                if (pageData.length < pageSize) {
                  fallbackHasMore = false; // Last page
                } else {
                  fallbackOffset += pageSize;
                }
              }
            } catch (err) {
              console.error(`[Analytics] Unexpected fallback error at offset ${fallbackOffset}:`, err);
              fallbackHasMore = false;
              break;
            }
          }

          if (fallbackRows.length > 0) {
            console.log('[Analytics] Found rows on `flights` with pagination, switching to flights table. Total rows:', fallbackRows.length);
            dataTable = 'flights';
            allData = fallbackRows;
          } else {
            const { data: sampleRows2, error: sampleErr2 } = await supabase
              .from('flights')
              .select('*')
              .limit(200);
            if (!sampleErr2 && sampleRows2 && sampleRows2.length > 0) {
              console.log('[Analytics] `flights` table has rows; switching dataTable to flights');
              dataTable = 'flights';
              allData = sampleRows2;
            }
          }
        } catch (e) {
          console.error('[Analytics] Error trying fallback table `flights`:', e);
        }
      }

      if (allData.length > 0) {
        const cols = Array.from(new Set(allData.flatMap(Object.keys)));

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
          std: pick(['std', 'scheduled_time', 'departure']),
          sta: pick(['sta', 'arrival', 'eta']),
          ata: pick(['ata', 'actual_arrival', 'arr_actual']),
          atd: pick(['atd', 'actual_departure', 'dep_actual']),
          ac: pick(['ac_type', 'aircraft', 'type']),
          arrFlt: pick(['arr_flight', 'arr_flt']),
          depFlt: pick(['dep_flight', 'dep_flt']),
          arrPax: pick(['arr_pax', 'arr_passengers']),
          depPax: pick(['dep_pax', 'dep_passengers']),
          from: pick(['flight_from', 'from', 'origin']),
          to: pick(['flight_to', 'to', 'destination']),
          arrSts: pick(['arr_status', 'arr_sts', 'arr_status']),
          depSts: pick(['dep_status', 'dep_sts', 'dep_status']),
          // Infrastructure
          depGate: pick(['dep_gate', 'departure_gate', 'gate', 'cổng']),
          arrStand: pick(['arr_stand', 'arrival_stand', 'stand_arr']),
          depStand: pick(['dep_stand', 'departure_stand', 'stand_dep']),
          carousel: pick(['carousel', 'arr_belt', 'baggage_belt', 'belt', 'dây chuyền']),
          counters: pick(['counters', 'counter', 'checkin_counters', 'quầy'])
        };

        setCloudColumns(cols);
        setCloudRawRows([]);  // Clear (not used anymore)
        setCloudDepRows(depFlightRows);  // Store DEP rows separately
        setCloudArrRows(arrFlightRows);  // Store ARR rows separately
        setCloudMapping(autoMap);
        setIsLoadingCloud(false);
        setShowCloudMapping(true);
      } else {
        alert('Không tìm thấy dữ liệu trong khoảng thời gian đã chọn. Vui lòng kiểm tra console cho chi tiết.');
        setIsLoadingCloud(false);
      }
    } catch (e) {
      console.error('Error loading analytics data:', e);
      alert('Error loading data from cloud');
    } finally {
      setIsLoadingCloud(false);
    }
  };

  // Apply cloud mapping and load flights (SEPARATE ARR and DEP streams - NO merge by ID)
  const applyCloudMapping = () => {
    try {
      // For ARR flights: require arr_flight and sta
      // For DEP flights: require dep_flight and std
      if (!cloudMapping.arrFlt && !cloudMapping.depFlt) {
        alert('Please map at least one flight column: Arr Flight or Dep Flight before applying.');
        return;
      }
      if (!cloudMapping.sta && !cloudMapping.std) {
        alert('Please map at least one time column: STA or STD before applying.');
        return;
      }

      const parsedFlights: Flight[] = [];
      let arrCount = 0;
      let depCount = 0;

      // Helper to parse time
      const parseTime = (val: any): Date | null => {
        if (!val) return null;
        try {
          return parseTextTimestamp(String(val));
        } catch (e) {
          return null;
        }
      };

      // Helper for safe string
      const safeStr = (v: any) => (v ? String(v).trim() : '');

      // Helper to get capacity
      const getCap = (acType: string): number => {
        let cap = 180;
        if (acType.includes('321')) cap = 230;
        if (acType.includes('787') || acType.includes('350')) cap = 300;
        if (acType.includes('AT7')) cap = 70;
        return cap;
      };

      // STREAM 1: Process ARR flights from cloudArrRows ONLY (arr_flight + sta)
      // These records came from "arr_flight IS NOT NULL AND sta BETWEEN [...]"
      for (let i = 0; i < cloudArrRows.length; i++) {
        const r = cloudArrRows[i];
        const arrFltRaw = cloudMapping.arrFlt ? r[cloudMapping.arrFlt] : (r.arr_flight || r.arr_flt);
        const staRaw = cloudMapping.sta ? r[cloudMapping.sta] : r.sta;
        
        const arrFlt = arrFltRaw ? String(arrFltRaw).trim() : null;
        const sta = staRaw ? parseTime(staRaw) : null;
        
        // Only create ARR flight if both arr_flight and sta exist
        if (arrFlt && sta) {
          const acTypeRaw = cloudMapping.ac ? r[cloudMapping.ac] : (r.ac_type || r.aircraft);
          const acType = acTypeRaw ? String(acTypeRaw).trim() : 'UNK';
          
          const fromRaw = cloudMapping.from ? r[cloudMapping.from] : (r.flight_from || r.from);
          const fromLoc = fromRaw ? String(fromRaw).trim().toUpperCase() : '';
          
          const arrStsRaw = cloudMapping.arrSts ? r[cloudMapping.arrSts] : (r.arr_status || r.arr_sts);
          const arrPaxRaw = cloudMapping.arrPax ? r[cloudMapping.arrPax] : r.arr_pax;
          const ataRaw = cloudMapping.ata ? r[cloudMapping.ata] : r.ata;
          
          // Infrastructure fields
          const arrStandRaw = cloudMapping.arrStand ? r[cloudMapping.arrStand] : (r.arr_stand || r.arrival_stand);
          const carouselRaw = cloudMapping.carousel ? r[cloudMapping.carousel] : (r.carousel || r.arr_belt || r.baggage_belt);
          const countersRaw = cloudMapping.counters ? r[cloudMapping.counters] : (r.counters || r.counter);
          
          const ata_time = ataRaw ? parseTime(ataRaw) : null;
          const gateStart = ata_time || sta;
          const gateEnd = sta;  // For arrival, gate occupancy starts at ata and roughly ends at sta (or after baggage claim)
          const gateUtilMin = gateStart && gateEnd ? Math.max(0, (gateEnd.getTime() - gateStart.getTime()) / (1000 * 60)) : 0;

          const arrFlight: Flight = {
            id: arrFlt,
            gate: '',
            target: sta,
            isEtd: false,
            acType,
            acCode: '',
            checkinData: [],
            arrFlt,
            depFlt: undefined, // ARR-only flight
            arrSts: safeStr(arrStsRaw),
            depSts: '',
            sta,
            ata: ata_time,
            std: null,
            atd: null,
            arrPax: parseInt(arrPaxRaw as any) || 0,
            depPax: 0,
            from: fromLoc,
            to: '',
            cap: getCap(acType),
            date: sta,
            alCode: arrFlt.substring(0, 2).toUpperCase(),
            // Infrastructure
            arrStand: safeStr(arrStandRaw),
            carousel: safeStr(carouselRaw),
            counters: countersRaw ? String(countersRaw).split(/[,;]/).map(c => c.trim()).filter(c => c) : [],
            gateStart,
            gateEnd,
            gateUtilizationMin: gateUtilMin,
          };
          parsedFlights.push(arrFlight);
          arrCount++;
        }
      }

      // STREAM 2: Process DEP flights from cloudDepRows ONLY (dep_flight + std)
      // These records came from "dep_flight IS NOT NULL AND std BETWEEN [...]"
      for (let i = 0; i < cloudDepRows.length; i++) {
        const r = cloudDepRows[i];
        const depFltRaw = cloudMapping.depFlt ? r[cloudMapping.depFlt] : 
                         (cloudMapping.flight ? r[cloudMapping.flight] : 
                         (r.dep_flight || r.dep_flt));
        const stdRaw = cloudMapping.std ? r[cloudMapping.std] : r.std;
        
        const depFlt = depFltRaw ? String(depFltRaw).trim() : null;
        const std = stdRaw ? parseTime(stdRaw) : null;
        
        // Only create DEP flight if both dep_flight and std exist
        if (depFlt && std) {
          const acTypeRaw = cloudMapping.ac ? r[cloudMapping.ac] : (r.ac_type || r.aircraft);
          const acType = acTypeRaw ? String(acTypeRaw).trim() : 'UNK';
          
          const toRaw = cloudMapping.to ? r[cloudMapping.to] : (r.flight_to || r.to);
          const toLoc = toRaw ? String(toRaw).trim().toUpperCase() : '';
          
          const depStsRaw = cloudMapping.depSts ? r[cloudMapping.depSts] : (r.dep_status || r.dep_sts);
          const depPaxRaw = cloudMapping.depPax ? r[cloudMapping.depPax] : r.dep_pax;
          const atdRaw = cloudMapping.atd ? r[cloudMapping.atd] : r.atd;
          
          // Infrastructure fields
          const depGateRaw = cloudMapping.depGate ? r[cloudMapping.depGate] : (r.dep_gate || r.departure_gate);
          const depStandRaw = cloudMapping.depStand ? r[cloudMapping.depStand] : (r.dep_stand || r.departure_stand);
          const countersRaw = cloudMapping.counters ? r[cloudMapping.counters] : (r.counters || r.counter);
          
          const atd_time = atdRaw ? parseTime(atdRaw) : null;
          const gateStart = std;
          const gateEnd = atd_time || std;  // Aircraft leaves gate at atd
          const gateUtilMin = gateStart && gateEnd ? Math.max(0, (gateEnd.getTime() - gateStart.getTime()) / (1000 * 60)) : 0;

          const depFlight: Flight = {
            id: depFlt,
            gate: safeStr(depGateRaw),
            target: std,
            isEtd: true,
            acType,
            acCode: '',
            checkinData: [],
            arrFlt: undefined, // DEP-only flight
            depFlt,
            arrSts: '',
            depSts: safeStr(depStsRaw),
            sta: null,
            ata: null,
            std,
            atd: atd_time,
            arrPax: 0,
            depPax: parseInt(depPaxRaw as any) || 0,
            from: '',
            to: toLoc,
            cap: getCap(acType),
            date: std,
            alCode: depFlt.substring(0, 2).toUpperCase(),
            // Infrastructure
            depGate: safeStr(depGateRaw),
            depStand: safeStr(depStandRaw),
            counters: countersRaw ? String(countersRaw).split(/[,;]/).map(c => c.trim()).filter(c => c) : [],
            gateStart,
            gateEnd,
            gateUtilizationMin: gateUtilMin,
          };
          parsedFlights.push(depFlight);
          depCount++;
        }
      }

      if (parsedFlights.length === 0) {
        alert(`No valid rows after mapping. Check console for details.`);
        return;
      }

      const als = Array.from(new Set(parsedFlights.map(f => f.alCode).filter((v): v is string => !!v))).sort();
      
      setFlights(parsedFlights);
      setAirlineList(als);
      if(als.length > 0) setAirlineA(als[0]);
      if(als.length > 1) setAirlineB(als[1]);
      
      setShowCloudMapping(false);
      setCloudRawRows([]);
      setCloudDepRows([]);
      setCloudArrRows([]);
      setStep(2);
      
      console.log(`[Analytics] ✓ Successfully loaded ${parsedFlights.length} flights (ARR+DEP separate streams - NO DUPLICATES)`);
      console.log(`[Analytics] Stream breakdown: ${arrCount} ARR flights (from ${cloudArrRows.length} cloudArrRows), ${depCount} DEP flights (from ${cloudDepRows.length} cloudDepRows)`);
      console.log(`[Analytics] Total flight objects: ${parsedFlights.length} (no overlap/duplicates)`);
    } catch (e) {
      console.error('Failed to apply cloud mapping', e);
      alert('Error applying mapping: ' + String(e));
    }
  };

  // --- DATA LOADING ---
  const handleDataReady = (rawData: any[], headers: string[], map: Record<string, number>, config: any) => {
     const newFlights: Flight[] = [];
     for(let i=1; i<rawData.length; i++) {
        const r = rawData[i];
        const arrFlt = map['arrFlt']!=-1 ? String(r[map['arrFlt']] || "").trim() : "";
        const depFlt = map['depFlt']!=-1 ? String(r[map['depFlt']] || "").trim() : "";
        if(!arrFlt && !depFlt) continue;

        const sta = map['sta']!=-1 ? parseExcelDate(r[map['sta']], config.dateFmt || 'auto', config.fixTz) : null;
        const ata = map['ata']!=-1 ? parseExcelDate(r[map['ata']], config.dateFmt || 'auto', config.fixTz) : null;
        const std = map['std']!=-1 ? parseExcelDate(r[map['std']], config.dateFmt || 'auto', config.fixTz) : null;
        const atd = map['atd']!=-1 ? parseExcelDate(r[map['atd']], config.dateFmt || 'auto', config.fixTz) : null;
        
        const date = sta || std || ata || atd;
        if(!date) continue;

        const acType = r[map['acType']] ? String(r[map['acType']]).trim() : 'UNK';
        let cap = 180; 
        if(acType.includes('321')) cap = 230;
        if(acType.includes('787') || acType.includes('350')) cap = 300;
        if(acType.includes('AT7')) cap = 70;
        
        const fromLoc = r[map['from']] ? String(r[map['from']]).trim().toUpperCase() : '';
        const toLoc = r[map['to']] ? String(r[map['to']]).trim().toUpperCase() : '';
        const arrBelt = r[map['arrBelt']] ? String(r[map['arrBelt']]).trim() : '';
        const depGate = r[map['depGate']] ? String(r[map['depGate']]).trim() : '';
        const gate = r[map['gate']] ? String(r[map['gate']]).trim() : '';
        const counters = r[map['counters']] ? String(r[map['counters']]).trim() : '';
        const arrStand = r[map['arrStand']] ? String(r[map['arrStand']]).trim() : '';
        const depStand = r[map['depStand']] ? String(r[map['depStand']]).trim() : '';
        const carousel = arrBelt; // arrBelt = carousel

        const safeStr = (v: any) => v ? String(v).trim() : '';

        // Calculate gate times for infrastructure metrics
        const gateStartTime = ata || sta || std;  // For arrival: use ata (or sta as fallback), for departure: use std
        const gateEndTime = atd || std;  // Aircraft leaves gate at atd (or std for departure)
        const gateUtilizationMin = gateStartTime && gateEndTime 
          ? Math.max(0, (gateEndTime.getTime() - gateStartTime.getTime()) / (1000 * 60))
          : 0;

        const f: Flight = {
            id: arrFlt || depFlt,
            gate: depGate || gate, 
            target: date, 
            isEtd: !!std, 
            acType, 
            acCode: '', 
            checkinData: [],
            arrFlt, 
            depFlt, 
            arrSts: map['arrSts']!=-1 ? safeStr(r[map['arrSts']]) : '', 
            depSts: map['depSts']!=-1 ? safeStr(r[map['depSts']]) : '',
            sta, 
            ata, 
            std, 
            atd,
            arrPax: map['arrPax']!=-1 ? parseInt(r[map['arrPax']])||0 : 0,
            depPax: map['depPax']!=-1 ? parseInt(r[map['depPax']])||0 : 0,
            from: fromLoc, 
            to: toLoc, 
            cap, 
            date,
            alCode: (arrFlt || depFlt).substring(0,2).toUpperCase(),
            // Infrastructure fields
            depGate: depGate || gate,
            arrStand,
            depStand,
            carousel,
            counters: counters ? counters.split(/[,;]/).map(c => c.trim()).filter(c => c) : [],
            gateStart: gateStartTime || undefined,
            gateEnd: gateEndTime || undefined,
            gateUtilizationMin,
        };
        newFlights.push(f);
     }
     
     if(newFlights.length > 0) {
        const sorted = newFlights.sort((a,b) => a.date!.getTime() - b.date!.getTime());
        const d1 = sorted[0].date!;
        const d2 = sorted[sorted.length-1].date!;
        
        const fmtDate = (d: Date) => d.toISOString().split('T')[0];
        setRangeA({ from: fmtDate(d1), to: fmtDate(d2) });
        
        const diff = d2.getTime() - d1.getTime();
        const prevEnd = new Date(d1.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - diff);
        setRangeB({ from: fmtDate(prevStart), to: fmtDate(prevEnd) });

        const als = Array.from(new Set(newFlights.map(f => f.alCode).filter((v): v is string => !!v))).sort();
        setAirlineList(als);
        if(als.length > 0) setAirlineA(als[0]);
        if(als.length > 1) setAirlineB(als[1]);

        setFlights(newFlights);
        setStep(2);
     }
  };

  // --- CALCULATION ENGINE --- (Same as before)
  const calculateMetrics = (subset: Flight[], startStr: string, endStr: string): AnalyticsMetrics => {
      const m: AnalyticsMetrics = {
          totalFlights: 0, arrFlights: 0, depFlights: 0, totalPax: 0, loadFactor: 0, cancelled: 0, d15: 0, d30: 0, otp: 0,
          hourlyDistribution: Array(24).fill(0),
          hourlyDEP: Array(24).fill(0),
          hourlyARR: Array(24).fill(0),
          hourlyStats: Array.from({length: 24}, () => ({ totalFlown: 0, onTime: 0 })),
          aircraftBreakdown: {}, aircraftByAirline: {}, airlineStats: {}, routeStats: {}
      };

      if(!startStr || !endStr) return m;
      const s = new Date(startStr); s.setHours(0,0,0,0);
      const e = new Date(endStr); e.setHours(23,59,59,999);

      let totalSeats = 0;
      let totalFlownForOTP = 0;
      let totalLegsCreated = 0;
      let legsFilteredByDate = 0;
      let arrLegsCreated = 0;
      let depLegsCreated = 0;

      subset.forEach(f => {
          const legs = [];
          // ARR leg: only if f.arrFlt AND f.sta exist
          if(f.arrFlt && f.sta) {
              legs.push({ 
                  type: 'ARR', 
                  act: f.ata || null, 
                  sch: f.sta, 
                  pax: f.arrPax||0, 
                  sts: f.arrSts || '', 
                  route: f.from || 'UNK' 
              });
          }
          // DEP leg: only if f.depFlt AND f.std exist
          if(f.depFlt && f.std) {
              legs.push({ 
                  type: 'DEP', 
                  act: f.atd || null, 
                  sch: f.std, 
                  pax: f.depPax||0, 
                  sts: f.depSts || '', 
                  route: f.to || 'UNK' 
              });
          }

          totalLegsCreated += legs.length;
          if(legs.some(l => l.type === 'ARR')) arrLegsCreated++;
          if(legs.some(l => l.type === 'DEP')) depLegsCreated++;

          legs.forEach(leg => {
              // Excel logic: const t = leg.sch || leg.act; if(!t || t < s || t > e) return;
              const t = leg.sch || leg.act;
              if(!t || t < s || t > e) {
                  legsFilteredByDate++;
                  return;
              }

              m.totalFlights++;
              if(leg.type === 'ARR') m.arrFlights++; else m.depFlights++;
              m.totalPax += leg.pax;
              totalSeats += f.cap || 180;

              // Use STD for DEP, STA for ARR (scheduled time)
              // Time parsed as UTC, so use getUTCHours() to get correct hour
              const schedTime = leg.type === 'DEP' ? f.std : f.sta;
              const h = (schedTime || t).getUTCHours();
              if(leg.type === 'DEP') {
                  m.hourlyDistribution[h]++;
                  m.hourlyDEP[h]++;
              } else if(leg.type === 'ARR') {
                  m.hourlyDistribution[h]++;
                  m.hourlyARR[h]++;
              }

              const sts = (leg.sts || '').toUpperCase();
              const isCnl = sts.includes('CX') || sts.includes('CNL') || sts.includes('CAN') || sts.includes('HUY') || sts.includes('HỦY') || sts.includes('CANCELLED');
              let isD15 = false;
              let isD30 = false;
              
              if(isCnl) {
                  m.cancelled++;
              } else {
                  // Only calculate OTP/delay if we have both scheduled and actual times
                  if(leg.act && leg.sch && leg.act instanceof Date && leg.sch instanceof Date) {
                      const diff = leg.act.getTime() - leg.sch.getTime();
                      const dMin = diff / 60000;
                      
                      totalFlownForOTP++;
                      m.hourlyStats[h].totalFlown++;
                      
                      if(dMin > 15) { m.d15++; isD15=true; }
                      if(dMin > 30) { m.d30++; isD30=true; }
                      if(dMin <= 15) {
                          m.hourlyStats[h].onTime++;
                      }
                  }
              }
              
              const al = f.alCode || 'UNK';
              if(!m.airlineStats[al]) m.airlineStats[al] = { flights:0, pax:0, otp:0, lf:0, cancelRate:0, _d15:0, _cancel:0, _flown:0 };
              const as = m.airlineStats[al];
              as.flights++;
              as.pax += leg.pax;
              if(isCnl) as._cancel++;
              else if(leg.act) {
                  as._flown++;
                  if(isD15) as._d15++;
              }

              const r = leg.route;
              if(!m.routeStats[r]) m.routeStats[r] = { code: r, name: AIRPORT_NAMES[r]||r, total:0, arr:0, dep:0, arrPax:0, depPax:0, d30:0, cancelled:0 };
              const rs = m.routeStats[r];
              rs.total++;
              if(leg.type==='ARR') { rs.arr++; rs.arrPax+=leg.pax; } else { rs.dep++; rs.depPax+=leg.pax; }
              if(isCnl) rs.cancelled++;
              if(isD30) rs.d30++;

              if(f.acType) {
                  m.aircraftBreakdown[f.acType] = (m.aircraftBreakdown[f.acType]||0) + 1;
                  if(f.alCode) {
                      if(!m.aircraftByAirline[f.acType]) m.aircraftByAirline[f.acType] = {};
                      m.aircraftByAirline[f.acType][f.alCode] = (m.aircraftByAirline[f.acType][f.alCode] || 0) + 1;
                  }
              }
          });
      });

      if(totalFlownForOTP > 0) m.otp = ((totalFlownForOTP - m.d15) / totalFlownForOTP) * 100;
      if(totalSeats > 0) m.loadFactor = (m.totalPax / totalSeats) * 100;

      Object.values(m.airlineStats).forEach(s => {
          if(s.flights > 0) {
             const seats = s.flights * 180; 
             s.lf = (s.pax / seats) * 100;
             s.cancelRate = (s._cancel / s.flights) * 100;
          }
          if(s._flown > 0) {
             s.otp = ((s._flown - s._d15) / s._flown) * 100;
          } else {
             s.otp = 100; 
          }
      });

      // Debug logging
      console.log(`[Analytics calculateMetrics] Processed ${subset.length} flights:`);
      console.log(`  - Created ${totalLegsCreated} legs (${arrLegsCreated} ARR-capable, ${depLegsCreated} DEP-capable)`);
      console.log(`  - Filtered out ${legsFilteredByDate} legs outside date range`);
      console.log(`  - Final count: ${m.totalFlights} legs (${m.arrFlights} ARR, ${m.depFlights} DEP)`);

      return m;
  };

  // --- MEMOIZED DATASETS ---
  
  const overviewData = useMemo(() => {
      const subset = selectedAirline === 'ALL' ? flights : flights.filter(f => f.alCode === selectedAirline);
      return calculateMetrics(subset, rangeA.from, rangeA.to);
  }, [flights, rangeA, selectedAirline]);

  const statsA = useMemo(() => {
      if(viewMode === 'compare_time') {
          // Allow filtering by airline in Time Comparison mode
          const subset = selectedAirline === 'ALL' ? flights : flights.filter(f => f.alCode === selectedAirline);
          return calculateMetrics(subset, rangeA.from, rangeA.to);
      } else if(viewMode === 'compare_airline') {
          return calculateMetrics(flights.filter(f => f.alCode === airlineA), rangeA.from, rangeA.to);
      }
      return overviewData; 
  }, [flights, viewMode, rangeA, airlineA, selectedAirline, overviewData]);

  const statsB = useMemo(() => {
      if(viewMode === 'compare_time') {
          // Allow filtering by airline in Time Comparison mode
          const subset = selectedAirline === 'ALL' ? flights : flights.filter(f => f.alCode === selectedAirline);
          return calculateMetrics(subset, rangeB.from, rangeB.to);
      } else if(viewMode === 'compare_airline') {
          return calculateMetrics(flights.filter(f => f.alCode === airlineB), rangeA.from, rangeA.to);
      }
      return overviewData;
  }, [flights, viewMode, rangeB, rangeA, airlineB, selectedAirline, overviewData]);

  // Route Comparison Data
  const routeComparisonData = useMemo(() => {
    if(!showRouteComparison) return null;
    const rA = statsA.routeStats;
    const rB = statsB.routeStats;
    const codesA = new Set(Object.keys(rA));
    const codesB = new Set(Object.keys(rB));
    
    const common = [...codesA].filter(x => codesB.has(x)).map(c => ({
        code: c,
        name: rA[c].name,
        valA: rA[c].total,
        valB: rB[c].total,
        paxA: rA[c].arrPax + rA[c].depPax,
        paxB: rB[c].arrPax + rB[c].depPax
    })).sort((a,b) => b.valA - a.valA);

    const uniqueA = [...codesA].filter(x => !codesB.has(x)).map(c => rA[c]).sort((a,b) => b.total - a.total);
    const uniqueB = [...codesB].filter(x => !codesA.has(x)).map(c => rB[c]).sort((a,b) => b.total - a.total);
    
    return { common, uniqueA, uniqueB };
  }, [showRouteComparison, statsA, statsB]);

  // --- DRILL DOWN HELPERS ---
  const getAirlineRoutes = (alCode: string) => {
      const routes: Record<string, {flights: number, pax: number}> = {};
      const s = new Date(rangeA.from); s.setHours(0,0,0,0);
      const e = new Date(rangeA.to); e.setHours(23,59,59,999);

      flights.filter(f => f.alCode === alCode).forEach(f => {
          if(f.arrFlt && f.from) {
               const t = f.sta || f.ata;
               if(t && t >= s && t <= e) {
                   const r = f.from;
                   if(!routes[r]) routes[r] = {flights:0, pax:0};
                   routes[r].flights++; routes[r].pax += f.arrPax||0;
               }
          }
          if(f.depFlt && f.to) {
               const t = f.std || f.atd;
               if(t && t >= s && t <= e) {
                   const r = f.to;
                   if(!routes[r]) routes[r] = {flights:0, pax:0};
                   routes[r].flights++; routes[r].pax += f.depPax||0;
               }
          }
      });
      return (Object.entries(routes) as [string, {flights: number, pax: number}][]).sort((a,b) => b[1].flights - a[1].flights);
  };

  const getAirlineFlightStats = (alCode: string) => {
      const stats: Record<string, { count: number, pax: number, hours: Set<string>, dest: string }> = {};
      const s = new Date(rangeA.from); s.setHours(0,0,0,0);
      const e = new Date(rangeA.to); e.setHours(23,59,59,999);
      
      const oneDay = 24 * 60 * 60 * 1000;
      const days = Math.round(Math.abs((s.getTime() - e.getTime()) / oneDay)) + 1;
      const weeks = Math.max(1, days / 7);

      flights.filter(f => f.alCode === alCode && f.depFlt).forEach(f => {
          const t = f.std || f.atd;
          if(t && t >= s && t <= e) {
              const flt = f.depFlt!;
              if(!stats[flt]) stats[flt] = { count: 0, pax: 0, hours: new Set(), dest: f.to || 'UNK' };
              stats[flt].count++;
              stats[flt].pax += f.depPax || 0;
              const h = t.getUTCHours();
              stats[flt].hours.add(`${h.toString().padStart(2, '0')}:00`);
          }
      });
      
      return Object.entries(stats)
          .map(([flt, data]) => ({
              flt,
              ...data,
              hoursStr: Array.from(data.hours).sort().join(', '),
              freq: (data.count / weeks).toFixed(1)
          }))
          .sort((a,b) => b.count - a.count);
  };

  const getAirlinesByRoute = (stationCode: string) => {
      const airlineMap: Record<string, { flights: number, pax: number, acTypes: Set<string> }> = {};
      const s = new Date(rangeA.from); s.setHours(0,0,0,0);
      const e = new Date(rangeA.to); e.setHours(23,59,59,999);
      
      flights.forEach(f => {
          if (f.arrFlt && f.from === stationCode) {
              const t = f.sta || f.ata;
              if(t && t >= s && t <= e) {
                  const al = f.alCode || 'UNK';
                  if(!airlineMap[al]) airlineMap[al] = { flights: 0, pax: 0, acTypes: new Set() };
                  airlineMap[al].flights++; airlineMap[al].pax += f.arrPax||0;
                  if(f.acType) airlineMap[al].acTypes.add(f.acType);
              }
          }
          if (f.depFlt && f.to === stationCode) {
              const t = f.std || f.atd;
              if(t && t >= s && t <= e) {
                  const al = f.alCode || 'UNK';
                  if(!airlineMap[al]) airlineMap[al] = { flights: 0, pax: 0, acTypes: new Set() };
                  airlineMap[al].flights++; airlineMap[al].pax += f.depPax||0;
                  if(f.acType) airlineMap[al].acTypes.add(f.acType);
              }
          }
      });
      return Object.entries(airlineMap).sort((a,b) => b[1].flights - a[1].flights);
  };

  const getDiff = (a: number, b: number, inverse = false) => {
      if(b === 0) return { val: 0, class: 'text-slate-300' };
      const pct = ((a - b) / b) * 100;
      const isPos = pct > 0;
      let color = isPos ? 'text-emerald-500' : 'text-red-500';
      if(inverse) color = isPos ? 'text-red-500' : 'text-emerald-500';
      return { val: Math.abs(pct).toFixed(1) + '%', sign: isPos ? '+' : '-', class: `text-[10px] font-bold ${color} bg-white/80 px-1 rounded ml-2 border border-slate-100` };
  };

  const renderKPICard = (title: string, valA: number, valB: number, type: 'number'|'percent' = 'number', inverse = false, onClick?: () => void) => {
      const diff = getDiff(valA, valB, inverse);
      const displayA = type === 'percent' ? valA.toFixed(1) + '%' : valA.toLocaleString();
      const displayB = type === 'percent' ? valB.toFixed(1) + '%' : valB.toLocaleString();

      const labelA = viewMode === 'compare_time' ? 'Kỳ A' : airlineA;
      const labelB = viewMode === 'compare_time' ? 'Kỳ B' : airlineB;

      return (
          <div 
            className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between h-32 relative overflow-hidden group hover:shadow-md transition-all ${onClick ? 'cursor-pointer hover:border-blue-300' : ''}`}
            onClick={onClick}
          >
              <div className="flex justify-between items-start z-10">
                  <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">{title}</h4>
                  {viewMode === 'compare_airline' && <Plane className="text-slate-200 group-hover:text-blue-100 transition-colors transform group-hover:scale-110" size={24}/>}
              </div>
              <div className="z-10 mt-2">
                  <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-black text-slate-800">{displayA}</div>
                      <div className="text-sm font-bold text-slate-400 opacity-80 text-right">{labelB}: {displayB}</div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">{labelA}</span>
                      <span className={diff.class}>{diff.sign}{diff.val}</span>
                  </div>
              </div>
              <div className="absolute right-0 bottom-0 w-16 h-16 bg-gradient-to-tl from-slate-50 to-transparent rounded-tl-full pointer-events-none"></div>
          </div>
      );
  };

  // --- EXPORT LOGIC ---
  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);

    try {
        const element = dashboardRef.current;
        const scrollables = element.querySelectorAll('.analytics-scrollable-table');
        const originalStyles: {el: Element, height: string, overflow: string}[] = [];
        
        scrollables.forEach(el => {
            const htmlEl = el as HTMLElement;
            originalStyles.push({ el: htmlEl, height: htmlEl.style.maxHeight, overflow: htmlEl.style.overflow });
            htmlEl.style.maxHeight = 'none';
            htmlEl.style.overflow = 'visible';
        });

        const canvas = await html2canvas(element, { scale: 2, useCORS: true, logging: false, windowWidth: element.scrollWidth, height: element.scrollHeight });
        
        scrollables.forEach((el, i) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.maxHeight = originalStyles[i].height;
            htmlEl.style.overflow = originalStyles[i].overflow;
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        let heightLeft = pdfHeight;
        let position = 0;
        let page = 1;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, -page * pageHeight, pdfWidth, pdfHeight);
            heightLeft -= pageHeight;
            page++;
        }
        pdf.save(`OpsMaster_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error("Export failed:", error);
        alert("Failed to export report.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
      // Create a workbook
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet
      const summaryData = [
          ["Metric", "Value"],
          ["Total Flights", overviewData.totalFlights],
          ["Arrivals", overviewData.arrFlights],
          ["Departures", overviewData.depFlights],
          ["Total Pax", overviewData.totalPax],
          ["Load Factor (%)", overviewData.loadFactor.toFixed(2)],
          ["Cancelled", overviewData.cancelled],
          ["OTP 15 (%)", overviewData.otp.toFixed(2)],
          ["Delay > 15", overviewData.d15],
          ["Delay > 30", overviewData.d30]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Overview");

      // 2. Airlines Sheet
      const airlineData = Object.entries(overviewData.airlineStats).map(([code, val]) => {
          const s = val as AirlineStat;
          return {
            Code: code,
            Name: getAirlineName(code),
            Flights: s.flights,
            Pax: s.pax,
            "OTP 15 (%)": (s.otp || 0).toFixed(2),
            Cancelled: s._cancel,
            "Cancel Rate (%)": (s.cancelRate || 0).toFixed(2),
            "Load Factor (%)": (s.lf || 0).toFixed(2)
          };
      });
      const wsAirlines = XLSX.utils.json_to_sheet(airlineData);
      XLSX.utils.book_append_sheet(wb, wsAirlines, "Airline Stats");

      // 3. Routes Sheet
      const routeData = Object.values(overviewData.routeStats).map((val) => {
          const r = val as RouteStat;
          return {
            Route: r.code,
            Airport: r.name,
            Total: r.total,
            Arr: r.arr,
            Dep: r.dep,
            "Arr Pax": r.arrPax,
            "Dep Pax": r.depPax,
            "Delay > 30": r.d30,
            Cancelled: r.cancelled
          };
      });
      const wsRoutes = XLSX.utils.json_to_sheet(routeData);
      XLSX.utils.book_append_sheet(wb, wsRoutes, "Route Network");

      // 4. Hourly Sheet
      const hourlyData = overviewData.hourlyStats.map((h, i) => ({
          Hour: `${i}:00`,
          "Total Flown": h.totalFlown,
          "On Time": h.onTime,
          "OTP (%)": h.totalFlown > 0 ? ((h.onTime/h.totalFlown)*100).toFixed(2) : 0,
          "Traffic Volume": overviewData.hourlyDistribution[i]
      }));
      const wsHourly = XLSX.utils.json_to_sheet(hourlyData);
      XLSX.utils.book_append_sheet(wb, wsHourly, "Hourly Ops");

      // Save file
      XLSX.writeFile(wb, `OpsMaster_Analytics_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // --- CHART DATA PREP --- (Rest of the component remains similar)
  const flightDistData = {
      labels: Array.from({length:24},(_,i)=>`${i}h`),
      datasets: [
          { label: 'Cất cánh (DEP)', data: overviewData.hourlyDEP, backgroundColor: '#ef4444', borderRadius: 4, barPercentage: 0.6 },
          { label: 'Hạ cánh (ARR)', data: overviewData.hourlyARR, backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }
      ]
  };
  const otpChartData = {
      labels: Array.from({length:24},(_,i)=>`${i}h`),
      datasets: [{
          label: 'OTP 15 (%)',
          data: overviewData.hourlyStats.map(h => {
              if (h.totalFlown > 0) {
                  return (h.onTime / h.totalFlown) * 100;
              }
              return 0; // Show 0% instead of null when no data
          }),
          borderColor: '#10b981', 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          tension: 0.3, 
          fill: true, 
          pointRadius: 3,
          spanGaps: false
      }]
  };
  const acData = {
      labels: Object.keys(overviewData.aircraftBreakdown),
      datasets: [{ label: 'Flights', data: Object.values(overviewData.aircraftBreakdown), backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#6366f1', '#ec4899'], borderRadius: 4 }]
  };
  const lfChartData = {
      labels: Object.keys(overviewData.airlineStats),
      datasets: [{ label: 'LF (%)', data: Object.values(overviewData.airlineStats).map((s: AirlineStat) => s.lf), backgroundColor: '#8b5cf6', borderRadius: 4 }]
  };
  const marketShareEntries = Object.entries(overviewData.airlineStats) as [string, AirlineStat][];
  const marketShareSorted = marketShareEntries.sort((a,b) => b[1].pax - a[1].pax).slice(0, marketShareLimit);
  const marketShareData = {
      labels: marketShareSorted.map(([code]) => code),
      datasets: [{ data: marketShareSorted.map(([_, s]) => s.pax), backgroundColor: ['#3b82f6', '#6366f1', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'], borderWidth: 2 }]
  };

  const onAircraftChartClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const chart = aircraftChartRef.current;
    if (!chart) return;
    const element = getElementAtEventReact(chart, event);
    if (!element.length) return;
    const { index } = element[0];
    const type = Object.keys(overviewData.aircraftBreakdown)[index];
    setSelectedAircraftDetail(type);
  };

  // Comparison Charts
  const labelA = viewMode === 'compare_time' ? 'Kỳ A' : airlineA;
  const labelB = viewMode === 'compare_time' ? 'Kỳ B' : airlineB;
  const volData = {
      labels: ['Tổng chuyến', 'Chuyến Đến', 'Chuyến Đi', 'Khách (k)'],
      datasets: [
          { label: labelA, data: [statsA.totalFlights, statsA.arrFlights, statsA.depFlights, statsA.totalPax/1000], backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: labelB, data: [statsB.totalFlights, statsB.arrFlights, statsB.depFlights, statsB.totalPax/1000], backgroundColor: '#93c5fd', borderRadius: 4 }
      ]
  };
  const lfData = {
      labels: ['Load Factor %'],
      datasets: [
          { label: labelA, data: [statsA.loadFactor], backgroundColor: '#8b5cf6', borderRadius: 4, barThickness: 40 },
          { label: labelB, data: [statsB.loadFactor], backgroundColor: '#c4b5fd', borderRadius: 4, barThickness: 40 }
      ]
  };
  const qualityData = {
      labels: ['Chậm >30p', 'Hủy'],
      datasets: [
          { label: labelA, data: [statsA.d30, statsA.cancelled], backgroundColor: '#ef4444', borderRadius: 4, barThickness: 40 },
          { label: labelB, data: [statsB.d30, statsB.cancelled], backgroundColor: '#fca5a5', borderRadius: 4, barThickness: 40 }
      ]
  };

  // Data Source Selection Modal
  // Step 0: Choose load mode (Cloud or Import)
  if(step === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Analytics - Load Data</h2>
            <button 
              onClick={() => navigate('/home')}
              className="text-slate-400 hover:text-white transition-colors"
              title="Back to Home"
            >
              <X size={28} />
            </button>
          </div>

          <p className="text-slate-300 mb-8 text-lg">
            How would you like to load your flight data for analysis?
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Load from Cloud */}
            <div 
              onClick={() => {
                setLoadMode('cloud');
                setStep(1.5);
              }}
              className="group bg-gradient-to-br from-blue-600/20 to-blue-400/20 border border-blue-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-blue-400/60 hover:from-blue-600/30 hover:to-blue-400/30 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <Cloud className="w-10 h-10 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Load from Cloud</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Load existing analytics data from Supabase. Set date range to retrieve data.
              </p>
              <ul className="text-xs text-slate-400 space-y-2">
                <li>✓ No file upload needed</li>
                <li>✓ Previously synced data</li>
                <li>✓ Quick analysis</li>
              </ul>
            </div>

            {/* Import New File */}
            <div 
              onClick={() => {
                setLoadMode('import');
                setStep(1);
              }}
              className="group bg-gradient-to-br from-amber-600/20 to-amber-400/20 border border-amber-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-amber-400/60 hover:from-amber-600/30 hover:to-amber-400/30 hover:shadow-lg hover:shadow-amber-500/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <FileSpreadsheet className="w-10 h-10 text-amber-400" />
                <h3 className="text-xl font-bold text-white">Import New File</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Upload Excel file with flight data for analytics.
              </p>
              <ul className="text-xs text-slate-400 space-y-2">
                <li>✓ Import Excel file</li>
                <li>✓ Local analysis</li>
                <li>✓ Full control</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center mt-8">
            You can switch between Cloud and Local modes anytime from the home screen.
          </p>
        </div>
      </div>
    );
  }

  // Step 1.5: Load from Cloud - Set date range
  if(step === 1.5) {
    return (
      <>
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
                                        Arr Flight <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.arrFlt
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.arrFlt || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, arrFlt: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Dep Flight <span className="text-red-500">*</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.flight || cloudMapping.depFlt
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.flight || cloudMapping.depFlt || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, flight: e.target.value, depFlt: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Arr Status <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.arrSts 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.arrSts || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, arrSts: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Dep Status <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.depSts 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.depSts || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, depSts: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
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
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        STA (Scheduled Arrival) <span className="text-red-500">*</span>
                                    </label>
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
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        ATA (Actual Arrival) <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.ata 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.ata || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, ata: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        ATD (Actual Departure) <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.atd 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.atd || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, atd: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Arr Pax <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.arrPax 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.arrPax || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, arrPax: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Dep Pax <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.depPax 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.depPax || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, depPax: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        From <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.from 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.from || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, from: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        To <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.to 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.to || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, to: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-blue-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        AC Type <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
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
                                </div>
                                
                                {/* Infrastructure Fields */}
                                <div className="col-span-full border-t-2 border-blue-300 pt-4 mt-4">
                                    <h4 className="text-sm font-bold text-blue-700 mb-4 flex items-center gap-2">
                                        <span>🏗️ Infrastructure (Optional)</span>
                                    </h4>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Departure Gate <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.depGate 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.depGate || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, depGate: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Arrival Stand <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.arrStand 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.arrStand || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, arrStand: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Departure Stand <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.depStand 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.depStand || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, depStand: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Carousel / Baggage Belt <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.carousel 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.carousel || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, carousel: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-sm">
                                    <label className="block text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        Check-in Counters <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>
                                    </label>
                                    <select 
                                        className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                            cloudMapping.counters 
                                                ? 'border-green-500 bg-green-50' 
                                                : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                        }`}
                                        value={cloudMapping.counters || ''}
                                        onChange={e => setCloudMapping({...cloudMapping, counters: e.target.value})}
                                    >
                                        <option value="">-- Select Column --</option>
                                        {cloudColumns.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        {/* Sample Data Preview */}
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
                                                const flightCol = cloudMapping.flight || cloudMapping.depFlt || 'dep_flight';
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
                                    disabled={(!cloudMapping.flight && !cloudMapping.depFlt) || (!cloudMapping.std && !cloudMapping.sta)}
                                    className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${
                                        ((!cloudMapping.flight && !cloudMapping.depFlt) || (!cloudMapping.std && !cloudMapping.sta))
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
                  Load Analytics Data from Cloud
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
                <input 
                  type="datetime-local"
                  value={rangeA.from}
                  onChange={(e) => setRangeA({...rangeA, from: e.target.value})}
                  className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">End Date & Time</label>
                <input 
                  type="datetime-local"
                  value={rangeA.to}
                  onChange={(e) => setRangeA({...rangeA, to: e.target.value})}
                  className="w-full border-2 border-slate-200 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <button 
                onClick={loadCloudAnalyticsData}
                disabled={!rangeA.from || !rangeA.to || isLoadingCloud}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoadingCloud ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Loading...
                  </>
                ) : (
                  'Load Analytics Data'
                )}
              </button>
            </div>

            {isLoadingCloud && (
              <div className="mt-6 flex items-center justify-center gap-2 text-blue-600">
                <Loader2 className="animate-spin" size={20} />
                <span>Loading data from Supabase...</span>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

  if(analyticsSourceModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-white">Analytics - Select Data Source</h2>
            <button 
              onClick={() => navigate('/home')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={28} />
            </button>
          </div>

          <p className="text-slate-300 mb-8 text-lg">
            Choose how you want to analyze your operational data:
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Cloud/Supabase Option */}
            <div 
              onClick={() => setAnalyticsSourceModal(false)}
              className="group bg-gradient-to-br from-blue-600/20 to-blue-400/20 border border-blue-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-blue-400/60 hover:from-blue-600/30 hover:to-blue-400/30 hover:shadow-lg hover:shadow-blue-500/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <Cloud className="w-10 h-10 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Cloud Data</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Analyze data from Supabase cloud. Great for team analytics and shared datasets.
              </p>
              <ul className="text-xs text-slate-400 space-y-2">
                <li>✓ Cloud data analysis</li>
                <li>✓ Shared insights</li>
                <li>✓ Import new files to sync</li>
              </ul>
            </div>

            {/* Local/Excel Option */}
            <div 
              onClick={() => navigate('/analytics-local')}
              className="group bg-gradient-to-br from-amber-600/20 to-amber-400/20 border border-amber-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-amber-400/60 hover:from-amber-600/30 hover:to-amber-400/30 hover:shadow-lg hover:shadow-amber-500/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <HardDrive className="w-10 h-10 text-amber-400" />
                <h3 className="text-xl font-bold text-white">Local File</h3>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Analyze Excel files locally. Perfect for quick analysis without cloud sync.
              </p>
              <ul className="text-xs text-slate-400 space-y-2">
                <li>✓ Local file analysis</li>
                <li>✓ No internet required</li>
                <li>✓ Full privacy control</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center mt-8">
            You can switch between Cloud and Local modes anytime from the home screen.
          </p>
        </div>
      </div>
    );
  }

  if(step === 1) return <FileUpload title="Analytics Module" mappings={[{key:'arrFlt', label:'Arr Flight'}, {key:'depFlt', label:'Dep Flight'}, {key:'arrSts', label:'Arr Status', optional: true}, {key:'depSts', label:'Dep Status', optional: true}, {key:'sta', label:'STA'}, {key:'ata', label:'ATA', optional: true}, {key:'std', label:'STD'}, {key:'atd', label:'ATD', optional: true}, {key:'arrPax', label:'Arr Pax', optional: true}, {key:'depPax', label:'Dep Pax', optional: true}, {key:'from', label:'From', optional: true}, {key:'to', label:'To', optional: true}, {key:'acType', label:'AC Type', optional: true}, {key:'gate', label:'Gate / Stand', optional: true}, {key:'depGate', label:'Dep Gate', optional: true}, {key:'arrBelt', label:'Arrival Belt', optional: true}, {key:'counters', label:'Counters', optional: true}]} onDataReady={handleDataReady} />;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
       {/* Config Modal */}
       <AnalyticsConfigModal
           show={showConfigModal}
           onClose={() => setShowConfigModal(false)}
           aircraftConfig={aircraftConfig}
           airlineConfig={airlineConfig}
           airportConfig={airportConfig}
           onAircraftAdd={handleAddAircraft}
           onAircraftRemove={handleRemoveAircraft}
           onAirlineAdd={handleAddAirline}
           onAirlineRemove={handleRemoveAirline}
           onAirportAdd={handleAddAirport}
           onAirportRemove={handleRemoveAirport}
       />

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
                                       Flight Number (dep_flight) <span className="text-red-500">*</span>
                                   </label>
                                   <select 
                                       className={`w-full p-3 border-2 rounded-lg text-slate-900 font-medium outline-none transition-all ${
                                           cloudMapping.flight || cloudMapping.depFlt
                                               ? 'border-green-500 bg-green-50' 
                                               : 'border-slate-200 bg-slate-50 focus:border-blue-600'
                                       }`}
                                       value={cloudMapping.flight || cloudMapping.depFlt || ''}
                                       onChange={e => setCloudMapping({...cloudMapping, flight: e.target.value, depFlt: e.target.value})}
                                   >
                                       <option value="">-- Select Column --</option>
                                       {cloudColumns.map(c => (
                                           <option key={c} value={c}>{c}</option>
                                       ))}
                                   </select>
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
                               </div>
                           </div>
                       </div>
                       
                       {/* Sample Data Preview */}
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
                                               const flightCol = cloudMapping.flight || cloudMapping.depFlt || 'dep_flight';
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
                                   disabled={(!cloudMapping.flight && !cloudMapping.depFlt) || (!cloudMapping.std && !cloudMapping.sta)}
                                   className={`px-8 py-3 rounded-lg font-bold shadow-lg transition-all flex items-center gap-2 ${
                                       ((!cloudMapping.flight && !cloudMapping.depFlt) || (!cloudMapping.std && !cloudMapping.sta))
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

       <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
           <div className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 text-white p-1.5 rounded-lg"><BarChart2 size={20}/></div>
                    <span className="font-bold text-lg text-slate-800">Analytics: Production Release</span>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => navigate('/home')} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"><Home size={14}/> Home</button>
                    
                    <button 
                        onClick={handleExportExcel}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-sm flex items-center gap-2 transition-all"
                    >
                        <FileSpreadsheet size={14}/> Excel Data
                    </button>

                    <button 
                        onClick={handleExportPDF} 
                        disabled={isExporting}
                        className={`px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-black rounded-md shadow-sm flex items-center gap-2 transition-all ${isExporting ? 'opacity-75 cursor-wait' : ''}`}
                    >
                        {isExporting ? <RefreshCw size={14} className="animate-spin"/> : <Printer size={14}/>} 
                        {isExporting ? 'Generating...' : 'Export Report'}
                    </button>

                    <button 
                        onClick={() => setShowConfigModal(true)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-sm flex items-center gap-2 transition-all"
                    >
                        ⚙️ Config
                    </button>
                </div>
           </div>
           
           <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-6 items-end">
               <div>
                   <label className="text-[10px] font-extrabold text-slate-400 uppercase mb-1.5 block">CHẾ ĐỘ XEM</label>
                   <div className="relative">
                       <select value={viewMode} onChange={e => setViewMode(e.target.value as ViewMode)} className="bg-white border-2 border-slate-200 text-blue-700 text-xs font-bold rounded-lg px-3 py-2 pr-8 focus:border-blue-500 outline-none shadow-sm appearance-none min-w-[160px] cursor-pointer">
                           <option value="overview">📊 Tổng quan (Overview)</option>
                           <option value="compare_time">⏳ So sánh Thời gian</option>
                           <option value="compare_airline">✈️ So sánh Hãng bay</option>
                           <option value="infrastructure">🏗️ Khai thác (Infrastructure)</option>
                       </select>
                       <ArrowRightLeft size={12} className="absolute right-3 top-2.5 text-blue-400 pointer-events-none"/>
                   </div>
               </div>
               
               {/* FILTERS RENDERING */}
               {viewMode === 'overview' && (
                   <>
                       <div>
                           <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 block">THỜI GIAN</label>
                           <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
                               <input type="date" value={rangeA.from} onChange={e => setRangeA({...rangeA, from: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                               <span className="text-slate-300">➜</span>
                               <input type="date" value={rangeA.to} onChange={e => setRangeA({...rangeA, to: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                           </div>
                       </div>
                       <div>
                           <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 block">LỌC HÃNG</label>
                           <select value={selectedAirline} onChange={e => setSelectedAirline(e.target.value)} className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 w-32 shadow-sm outline-none focus:border-blue-500">
                               <option value="ALL">-- Tất cả --</option>
                               {airlineList.map(a => <option key={a} value={a}>{a}</option>)}
                           </select>
                       </div>
                   </>
               )}
               
               {viewMode === 'infrastructure' && (
                   <div>
                       <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 block">THỜI GIAN</label>
                       <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
                           <input type="date" value={rangeA.from} onChange={e => setRangeA({...rangeA, from: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                           <span className="text-slate-300">➜</span>
                           <input type="date" value={rangeA.to} onChange={e => setRangeA({...rangeA, to: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                       </div>
                   </div>
               )}

               {viewMode === 'compare_time' && (
                   <div className="flex gap-4 items-end">
                       <div>
                           <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 block">Lọc Hãng (Tùy chọn)</label>
                           <select value={selectedAirline} onChange={e => setSelectedAirline(e.target.value)} className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 w-32 shadow-sm outline-none focus:border-blue-500">
                               <option value="ALL">-- Tất cả --</option>
                               {airlineList.map(a => <option key={a} value={a}>{a}</option>)}
                           </select>
                       </div>
                       <div>
                           <label className="text-[10px] font-extrabold text-blue-600 uppercase mb-1.5 block">Kỳ A (Gốc)</label>
                           <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
                               <input type="date" value={rangeA.from} onChange={e => setRangeA({...rangeA, from: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                               <span className="text-slate-300">➜</span>
                               <input type="date" value={rangeA.to} onChange={e => setRangeA({...rangeA, to: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                           </div>
                       </div>
                       <div>
                           <label className="text-[10px] font-extrabold text-red-500 uppercase mb-1.5 block">Kỳ B (So sánh)</label>
                           <div className="flex items-center gap-1 bg-white border border-red-200 rounded-lg p-1 shadow-sm">
                               <input type="date" value={rangeB.from} onChange={e => setRangeB({...rangeB, from: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                               <span className="text-red-200">➜</span>
                               <input type="date" value={rangeB.to} onChange={e => setRangeB({...rangeB, to: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                           </div>
                       </div>
                   </div>
               )}

               {viewMode === 'compare_airline' && (
                   <>
                       <div>
                           <label className="text-[10px] font-extrabold text-slate-500 uppercase mb-1.5 block">THỜI GIAN</label>
                           <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
                               <input type="date" value={rangeA.from} onChange={e => setRangeA({...rangeA, from: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                               <span className="text-slate-300">➜</span>
                               <input type="date" value={rangeA.to} onChange={e => setRangeA({...rangeA, to: e.target.value})} className="text-xs font-bold text-slate-900 border-none outline-none bg-transparent px-1 py-1 w-28"/>
                           </div>
                       </div>
                       <div className="flex gap-4">
                           <div>
                               <label className="text-[10px] font-extrabold text-blue-600 uppercase mb-1.5 block">Hãng A</label>
                               <select value={airlineA} onChange={e => setAirlineA(e.target.value)} className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 w-32 shadow-sm outline-none focus:border-blue-500">
                                   {airlineList.map(a => <option key={a} value={a}>{a}</option>)}
                               </select>
                           </div>
                           <div>
                               <label className="text-[10px] font-extrabold text-red-500 uppercase mb-1.5 block">Hãng B</label>
                               <select value={airlineB} onChange={e => setAirlineB(e.target.value)} className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-lg px-3 py-2 w-32 shadow-sm outline-none focus:border-red-500">
                                   {airlineList.map(a => <option key={a} value={a}>{a}</option>)}
                               </select>
                           </div>
                       </div>
                   </>
               )}
           </div>
       </div>

       {/* MAIN CONTENT AREA */}
       <div className="flex-1 overflow-auto bg-slate-50 relative">
           <div ref={dashboardRef} className="p-6 min-h-full">
           {viewMode === 'overview' ? (
               // --- OVERVIEW DASHBOARD ---
               <>
                   {/* KPI Row 1 */}
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                       <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                           <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider relative z-10">Tổng chuyến</h4>
                           <div className="text-2xl font-black text-slate-800 mt-1 relative z-10">{overviewData.totalFlights.toLocaleString()}</div>
                       </div>
                       <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <div><h4 className="text-[10px] font-extrabold text-slate-400 uppercase">Chuyến đến</h4><div className="text-xl font-black text-slate-800">{overviewData.arrFlights.toLocaleString()}</div></div>
                                <div className="h-full w-px bg-slate-100 mx-2"></div>
                                <div><h4 className="text-[10px] font-extrabold text-slate-400 uppercase">Chuyến đi</h4><div className="text-xl font-black text-slate-800">{overviewData.depFlights.toLocaleString()}</div></div>
                            </div>
                       </div>
                       <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 border-l-4 border-l-red-500">
                           <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Hủy chuyến</h4>
                           <div className="text-2xl font-black text-slate-800 mt-1">{overviewData.cancelled}</div>
                           <div className="text-[10px] text-slate-400 mt-1">Rate: {overviewData.totalFlights>0 ? ((overviewData.cancelled/overviewData.totalFlights)*100).toFixed(2) : 0}%</div>
                       </div>
                       <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 border-l-4 border-l-emerald-500">
                           <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Tổng khách</h4>
                           <div className="text-2xl font-black text-slate-800 mt-1">{overviewData.totalPax.toLocaleString()}</div>
                       </div>
                   </div>

                   {/* KPI Row 2 */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                           <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Hệ số tải (LF)</h4>
                           <div className="text-xl font-black text-blue-600 mt-1">{overviewData.loadFactor.toFixed(1)}%</div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                           <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mạng đường bay</h4>
                           <div className="text-xl font-black text-slate-800 mt-1">{Object.keys(overviewData.routeStats).length} <span className="text-sm font-normal text-slate-400">Sân bay</span></div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                           <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Chậm &gt; 15 phút (Toàn mạng)</h4>
                           <div className="text-xl font-black text-amber-500 mt-1">{overviewData.d15} <span className="text-xs text-slate-400">chuyến</span></div>
                        </div>
                   </div>

                   {/* Charts Grid */}
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Phân bổ Giờ bay (Dep)</h3>
                            <div className="h-64"><Bar data={flightDistData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false }, stacked: true }, y: { beginAtZero: true, stacked: true } } }} /></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Xu hướng OTP 15 (Toàn mạng)</h3>
                            <div className="h-64"><Line data={otpChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { min: 0, max: 100 } } }} /></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="text-xs font-bold text-slate-600 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Hệ số Tải (LF)</h3>
                            <div className="h-48"><Bar data={lfChartData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { min: 40, max: 100 } }, plugins: { legend: { display: false } } }} /></div>
                        </div>
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                             <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold text-slate-600 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Thị phần Khách</h3>
                                <div className="flex gap-2">
                                    <button onClick={() => setMarketShareLimit(5)} className={`text-[10px] font-bold px-2 py-1 rounded border ${marketShareLimit===5 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>Top 5</button>
                                    <button onClick={() => setMarketShareLimit(10)} className={`text-[10px] font-bold px-2 py-1 rounded border ${marketShareLimit===10 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}>Top 10</button>
                                </div>
                             </div>
                             <div className="h-48 flex justify-center"><Doughnut data={marketShareData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }} /></div>
                        </div>
                        <div className="col-span-1 lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                             <h3 className="text-xs font-bold text-slate-600 mb-4 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-500"></span> Cơ cấu Tàu bay (Click cột để xem chi tiết)</h3>
                             <div className="h-48"><Bar ref={aircraftChartRef} onClick={onAircraftChartClick} data={acData} options={{ responsive: true, maintainAspectRatio: false, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } }, plugins: { legend: { display: false } }, onHover: (e, el) => { const t = e.native?.target as HTMLElement; if(t) t.style.cursor = el.length ? 'pointer' : 'default'; } }} /></div>
                        </div>
                   </div>

                   {/* Tables */}
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                       {/* Airline Table */}
                       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                           <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                               <div className="flex justify-between items-center mb-3">
                                   <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2"><Layout size={14}/> Thống kê Hãng Hàng không</h3>
                                   <div className="flex gap-1">
                                        <button onClick={() => setAirlineTableLimit('top10')} className={`text-[10px] px-2 py-1 rounded border ${airlineTableLimit==='top10'?'bg-blue-50 text-blue-600 border-blue-200':'bg-white text-slate-500'}`}>Top 10</button>
                                        <button onClick={() => setAirlineTableLimit('full')} className={`text-[10px] px-2 py-1 rounded border ${airlineTableLimit==='full'?'bg-blue-50 text-blue-600 border-blue-200':'bg-white text-slate-500'}`}>Xem tất cả</button>
                                   </div>
                               </div>
                               <input 
                                   type="text" 
                                   placeholder="🔍 Lọc theo mã/tên hãng..." 
                                   value={airlineFilter}
                                   onChange={(e) => setAirlineFilter(e.target.value)}
                                   className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-blue-400 outline-none"
                               />
                           </div>
                           <div className="max-h-80 overflow-y-auto analytics-scrollable-table">
                               <table className="w-full text-xs text-left">
                                   <thead className="bg-white text-slate-500 font-bold border-b border-slate-100 sticky top-0"><tr><th className="px-6 py-3 w-16">Mã</th><th className="px-6 py-3">Tên Hãng</th><th className="px-6 py-3 text-right">Chuyến</th><th className="px-6 py-3 text-right">Khách</th><th className="px-6 py-3 text-right">OTP 15</th><th className="px-6 py-3 text-right text-red-500">Số Hủy</th><th className="px-6 py-3 text-right text-red-500">% Hủy</th><th className="px-6 py-3 text-right">Hệ số Tải</th><th className="px-6 py-3 text-right"></th></tr></thead>
                                   <tbody className="divide-y divide-slate-100">
                                       {(airlineTableLimit === 'top10' ? Object.keys(overviewData.airlineStats).sort((a,b)=>overviewData.airlineStats[b].flights-overviewData.airlineStats[a].flights).slice(0,10) : Object.keys(overviewData.airlineStats).sort((a,b)=>overviewData.airlineStats[b].flights-overviewData.airlineStats[a].flights))
                                       .filter(c => airlineFilter === '' || c.toLowerCase().includes(airlineFilter.toLowerCase()) || getAirlineName(c).toLowerCase().includes(airlineFilter.toLowerCase()))
                                       .map(c => {
                                           const s = overviewData.airlineStats[c];
                                           return <tr key={c} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-3 font-bold text-slate-800">{c}</td><td className="px-6 py-3 text-slate-500">{getAirlineName(c)}</td><td className="px-6 py-3 text-right text-slate-800">{s.flights.toLocaleString()}</td><td className="px-6 py-3 text-right text-slate-800">{s.pax.toLocaleString()}</td><td className={`px-6 py-3 text-right font-bold ${s.otp<85?'text-red-500':'text-emerald-500'}`}>{s.otp.toFixed(1)}%</td><td className="px-6 py-3 text-right text-red-600 font-bold">{s._cancel}</td><td className={`px-6 py-3 text-right font-bold ${s.cancelRate>1?'text-red-500':'text-slate-400'}`}>{s.cancelRate.toFixed(1)}%</td><td className="px-6 py-3 text-right text-slate-600 font-bold">{s.lf.toFixed(1)}%</td><td className="px-6 py-3 text-right"><button onClick={() => { setSelectedAirlineDetail(c); setAirlineDetailTab('routes'); }} className="border border-slate-200 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-[10px] transition-all">Chi tiết</button></td></tr>
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                       
                       {/* Route Table */}
                       <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                           <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                               <div className="flex justify-between items-center mb-3">
                                   <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2"><MapIcon size={14}/> Thống kê Mạng đường bay</h3>
                                   <div className="flex gap-1">
                                        <button onClick={() => setRouteTableLimit('top10')} className={`text-[10px] px-2 py-1 rounded border ${routeTableLimit==='top10'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-white text-slate-500'}`}>Top 10</button>
                                        <button onClick={() => setRouteTableLimit('full')} className={`text-[10px] px-2 py-1 rounded border ${routeTableLimit==='full'?'bg-emerald-50 text-emerald-600 border-emerald-200':'bg-white text-slate-500'}`}>Xem tất cả</button>
                                   </div>
                               </div>
                               <input 
                                   type="text" 
                                   placeholder="🔍 Lọc theo mã/tên sân bay..." 
                                   value={routeFilter}
                                   onChange={(e) => setRouteFilter(e.target.value)}
                                   className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-1 focus:ring-emerald-400 outline-none"
                               />
                           </div>
                           <div className="max-h-80 overflow-y-auto analytics-scrollable-table">
                               <table className="w-full text-xs text-left">
                                   <thead className="bg-white text-slate-500 font-bold border-b border-slate-100 sticky top-0"><tr><th className="px-6 py-3">Mã Chặng</th><th className="px-6 py-3">Tên Sân bay</th><th className="px-6 py-3 text-center">Tổng chuyến</th><th className="px-6 py-3 text-center">Đến/Đi</th><th className="px-6 py-3 text-right">Khách Đến</th><th className="px-6 py-3 text-right">Khách Đi</th><th className="px-6 py-3 text-center">Delay &gt;30p</th><th className="px-6 py-3 text-center">Hủy (SL)</th><th className="px-6 py-3 text-center">Tỷ lệ</th><th className="px-6 py-3 text-right"></th></tr></thead>
                                   <tbody className="divide-y divide-slate-100">
                                       {(routeTableLimit === 'top10' ? 
                                            Object.values(overviewData.routeStats).sort((a: RouteStat, b: RouteStat) => b.total - a.total).slice(0,10) : 
                                            Object.values(overviewData.routeStats).sort((a: RouteStat, b: RouteStat) => b.total - a.total)
                                       )
                                       .filter((s: RouteStat) => routeFilter === '' || s.code.toLowerCase().includes(routeFilter.toLowerCase()) || s.name.toLowerCase().includes(routeFilter.toLowerCase()))
                                       .map((s: RouteStat) => (
                                           <tr key={s.code} className="hover:bg-slate-50 transition-colors">
                                               <td className="px-6 py-3 font-bold font-mono text-slate-900">{s.code}</td>
                                               <td className="px-6 py-3 text-slate-500">{s.name}</td>
                                               <td className="px-6 py-3 text-center font-bold text-slate-800">{s.total.toLocaleString()}</td>
                                               <td className="px-6 py-3 text-center text-xs"><span className="text-emerald-600 font-bold">{s.arr}</span> / <span className="text-blue-600 font-bold">{s.dep}</span></td>
                                               <td className="px-6 py-3 text-right text-emerald-700">{s.arrPax.toLocaleString()}</td>
                                               <td className="px-6 py-3 text-right text-blue-700">{s.depPax.toLocaleString()}</td>
                                               <td className="px-6 py-3 text-center">{s.d30 > 0 ? <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{((s.d30/s.total)*100).toFixed(1)}%</span> : <span className="text-slate-300">-</span>}</td>
                                               <td className="px-6 py-3 text-center text-red-600 font-bold">{s.cancelled}</td>
                                               <td className="px-6 py-3 text-center">{s.cancelled > 0 ? <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{((s.cancelled/s.total)*100).toFixed(1)}%</span> : <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded text-[10px] font-bold">0.0%</span>}</td>
                                               <td className="px-6 py-3 text-right"><button onClick={() => setSelectedRouteDetail(s.code)} className="border border-slate-200 px-2 py-1 rounded hover:bg-emerald-50 hover:text-emerald-600 text-slate-600 text-[10px] transition-all">Chi tiết</button></td>
                                           </tr>
                                       ))}
                                   </tbody>
                               </table>
                           </div>
                       </div>
                   </div>
               </>
           ) : (
               // --- COMPARISON DASHBOARD ---
               <>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                       {renderKPICard('Tổng chuyến', statsA.totalFlights, statsB.totalFlights)}
                       {renderKPICard('Chuyến Đến', statsA.arrFlights, statsB.arrFlights)}
                       {renderKPICard('Chuyến Đi', statsA.depFlights, statsB.depFlights)}
                       {renderKPICard('Tổng khách', statsA.totalPax, statsB.totalPax)}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                       {renderKPICard('Hệ số tải (LF)', statsA.loadFactor, statsB.loadFactor, 'percent')}
                       {renderKPICard('Mạng đường bay (Click so sánh)', Object.keys(statsA.routeStats).length, Object.keys(statsB.routeStats).length, 'number', false, () => setShowRouteComparison(true))}
                       {renderKPICard('Hủy chuyến', statsA.cancelled, statsB.cancelled, 'number', true)}
                       {renderKPICard('Chậm >30 phút', statsA.d30, statsB.d30, 'number', true)}
                   </div>
                   <div className="flex items-center gap-4 mb-6">
                       <div className="h-px bg-slate-200 flex-1"></div>
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Biểu đồ so sánh chi tiết</span>
                       <div className="h-px bg-slate-200 flex-1"></div>
                   </div>
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                       <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                           <h3 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2"><BarChart2 size={16} className="text-blue-500"/> 📊 So sánh Sản lượng</h3>
                           <div className="flex-1 min-h-[250px]"><Bar data={volData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: {size: 10, weight: 'bold'} } } }, scales: { y: { beginAtZero: true, grid: { color: '#f8fafc' } }, x: { grid: { display: false } } } }} /></div>
                       </div>
                       <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                           <h3 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2"><PieChart size={16} className="text-purple-500"/> ⚖️ So sánh Load Factor</h3>
                           <div className="flex-1 min-h-[250px]"><Bar data={lfData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: {size: 10, weight: 'bold'} } } }, scales: { y: { min: 0, max: 100, grid: { color: '#f8fafc' } }, x: { grid: { display: false } } } }} /></div>
                       </div>
                       <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                           <h3 className="text-xs font-bold text-slate-700 mb-4 flex items-center gap-2"><List size={16} className="text-red-500"/> ⚠️ So sánh Chất lượng</h3>
                           <div className="flex-1 min-h-[250px]"><Bar data={qualityData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: {size: 10, weight: 'bold'} } } }, scales: { y: { beginAtZero: true, grid: { color: '#f8fafc' } }, x: { grid: { display: false } } } }} /></div>
                       </div>
                   </div>
               </>
           )}
           </div>
       </div>

       {/* --- MODALS (RESTORED) --- */}
       
       {selectedAircraftDetail && (
           <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                   <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
                       <h3 className="font-bold text-lg flex items-center gap-2"><PieChart size={20}/> Khai thác: {selectedAircraftDetail}</h3>
                       <button onClick={() => setSelectedAircraftDetail(null)} className="hover:text-red-300"><X size={20}/></button>
                   </div>
                   <div className="p-6">
                       <div className="h-64">
                           <Bar 
                                data={{
                                    labels: Object.keys(overviewData.aircraftByAirline[selectedAircraftDetail] || {}),
                                    datasets: [{ label: 'Số chuyến', data: Object.values(overviewData.aircraftByAirline[selectedAircraftDetail] || {}), backgroundColor: '#3b82f6', borderRadius: 4 }]
                                }}
                                options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }}
                           />
                       </div>
                   </div>
               </div>
           </div>
       )}

       {selectedAirlineDetail && (
           <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                   <div className="bg-slate-800 p-4 flex justify-between items-center text-white flex-shrink-0">
                       <h3 className="font-bold text-lg flex items-center gap-2"><span className="bg-white/10 px-2 py-0.5 rounded text-sm">{selectedAirlineDetail}</span> Chi tiết khai thác</h3>
                       <button onClick={() => setSelectedAirlineDetail(null)} className="hover:text-red-300"><X size={20}/></button>
                   </div>
                   
                   {/* Tabs */}
                   <div className="flex bg-slate-100 border-b border-slate-200">
                       <button 
                         onClick={() => setAirlineDetailTab('routes')}
                         className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${airlineDetailTab === 'routes' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                       >
                               <h3 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2"><MapIcon size={14}/> Thống kê Mạng đường bay</h3>
                           <MapIcon size={16}/> Mạng bay
                       </button>
                       <button 
                         onClick={() => setAirlineDetailTab('flights')}
                         className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${airlineDetailTab === 'flights' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-200'}`}
                       >
                           <PlaneTakeoff size={16}/> Chuyến bay
                       </button>
                   </div>

                   <div className="overflow-y-auto flex-1 p-0">
                       {airlineDetailTab === 'routes' ? (
                           <table className="w-full text-sm text-left">
                               <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0"><tr><th className="px-6 py-3">Sân bay</th><th className="px-6 py-3 text-right">Số chuyến</th><th className="px-6 py-3 text-right">Khách</th><th className="px-6 py-3 text-right">Trung bình/Chuyến</th></tr></thead>
                               <tbody className="divide-y divide-slate-100">
                                   {getAirlineRoutes(selectedAirlineDetail).map(([station, s]) => (
                                       <tr key={station} className="hover:bg-slate-50"><td className="px-6 py-3 font-bold font-mono text-slate-900">{station}</td><td className="px-6 py-3 text-right font-medium text-slate-800">{s.flights.toLocaleString()}</td><td className="px-6 py-3 text-right text-slate-800">{s.pax.toLocaleString()}</td><td className="px-6 py-3 text-right text-blue-600 font-bold">{Math.round(s.pax / s.flights)}</td></tr>
                                   ))}
                                   {getAirlineRoutes(selectedAirlineDetail).length === 0 && (<tr><td colSpan={4} className="p-8 text-center text-slate-400">Không có dữ liệu chặng bay</td></tr>)}
                               </tbody>
                           </table>
                       ) : (
                           <table className="w-full text-sm text-left">
                               <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                                   <tr>
                                       <th className="px-6 py-3 w-20">Mã</th>
                                       <th className="px-6 py-3">Chặng</th>
                                       <th className="px-6 py-3 text-right">Số chuyến</th>
                                       <th className="px-6 py-3 text-right">Tần suất/tuần</th>
                                       <th className="px-6 py-3 text-right">Tổng Khách</th>
                                       <th className="px-6 py-3 text-left w-1/3">Khung giờ bay</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                   {getAirlineFlightStats(selectedAirlineDetail).map((f) => (
                                       <tr key={f.flt} className="hover:bg-slate-50">
                                           <td className="px-6 py-3 font-bold font-mono text-blue-600">{f.flt}</td>
                                           <td className="px-6 py-3 font-medium text-slate-600">{f.dest}</td>
                                           <td className="px-6 py-3 text-right font-bold text-slate-800">{f.count}</td>
                                           <td className="px-6 py-3 text-right font-bold text-slate-700">{f.freq}</td>
                                           <td className="px-6 py-3 text-right text-slate-600">{f.pax.toLocaleString()}</td>
                                           <td className="px-6 py-3 text-xs text-slate-500 italic break-words">{f.hoursStr}</td>
                                       </tr>
                                   ))}
                                   {getAirlineFlightStats(selectedAirlineDetail).length === 0 && (<tr><td colSpan={6} className="p-8 text-center text-slate-400">Không có dữ liệu chuyến bay</td></tr>)}
                               </tbody>
                           </table>
                       )}
                   </div>
               </div>
           </div>
       )}

       {selectedRouteDetail && (
           <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
                   <div className="bg-slate-800 p-4 flex justify-between items-center text-white flex-shrink-0">
                       <h3 className="font-bold text-lg flex items-center gap-2"><List size={20}/> Thống kê chặng bay: <span className="bg-white/10 px-2 py-0.5 rounded text-sm font-mono">{selectedRouteDetail}</span></h3>
                       <button onClick={() => setSelectedRouteDetail(null)} className="hover:text-red-300"><X size={20}/></button>
                   </div>
                   <div className="overflow-y-auto flex-1 p-0">
                       <table className="w-full text-sm text-left">
                           <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0"><tr><th className="px-6 py-3 w-16">Mã Hãng</th><th className="px-6 py-3">Tên Hãng</th><th className="px-6 py-3 text-center">Tàu bay khai thác</th><th className="px-6 py-3 text-right">Số chuyến</th><th className="px-6 py-3 text-right">Thị phần</th></tr></thead>
                           <tbody className="divide-y divide-slate-100">
                               {getAirlinesByRoute(selectedRouteDetail).map(([alCode, data], i) => {
                                   const total = overviewData.routeStats[selectedRouteDetail]?.total || 1;
                                   const share = (data.flights / total) * 100;
                                   return (
                                       <tr key={i} className="hover:bg-slate-50">
                                           <td className="px-6 py-3 font-bold font-mono text-slate-900">{alCode}</td><td className="px-6 py-3 font-medium text-slate-600">{getAirlineName(alCode)}</td>
                                           <td className="px-6 py-3 text-center text-slate-500 text-xs">{Array.from(data.acTypes).map(ac => (<span key={ac} className="inline-block bg-slate-100 border border-slate-200 px-1.5 rounded mr-1 mb-1">{ac}</span>))}</td>
                                           <td className="px-6 py-3 text-right font-bold text-slate-800">{data.flights}</td>
                                           <td className="px-6 py-3 text-right"><div className="flex items-center justify-end gap-2"><span className="font-bold text-xs text-slate-600">{share.toFixed(1)}%</span><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${share}%` }}></div></div></div></td>
                                       </tr>
                                   );
                               })}
                           </tbody>
                       </table>
                   </div>
               </div>
           </div>
       )}

       {viewMode === 'infrastructure' && (
           // --- INFRASTRUCTURE ANALYTICS ---
           <InfrastructureTab 
               flights={flights}
               dateStart={new Date(rangeA.from)}
               dateEnd={new Date(rangeA.to)}
           />
       )}

       {showRouteComparison && routeComparisonData && (
           <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                   <div className="bg-slate-800 p-4 flex justify-between items-center text-white flex-shrink-0">
                       <h3 className="font-bold text-lg flex items-center gap-2">
                           <GitCompare size={20}/> So sánh Mạng đường bay
                           <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-normal ml-2">
                               {viewMode === 'compare_time' ? `Kỳ A vs Kỳ B` : `${airlineA} vs ${airlineB}`}
                           </span>
                       </h3>
                       <button onClick={() => setShowRouteComparison(false)} className="hover:text-red-300"><X size={20}/></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-0 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                       
                       {/* Column 1: Unique to A */}
                       <div className="flex flex-col">
                           <div className="p-3 bg-blue-50 border-b border-blue-100 sticky top-0 z-10">
                               <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                                   <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                   Riêng {viewMode === 'compare_time' ? 'Kỳ A' : airlineA}
                                   <span className="ml-auto bg-blue-200 text-blue-800 text-xs px-1.5 rounded-full">{routeComparisonData.uniqueA.length}</span>
                               </h4>
                           </div>
                           <div className="flex-1 overflow-y-auto">
                               <table className="w-full text-xs text-left">
                                   <tbody className="divide-y divide-slate-50">
                                       {routeComparisonData.uniqueA.map(r => (
                                           <tr key={r.code} className="hover:bg-blue-50/50">
                                               <td className="p-3 font-bold text-slate-700">{r.code}</td>
                                               <td className="p-3 text-slate-500 truncate max-w-[100px]">{r.name}</td>
                                               <td className="p-3 text-right font-bold">{r.total} chuyến</td>
                                           </tr>
                                       ))}
                                       {routeComparisonData.uniqueA.length === 0 && <tr className="text-center text-slate-400 italic"><td colSpan={3} className="p-6">Không có chặng bay riêng</td></tr>}
                                   </tbody>
                               </table>
                           </div>
                       </div>

                       {/* Column 2: Common Routes */}
                       <div className="flex flex-col bg-slate-50/50">
                           <div className="p-3 bg-purple-50 border-b border-purple-100 sticky top-0 z-10">
                               <h4 className="font-bold text-purple-800 text-sm flex items-center gap-2">
                                   <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                   Bay Chung (Cả 2)
                                   <span className="ml-auto bg-purple-200 text-purple-800 text-xs px-1.5 rounded-full">{routeComparisonData.common.length}</span>
                               </h4>
                           </div>
                           <div className="flex-1 overflow-y-auto">
                               <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-100 text-slate-500 sticky top-0">
                                        <tr><th className="p-2">Chặng</th><th className="p-2 text-center text-blue-600">A</th><th className="p-2 text-center text-red-600">B</th><th className="p-2 text-right">Diff</th></tr>
                                    </thead>
                                   <tbody className="divide-y divide-slate-100">
                                       {routeComparisonData.common.map(r => {
                                           const diff = r.valA - r.valB;
                                           return (
                                               <tr key={r.code} className="hover:bg-purple-50/50">
                                                   <td className="p-3 font-bold text-slate-700">{r.code}</td>
                                                   <td className="p-3 text-center font-bold text-blue-700">{r.valA}</td>
                                                   <td className="p-3 text-center font-bold text-red-600 opacity-70">{r.valB}</td>
                                                   <td className="p-3 text-right">
                                                       <span className={`font-bold px-1.5 py-0.5 rounded ${diff > 0 ? 'bg-emerald-100 text-emerald-700' : (diff < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500')}`}>
                                                           {diff > 0 ? '+' : ''}{diff}
                                                       </span>
                                                   </td>
                                               </tr>
                                           );
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       </div>

                       {/* Column 3: Unique to B */}
                       <div className="flex flex-col">
                           <div className="p-3 bg-red-50 border-b border-red-100 sticky top-0 z-10">
                               <h4 className="font-bold text-red-800 text-sm flex items-center gap-2">
                                   <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                   Riêng {viewMode === 'compare_time' ? 'Kỳ B' : airlineB}
                                   <span className="ml-auto bg-red-200 text-red-800 text-xs px-1.5 rounded-full">{routeComparisonData.uniqueB.length}</span>
                               </h4>
                           </div>
                           <div className="flex-1 overflow-y-auto">
                               <table className="w-full text-xs text-left">
                                   <tbody className="divide-y divide-slate-50">
                                       {routeComparisonData.uniqueB.map(r => (
                                           <tr key={r.code} className="hover:bg-red-50/50">
                                               <td className="p-3 font-bold text-slate-700">{r.code}</td>
                                               <td className="p-3 text-slate-500 truncate max-w-[100px]">{r.name}</td>
                                               <td className="p-3 text-right font-bold">{r.total} chuyến</td>
                                           </tr>
                                       ))}
                                       {routeComparisonData.uniqueB.length === 0 && <tr className="text-center text-slate-400 italic"><td colSpan={3} className="p-6">Không có chặng bay riêng</td></tr>}
                                   </tbody>
                               </table>
                           </div>
                       </div>

                   </div>
               </div>
           </div>
       )}

    </div>
  );
};

export default Analytics;
