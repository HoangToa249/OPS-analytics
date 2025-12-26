import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

interface ConfigModalProps {
    show: boolean;
    onClose: () => void;
    aircraftConfig: Record<string, {name: string, seats: number}>;
    airlineConfig: Record<string, string>;
    airportConfig: Record<string, string>;
    onAircraftAdd: (code: string, name: string, seats: number) => void;
    onAircraftRemove: (code: string) => void;
    onAirlineAdd: (code: string, name: string) => void;
    onAirlineRemove: (code: string) => void;
    onAirportAdd: (code: string, name: string) => void;
    onAirportRemove: (code: string) => void;
}

export const AnalyticsConfigModal: React.FC<ConfigModalProps> = ({
    show,
    onClose,
    aircraftConfig,
    airlineConfig,
    airportConfig,
    onAircraftAdd,
    onAircraftRemove,
    onAirlineAdd,
    onAirlineRemove,
    onAirportAdd,
    onAirportRemove,
}) => {
    const [activeTab, setActiveTab] = useState<'aircraft' | 'airline' | 'airport'>('aircraft');
    const [newAcType, setNewAcType] = useState('');
    const [newAcName, setNewAcName] = useState('');
    const [newAcSeats, setNewAcSeats] = useState(180);
    const [newAlCode, setNewAlCode] = useState('');
    const [newAlName, setNewAlName] = useState('');
    const [newApCode, setNewApCode] = useState('');
    const [newApName, setNewApName] = useState('');

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <h2 className="text-2xl font-bold text-slate-900">⚙️ Analytics Configuration Manager</h2>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50 px-6">
                    <button
                        onClick={() => setActiveTab('aircraft')}
                        className={`px-4 py-3 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'aircraft'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        ✈️ Aircraft Types ({Object.keys(aircraftConfig).length})
                    </button>
                    <button
                        onClick={() => setActiveTab('airline')}
                        className={`px-4 py-3 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'airline'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        🏢 Airline Codes ({Object.keys(airlineConfig).length})
                    </button>
                    <button
                        onClick={() => setActiveTab('airport')}
                        className={`px-4 py-3 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'airport'
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        🛫 Airport Codes ({Object.keys(airportConfig).length})
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* AIRCRAFT TAB */}
                    {activeTab === 'aircraft' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-3">Add New Aircraft Type</h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                    <input
                                        type="text"
                                        placeholder="AC Type (e.g., 321, 789)"
                                        value={newAcType}
                                        onChange={(e) => setNewAcType(e.target.value.toUpperCase())}
                                        className="border-2 border-blue-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-blue-500 outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Name (e.g., A321)"
                                        value={newAcName}
                                        onChange={(e) => setNewAcName(e.target.value)}
                                        className="border-2 border-blue-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-blue-500 outline-none"
                                    />
                                    <input
                                        type="number"
                                        placeholder="Seats"
                                        value={newAcSeats}
                                        onChange={(e) => setNewAcSeats(parseInt(e.target.value) || 180)}
                                        className="border-2 border-blue-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newAcType && newAcName) {
                                                onAircraftAdd(newAcType, newAcName, newAcSeats);
                                                setNewAcType('');
                                                setNewAcName('');
                                                setNewAcSeats(180);
                                            }
                                        }}
                                        disabled={!newAcType || !newAcName}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-slate-800">Current Aircraft Types</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(aircraftConfig).map(([code, data]) => (
                                        <div key={code} className="bg-slate-100 border-2 border-slate-300 rounded-lg p-3 flex justify-between items-center">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{code}</div>
                                                <div className="text-xs text-slate-600">{data.name} - {data.seats} seats</div>
                                            </div>
                                            <button
                                                onClick={() => onAircraftRemove(code)}
                                                className="text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {Object.keys(aircraftConfig).length === 0 && (
                                        <p className="text-sm text-slate-500 col-span-full">No aircraft types configured</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AIRLINE TAB */}
                    {activeTab === 'airline' && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-3">Add New Airline</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Airline Code (e.g., VN)"
                                        value={newAlCode}
                                        onChange={(e) => setNewAlCode(e.target.value.toUpperCase())}
                                        className="border-2 border-green-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-green-500 outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Airline Name"
                                        value={newAlName}
                                        onChange={(e) => setNewAlName(e.target.value)}
                                        className="border-2 border-green-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-green-500 outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newAlCode && newAlName) {
                                                onAirlineAdd(newAlCode, newAlName);
                                                setNewAlCode('');
                                                setNewAlName('');
                                            }
                                        }}
                                        disabled={!newAlCode || !newAlName}
                                        className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-slate-800">Current Airlines</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(airlineConfig).map(([code, name]) => (
                                        <div key={code} className="bg-slate-100 border-2 border-slate-300 rounded-lg p-3 flex justify-between items-center">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{code}</div>
                                                <div className="text-xs text-slate-600">{name}</div>
                                            </div>
                                            <button
                                                onClick={() => onAirlineRemove(code)}
                                                className="text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {Object.keys(airlineConfig).length === 0 && (
                                        <p className="text-sm text-slate-500 col-span-full">No airlines configured</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AIRPORT TAB */}
                    {activeTab === 'airport' && (
                        <div className="space-y-4">
                            <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                                <h3 className="text-sm font-bold text-slate-800 mb-3">Add New Airport</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input
                                        type="text"
                                        placeholder="Airport Code (e.g., HAN)"
                                        value={newApCode}
                                        onChange={(e) => setNewApCode(e.target.value.toUpperCase())}
                                        className="border-2 border-orange-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-orange-500 outline-none"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Airport Name"
                                        value={newApName}
                                        onChange={(e) => setNewApName(e.target.value)}
                                        className="border-2 border-orange-300 rounded-lg px-3 py-2 text-sm font-bold focus:border-orange-500 outline-none"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newApCode && newApName) {
                                                onAirportAdd(newApCode, newApName);
                                                setNewApCode('');
                                                setNewApName('');
                                            }
                                        }}
                                        disabled={!newApCode || !newApName}
                                        className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Plus size={16} /> Add
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-slate-800">Current Airports</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(airportConfig).map(([code, name]) => (
                                        <div key={code} className="bg-slate-100 border-2 border-slate-300 rounded-lg p-3 flex justify-between items-center">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">{code}</div>
                                                <div className="text-xs text-slate-600">{name}</div>
                                            </div>
                                            <button
                                                onClick={() => onAirportRemove(code)}
                                                className="text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {Object.keys(airportConfig).length === 0 && (
                                        <p className="text-sm text-slate-500 col-span-full">No airports configured</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border-2 border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-100 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
