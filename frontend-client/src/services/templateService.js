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

  uploadMediaSample: async (formData, onProgress) => {
    return api.post('/templates/upload-sample', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      }
    });
  },

  deleteTemplate: async (templateId) => {
    return api.delete(`/templates/${templateId}`);
  }
};
