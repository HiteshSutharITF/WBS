import api from './api';

export const chatService = {
  listConversations: async (params = {}) => {
    return api.get('/chats', { params });
  },

  getConversation: async (conversationId) => {
    return api.get(`/chats/${conversationId}`);
  },

  markConversationRead: async (conversationId) => {
    return api.post(`/chats/${conversationId}/mark-read`);
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

  sendTextMessage: async (conversationId, content, options = {}) => {
    return api.post('/messages/text', {
      conversationId,
      content,
      ...(options.replyToMessageId ? { replyToMessageId: options.replyToMessageId } : {})
    });
  },

  sendMediaMessage: async (formData) => {
    return api.post('/messages/media', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  uploadMediaAsset: async (formData) => {
    return api.post('/messages/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  sendTemplateMessage: async (conversationId, templateId, parameters = [], options = {}) => {
    const payload = typeof conversationId === 'object'
      ? conversationId
      : { conversationId, templateId, parameters, ...options };
    return api.post('/messages/template', payload);
  },

  deleteMessage: async (messageId, scope = 'me') => {
    return api.post(`/messages/${messageId}/delete`, { scope });
  },

  reactToMessage: async (messageId, emoji) => {
    return api.post(`/messages/${messageId}/react`, { emoji: emoji || '' });
  }
};
