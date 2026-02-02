import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as mysql from "https://deno.land/x/mysql@v2.12.0/mod.ts";

// Types
interface SyncRequest {
  mode?: "test-connection" | "sync";
  type: "mysql" | "mssql";
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  query?: string;
  fieldMapping?: Array<{
    externalColumn: string;
    supabaseColumn: string;
  }>;
}

interface SyncResponse {
  success: boolean;
  message: string;
  data?: {
    totalRecords: number;
    syncedRecords: number;
    failedRecords: number;
    duration: number;
  };
  error?: string;
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Test connection to external database
 */
async function testConnection(req: SyncRequest): Promise<SyncResponse> {
  try {
    console.log(`[EdgeFunction] Testing connection to ${req.type}:${req.host}`);

    if (req.type === "mysql") {
      const connection = await mysql.connect({
        hostname: req.host,
        username: req.username,
        password: req.password,
        db: req.database,
        port: req.port,
      });

      await connection.close();
      
      return {
        success: true,
        message: "Connection successful!",
      };
    } else if (req.type === "mssql") {
      return {
        success: false,
        message: "MSSQL connection test requires backend service",
      };
    }

    return {
      success: false,
      message: "Unknown database type",
    };
  } catch (error) {
    console.error(`[EdgeFunction] Connection test failed:`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/**
 * Sync data from external MySQL/MSSQL to Supabase
 */
async function syncExternalDatabase(req: SyncRequest): Promise<SyncResponse> {
  const startTime = Date.now();

  try {
    console.log(`[EdgeFunction] Starting sync from ${req.type}:${req.host}`);

    // Step 1: Connect to external database
    let externalData: any[] = [];

    if (req.type === "mysql") {
      externalData = await syncFromMySQL(req);
    } else if (req.type === "mssql") {
      externalData = await syncFromMSSQL(req);
    }

    console.log(`[EdgeFunction] Fetched ${externalData.length} records`);

    // Step 2: Transform data using field mapping
    const transformedData = transformData(externalData, req.fieldMapping);
    console.log(`[EdgeFunction] Transformed ${transformedData.length} records`);

    // Step 3: Smart upsert with composite key matching
    const batchSize = 100;
    let syncedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < transformedData.length; i += batchSize) {
      const batch = transformedData.slice(i, i + batchSize);

      try {
        // For each record, find existing record with matching key and merge
        for (const newRecord of batch) {
          try {
            let matchingRecord: any = null;

            // Try to find matching arrival record
            if (newRecord._arrival_key) {
              const arrDate = newRecord.sta ? new Date(newRecord.sta).toISOString().split('T')[0] : null;
              const { data: existingArr } = await supabase
                .from("flight_schedule")
                .select("id")
                .eq("arr_flt", newRecord.arr_flt)
                .gte("sta", `${arrDate}T00:00:00`)
                .lte("sta", `${arrDate}T23:59:59`)
                .limit(1)
                .single();

              if (existingArr) {
                matchingRecord = existingArr;
              }
            }

            // Try to find matching departure record if no arrival match
            if (!matchingRecord && newRecord._departure_key) {
              const depDate = newRecord.std ? new Date(newRecord.std).toISOString().split('T')[0] : null;
              const { data: existingDep } = await supabase
                .from("flight_schedule")
                .select("id")
                .eq("flight", newRecord.flight)
                .gte("std", `${depDate}T00:00:00`)
                .lte("std", `${depDate}T23:59:59`)
                .limit(1)
                .single();

              if (existingDep) {
                matchingRecord = existingDep;
              }
            }

            // Remove helper keys before saving
            delete newRecord._arrival_key;
            delete newRecord._departure_key;

            if (matchingRecord) {
              // Update existing record with new data (Option B logic)
              const { error } = await supabase
                .from("flight_schedule")
                .update(newRecord)
                .eq("id", matchingRecord.id);

              if (error) {
                console.error(`[EdgeFunction] Update error for record:`, error);
                failedCount++;
              } else {
                syncedCount++;
              }
            } else {
              // Insert new record
              const { error } = await supabase
                .from("flight_schedule")
                .insert([newRecord]);

              if (error) {
                console.error(`[EdgeFunction] Insert error for record:`, error);
                failedCount++;
              } else {
                syncedCount++;
              }
            }
          } catch (recordError) {
            console.error(`[EdgeFunction] Record processing error:`, recordError);
            failedCount++;
          }
        }

        console.log(
          `[EdgeFunction] Batch ${i / batchSize + 1} processed: ${syncedCount} synced, ${failedCount} failed`
        );
      } catch (batchError) {
        console.error(`[EdgeFunction] Batch failed:`, batchError);
        failedCount += batch.length;
      }
    }

    const duration = Date.now() - startTime;

    // Step 4: Log sync result
    await logSyncResult({
      sourceDatabase: `${req.type}:${req.host}`,
      totalRecords: externalData.length,
      syncedRecords: syncedCount,
      failedRecords: failedCount,
      duration,
      success: failedCount === 0,
    });

    return {
      success: failedCount === 0,
      message: `Sync completed: ${syncedCount} records synced, ${failedCount} failed`,
      data: {
        totalRecords: externalData.length,
        syncedRecords: syncedCount,
        failedRecords: failedCount,
        duration,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[EdgeFunction] Sync failed:`, error);

    return {
      success: false,
      message: "Sync failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sync from MySQL database
 */
async function syncFromMySQL(req: SyncRequest): Promise<any[]> {
  try {
    const connection = await mysql.connect({
      hostname: req.host,
      username: req.username,
      password: req.password,
      db: req.database,
      port: req.port,
    });

    const result = await connection.query(req.query);
    await connection.close();

    return result || [];
  } catch (error) {
    console.error("[EdgeFunction] MySQL connection error:", error);
    throw new Error(`MySQL connection failed: ${error}`);
  }
}

/**
 * Sync from MSSQL database
 * Note: Deno doesn't have native MSSQL driver, use HTTP endpoint instead
 */
async function syncFromMSSQL(req: SyncRequest): Promise<any[]> {
  // Placeholder - recommend using a proxy service
  throw new Error(
    "MSSQL sync requires backend service. Use MySQL or setup backend server."
  );
}

/**
 * Transform external data to Supabase format with Upsert logic
 * Implements Option B: If data only has one type (arr or dep), set the other to NULL
 */
function transformData(
  data: any[],
  fieldMapping: Array<{
    externalColumn: string;
    supabaseColumn: string;
  }>
): any[] {
  const mappingMap = new Map(
    fieldMapping.map((m) => [m.externalColumn, m.supabaseColumn])
  );

  // Define which columns belong to arrival vs departure
  const arrivalColumns = new Set([
    'arr_flt', 'arr_flight', 'sta', 'ata', 'arr_sts', 'arr_belt', 'arr_stand'
  ]);
  const departureColumns = new Set([
    'flight', 'std', 'atd', 'dep_sts', 'dep_gate', 'dep_stand'
  ]);

  return data
    .map((record) => {
      const transformed: any = {};
      let hasArrivalData = false;
      let hasDepartureData = false;

      // Transform and categorize fields
      for (const [externalCol, supabaseCol] of mappingMap) {
        if (record[externalCol] !== undefined && record[externalCol] !== null) {
          transformed[supabaseCol as string] = record[externalCol];
          
          if (arrivalColumns.has(supabaseCol as string)) {
            hasArrivalData = true;
          }
          if (departureColumns.has(supabaseCol as string)) {
            hasDepartureData = true;
          }
        }
      }

      // Option B: If only one type exists, nullify the other
      if (!hasArrivalData) {
        // No arrival data - set all arrival columns to NULL
        arrivalColumns.forEach(col => {
          if (mappingMap.has(col) || Object.values(mappingMap).includes(col as any)) {
            transformed[col] = null;
          }
        });
      }

      if (!hasDepartureData) {
        // No departure data - set all departure columns to NULL
        departureColumns.forEach(col => {
          if (mappingMap.has(col) || Object.values(mappingMap).includes(col as any)) {
            transformed[col] = null;
          }
        });
      }

      // Create composite keys for upsert matching
      const arrDate = transformed['sta'] ? new Date(transformed['sta']).toISOString().split('T')[0] : null;
      const depDate = transformed['std'] ? new Date(transformed['std']).toISOString().split('T')[0] : null;

      if (transformed['arr_flt'] && arrDate) {
        transformed['_arrival_key'] = `${transformed['arr_flt']}|${arrDate}`;
      }
      if (transformed['flight'] && depDate) {
        transformed['_departure_key'] = `${transformed['flight']}|${depDate}`;
      }

      return Object.keys(transformed).length > 0 ? transformed : null;
    })
    .filter((record) => record !== null);
}

/**
 * Log sync result to Supabase
 */
async function logSyncResult(result: {
  sourceDatabase: string;
  totalRecords: number;
  syncedRecords: number;
  failedRecords: number;
  duration: number;
  success: boolean;
}) {
  try {
    await supabase.from("sync_history").insert({
      source_database: result.sourceDatabase,
      total_records: result.totalRecords,
      inserted_records: result.syncedRecords,
      failed_records: result.failedRecords,
      duration_ms: result.duration,
      success: result.success,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[EdgeFunction] Failed to log sync result:", error);
  }
}

/**
 * Main handler
 */
serve(async (req: Request) => {
  // Enable CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Handle POST request
  if (req.method === "POST") {
    try {
      const payload = await req.json() as SyncRequest;

      // Validate required fields
      if (!payload.type || !payload.host || !payload.database) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Missing required fields: type, host, database",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Handle test-connection mode
      if (payload.mode === "test-connection") {
        const result = await testConnection(payload);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Handle sync mode (default)
      if (!payload.query || !payload.fieldMapping) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Sync mode requires: query and fieldMapping",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Execute sync
      const result = await syncExternalDatabase(payload);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("[EdgeFunction] Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: error instanceof Error ? error.message : "Internal error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
