import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  FileText,
  Radio,
  Clock,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { chatService } from '../../services/chatService';
import { contactService } from '../../services/contactService';
import { templateService } from '../../services/templateService';
import { tenantService } from '../../services/tenantService';
import Badge from '../../components/common/Badge';

const DashboardPage = () => {
  const [stats, setStats] = useState({
    conversationsCount: 0,
    openConversationsCount: 0,
    contactsCount: 0,
    templatesCount: 0,
  });
  const [waba, setWaba] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      chatService.listConversations(),
      contactService.listContacts(),
      templateService.listTemplates(),
      tenantService.getProfile(),
    ])
      .then(([chatsRes, contactsRes, tmplRes, profileRes]) => {
        const chats = chatsRes.data || [];
        setStats({
          conversationsCount: chats.length,
          openConversationsCount: chats.filter((c) => c.status === 'open').length,
          contactsCount: contactsRes.data?.total || contactsRes.data?.contacts?.length || 0,
          templatesCount: tmplRes.data?.length || 0,
        });
        setWaba(profileRes.data?.wabaAccount || null);
      })
      .catch((err) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Official Meta Cloud API v25.0
              </span>
              {waba?.status === 'connected' ? (
                <Badge variant="green" size="xs">Connected & Active</Badge>
              ) : (
                <Badge variant="yellow" size="xs">WhatsApp Disconnected</Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">WhatsApp Business Command Center</h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Engage incoming leads instantly, manage team inbox responses within the 24-hour window, broadcast campaigns to opted-in audiences, and automate human hand-off.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            {waba?.status !== 'connected' && (
              <Link
                to="/onboarding"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>Connect WhatsApp</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              to="/inbox"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2"
            >
              <span>Open Team Inbox</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 24-Hour Policy Notice Box */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-0.5">Meta 24-Hour Customer Service Window Active</p>
          <p className="text-blue-700 text-xs">
            Free-form two-way messages are permitted within 24 hours of customer’s last inbound message. When the 24-hour window lapses, the conversation automatically locks to Meta pre-approved templates to re-initiate contact.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Conversations</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.openConversationsCount}</p>
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Real-time incoming
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">CRM Leads / Contacts</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.contactsCount}</p>
            <p className="text-xs text-slate-500 mt-1">Opted-in profiles</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Templates</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.templatesCount}</p>
            <p className="text-xs text-slate-500 mt-1">Meta verified</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Messaging Tier</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{waba?.messagingLimit || 'TIER_250'}</p>
            <p className="text-xs text-emerald-600 mt-1">Quality: {waba?.qualityRating || 'GREEN'}</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Radio className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Live Team Inbox</h3>
            <p className="text-xs text-slate-600">
              Engage incoming WhatsApp leads in real-time, share images/PDFs, attach private notes, and monitor the 24h countdown.
            </p>
          </div>
          <Link to="/inbox" className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            Open Chat Inbox <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">CRM Leads & Profiling</h3>
            <p className="text-xs text-slate-600">
              Track contacts through pipeline stages: New &rarr; Engaged &rarr; Qualified &rarr; Handed Off &rarr; Converted. Import opted-in CSV leads.
            </p>
          </div>
          <Link to="/contacts" className="mt-4 text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1">
            Manage Contacts <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">Broadcast Campaigns</h3>
            <p className="text-xs text-slate-600">
              Launch targeted marketing or utility broadcasts with variable parameter mapping, adhering to Meta throughput limits.
            </p>
          </div>
          <Link to="/broadcasts" className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
            Create Campaign <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
