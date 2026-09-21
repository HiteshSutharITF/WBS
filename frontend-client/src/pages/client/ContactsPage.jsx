import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  UserPlus,
  Upload,
  Search,
  Tag,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { contactService } from '../../services/contactService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { formatDate } from '../../utils/formatters';

const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Contact Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', email: '', leadStage: 'new', tags: '' });
  const [addErrors, setAddErrors] = useState({});
  const [savingContact, setSavingContact] = useState(false);

  // Import CSV Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [optInAgreed, setOptInAgreed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  const nameRef = useRef(null);
  const phoneRef = useRef(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await contactService.listContacts({
        leadStage: stageFilter,
        search: searchTerm,
      });
      setContacts(res.data?.contacts || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [stageFilter, searchTerm]);

  // Validate Add Contact Form
  const validateAddForm = () => {
    const errs = {};
    if (!addForm.name.trim()) errs.name = 'Contact name is required.';
    if (!addForm.phone.trim()) {
      errs.phone = 'Phone number is required.';
    } else if (addForm.phone.replace(/[^\d]/g, '').length < 10) {
      errs.phone = 'Please provide a valid phone number with country code.';
    }
    setAddErrors(errs);

    if (errs.name && nameRef.current) {
      nameRef.current.focus();
    } else if (errs.phone && phoneRef.current) {
      phoneRef.current.focus();
    }

    return Object.keys(errs).length === 0;
  };

  const handleCreateContact = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) return;

    setSavingContact(true);
    try {
      await contactService.createContact({
        ...addForm,
        tags: addForm.tags.split(',').map((t) => t.trim()).filter(Boolean)
      });
      setIsAddModalOpen(false);
      setAddForm({ name: '', phone: '', email: '', leadStage: 'new', tags: '' });
      fetchContacts();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingContact(false);
    }
  };

  // CSV Import
  const handleImportCsv = async () => {
    if (!csvFile) {
      alert('Please choose a CSV file to upload.');
      return;
    }
    if (!optInAgreed) {
      alert('You must confirm that all contacts in this CSV have explicitly opted-in per Meta policy.');
      return;
    }

    setImporting(true);
    setImportResult('');
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await contactService.importCsv(formData);
      setImportResult(res.message);
      setCsvFile(null);
      fetchContacts();
    } catch (err) {
      alert(err.message);
    } finally {
      setImporting(false);
    }
  };

  const stages = ['all', 'new', 'engaged', 'qualified', 'handed_off', 'converted', 'lost'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Leads & Profiling</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Total {total} tracked WhatsApp contacts &bull; Pipeline management
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            icon={Upload}
          >
            Import CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            icon={UserPlus}
          >
            Add Lead
          </Button>
        </div>
      </div>

      {/* Stage Tabs & Search Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
          {stages.map((st) => (
            <button
              key={st}
              onClick={() => setStageFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl capitalize transition-colors ${
                stageFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or BSUID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Lead / Contact</th>
                <th className="px-6 py-3.5">Phone & BSUID</th>
                <th className="px-6 py-3.5">Stage</th>
                <th className="px-6 py-3.5">Tags & Source</th>
                <th className="px-6 py-3.5">Opt-In Status</th>
                <th className="px-6 py-3.5">Last Inbound</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          {contact.name?.[0] || 'L'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">{contact.name}</p>
                          <p className="text-[11px] text-slate-400">{contact.email || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      <div>{contact.phone || '—'}</div>
                      <div className="text-[10px] text-slate-400">{contact.bsuid}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          contact.leadStage === 'qualified'
                            ? 'green'
                            : contact.leadStage === 'handed_off'
                            ? 'purple'
                            : contact.leadStage === 'lost'
                            ? 'red'
                            : 'blue'
                        }
                        size="xs"
                      >
                        {contact.leadStage}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags?.map((tag, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{contact.source}</span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {contact.optInStatus ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Opted In</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-rose-500">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Opted Out</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {formatDate(contact.lastInboundAt || contact.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New WhatsApp Lead"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateContact} isLoading={savingContact}>
              Save Lead
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateContact} className="space-y-4" noValidate>
          <Input
            ref={nameRef}
            label="Full Name"
            placeholder="e.g. Vikram Mehta"
            value={addForm.name}
            onChange={(e) => {
              setAddForm({ ...addForm, name: e.target.value });
              if (addErrors.name) setAddErrors({ ...addErrors, name: '' });
            }}
            error={addErrors.name}
            required
          />

          <Input
            ref={phoneRef}
            label="Phone Number (with Country Code)"
            placeholder="e.g. +919876543210"
            value={addForm.phone}
            onChange={(e) => {
              setAddForm({ ...addForm, phone: e.target.value });
              if (addErrors.phone) setAddErrors({ ...addErrors, phone: '' });
            }}
            error={addErrors.phone}
            required
          />

          <Input
            label="Email Address (Optional)"
            type="email"
            placeholder="vikram@example.com"
            value={addForm.email}
            onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Initial Lead Stage</label>
            <select
              value={addForm.leadStage}
              onChange={(e) => setAddForm({ ...addForm, leadStage: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
            >
              <option value="new">New</option>
              <option value="engaged">Engaged</option>
              <option value="qualified">Qualified</option>
              <option value="handed_off">Handed Off</option>
            </select>
          </div>

          <Input
            label="Tags (Comma separated)"
            placeholder="e.g. retail, vip, summer-promo"
            value={addForm.tags}
            onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
          />
        </form>
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Opted-In Contacts from CSV"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsImportModalOpen(false)}>Close</Button>
            <Button
              variant="primary"
              onClick={handleImportCsv}
              disabled={!csvFile || !optInAgreed || importing}
              isLoading={importing}
            >
              Start Import
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs text-slate-700">
          <p>
            Upload a CSV containing columns for <b>name</b>, <b>phone</b>, and optional <b>email</b> or <b>tags</b>.
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={(e) => setCsvFile(e.target.files[0])}
            className="w-full py-2 text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {/* Mandatory Opt-in Declaration Checkbox per PL-01 */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="optin-consent"
              checked={optInAgreed}
              onChange={(e) => setOptInAgreed(e.target.checked)}
              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="optin-consent" className="text-amber-900 leading-snug cursor-pointer">
              <b>Mandatory Opt-in Compliance (Meta Rule PL-01):</b> I certify that all contacts in this upload have explicitly provided their opt-in consent to receive business communications on WhatsApp. Unsolicited marketing is strictly prohibited.
            </label>
          </div>

          {importResult && (
            <Alert type="success" message={importResult} />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ContactsPage;
