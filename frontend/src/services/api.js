import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

/**
 * Health check service
 * Calls GET /api/health/ to verify backend connection status
 */
export const checkHealth = async () => {
  const response = await api.get('/api/health/');
  return response.data;
};

export default api;
