-- Migration: Add composite key helper columns for smart upsert
-- Purpose: Support Option B upsert logic where departure data is nullified if only arrival exists, and vice versa

-- Add helper columns for composite key matching (not required by constraint, just for querying)
ALTER TABLE flight_schedule
ADD COLUMN IF NOT EXISTS _arrival_key TEXT,
ADD COLUMN IF NOT EXISTS _departure_key TEXT;

-- Create indexes on helper columns for faster lookups during upsert
CREATE INDEX IF NOT EXISTS idx_flight_schedule_arrival_key ON flight_schedule(_arrival_key);
CREATE INDEX IF NOT EXISTS idx_flight_schedule_departure_key ON flight_schedule(_departure_key);

-- Create indexes on core columns for composite key matching during upsert
-- Arrival key: (arr_flt, DATE(sta))
CREATE INDEX IF NOT EXISTS idx_flight_schedule_arr_flt_sta_date 
ON flight_schedule(arr_flt, DATE(sta)) 
WHERE arr_flt IS NOT NULL;

-- Departure key: (flight, DATE(std))
CREATE INDEX IF NOT EXISTS idx_flight_schedule_flight_std_date 
ON flight_schedule(flight, DATE(std)) 
WHERE flight IS NOT NULL;

-- Add comment explaining the upsert strategy
COMMENT ON TABLE flight_schedule IS 
'Flight schedule table with smart upsert logic:
- Arrival key: (arr_flt, DATE(sta)) - ensures one arrival per flight per day
- Departure key: (flight, DATE(std)) - ensures one departure per flight per day
- Option B upsert: If new data only has arrival, nullify departure fields (and vice versa)';
