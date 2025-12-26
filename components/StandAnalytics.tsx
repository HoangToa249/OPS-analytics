/**
 * Stand Analytics Component
 * Displays stand utilization, turnaround time, and efficiency metrics
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { StandStat, HourlyInfraMetrics } from '../utils/infraAnalyticsService';

interface StandAnalyticsProps {
  standStats: StandStat[];
  hourlyMetrics: HourlyInfraMetrics[];
}

const StandAnalytics: React.FC<StandAnalyticsProps> = ({ standStats, hourlyMetrics }) => {
  // Prepare utilization chart data
  const utilizationData = useMemo(() => {
    return standStats.slice(0, 15).map(stand => ({
      stand: stand.standId,
      flights: stand.totalFlights,
      utilization: (stand.totalUtilizationMin / (24 * 60)) * 100,
      turnaround: stand.avgTurnaroundMin,
      type: stand.standType,
    }));
  }, [standStats]);

  // Prepare turnaround comparison
  const turnaroundData = useMemo(() => {
    return standStats
      .sort((a, b) => b.totalFlights - a.totalFlights)
      .slice(0, 12)
      .map(stand => ({
        stand: stand.standId,
        turnaround: stand.avgTurnaroundMin,
        flights: stand.totalFlights,
      }));
  }, [standStats]);

  // Prepare occupancy by hour
  const hourlyOccupancy = useMemo(() => {
    const top5Stands = standStats.slice(0, 5).map(s => s.standId);
    return hourlyMetrics.map(hourData => {
      const row: Record<string, any> = { hour: `${hourData.hour}:00` };
      top5Stands.forEach(standId => {
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
      { type: 'Arrival Only', count: arrCount },
      { type: 'Departure Only', count: depCount },
      { type: 'Mixed (A/D)', count: mixedCount },
    ];
  }, [standStats]);

  return (
    <div className="space-y-6">
      {/* Stand Utilization Bar Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          🏢 Stand Utilization Overview
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={utilizationData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="stand" type="category" width={60} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => typeof value === 'number' ? (value as number).toFixed(1) : value}
            />
            <Legend />
            <Bar dataKey="flights" fill="#8b5cf6" name="Flights" />
            <Bar dataKey="utilization" fill="#10b981" name="Utilization %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Turnaround Time Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          ⏱️ Average Turnaround Time by Stand
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={turnaroundData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stand" />
            <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toFixed(0)}m`}
            />
            <Line
              type="monotone"
              dataKey="turnaround"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: '#f97316', r: 4 }}
              activeDot={{ r: 6 }}
              name="Turnaround Time"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Occupancy (Top 5 Stands) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📅 Hourly Occupancy (Top 5 Stands)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hourlyOccupancy}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toFixed(0)}m`}
            />
            <Legend />
            {standStats.slice(0, 5).map((stand, idx) => (
              <Bar
                key={stand.standId}
                dataKey={stand.standId}
                stackId="a"
                fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Stand Type Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {typeDistribution.map((item) => (
          <div key={item.type} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.type}</p>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{item.count}</p>
          </div>
        ))}
      </div>

      {/* Detailed Stand Statistics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📊 Stand Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Stand</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Type</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Flights</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Utilization</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Avg Time</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Turnaround</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Peak Hour</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Conflicts</th>
              </tr>
            </thead>
            <tbody>
              {standStats.slice(0, 20).map((stand) => (
                <tr key={stand.standId} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{stand.standId}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded">
                      {stand.standType === 'arr' ? 'ARR' : stand.standType === 'dep' ? 'DEP' : 'A/D'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{stand.totalFlights}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${Math.min((stand.totalUtilizationMin / (24 * 60)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-xs w-12">
                        {((stand.totalUtilizationMin / (24 * 60)) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {stand.avgUtilizationMin.toFixed(0)}m
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {stand.avgTurnaroundMin.toFixed(0)}m
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {stand.peakHour}:00
                  </td>
                  <td className="px-3 py-2 text-center">
                    {stand.conflicts > 0 ? (
                      <span className="inline-block px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold rounded">
                        {stand.conflicts}
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

export default StandAnalytics;
