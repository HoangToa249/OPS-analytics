import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Database,
  Send,
  FileSpreadsheet,
  Home,
  BarChart2,
} from 'lucide-react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import { hasPermission } from '../utils/permissionUtils';
import FileUpload from '../components/FileUpload';
import ImportProgressModal from '../components/ImportProgressModal';
import { parseExcelDate, toISOLocal } from '../utils/dateUtils';
import { Flight } from '../types';
import { smartUpsertData, deleteRecordsInTimeRange, getFlightScheduleUpsertConfig } from '../utils/importDataService';

interface ExternalDatabaseConfig {
  id: string;
  name: string;
  type: 'mysql' | 'mssql' | 'postgresql';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  query: string;
}

interface SyncJobStatus {
  jobId: string;
  enabled: boolean;
  lastSync?: Date;
  nextSync?: Date;
  lastResult?: {
    success: boolean;
    totalRecords: number;
    insertedRecords: number;
    failedRecords: number;
  };
  failureCount: number;
}

interface ImportProgress {
  processed: number;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
}

/**
 * DataSync Component
 * UI for managing data synchronization (Excel import + external database sync)
 */
export default function DataSync() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'excel' | 'external'>('excel');
  const [databases, setDatabases] = useState<ExternalDatabaseConfig[]>([]);
  const [jobs, setJobs] = useState<SyncJobStatus[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDb, setSelectedDb] = useState<ExternalDatabaseConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    processed: 0,
    total: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
  });
  const [importStatus, setImportStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [importMessage, setImportMessage] = useState('');
  const [canImportFlights, setCanImportFlights] = useState(false);

  // Time range options for import
  const [enableTimeRange, setEnableTimeRange] = useState(false);
  const [timeRangeFrom, setTimeRangeFrom] = useState<Date | null>(null);
  const [timeRangeTo, setTimeRangeTo] = useState<Date | null>(null);
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  const [formData, setFormData] = useState<Partial<ExternalDatabaseConfig>>({
    type: 'mysql',
    port: 3306,
  });

  // Load stored database configurations
  useEffect(() => {
    loadDatabases();
    loadSyncJobs();
    checkImportPermission();

    // Poll job statuses every 30 seconds
    const interval = setInterval(loadSyncJobs, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if user has import permission
  const checkImportPermission = async () => {
    const hasImportPerm = await hasPermission('import', 'flights');
    setCanImportFlights(hasImportPerm);
  };

  // Handle Excel Data Import
  const handleDataReady = async (rawData: any[], headers: string[], map: Record<string, number>, config: any) => {
    try {
      // Check import permission
      const canImport = await hasPermission('import', 'flights');
      if (!canImport) {
        alert('❌ You do not have permission to import flight data. Contact your administrator.');
        return;
      }
      
      setImportLoading(true);
      setShowProgressModal(true);
      setImportStatus('processing');
      setImportMessage('Preparing data...');
      setImportProgress({ processed: 0, total: rawData.length - 1, inserted: 0, updated: 0, failed: 0 });
      
      const rowsToInsert: any[] = [];
      const importMode = config.importMode || 'upsert';

      // Parse Excel rows
      for(let i=1; i<rawData.length; i++) {
        const r = rawData[i];
        
        const arrFlt = map['arrFlt'] !== -1 ? String(r[map['arrFlt']] || "").trim() : "";
        const depFlt = map['depFlt'] !== -1 ? String(r[map['depFlt']] || "").trim() : "";
        
        if(!arrFlt && !depFlt) continue;
        
        const sta = map['sta'] !== -1 ? parseExcelDate(r[map['sta']], 'auto', config.fixTz) : null;
        const ata = map['ata'] !== -1 ? parseExcelDate(r[map['ata']], 'auto', config.fixTz) : null;
        const std = map['std'] !== -1 ? parseExcelDate(r[map['std']], 'auto', config.fixTz) : null;
        const atd = map['atd'] !== -1 ? parseExcelDate(r[map['atd']], 'auto', config.fixTz) : null;
        
        const target = sta || std || ata || atd;
        if(!target) continue;
        
        const depGate = map['depGate'] !== -1 ? String(r[map['depGate']] || "").trim() : "";
        const arrBelt = map['arrBelt'] !== -1 ? String(r[map['arrBelt']] || "").trim() : "";
        const arrStand = map['arrStand'] !== -1 ? String(r[map['arrStand']] || "").trim() : "";
        const depStand = map['depStand'] !== -1 ? String(r[map['depStand']] || "").trim() : "";
        const counters = map['counters'] !== -1 ? String(r[map['counters']] || "").trim() : "";
        const gate = map['gate'] !== -1 ? String(r[map['gate']] || "").trim() : "";
        
        const depSts = map['depSts'] !== -1 ? String(r[map['depSts']] || "").toUpperCase() : "";
        const arrSts = map['arrSts'] !== -1 ? String(r[map['arrSts']] || "").toUpperCase() : "";
        if(depSts.includes('CX') || depSts.includes('CNL') || arrSts.includes('CX') || arrSts.includes('CNL')) continue;
        
        const acType = map['acType'] !== -1 ? String(r[map['acType']] || "").trim() : "UNK";
        const arrPax = map['arrPax'] !== -1 ? parseInt(r[map['arrPax']]) || 0 : 0;
        const depPax = map['depPax'] !== -1 ? parseInt(r[map['depPax']]) || 0 : 0;
        const fromLoc = map['from'] !== -1 ? String(r[map['from']] || "").trim().toUpperCase() : "";
        const toLoc = map['to'] !== -1 ? String(r[map['to']] || "").trim().toUpperCase() : "";
        
        const staText = sta ? formatDateToTextTimestamp(sta) : null;
        const stdText = std ? formatDateToTextTimestamp(std) : null;
        const ataText = ata ? formatDateToTextTimestamp(ata) : null;
        const atdText = atd ? formatDateToTextTimestamp(atd) : null;
        
        const dbRow: any = {
          arr_flight: arrFlt || null,
          dep_flight: depFlt || null,
          dep_status: depSts || 'SCHEDULED',
          arr_status: arrSts || 'SCHEDULED',
          arr_pax: arrPax || 0,
          dep_pax: depPax || 0,
          arr_stand: arrStand || null,
          carousel: arrBelt || null,
          flight_from: fromLoc || null,
          dep_stand: depStand || depGate || null,
          gate: gate || depGate || null,
          flight_to: toLoc || null,
          ac_type: acType || 'UNK',
          counters: counters || null,
        };
        
        if(staText) dbRow.sta = staText;
        if(stdText) dbRow.std = stdText;
        if(ataText) dbRow.ata = ataText;
        if(atdText) dbRow.atd = atdText;
        
        rowsToInsert.push(dbRow);
      }

      setImportProgress(prev => ({
        ...prev,
        total: rowsToInsert.length
      }));
      setImportMessage(`Processing ${rowsToInsert.length} records...`);

      // Delete old records if enabled
      if (config.enableTimeRange && config.deleteExisting && config.timeRangeFrom && config.timeRangeTo) {
        setImportMessage('Deleting old records in range...');
        const fromDate = new Date(config.timeRangeFrom);
        const toDate = new Date(config.timeRangeTo);
        const deleteResult = await deleteRecordsInTimeRange(supabase, 'flight_schedule', fromDate, toDate);
        
        if (!deleteResult.success) {
          throw new Error(`Failed to delete records: ${deleteResult.error}`);
        }
        
        console.log(`Deleted ${deleteResult.deletedCount} old records`);
        setImportMessage(`Deleted ${deleteResult.deletedCount} records. Now inserting new data...`);
      }

      // Use smart upsert if available
      const upsertConfig = getFlightScheduleUpsertConfig();
      const result = await smartUpsertData({
        supabase,
        tableName: 'flight_schedule',
        data: rowsToInsert,
        compositeKeyFields: upsertConfig.compositeKeyFields,
        timeRangeFrom: config.enableTimeRange && config.timeRangeFrom ? new Date(config.timeRangeFrom) : undefined,
        timeRangeTo: config.enableTimeRange && config.timeRangeTo ? new Date(config.timeRangeTo) : undefined,
        selectedColumns: config.selectedColumns && config.selectedColumns.length > 0 ? config.selectedColumns : undefined,
        importMode: importMode as 'upsert' | 'insert' | 'update',
        // Callback để cập nhật progress
        onProgress: (processed: number, inserted: number, updated: number, failed: number) => {
          setImportProgress({
            processed,
            total: rowsToInsert.length,
            inserted,
            updated,
            failed
          });
        }
      });

      let resultMessage = '';
      if (importMode === 'upsert') {
        resultMessage = `Smart Upsert completed: ${result.insertedRecords} inserted, ${result.updatedRecords} updated${result.failedRecords > 0 ? `, ${result.failedRecords} failed` : ''}`;
      } else if (importMode === 'update') {
        resultMessage = `Update-only completed: ${result.updatedRecords} updated${result.failedRecords > 0 ? `, ${result.failedRecords} failed` : ''}`;
      } else if (importMode === 'insert') {
        resultMessage = `Insert-only completed: ${result.insertedRecords} inserted${result.failedRecords > 0 ? `, ${result.failedRecords} failed` : ''}`;
      }
      
      setImportStatus('success');
      setImportMessage(resultMessage);
      console.log(resultMessage);
    } catch (error) {
      console.error('[Excel Import] Error:', error);
      setImportStatus('error');
      setImportMessage('Import failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setImportLoading(false);
    }
  };

  const formatDateToTextTimestamp = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}+00`;
  };

  const loadDatabases = () => {
    const stored = localStorage.getItem('externalDatabases');
    if (stored) {
      setDatabases(JSON.parse(stored));
    }
  };

  const loadSyncJobs = () => {
    // With Edge Functions, we don't need to load jobs from backend
    // Jobs are triggered on-demand, so just clear the jobs list
    setJobs([]);
  };

  const handlePortChange = (type: 'mysql' | 'mssql' | 'postgresql') => {
    let defaultPort = 3306;
    if (type === 'mssql') defaultPort = 1433;
    if (type === 'postgresql') defaultPort = 5432;

    setFormData({
      ...formData,
      type,
      port: defaultPort,
    });
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-external-db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'test-connection',
          type: formData.type,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          database: formData.database,
        }),
      });

      const data = await response.json();
      setTestResult({
        success: data.success,
        message: data.success ? 'Connection successful!' : (data.message || 'Connection failed'),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: (error as Error).message || 'Network error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDatabase = async () => {
    if (
      !formData.id ||
      !formData.name ||
      !formData.host ||
      !formData.database ||
      !formData.username ||
      !formData.password ||
      !formData.query
    ) {
      alert('Please fill in all fields');
      return;
    }

    // Test connection first via Edge Function
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-external-db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'test-connection',
          type: formData.type,
          host: formData.host,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          database: formData.database,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        alert('Connection test failed: ' + (data.message || 'Unknown error'));
        setLoading(false);
        return;
      }

      // Save to local storage (since we're using Edge Functions, no backend needed)
      const updated = databases.filter((db) => db.id !== formData.id);
      updated.push(formData as ExternalDatabaseConfig);
      setDatabases(updated);
      localStorage.setItem('externalDatabases', JSON.stringify(updated));

      setShowModal(false);
      setFormData({ type: 'mysql', port: 3306 });
      setTestResult(null);
    } catch (error) {
      alert('Failed to save database: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSync = async (db: ExternalDatabaseConfig) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-external-db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'sync',
          type: db.type,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          query: db.query,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Sync completed! ${data.data?.syncedRecords || 0} records synced.`);
        await loadSyncJobs();
      } else {
        alert('Sync failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerManualSync = async (db: ExternalDatabaseConfig) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${supabaseUrl}/functions/v1/sync-external-db`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'sync',
          type: db.type,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          query: db.query,
        }),
      });

      const data = await response.json();
      if (data.success) {
        alert(`Sync completed! ${data.data?.syncedRecords || 0} records synced.`);
        await loadSyncJobs();
      } else {
        alert('Sync failed: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDatabase = (dbId: string) => {
    if (confirm('Are you sure you want to delete this database configuration?')) {
      const updated = databases.filter((db) => db.id !== dbId);
      setDatabases(updated);
      localStorage.setItem('externalDatabases', JSON.stringify(updated));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/home')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                title="Go to Home"
              >
                <Home size={20} />
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                title="Go to Analytics"
              >
                <BarChart2 size={20} />
              </button>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Management</h1>
            <p className="text-gray-600 mt-2">Import data from Excel files or sync from external databases</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-200">
          {canImportFlights && (
            <button
              onClick={() => setActiveTab('excel')}
              className={`px-6 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${
                activeTab === 'excel'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileSpreadsheet size={20} />
              Excel Import
            </button>
          )}
          <button
            onClick={() => setActiveTab('external')}
            className={`px-6 py-3 font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'external'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Database size={20} />
            External DB Sync
          </button>
        </div>

        {/* Show message if user doesn't have import permission */}
        {!canImportFlights && activeTab === 'excel' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-amber-900">No Import Permission</h3>
              <p className="text-sm text-amber-800 mt-1">
                You don't have permission to import flight data. Please contact your administrator to request this permission.
              </p>
            </div>
          </div>
        )}

        {/* Excel Import Tab */}
        {activeTab === 'excel' && canImportFlights && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Flight Data from Excel</h2>
                <p className="text-gray-600">
                  Upload Excel files to import flight schedule data. Supports smart upsert, update-only, and insert-only modes.
                </p>
              </div>
              
              <FileUpload
                title="Flight Data Import"
                mappings={[
                  {key:'arrFlt', label:'Arr Flight', optional: true},
                  {key:'depFlt', label:'Dep Flight', optional: true},
                  {key:'sta', label:'STA', optional: true},
                  {key:'ata', label:'ATA', optional: true},
                  {key:'std', label:'STD'},
                  {key:'atd', label:'ATD', optional: true},
                  {key:'arrSts', label:'Arr Status', optional: true},
                  {key:'depSts', label:'Dep Status', optional: true},
                  {key:'arrPax', label:'Arr Pax', optional: true},
                  {key:'depPax', label:'Dep Pax', optional: true},
                  {key:'from', label:'From', optional: true},
                  {key:'to', label:'To', optional: true},
                  {key:'acType', label:'AC Type', optional: true},
                  {key:'gate', label:'Gate / Stand', optional: true},
                  {key:'depGate', label:'Dep Gate', optional: true},
                  {key:'arrBelt', label:'Arrival Belt', optional: true},
                  {key:'arrStand', label:'Arr Stand', optional: true},
                  {key:'depStand', label:'Dep Stand', optional: true},
                  {key:'counters', label:'Counters', optional: true}
                ]}
                onDataReady={handleDataReady}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-sm text-blue-900">
                <strong>💡 Tip:</strong> The import process automatically detects your Excel columns and supports three modes:
                <br />• <strong>Smart Upsert</strong> (default): Updates existing records and inserts new ones
                <br />• <strong>Update Only</strong>: Updates existing records, skips new ones
                <br />• <strong>Insert Only</strong>: Inserts new records, skips existing ones
              </p>
            </div>
          </div>
        )}

        {/* External DB Tab */}
        {activeTab === 'external' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">External Database Sync</h2>
                <p className="text-gray-600 mt-1">Configure and sync data from external MySQL/MSSQL/PostgreSQL databases</p>
              </div>
              <button
                onClick={() => {
                  setSelectedDb(null);
                  setFormData({ type: 'mysql', port: 3306 });
                  setTestResult(null);
                  setShowModal(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <Plus size={20} />
                New Database
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Configured Databases</p>
                    <p className="text-2xl font-bold text-gray-900">{databases.length}</p>
                  </div>
                  <Database className="text-blue-600" size={32} />
                </div>
              </div>
            </div>

            {/* Database List */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">Configured Databases</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Host</th>
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {databases.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          No databases configured yet. Click "New Database" to add one.
                        </td>
                      </tr>
                    ) : (
                      databases.map((db) => (
                        <tr key={db.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{db.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                              {db.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {db.host}:{db.port}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStartSync(db)}
                                disabled={loading}
                                className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                              >
                                <Send size={16} />
                                Sync Now
                              </button>
                              <button
                                onClick={() => handleDeleteDatabase(db.id)}
                                className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-sm text-blue-900">
                <strong>Manual Sync:</strong> Click "Sync Now" to trigger a manual sync from your external database to Supabase. 
                Data is transformed using automatic field mapping and batch-inserted for optimal performance.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Configure External Database</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Database Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value, id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Production MySQL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Database Type</label>
                  <select
                    value={formData.type || 'mysql'}
                    onChange={(e) => handlePortChange(e.target.value as 'mysql' | 'mssql' | 'postgresql')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="mysql">MySQL</option>
                    <option value="mssql">SQL Server</option>
                    <option value="postgresql">PostgreSQL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Host</label>
                  <input
                    type="text"
                    value={formData.host || ''}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 192.168.1.10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Port</label>
                  <input
                    type="number"
                    value={formData.port || 3306}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Database Name</label>
                  <input
                    type="text"
                    value={formData.database || ''}
                    onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., flight_schedule"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">SQL Query</label>
                  <textarea
                    value={formData.query || ''}
                    onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="SELECT * FROM flights WHERE std >= NOW() - INTERVAL 1 DAY"
                    rows={3}
                  />
                </div>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg ${
                    testResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end bg-gray-50">
              <button
                onClick={handleTestConnection}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDatabase}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save & Configure'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Progress Modal */}
      <ImportProgressModal
        isOpen={showProgressModal}
        isLoading={importLoading}
        progress={importProgress}
        status={importStatus}
        message={importMessage}
        onClose={() => setShowProgressModal(false)}
      />
    </div>
  );
}
