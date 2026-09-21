import api from './api';

export const superAdminService = {
  getDashboardStats: async () => {
    return api.get('/superadmin/dashboard');
  },

  listTenants: async (params = {}) => {
    return api.get('/superadmin/tenants', { params });
  },

  createTenant: async (data) => {
    return api.post('/superadmin/tenants', data);
  },

  impersonateTenant: async (tenantId) => {
    return api.post(`/superadmin/tenants/${tenantId}/impersonate`);
  },

  listAllUsers: async (params = {}) => {
    return api.get('/superadmin/users', { params });
  },

  impersonateUser: async (userId) => {
    return api.post(`/superadmin/users/${userId}/impersonate`);
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
