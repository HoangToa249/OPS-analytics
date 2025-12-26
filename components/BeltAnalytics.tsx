/**
 * Belt Analytics Component
 * Displays baggage carousel/belt utilization and throughput analysis
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { BeltStat, HourlyInfraMetrics } from '../utils/infraAnalyticsService';

interface BeltAnalyticsProps {
  beltStats: BeltStat[];
  hourlyMetrics: HourlyInfraMetrics[];
}

const BeltAnalytics: React.FC<BeltAnalyticsProps> = ({ beltStats, hourlyMetrics }) => {
  // Prepare utilization chart data
  const utilizationData = useMemo(() => {
    return beltStats.map(belt => ({
      belt: belt.beltId,
      throughput: belt.avgThroughputPerHour,
      flights: belt.arrivalFlights,
      passengers: belt.totalPassengers,
      utilization: belt.utilizationPercent,
    }));
  }, [beltStats]);

  // Prepare throughput comparison
  const throughputData = useMemo(() => {
    return beltStats
      .sort((a, b) => b.totalPassengers - a.totalPassengers)
      .map(belt => ({
        belt: belt.beltId,
        throughput: belt.avgThroughputPerHour,
        flights: belt.arrivalFlights,
      }));
  }, [beltStats]);

  // Hourly passenger distribution
  const hourlyPassengers = useMemo(() => {
    return hourlyMetrics.map(hourData => {
      let totalPax = 0;
      Object.values(hourData.beltPassengers).forEach(pax => {
        totalPax += pax;
      });
      return {
        hour: `${hourData.hour}:00`,
        passengers: totalPax,
      };
    });
  }, [hourlyMetrics]);

  // Hourly distribution by belt (top 5)
  const hourlyByBelt = useMemo(() => {
    const top5Belts = beltStats.slice(0, 5).map(b => b.beltId);
    return hourlyMetrics.map(hourData => {
      const row: Record<string, any> = { hour: `${hourData.hour}:00` };
      top5Belts.forEach(beltId => {
        row[beltId] = hourData.beltPassengers[beltId] || 0;
      });
      return row;
    });
  }, [beltStats, hourlyMetrics]);

  // Peak hours analysis
  const peakHours = useMemo(() => {
    const hourPeak: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourPeak[i] = 0;

    beltStats.forEach(belt => {
      hourPeak[belt.peakHour] = (hourPeak[belt.peakHour] || 0) + belt.totalPassengers;
    });

    return Object.entries(hourPeak)
      .map(([hour, pax]) => ({ hour: `${hour}:00`, passengers: pax }))
      .sort((a, b) => b.passengers - a.passengers)
      .slice(0, 5);
  }, [beltStats]);

  // Capacity utilization gauge
  const capacityUtilization = useMemo(() => {
    if (beltStats.length === 0) return 0;
    return (beltStats.reduce((sum, b) => sum + b.utilizationPercent, 0) / beltStats.length);
  }, [beltStats]);

  return (
    <div className="space-y-6">
      {/* Carousel/Belt Throughput Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          🎡 Belt Throughput (Passengers/Hour)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={throughputData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="belt" type="category" width={50} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toFixed(0)} pax/hr`}
            />
            <Bar dataKey="throughput" fill="#ec4899" name="Throughput (pax/hr)">
              {throughputData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={['#ec4899', '#f97316', '#f59e0b', '#10b981', '#3b82f6'][index % 5]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Passenger Distribution */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          👥 Hourly Passenger Distribution
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={hourlyPassengers}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis label={{ value: 'Passengers', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toLocaleString()} pax`}
            />
            <Line
              type="monotone"
              dataKey="passengers"
              stroke="#ec4899"
              strokeWidth={2}
              dot={{ fill: '#ec4899', r: 4 }}
              activeDot={{ r: 6 }}
              name="Total Passengers"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Belt Distribution by Hour (Top 5) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📅 Passengers by Belt (Top 5)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hourlyByBelt}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis label={{ value: 'Passengers', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toLocaleString()} pax`}
            />
            <Legend />
            {beltStats.slice(0, 5).map((belt, idx) => (
              <Bar
                key={belt.beltId}
                dataKey={belt.beltId}
                stackId="a"
                fill={['#ec4899', '#f97316', '#f59e0b', '#10b981', '#3b82f6'][idx]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Carousels</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{beltStats.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Passengers</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {(beltStats.reduce((sum, b) => sum + b.totalPassengers, 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Avg Throughput</p>
          <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {(beltStats.reduce((sum, b) => sum + b.avgThroughputPerHour, 0) / beltStats.length).toFixed(0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">pax/hour</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Avg Utilization</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 w-16 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-500"
                style={{ width: `${Math.min(capacityUtilization, 100)}%` }}
              />
            </div>
            <span className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {capacityUtilization.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Peak Hours */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          🔝 Peak Hours
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {peakHours.map((hour, idx) => (
            <div key={idx} className="bg-gradient-to-br from-pink-100 to-orange-100 dark:from-pink-900 dark:to-orange-900 rounded-lg p-4">
              <p className="text-sm text-pink-700 dark:text-pink-300 font-semibold">{hour.hour}</p>
              <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                {(hour.passengers / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-pink-600 dark:text-pink-400">passengers</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Belt Statistics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📊 Belt/Carousel Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                <th className="px-3 py-2 text-left text-gray-700 dark:text-gray-300">Belt</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Flights</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Total Passengers</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Throughput</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Peak Hour</th>
                <th className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {beltStats.map((belt) => (
                <tr key={belt.beltId} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-3 py-2 font-semibold text-gray-800 dark:text-gray-200">{belt.beltId}</td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">{belt.arrivalFlights}</td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {belt.totalPassengers.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {belt.avgThroughputPerHour.toFixed(0)} pax/hr
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 dark:text-gray-300">
                    {belt.peakHour}:00
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-pink-500"
                          style={{ width: `${Math.min(belt.utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-xs">
                        {belt.utilizationPercent.toFixed(1)}%
                      </span>
                    </div>
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

export default BeltAnalytics;
