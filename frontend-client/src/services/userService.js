import api from './api';

export const userService = {
  listTeamMembers: async () => {
    return api.get('/users');
  },

  inviteTeamMember: async (userData) => {
    return api.post('/users/invite', userData);
  },

  toggleUserStatus: async (userId) => {
    return api.put(`/users/${userId}/toggle-status`);
  }
};
