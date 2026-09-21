import api from './api';

export const broadcastService = {
  listBroadcasts: async () => {
    return api.get('/broadcasts');
  },

  createBroadcast: async (broadcastData) => {
    return api.post('/broadcasts', broadcastData);
  },

  startBroadcast: async (broadcastId) => {
    return api.post(`/broadcasts/${broadcastId}/start`);
  },

  getReport: async (broadcastId) => {
    return api.get(`/broadcasts/${broadcastId}/report`);
  }
};
