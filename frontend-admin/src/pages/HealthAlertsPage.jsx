import React, { useState, useEffect } from 'react';
import { AlertTriangle, BellRing, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import Badge from '../components/Badge';
import { formatDate } from '../utils/formatters';

const HealthAlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superAdminService.getHealthAlerts()
      .then((res) => setAlerts(res.data || []))
      .catch((err) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System & Token Health Alerts (SA-04)</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Proactive alerts for tokens expiring within 7 days, quality rating drops, or disconnected numbers.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading health alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="font-semibold text-white">All Client Accounts Healthy</p>
          <p className="text-xs text-slate-500 mt-1">No expiring access tokens or degraded WhatsApp phone numbers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((a) => (
            <div key={a._id} className="bg-slate-950 border border-amber-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">{a.tenantId?.name || 'Client'}</span>
                <Badge variant="yellow" size="xs">Warning</Badge>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Phone: {a.displayPhoneNumber} &bull; Quality: {a.qualityRating}
              </p>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                Token expires on {formatDate(a.tokenExpiresAt)}. Client will need to reconnect before expiry to prevent interruption.
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HealthAlertsPage;
