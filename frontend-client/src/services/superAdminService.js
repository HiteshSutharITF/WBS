import api from './api';

export const superAdminService = {
  getDashboardStats: async () => {
    return api.get('/superadmin/dashboard');
  },

  listTenants: async (params = {}) => {
    return api.get('/superadmin/tenants', { params });
  },

  getTenantDetail: async (tenantId) => {
    return api.get(`/superadmin/tenants/${tenantId}`);
  },

  toggleTenantStatus: async (tenantId, status) => {
    return api.put(`/superadmin/tenants/${tenantId}/status`, { status });
  },

  getHealthAlerts: async () => {
    return api.get('/superadmin/health-alerts');
  },

  listAuditLogs: async (params = {}) => {
    return api.get('/superadmin/audit-logs', { params });
  }
};
