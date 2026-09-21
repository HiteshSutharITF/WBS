import React, { useState, useEffect } from 'react';
import { ScrollText, Search, Shield } from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import { formatDate } from '../utils/formatters';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminService.listAuditLogs()
      .then((res) => setLogs(res.data?.logs || []))
      .catch((err) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Audit Trail (SA-09)</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Tamper-proof log of staff and business owner actions across all tenants.
        </p>
      </div>

      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Details</th>
                <th className="px-6 py-3.5">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500 font-sans">Loading audit trail...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-8 text-slate-500 font-sans">No audit events recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-6 py-4 text-amber-400 font-bold whitespace-nowrap">{log.action}</td>
                    <td className="px-6 py-4 text-slate-300">
                      <div>{log.userEmail}</div>
                      <div className="text-[10px] text-slate-500">{log.role}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{log.ipAddress || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogsPage;
