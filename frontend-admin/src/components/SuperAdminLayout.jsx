import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Building2,
  BellRing,
  ScrollText,
  LogOut,
  ExternalLink
} from 'lucide-react';
import { authService } from '../services/authService';

const SuperAdminLayout = () => {
  const navigate = useNavigate();
  const [user] = useState(authService.getCurrentUser());

  useEffect(() => {
    if (!user || (user.role !== 'super_admin' && user.role !== 'support')) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleLogout = () => {
    authService.logout();
  };

  const navItems = [
    { to: '/', label: 'Platform Overview', icon: ShieldAlert },
    { to: '/tenants', label: 'Businesses & Clients', icon: Building2 },
    { to: '/alerts', label: 'Token & Health Alerts', icon: BellRing },
    { to: '/audit', label: 'Audit Trail', icon: ScrollText },
  ];

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      {/* Super Admin Dark Sidebar */}
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0">
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md shadow-amber-500/20">
              SA
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">ITFuturz Admin</h1>
              <p className="text-[10px] text-amber-400 font-semibold uppercase">Super Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-900">
        <header className="h-16 border-b border-slate-800 px-8 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-sm font-semibold text-slate-200">Meta Tech Provider Operations Hub</h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">Staff: {user?.email}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
