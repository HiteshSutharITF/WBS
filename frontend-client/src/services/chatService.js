import api from './api';

export const chatService = {
  listConversations: async (params = {}) => {
    return api.get('/chats', { params });
  },

  getConversation: async (conversationId) => {
    return api.get(`/chats/${conversationId}`);
  },

  assignAgent: async (conversationId, agentId) => {
    return api.put(`/chats/${conversationId}/assign`, { agentId });
  },

  toggleBotPause: async (conversationId) => {
    return api.put(`/chats/${conversationId}/toggle-bot`);
  },

  updateStatus: async (conversationId, status) => {
    return api.put(`/chats/${conversationId}/status`, { status });
  },

  sendTextMessage: async (conversationId, content) => {
    return api.post('/messages/text', { conversationId, content });
  },

  sendMediaMessage: async (formData) => {
    return api.post('/messages/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  sendTemplateMessage: async (conversationId, templateId, parameters = []) => {
    return api.post('/messages/template', { conversationId, templateId, parameters });
  }
};
