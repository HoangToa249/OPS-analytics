/**
 * Flight Data Service
 * Handles fetching and processing flight data from Supabase with pagination
 */

import { supabase } from '../supabaseClient';
import { Flight } from '../types';
import { parseDbDate } from './dateUtils';

export interface FlightDataFilter {
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string; // "HH:mm"
  timeTo?: string; // "HH:mm"
  airlines?: string[];
  gates?: string[];
  statuses?: string[];
  searchTerm?: string;
  flightType?: 'all' | 'departure' | 'arrival';
  columnFilters?: Record<string, any>; // Dynamic filters per column
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface FlightDataResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Helper: Convert local datetime input to UTC ISO string
 * Example: "2025-01-01T09:40" -> "2025-01-01T09:40:00.000Z"
 */
const localClockToUTCISOString = (s: string | null): string | null => {
  if (!s) return null;
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

/**
 * Fetch flight data with pagination
 */
export const fetchFlightData = async (
  filters: FlightDataFilter,
  pagination: PaginationOptions
): Promise<FlightDataResult> => {
  try {
    const { pageSize, page } = pagination;
    const offset = (page - 1) * pageSize;

    // Determine which table to use
    let query = supabase
      .from('flight_schedule')
      .select('*', { count: 'exact' });

    // Apply date/time filters (server-side, using STD column)
    if (filters.dateFrom) {
      const dateFromUTC = localClockToUTCISOString(
        filters.timeFrom 
          ? `${filters.dateFrom}T${filters.timeFrom}` 
          : `${filters.dateFrom}T00:00`
      );
      if (dateFromUTC) {
        query = query.gte('std', dateFromUTC);
      }
    }

    if (filters.dateTo) {
      const dateToUTC = localClockToUTCISOString(
        filters.timeTo 
          ? `${filters.dateTo}T${filters.timeTo}` 
          : `${filters.dateTo}T23:59`
      );
      if (dateToUTC) {
        query = query.lte('std', dateToUTC);
      }
    }

    // Apply airline filters
    if (filters.airlines && filters.airlines.length > 0) {
      // Get first 2 chars of flight for airline code
      const airlineConditions = filters.airlines.map(
        (airline) =>
          `dep_flight.like.${airline}%,arr_flight.like.${airline}%`
      );
      query = query.or(airlineConditions.join(','));
    }

    // Apply gate filters
    if (filters.gates && filters.gates.length > 0) {
      query = query.in('gate', filters.gates);
    }

    // Apply status filters
    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }

    // Apply pagination
    query = query.order('std', { ascending: false }).range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[FlightDataService] Query error:', error);
      throw error;
    }

    let results = data || [];

    // Search filter
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(
        (row: any) =>
          (row.dep_flight && row.dep_flight.toLowerCase().includes(term)) ||
          (row.arr_flight && row.arr_flight.toLowerCase().includes(term)) ||
          (row.gate && row.gate.toLowerCase().includes(term))
      );
    }

    // Dynamic column filters
    if (filters.columnFilters && Object.keys(filters.columnFilters).length > 0) {
      results = results.filter((row: any) => {
        return Object.entries(filters.columnFilters!).every(([column, filterValue]) => {
          const cellValue = row[column];
          if (!filterValue) return true;

          const filterStr = String(filterValue).toLowerCase();
          const cellStr = cellValue !== null && cellValue !== undefined 
            ? String(cellValue).toLowerCase() 
            : '';

          return cellStr.includes(filterStr);
        });
      });
    }

    const total = count || 0;
    const hasMore = offset + pageSize < total;

    return {
      data: results,
      total,
      page,
      pageSize,
      hasMore,
    };
  } catch (error) {
    console.error('[FlightDataService] Error fetching data:', error);
    // Fallback to flights table if flight_schedule fails
    try {
      const { pageSize, page } = pagination;
      const offset = (page - 1) * pageSize;

      let query = supabase
        .from('flights')
        .select('*', { count: 'exact' });

      query = query.order('std', { ascending: false }).range(offset, offset + pageSize - 1);

      const { data, error: fallbackError, count } = await query;

      if (fallbackError) throw fallbackError;

      let results = data || [];

      // Client-side date and time filtering
      if (filters.dateFrom || filters.dateTo) {
        results = results.filter((row: any) => {
          const dateStr = row.std || row.eted || '';
          if (!dateStr) return false;

          const rowDate = parseDbDate(dateStr);
          if (!rowDate || isNaN(rowDate.getTime())) return false;

          const rowDateStr = rowDate.toISOString().slice(0, 10);
          const rowTimeStr = rowDate.toISOString().slice(11, 16);

          if (filters.dateFrom) {
            if (rowDateStr < filters.dateFrom) return false;
            if (rowDateStr === filters.dateFrom && filters.timeFrom) {
              if (rowTimeStr < filters.timeFrom) return false;
            }
          }

          if (filters.dateTo) {
            if (rowDateStr > filters.dateTo) return false;
            if (rowDateStr === filters.dateTo && filters.timeTo) {
              if (rowTimeStr > filters.timeTo) return false;
            }
          }

          return true;
        });
      }

      if (filters.searchTerm && filters.searchTerm.trim() !== '') {
        const term = filters.searchTerm.toLowerCase();
        results = results.filter(
          (row: any) =>
            (row.dep_flight && row.dep_flight.toLowerCase().includes(term)) ||
            (row.arr_flight && row.arr_flight.toLowerCase().includes(term))
        );
      }

      const total = results.length; // Use filtered results length
      const hasMore = false;

      return {
        data: results,
        total,
        page,
        pageSize,
        hasMore,
      };
    } catch (fallbackError) {
      console.error('[FlightDataService] Fallback error:', fallbackError);
      throw fallbackError;
    }
  }
};

/**
 * Get all unique airlines from database (for filter dropdown)
 */
export const fetchUniqueAirlines = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('flight_schedule')
      .select('dep_flight, arr_flight');

    if (error) throw error;

    const airlines = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.dep_flight) {
        airlines.add(row.dep_flight.substring(0, 2));
      }
      if (row.arr_flight) {
        airlines.add(row.arr_flight.substring(0, 2));
      }
    });

    return Array.from(airlines).sort();
  } catch (error) {
    console.error('[FlightDataService] Error fetching airlines:', error);
    return [];
  }
};

/**
 * Get all unique gates from database (for filter dropdown)
 */
export const fetchUniqueGates = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('flight_schedule')
      .select('gate')
      .not('gate', 'is', null);

    if (error) throw error;

    const gates = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.gate) {
        gates.add(row.gate);
      }
    });

    return Array.from(gates).sort();
  } catch (error) {
    console.error('[FlightDataService] Error fetching gates:', error);
    return [];
  }
};

/**
 * Get all unique statuses from database (for filter dropdown)
 */
export const fetchUniqueStatuses = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('flight_schedule')
      .select('status')
      .not('status', 'is', null);

    if (error) throw error;

    const statuses = new Set<string>();
    (data || []).forEach((row: any) => {
      if (row.status) {
        statuses.add(row.status);
      }
    });

    return Array.from(statuses).sort();
  } catch (error) {
    console.error('[FlightDataService] Error fetching statuses:', error);
    return [];
  }
};

/**
 * Get all data for export (respects filters but ignores pagination)
 */
export const fetchAllFlightDataForExport = async (
  filters: FlightDataFilter
): Promise<any[]> => {
  try {
    let query = supabase.from('flight_schedule').select('*');

    // Apply date/time filters (server-side, using STD column)
    if (filters.dateFrom) {
      const dateFromUTC = localClockToUTCISOString(
        filters.timeFrom 
          ? `${filters.dateFrom}T${filters.timeFrom}` 
          : `${filters.dateFrom}T00:00`
      );
      if (dateFromUTC) {
        query = query.gte('std', dateFromUTC);
      }
    }

    if (filters.dateTo) {
      const dateToUTC = localClockToUTCISOString(
        filters.timeTo 
          ? `${filters.dateTo}T${filters.timeTo}` 
          : `${filters.dateTo}T23:59`
      );
      if (dateToUTC) {
        query = query.lte('std', dateToUTC);
      }
    }

    if (filters.airlines && filters.airlines.length > 0) {
      const airlineConditions = filters.airlines.map(
        (airline) =>
          `dep_flight.like.${airline}%,arr_flight.like.${airline}%`
      );
      query = query.or(airlineConditions.join(','));
    }

    if (filters.gates && filters.gates.length > 0) {
      query = query.in('gate', filters.gates);
    }

    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }

    query = query.order('std', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    let results = data || [];

    // Search filter
    if (filters.searchTerm && filters.searchTerm.trim() !== '') {
      const term = filters.searchTerm.toLowerCase();
      results = results.filter(
        (row: any) =>
          (row.dep_flight && row.dep_flight.toLowerCase().includes(term)) ||
          (row.arr_flight && row.arr_flight.toLowerCase().includes(term)) ||
          (row.gate && row.gate.toLowerCase().includes(term))
      );
    }

    // Dynamic column filters
    if (filters.columnFilters && Object.keys(filters.columnFilters).length > 0) {
      results = results.filter((row: any) => {
        return Object.entries(filters.columnFilters!).every(([column, filterValue]) => {
          const cellValue = row[column];
          if (!filterValue) return true;

          const filterStr = String(filterValue).toLowerCase();
          const cellStr = cellValue !== null && cellValue !== undefined 
            ? String(cellValue).toLowerCase() 
            : '';

          return cellStr.includes(filterStr);
        });
      });
    }

    return results;
  } catch (error) {
    console.error('[FlightDataService] Error fetching all data for export:', error);
    return [];
  }
};
