/**
 * Infrastructure Analytics Tab
 * Main dashboard for Gate, Stand, and Belt utilization analysis
 */

import React, { useState } from 'react';
import {
  BarChart3, AlertTriangle, TrendingUp, Users, Clock, Zap,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { Flight } from '../types';
import { 
  calculateInfrastructureMetrics, 
  InfrastructureMetrics,
  getTopInfrastructure,
  getConflictingGates,
  getConflictingStands,
  GateStat,
  StandStat,
  BeltStat,
  HourlyInfraMetrics
} from '../utils/infraAnalyticsService';
import GateAnalytics from './GateAnalytics';
import StandAnalytics from './StandAnalytics';
import BeltAnalytics from './BeltAnalytics';

interface InfrastructureTabProps {
  flights: Flight[];
  dateStart: Date;
  dateEnd: Date;
}

type SubTab = 'overview' | 'gates' | 'stands' | 'belts';

const InfrastructureTab: React.FC<InfrastructureTabProps> = ({ flights, dateStart, dateEnd }) => {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [expandedKPI, setExpandedKPI] = useState<string | null>(null);

  // Calculate metrics
  const metrics = React.useMemo(() => {
    return calculateInfrastructureMetrics(flights, dateStart, dateEnd);
  }, [flights, dateStart, dateEnd]);

  // Get top items
  const topGates = getTopInfrastructure(metrics.gateStats, 10);
  const topStands = getTopInfrastructure(metrics.standStats, 10);
  const topBelts = getTopInfrastructure(metrics.beltStats, 5);
  const conflictingGates = getConflictingGates(metrics.gateStats);
  const conflictingStands = getConflictingStands(metrics.standStats);

  // KPI Cards
  const KPICard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string | number;
    unit?: string;
    bgColor: string;
    onClick?: () => void;
  }> = ({ icon, label, value, unit, bgColor, onClick }) => (
    <div
      onClick={onClick}
      className={`${bgColor} rounded-lg p-4 cursor-pointer hover:shadow-lg transition-shadow`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {value}{unit ? ` ${unit}` : ''}
          </p>
        </div>
        <div className="text-2xl opacity-40">{icon}</div>
      </div>
    </div>
  );

  // Render sub-tabs
  const renderContent = () => {
    switch (subTab) {
      case 'gates':
        return <GateAnalytics gateStats={metrics.gateStats} hourlyMetrics={metrics.hourlyMetrics} />;
      case 'stands':
        return <StandAnalytics standStats={metrics.standStats} hourlyMetrics={metrics.hourlyMetrics} />;
      case 'belts':
        return <BeltAnalytics beltStats={metrics.beltStats} hourlyMetrics={metrics.hourlyMetrics} />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          icon={<BarChart3 />}
          label="Total Flights"
          value={metrics.totalFlights}
          bgColor="bg-blue-50 dark:bg-blue-900"
        />
        <KPICard
          icon={<TrendingUp />}
          label="Avg Gate Utilization"
          value={metrics.avgGateUtilizationPercent.toFixed(1)}
          unit="%"
          bgColor="bg-green-50 dark:bg-green-900"
        />
        <KPICard
          icon={<Clock />}
          label="Avg Stand Utilization"
          value={metrics.avgStandUtilizationPercent.toFixed(1)}
          unit="%"
          bgColor="bg-purple-50 dark:bg-purple-900"
        />
        <KPICard
          icon={<Users />}
          label="Avg Belt Throughput"
          value={metrics.avgBeltThroughputPerHour.toFixed(0)}
          unit="pax/hr"
          bgColor="bg-orange-50 dark:bg-orange-900"
        />
        <KPICard
          icon={<AlertTriangle />}
          label="Gate Conflicts"
          value={metrics.totalGateConflicts}
          bgColor={metrics.totalGateConflicts > 0 ? 'bg-red-50 dark:bg-red-900' : 'bg-gray-50 dark:bg-gray-800'}
        />
        <KPICard
          icon={<Zap />}
          label="Stand Conflicts"
          value={metrics.totalStandConflicts}
          bgColor={metrics.totalStandConflicts > 0 ? 'bg-red-50 dark:bg-red-900' : 'bg-gray-50 dark:bg-gray-800'}
        />
      </div>

      {/* Alert: Conflicts */}
      {(conflictingGates.length > 0 || conflictingStands.length > 0) && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 p-4 rounded">
          <div className="flex items-start">
            <AlertTriangle className="text-yellow-600 dark:text-yellow-300 mt-0.5 mr-3" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Infrastructure Conflicts Detected</h3>
              {conflictingGates.length > 0 && (
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  <strong>{conflictingGates.length}</strong> gates with overlapping flights:
                  {' '}
                  {conflictingGates.slice(0, 5).map(g => g.gateId).join(', ')}
                  {conflictingGates.length > 5 ? '...' : ''}
                </p>
              )}
              {conflictingStands.length > 0 && (
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  <strong>{conflictingStands.length}</strong> stands with overlapping flights:
                  {' '}
                  {conflictingStands.slice(0, 5).map(s => s.standId).join(', ')}
                  {conflictingStands.length > 5 ? '...' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Infrastructure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Gates */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between">
            <span>🚪 Top Gates</span>
            <button
              onClick={() => setExpandedKPI(expandedKPI === 'gates' ? null : 'gates')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {expandedKPI === 'gates' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {topGates.slice(0, expandedKPI === 'gates' ? undefined : 5).map((gate, idx) => (
              <div key={gate.gateId} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                <div className="flex-1">
                  <p className="font-semibold text-gray-700 dark:text-gray-300">{idx + 1}. {gate.gateId}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {gate.totalFlights} flights • {gate.utilizationPercent.toFixed(1)}%
                  </p>
                </div>
                {gate.hasConflicts && <AlertTriangle size={16} className="text-red-500 ml-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Top Stands */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between">
            <span>🏢 Top Stands</span>
            <button
              onClick={() => setExpandedKPI(expandedKPI === 'stands' ? null : 'stands')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {expandedKPI === 'stands' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {topStands.slice(0, expandedKPI === 'stands' ? undefined : 5).map((stand, idx) => (
              <div key={stand.standId} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                <div className="flex-1">
                  <p className="font-semibold text-gray-700 dark:text-gray-300">
                    {idx + 1}. {stand.standId}
                    <span className="text-xs ml-2 font-normal text-gray-500 dark:text-gray-400">
                      ({stand.standType === 'mixed' ? 'A/D' : stand.standType === 'arr' ? 'ARR' : 'DEP'})
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {stand.totalFlights} flights • ⏱️ {stand.avgTurnaroundMin.toFixed(0)}m
                  </p>
                </div>
                {stand.hasConflicts && <AlertTriangle size={16} className="text-red-500 ml-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Top Belts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center justify-between">
            <span>🎡 Top Carousels</span>
            <button
              onClick={() => setExpandedKPI(expandedKPI === 'belts' ? null : 'belts')}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              {expandedKPI === 'belts' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {topBelts.slice(0, expandedKPI === 'belts' ? undefined : 5).map((belt, idx) => (
              <div key={belt.beltId} className="flex items-center justify-between text-sm p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                <div className="flex-1">
                  <p className="font-semibold text-gray-700 dark:text-gray-300">{idx + 1}. {belt.beltId}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {belt.arrivalFlights} flights • {belt.totalPassengers.toLocaleString()} pax
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['overview', 'gates', 'stands', 'belts'] as SubTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 font-medium text-sm transition-colors ${
              subTab === tab
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'overview' && '📊 Overview'}
            {tab === 'gates' && '🚪 Gates'}
            {tab === 'stands' && '🏢 Stands'}
            {tab === 'belts' && '🎡 Carousels'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-96">
        {renderContent()}
      </div>
    </div>
  );
};

export default InfrastructureTab;
