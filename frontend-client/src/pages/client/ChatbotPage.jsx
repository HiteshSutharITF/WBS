import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Plus,
  Trash2,
  Edit,
  Zap,
  Clock,
  UserCheck,
  Tag,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { chatbotService } from '../../services/chatbotService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';

const ChatbotPage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Rule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    name: '',
    triggerType: 'keyword',
    matchType: 'contains',
    keywords: '',
    responseType: 'text',
    responseText: '',
    addTag: '',
    updateLeadStage: '',
    pauseBot: false
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef(null);
  const keywordsRef = useRef(null);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await chatbotService.listRules();
      setRules(res.data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const openCreateModal = () => {
    setEditingRule(null);
    setRuleForm({
      name: '',
      triggerType: 'keyword',
      matchType: 'contains',
      keywords: '',
      responseType: 'text',
      responseText: '',
      addTag: '',
      updateLeadStage: '',
      pauseBot: false
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      triggerType: rule.triggerType,
      matchType: rule.matchType,
      keywords: rule.keywords?.join(', ') || '',
      responseType: rule.responseType,
      responseText: rule.responseText || '',
      addTag: rule.actions?.addTag || '',
      updateLeadStage: rule.actions?.updateLeadStage || '',
      pauseBot: !!rule.actions?.pauseBot
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const errs = {};
    if (!ruleForm.name.trim()) errs.name = 'Rule name is required.';
    if (ruleForm.triggerType === 'keyword' && !ruleForm.keywords.trim()) {
      errs.keywords = 'At least one trigger keyword is required.';
    }
    setFormErrors(errs);

    if (errs.name && nameRef.current) {
      nameRef.current.focus();
    } else if (errs.keywords && keywordsRef.current) {
      keywordsRef.current.focus();
    }

    return Object.keys(errs).length === 0;
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: ruleForm.name.trim(),
        triggerType: ruleForm.triggerType,
        matchType: ruleForm.matchType,
        keywords: ruleForm.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        responseType: ruleForm.responseType,
        responseText: ruleForm.responseText,
        actions: {
          addTag: ruleForm.addTag,
          updateLeadStage: ruleForm.updateLeadStage,
          pauseBot: ruleForm.pauseBot || ruleForm.responseType === 'hand_off'
        }
      };

      if (editingRule) {
        await chatbotService.updateRule(editingRule._id, payload);
      } else {
        await chatbotService.createRule(payload);
      }

      setIsModalOpen(false);
      fetchRules();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Delete this chatbot rule?')) return;
    try {
      await chatbotService.deleteRule(ruleId);
      fetchRules();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chatbot & Automated Hand-Off</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure instant auto-replies, keyword triggers, working-hour greetings, and automated human hand-off.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreateModal} icon={Plus}>
          New Bot Rule
        </Button>
      </div>

      {/* Rules List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            Loading chatbot rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            No chatbot rules configured. Click "New Bot Rule" to set up auto-replies.
          </div>
        ) : (
          rules.map((rule) => (
            <div
              key={rule._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      {rule.responseType === 'hand_off' ? (
                        <UserCheck className="w-4 h-4 text-purple-600" />
                      ) : rule.triggerType === 'welcome' ? (
                        <Zap className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{rule.name}</h3>
                      <p className="text-[11px] text-slate-400 capitalize">{rule.triggerType} Trigger</p>
                    </div>
                  </div>
                  <Badge variant={rule.isActive ? 'green' : 'gray'} size="xs">
                    {rule.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                {/* Triggers & Keywords */}
                {rule.triggerType === 'keyword' && (
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Matched Keywords ({rule.matchType})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {rule.keywords?.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-mono">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Text */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-3">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Automated Action / Reply</p>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap">{rule.responseText || '[Action Only]'}</p>
                </div>

                {/* Action badges */}
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  {rule.actions?.addTag && (
                    <Badge variant="blue" size="xs">Tag: {rule.actions.addTag}</Badge>
                  )}
                  {rule.actions?.updateLeadStage && (
                    <Badge variant="purple" size="xs">Stage: {rule.actions.updateLeadStage}</Badge>
                  )}
                  {rule.actions?.pauseBot && (
                    <Badge variant="yellow" size="xs">Pauses Bot (Human Mode)</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
                <Button variant="outline" size="sm" onClick={() => openEditModal(rule)} icon={Edit}>
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDeleteRule(rule._id)} icon={Trash2}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Rule Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? 'Edit Chatbot Rule' : 'Create Chatbot Automation Rule'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveRule} isLoading={submitting}>
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveRule} className="space-y-4" noValidate>
          <Input
            ref={nameRef}
            label="Rule Name"
            placeholder="e.g. Inquire Quotation & Hand Off"
            value={ruleForm.name}
            onChange={(e) => {
              setRuleForm({ ...ruleForm, name: e.target.value });
              if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
            }}
            error={formErrors.name}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Trigger Type</label>
              <select
                value={ruleForm.triggerType}
                onChange={(e) => setRuleForm({ ...ruleForm, triggerType: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
              >
                <option value="keyword">Keyword Trigger</option>
                <option value="welcome">Welcome Inbound Greeting</option>
                <option value="away">Away Message (Outside Working Hours)</option>
              </select>
            </div>

            {ruleForm.triggerType === 'keyword' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Match Condition</label>
                <select
                  value={ruleForm.matchType}
                  onChange={(e) => setRuleForm({ ...ruleForm, matchType: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
                >
                  <option value="contains">Contains Any Keyword</option>
                  <option value="exact">Exact Match</option>
                  <option value="starts_with">Starts With</option>
                </select>
              </div>
            )}
          </div>

          {ruleForm.triggerType === 'keyword' && (
            <Input
              ref={keywordsRef}
              label="Trigger Keywords (Comma separated)"
              placeholder="e.g. quote, price, pricing, catalog, human, agent"
              value={ruleForm.keywords}
              onChange={(e) => {
                setRuleForm({ ...ruleForm, keywords: e.target.value });
                if (formErrors.keywords) setFormErrors({ ...formErrors, keywords: '' });
              }}
              error={formErrors.keywords}
              required
            />
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Auto-Reply Text</label>
            <textarea
              rows={3}
              placeholder="e.g. Thank you for your inquiry! Connecting you with our sales representative right now."
              value={ruleForm.responseText}
              onChange={(e) => setRuleForm({ ...ruleForm, responseText: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none"
            />
          </div>

          {/* Hand-off and CRM Actions */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h5 className="font-semibold text-xs text-slate-800 uppercase">Automation & Hand-off Actions</h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Add Tag to Contact (Optional)"
                placeholder="e.g. high-intent, quote-requested"
                value={ruleForm.addTag}
                onChange={(e) => setRuleForm({ ...ruleForm, addTag: e.target.value })}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Update Lead Stage</label>
                <select
                  value={ruleForm.updateLeadStage}
                  onChange={(e) => setRuleForm({ ...ruleForm, updateLeadStage: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                >
                  <option value="">Keep Existing Stage</option>
                  <option value="engaged">Engaged</option>
                  <option value="qualified">Qualified</option>
                  <option value="handed_off">Handed Off</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="pauseBotCheck"
                checked={ruleForm.pauseBot}
                onChange={(e) => setRuleForm({ ...ruleForm, pauseBot: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="pauseBotCheck" className="text-xs text-slate-800 font-medium cursor-pointer">
                <b>Human Hand-off:</b> Pause automated bot responses for this conversation upon trigger.
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ChatbotPage;
