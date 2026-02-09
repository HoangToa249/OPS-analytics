/**
 * Belt Analytics Component - IMPROVED
 * Displays baggage carousel/belt utilization and throughput analysis with better visualization
 */

import React, { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell, PieChart, Pie } from 'recharts';
import { BeltStat, HourlyInfraMetrics } from '../utils/infraAnalyticsService';
import { TrendingUp } from 'lucide-react';

interface BeltAnalyticsProps {
  beltStats: BeltStat[];
  hourlyMetrics: HourlyInfraMetrics[];
}

const BeltAnalytics: React.FC<BeltAnalyticsProps> = ({ beltStats, hourlyMetrics }) => {
  // Prepare utilization chart data - IMPROVED: better color coding
  const utilizationData = useMemo(() => {
    return beltStats.map(belt => ({
      belt: belt.beltId,
      throughput: belt.avgThroughputPerHour,
      flights: belt.arrivalFlights,
      passengers: belt.totalPassengers,
      utilization: belt.utilizationPercent,
    }));
  }, [beltStats]);

  // Prepare throughput comparison - IMPROVED: sorted by throughput
  const throughputData = useMemo(() => {
    return beltStats
      .sort((a, b) => b.avgThroughputPerHour - a.avgThroughputPerHour)
      .map(belt => ({
        belt: belt.beltId,
        throughput: belt.avgThroughputPerHour,
        flights: belt.arrivalFlights,
        passengers: belt.totalPassengers,
      }));
  }, [beltStats]);

  // Hourly passenger distribution - IMPROVED: with trend line
  const hourlyPassengers = useMemo(() => {
    return hourlyMetrics.map(hourData => {
      let totalPax = 0;
      Object.values(hourData.beltPassengers).forEach(pax => {
        totalPax += pax;
      });
      return {
        hour: `${String(hourData.hour).padStart(2, '0')}:00`,
        hourNum: hourData.hour,
        passengers: totalPax,
      };
    });
  }, [hourlyMetrics]);

  // Hourly distribution by belt (top 5)
  const hourlyByBelt = useMemo(() => {
    const top5Belts = beltStats.slice(0, 5).map(b => b.beltId);
    return hourlyMetrics.map(hourData => {
      const row: Record<string, any> = { 
        hour: `${String(hourData.hour).padStart(2, '0')}:00`,
        hourNum: hourData.hour
      };
      top5Belts.forEach(beltId => {
        row[beltId] = hourData.beltPassengers[beltId] || 0;
      });
      return row;
    });
  }, [beltStats, hourlyMetrics]);

  // Peak hours analysis - IMPROVED: based on passenger volume
  const peakHours = useMemo(() => {
    const hourPeak: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourPeak[i] = 0;

    beltStats.forEach(belt => {
      hourPeak[belt.peakHour] = (hourPeak[belt.peakHour] || 0) + belt.totalPassengers;
    });

    return Object.entries(hourPeak)
      .map(([hour, pax]) => ({ hour: `${String(hour).padStart(2, '0')}:00`, hourNum: parseInt(hour), passengers: pax }))
      .sort((a, b) => b.passengers - a.passengers)
      .slice(0, 5);
  }, [beltStats]);

  // Capacity utilization gauge
  const capacityUtilization = useMemo(() => {
    if (beltStats.length === 0) return 0;
    return (beltStats.reduce((sum, b) => sum + b.utilizationPercent, 0) / beltStats.length);
  }, [beltStats]);

  // Belt distribution by passenger volume
  const beltDistribution = useMemo(() => {
    const totalPax = beltStats.reduce((sum, b) => sum + b.totalPassengers, 0);
    return beltStats
      .sort((a, b) => b.totalPassengers - a.totalPassengers)
      .slice(0, 8)
      .map(belt => ({
        name: belt.beltId,
        value: belt.totalPassengers,
        percentage: ((belt.totalPassengers / totalPax) * 100).toFixed(1),
      }));
  }, [beltStats]);

  const COLORS = ['#ec4899', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#ef4444'];

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg">
      {/* KPI Summary Cards - IMPROVED positioning */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900 dark:to-pink-800 rounded-lg shadow-md p-5 border border-pink-200 dark:border-pink-700">
          <p className="text-sm text-pink-700 dark:text-pink-300 font-bold mb-2">Total Belts</p>
          <p className="text-4xl font-bold text-pink-900 dark:text-pink-100">{beltStats.length}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 rounded-lg shadow-md p-5 border border-orange-200 dark:border-orange-700">
          <p className="text-sm text-orange-700 dark:text-orange-300 font-bold mb-2">Total Passengers</p>
          <p className="text-4xl font-bold text-orange-900 dark:text-orange-100">
            {(beltStats.reduce((sum, b) => sum + b.totalPassengers, 0) / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 rounded-lg shadow-md p-5 border border-blue-200 dark:border-blue-700">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-bold mb-2">Avg Throughput</p>
          <p className="text-4xl font-bold text-blue-900 dark:text-blue-100">
            {(beltStats.length > 0 ? beltStats.reduce((sum, b) => sum + b.avgThroughputPerHour, 0) / beltStats.length : 0).toFixed(0)}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">pax/hr</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900 dark:to-green-800 rounded-lg shadow-md p-5 border border-green-200 dark:border-green-700">
          <p className="text-sm text-green-700 dark:text-green-300 font-bold mb-2">Avg Utilization</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 w-16 h-2 bg-green-300 dark:bg-green-600 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  capacityUtilization > 70 ? 'bg-red-600 dark:bg-red-400' : capacityUtilization > 50 ? 'bg-yellow-600 dark:bg-yellow-400' : 'bg-green-600 dark:bg-green-400'
                }`}
                style={{ width: `${Math.min(capacityUtilization, 100)}%` }}
              />
            </div>
            <span className="text-xl font-bold text-green-900 dark:text-green-100">
              {capacityUtilization.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Hourly Passenger Distribution - IMPROVED: better line chart */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-5 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50 mb-4 flex items-center">
          👥 Hourly Passenger Distribution
          <span className="text-sm font-normal text-gray-600 dark:text-gray-400 ml-2">All Belts</span>
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={hourlyPassengers}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" />
            <YAxis label={{ value: 'Passengers', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toLocaleString()} pax`}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="passengers"
              stroke="#ec4899"
              strokeWidth={3}
              dot={{ fill: '#ec4899', r: 5 }}
              activeDot={{ r: 8 }}
              isAnimationActive={true}
              name="Total Passengers"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Throughput Comparison - IMPROVED: sorted & colored */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
          🎡 Belt Throughput Ranking (pax/hour)
          <TrendingUp className="ml-2" size={18} />
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={throughputData} layout="vertical" margin={{ left: 50, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="belt" type="category" width={50} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toFixed(0)} pax/hr`}
              labelFormatter={(label) => `Belt: ${label}`}
            />
            <Bar dataKey="throughput" fill="#ec4899" name="Throughput (pax/hr)">
              {throughputData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Hourly Distribution by Top 5 Belts */}
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
                fill={COLORS[idx]}
                name={belt.beltId}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Peak Hours - IMPROVED: detailed breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          🔝 Peak Hours (by passenger volume)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {peakHours.map((hour, idx) => (
            <div key={idx} className="bg-gradient-to-br from-pink-100 to-orange-100 dark:from-pink-900 dark:to-orange-900 rounded-lg p-4 hover:shadow-lg transition">
              <p className="text-sm font-semibold text-pink-700 dark:text-pink-300 mb-1">#{idx + 1}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{hour.hour}</p>
              <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                {(hour.passengers / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-pink-600 dark:text-pink-400">passengers</p>
            </div>
          ))}
        </div>
      </div>

      {/* Belt Distribution Pie Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📊 Passenger Distribution by Belt (Top 8)
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={beltDistribution}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name}: ${percentage}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {beltDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              formatter={(value: any) => `${(value as number).toLocaleString()} pax`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Belt Statistics Table - IMPROVED */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          📈 Detailed Belt/Carousel Statistics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-gray-700 dark:text-gray-300 font-semibold">Belt ID</th>
                <th className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold">Flights</th>
                <th className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold">Total Pax</th>
                <th className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold">Throughput</th>
                <th className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold">Peak Hour</th>
                <th className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-semibold">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {beltStats.map((belt, idx) => (
                <tr key={belt.beltId} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2 font-semibold text-gray-800 dark:text-gray-200">{belt.beltId}</td>
                  <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">{belt.arrivalFlights}</td>
                  <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-medium">
                    {belt.totalPassengers.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300 font-medium">
                    {belt.avgThroughputPerHour.toFixed(0)}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                    {String(belt.peakHour).padStart(2, '0')}:00
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 h-2.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            belt.utilizationPercent > 70
                              ? 'bg-red-500'
                              : belt.utilizationPercent > 50
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(belt.utilizationPercent, 100)}%` }}
                        />
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 text-xs font-medium w-12">
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
