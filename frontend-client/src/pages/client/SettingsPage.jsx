import React, { useState, useEffect } from 'react';
import { Settings, Clock, Save, Building } from 'lucide-react';
import { tenantService } from '../../services/tenantService';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';

const SettingsPage = () => {
  const [workingHours, setWorkingHours] = useState({
    enabled: true,
    start: '09:00',
    end: '18:00',
    timezone: 'Asia/Kolkata',
    days: [1, 2, 3, 4, 5, 6]
  });
  const [tenant, setTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  useEffect(() => {
    tenantService.getProfile().then((res) => {
      if (res.data?.tenant) {
        setTenant(res.data.tenant);
        if (res.data.tenant.workingHours) {
          setWorkingHours(res.data.tenant.workingHours);
        }
      }
    });
  }, []);

  const handleSaveWorkingHours = async (e) => {
    e.preventDefault();
    setSaving(true);
    setAlertMsg('');
    try {
      await tenantService.updateWorkingHours(workingHours);
      setAlertMsg('Business working hours updated successfully.');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayIndex) => {
    const current = [...(workingHours.days || [])];
    const exists = current.indexOf(dayIndex);
    if (exists > -1) {
      current.splice(exists, 1);
    } else {
      current.push(dayIndex);
    }
    setWorkingHours({ ...workingHours, days: current });
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Business Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure business operating hours, timezones, and automated away conditions.
        </p>
      </div>

      {alertMsg && <Alert type="success" message={alertMsg} />}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Working Hours & Away Message Logic</h3>
            <p className="text-xs text-slate-500">Inbound messages outside these hours trigger your configured Away bot reply.</p>
          </div>
        </div>

        <form onSubmit={handleSaveWorkingHours} className="space-y-6">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wh-enabled"
              checked={workingHours.enabled}
              onChange={(e) => setWorkingHours({ ...workingHours, enabled: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="wh-enabled" className="text-sm font-semibold text-slate-800 cursor-pointer">
              Enable Working Hours Automation
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Opening Time (24h format)"
              type="time"
              value={workingHours.start}
              onChange={(e) => setWorkingHours({ ...workingHours, start: e.target.value })}
              required
            />
            <Input
              label="Closing Time (24h format)"
              type="time"
              value={workingHours.end}
              onChange={(e) => setWorkingHours({ ...workingHours, end: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Operating Days</label>
            <div className="flex flex-wrap gap-2">
              {dayNames.map((name, index) => {
                const isSelected = (workingHours.days || []).includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Timezone"
            value={workingHours.timezone}
            onChange={(e) => setWorkingHours({ ...workingHours, timezone: e.target.value })}
          />

          <Button type="submit" variant="primary" isLoading={saving} icon={Save}>
            Save Working Hours
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
