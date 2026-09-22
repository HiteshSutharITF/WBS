import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Users,
  Search,
  Plus,
  LogIn,
  ExternalLink,
  Power,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { superAdminService } from '../services/superAdminService';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Input from '../components/Input';
import Alert from '../components/Alert';
import Modal from '../components/Modal';

const TenantsPage = () => {
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'users'
  const [tenants, setTenants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(null); // ID of tenant/user currently launching
  const [globalMessage, setGlobalMessage] = useState(null); // { type: 'success'|'error', text: '' }

  // Create Client Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    adminName: '',
    email: '',
    password: '',
    phone: '',
    plan: 'starter'
  });
  const [formErrors, setFormErrors] = useState({});

  // Input refs for autofocus per MERN SOP 04
  const nameRef = useRef(null);
  const adminNameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await superAdminService.listTenants({ search: searchTerm });
      setTenants(res.data?.tenants || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await superAdminService.listAllUsers({ search: searchTerm });
      setUsers(res.data?.users || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'tenants') {
      fetchTenants();
    } else {
      fetchUsers();
    }
  }, [activeTab, searchTerm]);

  // Form Validation per MERN SOP 04 (Focus on first invalid field)
  const validateForm = () => {
    const errs = {};
    if (!createForm.name.trim()) errs.name = 'Business name is required.';
    if (!createForm.adminName.trim()) errs.adminName = 'Administrator full name is required.';
    if (!createForm.email.trim() || !/^\S+@\S+\.\S+$/.test(createForm.email)) {
      errs.email = 'Valid email address is required.';
    }
    if (!createForm.password || createForm.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    setFormErrors(errs);

    if (errs.name && nameRef.current) nameRef.current.focus();
    else if (errs.adminName && adminNameRef.current) adminNameRef.current.focus();
    else if (errs.email && emailRef.current) emailRef.current.focus();
    else if (errs.password && passwordRef.current) passwordRef.current.focus();

    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setCreateLoading(true);
    setGlobalMessage(null);
    try {
      const res = await superAdminService.createTenant(createForm);
      setGlobalMessage({
        type: 'success',
        text: `Client "${res.data?.tenant?.name}" created successfully with admin ${res.data?.adminUser?.email}.`
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        adminName: '',
        email: '',
        password: '',
        phone: '',
        plan: 'starter'
      });
      setFormErrors({});
      fetchTenants();
      if (activeTab === 'users') fetchUsers();
    } catch (err) {
      setFormErrors((prev) => ({ ...prev, api: err.message }));
    } finally {
      setCreateLoading(false);
    }
  };

  // One-Click Direct Portal Access (Impersonation)
  const handleOpenClientPortal = async (tenantId, userId = null) => {
    setActionLoading(userId || tenantId);
    setGlobalMessage(null);
    try {
      let res;
      if (userId) {
        res = await superAdminService.impersonateUser(userId);
      } else {
        res = await superAdminService.impersonateTenant(tenantId);
      }

      const token = res.data?.token;
      if (!token) {
        throw new Error('Authentication token not received.');
      }

      // Determine client app URL: in development use client dev port (5173), in production use current origin
      const clientBaseUrl =
        window.location.port === '5174'
          ? `${window.location.protocol}//${window.location.hostname}:5173`
          : window.location.origin;

      const ssoUrl = `${clientBaseUrl}/#/login?sso_token=${encodeURIComponent(token)}`;
      window.open(ssoUrl, '_blank');

      setGlobalMessage({
        type: 'success',
        text: `Launched client portal for ${res.data?.user?.name || 'user'} in a new window.`
      });
    } catch (err) {
      setGlobalMessage({
        type: 'error',
        text: `Failed to open user account: ${err.message}`
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleStatus = async (tenantId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`Are you sure you want to mark this client as ${newStatus}?`)) return;

    try {
      await superAdminService.toggleTenantStatus(tenantId, newStatus);
      fetchTenants();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Businesses, Clients & Users</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Provision new client business accounts, monitor WhatsApp connectivity, and open any client portal directly.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            setFormErrors({});
            setIsCreateModalOpen(true);
          }}
          icon={Plus}
        >
          Create Client Account
        </Button>
      </div>

      {globalMessage && (
        <Alert
          type={globalMessage.type}
          message={globalMessage.text}
          onClose={() => setGlobalMessage(null)}
        />
      )}

      {/* Navigation Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('tenants')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'tenants'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Businesses & Clients ({tenants.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'users'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>All Client Users</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={activeTab === 'tenants' ? 'Search businesses or emails...' : 'Search users or emails...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* TAB 1: Businesses & Clients */}
      {activeTab === 'tenants' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Business / Client</th>
                  <th className="px-6 py-3.5">Primary Administrator</th>
                  <th className="px-6 py-3.5">WhatsApp Number</th>
                  <th className="px-6 py-3.5">Quality / Tier</th>
                  <th className="px-6 py-3.5">Plan</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-500 text-sm">
                      Loading businesses...
                    </td>
                  </tr>
                ) : tenants.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-500 text-sm">
                      No business accounts found. Click "Create Client Account" to add one.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white text-xs">{t.name}</p>
                            <p className="text-[11px] text-slate-400">{t.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {t.adminUser ? (
                          <div>
                            <p className="text-xs font-medium text-slate-200">{t.adminUser.name}</p>
                            <p className="text-[11px] text-slate-400">{t.adminUser.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {t.waba?.displayPhoneNumber || (
                          <span className="text-slate-500 text-[11px] italic">Not connected</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {t.waba ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  t.waba.qualityRating === 'GREEN'
                                    ? 'bg-emerald-400'
                                    : t.waba.qualityRating === 'YELLOW'
                                    ? 'bg-amber-400'
                                    : 'bg-rose-500'
                                }`}
                              />
                              <span className="text-xs font-semibold text-white">{t.waba.qualityRating}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{t.waba.messagingLimit}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs uppercase font-semibold text-amber-400/90 font-mono">
                          {t.plan || 'starter'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={t.status === 'active' ? 'green' : 'red'} size="xs">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Direct Open Action Icon */}
                          <button
                            type="button"
                            onClick={() => handleOpenClientPortal(t._id)}
                            disabled={actionLoading === t._id}
                            title="Directly open & log in to this client portal"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-colors border border-blue-500/20 shadow-xs"
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>{actionLoading === t._id ? 'Launching...' : 'Open Portal'}</span>
                            <ExternalLink className="w-3 h-3 text-blue-400/70" />
                          </button>

                          {/* Suspend / Reactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(t._id, t.status)}
                            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              t.status === 'active'
                                ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                            }`}
                          >
                            {t.status === 'active' ? 'Suspend' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: All Client Users */}
      {activeTab === 'users' && (
        <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 border-b border-slate-800 text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">User Name & Email</th>
                  <th className="px-6 py-3.5">Associated Business</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Contact Phone</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-500 text-sm">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-slate-500 text-sm">
                      No client users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-white text-xs">{u.name}</p>
                        <p className="text-[11px] text-slate-400">{u.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-200 font-medium">
                          {u.tenantId?.name || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={u.role === 'client_admin' ? 'purple' : 'blue'} size="xs">
                          {u.role === 'client_admin' ? 'Client Admin' : 'Agent'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={u.isActive ? 'green' : 'red'} size="xs">
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {u.phone || '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenClientPortal(u.tenantId?._id, u._id)}
                          disabled={actionLoading === u._id}
                          title={`Directly open client portal as ${u.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded-lg transition-colors border border-blue-500/20 shadow-xs"
                        >
                          <LogIn className="w-3.5 h-3.5" />
                          <span>{actionLoading === u._id ? 'Launching...' : 'Login as User'}</span>
                          <ExternalLink className="w-3 h-3 text-blue-400/70" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Client Account Modal (Complying with MERN SOP: Fixed Header/Footer) */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !createLoading && setIsCreateModalOpen(false)}
        title="Provision New Client Business Account"
        size="lg"
        footer={
          <div className="w-full flex items-center justify-between">
            <p className="text-xs text-slate-500">
              User will receive immediate access under the assigned plan.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateSubmit}
                isLoading={createLoading}
                icon={Plus}
              >
                Create Account & Grant Access
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4" noValidate>
          {formErrors.api && (
            <Alert type="error" message={formErrors.api} className="mb-2" />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              ref={nameRef}
              label="Business / Company Name"
              placeholder="e.g. Apex Retailers Pvt Ltd"
              value={createForm.name}
              onChange={(e) => {
                setCreateForm({ ...createForm, name: e.target.value });
                if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
              }}
              error={formErrors.name}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Subscription Plan <span className="text-amber-400">*</span>
              </label>
              <select
                value={createForm.plan}
                onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-900 border border-slate-800 text-white rounded-xl focus:border-amber-400 focus:outline-none"
              >
                <option value="starter">Starter Plan</option>
                <option value="pro">Pro Business Plan</option>
                <option value="enterprise">Enterprise Custom Plan</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Initial Administrator Credentials
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                ref={adminNameRef}
                label="Admin Full Name"
                placeholder="e.g. Rahul Sharma"
                value={createForm.adminName}
                onChange={(e) => {
                  setCreateForm({ ...createForm, adminName: e.target.value });
                  if (formErrors.adminName) setFormErrors({ ...formErrors, adminName: '' });
                }}
                error={formErrors.adminName}
                required
              />

              <Input
                ref={emailRef}
                label="Login Email Address"
                type="email"
                placeholder="admin@apexretail.com"
                value={createForm.email}
                onChange={(e) => {
                  setCreateForm({ ...createForm, email: e.target.value });
                  if (formErrors.email) setFormErrors({ ...formErrors, email: '' });
                }}
                error={formErrors.email}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                ref={passwordRef}
                label="Initial Password"
                type="password"
                placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => {
                  setCreateForm({ ...createForm, password: e.target.value });
                  if (formErrors.password) setFormErrors({ ...formErrors, password: '' });
                }}
                error={formErrors.password}
                helperText="Minimum 6 characters"
                required
              />

              <Input
                label="Contact Phone (Optional)"
                placeholder="+91 98765 43210"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TenantsPage;
