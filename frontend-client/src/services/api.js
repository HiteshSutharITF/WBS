import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wbs_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor displaying exact backend message per SOP
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    let message = 'Unexpected system failure occurred.';
    if (!error.response) {
      if (error.code === 'ERR_NETWORK') {
        message = 'Network connection fails or backend server is not reachable.';
      } else {
        message = error.message;
      }
    } else if (error.response.data && error.response.data.message) {
      message = error.response.data.message;
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('wbs_token');
      localStorage.removeItem('wbs_user');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }

    const enhancedError = new Error(message);
    enhancedError.response = error.response;
    enhancedError.status = error.response?.status;
    return Promise.reject(enhancedError);
  }
);

export default api;
