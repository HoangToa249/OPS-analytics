/**
 * Stand Analytics Component - IMPROVED
 * Displays stand utilization, turnaround time, and efficiency metrics
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell, ScatterChart, Scatter } from 'recharts';
import { StandStat, HourlyInfraMetrics } from '../utils/infraAnalyticsService';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface StandAnalyticsProps {
  standStats: StandStat[];
  hourlyMetrics: HourlyInfraMetrics[];
}

const StandAnalytics: React.FC<StandAnalyticsProps> = ({ standStats, hourlyMetrics }) => {
  // Prepare turnaround comparison - IMPROVED: color by efficiency
  const turnaroundData = useMemo(() => {
    return standStats
      .sort((a, b) => a.avgTurnaroundMin - b.avgTurnaroundMin)
      .slice(0, 12)
      .map(stand => ({
        stand: stand.standId,
        turnaround: stand.avgTurnaroundMin,
        flights: stand.totalFlights,
        type: stand.standType,
      }));
  }, [standStats]);

  // Prepare occupancy by hour - IMPROVED: top 8 stands
  const hourlyOccupancy = useMemo(() => {
    const top8Stands = standStats.slice(0, 8).map(s => s.standId);
    return hourlyMetrics.map(hourData => {
      const row: Record<string, any> = { 
        hour: `${String(hourData.hour).padStart(2, '0')}:00`,
        hourNum: hourData.hour
      };
      top8Stands.forEach(standId => {
        row[standId] = hourData.standOccupancy[standId] || 0;
      });
      return row;
    });
  }, [standStats, hourlyMetrics]);

  // Stand type distribution
  const typeDistribution = useMemo(() => {
    const arrCount = standStats.filter(s => s.standType === 'arr').length;
    const depCount = standStats.filter(s => s.standType === 'dep').length;
    const mixedCount = standStats.filter(s => s.standType === 'mixed').length;
    
    return [
      { type: 'Arrival Only', count: arrCount, color: '#3b82f6' },
      { type: 'Departure Only', count: depCount, color: '#ef4444' },
      { type: 'Mixed (A/D)', count: mixedCount, color: '#10b981' },
    ];
  }, [standStats]);

  // Avg turnaround
  const avgTurnaround = useMemo(() => {
    return standStats.length > 0
      ? standStats.reduce((sum, s) => sum + s.avgTurnaroundMin, 0) / standStats.length
      : 0;
  }, [standStats]);

  const getStandTypeLabel = (type: string) => {
    const labels: Record<string, string> = { arr: 'Arrival', dep: 'Departure', mixed: 'Mixed' };
    return labels[type] || type;
  };

  const getStandTypeColor = (type: string) => {
    const colors: Record<string, string> = { arr: '#3b82f6', dep: '#ef4444', mixed: '#10b981' };
    return colors[type] || '#6b7280';
  };

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg shadow-md p-5 border border-blue-200 dark:border-blue-700">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-bold mb-2">Total Stands</p>
          <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">{standStats.length}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg shadow-md p-5 border border-orange-200 dark:border-orange-700">
          <p className="text-sm text-orange-700 dark:text-orange-300 font-bold mb-2">Avg Turnaround</p>
          <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">{avgTurnaround.toFixed(0)}</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold">minutes</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg shadow-md p-5 border border-green-200 dark:border-green-700">
          <p className="text-sm text-green-700 dark:text-green-300 font-bold mb-2">Total Flights</p>
          <p className="text-4xl font-bold text-green-900 dark:text-green-100">
            {standStats.reduce((sum, s) => sum + s.totalFlights, 0)}
          </p>
        </div>
      </div>

      {/* Turnaround Time Analysis - IMPROVED: better sorting */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
          ⏱️ Average Turnaround Time by Stand (Top 12)
          <span className="text-xs font-normal text-gray-600 dark:text-gray-400">Best to Worst</span>
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={turnaroundData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="stand" tick={{ fill: '#6b7280' }} />
            <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fill: '#6b7280' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '2px solid #f97316', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => `${(value as number).toFixed(0)} min`}
              labelFormatter={(label) => `Stand: ${label}`}
            />
            <Legend wrapperStyle={{ paddingTop: '15px' }} />
            <Line
              type="monotone"
              dataKey="turnaround"
              stroke="#f97316"
              strokeWidth={3}
              dot={{ fill: '#f97316', r: 5 }}
              activeDot={{ r: 7 }}
              name="Turnaround Time"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Occupancy (Top 8 Stands) - IMPROVED: stacked and better colors */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
          📅 Hourly Stand Occupancy (Top 8)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hourlyOccupancy} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" tick={{ fill: '#6b7280' }} />
            <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }} tick={{ fill: '#6b7280' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '2px solid #8b5cf6', borderRadius: '8px', color: '#fff' }}
              formatter={(value: any) => `${(value as number).toFixed(0)}m`}
            />
            <Legend wrapperStyle={{ paddingTop: '15px' }} />
            {standStats.slice(0, 8).map((stand, idx) => (
              <Bar
                key={stand.standId}
                dataKey={stand.standId}
                stackId="a"
                fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'][idx]}
                name={stand.standId}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stand Type Distribution - IMPROVED: better layout */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4">
          🏷️ Stand Type Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {typeDistribution.map((item) => (
            <div key={item.type} className="rounded-lg p-5 text-center border-l-4 shadow-md transition hover:shadow-lg" style={{ borderColor: item.color, backgroundColor: item.color + '10' }}>
              <p className="text-sm font-bold mb-2" style={{ color: item.color }}>{item.type}</p>
              <p className="text-5xl font-bold mb-2" style={{ color: item.color }}>
                {item.count}
              </p>
              <p className="text-sm" style={{ color: item.color }}>
                ({((item.count / standStats.length) * 100).toFixed(1)}%)
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stand Statistics Table - IMPROVED: comprehensive details */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4 flex items-center gap-2">
          📊 Detailed Stand Statistics
          <span className="text-xs font-normal text-gray-600 dark:text-gray-400">Sorted by flights</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-200 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-gray-900 dark:text-gray-100 font-bold">Stand</th>
                <th className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-bold">Type</th>
                <th className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-bold">Flights</th>
                <th className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-bold">Turnaround</th>
                <th className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-bold">Conflicts</th>
                <th className="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-bold">Peak Hour</th>
              </tr>
            </thead>
            <tbody>
              {standStats.map((stand) => {
                return (
                  <tr key={stand.standId} className="border-b border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{stand.standId}</td>
                    <td className="px-4 py-3 text-center">
                      <span 
                        className="inline-block px-3 py-1 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: getStandTypeColor(stand.standType) }}
                      >
                        {getStandTypeLabel(stand.standType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">{stand.totalFlights}</td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">
                      {stand.avgTurnaroundMin.toFixed(0)} m
                    </td>
                    <td className="px-4 py-3 text-center">
                      {stand.conflicts > 0 ? (
                        <span className="inline-block bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-3 py-1 rounded-full text-xs font-bold">
                          {stand.conflicts} ⚠️
                        </span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 font-semibold">✓ None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">
                      {String(stand.peakHour).padStart(2, '0')}:00
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StandAnalytics;
