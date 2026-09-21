import api from './api';

export const chatbotService = {
  listRules: async () => {
    return api.get('/chatbot');
  },

  createRule: async (ruleData) => {
    return api.post('/chatbot', ruleData);
  },

  updateRule: async (ruleId, ruleData) => {
    return api.put(`/chatbot/${ruleId}`, ruleData);
  },

  deleteRule: async (ruleId) => {
    return api.delete(`/chatbot/${ruleId}`);
  }
};
