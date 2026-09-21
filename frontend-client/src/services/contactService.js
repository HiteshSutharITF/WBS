import api from './api';

export const contactService = {
  listContacts: async (params = {}) => {
    return api.get('/contacts', { params });
  },

  getContactById: async (contactId) => {
    return api.get(`/contacts/${contactId}`);
  },

  createContact: async (contactData) => {
    return api.post('/contacts', contactData);
  },

  updateContact: async (contactId, contactData) => {
    return api.put(`/contacts/${contactId}`, contactData);
  },

  updateLeadStage: async (contactId, leadStage) => {
    return api.put(`/contacts/${contactId}/stage`, { leadStage });
  },

  addNote: async (contactId, text) => {
    return api.post(`/contacts/${contactId}/notes`, { text });
  },

  importCsv: async (formData) => {
    return api.post('/contacts/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};
