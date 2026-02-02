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

    // FIXED: Stand occupancy - handle both arrStand and depStand
    // Case 1: Paired flight (arrStand === depStand) → occupancy from STA to STD
    // Case 2: Separate stands → arrStand: ATA to STA, depStand: STD to ATD
    
    // Arrival Stand
    if (flight.arrStand) {
      if (!standArrMap.has(flight.arrStand)) standArrMap.set(flight.arrStand, []);
      standArrMap.get(flight.arrStand)!.push(flight);

      let standStart: Date | null = null;
      let standEnd: Date | null = null;
      
      // Check if this is a paired flight (arrStand === depStand and both std and sta exist)
      const isPaired = flight.arrStand === flight.depStand && flight.std;
      
      if (isPaired) {
        // Paired: occupancy from arrival (STA/ATA) to departure (STD)
        standStart = flight.sta || flight.ata;
        standEnd = flight.std;
      } else {
        // Arrival only: occupancy from arrival (ATA/STA) to departure (ATD)
        standStart = flight.ata || flight.sta;
        standEnd = flight.atd;
      }
      
      if (standStart && standEnd) {
        const utilMin = getMinutesBetween(standStart, standEnd);
        const hour = getHourFromDate(standStart);
        const occupiedThisHour = Math.min(utilMin, 60);
        hourlyMetrics[hour].standOccupancy[flight.arrStand] = (hourlyMetrics[hour].standOccupancy[flight.arrStand] || 0) + occupiedThisHour;
      }
    }

    // Departure Stand (only if different from arrStand)
    if (flight.depStand && flight.depStand !== flight.arrStand) {
      if (!standDepMap.has(flight.depStand)) standDepMap.set(flight.depStand, []);
      standDepMap.get(flight.depStand)!.push(flight);

      // Departure only: occupancy from STD to ATD
      const standStart = flight.std;
      const standEnd = flight.atd;
      
      if (standStart && standEnd) {
        const utilMin = getMinutesBetween(standStart, standEnd);
        const hour = getHourFromDate(standStart);
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

  // FIXED: Stand conflict detection - use proper stand occupancy times, not gate times
  for (const [standId, standFlights] of standArrMap.entries()) {
    for (let i = 0; i < standFlights.length; i++) {
      for (let j = i + 1; j < standFlights.length; j++) {
        const flight1 = standFlights[i];
        const flight2 = standFlights[j];
        // Stand occupancy: STA/ATA to STD (arrival to departure of same pair)
        const flight1Start = flight1.sta || flight1.ata;
        const flight1End = flight1.std;
        const flight2Start = flight2.sta || flight2.ata;
        const flight2End = flight2.std;
        
        if (detectTimeConflict(flight1Start, flight1End, flight2Start, flight2End)) {
          const hour = getHourFromDate(flight1Start);
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

  // Calculate Stand Stats - process both arrival and departure maps
  const allStandMaps = new Map<string, Flight[]>();
  
  // Merge both maps
  for (const [standId, flights] of standArrMap) {
    allStandMaps.set(standId, flights);
  }
  for (const [standId, flights] of standDepMap) {
    if (allStandMaps.has(standId)) {
      // Already exists from arrStand, merge flights
      allStandMaps.get(standId)!.push(...flights);
    } else {
      allStandMaps.set(standId, flights);
    }
  }

  const standStats: StandStat[] = Array.from(allStandMaps.entries()).map(([standId, allFlights]) => {
    // Calculate utilization - need to recalculate using correct occupancy times
    const utilizationTimes = allFlights.map(f => {
      const isPaired = f.arrStand === f.depStand && f.std;
      let start: Date | null = null;
      let end: Date | null = null;
      
      if (f.arrStand === standId) {
        // Arrival stand occupancy
        if (isPaired) {
          start = f.sta || f.ata;
          end = f.std;
        } else {
          start = f.ata || f.sta;
          end = f.atd;
        }
      } else if (f.depStand === standId) {
        // Departure stand occupancy
        start = f.std;
        end = f.atd;
      }
      
      return getMinutesBetween(start, end);
    });
    
    const totalUtilMin = utilizationTimes.reduce((a, b) => a + b, 0);
    const avgUtilMin = utilizationTimes.length > 0 ? totalUtilMin / utilizationTimes.length : 0;

    // Calculate turnaround time - gap between consecutive flights at same stand
    const sortedFlights = [...allFlights].sort((a, b) => {
      const aEnd = a.depStand === standId ? a.atd : a.std;
      const bEnd = b.depStand === standId ? b.atd : b.std;
      return (aEnd?.getTime() || 0) - (bEnd?.getTime() || 0);
    });
    
    const turnaroundTimes: number[] = [];
    for (let i = 0; i < sortedFlights.length - 1; i++) {
      const flight1 = sortedFlights[i];
      const flight2 = sortedFlights[i + 1];
      
      // End time of flight 1 at this stand
      let flight1End: Date | null = null;
      if (flight1.arrStand === standId) {
        flight1End = flight1.atd || flight1.std;
      } else if (flight1.depStand === standId) {
        flight1End = flight1.atd;
      }
      
      // Start time of flight 2 at this stand
      let flight2Start: Date | null = null;
      if (flight2.arrStand === standId) {
        flight2Start = flight2.sta || flight2.ata;
      } else if (flight2.depStand === standId) {
        flight2Start = flight2.std;
      }
      
      const gap = getMinutesBetween(flight1End, flight2Start);
      if (gap >= 0) turnaroundTimes.push(gap);
    }
    const avgTurnaroundMin = turnaroundTimes.length > 0 ? turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length : 0;

    // Determine stand type
    const hasArr = allFlights.some(f => f.arrStand === standId);
    const hasDep = allFlights.some(f => f.depStand === standId);
    const standType: 'arr' | 'dep' | 'mixed' = hasArr && hasDep ? 'mixed' : hasArr ? 'arr' : 'dep';

    // Peak hour
    let peakHour = 0;
    let maxFlights = 0;
    for (let h = 0; h < 24; h++) {
      const hourFlights = allFlights.filter(f => {
        const hour = f.arrStand === standId ? getHourFromDate(f.sta || f.ata) : getHourFromDate(f.std);
        return hour === h;
      }).length;
      if (hourFlights > maxFlights) {
        maxFlights = hourFlights;
        peakHour = h;
      }
    }

    // Count conflicts
    let conflicts = 0;
    for (let i = 0; i < allFlights.length; i++) {
      for (let j = i + 1; j < allFlights.length; j++) {
        const flight1 = allFlights[i];
        const flight2 = allFlights[j];
        
        // Get occupancy times for flight1 at standId
        let flight1Start: Date | null = null;
        let flight1End: Date | null = null;
        if (flight1.arrStand === standId) {
          const isPaired = flight1.arrStand === flight1.depStand && flight1.std;
          flight1Start = flight1.sta || flight1.ata;
          flight1End = isPaired ? flight1.std : flight1.atd;
        } else if (flight1.depStand === standId) {
          flight1Start = flight1.std;
          flight1End = flight1.atd;
        }
        
        // Get occupancy times for flight2 at standId
        let flight2Start: Date | null = null;
        let flight2End: Date | null = null;
        if (flight2.arrStand === standId) {
          const isPaired = flight2.arrStand === flight2.depStand && flight2.std;
          flight2Start = flight2.sta || flight2.ata;
          flight2End = isPaired ? flight2.std : flight2.atd;
        } else if (flight2.depStand === standId) {
          flight2Start = flight2.std;
          flight2End = flight2.atd;
        }
        
        if (detectTimeConflict(flight1Start, flight1End, flight2Start, flight2End)) {
          conflicts++;
        }
      }
    }

    const totalMinutesInDay = 24 * 60;
    const utilizationPercent = (totalUtilMin / totalMinutesInDay) * 100;

    return {
      standId,
      totalFlights: allFlights.length,
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
