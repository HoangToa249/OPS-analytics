import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, TableProperties, CheckCircle, AlertCircle, Eye, Zap } from 'lucide-react';
import { autoDetectMapping, validateMappedData, getSampleDataPreview } from '../utils/columnMappingService';

interface FileUploadProps {
  title: string;
  mappings: { key: string; label: string; optional?: boolean }[];
  onDataReady: (data: any[], headers: string[], mappings: Record<string, number>) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ title, mappings, onDataReady }) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, number>>({});
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [mappingConfidence, setMappingConfidence] = useState<Record<string, number>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [showTestPreview, setShowTestPreview] = useState(false);
  const [testPreviewData, setTestPreviewData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const validationResult = useMemo(() => {
    if (rawData.length === 0) return null;
    return validateMappedData(rawData, selectedMap, mappings);
  }, [rawData, selectedMap, mappings]);

  const previewData = useMemo(() => {
    if (rawData.length === 0) return [];
    return getSampleDataPreview(rawData, selectedMap, mappings, 5);
  }, [rawData, selectedMap, mappings]);

  const handleTest = () => {
    if (!validationResult || !validationResult.isValid) {
      alert(`❌ Data validation failed:\n${validationResult?.errors.join('\n')}`);
      return;
    }
    
    if (missingRequired()) { 
      alert('Please map all required fields before testing.'); 
      return; 
    }
    
    setTestPreviewData({
      validRows: validationResult.stats.validRows,
      totalRows: validationResult.stats.totalRows,
      rowsToImport: validationResult.stats.totalRows - 1
    });
    setShowTestPreview(true);
  };

  const handleProcess = () => {
    if (isProcessing) return;

    if (!validationResult || !validationResult.isValid) {
      alert(`❌ Data validation failed:\n${validationResult?.errors.join('\n')}`);
      return;
    }
    
    if (missingRequired()) { 
      alert('Please map all required fields before launching.'); 
      return; 
    }

    setIsProcessing(true);
    console.log('[FileUpload] Sending data to parent component');
    onDataReady(rawData, headers, selectedMap);
    setTimeout(() => setIsProcessing(false), 2000);
  };

  // STEP 1: File Upload
  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="bg-white/95 backdrop-blur-md p-12 rounded-3xl shadow-2xl border border-white/50 max-w-xl w-full text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-inner">
            ✈️
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3">{title}</h2>
          <p className="text-slate-600 mb-10 text-base">
            Upload your flight schedule Excel file (.xlsx, .xls)
          </p>
          
          <label className="group cursor-pointer bg-blue-700 hover:bg-blue-800 text-white font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg">
            <FileSpreadsheet className="w-6 h-6" />
            <span className="text-lg">Select Excel File</span>
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFile} />
          </label>
          <p className="mt-4 text-xs text-slate-400 font-medium uppercase">Secure Local Processing</p>
        </div>
      </div>
    );
  }

  // STEP 2: Column Mapping
  return (
    <div className="flex flex-col items-center min-h-screen p-6 bg-slate-50">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <TableProperties size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Map Data Columns</h3>
              <p className="text-sm text-slate-500">File: {fileName}</p>
            </div>
          </div>
          <button 
            onClick={() => setStep(1)} 
            className="text-slate-500 hover:text-red-600 text-sm font-bold px-4 py-2 hover:bg-red-50 rounded-lg"
          >
            Cancel
          </button>
        </div>

        {/* Content */}
        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h4 className="text-sm font-black text-slate-400 uppercase mb-4">Smart Column Detection</h4>
              <p className="text-xs text-slate-500 mb-4">Confidence scores show how well each column was matched.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              {mappings.map(m => {
                const confidence = mappingConfidence[m.key] || 0;
                const mappedIdx = selectedMap[m.key];
                const mappedCol = mappedIdx >= 0 ? headers[mappedIdx] : null;
                const isMissing = !m.optional && (mappedIdx === undefined || mappedIdx === -1);
                
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
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                            {confidence}%
                          </span>
                        )}
                      </div>
                    </label>
                    <select 
                      className={`w-full p-3 rounded-lg text-slate-900 font-medium bg-slate-50 focus:outline-none focus:border-blue-500 ${
                        isMissing ? 'border-2 border-red-400 bg-red-50' : 'border-2 border-slate-200'
                      }`}
                      value={selectedMap[m.key] ?? -1}
                      onChange={(e) => setSelectedMap({...selectedMap, [m.key]: parseInt(e.target.value)})}
                    >
                      <option value={-1}>-- Select Column --</option>
                      {headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
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

          <div className="space-y-6">
            <h4 className="text-sm font-black text-slate-400 uppercase">Configuration</h4>
            
            {validationResult && (
              <div className={`p-4 rounded-lg border space-y-3 ${validationResult.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                  <p className={`text-sm font-bold ${validationResult.isValid ? 'text-green-700' : 'text-red-700'}`}>
                    {validationResult.isValid ? '✓ Data Valid' : '✗ Validation Failed'}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    <span className={`font-bold ${validationResult.stats.validRows > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {validationResult.stats.validRows}
                    </span>
                    {' '}of {validationResult.stats.totalRows} rows valid
                  </p>
                </div>

                {validationResult.errors.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-red-700 mb-1">Errors:</p>
                    <ul className="text-xs text-red-600 space-y-1">
                      {validationResult.errors.map((err, i) => (
                        <li key={i} className="flex gap-2">
                          <span>•</span>
                          <span>{err}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {validationResult.warnings.length > 0 && validationResult.isValid && (
                  <div>
                    <p className="text-xs font-bold text-amber-700 mb-1">Warnings ({validationResult.warnings.length}):</p>
                    <p className="text-xs text-amber-700 p-2 bg-amber-100 rounded">
                      {validationResult.stats.invalidRows} rows will be skipped
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              <button 
                onClick={handleTest}
                disabled={missingRequired() || !validationResult?.isValid}
                className={`w-full ${missingRequired() || !validationResult?.isValid ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'} font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2`}
              >
                <Eye size={18} />
                <span>Test & Preview</span>
              </button>

              <button 
                onClick={handleProcess} 
                disabled={missingRequired() || !validationResult?.isValid || isProcessing}
                className={`w-full ${missingRequired() || !validationResult?.isValid || isProcessing ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white'} font-bold py-4 px-6 rounded-xl`}
              >
                <span>Launch Import</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && rawData.length > 0 && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-900">Data Preview</h3>
            </div>
            
            <div className="p-6 overflow-auto flex-1">
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      {mappings.map(m => (
                        <th key={m.key} className="px-4 py-2 text-left font-bold text-slate-700 whitespace-nowrap">
                          {m.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        {mappings.map(m => (
                          <td key={m.key} className="px-4 py-2 text-slate-600 text-xs font-mono">
                            {String(row[m.key] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-slate-200 p-6 flex justify-end">
              <button 
                onClick={() => setShowPreview(false)}
                className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Preview Modal */}
      {showTestPreview && testPreviewData && validationResult && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-200 p-6">
              <h3 className="text-xl font-bold text-slate-900">Test Import</h3>
              <p className="text-sm text-slate-500 mt-1">Preview what will be imported</p>
            </div>
            
            <div className="p-6 space-y-4 overflow-auto flex-1">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-sm font-bold text-slate-700">Total Rows</span>
                  <span className="text-lg font-bold text-slate-900">{testPreviewData.rowsToImport}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-sm font-bold text-green-700">✓ Valid Rows</span>
                  <span className="text-lg font-bold text-green-600">{testPreviewData.validRows}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-sm font-bold text-red-700">✕ Invalid Rows</span>
                  <span className="text-lg font-bold text-red-600">{testPreviewData.rowsToImport - testPreviewData.validRows}</span>
                </div>
              </div>

              {/* Show warnings explaining why rows are invalid */}
              {validationResult.warnings && validationResult.warnings.length > 0 && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-bold text-amber-800 mb-2 uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> Why are rows invalid?
                  </p>
                  <ul className="text-xs text-amber-700 space-y-1">
                    {validationResult.warnings.slice(0, 5).map((warning, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                  {validationResult.warnings.length > 5 && (
                    <p className="text-xs text-amber-600 mt-2 italic">
                      + {validationResult.warnings.length - 5} more issues...
                    </p>
                  )}
                </div>
              )}

              {/* Troubleshooting tips */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-bold text-blue-800 mb-2 uppercase">💡 How to fix invalid rows:</p>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>✓ Ensure every row has a <strong>Flight Number</strong> (arr_flight OR dep_flight)</li>
                  <li>✓ Ensure every row has at least one <strong>Time</strong> (STA or STD)</li>
                  <li>✓ Remove rows marked as <strong>CANCELLED (CX/CNL)</strong></li>
                  <li>✓ Check that <strong>column mapping is correct</strong> above</li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-bold text-blue-800 mb-1 uppercase">Next Step:</p>
                <p className="text-xs text-blue-700">
                  Click "Proceed" to go to the Data Sync page where you can choose to DELETE or UPDATE records by time range.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 p-6 flex gap-3 justify-end">
              <button 
                onClick={() => setShowTestPreview(false)}
                className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowTestPreview(false);
                  handleProcess();
                }}
                className="px-6 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
