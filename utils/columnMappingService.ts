/**
 * Column Mapping Service
 * Provides intelligent auto-detection and fuzzy matching for Excel columns
 */

// Define database schema for flight_schedule
export const FLIGHT_SCHEDULE_SCHEMA = {
  // Required fields
  flight: { 
    name: 'Flight Number',
    aliases: ['dep_flight', 'dep_flt', 'flight', 'flight_no', 'flt', 'mã chuyến', 'mã chuyến bay', 'số hiệu', 'flight_code', 'flt_num'],
    type: 'string',
    optional: false
  },
  std: { 
    name: 'Scheduled Departure Time',
    aliases: ['std', 'scheduled_departure', 'departure_time', 'dep_time', 'cất cánh', 'cất cánh dự tính', 'departure'],
    type: 'datetime',
    optional: false
  },
  
  // Optional arrival flight info
  arrFlt: { 
    name: 'Arrival Flight Number',
    aliases: ['arr_flight', 'arr_flt', 'arrival_flight', 'arrival_flt', 'chuyến bay hạ cánh', 'arrival_code'],
    type: 'string',
    optional: true
  },
  sta: { 
    name: 'Scheduled Arrival Time',
    aliases: ['sta', 'scheduled_arrival', 'arrival_time', 'arr_time', 'hạ cánh', 'hạ cánh dự tính', 'arrival'],
    type: 'datetime',
    optional: true
  },
  
  // Actual times
  atd: { 
    name: 'Actual Departure Time',
    aliases: ['atd', 'actual_departure', 'actual_dep', 'real_departure', 'cất cánh thực tế'],
    type: 'datetime',
    optional: true
  },
  ata: { 
    name: 'Actual Arrival Time',
    aliases: ['ata', 'actual_arrival', 'actual_arr', 'real_arrival', 'hạ cánh thực tế'],
    type: 'datetime',
    optional: true
  },
  
  // Aircraft info
  acType: { 
    name: 'Aircraft Type',
    aliases: ['ac_type', 'aircraft', 'aircraft_type', 'aircraft_code', 'type', 'loại máy bay', 'ac', 'airframe'],
    type: 'string',
    optional: true
  },
  
  // Status fields
  depSts: { 
    name: 'Departure Status',
    aliases: ['dep_status', 'dep_sts', 'departure_status', 'dep_status_code', 'status_dep', 'trạng thái cất cánh'],
    type: 'string',
    optional: true
  },
  arrSts: { 
    name: 'Arrival Status',
    aliases: ['arr_status', 'arr_sts', 'arrival_status', 'arr_status_code', 'status_arr', 'trạng thái hạ cánh'],
    type: 'string',
    optional: true
  },
  
  // Gate & Stand
  gate: { 
    name: 'Gate / Stand',
    aliases: ['gate', 'stand', 'gate_no', 'stand_no', 'dep_stand', 'dep_gate', 'boarding_gate', 'cổng'],
    type: 'string',
    optional: true
  },
  depGate: { 
    name: 'Departure Gate',
    aliases: ['dep_gate', 'dep_stand', 'departure_gate', 'departure_stand', 'cổng cất cánh'],
    type: 'string',
    optional: true
  },
  arrBelt: { 
    name: 'Arrival Belt',
    aliases: ['arr_belt', 'arrival_belt', 'baggage_belt', 'belt', 'conveyor', 'pickup_belt', 'dây chuyền', 'carousel'],
    type: 'string',
    optional: true
  },
  
  // Infrastructure - Stands
  arrStand: { 
    name: 'Arrival Stand',
    aliases: ['arr_stand', 'arrival_stand', 'stand_arr', 'arrival_position', 'vị trí hạ cánh'],
    type: 'string',
    optional: true
  },
  depStand: { 
    name: 'Departure Stand',
    aliases: ['dep_stand', 'departure_stand', 'stand_dep', 'departure_position', 'vị trí cất cánh'],
    type: 'string',
    optional: true
  },
  
  // Counters
  counters: { 
    name: 'Check-in Counters',
    aliases: ['counters', 'counter', 'checkin_counters', 'check_in_counter', 'quầy', 'counters_list'],
    type: 'string',
    optional: true
  },
  
  // Passenger data
  depPax: { 
    name: 'Departure Passengers',
    aliases: ['dep_pax', 'dep_passengers', 'departure_pax', 'passengers_dep', 'pax_out', 'khách đi'],
    type: 'number',
    optional: true
  },
  arrPax: { 
    name: 'Arrival Passengers',
    aliases: ['arr_pax', 'arr_passengers', 'arrival_pax', 'passengers_arr', 'pax_in', 'khách đến'],
    type: 'number',
    optional: true
  },
  
  // Route
  from: { 
    name: 'From (Origin)',
    aliases: ['from', 'origin', 'dep_airport', 'departure_airport', 'flight_from', 'source', 'từ', 'sân bay đi'],
    type: 'string',
    optional: true
  },
  to: { 
    name: 'To (Destination)',
    aliases: ['to', 'destination', 'arr_airport', 'arrival_airport', 'flight_to', 'dest', 'đến', 'sân bay đến'],
    type: 'string',
    optional: true
  },
};

/**
 * Levenshtein distance - measure string similarity
 * Lower score = more similar
 */
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() =>
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  
  return track[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-100)
 * Higher = more similar
 */
function similarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 85;
  
  // Levenshtein distance scoring
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

/**
 * Auto-detect column mapping with fuzzy matching
 * Returns mapping with confidence scores
 */
export function autoDetectMapping(
  headers: string[],
  mappings: { key: string; label: string; optional?: boolean }[]
): {
  mapping: Record<string, number>;
  confidence: Record<string, number>;
  suggestions: Record<string, string[]>;
} {
  const mapping: Record<string, number> = {};
  const confidence: Record<string, number> = {};
  const suggestions: Record<string, string[]> = {};

  const schema = FLIGHT_SCHEDULE_SCHEMA as any;

  mappings.forEach(m => {
    let bestScore = 0;
    let bestIdx = -1;
    const topMatches: { col: string; idx: number; score: number }[] = [];

    headers.forEach((header, idx) => {
      const schemaField = schema[m.key];
      if (!schemaField) return;

      let score = 0;

      // Direct alias match (highest priority)
      const aliases = (schemaField.aliases as string[]) || [];
      const exactAlias = aliases.find(
        (a: string) => a.toLowerCase().trim() === header.toLowerCase().trim()
      );
      if (exactAlias) {
        score = 100;
      } else {
        // Fuzzy match against aliases
        let bestAliasScore = 0;
        aliases.forEach((alias: string) => {
          const sim = similarityScore(header, alias);
          bestAliasScore = Math.max(bestAliasScore, sim);
        });
        score = bestAliasScore;
      }

      if (score > 0) {
        topMatches.push({ col: header, idx, score });
      }

      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      mapping[m.key] = bestIdx;
      confidence[m.key] = bestScore;

      // Store top 3 suggestions for this field
      suggestions[m.key] = topMatches
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(t => `${t.col} (${t.score}%)`);
    } else {
      mapping[m.key] = -1;
      confidence[m.key] = 0;
      suggestions[m.key] = [];
    }
  });

  return { mapping, confidence, suggestions };
}

/**
 * Validate mapped data before upload
 * IMPORTANT: This must match the validation logic in parseExcelRows()
 */
export function validateMappedData(
  rowData: any[],
  mapping: Record<string, number>,
  mappingConfig: { key: string; label: string; optional?: boolean }[]
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  let validRows = 0;
  let invalidRows = 0;

  const requiredFields = mappingConfig
    .filter(m => !m.optional)
    .map(m => m.key);

  // Check required mappings exist
  requiredFields.forEach(field => {
    if (mapping[field] === undefined || mapping[field] === -1) {
      errors.push(`Required field '${field}' is not mapped to any column`);
    }
  });

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
      stats: { totalRows: rowData.length, validRows: 0, invalidRows: rowData.length }
    };
  }

  // Validate each row - match parseExcelRows() logic
  for (let i = 1; i < rowData.length; i++) {
    const row = rowData[i];
    let hasError = false;
    let skipReason = '';

    // Get flight numbers and times
    const arrFlt = mapping['arrFlt'] !== -1 && mapping['arrFlt'] !== undefined 
      ? String(row[mapping['arrFlt']] || '').trim() 
      : '';
    const depFlt = mapping['depFlt'] !== -1 && mapping['depFlt'] !== undefined 
      ? String(row[mapping['depFlt']] || '').trim() 
      : '';
    
    // For backwards compatibility: check 'flight' field if 'depFlt' not mapped
    const flightNum = depFlt || (mapping['flight'] !== -1 && mapping['flight'] !== undefined 
      ? String(row[mapping['flight']] || '').trim() 
      : '');

    // Check if either arrival or departure flight exists
    if (!arrFlt && !flightNum) {
      hasError = true;
      skipReason = 'no flight number';
    }

    // Check for cancelled status
    if (!hasError) {
      const depStatus = mapping['depSts'] !== -1 && mapping['depSts'] !== undefined 
        ? String(row[mapping['depSts']] || '').toUpperCase() 
        : '';
      const arrStatus = mapping['arrSts'] !== -1 && mapping['arrSts'] !== undefined 
        ? String(row[mapping['arrSts']] || '').toUpperCase() 
        : '';
      
      if (depStatus.includes('CX') || depStatus.includes('CNL') || 
          arrStatus.includes('CX') || arrStatus.includes('CNL')) {
        hasError = true;
        skipReason = 'cancelled flight (CX/CNL)';
      }
    }

    // Check for at least one valid time (sta or std)
    if (!hasError) {
      const staCol = mapping['sta'] !== -1 && mapping['sta'] !== undefined ? mapping['sta'] : -1;
      const stdCol = mapping['std'] !== -1 && mapping['std'] !== undefined ? mapping['std'] : -1;
      
      const sta = staCol >= 0 ? row[staCol] : null;
      const std = stdCol >= 0 ? row[stdCol] : null;
      
      if (!sta && !std) {
        hasError = true;
        skipReason = 'missing both STA and STD times';
      }
    }

    if (hasError) {
      invalidRows++;
      if (skipReason && !warnings.some(w => w.includes(skipReason))) {
        // Add warning for first occurrence of this skip reason
        if (invalidRows <= 10) { // Only show first few skip reasons
          warnings.push(`Row ${i}: ${skipReason}`);
        }
      }
    } else {
      validRows++;
    }
  }

  if (validRows === 0) {
    errors.push('No valid rows found. Check: flight numbers, times, and cancelled status');
  } else if (invalidRows > 0) {
    warnings.push(
      `${invalidRows} rows will be skipped due to: missing flight/time, cancelled status, etc.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalRows: rowData.length - 1,
      validRows,
      invalidRows
    }
  };
}

/**
 * Get sample data preview after mapping
 */
export function getSampleDataPreview(
  rowData: any[],
  mapping: Record<string, number>,
  mappingConfig: { key: string; label: string }[],
  sampleSize: number = 5
): any[] {
  const samples: any[] = [];

  for (let i = 1; i < Math.min(rowData.length, sampleSize + 1); i++) {
    const row = rowData[i];
    const sample: any = {};

    mappingConfig.forEach(m => {
      const colIdx = mapping[m.key];
      if (colIdx >= 0) {
        sample[m.key] = row[colIdx] || '';
      }
    });

    samples.push(sample);
  }

  return samples;
}

/**
 * Get column statistics
 */
export function getColumnStats(
  headers: string[],
  rowData: any[]
): Record<string, { type: string; nonEmptyCount: number; examples: string[] }> {
  const stats: Record<string, any> = {};

  headers.forEach((header, colIdx) => {
    const values: string[] = [];
    let nonEmptyCount = 0;

    for (let i = 1; i < rowData.length; i++) {
      const val = rowData[i][colIdx];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        nonEmptyCount++;
        if (values.length < 3) {
          values.push(String(val).substring(0, 50));
        }
      }
    }

    // Infer type
    let type = 'string';
    if (
      values.length > 0 &&
      values.every(v => /^\d+$/.test(v))
    ) {
      type = 'number';
    } else if (
      values.length > 0 &&
      values.every(v => /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v))
    ) {
      type = 'datetime';
    }

    stats[header] = {
      type,
      nonEmptyCount,
      examples: values
    };
  });

  return stats;
}
