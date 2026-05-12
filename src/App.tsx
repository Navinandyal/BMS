import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Zap, 
  AlertTriangle, 
  Lightbulb, 
  LayoutDashboard, 
  Settings, 
  FileText, 
  Power, 
  LogOut, 
  Search, 
  Bell, 
  ChevronRight,
  TrendingDown,
  Wind,
  MousePointer2,
  Building2,
  Trash2,
  CheckCircle2,
  ZapOff,
  Sparkles,
  RefreshCw,
  X,
  Info
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Device, SummaryData, Alert, Recommendation, Page } from './types';

// Calls AI via the server-side proxy — avoids browser CORS/SDK issues
async function callAI(token: string, prompt: string): Promise<string> {
  const resp = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ prompt }),
  });
  const data = await resp.json().catch(() => ({ error: resp.statusText }));
  if (!resp.ok) {
    // Surface the server's human-readable error (includes retry timing for 429s)
    throw new Error(data.error || 'AI request failed');
  }
  return data.text ?? '';
}

// Login Component
const Login = ({ onLogin }: { onLogin: (token: string) => void }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const contentType = resp.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.token) {
          onLogin(data.token);
        } else {
          setError(data.error || 'Authentication failed');
        }
      } else {
        setError('Server returned an invalid response. Check backend logs.');
      }
    } catch (err) {
      setError('Connection refused. Check backend.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] -mr-40 -mt-40 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] -ml-40 -mb-40 pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8 lg:p-12 relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-cyan-500 rounded-2xl flex items-center justify-center font-bold text-3xl text-slate-900 mb-4 shadow-[0_0_30px_rgba(34,211,238,0.3)]">Σ</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Aether BMS</h1>
          <p className="text-slate-500 text-sm mt-2 text-center">Facility Management Intelligence</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="glass-input w-full py-4 rounded-2xl"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="glass-input w-full py-4 rounded-2xl"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-xs font-semibold flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              {error}
            </motion.div>
          )}

          <button 
            type="submit"
            className="w-full bg-cyan-500 text-slate-900 font-bold py-4 rounded-2xl hover:bg-cyan-400 transition-all flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(34,211,238,0.2)]"
          >
            Authenticate Node
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-10 text-center text-[10px] uppercase tracking-widest text-slate-600 font-bold">
          &copy; 2026 Aether Industrial Systems
        </div>
      </motion.div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('bms_token'));
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deviceRecs, setDeviceRecs] = useState<Record<number, string>>({});
  const [loadingRecs, setLoadingRecs] = useState<Record<number, boolean>>({});
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const getDeviceRecommendation = async (device: Device) => {
    if (!token) return;
    setLoadingRecs(prev => ({ ...prev, [device.id]: true }));
    try {
      const prompt = `Device: ${device.name}\nType: ${device.type}\nStatus: ${device.status}\nPower: ${device.current_power} kW\nLocation: ${device.room_name}, Floor ${device.floor_number}\n\nTask: Give a 5-8 word recommendation on when this device should be ON vs OFF for energy efficiency.`;
      const text = await callAI(token, prompt);
      setDeviceRecs(prev => ({ ...prev, [device.id]: text.trim() }));
    } catch (error) {
      console.error(error);
      setDeviceRecs(prev => ({ ...prev, [device.id]: 'AI unavailable' }));
    } finally {
      setLoadingRecs(prev => ({ ...prev, [device.id]: false }));
    }
  };

  useEffect(() => {
    if (token) {
      localStorage.setItem('bms_token', token);
      fetchData();
      const interval = setInterval(fetchData, 30000); // Polling every 30s
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const fetchJson = async (url: string) => {
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }
        const contentType = resp.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Not a JSON response');
        }
        return resp.json();
      };

      const [sData, dData, aData, rData] = await Promise.all([
        fetchJson('/api/dashboard/summary'),
        fetchJson('/api/devices'),
        fetchJson('/api/alerts'),
        fetchJson('/api/recommendations')
      ]);

      setSummary(sData);
      setDevices(dData);
      setAlerts(aData);
      setRecommendations(rData);
      setLoading(false);
    } catch (err) {
      console.error('Fetch error:', err);
      // If unauthorized, logout
      if (err instanceof Error && err.message.includes('401')) {
        handleLogout();
      }
    }
  };

  const handleToggleDevice = async (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
    try {
      await fetch('/api/automation/action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ deviceId: id, action: newStatus })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('bms_token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 glass-sidebar transition-transform duration-300 transform lg:translate-x-0 lg:static flex flex-col",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center font-bold text-slate-900">Σ</div>
            <span className="text-xl font-bold tracking-tight">Aether BMS</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 p-1 hover:text-white">
            <ZapOff className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          <NavButton 
            active={activePage === 'dashboard'} 
            onClick={() => { setActivePage('dashboard'); setIsSidebarOpen(false); }}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavButton 
            active={activePage === 'devices'} 
            onClick={() => { setActivePage('devices'); setIsSidebarOpen(false); }}
            icon={<Zap className="w-5 h-5" />}
            label="Monitoring"
          />

        </nav>

        <div className="p-6 border-t border-white/10">
          <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 rounded-2xl p-4 mb-4">
            <p className="text-[10px] text-slate-400 mb-1 uppercase tracking-wider font-bold">System Status</p>
            <p className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]"></span> 
              AI Engine Active
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 glass-header px-4 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
              <LayoutDashboard className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-medium hidden sm:block whitespace-nowrap">
              Campus Overview <span className="text-slate-500 font-normal ml-2 hidden lg:inline">/ Main Campus Complex</span>
            </h2>
            <h2 className="text-lg font-medium sm:hidden truncate max-w-[120px]">{activePage}</h2>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <div className="relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search devices..."
                className="glass-input w-64 pl-10"
              />
            </div>
            <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold leading-tight">Admin User</div>
                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Systems Engineer</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-white/20 shadow-inner overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin" alt="avatar" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 flex-1 overflow-y-auto scrollbar-hide space-y-8">
          <AnimatePresence mode="wait">
            {activePage === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    label="Current Power" 
                    value={`${summary?.currentPowerDemand.toFixed(1)} kW`}
                    trend="+2.1%"
                    icon={<Zap className="text-cyan-400" />}
                  />
                  <StatCard 
                    label="Daily Energy" 
                    value={`${summary?.totalEnergyToday.toFixed(1)} kWh`}
                    subtitle={`Est. Cost: ₹${summary?.estimatedCost.toFixed(1)}`}
                    icon={<BarChart3 className="text-indigo-400" />}
                  />
                  <StatCard 
                    label="Monthly Cost" 
                    value={`₹${((summary?.estimatedCost || 0) * 30).toLocaleString()}`}
                    subtitle="Estimated Forecast"
                    icon={<Building2 className="text-emerald-400" />}
                  />
                  <StatCard 
                    label="Waste Efficiency" 
                    value={`${(100 - (summary?.wastePercentage || 0)).toFixed(1)}%`}
                    trend="-0.5%"
                    icon={<AlertTriangle className="text-rose-400" />}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Consumption Chart */}
                  <div className="lg:col-span-2 glass-card p-6 min-h-[400px] min-w-0">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="font-semibold text-lg">Real-time Power Demand (kW)</h3>
                        <p className="text-xs text-slate-500">Actual performance vs predictive modeling</p>
                      </div>
                      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest hidden sm:flex">
                        <span className="flex items-center gap-1.5 text-cyan-400">● Actual</span>
                        <span className="flex items-center gap-1.5 text-slate-500">● Predicted</span>
                      </div>
                    </div>
                    <div className="h-[300px] w-full" style={{ position: 'relative' }}>
                      <ResponsiveContainer width="99%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorPower" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)' }}
                            itemStyle={{ color: '#fff' }}
                          />
                          <Area type="monotone" dataKey="kw" stroke="#22d3ee" fillOpacity={1} fill="url(#colorPower)" strokeWidth={3} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Distribution */}
                  <div className="glass-card p-6 min-w-0">
                    <h3 className="font-semibold text-lg mb-2">Usage by Sector</h3>
                    <p className="text-xs text-slate-500 mb-8">Data distribution per meter category</p>
                    <div className="h-[200px]" style={{ position: 'relative' }}>
                      <ResponsiveContainer width="99%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            innerRadius={65}
                            outerRadius={85}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-6 space-y-2.5">
                       {pieData.map((d, i) => (
                         <div key={i} className="flex items-center justify-between text-[11px]">
                           <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                             <span className="text-slate-400 font-medium">{d.name}</span>
                           </div>
                           <span className="font-bold text-white">{d.value}%</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">


                   {/* Quick Controls */}
                   <div className="glass-card flex flex-col p-6">
                      <h3 className="font-semibold text-lg mb-2">Smart Status Monitor</h3>
                      <p className="text-xs text-slate-500 mb-6">Real-time priority node monitoring</p>
                      <div className="grid grid-cols-2 gap-4">
                         {devices.filter(d => d.type !== 'METER').slice(0, 4).map(device => (
                           <div 
                             key={device.id}
                             onClick={() => setSelectedDevice(device)}
                             className={cn(
                               "p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer",
                               device.status === 'ON' ? 'bg-white/5 border-white/10' : 'bg-white/[0.02] border-white/[0.05] grayscale'
                             )}
                           >
                              <div className="flex items-center justify-between mb-4">
                                 <div className={cn(
                                   "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                   device.status === 'ON' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-slate-500'
                                 )}>
                                    <DeviceIcon type={device.type} />
                                 </div>
                                 <div className={cn(
                                   "w-2 h-2 rounded-full",
                                   device.status === 'ON' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-700'
                                 )} />
                              </div>
                              <div className="font-bold text-sm truncate">{device.name}</div>
                              <div className="text-[10px] text-slate-500 mb-2">{device.room_name}</div>
                              <div className="text-xs font-mono font-bold text-cyan-400">{device.current_power.toFixed(1)} kW</div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {activePage === 'devices' && (
              <motion.div 
                key="devices"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card p-0"
              >
                <div className="p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-white/10">
                   <div>
                      <h2 className="text-xl font-bold">Campus Monitoring Grid</h2>
                      <p className="text-sm text-slate-500">Managing {devices.length} telemetry points on 8 functional floors</p>
                   </div>
                   <div className="flex gap-3">
                      <button 
                        onClick={async () => {
                           for (const d of devices) {
                             if (!deviceRecs[d.id] && !loadingRecs[d.id]) {
                               await getDeviceRecommendation(d);
                               await new Promise(r => setTimeout(r, 1500));
                             }
                           }
                         }}
                        className="btn-primary flex-1 sm:flex-initial gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Analyze All Nodes
                      </button>
                      <button className="btn-ghost flex-1 sm:flex-initial">Export Logs</button>
                   </div>
                </div>

                <div className="overflow-x-auto min-h-[500px]">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="px-8">Node Path</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Actual Load</th>
                        <th className="hidden md:table-cell">Energy (48h)</th>
                        <th className="hidden lg:table-cell">Last Sync</th>
                        <th className="text-right px-8 min-w-[200px]">AI Efficiency Suggestion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {devices.map(device => (
                        <tr 
                          key={device.id} 
                          onClick={() => setSelectedDevice(device)}
                          className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-cyan-400 group-hover:border-cyan-500/20 transition-all">
                                  <DeviceIcon type={device.type} />
                               </div>
                               <div>
                                  <div className="font-bold text-sm">{device.name}</div>
                                  <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">{device.room_name} · Floor {device.floor_number}</div>
                               </div>
                            </div>
                          </td>
                          <td>
                             <span className="text-[10px] font-bold px-2 py-1 bg-white/5 border border-white/10 rounded uppercase text-slate-400">{device.type}</span>
                          </td>
                          <td>
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase border",
                              device.status === 'ON' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-slate-500 border-white/5'
                            )}>
                              <div className={cn("w-1.5 h-1.5 rounded-full", device.status === 'ON' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-700')} />
                              {device.status}
                            </div>
                          </td>
                          <td className="font-mono text-xs font-bold text-cyan-400">{device.current_power.toFixed(1)} kW</td>
                          <td className="font-mono text-xs text-slate-400 hidden md:table-cell">{device.daily_energy.toFixed(2)} kWh</td>
                          <td className="text-[10px] text-slate-500 font-bold uppercase hidden lg:table-cell">{format(new Date(device.last_active), 'HH:mm:ss')}</td>
                          <td className="text-right px-8">
                             <div className="flex items-center justify-end gap-3">
                                {deviceRecs[device.id] ? (
                                   <div className="text-[11px] text-cyan-300 font-medium italic animate-in fade-in slide-in-from-right-2 duration-500 max-w-[150px] leading-tight">
                                      "{deviceRecs[device.id]}"
                                   </div>
                                ) : null}
                                <button 
                                  onClick={() => getDeviceRecommendation(device)}
                                  disabled={loadingRecs[device.id]}
                                  className={cn(
                                    "w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center transition-all",
                                    loadingRecs[device.id] ? "animate-spin text-slate-500" : "hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-400"
                                  )}
                                >
                                  {loadingRecs[device.id] ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                </button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activePage === 'alerts' && (
              <motion.div 
                key="alerts"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Alert Center</h2>
                  <button className="text-sm font-semibold text-cyan-500">Mark all as read</button>
                </div>
                <div className="grid gap-4">
                  {alerts.map(alert => (
                    <div key={alert.id} className="glass-card p-6 flex flex-col md:flex-row gap-6">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                        alert.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400 shadow-rose-500/10' : 'bg-amber-500/20 text-amber-400 shadow-amber-500/10'
                      )}>
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                           <div className="flex items-center gap-3">
                             <span className="font-bold text-lg">{alert.device_name}</span>
                             <span className={cn(
                               "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border",
                               alert.severity === 'Critical' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                             )}>
                               {alert.severity}
                             </span>
                           </div>
                           <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{format(new Date(alert.timestamp), 'MMM d, HH:mm')}</span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">{alert.message}</p>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                               <CheckCircle2 className="w-4 h-4" />
                             </div>
                             <div className="text-xs">
                               <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Protocol Recommendation</div>
                               <div className="font-semibold text-slate-200">{alert.suggested_action}</div>
                             </div>
                           </div>
                           <button className="btn-primary w-full sm:w-auto text-xs py-2 h-10">Execute Fix</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activePage === 'reports' && (
              <motion.div 
                key="reports"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <h2 className="text-xl font-bold">Facility Analytics</h2>
                  <div className="flex gap-3">
                    <button className="btn-ghost text-xs flex-1 sm:flex-initial">
                      <FileText className="w-4 h-4" /> CSV Export
                    </button>
                    <button className="btn-ghost text-xs flex-1 sm:flex-initial">
                      <FileText className="w-4 h-4" /> PDF Report
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                   <div className="glass-card p-6">
                      <h3 className="font-semibold text-sm mb-6 text-slate-400 uppercase tracking-widest">Efficiency Benchmark</h3>
                      <div className="flex items-end gap-5 mb-8">
                         <div className="text-7xl font-bold tracking-tighter text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">84</div>
                         <div className="pb-3">
                           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Percentile</div>
                           <div className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                             <TrendingDown className="w-3 h-3 rotate-180" /> +12% Efficiency
                           </div>
                         </div>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '84%' }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="bg-emerald-400 h-full shadow-[0_0_10px_#10b981]" 
                        />
                      </div>
                   </div>
                   <div className="glass-card p-6">
                      <h3 className="font-semibold text-sm mb-6 text-slate-400 uppercase tracking-widest">Savings Forecast</h3>
                      <div className="flex items-end gap-5 mb-8">
                         <div className="text-7xl font-bold tracking-tighter text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.3)]">$1.2k</div>
                         <div className="pb-3">
                           <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Variance</div>
                           <div className="text-xs text-cyan-400 font-bold">Smart Overrides Engaged</div>
                         </div>
                      </div>
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '65%' }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className="bg-cyan-400 h-full shadow-[0_0_10px_#22d3ee]" 
                        />
                      </div>
                   </div>
                </div>

                <div className="glass-card p-6 min-w-0">
                   <h3 className="font-semibold mb-8 text-slate-400 uppercase tracking-widest text-sm">Temporal Consumption Curve</h3>
                   <div className="h-[350px]" style={{ position: 'relative' }}>
                      <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={barData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                            contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)' }}
                          />
                          <Bar dataKey="usage" fill="#22d3ee" radius={[8, 8, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                   </div>
                </div>
              </motion.div>
            )}

            {activePage === 'recommendations' && (
              <AIInsights token={token} summary={summary} devices={devices} alerts={alerts} />
            )}
          </AnimatePresence>
        </div>
      </main>

      <DeviceDetailModal 
        device={selectedDevice} 
        onClose={() => setSelectedDevice(null)} 
        token={token}
      />
    </div>
  );
}

const DeviceDetailModal = ({ device, onClose, token }: { device: Device | null, onClose: () => void, token: string | null }) => {
  const [recommendation, setRecommendation] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Reset recommendation when device changes — do NOT auto-fire (saves quota)
  useEffect(() => {
    setRecommendation('');
  }, [device]);

  const generateDetailedRecommendation = async () => {
    if (!device || !token) return;
    setLoading(true);
    setRecommendation('');
    try {
      const prompt = `As an AI Building Energy Expert, provide a short, actionable energy schedule for this specific device:

Device Name: ${device.name}
Type: ${device.type}
Location: ${device.room_name}, Floor ${device.floor_number}
Current Status: ${device.status}
Current Power Draw: ${device.current_power} kW
Historical Energy (48h): ${device.daily_energy} kWh

Please provide ONLY:
1. A brief 1-sentence performance note.
2. 2-3 bullet points with specific times to turn the device ON and OFF for maximum efficiency.

Keep it very short and easy to read at a glance.`;
      const text = await callAI(token, prompt);
      setRecommendation(text);
    } catch (error: any) {
      console.error(error);
      setRecommendation(`⚠️ ${error?.message || 'Unable to generate AI recommendation at this time.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!device) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-8">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <DeviceIcon type={device.type} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{device.name}</h2>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{device.room_name} · Floor {device.floor_number}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Status</div>
                <div className={cn(
                  "text-sm font-bold uppercase",
                  device.status === 'ON' ? 'text-emerald-400' : 'text-slate-400'
                )}>{device.status}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Current Load</div>
                <div className="text-sm font-bold text-cyan-400 font-mono">{device.current_power.toFixed(1)} kW</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Daily Energy</div>
                <div className="text-sm font-bold text-slate-200 font-mono">{device.daily_energy.toFixed(2)} kWh</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Last Sync</div>
                <div className="text-sm font-bold text-slate-200">{format(new Date(device.last_active), 'HH:mm:ss')}</div>
              </div>
            </div>

            {/* AI Insights Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-white">AI Optimization Insights</h3>
              </div>
              
              <div className="glass-card p-6 bg-indigo-500/5 border-indigo-500/10">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-sm text-indigo-300 font-medium">Consulting Building Data Genome Project 2 dataset...</p>
                  </div>
                ) : recommendation ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-headings:font-bold prose-p:text-slate-400 prose-p:leading-relaxed prose-li:text-slate-400">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                      {recommendation}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-300 mb-1">AI Insights Ready</p>
                      <p className="text-xs text-slate-500">Click below to generate energy optimization recommendations</p>
                    </div>
                    <button
                      onClick={generateDetailedRecommendation}
                      className="btn-primary px-6 py-2.5 text-sm gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate AI Insights
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Technical Specifications Placeholder */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-500/20 flex items-center justify-center text-slate-400">
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg text-white">Node Specifications</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between p-3 border-b border-white/5">
                  <span className="text-slate-500">Protocol</span>
                  <span className="text-slate-300 font-mono">BACnet/IP</span>
                </div>
                <div className="flex justify-between p-3 border-b border-white/5">
                  <span className="text-slate-500">Update Frequency</span>
                  <span className="text-slate-300">30 seconds</span>
                </div>
                <div className="flex justify-between p-3 border-b border-white/5">
                  <span className="text-slate-500">Hardware ID</span>
                  <span className="text-slate-300 font-mono">NODE-X72-B${device.id}</span>
                </div>
                <div className="flex justify-between p-3 border-b border-white/5">
                  <span className="text-slate-500">Firmware</span>
                  <span className="text-slate-300 font-mono">v2.4.1-stable</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 bg-white/[0.01] flex justify-end gap-3">
            <button 
              onClick={onClose}
              className="btn-ghost px-6"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// Sub-components
const NavButton = ({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium group",
      active ? "bg-cyan-500 text-slate-900 shadow-lg shadow-cyan-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"
    )}
  >
    <div className="flex items-center gap-3">
      {icon}
      {label}
    </div>
    {count !== undefined && count > 0 && (
      <span className={cn(
        "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
        active ? "bg-slate-900 text-cyan-500" : "bg-red-500 text-white"
      )}>
        {count}
      </span>
    )}
  </button>
);

const StatCard = ({ label, value, trend, subtitle, icon }: { label: string, value: string, trend?: string, subtitle?: string, icon: React.ReactNode }) => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
        {icon}
      </div>
      {trend && (
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm",
          trend.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        )}>
          {trend}
        </span>
      )}
    </div>
    <div className="metric-label">{label}</div>
    <div className="metric-value mb-1 font-mono tracking-tight text-white">{value}</div>
    {subtitle && <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{subtitle}</div>}
  </div>
);

const DeviceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'HVAC': return <Wind className="w-5 h-5" />;
    case 'LIGHTING': return <Lightbulb className="w-5 h-5" />;
    case 'SERVER': return <Building2 className="w-5 h-5" />;
    case 'METER': return <BarChart3 className="w-5 h-5" />;
    case 'PUMP': return <Wind className="w-5 h-5" />;
    default: return <MousePointer2 className="w-5 h-5" />;
  }
};

const AIInsights = ({ token, summary, devices, alerts }: { token: string | null, summary: SummaryData | null, devices: Device[], alerts: Alert[] }) => {
  const [insight, setInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateInsight = async () => {
    if (!token || !summary) {
      setInsight('AI advisor offline or telemetry missing. Verify configuration.');
      return;
    }
    setLoading(true);
    try {
      const prompt = `As an expert Building Energy Consultant for the Aether Smart Building (BDG2 powered), analyze the following:
- Active Node Load: ${summary.currentPowerDemand} kW
- Cumulative Consumption: ${summary.totalEnergyToday} kWh
- Meter Status: ${summary.activeDevices} nodes active
- Waste Efficiency: ${summary.wastePercentage}%
- Critical Events: ${alerts.map((a: any) => a.message).join(', ')}

Recommend 3 specific operational improvements inspired by Building Data Genome Project 2 insights (e.g., peak shaving, occupancy sensor recalibration, thermal loop optimization).`;

      const text = await callAI(token, prompt);
      setInsight(text || 'Analysis complete. No critical waste detected.');
    } catch (err) {
      console.error(err);
      setInsight('AI advisor offline. Verify backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-card bg-gradient-to-br from-cyan-600/20 via-indigo-600/10 to-transparent p-8 lg:p-12 border-cyan-500/10 text-white relative overflow-hidden backdrop-blur-3xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none transform translate-x-20 -translate-y-20">
          <Zap className="w-96 h-96 text-cyan-400" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 px-4 py-2 rounded-full text-xs font-bold mb-8">
            <CheckCircle2 className="w-4 h-4 shadow-[0_0_8px_#22d3ee]" />
            Aether Intelligence v4.2
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-tight">Leverage neural nodes to <br />optimize your facility.</h2>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed font-medium">
            Trained on the Building Data Genome Project 2 dataset, our algorithms identify subtle inefficiencies in thermal loops and electrical distribution.
          </p>
          <button 
            onClick={generateInsight}
            disabled={loading}
            className="group btn-primary px-10 py-5 text-lg shadow-[0_0_30px_rgba(34,211,238,0.2)]"
          >
            {loading ? 'Processing Telemetry...' : 'Run Intelligence Audit'}
            <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {insight && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 lg:p-10"
        >
          <div className="flex items-center gap-4 mb-8">
             <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
                <Lightbulb className="w-7 h-7" />
             </div>
             <div>
                <h3 className="font-bold text-xl">Audit Directives</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Actionable insights for facility managers</p>
             </div>
          </div>
          <div className="whitespace-pre-wrap text-slate-300 leading-loose font-medium text-sm lg:text-base border-l-2 border-cyan-500/30 pl-8 ml-2">
            {insight}
          </div>
        </motion.div>
      )}
    </div>
  );
};

// Tooltip helpers
const chartData = Array.from({ length: 24 }).map((_, i) => ({
  time: `${i}:00`,
  kw: 40 + Math.random() * 60 + (i > 8 && i < 18 ? 30 : 0) // Higher usage during office hours
}));

const pieData = [
  { name: 'HVAC', value: 45 },
  { name: 'Lighting', value: 20 },
  { name: 'Office', value: 15 },
  { name: 'Server', value: 20 }
];

const COLORS = ['#0EA5E9', '#6366F1', '#F59E0B', '#10B981'];

const barData = [
  { name: 'Monday', usage: 4000 },
  { name: 'Tuesday', usage: 3000 },
  { name: 'Wednesday', usage: 2000 },
  { name: 'Thursday', usage: 2780 },
  { name: 'Friday', usage: 1890 },
  { name: 'Saturday', usage: 2390 },
  { name: 'Sunday', usage: 3490 },
];
