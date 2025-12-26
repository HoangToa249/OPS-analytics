import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Dispatch from './pages/Dispatch';
import DispatchLocal from './pages/DispatchLocal';
import Analytics from './pages/Analytics';
import AnalyticsLocal from './pages/AnalyticsLocal';
import { ProtectedRoute } from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        
        {/* Protected Routes - Require Login */}
        <Route path="/dispatch" element={<ProtectedRoute><Dispatch /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        
        {/* Protected Backup Routes - Require Login */}
        <Route path="/dispatch-local" element={<ProtectedRoute><DispatchLocal /></ProtectedRoute>} />
        <Route path="/analytics-local" element={<ProtectedRoute><AnalyticsLocal /></ProtectedRoute>} />
      </Routes>
    </HashRouter>
  );
};

export default App;