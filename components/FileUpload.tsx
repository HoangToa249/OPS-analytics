
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, ArrowRight, TableProperties, CheckCircle, AlertCircle, Eye, Zap, BarChart3, TrendingUp } from 'lucide-react';
import { autoDetectMapping, validateMappedData, getSampleDataPreview, getColumnStats } from '../utils/columnMappingService';

interface FileUploadProps {
  title: string;
  mappings: { key: string; label: string; optional?: boolean }[];
  onDataReady: (data: any[], headers: string[], mappings: Record<string, number>, config: any) => void;
  extraConfig?: React.ReactNode;
}

const FileUpload: React.FC<FileUploadProps> = ({ title, mappings, onDataReady, extraConfig }) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [mappingConfidence, setMappingConfidence] = useState<Record<string, number>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Config State
  const [fixTz, setFixTz] = useState(true);
  const [dateFmt, setDateFmt] = useState('auto');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const r = new FileReader();
    r.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[];
      if (data && data.length > 0) {
        setHeaders(data[0] as string[]);
        setRawData(data);
        
        // Use intelligent auto-detect with fuzzy matching
        const { mapping, confidence } = autoDetectMapping(data[0] as string[], mappings);
        setSelectedMap(mapping);
        setMappingConfidence(confidence);
        setStep(2);
      }
    };
    r.readAsArrayBuffer(f);
  };

  const requiredKeys = ['flight', 'std'];

  const missingRequired = () => {
    return mappings
      .filter(m => !m.optional || requiredKeys.includes(m.key))
      .some(m => selectedMap[m.key] === undefined || selectedMap[m.key] === -1);
  };

  // Validation results
  const validationResult = useMemo(() => {
    if (rawData.length === 0) return null;
    return validateMappedData(rawData, selectedMap, mappings);
  }, [rawData, selectedMap, mappings]);

  // Sample preview data
  const previewData = useMemo(() => {
    if (rawData.length === 0) return [];
    return getSampleDataPreview(rawData, selectedMap, mappings, 5);
  }, [rawData, selectedMap, mappings]);

  // Column statistics
  const columnStats = useMemo(() => {
    if (headers.length === 0) return {};
    return getColumnStats(headers, rawData);
  }, [headers, rawData]);

  const handleProcess = () => {
    // Validate before processing
    if (!validationResult || !validationResult.isValid) {
      alert(`❌ Data validation failed:\n${validationResult?.errors.join('\n')}`);
      return;
    }
    
    if (missingRequired()) { 
      alert('Please map all required fields before launching.'); 
      return; 
    }
    
    // Directly send mapped data to parent for parsing/processing
    onDataReady(rawData, headers, selectedMap, { fixTz, dateFmt });
  };

  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="bg-white/95 backdrop-blur-md p-12 rounded-3xl shadow-2xl border border-white/50 max-w-xl w-full text-center transition-all hover:shadow-blue-500/10 hover:scale-[1.01]">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
            ✈️
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">{title}</h2>
          <p className="text-slate-600 mb-10 text-base leading-relaxed">
            Upload your flight schedule Excel file (.xlsx, .xls) to initialize the operations dashboard.
          </p>
          
          <label className="group cursor-pointer bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-blue-600/30 transform active:scale-95">
            <FileSpreadsheet className="w-6 h-6 group-hover:animate-bounce" />
            <span className="text-lg">Select Excel File</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFile} />
          </label>
          <p className="mt-4 text-xs text-slate-400 font-medium uppercase tracking-widest">Secure Local Processing</p>
        </div>
      </div>
    );
  }

  // No preview step: process directly using manual column mapping

  return (
    <div className="flex flex-col items-center min-h-screen p-6 bg-slate-50">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <TableProperties size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Map Data Columns</h3>
              <p className="text-sm text-slate-500 font-medium">File: {fileName}</p>
            </div>
          </div>
          <button 
            onClick={() => setStep(1)} 
            className="text-slate-500 hover:text-red-600 text-sm font-bold px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            Cancel Upload
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Column Mapping Section */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                <Zap size={14} className="text-amber-500" />
                Smart Column Detection
              </h4>
              <p className="text-xs text-slate-500 mb-4">Confidence scores show how well each column was matched. Adjust mappings if needed.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              {mappings.map(m => {
                const confidence = mappingConfidence[m.key] || 0;
                const mappedIdx = selectedMap[m.key];
                const mappedCol = mappedIdx >= 0 ? headers[mappedIdx] : null;
                const isMissing = ((!m.optional || requiredKeys.includes(m.key)) && (mappedIdx === undefined || mappedIdx === -1));
                
                // Get confidence color
                let confColor = 'text-slate-400';
                let confBg = 'bg-slate-100';
                if (confidence >= 90) {
                  confColor = 'text-green-600';
                  confBg = 'bg-green-50';
                } else if (confidence >= 70) {
                  confColor = 'text-blue-600';
                  confBg = 'bg-blue-50';
                } else if (confidence >= 50) {
                  confColor = 'text-amber-600';
                  confBg = 'bg-amber-50';
                }

                return (
                  <div key={m.key} className="relative group">
                    <label className="block text-sm font-bold text-slate-800 mb-2 flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        {m.label}
                        {confidence >= 90 && <CheckCircle size={14} className="text-green-500" />}
                      </span>
                      <div className="flex items-center gap-2">
                        {m.optional && <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Optional</span>}
                        {mappedIdx >= 0 && (
                          <span className={`text-xs font-bold ${confColor} ${confBg} px-2 py-0.5 rounded-full`}>
                            {confidence}%
                          </span>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <select 
                        className={`w-full p-3 pl-4 rounded-lg text-slate-900 font-medium bg-slate-50 focus:ring-4 focus:ring-blue-50 transition-all outline-none appearance-none cursor-pointer ${
                          isMissing 
                            ? 'border-2 border-red-400 bg-red-50' 
                            : mappedIdx >= 0
                            ? `border-2 ${confColor.replace('text-', 'border-')} bg-slate-50`
                            : 'border-2 border-slate-200 hover:border-slate-300'
                        }`}
                        value={selectedMap[m.key] ?? -1}
                        onChange={(e) => setSelectedMap({...selectedMap, [m.key]: parseInt(e.target.value)})}
                      >
                        <option value={-1} className="text-slate-400">-- Select Column --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i} className="text-slate-900">
                            {h} (Col {String.fromCharCode(65+i)})
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                        ▼
                      </div>
                    </div>
                    {mappedCol && (
                      <p className="text-xs text-slate-500 mt-1">
                        Source: <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{mappedCol}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Config */}
          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 border-b pb-2">Configuration</h4>
            
            {/* Validation Status */}
            {validationResult && (
              <div className={`p-4 rounded-xl border-2 ${
                validationResult.isValid 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3 mb-3">
                  {validationResult.isValid ? (
                    <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
                  ) : (
                    <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
                  )}
                  <div>
                    <p className={`text-sm font-bold ${validationResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
                      {validationResult.isValid ? '✓ Data Valid' : '✗ Validation Failed'}
                    </p>
                    <p className={`text-xs mt-1 ${validationResult.isValid ? 'text-green-700' : 'text-red-700'}`}>
                      {validationResult.stats.validRows} of {validationResult.stats.totalRows} rows valid
                    </p>
                  </div>
                </div>

                {validationResult.errors.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-700 font-medium">• {err}</p>
                    ))}
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    {validationResult.warnings.map((warn, i) => (
                      <p key={i} className="text-xs text-amber-700 font-medium">⚠ {warn}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 shadow-sm">
                <label className="block text-xs font-bold text-blue-800 uppercase mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Date & Time
                </label>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Date Format</label>
                        <select 
                          value={dateFmt} 
                          onChange={e => setDateFmt(e.target.value)} 
                          className="w-full p-2.5 border border-blue-200 rounded-lg text-sm bg-white text-slate-800 focus:border-blue-500 outline-none"
                        >
                            <option value="auto">Auto Detect (Recommended)</option>
                            <option value="ddmm">dd/mm/yyyy (Asia/EU)</option>
                            <option value="mmdd">mm/dd/yyyy (US)</option>
                        </select>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-blue-100">
                         <input 
                            type="checkbox" 
                            id="fixTz" 
                            checked={fixTz} 
                            onChange={e => setFixTz(e.target.checked)} 
                            className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300" 
                         />
                         <div>
                           <label htmlFor="fixTz" className="text-sm font-bold text-slate-800 block cursor-pointer">Excel Timezone Fix</label>
                           <p className="text-xs text-slate-500 mt-1 leading-snug">
                             Adjusts dates by adding timezone offset. Enable if times appear incorrect.
                           </p>
                         </div>
                    </div>
                </div>
            </div>

            {/* Preview Button */}
            <button 
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
            >
              <Eye size={16} />
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>

            {extraConfig}

            <div>
              {missingRequired() && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">Please map required fields `flight` and `std` (highlighted in red) before launching.</div>
              )}
              {!validationResult?.isValid && (
                <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">Fix validation errors above before proceeding.</div>
              )}
              <button 
                onClick={handleProcess} 
                disabled={missingRequired() || !validationResult?.isValid}
                className={`w-full ${
                  (missingRequired() || !validationResult?.isValid)
                    ? 'bg-slate-300 text-slate-600 cursor-not-allowed' 
                    : 'bg-slate-900 hover:bg-black text-white'
                } font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}
              >
                  <span>Launch Dashboard</span>
                  <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && rawData.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Eye className="text-blue-600" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Data Preview</h3>
                  <p className="text-sm text-slate-500">First 5 rows with mapped columns</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPreview(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-auto">
              {/* Data Preview Table */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <BarChart3 size={16} />
                  Sample Data
                </h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        {mappings.map(m => {
                          const idx = selectedMap[m.key];
                          return (
                            <th 
                              key={m.key}
                              className="px-4 py-2 text-left font-bold text-slate-700 whitespace-nowrap"
                            >
                              <div className="flex items-center gap-2">
                                <span>{m.label}</span>
                                {idx >= 0 && (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                    {headers[idx]}
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                          {mappings.map(m => (
                            <td 
                              key={`${i}-${m.key}`}
                              className="px-4 py-2 text-slate-700 max-w-xs truncate"
                              title={String(row[m.key] || '')}
                            >
                              {row[m.key] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Column Statistics */}
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <TrendingUp size={16} />
                  Column Statistics
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {headers.map(header => {
                    const stat = columnStats[header];
                    if (!stat) return null;
                    return (
                      <div key={header} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="font-mono text-xs font-bold text-slate-600 mb-2 bg-white px-2 py-1 rounded w-fit">
                          {header}
                        </div>
                        <div className="text-xs text-slate-700 space-y-1">
                          <p><strong>Type:</strong> {stat.type}</p>
                          <p><strong>Non-empty:</strong> {stat.nonEmptyCount}/{rawData.length - 1}</p>
                          <p><strong>Examples:</strong></p>
                          <ul className="ml-4 mt-1 space-y-0.5">
                            {stat.examples.map((ex, i) => (
                              <li key={i} className="bg-white px-2 py-0.5 rounded font-mono text-slate-600 truncate">
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 p-6 flex justify-end">
              <button 
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
