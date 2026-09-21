import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { templateService } from '../../services/templateService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';

const TemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [messageAlert, setMessageAlert] = useState({ type: '', text: '' });

  // Create Template Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    category: 'MARKETING',
    language: 'en_US',
    headerType: 'NONE',
    headerText: '',
    bodyText: '',
    footerText: '',
    buttonType: 'NONE',
    buttonText: '',
    buttonValue: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef(null);
  const bodyRef = useRef(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templateService.listTemplates({ category: categoryFilter });
      setTemplates(res.data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [categoryFilter]);

  const handleSyncMeta = async () => {
    setSyncing(true);
    setMessageAlert({ type: '', text: '' });
    try {
      const res = await templateService.syncTemplates();
      setTemplates(res.data || []);
      setMessageAlert({ type: 'success', text: res.message });
    } catch (err) {
      setMessageAlert({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!templateForm.name.trim()) {
      errs.name = 'Template name is required.';
    } else if (!/^[a-z0-9_]+$/.test(templateForm.name)) {
      errs.name = 'Only lowercase letters, numbers, and underscores allowed.';
    }

    if (!templateForm.bodyText.trim()) {
      errs.bodyText = 'Template body message is required.';
    }

    setFormErrors(errs);

    if (errs.name && nameRef.current) {
      nameRef.current.focus();
    } else if (errs.bodyText && bodyRef.current) {
      bodyRef.current.focus();
    }

    return Object.keys(errs).length === 0;
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    setMessageAlert({ type: '', text: '' });
    try {
      const buttons = [];
      if (templateForm.buttonType !== 'NONE' && templateForm.buttonText) {
        buttons.push({
          type: templateForm.buttonType,
          text: templateForm.buttonText,
          value: templateForm.buttonValue
        });
      }

      const payload = {
        name: templateForm.name.toLowerCase().trim(),
        category: templateForm.category,
        language: templateForm.language,
        header: {
          format: templateForm.headerType,
          text: templateForm.headerText
        },
        body: {
          text: templateForm.bodyText
        },
        footer: {
          text: templateForm.footerText
        },
        buttons
      };

      const res = await templateService.createTemplate(payload);
      setMessageAlert({ type: 'success', text: res.message });
      setIsCreateModalOpen(false);
      setTemplateForm({
        name: '',
        category: 'MARKETING',
        language: 'en_US',
        headerType: 'NONE',
        headerText: '',
        bodyText: '',
        footerText: '',
        buttonType: 'NONE',
        buttonText: '',
        buttonValue: ''
      });
      fetchTemplates();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await templateService.deleteTemplate(templateId);
      fetchTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Message Templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Meta pre-approved formats for outbound marketing and re-initiating contact after 24 hours.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncMeta}
            isLoading={syncing}
            icon={RefreshCw}
          >
            Sync from Meta
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            icon={Plus}
          >
            Create Template
          </Button>
        </div>
      </div>

      {messageAlert.text && (
        <Alert type={messageAlert.type} message={messageAlert.text} />
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        {['all', 'MARKETING', 'UTILITY', 'AUTHENTICATION'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl capitalize transition-colors ${
              categoryFilter === cat
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 text-sm">
            No templates found. Click "Create Template" to submit one to Meta.
          </div>
        ) : (
          templates.map((tmpl) => (
            <div
              key={tmpl._id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-bold text-slate-900 text-sm truncate font-mono">
                    {tmpl.name}
                  </span>
                  <Badge
                    variant={
                      tmpl.status === 'APPROVED'
                        ? 'green'
                        : tmpl.status === 'REJECTED'
                        ? 'red'
                        : 'yellow'
                    }
                    size="xs"
                  >
                    {tmpl.status}
                  </Badge>
                </div>

                {/* WhatsApp Chat Preview Card */}
                <div className="bg-[#EFEAE2] p-3.5 rounded-xl border border-slate-200/60 text-xs shadow-inner space-y-2 mb-3">
                  {tmpl.header?.format === 'TEXT' && (
                    <p className="font-bold text-slate-900">{tmpl.header.text}</p>
                  )}
                  {tmpl.header?.format === 'IMAGE' && (
                    <div className="h-20 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 text-[10px]">
                      [Header Image]
                    </div>
                  )}
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{tmpl.body.text}</p>
                  {tmpl.footer?.text && (
                    <p className="text-[10px] text-slate-500">{tmpl.footer.text}</p>
                  )}
                  {tmpl.buttons?.map((btn, idx) => (
                    <div
                      key={idx}
                      className="py-1 px-3 bg-white text-blue-600 font-semibold text-center rounded-lg shadow-2xs border border-slate-200/60"
                    >
                      {btn.text}
                    </div>
                  ))}
                </div>

                {tmpl.status === 'REJECTED' && tmpl.rejectionReason && (
                  <p className="text-xs text-rose-600 mb-2">Reason: {tmpl.rejectionReason}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-400">
                <span>{tmpl.category} &bull; {tmpl.language}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(tmpl._id)}
                  className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                  title="Delete Template"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Template Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create & Submit Meta WhatsApp Template"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateTemplate} isLoading={submitting}>
              Submit to Meta
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateTemplate} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              ref={nameRef}
              label="Template Name"
              placeholder="e.g. order_alert_v1"
              value={templateForm.name}
              onChange={(e) => {
                setTemplateForm({ ...templateForm, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
              }}
              error={formErrors.name}
              helperText="Only lowercase letters, numbers, and underscores allowed"
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <select
                value={templateForm.category}
                onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
              >
                <option value="MARKETING">Marketing (Offers, Promotions)</option>
                <option value="UTILITY">Utility (Order updates, Receipts)</option>
                <option value="AUTHENTICATION">Authentication (OTPs, Security codes)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">Header Format</label>
              <select
                value={templateForm.headerType}
                onChange={(e) => setTemplateForm({ ...templateForm, headerType: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
              >
                <option value="NONE">None</option>
                <option value="TEXT">Text Title</option>
                <option value="IMAGE">Image</option>
                <option value="DOCUMENT">Document / PDF</option>
              </select>
            </div>

            {templateForm.headerType === 'TEXT' && (
              <Input
                label="Header Text"
                placeholder="e.g. Exclusive Offer Inside!"
                value={templateForm.headerText}
                onChange={(e) => setTemplateForm({ ...templateForm, headerText: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Message Body Text <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={bodyRef}
              rows={4}
              placeholder="Hi {{1}}, thank you for contacting us. Your appointment is confirmed for {{2}}."
              value={templateForm.bodyText}
              onChange={(e) => {
                setTemplateForm({ ...templateForm, bodyText: e.target.value });
                if (formErrors.bodyText) setFormErrors({ ...formErrors, bodyText: '' });
              }}
              className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl outline-none ${
                formErrors.bodyText ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200'
              }`}
            />
            {formErrors.bodyText && (
              <p className="text-xs font-medium text-red-500">{formErrors.bodyText}</p>
            )}
            <p className="text-xs text-slate-400">
              Use `{'{{1}}'}`, `{'{{2}}'}` placeholders for dynamic customer data.
            </p>
          </div>

          <Input
            label="Footer Text (Optional)"
            placeholder="e.g. Reply STOP to unsubscribe"
            value={templateForm.footerText}
            onChange={(e) => setTemplateForm({ ...templateForm, footerText: e.target.value })}
          />

          {/* Interactive Button */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h5 className="font-semibold text-xs text-slate-800 uppercase">Interactive CTA Button</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Button Type</label>
                <select
                  value={templateForm.buttonType}
                  onChange={(e) => setTemplateForm({ ...templateForm, buttonType: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="NONE">None</option>
                  <option value="QUICK_REPLY">Quick Reply</option>
                  <option value="URL">Website Link (URL)</option>
                  <option value="PHONE_NUMBER">Phone Call</option>
                </select>
              </div>

              {templateForm.buttonType !== 'NONE' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Button Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Visit Website"
                      value={templateForm.buttonText}
                      onChange={(e) => setTemplateForm({ ...templateForm, buttonText: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">URL or Phone Value</label>
                    <input
                      type="text"
                      placeholder="https://... or +91..."
                      value={templateForm.buttonValue}
                      onChange={(e) => setTemplateForm({ ...templateForm, buttonValue: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TemplatesPage;
