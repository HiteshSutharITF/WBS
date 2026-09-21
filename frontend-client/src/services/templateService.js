import api from './api';

export const templateService = {
  listTemplates: async (params = {}) => {
    return api.get('/templates', { params });
  },

  createTemplate: async (templateData) => {
    return api.post('/templates', templateData);
  },

  syncTemplates: async () => {
    return api.post('/templates/sync');
  },

  deleteTemplate: async (templateId) => {
    return api.delete(`/templates/${templateId}`);
  }
};
