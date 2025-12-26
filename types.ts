
export interface CheckinData {
  ctr: string;
  start: Date;
  end: Date;
}

export interface CheckinCounterRecord {
  ctr: string;      // "01", "02", "M01", etc
  start: string;    // ISO 8601 UTC: "2025-01-01T14:15:00Z"
  end: string;      // ISO 8601 UTC: "2025-01-01T15:30:00Z"
}

export interface Flight {
  recordId?: string; // Supabase UUID
  id: string; // Flight Number (Display ID)
  gate: string;
  target: Date; // The operative date (STD or ETD)
  isEtd: boolean; // True if using ETD
  acType: string;
  acCode: string; // C, E, F category
  checkinData: CheckinData[];
  
  // Computed for Gantt
  gStart?: Date;
  gEnd?: Date;
  conflict?: boolean;
  
  // Raw Data fields (for analytics)
  arrFlt?: string;
  depFlt?: string;
  arrSts?: string;
  depSts?: string;
  sta?: Date | null;
  ata?: Date | null;
  std?: Date | null;
  atd?: Date | null;
  arrPax?: number;
  depPax?: number;
  from?: string;
  to?: string;
  cap?: number;
  alCode?: string;
  date?: Date;
  
  // Infrastructure fields (Gate/Stand/Belt)
  depGate?: string;      // Departure gate
  arrStand?: string;     // Arrival stand
  depStand?: string;     // Departure stand
  carousel?: string;     // Baggage carousel / Belt
  counters?: string[];   // Check-in counters (array or string like "01,02,03")
  
  // Computed infrastructure metrics
  gateStart?: Date;      // When aircraft at gate (arrival: ata, departure: std)
  gateEnd?: Date;        // When aircraft left gate (atd)
  gateUtilizationMin?: number;  // Gate occupancy in minutes
  standUtilizationMin?: number; // Stand occupancy in minutes
  turnaroundMin?: number;       // Gap to next flight at same stand
  carouselThroughput?: number;  // Passengers per hour (for arrival belt)
}

export interface AcDbEntry {
  [key: string]: number;
}

export type ViewMode = 'single' | 'comp-time' | 'comp-airline';

export const AC_CODE_MAP: Record<string, string> = {
  '32Q': 'C', '321': 'C', '32N': 'C', '320': 'C', '738': 'C', '7M8': 'C', 
  'AT7': 'C', '319': 'C', 'E90': 'C', '7M9': 'C', '739': 'C',
  '333': 'E', '789': 'E', '788': 'E', '772': 'E', '781': 'E', '339': 'E', 
  '359': 'E', '77W': 'E', '330': 'E', '332': 'E', '773': 'E',
  '763': 'D', '380': 'F', '747': 'F'
};

export const AIRLINE_MAP: Record<string, string> = {
'EK' : 'Emirates', 'YP' : 'Air Premia', 'BR' : 'Eva Air', 'PR' : 'Philippine Airlines', 'OD' : 'Batik Air', 'JX' : 'Starlux Airlines', 'VN' : 'Vietnam Airlines', 
'KE' : 'Korean Air', 'SQ' : 'Singapore Airlines', 'TW' : 'Tway Air', 'CI' : 'China Airlines', 'OZ' : 'Asiana Airlines', '5J' : 'Cebu Pacific', 'VJ' : 'Vietjet Air', 
'VZ' : 'Thai Vietjet Air', 'LJ' : 'Jin Air', 'AK' : 'Air Asia', 'FD' : 'Thai Air Asia', 'ZE' : 'Eastar Jet', 'HX' : 'Hongkong Airlines', '7C' : 'Jeju Air', 'RS' : 'Air Seoul', 
'BX' : 'Air Busan', 'MH' : 'Malaysia Airlines', 'QH' : 'Bamboo Airways', 'RF' : 'Aero-K Airlines', 'NX' : 'Air Macau', 'UO' : 'Hong Kong Express', 'K6' : 'Cambodia Angkor Air', 
'KC' : 'Air Astana', 'IT' : 'Tigerair', 'HH' : 'Qanot Sharq', 'DV' : 'SCAT Airlines', 'C6' : 'Centrum air', '8M' : 'Myanmar Airways', 'TR' : 'Scoot', 'Z2' : 'Philippines AirAsia', 
'HO' : 'Juneyao Airlines', 'DD' : 'Nok Air', 'WE' : 'Parata Air'
};

export const AIRPORT_NAMES: Record<string, string> = {
  'HAN':'Nội Bài','SGN':'Tân Sơn Nhất','DAD':'Đà Nẵng','CXR':'Cam Ranh','PQC':'Phú Quốc',
  'ICN':'Seoul','PUS':'Busan','BKK':'Bangkok','SIN':'Singapore','TPE':'Taipei','HKG':'Hong Kong','NRT':'Narita'
};
