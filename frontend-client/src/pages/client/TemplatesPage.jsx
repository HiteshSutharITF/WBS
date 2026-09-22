import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  MessageSquare,
  AlertTriangle,
  Info,
  Smartphone,
  Phone,
  CornerDownLeft,
  Link as LinkIcon,
  Check,
  CheckCheck,
  Sparkles,
  Bold,
  Italic,
  Strikethrough,
  Code
} from 'lucide-react';
import { templateService } from '../../services/templateService';
import { getSocket } from '../../utils/socket';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';

const LANGUAGES = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ru', label: 'Russian (Русский)' }
];

const CATEGORIES = [
  {
    id: 'MARKETING',
    title: 'Marketing',
    desc: 'Promotions, offers, product updates, and welcome greetings to engage customers.'
  },
  {
    id: 'UTILITY',
    title: 'Utility',
    desc: 'Order confirmations, shipping alerts, appointment reminders, and billing receipts.'
  },
  {
    id: 'AUTHENTICATION',
    title: 'Authentication',
    desc: 'One-time passwords (OTPs) and security verification codes.'
  }
];

/**
 * Safe WhatsApp Markdown & Variable preview formatter
 */
const renderWhatsAppFormattedText = (rawText, samples = []) => {
  if (!rawText || !rawText.trim()) {
    return (
      <span className="text-slate-400 italic text-xs">
        Your template message will appear here in real-time...
      </span>
    );
  }

  // Replace variable placeholders with encoded sample tokens
  const replaced = rawText.replace(/\{\{(\d+)\}\}/g, (match, numStr) => {
    const idx = parseInt(numStr, 10) - 1;
    const sampleVal = samples[idx];
    if (sampleVal && String(sampleVal).trim()) {
      return `###VAR_${idx}_${encodeURIComponent(String(sampleVal).trim())}###`;
    }
    return `###VAR_${idx}_EMPTY###`;
  });

  const lines = replaced.split('\n');

  return lines.map((line, lineIdx) => {
    const parts = [];
    const tokenRegex = /(\*.*?\*|_.*?_|~.*?~|```.*?```|###VAR_\d+_[^#]+###)/g;
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('###VAR_')) {
        const varMatch = token.match(/###VAR_(\d+)_(.*)###/);
        if (varMatch) {
          const varNum = parseInt(varMatch[1], 10) + 1;
          const varVal = varMatch[2];
          if (varVal === 'EMPTY') {
            parts.push(
              <span
                key={`var-${match.index}`}
                className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs border border-amber-300 font-semibold"
                title={`Variable {{${varNum}}} (Sample value missing)`}
              >
                {`{{${varNum}}}`}
              </span>
            );
          } else {
            parts.push(
              <span
                key={`var-${match.index}`}
                className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-emerald-100 text-emerald-950 font-semibold text-xs border border-emerald-300 shadow-2xs"
                title={`Variable {{${varNum}}}`}
              >
                {decodeURIComponent(varVal)}
              </span>
            );
          }
        }
      } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
        parts.push(<strong key={`b-${match.index}`}>{token.slice(1, -1)}</strong>);
      } else if (token.startsWith('_') && token.endsWith('_') && token.length >= 2) {
        parts.push(<em key={`i-${match.index}`}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith('~') && token.endsWith('~') && token.length >= 2) {
        parts.push(<del key={`d-${match.index}`}>{token.slice(1, -1)}</del>);
      } else if (token.startsWith('```') && token.endsWith('```') && token.length >= 6) {
        parts.push(
          <code key={`c-${match.index}`} className="bg-slate-100 px-1 py-0.5 rounded font-mono text-xs text-slate-800">
            {token.slice(3, -3)}
          </code>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts.length > 0 ? parts : <br />}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
};

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
    headerSample: '',
    bodyText: '',
    sampleVariables: [],
    footerText: '',
    buttons: []
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

    const socket = getSocket();
    if (!socket) return;

    const handleTemplateStatus = (payload) => {
      setTemplates((prev) =>
        prev.map((tmpl) => {
          if (
            tmpl._id === payload.templateId ||
            (payload.metaTemplateId && tmpl.metaTemplateId === payload.metaTemplateId) ||
            (payload.name && tmpl.name === payload.name)
          ) {
            return {
              ...tmpl,
              metaTemplateId: payload.metaTemplateId || tmpl.metaTemplateId,
              status: payload.status,
              rejectionReason: payload.rejectionReason
            };
          }
          return tmpl;
        })
      );
      setMessageAlert({
        type: payload.status === 'APPROVED' ? 'success' : payload.status === 'REJECTED' ? 'error' : 'warning',
        text: `Real-time Meta Update: Template "${payload.name}" is now ${payload.status}!${payload.rejectionReason ? ` Reason: ${payload.rejectionReason}` : ''}`
      });
    };

    socket.on('template_status_updated', handleTemplateStatus);
    return () => {
      socket.off('template_status_updated', handleTemplateStatus);
    };
  }, [categoryFilter]);

  const handleSyncMeta = async () => {
    setSyncing(true);
    setMessageAlert({ type: '', text: '' });
    try {
      const res = await templateService.syncTemplates();
      setTemplates(res.data || []);
      setMessageAlert({ type: 'success', text: res.message || 'Synced templates from Meta successfully!' });
    } catch (err) {
      setMessageAlert({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  // Variable analysis & Meta Guideline Checks
  const detectedVariables = useMemo(() => {
    const matches = templateForm.bodyText.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((m) => parseInt(m.replace(/[\{\}]/g, ''), 10));
  }, [templateForm.bodyText]);

  const uniqueVariables = useMemo(() => {
    return Array.from(new Set(detectedVariables)).sort((a, b) => a - b);
  }, [detectedVariables]);

  const staticText = useMemo(() => {
    return templateForm.bodyText.replace(/\{\{\d+\}\}/g, '').trim();
  }, [templateForm.bodyText]);

  const staticWords = useMemo(() => {
    return staticText.split(/\s+/).filter(Boolean);
  }, [staticText]);

  // Real-time Meta Guidelines Compliance status
  const compliance = useMemo(() => {
    const issues = [];
    const varCount = uniqueVariables.length;

    // 1. Sequential Check
    for (let i = 0; i < uniqueVariables.length; i++) {
      if (uniqueVariables[i] !== i + 1) {
        issues.push({
          level: 'error',
          msg: `Variables must be sequential starting at {{1}}. Missing {{${i + 1}}}.`
        });
        break;
      }
    }

    // 2. Duplicate variable indices
    if (detectedVariables.length !== uniqueVariables.length) {
      issues.push({
        level: 'warning',
        msg: 'Duplicate variable indices found in message body. Each variable should have a distinct index.'
      });
    }

    // 3. Consecutive variables
    if (/\{\{\d+\}\}\s*\{\{\d+\}\}/.test(templateForm.bodyText)) {
      issues.push({
        level: 'error',
        msg: 'Meta guidelines forbid consecutive variables without words between them (e.g. "{{1}} {{2}}").'
      });
    }

    // 4. Variable-to-Text Ratio (Meta Error 100 Prevention)
    if (varCount > 0) {
      const minChars = varCount * 15;
      const minWords = varCount * 3;
      if (staticText.length < minChars || staticWords.length < minWords) {
        issues.push({
          level: 'ratio_error',
          msg: `Meta Error Prevention: This template has too many variables for its length (${staticWords.length} static words for ${varCount} variable). Meta automated review will reject it with Error 100. Please add more context words around the variable.`
        });
      }
    }

    // 5. Missing Sample Values
    if (varCount > 0) {
      const missingSamples = [];
      for (let i = 0; i < varCount; i++) {
        const val = templateForm.sampleVariables[i];
        if (!val || !String(val).trim()) {
          missingSamples.push(`{{${i + 1}}}`);
        }
      }
      if (missingSamples.length > 0) {
        issues.push({
          level: 'sample_missing',
          msg: `Meta requires sample values for all parameters: ${missingSamples.join(', ')}.`
        });
      }
    }

    // 6. Header variable sample
    if (templateForm.headerType === 'TEXT' && templateForm.headerText.includes('{{1}}') && !templateForm.headerSample.trim()) {
      issues.push({
        level: 'sample_missing',
        msg: 'Header text includes {{1}}. Meta requires a sample value for the header variable.'
      });
    }

    // 7. Footer variable check
    if (/\{\{\d+\}\}/.test(templateForm.footerText)) {
      issues.push({
        level: 'error',
        msg: 'Meta guidelines strictly forbid variables in footers.'
      });
    }

    return {
      isValid: issues.filter((i) => i.level === 'error' || i.level === 'ratio_error' || i.level === 'sample_missing').length === 0,
      issues
    };
  }, [templateForm, detectedVariables, uniqueVariables, staticText, staticWords]);

  // Synchronize sampleVariables array when variables count changes
  useEffect(() => {
    if (uniqueVariables.length > 0) {
      setTemplateForm((prev) => {
        const currentSamples = [...(prev.sampleVariables || [])];
        while (currentSamples.length < uniqueVariables.length) {
          currentSamples.push('');
        }
        return { ...prev, sampleVariables: currentSamples };
      });
    }
  }, [uniqueVariables.length]);

  // Insert helper text / formatting into message body
  const insertBodyFormatting = (prefix, suffix = '') => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = templateForm.bodyText;
    const selectedText = currentVal.substring(start, end) || 'text';

    const newVal = currentVal.substring(0, start) + prefix + selectedText + suffix + currentVal.substring(end);
    setTemplateForm({ ...templateForm, bodyText: newVal });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 50);
  };

  const insertNextVariable = () => {
    const nextNum = uniqueVariables.length > 0 ? Math.max(...uniqueVariables) + 1 : 1;
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const currentVal = templateForm.bodyText;
    const varText = `{{${nextNum}}}`;

    const newVal = currentVal.substring(0, start) + varText + currentVal.substring(start);
    setTemplateForm({ ...templateForm, bodyText: newVal });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + varText.length, start + varText.length);
    }, 50);
  };

  const updateSampleValue = (index, val) => {
    setTemplateForm((prev) => {
      const next = [...prev.sampleVariables];
      next[index] = val;
      return { ...prev, sampleVariables: next };
    });
  };

  // Button management
  const addButton = () => {
    if (templateForm.buttons.length >= 3) return;
    setTemplateForm((prev) => ({
      ...prev,
      buttons: [
        ...prev.buttons,
        {
          type: 'QUICK_REPLY',
          text: '',
          value: '',
          sampleUrl: ''
        }
      ]
    }));
  };

  const updateButton = (index, field, val) => {
    setTemplateForm((prev) => {
      const next = [...prev.buttons];
      next[index] = { ...next[index], [field]: val };
      return { ...prev, buttons: next };
    });
  };

  const removeButton = (index) => {
    setTemplateForm((prev) => ({
      ...prev,
      buttons: prev.buttons.filter((_, idx) => idx !== index)
    }));
  };

  const validateForm = () => {
    const errs = {};
    if (!templateForm.name.trim()) {
      errs.name = 'Template name is required.';
    } else if (!/^[a-z0-9_]+$/.test(templateForm.name.trim())) {
      errs.name = 'Only lowercase letters, numbers, and underscores allowed (no spaces or uppercase).';
    } else if (templateForm.name.trim().length > 512) {
      errs.name = 'Template name cannot exceed 512 characters.';
    }

    if (!templateForm.bodyText.trim()) {
      errs.bodyText = 'Template body message is required.';
    } else if (templateForm.bodyText.length > 1024) {
      errs.bodyText = 'Template body text cannot exceed 1,024 characters.';
    }

    // Ratio error blocking
    const ratioIssue = compliance.issues.find((i) => i.level === 'ratio_error');
    if (ratioIssue) {
      errs.bodyText = ratioIssue.msg;
    }

    // Sequence error blocking
    const seqIssue = compliance.issues.find((i) => i.level === 'error');
    if (seqIssue) {
      errs.bodyText = seqIssue.msg;
    }

    // Samples validation
    if (uniqueVariables.length > 0) {
      for (let i = 0; i < uniqueVariables.length; i++) {
        if (!templateForm.sampleVariables[i] || !String(templateForm.sampleVariables[i]).trim()) {
          errs[`sample_${i}`] = `Sample value for {{${i + 1}}} is required by Meta.`;
        }
      }
    }

    // Header validation
    if (templateForm.headerType === 'TEXT') {
      if (!templateForm.headerText.trim()) {
        errs.headerText = 'Header text is required when TEXT format is selected.';
      } else if (templateForm.headerText.length > 60) {
        errs.headerText = 'Header text cannot exceed 60 characters.';
      }
      if (templateForm.headerText.includes('{{1}}') && !templateForm.headerSample.trim()) {
        errs.headerSample = 'Sample value for header variable {{1}} is required.';
      }
    }

    // Footer validation
    if (templateForm.footerText && /\{\{\d+\}\}/.test(templateForm.footerText)) {
      errs.footerText = 'Variables are strictly forbidden in footers by Meta.';
    }

    // Buttons validation
    templateForm.buttons.forEach((btn, idx) => {
      if (!btn.text.trim()) {
        errs[`btn_text_${idx}`] = 'Button text is required.';
      } else if (btn.text.length > 25) {
        errs[`btn_text_${idx}`] = 'Button text max 25 chars.';
      }
      if (btn.type === 'URL' && !btn.value.trim()) {
        errs[`btn_val_${idx}`] = 'Website URL is required.';
      }
      if (btn.type === 'PHONE_NUMBER' && !btn.value.trim()) {
        errs[`btn_val_${idx}`] = 'Phone number with country code is required.';
      }
    });

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
      const formattedButtons = templateForm.buttons.map((b) => ({
        type: b.type,
        text: b.text.trim(),
        value: b.value.trim(),
        sampleUrl: b.sampleUrl ? b.sampleUrl.trim() : undefined
      }));

      const payload = {
        name: templateForm.name.toLowerCase().trim(),
        category: templateForm.category,
        language: templateForm.language,
        header: {
          format: templateForm.headerType,
          text: templateForm.headerType === 'TEXT' ? templateForm.headerText.trim() : undefined,
          sampleVariable: templateForm.headerSample ? templateForm.headerSample.trim() : undefined
        },
        body: {
          text: templateForm.bodyText.trim(),
          sampleVariables: templateForm.sampleVariables.slice(0, uniqueVariables.length).map((s) => String(s).trim())
        },
        sampleVariables: templateForm.sampleVariables.slice(0, uniqueVariables.length).map((s) => String(s).trim()),
        footer: {
          text: templateForm.footerText ? templateForm.footerText.trim() : ''
        },
        buttons: formattedButtons
      };

      const res = await templateService.createTemplate(payload);
      setMessageAlert({
        type: 'success',
        text: `Template "${templateForm.name}" created and submitted to Meta! Status: PENDING review.`
      });
      setIsCreateModalOpen(false);
      setTemplateForm({
        name: '',
        category: 'MARKETING',
        language: 'en_US',
        headerType: 'NONE',
        headerText: '',
        headerSample: '',
        bodyText: '',
        sampleVariables: [],
        footerText: '',
        buttons: []
      });
      fetchTemplates();
    } catch (err) {
      alert(err.message || 'Failed to submit template to Meta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId, name) => {
    if (!window.confirm(`Delete template "${name}"? It will also be removed from Meta WhatsApp account.`)) return;
    try {
      await templateService.deleteTemplate(templateId);
      setMessageAlert({ type: 'success', text: `Template "${name}" deleted successfully.` });
      fetchTemplates();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900">WhatsApp Message Templates</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" /> Meta Cloud API
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Meta pre-approved message formats for outbound marketing, utility alerts, and re-initiating conversations after 24 hours.
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
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl capitalize transition-colors ${
              categoryFilter === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat === 'all' ? 'All Templates' : cat}
          </button>
        ))}
      </div>

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-16 text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
            Loading templates from Meta...
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No message templates found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Create and submit your first template to Meta for approval, or click "Sync from Meta" to fetch existing templates.
            </p>
            <div className="mt-4">
              <Button size="sm" onClick={() => setIsCreateModalOpen(true)} icon={Plus}>
                Create New Template
              </Button>
            </div>
          </div>
        ) : (
          templates.map((tmpl) => (
            <div
              key={tmpl._id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-bold text-slate-900 text-sm truncate font-mono" title={tmpl.name}>
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

                {/* WhatsApp Chat Preview Bubble */}
                <div className="bg-[#EFEAE2] p-3.5 rounded-xl border border-slate-200/80 text-xs shadow-inner space-y-2 mb-3">
                  {tmpl.header?.format === 'TEXT' && (
                    <p className="font-bold text-slate-900 text-xs border-b border-slate-300/40 pb-1">
                      {tmpl.header.text}
                    </p>
                  )}
                  {['IMAGE', 'DOCUMENT', 'VIDEO'].includes(tmpl.header?.format) && (
                    <div className="h-16 bg-slate-200/80 rounded-lg flex items-center justify-center text-slate-500 text-[11px] font-medium border border-slate-300/50">
                      [{tmpl.header.format} Header]
                    </div>
                  )}

                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {tmpl.body?.text}
                  </p>

                  {tmpl.footer?.text && (
                    <p className="text-[10px] text-slate-500 pt-0.5">{tmpl.footer.text}</p>
                  )}

                  {tmpl.buttons && tmpl.buttons.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {tmpl.buttons.map((btn, idx) => (
                        <div
                          key={idx}
                          className="py-1 px-3 bg-white text-blue-600 font-semibold text-center text-[11px] rounded-lg shadow-2xs border border-slate-200/70 flex items-center justify-center gap-1"
                        >
                          {btn.type === 'URL' && <ExternalLink className="w-3 h-3" />}
                          {btn.type === 'PHONE_NUMBER' && <Phone className="w-3 h-3" />}
                          {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="w-3 h-3" />}
                          <span>{btn.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {tmpl.status === 'REJECTED' && tmpl.rejectionReason && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl mb-3">
                    <p className="text-xs font-semibold text-rose-800 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5 shrink-0" /> Meta Rejection Reason:
                    </p>
                    <p className="text-xs text-rose-700 mt-0.5">{tmpl.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Card Footer info */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{tmpl.category}</span>
                  <span>&bull;</span>
                  <span>{tmpl.language}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(tmpl._id, tmpl.name)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Delete Template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* CREATE TEMPLATE MODAL - 100% META GUIDELINES COMPLIANT WITH LIVE PREVIEW */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create & Submit WhatsApp Template to Meta"
        size="xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-500">
              Templates are submitted directly to Meta Graph API for automated review.
            </div>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateTemplate}
                isLoading={submitting}
                disabled={!compliance.isValid}
                icon={Sparkles}
              >
                Submit to Meta
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Configuration Form */}
          <form onSubmit={handleCreateTemplate} className="lg:col-span-7 space-y-5" noValidate>
            {/* 1. Basic Template Info */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Template Information
                </h4>
                <span className="text-[11px] text-slate-400">Meta Cloud API Standard</span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-medium text-slate-700">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {templateForm.name.length}/512
                  </span>
                </div>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="e.g. order_confirmation_v1"
                  value={templateForm.name}
                  onChange={(e) => {
                    const formatted = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                    setTemplateForm({ ...templateForm, name: formatted });
                    if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                  }}
                  className={`w-full px-3.5 py-2 text-sm bg-white border rounded-xl font-mono transition-colors outline-none ${
                    formErrors.name ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200 focus:border-blue-500'
                  }`}
                />
                {formErrors.name ? (
                  <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Only lowercase letters, numbers, and underscores. Spaces automatically converted.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">Language</label>
                  <select
                    value={templateForm.language}
                    onChange={(e) => setTemplateForm({ ...templateForm, language: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label} ({lang.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Header (Optional) */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Header (Optional)
                </h4>
                <span className="text-[11px] text-slate-400">Top of WhatsApp message</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-600">Header Format</label>
                  <select
                    value={templateForm.headerType}
                    onChange={(e) => setTemplateForm({ ...templateForm, headerType: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="NONE">None (No Header)</option>
                    <option value="TEXT">Text Headline</option>
                    <option value="IMAGE">Image</option>
                    <option value="DOCUMENT">Document / PDF</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </div>

                {templateForm.headerType === 'TEXT' && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <label className="font-medium text-slate-600">Header Text</label>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {templateForm.headerText.length}/60
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={60}
                      placeholder="e.g. Order Confirmed!"
                      value={templateForm.headerText}
                      onChange={(e) => setTemplateForm({ ...templateForm, headerText: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>
                )}
              </div>

              {templateForm.headerType === 'TEXT' && templateForm.headerText.includes('{{1}}') && (
                <div className="space-y-1 pt-1">
                  <label className="block text-xs font-medium text-amber-800">
                    Header Variable Sample for {'{{1}}'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John"
                    value={templateForm.headerSample}
                    onChange={(e) => setTemplateForm({ ...templateForm, headerSample: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    Meta requires a sample value for the variable in the header.
                  </p>
                </div>
              )}
            </div>

            {/* 3. Body Text (Mandatory) & Formatting Toolbar */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> Message Body <span className="text-red-500">*</span>
                </label>
                <span className="text-slate-400 font-mono text-[11px]">
                  {templateForm.bodyText.length}/1024
                </span>
              </div>

              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
                <button
                  type="button"
                  onClick={insertNextVariable}
                  className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                  title="Insert next variable placeholder {{#}}"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Variable {`{{${uniqueVariables.length > 0 ? Math.max(...uniqueVariables) + 1 : 1}}}`}</span>
                </button>
                <div className="h-4 w-px bg-slate-200 mx-1" />
                <button
                  type="button"
                  onClick={() => insertBodyFormatting('*', '*')}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold"
                  title="Bold (*text*)"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertBodyFormatting('_', '_')}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs italic"
                  title="Italic (_text_)"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertBodyFormatting('~', '~')}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs"
                  title="Strikethrough (~text~)"
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertBodyFormatting('```', '```')}
                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs"
                  title="Monospace (```code```)"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
              </div>

              <textarea
                ref={bodyRef}
                rows={5}
                maxLength={1024}
                placeholder="Hello {{1}}, thank you for reaching out to ITFuturz! Your order {{2}} has been confirmed and will be dispatched shortly."
                value={templateForm.bodyText}
                onChange={(e) => {
                  setTemplateForm({ ...templateForm, bodyText: e.target.value });
                  if (formErrors.bodyText) setFormErrors({ ...formErrors, bodyText: '' });
                }}
                className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl outline-none leading-relaxed transition-colors ${
                  formErrors.bodyText ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-200 focus:border-blue-500'
                }`}
              />

              {formErrors.bodyText && (
                <p className="text-xs font-medium text-red-600">{formErrors.bodyText}</p>
              )}

              {/* Live Meta Guidelines Feedback Alert */}
              {compliance.issues.length > 0 && (
                <div className="space-y-2 pt-1">
                  {compliance.issues.map((issue, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                        issue.level === 'ratio_error'
                          ? 'bg-rose-50 text-rose-900 border border-rose-200'
                          : issue.level === 'sample_missing'
                          ? 'bg-amber-50 text-amber-900 border border-amber-200'
                          : issue.level === 'error'
                          ? 'bg-red-50 text-red-900 border border-red-200'
                          : 'bg-blue-50 text-blue-900 border border-blue-200'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{issue.msg}</p>
                        {issue.level === 'ratio_error' && (
                          <p className="mt-1 text-[11px] opacity-90">
                            <strong>Why?</strong> Meta requires fixed words around parameters so automated spam filters know what the message is about. (e.g. Change "hello &#123;&#123;1&#125;&#125;" to "Hello &#123;&#123;1&#125;&#125;, thank you for contacting ITFuturz! Your inquiry has been received.")
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic Sample Values Form for Meta Approval */}
              {uniqueVariables.length > 0 && (
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Sample Values for Meta Approval
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Required by Meta Cloud API
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Meta reviews these sample values to verify how the message looks to end users before approving.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {uniqueVariables.map((varNum, idx) => (
                      <div key={varNum} className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Sample for {`{{${varNum}}}`} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder={idx === 0 ? 'e.g. John Doe' : idx === 1 ? 'e.g. #ORD-8921' : `Sample ${varNum}`}
                          value={templateForm.sampleVariables[idx] || ''}
                          onChange={(e) => updateSampleValue(idx, e.target.value)}
                          className={`w-full px-3 py-2 text-xs bg-white border rounded-lg outline-none transition-colors ${
                            formErrors[`sample_${idx}`]
                              ? 'border-red-500 ring-1 ring-red-100'
                              : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        {formErrors[`sample_${idx}`] && (
                          <p className="text-[10px] text-red-500">{formErrors[`sample_${idx}`]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Footer (Optional) */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold uppercase tracking-wider text-slate-700">
                  Footer (Optional)
                </label>
                <span className="text-slate-400 font-mono text-[10px]">
                  {templateForm.footerText.length}/60
                </span>
              </div>
              <input
                type="text"
                maxLength={60}
                placeholder="e.g. Reply STOP to unsubscribe or HELP for assistance."
                value={templateForm.footerText}
                onChange={(e) => {
                  setTemplateForm({ ...templateForm, footerText: e.target.value });
                  if (formErrors.footerText) setFormErrors({ ...formErrors, footerText: '' });
                }}
                className={`w-full px-3.5 py-2 text-xs bg-white border rounded-xl outline-none ${
                  formErrors.footerText ? 'border-red-500' : 'border-slate-200'
                }`}
              />
              {formErrors.footerText ? (
                <p className="text-xs text-red-600">{formErrors.footerText}</p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Small subtle text displayed at the bottom. Variables are not permitted by Meta.
                </p>
              )}
            </div>

            {/* 5. Interactive Buttons */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Interactive CTA Buttons ({templateForm.buttons.length}/3)
                </span>
                {templateForm.buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Button
                  </button>
                )}
              </div>

              {templateForm.buttons.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No interactive buttons added. You can add Quick Replies, Website Links, or Phone Call buttons.
                </p>
              ) : (
                <div className="space-y-3">
                  {templateForm.buttons.map((btn, idx) => (
                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          Button #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeButton(idx)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                          title="Remove Button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-500 mb-1">Type</label>
                          <select
                            value={btn.type}
                            onChange={(e) => updateButton(idx, 'type', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                          >
                            <option value="QUICK_REPLY">Quick Reply</option>
                            <option value="URL">Website Link (URL)</option>
                            <option value="PHONE_NUMBER">Phone Call</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-medium text-slate-500">Label</label>
                            <span className="text-[10px] text-slate-400">{btn.text.length}/25</span>
                          </div>
                          <input
                            type="text"
                            maxLength={25}
                            placeholder={btn.type === 'URL' ? 'Visit Website' : btn.type === 'PHONE_NUMBER' ? 'Call Support' : 'Confirm'}
                            value={btn.text}
                            onChange={(e) => updateButton(idx, 'text', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                          />
                        </div>

                        <div>
                          {btn.type !== 'QUICK_REPLY' && (
                            <>
                              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                                {btn.type === 'URL' ? 'Website URL' : 'Phone Number'}
                              </label>
                              <input
                                type="text"
                                placeholder={btn.type === 'URL' ? 'https://itfuturz.in' : '+919876543210'}
                                value={btn.value}
                                onChange={(e) => updateButton(idx, 'value', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* RIGHT COLUMN: Authentic WhatsApp Mobile Live Chat Preview */}
          <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Mobile Preview
              </span>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Live Sample Replacement
              </span>
            </div>

            {/* Realistic Smartphone Shell */}
            <div className="bg-slate-900 rounded-[32px] p-3 shadow-2xl border-4 border-slate-800 max-w-[340px] mx-auto">
              {/* Phone Speaker & Camera Notch */}
              <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-950/80 mr-2" />
                <div className="w-8 h-1 rounded-full bg-slate-900" />
              </div>

              {/* Phone Screen Screen */}
              <div className="rounded-[22px] overflow-hidden bg-[#EFEAE2] flex flex-col min-h-[460px] shadow-inner relative">
                {/* WhatsApp Chat Top Bar */}
                <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-800 flex items-center justify-center text-xs font-bold text-white uppercase border border-emerald-400/30">
                      IT
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight flex items-center gap-1">
                        <span>ITFuturz</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-300 inline" />
                      </div>
                      <div className="text-[10px] text-emerald-100/70 leading-none">Official Business Account</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-white/80">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* WhatsApp Chat Area */}
                <div className="flex-1 p-3 flex flex-col justify-end space-y-2 overflow-y-auto">
                  {/* WhatsApp Message Bubble */}
                  <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-sm border border-black/5 text-slate-900 max-w-[92%] relative self-start space-y-1.5">
                    {/* Header preview */}
                    {templateForm.headerType === 'TEXT' && templateForm.headerText && (
                      <div className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-1">
                        {templateForm.headerText.replace('{{1}}', templateForm.headerSample || '{{1}}')}
                      </div>
                    )}
                    {['IMAGE', 'DOCUMENT', 'VIDEO'].includes(templateForm.headerType) && (
                      <div className="h-28 bg-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs gap-1 border border-slate-200">
                        <FileText className="w-6 h-6 text-slate-300" />
                        <span className="text-[10px] uppercase font-semibold">[{templateForm.headerType} Media Header]</span>
                      </div>
                    )}

                    {/* Message Body with live sample variable substitution */}
                    <div className="text-xs text-slate-800 leading-relaxed break-words">
                      {renderWhatsAppFormattedText(templateForm.bodyText, templateForm.sampleVariables)}
                    </div>

                    {/* Footer text */}
                    {templateForm.footerText && (
                      <div className="text-[10px] text-slate-400 pt-0.5">
                        {templateForm.footerText}
                      </div>
                    )}

                    {/* Timestamp and ticks */}
                    <div className="flex items-center justify-end gap-1 pt-0.5 text-[9px] text-slate-400">
                      <span>12:45 PM</span>
                      <CheckCheck className="w-3 h-3 text-blue-500" />
                    </div>
                  </div>

                  {/* WhatsApp Action Buttons */}
                  {templateForm.buttons && templateForm.buttons.length > 0 && (
                    <div className="space-y-1 max-w-[92%]">
                      {templateForm.buttons.map((btn, idx) => (
                        <div
                          key={idx}
                          className="bg-white hover:bg-slate-50 text-blue-600 font-medium text-center py-2 px-3 rounded-xl shadow-xs border border-black/5 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {btn.type === 'URL' && <ExternalLink className="w-3 h-3" />}
                          {btn.type === 'PHONE_NUMBER' && <Phone className="w-3 h-3" />}
                          {btn.type === 'QUICK_REPLY' && <CornerDownLeft className="w-3 h-3" />}
                          <span className="truncate">{btn.text || `Button #${idx + 1}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WhatsApp Chat Input Bar Mock */}
                <div className="bg-[#F0F2F5] px-3 py-2 flex items-center gap-2 border-t border-slate-200/60 text-slate-400">
                  <div className="flex-1 bg-white rounded-full px-3 py-1 text-[11px] text-slate-400 shadow-2xs">
                    Type a message
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Review Guidelines Compliance Checklist */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600" /> Meta Review Checklist
              </div>
              <ul className="space-y-1.5 text-[11px] text-slate-600">
                <li className="flex items-center gap-2">
                  {templateForm.name && /^[a-z0-9_]+$/.test(templateForm.name) ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span>Valid template name (lowercase and underscores)</span>
                </li>
                <li className="flex items-center gap-2">
                  {uniqueVariables.length === 0 || !compliance.issues.some((i) => i.level === 'ratio_error') ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  )}
                  <span>Variable-to-text ratio within Meta thresholds</span>
                </li>
                <li className="flex items-center gap-2">
                  {uniqueVariables.length === 0 || !compliance.issues.some((i) => i.level === 'sample_missing') ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span>Sample values provided for all parameters</span>
                </li>
                <li className="flex items-center gap-2">
                  {!/\{\{\d+\}\}/.test(templateForm.footerText) ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span>No variables in footer (forbidden by Meta)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TemplatesPage;
