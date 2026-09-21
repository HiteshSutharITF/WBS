import api from './api';

export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data?.token) {
      localStorage.setItem('wbs_token', response.data.token);
      localStorage.setItem('wbs_user', JSON.stringify(response.data.user));
      if (response.data.tenant) {
        localStorage.setItem('wbs_tenant', JSON.stringify(response.data.tenant));
      }
    }
    return response;
  },

  register: async (payload) => {
    const response = await api.post('/auth/register', payload);
    if (response.data?.token) {
      localStorage.setItem('wbs_token', response.data.token);
      localStorage.setItem('wbs_user', JSON.stringify(response.data.user));
      localStorage.setItem('wbs_tenant', JSON.stringify(response.data.tenant));
    }
    return response;
  },

  getMe: async () => {
    return api.get('/auth/me');
  },

  handleSsoToken: async (ssoToken) => {
    localStorage.setItem('wbs_token', ssoToken);
    try {
      const response = await api.get('/auth/me');
      if (response.data?.user) {
        localStorage.setItem('wbs_user', JSON.stringify(response.data.user));
      }
      if (response.data?.tenant) {
        localStorage.setItem('wbs_tenant', JSON.stringify(response.data.tenant));
      }
      return response;
    } catch (err) {
      localStorage.removeItem('wbs_token');
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('wbs_token');
    localStorage.removeItem('wbs_user');
    localStorage.removeItem('wbs_tenant');
    window.location.href = '/login';
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('wbs_user');
    return userStr ? JSON.parse(userStr) : null;
  },

  getCurrentTenant: () => {
    const tenantStr = localStorage.getItem('wbs_tenant');
    return tenantStr ? JSON.parse(tenantStr) : null;
  }
};
