/**
 * Import Data Service
 * Handles smart upsert logic for Excel and CSV imports
 * Applies composite key matching and Option B logic
 * Supports time range filtering and selective column updates
 */

import { SupabaseClient } from '@supabase/supabase-js';

interface UpsertOptions {
  supabase: SupabaseClient;
  tableName: string;
  data: any[];
  compositeKeyFields: {
    arrivalKey?: { flightField: string; dateField: string };
    departureKey?: { flightField: string; dateField: string };
  };
  timeRangeFrom?: Date;
  timeRangeTo?: Date;
  selectedColumns?: string[];
  importMode?: 'upsert' | 'insert' | 'update';
  onProgress?: (processed: number, inserted: number, updated: number, failed: number) => void;
}

interface UpsertResult {
  success: boolean;
  totalRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  failedRecords: number;
  message: string;
  errors?: Array<{ index: number; error: string }>;
}

/**
 * Apply Option B logic: nullify missing field types
 * If arrival fields present but departure not → set departure = NULL
 * If departure fields present but arrival not → set arrival = NULL
 * 
 * CRITICAL: Determine data type by flight number, not status fields
 * because status fields always get default values.
 */
function applyOptionBLogic(
  record: any,
  arrivalFields: Set<string>,
  departureFields: Set<string>
): any {
  const result = { ...record };
  
  // Check if arrival data exists - based on arr_flight field
  // (not status, since status always has default value)
  const hasArrivalData = result['arr_flight'] !== undefined && result['arr_flight'] !== null;
  
  // Check if departure data exists - based on dep_flight field  
  // (not status, since status always has default value)
  const hasDepartureData = result['dep_flight'] !== undefined && result['dep_flight'] !== null;
  
  // Apply Option B: nullify missing types
  if (!hasArrivalData) {
    arrivalFields.forEach(field => {
      result[field] = null;
    });
  }
  
  if (!hasDepartureData) {
    departureFields.forEach(field => {
      result[field] = null;
    });
  }
  
  return result;
}

/**
 * Extract date from datetime field
 */
function extractDate(dateTime: any): string | null {
  if (!dateTime) return null;
  
  try {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) return null;
    
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

/**
 * Convert local datetime string to UTC representation for database queries
 * Input: "2026-02-11T05:00" (local time, e.g., UTC+7 timezone)
 * Output: "2026-02-10T22:00:00" (UTC equivalent - what gets stored in database)
 * 
 * Data in database is stored as UTC equivalent (to avoid +7 hour shift when displaying)
 * So when querying, we must convert local input to UTC equivalent to match database values
 */
function localClockToUTCISOString(s: string | null): string | null {
  if (!s) return null;
  const normalized = s.replace(' ', 'T');
  const re = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
  const m = normalized.match(re);
  if (!m) return normalized;
  
  // Parse input as local time
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const second = m[6] ? parseInt(m[6], 10) : 0;
  
  // Create Date with local constructor (represents the local time)
  const dt = new Date(year, month, day, hour, minute, second);
  
  // Convert to UTC representation (what gets stored in database)
  const utcYear = dt.getUTCFullYear();
  const utcMonth = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const utcDay = String(dt.getUTCDate()).padStart(2, '0');
  const utcHour = String(dt.getUTCHours()).padStart(2, '0');
  const utcMinute = String(dt.getUTCMinutes()).padStart(2, '0');
  const utcSecond = String(dt.getUTCSeconds()).padStart(2, '0');
  
  // Return in database format with space (not T) for Supabase .or() query
  return `${utcYear}-${utcMonth}-${utcDay} ${utcHour}:${utcMinute}:${utcSecond}`;
}

/**
 * Check if a date/time falls within a time range
 */
export function isDateInRange(
  recordDate: Date | null,
  fromDate: Date | undefined,
  toDate: Date | undefined
): boolean {
  if (!recordDate || !fromDate || !toDate) return true;
  return recordDate >= fromDate && recordDate <= toDate;
}

/**
 * Apply selective column update - keep only selected columns
 */
export function filterBySelectedColumns(
  record: any,
  selectedColumns: string[] | undefined,
  columnMapping?: Record<string, string>
): any {
  if (!selectedColumns || selectedColumns.length === 0) {
    return record; // Update all columns if none selected
  }

  const filtered: any = {};
  const selectedSet = new Set(selectedColumns);

  // Default column mapping - Excel field names to DB column names
  const mapping = columnMapping || {
    'arrFlt': 'arr_flight',
    'depFlt': 'dep_flight',
    'sta': 'sta',
    'ata': 'ata',
    'std': 'std',
    'atd': 'atd',
    'depGate': 'gate',
    'arrBelt': 'carousel',
    'arrStand': 'arr_stand',
    'depStand': 'dep_stand',
    'gate': 'gate',
    'depSts': 'dep_status',
    'arrSts': 'arr_status',
    'arrPax': 'arr_pax',
    'depPax': 'dep_pax',
    'from': 'flight_from',
    'to': 'flight_to',
    'acType': 'ac_type',
    'counters': 'counters',
  };

  // Copy only selected columns
  for (const colKey of selectedSet) {
    const dbField = mapping[colKey];
    if (dbField && record[dbField] !== undefined) {
      filtered[dbField] = record[dbField];
    }
  }

  return filtered;
}

/**
 * Delete records in time range from database
 * Parameters accept local datetime strings: "2025-01-15T14:30"
 * These are converted to UTC ISO strings for database queries
 */
export async function deleteRecordsInTimeRange(
  supabase: SupabaseClient,
  tableName: string,
  fromDateString: string,
  toDateString: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    console.log(`[Delete] Time range (local): ${fromDateString} -> ${toDateString}`);

    // Call RPC function with local times (no timezone conversion needed)
    const { data, error } = await supabase.rpc('delete_flights_in_range', {
      p_from_local: fromDateString,
      p_to_local: toDateString
    });

    if (error) {
      console.error(`[Delete] RPC error:`, error);
      throw error;
    }

    // Check if RPC function returned success
    if (!data || !data[0]?.success) {
      const errorMsg = data?.[0]?.error_message || 'Unknown error from delete function';
      console.error(`[Delete] RPC returned error:`, errorMsg);
      throw new Error(errorMsg);
    }

    const deletedCount = data[0].deleted_count || 0;
    console.log(`[Delete] SUCCESS: Deleted ${deletedCount} records total`);
    
    return { success: true, deletedCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Delete] FAILED:`, errorMsg);
    return {
      success: false,
      deletedCount: 0,
      error: errorMsg,
    };
  }
}

/**
 * Smart Upsert: Match by composite key and update or insert
 */
export async function smartUpsertData(options: UpsertOptions): Promise<UpsertResult> {
  const {
    supabase,
    tableName,
    data,
    compositeKeyFields,
    importMode = 'upsert',
    onProgress,
  } = options;

  console.log(`[Upsert] Starting ${importMode} mode with ${data.length} records`);

  // Define arrival and departure columns
  const arrivalFields = new Set([
    'arr_flight', 'sta', 'ata', 'arr_status', 'carousel', 'arr_stand'
  ]);
  
  const departureFields = new Set([
    'dep_flight', 'std', 'atd', 'dep_status', 'gate', 'dep_stand'
  ]);

  let insertedRecords = 0;
  let updatedRecords = 0;
  let failedRecords = 0;
  const errors: Array<{ index: number; error: string }> = [];

  // Process each record
  for (let i = 0; i < data.length; i++) {
    try {
      let record = { ...data[i] };
      
      // DEBUG: Log first few records
      if (i < 3) {
        console.log(`[Upsert] Record ${i} raw:`, record);
      }
      
      // Apply Option B logic
      record = applyOptionBLogic(record, arrivalFields, departureFields);
      
      if (i < 3) {
        console.log(`[Upsert] Record ${i} after Option B:`, record);
      }

      // Skip records outside time range if configured
      if (options.timeRangeFrom && options.timeRangeTo) {
        // Get record date - try sta first, then std
        let recordDate: Date | null = null;
        if (record[compositeKeyFields.arrivalKey?.dateField || 'sta']) {
          recordDate = new Date(record[compositeKeyFields.arrivalKey?.dateField || 'sta']);
        } else if (record[compositeKeyFields.departureKey?.dateField || 'std']) {
          recordDate = new Date(record[compositeKeyFields.departureKey?.dateField || 'std']);
        }

        if (i < 3) {
          console.log(`[Upsert] Record ${i} date check:`, { recordDate, from: options.timeRangeFrom, to: options.timeRangeTo, inRange: isDateInRange(recordDate, options.timeRangeFrom, options.timeRangeTo) });
        }

        if (!isDateInRange(recordDate, options.timeRangeFrom, options.timeRangeTo)) {
          continue; // Skip this record - outside time range
        }
      }

      // Try to find existing record by composite key
      let existingRecord = null;

      // Match by arrival key if available
      if (compositeKeyFields.arrivalKey && record[compositeKeyFields.arrivalKey.flightField]) {
        const arrivalDate = extractDate(record[compositeKeyFields.arrivalKey.dateField]);
        
        if (arrivalDate) {
          try {
            const { data: existing, error: queryError } = await supabase
              .from(tableName)
              .select('id, counters')
              .eq(compositeKeyFields.arrivalKey.flightField, record[compositeKeyFields.arrivalKey.flightField])
              .gte(compositeKeyFields.arrivalKey.dateField, `${arrivalDate}T00:00:00`)
              .lte(compositeKeyFields.arrivalKey.dateField, `${arrivalDate}T23:59:59`)
              .limit(1);
            
            if (queryError && queryError.code !== 'PGRST116') {
              throw queryError;
            }

            if (existing && existing.length > 0) {
              existingRecord = existing[0];
              if (i < 3) console.log(`[Upsert] Record ${i} matched by arrival key`);
            }
          } catch (e) {
            if (i < 3) console.error(`[Upsert] Record ${i} arrival match error:`, e);
          }
        }
      }

      // Match by departure key if no arrival match
      if (!existingRecord && compositeKeyFields.departureKey && record[compositeKeyFields.departureKey.flightField]) {
        const departureDate = extractDate(record[compositeKeyFields.departureKey.dateField]);
        
        if (departureDate) {
          try {
            const { data: existing, error: queryError } = await supabase
              .from(tableName)
              .select('id, counters')
              .eq(compositeKeyFields.departureKey.flightField, record[compositeKeyFields.departureKey.flightField])
              .gte(compositeKeyFields.departureKey.dateField, `${departureDate}T00:00:00`)
              .lte(compositeKeyFields.departureKey.dateField, `${departureDate}T23:59:59`)
              .limit(1);
            
            if (queryError && queryError.code !== 'PGRST116') {
              throw queryError;
            }

            if (existing && existing.length > 0) {
              existingRecord = existing[0];
              if (i < 3) console.log(`[Upsert] Record ${i} matched by departure key`);
            }
          } catch (e) {
            if (i < 3) console.error(`[Upsert] Record ${i} departure match error:`, e);
          }
        }
      }

      // Update or insert based on import mode
      if (existingRecord) {
        // Skip update if insert-only mode
        if (importMode === 'insert') {
          continue; // Skip updates in insert-only mode
        }

        // Apply selective column update if configured
        let updateData = record;
        if (options.selectedColumns && options.selectedColumns.length > 0) {
          updateData = filterBySelectedColumns(record, options.selectedColumns);
        }

        // If incoming counters exist but existing record has NULL counters,
        // include counters in the update so we don't leave them NULL.
        try {
          const existingCounters = existingRecord && (existingRecord as any).counters;
          if ((record.counters !== undefined && record.counters !== null) && (existingCounters === undefined || existingCounters === null)) {
            updateData = { ...updateData, counters: record.counters };
          }
        } catch (e) {
          // ignore and proceed with updateData as-is
        }

        // Update existing record
        const { error } = await supabase
          .from(tableName)
          .update(updateData)
          .eq('id', existingRecord.id);

        if (error) {
          failedRecords++;
          console.error(`[Upsert] Record ${i} update failed:`, error.message);
          errors.push({ index: i, error: error.message });
        } else {
          updatedRecords++;
        }
      } else {
        // Skip insert if update-only mode
        if (importMode === 'update') {
          continue; // Skip inserts in update-only mode
        }

        if (i < 3) {
          console.log(`[Upsert] Record ${i} - no existing record, inserting...`);
        }

        // Insert new record
        const { error } = await supabase
          .from(tableName)
          .insert([record]);

        if (error) {
          failedRecords++;
          console.error(`[Upsert] Record ${i} insert failed:`, error.message, 'Data:', record);
          errors.push({ index: i, error: error.message });
        } else {
          insertedRecords++;
          if (i < 3) {
            console.log(`[Upsert] Record ${i} inserted successfully`);
          }
        }
      }
    } catch (error) {
      failedRecords++;
      console.error(`[Upsert] Record ${i} exception:`, error);
      errors.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Call progress callback every record
    if (onProgress) {
      onProgress(i + 1, insertedRecords, updatedRecords, failedRecords);
    }
  }

  const success = failedRecords === 0;

  console.log(`[Upsert] Complete: ${insertedRecords} inserted, ${updatedRecords} updated, ${failedRecords} failed`);

  return {
    success,
    totalRecords: data.length,
    insertedRecords,
    updatedRecords,
    failedRecords,
    message: success
      ? `Import successful: ${insertedRecords} inserted, ${updatedRecords} updated`
      : `Import completed with errors: ${insertedRecords} inserted, ${updatedRecords} updated, ${failedRecords} failed`,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Helper: Transform imported data to match database schema
 * Handles field name normalization
 */
export function normalizeImportedData(
  rawData: any[],
  fieldMapping: Record<string, string>
): any[] {
  return rawData.map(record => {
    const normalized: any = {};
    
    for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
      if (record[sourceField] !== undefined && record[sourceField] !== null) {
        normalized[targetField] = record[sourceField];
      }
    }
    
    return normalized;
  });
}

/**
 * Helper: Get composite key configuration for flight_schedule table
 */
export function getFlightScheduleUpsertConfig() {
  return {
    tableName: 'flight_schedule',
    compositeKeyFields: {
      arrivalKey: {
        flightField: 'arr_flight',
        dateField: 'sta',
      },
      departureKey: {
        flightField: 'dep_flight',
        dateField: 'std',
      },
    },
  };
}
