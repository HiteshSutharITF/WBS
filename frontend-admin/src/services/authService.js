import api from './api';

export const authService = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    const user = response.data?.user;
    if (user && (user.role === 'super_admin' || user.role === 'support')) {
      localStorage.setItem('wbs_admin_token', response.data.token);
      localStorage.setItem('wbs_admin_user', JSON.stringify(user));
      return response;
    } else {
      throw new Error('Access denied. This console is restricted to ITFuturz Super Admin & Support staff.');
    }
  },

  getMe: async () => {
    return api.get('/auth/me');
  },

  logout: () => {
    localStorage.removeItem('wbs_admin_token');
    localStorage.removeItem('wbs_admin_user');
    window.location.href = '/admin/#/login';
  },

  getCurrentUser: () => {
    const str = localStorage.getItem('wbs_admin_user');
    return str ? JSON.parse(str) : null;
  }
};
