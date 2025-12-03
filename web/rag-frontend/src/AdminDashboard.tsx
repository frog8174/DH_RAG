import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  LayoutDashboard, FileText, Settings, Users, Activity, 
  TrendingUp, BookOpen, Clock, AlertCircle
} from 'lucide-react';

// --- Types ---
type DashboardStats = {
    kpi: {
        total_generations: number;
        today_generations: number;
        active_users_today: number;
    };
    charts: {
        subject_distribution: { name: string; value: number }[];
        topic_cloud: { text: string; value: number }[];
        daily_trend: { date: string; count: number }[];
    };
};

type Props = {
    user: any; // User type passed from parent
    onManageUsers: () => void;
    onManagePrompts: () => void;
    onViewLogs: () => void;
    currentView: "dashboard" | "users" | "prompts" | "logs";
    setCurrentView: (view: "dashboard" | "users" | "prompts" | "logs") => void;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const AdminDashboard: React.FC<Props> = ({ user, onManageUsers, onManagePrompts, onViewLogs, currentView, setCurrentView }) => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentView === "dashboard") {
            fetchStats();
        }
    }, [currentView]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/stats");
            if (res.ok) {
                setStats(await res.json());
            }
        } catch (e) {
            console.error("Failed to fetch stats", e);
        } finally {
            setLoading(false);
        }
    };

    const KPICard = ({ title, value, icon: Icon, color }: any) => (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className={`p-3 rounded-full ${color} text-white`}>
                <Icon size={24} />
            </div>
            <div>
                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">{title}</div>
                <div className="text-2xl font-bold text-slate-800">{value}</div>
            </div>
        </div>
    );

    return (
        <div className="flex h-full bg-slate-50">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 flex-shrink-0 flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="text-blue-600" />
                        Admin Portal
                    </h2>
                </div>
                <nav className="p-4 space-y-2 flex-1">
                    <button 
                        onClick={() => setCurrentView("dashboard")}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === "dashboard" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <LayoutDashboard size={18} />
                        儀表板 (Dashboard)
                    </button>
                    <button 
                        onClick={() => { setCurrentView("logs"); onViewLogs(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === "logs" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <FileText size={18} />
                        出題日誌 (Logs)
                    </button>
                    <button 
                        onClick={() => { setCurrentView("prompts"); onManagePrompts(); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === "prompts" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                    >
                        <Settings size={18} />
                        Prompt 管理
                    </button>
                    {user?.role === 'admin' && (
                        <button 
                            onClick={() => { setCurrentView("users"); onManageUsers(); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${currentView === "users" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}
                        >
                            <Users size={18} />
                            使用者管理
                        </button>
                    )}
                </nav>
                <div className="p-4 border-t border-slate-100 text-xs text-slate-400">
                    System v0.6.0
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                {currentView === "dashboard" && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl font-bold text-slate-800">系統概況</h1>
                            <button onClick={fetchStats} className="text-sm text-blue-600 hover:underline">Refresh</button>
                        </div>

                        {/* KPI Section */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <KPICard 
                                title="今日生成" 
                                value={loading ? "..." : stats?.kpi.today_generations} 
                                icon={Clock} 
                                color="bg-blue-500" 
                            />
                            <KPICard 
                                title="總題庫數" 
                                value={loading ? "..." : stats?.kpi.total_generations} 
                                icon={BookOpen} 
                                color="bg-emerald-500" 
                            />
                            <KPICard 
                                title="今日活躍用戶" 
                                value={loading ? "..." : stats?.kpi.active_users_today} 
                                icon={Users} 
                                color="bg-violet-500" 
                            />
                        </div>

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Trend Chart */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-slate-400"/>
                                    近 30 日出題趨勢
                                </h3>
                                <div className="h-64 w-full">
                                    {loading ? <div className="h-full flex items-center justify-center text-slate-300">Loading...</div> : (
                                        <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                                            <LineChart data={stats?.charts.daily_trend}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{fontSize: 10}} tickFormatter={(val) => val.slice(5)} />
                                                <YAxis allowDecimals={false} tick={{fontSize: 10}} />
                                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{r: 6}} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Subject Distribution */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <BookOpen size={20} className="text-slate-400"/>
                                    熱門學科分佈
                                </h3>
                                <div className="h-64 w-full flex items-center justify-center">
                                    {loading ? <div className="text-slate-300">Loading...</div> : (
                                        <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                                            <PieChart>
                                                <Pie
                                                    data={stats?.charts.subject_distribution}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {stats?.charts.subject_distribution.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '12px'}} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Topic Cloud (Simple List for now, or Bar Chart) */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <AlertCircle size={20} className="text-slate-400"/>
                                熱門關鍵字 (Top Topics)
                            </h3>
                            <div className="h-64 w-full">
                                {loading ? <div className="h-full flex items-center justify-center text-slate-300">Loading...</div> : (
                                    <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                                        <BarChart data={stats?.charts.topic_cloud} layout="vertical" margin={{left: 20}}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="text" type="category" width={100} tick={{fontSize: 11}} />
                                            <Tooltip cursor={{fill: 'transparent'}} />
                                            <Bar dataKey="value" fill="#8884d8" radius={[0, 4, 4, 0]} barSize={20}>
                                                {stats?.charts.topic_cloud.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Placeholders for other views, they are rendered by Parent but we control layout here if needed. 
                    Actually, parent renders them. This component is mostly for the Dashboard VIEW + Layout Shell. 
                    To fix this pattern properly, the parent should pass the content to be rendered inside the main area
                    OR this component renders the children. 
                    Let's assume this component *replaces* the content area of the Admin view in App.tsx.
                */}
            </div>
        </div>
    );
};

export default AdminDashboard;
