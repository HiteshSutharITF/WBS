import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  MessageSquare,
  AlertTriangle,
  Radio,
  ShieldCheck,
  TrendingUp,
  Activity
} from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import Badge from '../components/Badge';

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminService.getDashboardStats()
      .then((res) => setData(res.data))
      .catch((err) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const overview = data?.overview;
  const metaCap = data?.metaCap;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Global Diagnostics</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          ITFuturz Tech Provider Operations &bull; Real-time client health monitoring
        </p>
      </div>

      {/* Meta Rolling 7-Day Cap Warning Box (Requirement SA-08) */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-white text-sm">Meta Onboarding 7-Day Rolling Velocity (SA-08)</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {metaCap?.currentRolling7Days || 0} / {metaCap?.maxCap || 200} clients connected
          </span>
        </div>

        <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              metaCap?.warningActive ? 'bg-rose-500' : 'bg-amber-400'
            }`}
            style={{ width: `${Math.min(100, metaCap?.percentageUsed || 0)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Meta restricts Tech Providers to 200 new client onboardings per rolling 7 days. Platform alert triggers at 150.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tenants</p>
            <p className="text-2xl font-bold text-white mt-1">{overview?.totalTenants || 0}</p>
            <p className="text-xs text-emerald-400 mt-1">{overview?.activeTenants || 0} active</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected WABAs</p>
            <p className="text-2xl font-bold text-white mt-1">{overview?.connectedWabas || 0}</p>
            <p className="text-xs text-emerald-400 mt-1">Official Cloud API</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Messages Today</p>
            <p className="text-2xl font-bold text-white mt-1">{overview?.messagesToday || 0}</p>
            <p className="text-xs text-slate-400 mt-1">Inbound + Outbound</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Health Alerts</p>
            <p className="text-2xl font-bold text-white mt-1">{overview?.alertsCount || 0}</p>
            <p className="text-xs text-amber-400 mt-1">Expiring / Quality</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
