/**
 * Gantt CSV Export Service
 * Exports Gate and Checkin Gantt timeline data to CSV format for Power BI integration
 */

import { Flight, CheckinData } from '../types';

export interface GanttCSVRow {
  FlightNumber: string;
  ResourceType: string;
  ResourceName: string;
  StartTime: string;
  ScheduledTime: string;
  EndTime: string;
  DurationMinutes: number;
  Status: string;
  AircraftType: string;
  AircraftCode: string;
  DateISO: string;
}

/**
 * Build Gantt CSV data for Gate timeline
 * Uses buffer zones (bufS/bufE) to calculate gate occupancy window
 */
export function buildGateGanttCSV(
  flights: Flight[],
  bufS: number = 40,
  bufE: number = 15
): GanttCSVRow[] {
  const rows: GanttCSVRow[] = [];

  flights.forEach(flight => {
    // Only export assigned flights (gate !== 'UNASSIGNED')
    if (!flight.gate || flight.gate === 'UNASSIGNED') {
      return;
    }

    // Calculate gate occupancy window using buffer zones
    const startTime = new Date(flight.target.getTime() - bufS * 60000);
    const endTime = new Date(flight.target.getTime() + bufE * 60000);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const dateISO = flight.target.toISOString().split('T')[0];

    rows.push({
      FlightNumber: flight.id,
      ResourceType: 'Gate',
      ResourceName: flight.gate,
      StartTime: startTime.toISOString(),
      ScheduledTime: flight.target.toISOString(),
      EndTime: endTime.toISOString(),
      DurationMinutes: durationMinutes,
      Status: 'Assigned',
      AircraftType: flight.acType || 'Unknown',
      AircraftCode: flight.acCode || 'UNK',
      DateISO: dateISO
    });
  });

  return rows;
}

/**
 * Build Gantt CSV data for Checkin timeline
 * Uses assigned check-in times only (no default times)
 */
export function buildCheckinGanttCSV(flights: Flight[]): GanttCSVRow[] {
  const rows: GanttCSVRow[] = [];

  flights.forEach(flight => {
    // Only export if flight has assigned check-in counters
    if (!flight.checkinData || flight.checkinData.length === 0) {
      return; // Skip flights without assigned check-ins
    }

    const dateISO = flight.target.toISOString().split('T')[0];

    flight.checkinData.forEach((checkin: CheckinData) => {
      const durationMinutes = Math.round(
        (checkin.end.getTime() - checkin.start.getTime()) / 60000
      );

      rows.push({
        FlightNumber: flight.id,
        ResourceType: 'Checkin',
        ResourceName: checkin.ctr,
        StartTime: checkin.start.toISOString(),
        ScheduledTime: flight.target.toISOString(),
        EndTime: checkin.end.toISOString(),
        DurationMinutes: durationMinutes,
        Status: 'Assigned',
        AircraftType: flight.acType || 'Unknown',
        AircraftCode: flight.acCode || 'UNK',
        DateISO: dateISO
      });
    });
  });

  return rows;
}

/**
 * Convert array of GanttCSVRow to CSV format
 * Properly escapes and formats CSV data
 */
export function convertGanttToCSV(rows: GanttCSVRow[]): string {
  if (rows.length === 0) {
    return ''; // Return empty string if no data
  }

  // Define headers
  const headers = [
    'FlightNumber',
    'ResourceType',
    'ResourceName',
    'StartTime',
    'ScheduledTime',
    'EndTime',
    'DurationMinutes',
    'Status',
    'AircraftType',
    'AircraftCode',
    'DateISO'
  ];

  // Build CSV rows
  const csvLines = [
    headers.join(','), // Header row
    ...rows.map(row =>
      headers
        .map(header => {
          const value = row[header as keyof GanttCSVRow];
          if (value === null || value === undefined) {
            return ''; // Empty field
          }
          const stringValue = String(value);
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (
            stringValue.includes(',') ||
            stringValue.includes('"') ||
            stringValue.includes('\n')
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    )
  ];

  return csvLines.join('\n');
}

/**
 * Download CSV file to user's computer
 */
export function downloadCSVFile(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Main export function for Gate Gantt
 * Combines all steps: build, convert, download
 */
export function exportGateGanttCSV(
  flights: Flight[],
  bufS: number = 40,
  bufE: number = 15,
  filename?: string
): void {
  try {
    const rows = buildGateGanttCSV(flights, bufS, bufE);

    if (rows.length === 0) {
      alert('No assigned gates to export. Please assign flights to gates first.');
      return;
    }

    const csvContent = convertGanttToCSV(rows);
    const exportFilename = filename || `Gate_Plan_${new Date().toISOString().split('T')[0]}.csv`;

    downloadCSVFile(csvContent, exportFilename);

    console.log(`[Gantt Export] Exported ${rows.length} gate assignments to ${exportFilename}`);
  } catch (error) {
    console.error('[Gantt Export] Error exporting gate gantt:', error);
    alert('Failed to export Gate Gantt CSV. Check console for details.');
  }
}

/**
 * Main export function for Checkin Gantt
 * Combines all steps: build, convert, download
 */
export function exportCheckinGanttCSV(
  flights: Flight[],
  filename?: string
): void {
  try {
    const rows = buildCheckinGanttCSV(flights);

    if (rows.length === 0) {
      alert('No assigned check-in counters to export. Please assign check-ins first.');
      return;
    }

    const csvContent = convertGanttToCSV(rows);
    const exportFilename = filename || `Checkin_Plan_${new Date().toISOString().split('T')[0]}.csv`;

    downloadCSVFile(csvContent, exportFilename);

    console.log(`[Gantt Export] Exported ${rows.length} check-in assignments to ${exportFilename}`);
  } catch (error) {
    console.error('[Gantt Export] Error exporting checkin gantt:', error);
    alert('Failed to export Checkin Gantt CSV. Check console for details.');
  }
}

/**
 * Combined export - both gate and checkin in one file
 */
export function exportCombinedGanttCSV(
  flights: Flight[],
  bufS: number = 40,
  bufE: number = 15,
  filename?: string
): void {
  try {
    const gateRows = buildGateGanttCSV(flights, bufS, bufE);
    const checkinRows = buildCheckinGanttCSV(flights);

    if (gateRows.length === 0 && checkinRows.length === 0) {
      alert('No assigned gates or check-ins to export. Please make some assignments first.');
      return;
    }

    const allRows = [...gateRows, ...checkinRows];
    const csvContent = convertGanttToCSV(allRows);
    const exportFilename = filename || `Gantt_Plan_${new Date().toISOString().split('T')[0]}.csv`;

    downloadCSVFile(csvContent, exportFilename);

    console.log(
      `[Gantt Export] Exported ${gateRows.length} gate + ${checkinRows.length} checkin assignments to ${exportFilename}`
    );
  } catch (error) {
    console.error('[Gantt Export] Error exporting combined gantt:', error);
    alert('Failed to export Gantt CSV. Check console for details.');
  }
}
