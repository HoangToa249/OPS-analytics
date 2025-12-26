/**
 * Test Suite for Column Mapping Service
 * Testing auto-detection, validation, and preview functionality
 */

import {
  autoDetectMapping,
  validateMappedData,
  getSampleDataPreview,
  getColumnStats,
  FLIGHT_SCHEDULE_SCHEMA
} from '../utils/columnMappingService';

// Test Mappings Configuration
const TEST_MAPPINGS = [
  { key: 'flight', label: 'Flight Number' },
  { key: 'std', label: 'STD' },
  { key: 'sta', label: 'STA', optional: true },
  { key: 'acType', label: 'Aircraft Type', optional: true },
  { key: 'from', label: 'From', optional: true },
  { key: 'to', label: 'To', optional: true },
];

// Test Case 1: Perfect Column Names (English)
export function testCase1_PerfectEnglish() {
  console.log('\n=== Test Case 1: Perfect English Column Names ===');
  
  const headers = [
    'flight',
    'std',
    'sta',
    'aircraft_type',
    'from',
    'to'
  ];

  const { mapping, confidence } = autoDetectMapping(headers, TEST_MAPPINGS);

  console.log('Headers:', headers);
  console.log('Mapping Results:');
  Object.entries(mapping).forEach(([key, idx]) => {
    const conf = confidence[key];
    const header = idx >= 0 ? headers[idx] : 'NOT MAPPED';
    console.log(`  ${key}: ${header} (${conf}%)`);
  });

  // Expected: All should have high confidence (90%+)
  const allHighConfidence = Object.values(confidence).every(c => c >= 90);
  console.log(`\n✓ Test Passed: ${allHighConfidence ? 'All fields detected with high confidence' : 'FAILED - Low confidence'}`);
}

// Test Case 2: Vietnamese Column Names
export function testCase2_VietnameseNames() {
  console.log('\n=== Test Case 2: Vietnamese Column Names ===');
  
  const headers = [
    'Mã Chuyến Bay',
    'Cất Cánh Dự Tính',
    'Hạ Cánh Dự Tính',
    'Loại Máy Bay',
    'Từ',
    'Đến'
  ];

  const { mapping, confidence } = autoDetectMapping(headers, TEST_MAPPINGS);

  console.log('Headers:', headers);
  console.log('Mapping Results:');
  Object.entries(mapping).forEach(([key, idx]) => {
    const conf = confidence[key];
    const header = idx >= 0 ? headers[idx] : 'NOT MAPPED';
    console.log(`  ${key}: ${header} (${conf}%)`);
  });

  // Expected: Vietnamese names should match with reasonable confidence
  const detectedFlightAndStd = mapping['flight'] >= 0 && mapping['std'] >= 0;
  console.log(`\n✓ Test Passed: ${detectedFlightAndStd ? 'Flight and STD detected' : 'FAILED'}`);
}

// Test Case 3: Mixed/Unclear Column Names
export function testCase3_MixedNames() {
  console.log('\n=== Test Case 3: Mixed/Unclear Column Names ===');
  
  const headers = [
    'Flt No',
    'Dep Time',
    'Arr Time',
    'AC',
    'Origin',
    'Destination'
  ];

  const { mapping, confidence, suggestions } = autoDetectMapping(headers, TEST_MAPPINGS);

  console.log('Headers:', headers);
  console.log('Mapping Results:');
  Object.entries(mapping).forEach(([key, idx]) => {
    const conf = confidence[key];
    const header = idx >= 0 ? headers[idx] : 'NOT MAPPED';
    const sugg = suggestions[key];
    console.log(`  ${key}: ${header} (${conf}%)`);
    if (sugg.length > 0) {
      console.log(`    Suggestions: ${sugg.join(', ')}`);
    }
  });

  console.log('\n✓ Test Completed');
}

// Test Case 4: Data Validation - Valid Data
export function testCase4_ValidationValid() {
  console.log('\n=== Test Case 4: Data Validation - Valid ===');
  
  const headers = ['flight', 'std', 'sta', 'acType'];
  const mapping = { flight: 0, std: 1, sta: 2, acType: 3 };
  
  const rowData = [
    headers,
    ['VN001', '2024-12-25 08:00', '2024-12-25 10:30', 'A320'],
    ['VN002', '2024-12-25 09:00', '2024-12-25 11:30', 'A321'],
    ['VN003', '2024-12-25 10:00', '2024-12-25 12:30', 'B787'],
  ];

  const validation = validateMappedData(rowData, mapping, TEST_MAPPINGS);

  console.log('Data Rows:', rowData.length - 1);
  console.log('Validation Result:');
  console.log(`  Valid: ${validation.isValid}`);
  console.log(`  Valid Rows: ${validation.stats.validRows}/${validation.stats.totalRows}`);
  console.log(`  Errors: ${validation.errors.length}`);
  console.log(`  Warnings: ${validation.warnings.length}`);

  console.log(`\n✓ Test Passed: ${validation.isValid ? 'All rows valid' : 'FAILED'}`);
}

// Test Case 5: Data Validation - Missing Required Fields
export function testCase5_ValidationMissing() {
  console.log('\n=== Test Case 5: Data Validation - Missing Fields ===');
  
  const headers = ['flight', 'std', 'sta', 'acType'];
  const mapping = { flight: 0, std: 1, sta: 2, acType: 3 };
  
  const rowData = [
    headers,
    ['VN001', '2024-12-25 08:00', '2024-12-25 10:30', 'A320'],
    ['', '2024-12-25 09:00', '2024-12-25 11:30', 'A321'], // Missing flight
    ['VN003', '', '2024-12-25 12:30', 'B787'], // Missing std
    ['VN004', '2024-12-25 11:00', '2024-12-25 13:30', 'A320'],
  ];

  const validation = validateMappedData(rowData, mapping, TEST_MAPPINGS);

  console.log('Data Rows:', rowData.length - 1);
  console.log('Validation Result:');
  console.log(`  Valid: ${validation.isValid}`);
  console.log(`  Valid Rows: ${validation.stats.validRows}/${validation.stats.totalRows}`);
  console.log(`  Invalid Rows: ${validation.stats.invalidRows}`);
  console.log(`  Warnings: ${validation.warnings.map(w => `"${w}"`).join(', ')}`);

  console.log(`\n✓ Test Passed: ${!validation.isValid && validation.stats.invalidRows === 2 ? 'Correctly detected 2 invalid rows' : 'FAILED'}`);
}

// Test Case 6: Sample Preview
export function testCase6_SamplePreview() {
  console.log('\n=== Test Case 6: Sample Data Preview ===');
  
  const headers = ['flight', 'std', 'acType', 'from', 'to'];
  const mapping = { flight: 0, std: 1, sta: -1, acType: 2, from: 3, to: 4 };
  
  const rowData = [
    headers,
    ['VN001', '2024-12-25 08:00', 'A320', 'HAN', 'SGN'],
    ['VN002', '2024-12-25 09:00', 'A321', 'HAN', 'BKK'],
    ['VN003', '2024-12-25 10:00', 'B787', 'HAN', 'ICN'],
    ['VN004', '2024-12-25 11:00', 'A320', 'SGN', 'HAN'],
    ['VN005', '2024-12-25 12:00', 'B737', 'SGN', 'DAD'],
  ];

  const preview = getSampleDataPreview(rowData, mapping, TEST_MAPPINGS, 3);

  console.log('Sample Size:', preview.length);
  console.log('Sample Data:');
  preview.forEach((row, i) => {
    console.log(`  Row ${i + 1}:`, JSON.stringify(row));
  });

  console.log(`\n✓ Test Passed: ${preview.length === 3 ? 'Correct sample size' : 'FAILED'}`);
}

// Test Case 7: Column Statistics
export function testCase7_ColumnStatistics() {
  console.log('\n=== Test Case 7: Column Statistics ===');
  
  const headers = ['flight', 'std', 'acType', 'depPax'];
  const rowData = [
    headers,
    ['VN001', '2024-12-25 08:00', 'A320', '180'],
    ['VN002', '2024-12-25 09:00', 'A321', '230'],
    ['VN003', '2024-12-25 10:00', 'B787', '300'],
    ['VN004', '', 'A320', ''],
  ];

  const stats = getColumnStats(headers, rowData);

  console.log('Column Statistics:');
  Object.entries(stats).forEach(([header, stat]: [string, any]) => {
    console.log(`\n  ${header}:`);
    console.log(`    Type: ${stat.type}`);
    console.log(`    Non-empty: ${stat.nonEmptyCount}/${rowData.length - 1}`);
    console.log(`    Examples: ${stat.examples.join(', ')}`);
  });

  // Verify type detection
  const correctTypes = 
    stats['flight'].type === 'string' &&
    stats['std'].type === 'datetime' &&
    stats['depPax'].type === 'number';

  console.log(`\n✓ Test Passed: ${correctTypes ? 'Types correctly detected' : 'FAILED'}`);
}

// Test Case 8: Schema Validation
export function testCase8_SchemaValidation() {
  console.log('\n=== Test Case 8: Schema Definition ===');
  
  console.log('Defined Fields:', Object.keys(FLIGHT_SCHEDULE_SCHEMA).length);
  
  const requiredCount = Object.values(FLIGHT_SCHEDULE_SCHEMA).filter(
    (field: any) => !field.optional
  ).length;
  
  const optionalCount = Object.values(FLIGHT_SCHEDULE_SCHEMA).filter(
    (field: any) => field.optional
  ).length;

  console.log(`  Required: ${requiredCount}`);
  console.log(`  Optional: ${optionalCount}`);

  // List aliases for key fields
  console.log('\nKey Field Aliases:');
  ['flight', 'std', 'sta', 'acType'].forEach(key => {
    const field = FLIGHT_SCHEDULE_SCHEMA[key as keyof typeof FLIGHT_SCHEDULE_SCHEMA] as any;
    const aliases = (field.aliases as string[]).slice(0, 5);
    console.log(`  ${key}: ${aliases.join(', ')}...`);
  });

  console.log(`\n✓ Test Passed: Schema defined with ${requiredCount + optionalCount} fields`);
}

// Run all tests
export function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Column Mapping Service - Test Suite                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  testCase1_PerfectEnglish();
  testCase2_VietnameseNames();
  testCase3_MixedNames();
  testCase4_ValidationValid();
  testCase5_ValidationMissing();
  testCase6_SamplePreview();
  testCase7_ColumnStatistics();
  testCase8_SchemaValidation();

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  All Tests Completed ✓                                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
}

// For use in browser console:
if (typeof window !== 'undefined') {
  (window as any).testColumnMapping = {
    testCase1: testCase1_PerfectEnglish,
    testCase2: testCase2_VietnameseNames,
    testCase3: testCase3_MixedNames,
    testCase4: testCase4_ValidationValid,
    testCase5: testCase5_ValidationMissing,
    testCase6: testCase6_SamplePreview,
    testCase7: testCase7_ColumnStatistics,
    testCase8: testCase8_SchemaValidation,
    runAll: runAllTests
  };
  console.log('✓ Test suite available. Run: testColumnMapping.runAll()');
}
