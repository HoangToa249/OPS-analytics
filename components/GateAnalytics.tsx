/**
 * Gate Analytics Component
 * Displays gate utilization heatmap and statistics
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { GateStat, HourlyInfraMetrics } from '../utils/infraAnalyticsService';

interface GateAnalyticsProps {
  gateStats: GateStat[];
  hourlyMetrics: HourlyInfraMetrics[];
}

const GateAnalytics: React.FC<GateAnalyticsProps> = ({ gateStats, hourlyMetrics }) => {
  // Prepare heatmap data
  const heatmapData = useMemo(() => {
    const top10Gates = gateStats.slice(0, 10).map(g => g.gateId);
    
    return hourlyMetrics.map(hourData => {
      const row: Record<string, any> = { hour: `${hourData.hour}:00` };
      top10Gates.forEach(gateId => {
        row[gateId] = hourData.gateOccupancy[gateId] || 0;
      });
      return row;
    });
  }, [gateStats, hourlyMetrics]);

  // Prepare utilization chart data
  const utilizationData = useMemo(() => {
    return gateStats.slice(0, 15).map(gate => ({
      gate: gate.gateId,
      utilization: gate.utilizationPercent,
      flights: gate.totalFlights,
      conflicts: gate.conflicts,
      hasConflict: gate.hasConflicts,
    }));
  }, [gateStats]);

  // Prepare scatter chart for capacity vs conflicts
  const scatterData = useMemo(() => {
    return gateStats.map(gate => ({
      name: gate.gateId,
      flights: gate.totalFlights,
      conflicts: gate.conflicts,
      utilization: gate.utilizationPercent,
    }));
  }, [gateStats]);

  return (
    <div className="space-y-6">
      {/* Utilization Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          🚪 Gate Utilization by Hour
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={utilizationData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="gate" type="category" width={50} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => (value as number).toFixed(1)}
            />
            <Bar dataKey="utilization" fill="#3b82f6" name="Utilization %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Occupancy Heatmap */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📅 Gate Occupancy Heatmap (Top 10)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Time</th>
                {gateStats.slice(0, 10).map(gate => (
                  <th key={gate.gateId} className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                    {gate.gateId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 font-semibold text-gray-700 dark:text-gray-300">
                    {row.hour}
                  </td>
                  {gateStats.slice(0, 10).map(gate => {
                    const minutes = row[gate.gateId] || 0;
                    const intensity = Math.min(minutes / 60, 1); // Normalize to 0-1 (60 min = 100%)
                    const bgColor = intensity === 0 
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`; // Blue scale
                    
                    return (
                      <td
                        key={`${gate.gateId}-${idx}`}
                        className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center text-xs text-gray-700 dark:text-gray-300"
                        style={{ backgroundColor: bgColor }}
                        title={`${minutes.toFixed(0)} min`}
                      >
                        {minutes > 0 ? minutes.toFixed(0) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflicts vs Traffic Scatter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          ⚠️ Gate Traffic vs Conflicts
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="flights" name="Number of Flights" />
            <YAxis dataKey="conflicts" name="Conflicts" />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => (value as number)}
            />
            <Scatter
              name="Gates"
              data={scatterData}
              fill="#3b82f6"
              shape="circle"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Gate Statistics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📊 Gate Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Gate</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Flights</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Utilization %</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Avg Time</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Peak Hour</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Conflicts</th>
              </tr>
            </thead>
            <tbody>
              {gateStats.slice(0, 20).map((gate) => (
                <tr key={gate.gateId} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{gate.gateId}</td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{gate.totalFlights}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${Math.min(gate.utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-xs">
                        {gate.utilizationPercent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {gate.avgUtilizationMin.toFixed(0)}m
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {gate.peakHour}:00
                  </td>
                  <td className="px-3 py-2 text-center">
                    {gate.conflicts > 0 ? (
                      <span className="inline-block px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold rounded">
                        {gate.conflicts}
                      </span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">-</span>
                    )}
                  </td>
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
