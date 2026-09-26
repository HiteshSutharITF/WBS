import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  FileText,
  Radio,
  Bot,
  UserCheck,
  Settings,
  LogOut,
  Menu,
  X,
  PhoneCall
} from 'lucide-react';
import { authService } from '../../services/authService';
import { tenantService } from '../../services/tenantService';
import { initSocketClient, disconnectSocket } from '../../utils/socket';
import Badge from '../common/Badge';

const ClientLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(authService.getCurrentUser());
  const [tenant, setTenant] = useState(authService.getCurrentTenant());
  const [wabaAccount, setWabaAccount] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isInbox = (location.pathname || '').includes('inbox');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Initialize Socket.io
    if (user.tenantId) {
      initSocketClient(user.tenantId);
    }

    // Fetch tenant profile and WABA status
    tenantService.getProfile()
      .then((res) => {
        if (res.data?.tenant) setTenant(res.data.tenant);
        if (res.data?.wabaAccount) setWabaAccount(res.data.wabaAccount);
      })
      .catch((err) => console.error('Failed to load profile:', err.message));

    return () => {
      disconnectSocket();
    };
  }, [navigate]);

  const handleLogout = () => {
    authService.logout();
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/onboarding', label: 'Connect WhatsApp', icon: PhoneCall },
    { to: '/inbox', label: 'Team Inbox & Chats', icon: MessageSquare },
    { to: '/contacts', label: 'Contacts & Leads', icon: Users },
    { to: '/templates', label: 'Templates', icon: FileText },
    { to: '/broadcasts', label: 'Broadcasts', icon: Radio },
    { to: '/chatbot', label: 'Chatbot & Automation', icon: Bot },
  ];

  if (user?.role === 'client_admin') {
    navItems.push({ to: '/team', label: 'Team Members', icon: UserCheck });
    navItems.push({ to: '/settings', label: 'Business Settings', icon: Settings });
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800">
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-emerald-500/20">
              W
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">WBS Client</h1>
              <p className="text-[10px] text-emerald-400 font-medium tracking-wide uppercase mt-0.5">Meta Cloud API v25.0</p>
            </div>
          </div>
        </div>

        {/* Business & WhatsApp Connection Status */}
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{tenant?.name || 'My Business'}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.name} ({user?.role === 'client_admin' ? 'Admin' : 'Agent'})</p>
            </div>
            {wabaAccount?.status === 'connected' ? (
              <Badge variant="green" size="xs">Live</Badge>
            ) : (
              <Badge variant="yellow" size="xs">Setup</Badge>
            )}
          </div>
        </div>

        {/* Navigation Links */}
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
                      ? 'bg-[#00a884] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Logout */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header Bar — hidden on inbox for full WhatsApp layout */}
        {!isInbox && (
          <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-between px-4 md:px-8 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div>
                <h2 className="text-base font-semibold text-slate-800">{tenant?.name || 'WhatsApp Business Solution'}</h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {wabaAccount?.displayPhoneNumber && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{wabaAccount.displayPhoneNumber}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  {user?.name?.[0] || 'U'}
                </div>
                <span className="text-xs font-medium text-slate-700 hidden md:inline">{user?.name}</span>
              </div>
            </div>
          </header>
        )}

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs flex">
            <div className="w-72 bg-slate-900 text-slate-300 h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800">
                <span className="font-bold text-white">WBS Client</span>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl ${
                          isActive ? 'bg-[#00a884] text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm font-medium text-rose-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Viewport — full-bleed WhatsApp inbox */}
        <main
          className={
            isInbox
              ? 'flex-1 overflow-hidden bg-[#111b21] p-0 relative'
              : 'flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50'
          }
        >
          {isInbox && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden absolute top-3 left-3 z-30 p-2 rounded-full bg-[#f0f2f5] text-[#54656f] shadow"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;
