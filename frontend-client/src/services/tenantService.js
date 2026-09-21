import api from './api';

export const tenantService = {
  getProfile: async () => {
    return api.get('/tenant/profile');
  },

  updateWorkingHours: async (workingHours) => {
    return api.put('/tenant/working-hours', workingHours);
  },

  completeOnboarding: async (onboardingData) => {
    return api.post('/tenant/whatsapp/complete', onboardingData);
  },

  disconnectWhatsApp: async () => {
    return api.post('/tenant/whatsapp/disconnect');
  }
};
