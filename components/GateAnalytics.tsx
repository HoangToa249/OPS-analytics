/**
 * Gate Analytics Component - IMPROVED
 * Displays gate utilization heatmap and statistics with better visualization
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LineChart, Line, ComposedChart } from 'recharts';
import { GateStat, HourlyInfraMetrics } from '../utils/infraAnalyticsService';
import { AlertTriangle, TrendingUp } from 'lucide-react';

interface GateAnalyticsProps {
  gateStats: GateStat[];
  hourlyMetrics: HourlyInfraMetrics[];
}

// Color scale for heatmap intensity
const getHeatmapColor = (intensity: number): string => {
  if (intensity === 0) return '#f3f4f6';
  if (intensity < 0.2) return '#e0f2fe';
  if (intensity < 0.4) return '#7dd3fc';
  if (intensity < 0.6) return '#0284c7';
  if (intensity < 0.8) return '#0369a1';
  return '#082f49';
};

const GateAnalytics: React.FC<GateAnalyticsProps> = ({ gateStats, hourlyMetrics }) => {
  // Prepare heatmap data - IMPROVED: more gates, better formatting
  const heatmapData = useMemo(() => {
    const topGates = gateStats.slice(0, 15).map(g => g.gateId);
    
    return hourlyMetrics.map(hourData => {
      const row: Record<string, any> = { 
        hour: `${String(hourData.hour).padStart(2, '0')}:00`,
        hourNum: hourData.hour
      };
      topGates.forEach(gateId => {
        row[gateId] = hourData.gateOccupancy[gateId] || 0;
      });
      return row;
    });
  }, [gateStats, hourlyMetrics]);

  // Prepare utilization chart data - IMPROVED: color coding by utilization level
  const utilizationData = useMemo(() => {
    return gateStats.slice(0, 15).map(gate => ({
      gate: gate.gateId,
      utilization: gate.utilizationPercent,
      flights: gate.totalFlights,
      conflicts: gate.conflicts,
      hasConflict: gate.hasConflicts,
      avgUtil: gate.avgUtilizationMin,
    }));
  }, [gateStats]);

  // Prepare scatter chart for capacity vs conflicts - IMPROVED: better formatting
  const scatterData = useMemo(() => {
    return gateStats.map(gate => ({
      name: gate.gateId,
      flights: gate.totalFlights,
      conflicts: gate.conflicts,
      utilization: gate.utilizationPercent,
      avgUtil: gate.avgUtilizationMin,
    }));
  }, [gateStats]);

  // Hourly occupancy trend
  const hourlyTrendData = useMemo(() => {
    return hourlyMetrics.map(hourData => {
      const totalOccupancy = Object.values(hourData.gateOccupancy).reduce((a, b) => a + b, 0);
      const avgPerGate = gateStats.length > 0 ? totalOccupancy / gateStats.length : 0;
      return {
        hour: `${String(hourData.hour).padStart(2, '0')}:00`,
        totalOccupancy,
        avgPerGate,
        conflicts: hourData.gateConflicts,
      };
    });
  }, [gateStats, hourlyMetrics]);

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg">
      {/* Hourly Occupancy Trend */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
          📈 Hourly Gate Occupancy Trend
          <span className="text-sm font-normal text-gray-600 dark:text-gray-400">(Aggregate & Conflicts)</span>
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={hourlyTrendData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fill: '#6b7280' }} />
            <YAxis yAxisId="left" label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fill: '#6b7280' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'Conflicts', angle: 90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fill: '#6b7280' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '2px solid #3b82f6', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => (value as number).toFixed(1)}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar yAxisId="left" dataKey="totalOccupancy" fill="#3b82f6" name="Total Minutes" radius={[4, 4, 0, 0]} />
            <Line yAxisId="left" type="monotone" dataKey="avgPerGate" stroke="#10b981" strokeWidth={3} name="Avg/Gate" dot={{ fill: '#10b981', r: 5 }} />
            <Line yAxisId="right" type="stepAfter" dataKey="conflicts" stroke="#ef4444" strokeWidth={2.5} name="Conflicts" dot={{ fill: '#ef4444', r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Utilization Bar Chart - IMPROVED: color coding */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
          🚪 Gate Utilization (%) - Top 15
        </h3>
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={utilizationData} layout="vertical" margin={{ left: 70, right: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fill: '#6b7280' }} />
            <YAxis dataKey="gate" type="category" width={60} tick={{ fill: '#6b7280', fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '2px solid #3b82f6', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => [(value as number).toFixed(1) + '%', 'Utilization']
              }
              labelFormatter={(label) => `Gate: ${label}`}
            />
            <Bar dataKey="utilization" fill="#3b82f6" name="Utilization %" radius={[0, 8, 8, 0]}>
              {utilizationData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={entry.utilization > 70 ? '#ef4444' : entry.utilization > 50 ? '#f59e0b' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900 rounded">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-sm text-red-700 dark:text-red-200 font-medium">High (&gt;70%)</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900 rounded">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span className="text-sm text-yellow-700 dark:text-yellow-200 font-medium">Medium (50-70%)</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900 rounded">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-sm text-blue-700 dark:text-blue-200 font-medium">Normal (&lt;50%)</span>
          </div>
        </div>
      </div>

      {/* Gate Traffic vs Conflicts - Bar + Trendline */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
          ⚠️ Gate Traffic vs Conflicts (Trend Analysis)
          {scatterData.some(d => d.conflicts > 0) && (
            <div className="flex items-center ml-3 px-3 py-1 bg-red-100 dark:bg-red-900 rounded-full">
              <AlertTriangle size={16} className="mr-2 text-red-600 dark:text-red-400" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                {scatterData.filter(d => d.conflicts > 0).length} gates with conflicts
              </span>
            </div>
          )}
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={scatterData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis yAxisId="left" label={{ value: 'Flights', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fill: '#6b7280' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'Conflicts', angle: 90, position: 'insideRight', style: { fill: '#6b7280' } }} tick={{ fill: '#6b7280' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '2px solid #3b82f6', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => (value as number).toFixed(0)}
            />
            <Legend wrapperStyle={{ paddingTop: '15px' }} />
            <Bar yAxisId="left" dataKey="flights" fill="#3b82f6" name="Flights" opacity={0.8} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="conflicts" stroke="#ef4444" strokeWidth={2.5} name="Conflicts" dot={{ fill: '#ef4444', r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Gate Occupancy Heatmap - IMPROVED: better dark mode colors */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-3">
          📅 Gate Occupancy Heatmap (Top 15 Gates)
        </h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">Color intensity = occupancy minutes per hour (darker = more occupied)</p>
        <div className="overflow-x-auto border border-gray-300 dark:border-gray-600 rounded-lg">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-800 sticky top-0">
                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-bold text-gray-900 dark:text-gray-100">Time</th>
                {gateStats.slice(0, 15).map(gate => (
                  <th key={gate.gateId} className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-bold text-gray-900 dark:text-gray-100 min-w-[40px]">
                    {gate.gateId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-bold text-gray-900 dark:text-white sticky left-0 bg-gray-100 dark:bg-gray-800 z-10">
                    {row.hour}
                  </td>
                  {gateStats.slice(0, 15).map(gate => {
                    const minutes = row[gate.gateId] || 0;
                    const intensity = Math.min(minutes / 60, 1);
                    const bgColor = getHeatmapColor(intensity);
                    // Use white text for better contrast - always readable
                    const textColor = intensity > 0.15 ? '#ffffff' : '#1f2937';
                    const fontWeight = intensity > 0.5 ? 'bold' : 'semibold';
                    
                    return (
                      <td
                        key={`${gate.gateId}-${idx}`}
                        className={`border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-${fontWeight} min-w-[40px] shadow-sm`}
                        style={{ backgroundColor: bgColor, color: textColor, textShadow: intensity < 0.2 ? '0 0 1px rgba(0,0,0,0.3)' : 'none' }}
                        title={`${gate.gateId}: ${minutes.toFixed(0)} min`}
                      >
                        {minutes > 5 ? minutes.toFixed(0) : minutes > 0 ? '▪' : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gate Statistics Table - IMPROVED: better formatting and sorting */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
          📊 Gate Statistics Summary
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200 dark:bg-gray-800">
              <tr>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-left font-bold text-gray-900 dark:text-gray-100">Gate</th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Flights</th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Util %</th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Avg Use</th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Conflicts</th>
                <th className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-gray-900 dark:text-gray-100">Peak Hour</th>
              </tr>
            </thead>
            <tbody>
              {gateStats.map((gate, idx) => (
                <tr key={gate.gateId} className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-bold text-gray-900 dark:text-gray-100">{gate.gateId}</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-gray-700 dark:text-gray-300">{gate.totalFlights}</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                    <span className={gate.utilizationPercent > 70 ? 'text-red-600 dark:text-red-400 font-bold' : gate.utilizationPercent > 50 ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-green-600 dark:text-green-400'}>
                      {gate.utilizationPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-gray-700 dark:text-gray-300">{gate.avgUtilizationMin.toFixed(0)}m</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                    {gate.conflicts > 0 ? (
                      <span className="inline-block bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-3 py-1 rounded-full text-xs font-bold">
                        {gate.conflicts} ⚠️
                      </span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400 font-semibold">✓ None</span>
                    )}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold">{String(gate.peakHour).padStart(2, '0')}:00</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GateAnalytics;
