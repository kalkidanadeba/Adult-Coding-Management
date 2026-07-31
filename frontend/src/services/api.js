import axios from 'axios';

const envBaseURL = import.meta.env.VITE_API_URL;
// In dev, use same-origin `/api` so Vite can proxy to the backend (avoids CORS "Network Error").
// In production, prefer an explicit env var; otherwise default to same-origin `/api` (works behind a reverse proxy).
const baseURL = import.meta.env.DEV ? '/api' : (envBaseURL || '/api');

export const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token');

  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  return config;
});

export default api;
