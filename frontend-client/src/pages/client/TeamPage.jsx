import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, UserPlus, Shield, Mail, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import { userService } from '../../services/userService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { formatDate } from '../../utils/formatters';

const TeamPage = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Invite Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', password: '', role: 'client_agent' });
  const [errors, setErrors] = useState({});
  const [inviting, setInviting] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await userService.listTeamMembers();
      setMembers(res.data || []);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const validate = () => {
    const errs = {};
    if (!inviteForm.name.trim()) errs.name = 'Full name is required.';
    if (!inviteForm.email || !/^\S+@\S+\.\S+$/.test(inviteForm.email)) {
      errs.email = 'Valid business email is required.';
    }
    if (!inviteForm.password || inviteForm.password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }
    setErrors(errs);

    if (errs.name && nameRef.current) nameRef.current.focus();
    else if (errs.email && emailRef.current) emailRef.current.focus();

    return Object.keys(errs).length === 0;
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setInviting(true);
    try {
      await userService.inviteTeamMember(inviteForm);
      setIsModalOpen(false);
      setInviteForm({ name: '', email: '', password: '', role: 'client_agent' });
      fetchMembers();
    } catch (err) {
      alert(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await userService.toggleUserStatus(userId);
      fetchMembers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Users & Agent Access</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage agents who reply in the team inbox and view assigned WhatsApp leads.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)} icon={UserPlus}>
          Add Team Member
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Email</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Joined Date</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400 text-sm">Loading users...</td>
                </tr>
              ) : (
                members.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-xs text-slate-900 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                        {u.name?.[0] || 'U'}
                      </div>
                      <span>{u.name}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <Badge variant={u.role === 'client_admin' ? 'purple' : 'blue'} size="xs">
                        {u.role === 'client_admin' ? 'Business Admin' : 'Sales / Support Agent'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={u.isActive ? 'green' : 'red'} size="xs">
                        {u.isActive ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{formatDate(u.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(u._id)}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Invite New Team Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleInvite} isLoading={inviting}>Create User</Button>
          </>
        }
      >
        <form onSubmit={handleInvite} className="space-y-4" noValidate>
          <Input
            ref={nameRef}
            label="Full Name"
            placeholder="e.g. Priya Sharma"
            value={inviteForm.name}
            onChange={(e) => {
              setInviteForm({ ...inviteForm, name: e.target.value });
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            error={errors.name}
            required
          />

          <Input
            ref={emailRef}
            label="Email Address"
            type="email"
            placeholder="priya@company.com"
            value={inviteForm.email}
            onChange={(e) => {
              setInviteForm({ ...inviteForm, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            error={errors.email}
            required
          />

          <Input
            label="Initial Password"
            type="password"
            placeholder="At least 6 characters"
            value={inviteForm.password}
            onChange={(e) => {
              setInviteForm({ ...inviteForm, password: e.target.value });
              if (errors.password) setErrors({ ...errors, password: '' });
            }}
            error={errors.password}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Role & Access</label>
            <select
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-xl"
            >
              <option value="client_agent">Sales / Support Agent (Inbox & Contacts only)</option>
              <option value="client_admin">Client Admin (Full access to templates, team, broadcasts)</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default TeamPage;
