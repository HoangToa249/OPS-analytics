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
 */
function applyOptionBLogic(
  record: any,
  arrivalFields: Set<string>,
  departureFields: Set<string>
): any {
  const result = { ...record };
  
  // Check if arrival data exists
  const hasArrivalData = Array.from(arrivalFields).some(
    field => result[field] !== undefined && result[field] !== null
  );
  
  // Check if departure data exists
  const hasDepartureData = Array.from(departureFields).some(
    field => result[field] !== undefined && result[field] !== null
  );
  
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
 */
export async function deleteRecordsInTimeRange(
  supabase: SupabaseClient,
  tableName: string,
  fromDate: Date,
  toDate: Date
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const fromISO = fromDate.toISOString();
    const toISO = toDate.toISOString();

    console.log(`[Delete] Finding records between ${fromISO} and ${toISO}`);

    // Find records to delete - where sta or std falls within range
    // Use two separate queries to avoid complex OR syntax issues
    const { data: recordsWithSta, error: staError } = await supabase
      .from(tableName)
      .select('id')
      .gte('sta', fromISO)
      .lte('sta', toISO);

    if (staError) throw staError;

    const { data: recordsWithStd, error: stdError } = await supabase
      .from(tableName)
      .select('id')
      .gte('std', fromISO)
      .lte('std', toISO);

    if (stdError) throw stdError;

    // Merge and deduplicate
    const allIds = new Set<string>();
    recordsWithSta?.forEach(r => allIds.add(r.id));
    recordsWithStd?.forEach(r => allIds.add(r.id));

    console.log(`[Delete] Found ${allIds.size} records to delete (sta: ${recordsWithSta?.length || 0}, std: ${recordsWithStd?.length || 0})`);

    if (allIds.size === 0) {
      return { success: true, deletedCount: 0 };
    }

    const idsToDelete = Array.from(allIds);

    // Delete in batches to avoid hitting request size limit
    const BATCH_SIZE = 50; // Reduce from 100 to 50 for safety
    let totalDeleted = 0;

    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = idsToDelete.slice(i, i + BATCH_SIZE);
      console.log(`[Delete] Batch ${Math.floor(i / BATCH_SIZE) + 1}: Deleting ${batch.length} records...`);
      
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`[Delete] Batch error:`, deleteError);
        throw deleteError;
      }
      totalDeleted += batch.length;
      console.log(`[Delete] Batch complete. Total deleted so far: ${totalDeleted}`);
    }

    console.log(`[Delete] SUCCESS: Deleted ${totalDeleted} records total`);
    return { success: true, deletedCount: totalDeleted };
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
      
      // Apply Option B logic
      record = applyOptionBLogic(record, arrivalFields, departureFields);

      // Skip records outside time range if configured
      if (options.timeRangeFrom && options.timeRangeTo) {
        // Get record date - try sta first, then std
        let recordDate: Date | null = null;
        if (record[compositeKeyFields.arrivalKey?.dateField || 'sta']) {
          recordDate = new Date(record[compositeKeyFields.arrivalKey?.dateField || 'sta']);
        } else if (record[compositeKeyFields.departureKey?.dateField || 'std']) {
          recordDate = new Date(record[compositeKeyFields.departureKey?.dateField || 'std']);
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
          const { data: existing } = await supabase
            .from(tableName)
            .select('id')
            .eq(compositeKeyFields.arrivalKey.flightField, record[compositeKeyFields.arrivalKey.flightField])
            .gte(compositeKeyFields.arrivalKey.dateField, `${arrivalDate}T00:00:00`)
            .lte(compositeKeyFields.arrivalKey.dateField, `${arrivalDate}T23:59:59`)
            .limit(1)
            .single();

          if (existing) {
            existingRecord = existing;
          }
        }
      }

      // Match by departure key if no arrival match
      if (!existingRecord && compositeKeyFields.departureKey && record[compositeKeyFields.departureKey.flightField]) {
        const departureDate = extractDate(record[compositeKeyFields.departureKey.dateField]);
        
        if (departureDate) {
          const { data: existing } = await supabase
            .from(tableName)
            .select('id')
            .eq(compositeKeyFields.departureKey.flightField, record[compositeKeyFields.departureKey.flightField])
            .gte(compositeKeyFields.departureKey.dateField, `${departureDate}T00:00:00`)
            .lte(compositeKeyFields.departureKey.dateField, `${departureDate}T23:59:59`)
            .limit(1)
            .single();

          if (existing) {
            existingRecord = existing;
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
