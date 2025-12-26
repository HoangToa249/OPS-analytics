/**
 * Infrastructure Analytics Service
 * Calculates metrics for Gate, Stand, and Belt (Carousel) utilization
 */

import { Flight } from '../types';

// ============ TYPES ============

export interface GateStat {
  gateId: string;
  totalFlights: number;
  totalUtilizationMin: number;
  avgUtilizationMin: number;
  utilizationPercent: number; // % of day utilized
  peakHour: number; // Hour with most flights
  hasConflicts: boolean;
  conflicts: number;
}

export interface StandStat {
  standId: string;
  totalFlights: number;
  totalUtilizationMin: number;
  avgUtilizationMin: number;
  avgTurnaroundMin: number;
  standType: 'arr' | 'dep' | 'mixed';
  peakHour: number;
  hasConflicts: boolean;
  conflicts: number;
}

export interface BeltStat {
  beltId: string;
  arrivalFlights: number;
  totalPassengers: number;
  avgThroughputPerHour: number;
  peakHour: number;
  utilizationPercent: number;
}

export interface HourlyInfraMetrics {
  hour: number; // 0-23
  gateOccupancy: Record<string, number>; // gate -> minutes occupied
  standOccupancy: Record<string, number>; // stand -> minutes occupied
  beltPassengers: Record<string, number>; // belt -> passenger count
  gateConflicts: number;
  standConflicts: number;
}

export interface InfrastructureMetrics {
  dateRange: { start: Date; end: Date };
  totalFlights: number;
  
  gateStats: GateStat[];
  standStats: StandStat[];
  beltStats: BeltStat[];
  
  hourlyMetrics: HourlyInfraMetrics[];
  
  // KPI Summary
  avgGateUtilizationPercent: number;
  avgStandUtilizationPercent: number;
  totalGateConflicts: number;
  totalStandConflicts: number;
  avgBeltThroughputPerHour: number;
}

// ============ UTILITIES ============

/**
 * Calculate minutes between two dates
 */
function getMinutesBetween(start: Date | null | undefined, end: Date | null | undefined): number {
  if (!start || !end) return 0;
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Get hour from date (0-23)
 */
function getHourFromDate(date: Date | null | undefined): number {
  if (!date) return 0;
  return date.getHours();
}

/**
 * Detect conflicts: two flights at same gate/stand with overlapping times
 */
function detectTimeConflict(
  start1: Date | null | undefined,
  end1: Date | null | undefined,
  start2: Date | null | undefined,
  end2: Date | null | undefined
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  
  const s1 = start1.getTime();
  const e1 = end1.getTime();
  const s2 = start2.getTime();
  const e2 = end2.getTime();
  
  // No overlap if one ends before other starts
  if (e1 <= s2 || e2 <= s1) return false;
  return true;
}

// ============ MAIN CALCULATIONS ============

/**
 * Calculate all infrastructure metrics
 */
export function calculateInfrastructureMetrics(flights: Flight[], dateStart: Date, dateEnd: Date): InfrastructureMetrics {
  // Initialize hourly metrics (24 hours)
  const hourlyMetrics: HourlyInfraMetrics[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    gateOccupancy: {},
    standOccupancy: {},
    beltPassengers: {},
    gateConflicts: 0,
    standConflicts: 0,
  }));

  const gateMap = new Map<string, Flight[]>();
  const standArrMap = new Map<string, Flight[]>();
  const standDepMap = new Map<string, Flight[]>();
  const beltMap = new Map<string, Flight[]>();

  // Group flights by infrastructure
  for (const flight of flights) {
    // Gate processing
    if (flight.depGate || flight.gate) {
      const gateId = flight.depGate || flight.gate;
      if (!gateMap.has(gateId)) gateMap.set(gateId, []);
      gateMap.get(gateId)!.push(flight);

      // Track hourly gate occupancy - cap at 60 min per hour
      if (flight.gateStart && flight.gateEnd) {
        const hour = getHourFromDate(flight.gateStart);
        const utilMin = getMinutesBetween(flight.gateStart, flight.gateEnd);
        // Cap at 60 minutes max (within 1 hour boundary)
        const occupiedThisHour = Math.min(utilMin, 60);
        hourlyMetrics[hour].gateOccupancy[gateId] = (hourlyMetrics[hour].gateOccupancy[gateId] || 0) + occupiedThisHour;
      }
    }

    // Arrival Stand - should occupy from ATA to STA (actual to scheduled departure)
    if (flight.arrStand) {
      if (!standArrMap.has(flight.arrStand)) standArrMap.set(flight.arrStand, []);
      standArrMap.get(flight.arrStand)!.push(flight);

      // Use ATA to STD (when next departure is scheduled) or ATA to ATD (when actually departs)
      const standStart = flight.ata;
      const standEnd = flight.atd || flight.std;
      
      if (standStart && standEnd) {
        // Only count occupied minutes within the same hour - don't accumulate across hours
        const utilMin = getMinutesBetween(standStart, standEnd);
        const hour = getHourFromDate(standStart);
        
        // Cap at 60 minutes max per hour (overlap handling)
        const occupiedThisHour = Math.min(utilMin, 60);
        hourlyMetrics[hour].standOccupancy[flight.arrStand] = (hourlyMetrics[hour].standOccupancy[flight.arrStand] || 0) + occupiedThisHour;
      }
    }

    // Departure Stand - should occupy from STD to ATD
    if (flight.depStand && flight.depStand !== flight.arrStand) {  // Avoid duplicate if same stand
      if (!standDepMap.has(flight.depStand)) standDepMap.set(flight.depStand, []);
      standDepMap.get(flight.depStand)!.push(flight);

      const standStart = flight.std;
      const standEnd = flight.atd;
      
      if (standStart && standEnd) {
        const utilMin = getMinutesBetween(standStart, standEnd);
        const hour = getHourFromDate(standStart);
        
        // Cap at 60 minutes max per hour (overlap handling)
        const occupiedThisHour = Math.min(utilMin, 60);
        hourlyMetrics[hour].standOccupancy[flight.depStand] = (hourlyMetrics[hour].standOccupancy[flight.depStand] || 0) + occupiedThisHour;
      }
    }

    // Carousel/Belt
    if (flight.carousel && flight.arrPax) {
      if (!beltMap.has(flight.carousel)) beltMap.set(flight.carousel, []);
      beltMap.get(flight.carousel)!.push(flight);

      if (flight.ata) {
        const hour = getHourFromDate(flight.ata);
        hourlyMetrics[hour].beltPassengers[flight.carousel] = (hourlyMetrics[hour].beltPassengers[flight.carousel] || 0) + flight.arrPax;
      }
    }
  }

  // Detect conflicts
  for (const [gateId, gateFlights] of gateMap.entries()) {
    for (let i = 0; i < gateFlights.length; i++) {
      for (let j = i + 1; j < gateFlights.length; j++) {
        if (detectTimeConflict(gateFlights[i].gateStart, gateFlights[i].gateEnd, gateFlights[j].gateStart, gateFlights[j].gateEnd)) {
          const hour = getHourFromDate(gateFlights[i].gateStart);
          if (hour >= 0 && hour < 24) {
            hourlyMetrics[hour].gateConflicts++;
          }
        }
      }
    }
  }

  for (const [standId, standFlights] of [...standArrMap.entries(), ...standDepMap.entries()]) {
    for (let i = 0; i < standFlights.length; i++) {
      for (let j = i + 1; j < standFlights.length; j++) {
        if (detectTimeConflict(standFlights[i].gateStart, standFlights[i].gateEnd, standFlights[j].gateStart, standFlights[j].gateEnd)) {
          const hour = getHourFromDate(standFlights[i].gateStart);
          if (hour >= 0 && hour < 24) {
            hourlyMetrics[hour].standConflicts++;
          }
        }
      }
    }
  }

  // Calculate Gate Stats
  const gateStats: GateStat[] = Array.from(gateMap.entries()).map(([gateId, gateFlights]) => {
    const utilizationTimes = gateFlights.map(f => getMinutesBetween(f.gateStart, f.gateEnd));
    const totalUtilMin = utilizationTimes.reduce((a, b) => a + b, 0);
    const avgUtilMin = utilizationTimes.length > 0 ? totalUtilMin / utilizationTimes.length : 0;
    
    // Calculate utilization percent (minutes used / total minutes in day)
    const totalMinutesInDay = 24 * 60;
    const utilizationPercent = (totalUtilMin / totalMinutesInDay) * 100;

    // Find peak hour
    let peakHour = 0;
    let maxFlights = 0;
    for (let h = 0; h < 24; h++) {
      const hourFlights = gateFlights.filter(f => getHourFromDate(f.gateStart) === h).length;
      if (hourFlights > maxFlights) {
        maxFlights = hourFlights;
        peakHour = h;
      }
    }

    // Count conflicts
    let conflicts = 0;
    for (let i = 0; i < gateFlights.length; i++) {
      for (let j = i + 1; j < gateFlights.length; j++) {
        if (detectTimeConflict(gateFlights[i].gateStart, gateFlights[i].gateEnd, gateFlights[j].gateStart, gateFlights[j].gateEnd)) {
          conflicts++;
        }
      }
    }

    return {
      gateId,
      totalFlights: gateFlights.length,
      totalUtilizationMin: totalUtilMin,
      avgUtilizationMin: avgUtilMin,
      utilizationPercent,
      peakHour,
      hasConflicts: conflicts > 0,
      conflicts,
    };
  });

  // Calculate Stand Stats
  const allStandFlights = [...standArrMap.entries(), ...standDepMap.entries()];
  const standStats: StandStat[] = allStandFlights.map(([standId, standFlights]) => {
    const utilizationTimes = standFlights.map(f => getMinutesBetween(f.gateStart, f.gateEnd));
    const totalUtilMin = utilizationTimes.reduce((a, b) => a + b, 0);
    const avgUtilMin = utilizationTimes.length > 0 ? totalUtilMin / utilizationTimes.length : 0;

    // Calculate turnaround time
    const sortedFlights = [...standFlights].sort((a, b) => (a.gateEnd?.getTime() || 0) - (b.gateEnd?.getTime() || 0));
    const turnaroundTimes: number[] = [];
    for (let i = 0; i < sortedFlights.length - 1; i++) {
      const gap = getMinutesBetween(sortedFlights[i].gateEnd, sortedFlights[i + 1].gateStart);
      if (gap >= 0) turnaroundTimes.push(gap);
    }
    const avgTurnaroundMin = turnaroundTimes.length > 0 ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length : 0;

    // Determine stand type
    const hasArr = standFlights.some(f => f.arrStand === standId);
    const hasDep = standFlights.some(f => f.depStand === standId);
    const standType: 'arr' | 'dep' | 'mixed' = hasArr && hasDep ? 'mixed' : hasArr ? 'arr' : 'dep';

    // Peak hour
    let peakHour = 0;
    let maxFlights = 0;
    for (let h = 0; h < 24; h++) {
      const hourFlights = standFlights.filter(f => getHourFromDate(f.gateStart) === h).length;
      if (hourFlights > maxFlights) {
        maxFlights = hourFlights;
        peakHour = h;
      }
    }

    // Count conflicts
    let conflicts = 0;
    for (let i = 0; i < standFlights.length; i++) {
      for (let j = i + 1; j < standFlights.length; j++) {
        if (detectTimeConflict(standFlights[i].gateStart, standFlights[i].gateEnd, standFlights[j].gateStart, standFlights[j].gateEnd)) {
          conflicts++;
        }
      }
    }

    const totalMinutesInDay = 24 * 60;
    const utilizationPercent = (totalUtilMin / totalMinutesInDay) * 100;

    return {
      standId,
      totalFlights: standFlights.length,
      totalUtilizationMin: totalUtilMin,
      avgUtilizationMin: avgUtilMin,
      avgTurnaroundMin,
      standType,
      peakHour,
      hasConflicts: conflicts > 0,
      conflicts,
    };
  });

  // Calculate Belt Stats
  const beltStats: BeltStat[] = Array.from(beltMap.entries()).map(([beltId, beltFlights]) => {
    const totalPax = beltFlights.reduce((sum, f) => sum + (f.arrPax || 0), 0);
    
    // Calculate utilization time (from first ata to last ata + assumed baggage claim time of 30 min)
    const ataDates = beltFlights.map(f => f.ata).filter(d => d) as Date[];
    if (ataDates.length === 0) {
      return { beltId, arrivalFlights: 0, totalPassengers: 0, avgThroughputPerHour: 0, peakHour: 0, utilizationPercent: 0 };
    }

    const minAta = new Date(Math.min(...ataDates.map(d => d.getTime())));
    const maxAta = new Date(Math.max(...ataDates.map(d => d.getTime())));
    const utilizationMin = Math.max(30, getMinutesBetween(minAta, maxAta) + 30); // At least 30 minutes for last flight
    const throughputPerHour = (totalPax / utilizationMin) * 60;

    // Peak hour
    let peakHour = 0;
    let maxFlights = 0;
    for (let h = 0; h < 24; h++) {
      const hourFlights = beltFlights.filter(f => getHourFromDate(f.ata) === h).length;
      if (hourFlights > maxFlights) {
        maxFlights = hourFlights;
        peakHour = h;
      }
    }

    const totalMinutesInDay = 24 * 60;
    const utilizationPercent = (utilizationMin / totalMinutesInDay) * 100;

    return {
      beltId,
      arrivalFlights: beltFlights.length,
      totalPassengers: totalPax,
      avgThroughputPerHour: throughputPerHour,
      peakHour,
      utilizationPercent,
    };
  });

  // Calculate KPI Summary
  const avgGateUtilizationPercent = gateStats.length > 0 
    ? gateStats.reduce((sum, g) => sum + g.utilizationPercent, 0) / gateStats.length 
    : 0;

  const avgStandUtilizationPercent = standStats.length > 0 
    ? standStats.reduce((sum, s) => sum + (getMinutesBetween(new Date(0), new Date(s.totalUtilizationMin * 60 * 1000)) / (24 * 60)) * 100, 0) / standStats.length 
    : 0;

  const totalGateConflicts = gateStats.reduce((sum, g) => sum + g.conflicts, 0);
  const totalStandConflicts = standStats.reduce((sum, s) => sum + s.conflicts, 0);
  
  const avgBeltThroughputPerHour = beltStats.length > 0 
    ? beltStats.reduce((sum, b) => sum + b.avgThroughputPerHour, 0) / beltStats.length 
    : 0;

  return {
    dateRange: { start: dateStart, end: dateEnd },
    totalFlights: flights.length,
    gateStats: gateStats.sort((a, b) => b.totalFlights - a.totalFlights),
    standStats: standStats.sort((a, b) => b.totalFlights - a.totalFlights),
    beltStats: beltStats.sort((a, b) => b.arrivalFlights - a.arrivalFlights),
    hourlyMetrics,
    avgGateUtilizationPercent,
    avgStandUtilizationPercent,
    totalGateConflicts,
    totalStandConflicts,
    avgBeltThroughputPerHour,
  };
}

/**
 * Utility: Get top N gates/stands/belts by utilization
 */
export function getTopInfrastructure<T extends GateStat | StandStat | BeltStat>(
  items: T[],
  limit: number = 10
): T[] {
  return items.slice(0, limit);
}

/**
 * Utility: Get gates with conflicts
 */
export function getConflictingGates(gateStats: GateStat[]): GateStat[] {
  return gateStats.filter(g => g.hasConflicts).sort((a, b) => b.conflicts - a.conflicts);
}

/**
 * Utility: Get stands with conflicts
 */
export function getConflictingStands(standStats: StandStat[]): StandStat[] {
  return standStats.filter(s => s.hasConflicts).sort((a, b) => b.conflicts - a.conflicts);
}
