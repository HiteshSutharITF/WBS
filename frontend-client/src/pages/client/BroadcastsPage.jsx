import React, { useState, useEffect } from 'react';
import {
  Radio,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  Calendar,
  Users,
  Send,
  RefreshCw
} from 'lucide-react';
import { broadcastService } from '../../services/broadcastService';
import { templateService } from '../../services/templateService';
import { contactService } from '../../services/contactService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { formatDate } from '../../utils/formatters';

const BroadcastsPage = () => {
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create Broadcast Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [variableMapping, setVariableMapping] = useState({});
  const [creating, setCreating] = useState(false);

  // Delivery Report Modal State
  const [reportModalData, setReportModalData] = useState(null);

  const fetchBroadcasts = async () => {
    setLoading(true);
    try {
      const res = await broadcastService.listBroadcasts();
      setBroadcasts(res.data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
    templateService.listTemplates({ status: 'APPROVED' }).then((res) => setTemplates(res.data || [])).catch(() => {});
  }, []);

  const handleStartBroadcast = async (broadcastId) => {
    if (!window.confirm('Start sending this broadcast to all selected opted-in recipients?')) return;
    try {
      await broadcastService.startBroadcast(broadcastId);
      fetchBroadcasts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    if (!campaignName.trim() || !selectedTemplateId) {
      alert('Please provide a campaign name and select an approved template.');
      return;
    }

    setCreating(true);
    try {
      await broadcastService.createBroadcast({
        name: campaignName.trim(),
        templateId: selectedTemplateId,
        targetSegment: {
          tags: selectedTag ? [selectedTag] : [],
          allOptedIn: true
        },
        variableMapping
      });
      setIsCreateModalOpen(false);
      setCampaignName('');
      setSelectedTemplateId('');
      setSelectedTag('');
      setVariableMapping({});
      fetchBroadcasts();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Broadcast Campaigns</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Send bulk approved template messages to targeted opted-in customer segments.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          icon={Plus}
        >
          New Campaign
        </Button>
      </div>

      {/* Broadcasts List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Campaign Name</th>
                <th className="px-6 py-3.5">Template</th>
                <th className="px-6 py-3.5">Audience</th>
                <th className="px-6 py-3.5">Progress / Sent</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">
                    Loading campaigns...
                  </td>
                </tr>
              ) : broadcasts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">
                    No broadcast campaigns yet. Click "New Campaign" to create one.
                  </td>
                </tr>
              ) : (
                broadcasts.map((bcast) => (
                  <tr key={bcast._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900 text-xs">{bcast.name}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(bcast.createdAt)}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-700">
                      {bcast.templateId?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="font-bold text-slate-800">{bcast.totalRecipients}</span> opted-in contacts
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 font-semibold">{bcast.sentCount} sent</span>
                        {bcast.failedCount > 0 && (
                          <span className="text-rose-500 font-semibold">({bcast.failedCount} failed)</span>
                        )}
                      </div>
                      <div className="w-28 bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full"
                          style={{
                            width: `${
                              bcast.totalRecipients > 0
                                ? (bcast.sentCount / bcast.totalRecipients) * 100
                                : 0
                            }%`
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          bcast.status === 'completed'
                            ? 'green'
                            : bcast.status === 'processing'
                            ? 'blue'
                            : bcast.status === 'failed'
                            ? 'red'
                            : 'yellow'
                        }
                        size="xs"
                      >
                        {bcast.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {bcast.status === 'draft' && (
                          <Button
                            variant="whatsapp"
                            size="sm"
                            onClick={() => handleStartBroadcast(bcast._id)}
                            icon={Send}
                          >
                            Send Now
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReportModalData(bcast)}
                          icon={Eye}
                        >
                          Report
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Broadcast Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Targeted WhatsApp Broadcast"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateBroadcast} isLoading={creating}>
              Save Campaign
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateBroadcast} className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g. Diwali Festive Sale Blast"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Select Approved Template</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
            >
              <option value="">Choose Template...</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.category})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Filter Audience by Tag (Optional)"
            placeholder="Leave empty for all opted-in contacts, or e.g. vip, retail"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            helperText="Only contacts with opt-in recorded will be eligible for delivery."
          />

          {/* Dynamic Variable Mapping */}
          {selectedTemplate && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h5 className="font-semibold text-xs text-slate-800 uppercase">Map Template Placeholders</h5>
              {(selectedTemplate.body.text.match(/\{\{\d+\}\}/g) || []).map((match, idx) => {
                const varNum = idx + 1;
                return (
                  <div key={varNum} className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-blue-700 shrink-0">
                      {`{{${varNum}}}`}
                    </span>
                    <select
                      value={variableMapping[varNum] || 'name'}
                      onChange={(e) => setVariableMapping({ ...variableMapping, [varNum]: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="name">Contact Name</option>
                      <option value="phone">Contact Phone</option>
                      <option value="email">Contact Email</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </form>
      </Modal>

      {/* Delivery Report Modal */}
      <Modal
        isOpen={!!reportModalData}
        onClose={() => setReportModalData(null)}
        title={`Delivery Analytics: ${reportModalData?.name}`}
        footer={
          <Button variant="secondary" onClick={() => setReportModalData(null)}>Close</Button>
        }
      >
        {reportModalData && (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[10px] uppercase text-slate-500 font-semibold">Total Audience</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{reportModalData.totalRecipients}</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-[10px] uppercase text-blue-700 font-semibold">Sent</p>
                <p className="text-xl font-bold text-blue-900 mt-1">{reportModalData.sentCount}</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-[10px] uppercase text-emerald-700 font-semibold">Delivered</p>
                <p className="text-xl font-bold text-emerald-900 mt-1">{reportModalData.deliveredCount}</p>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                <p className="text-[10px] uppercase text-rose-700 font-semibold">Failed</p>
                <p className="text-xl font-bold text-rose-900 mt-1">{reportModalData.failedCount}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <p><b>Template Used:</b> {reportModalData.templateId?.name}</p>
              <p><b>Created:</b> {formatDate(reportModalData.createdAt)}</p>
              <p><b>Status:</b> {reportModalData.status}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BroadcastsPage;
