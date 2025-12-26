
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, BarChart3, Cloud, HardDrive, X, LogIn } from 'lucide-react';
import { AuthModal } from '../components/AuthModal';
import { supabase } from '../supabaseClient';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [dispatchSourceModal, setDispatchSourceModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Check if user is logged in
  React.useEffect(() => {
    const checkUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    checkUser();
  }, []);

  const handleDispatchChoice = (source: 'cloud' | 'local') => {
    setDispatchSourceModal(false);
    navigate(source === 'cloud' ? '/dispatch' : '/dispatch-local');
  };

  return (
    <div className="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-slate-900 text-white">
      {/* Top Right Auth Button */}
      <div className="absolute top-8 right-8 z-20">
        <button
          onClick={() => setShowAuthModal(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <LogIn size={18} />
          {user ? `${user.email} (Logout)` : 'Login'}
        </button>
      </div>

      {/* Auth Modal */}
      <AuthModal 
        show={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          const checkUser = async () => {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            setUser(currentUser);
          };
          checkUser();
        }}
      />

      {/* Background */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464037866556-6812c9d1c72e?auto=format&fit=crop&w=1920&q=80')" }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-900/80 to-slate-900/90" />

      {/* Content */}
      <div className="relative z-10 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 tracking-tight drop-shadow-xl">
          Airport Ops Master
        </h1>
        <p className="text-slate-400 text-lg md:text-xl mb-12 font-light">
          Ground Handling Management & Data Analytics System
        </p>

        <div className="flex flex-col md:flex-row gap-8 justify-center">
          <div 
            onClick={() => setDispatchSourceModal(true)}
            className="group w-72 bg-white/5 backdrop-blur-md border border-white/10 p-10 rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 hover:border-sky-400 hover:shadow-2xl hover:shadow-sky-500/20"
          >
            <Gamepad2 className="w-16 h-16 mx-auto mb-6 text-slate-300 group-hover:text-sky-400 transition-colors" />
            <span className="block text-2xl font-bold mb-2">Dispatch</span>
            <span className="block text-sm text-slate-400 leading-relaxed">
              Gate Planning, Check-in Gantt,<br/>Peak Analysis & Conflict Alerts.
            </span>
          </div>

          <div 
            onClick={() => navigate('/analytics')}
            className="group w-72 bg-white/5 backdrop-blur-md border border-white/10 p-10 rounded-3xl cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/20"
          >
            <BarChart3 className="w-16 h-16 mx-auto mb-6 text-slate-300 group-hover:text-emerald-400 transition-colors" />
            <span className="block text-2xl font-bold mb-2">Analytics</span>
            <span className="block text-sm text-slate-400 leading-relaxed">
              Operational Reports, Delay Analysis,<br/>Load Factors & Market Share.
            </span>
          </div>
        </div>
      </div>

      {/* Data Source Selection Modal */}
      {dispatchSourceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">Select Data Source</h2>
              <button 
                onClick={() => setDispatchSourceModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <p className="text-slate-300 mb-8 text-lg">
              Choose how you want to manage your dispatch data:
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Cloud/Supabase Option */}
              <div 
                onClick={() => handleDispatchChoice('cloud')}
                className="group bg-gradient-to-br from-blue-600/20 to-blue-400/20 border border-blue-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-blue-400/60 hover:from-blue-600/30 hover:to-blue-400/30 hover:shadow-lg hover:shadow-blue-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Cloud className="w-10 h-10 text-blue-400" />
                  <h3 className="text-xl font-bold text-white">Cloud Sync</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Upload data to Supabase for realtime collaboration. All users can access and edit the same data simultaneously.
                </p>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>✓ Realtime synchronization</li>
                  <li>✓ Multi-user collaboration</li>
                  <li>✓ Cloud persistence</li>
                  <li>✓ Auto-sync with shared link</li>
                </ul>
              </div>

              {/* Local/Excel Option */}
              <div 
                onClick={() => handleDispatchChoice('local')}
                className="group bg-gradient-to-br from-amber-600/20 to-amber-400/20 border border-amber-400/30 p-8 rounded-2xl cursor-pointer transition-all duration-300 hover:border-amber-400/60 hover:from-amber-600/30 hover:to-amber-400/30 hover:shadow-lg hover:shadow-amber-500/20"
              >
                <div className="flex items-center gap-3 mb-4">
                  <HardDrive className="w-10 h-10 text-amber-400" />
                  <h3 className="text-xl font-bold text-white">Local File</h3>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                  Work with Excel files locally. Data stays on your device - no cloud upload required.
                </p>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li>✓ Excel file import</li>
                  <li>✓ No internet required</li>
                  <li>✓ Full data privacy</li>
                  <li>✓ Quick local testing</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-slate-500 text-center mt-8">
              You can switch between Cloud and Local modes anytime from the home screen.
            </p>
          </div>
        </div>
      )}

      <div className="absolute bottom-6 text-xs text-slate-500 font-mono">
        Version 5.1 • React Edition
      </div>
    </div>
  );
};

export default Home;
