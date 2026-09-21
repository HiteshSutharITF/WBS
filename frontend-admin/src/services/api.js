import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('wbs_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    let message = 'Unexpected system failure occurred.';
    if (!error.response) {
      if (error.code === 'ERR_NETWORK') {
        message = 'Network connection fails or server is not responding.';
      } else {
        message = error.message;
      }
    } else if (error.response.data && error.response.data.message) {
      message = error.response.data.message;
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('wbs_admin_token');
      localStorage.removeItem('wbs_admin_user');
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = '/admin/login';
      }
    }

    const enhancedError = new Error(message);
    enhancedError.response = error.response;
    enhancedError.status = error.response?.status;
    return Promise.reject(enhancedError);
  }
);

export default api;
