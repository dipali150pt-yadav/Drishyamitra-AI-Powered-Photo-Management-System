import axios from 'axios';

// ── Base URL detection ────────────────────────────────────────────────────────
// Priority: env var → local dev → relative (Docker/nginx)
const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  const h = window.location.hostname;
  const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
  return isLocal ? 'http://localhost:5000/api' : '/api';
};

export const API_BASE = getApiBase();

const API = axios.create({ baseURL: API_BASE });

// Attach JWT token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Media URL helpers (use these instead of hardcoded localhost) ──────────────
export const getPhotoUrl = (filename) => `${API_BASE}/photos/serve/${filename}`;
export const getFaceUrl  = (filename) => `${API_BASE}/faces/serve/${filename}`;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const signup = (data) => API.post('/auth/signup', data);
export const login  = (data) => API.post('/auth/login', data);

// ── Photos ────────────────────────────────────────────────────────────────────
export const uploadPhoto       = (formData)  => API.post('/photos/upload', formData);
export const getAllPhotos       = ()          => API.get('/photos/all');
export const getPhotosByPerson = (personId)  => API.get(`/photos/by-person/${personId}`);
export const deletePhoto       = (photoId)   => API.delete(`/photos/delete/${photoId}`);
export const searchPhotos      = (q, date, tag) =>
  API.get(`/photos/search?q=${encodeURIComponent(q || '')}&date=${date || ''}&tag=${encodeURIComponent(tag || '')}`);

// ── Faces & People ────────────────────────────────────────────────────────────
export const getPeople         = ()          => API.get('/faces/people');
export const addPerson         = (data)      => API.post('/faces/people/add', data);
export const deletePerson      = (id)        => API.delete(`/faces/people/${id}`);
export const detectFaces       = (photoId)   => API.post(`/faces/detect/${photoId}`);
export const labelFace         = (data)      => API.post('/faces/label', data);
export const getFacesInPhoto   = (photoId)   => API.get(`/faces/in-photo/${photoId}`);
export const getUnlabeledFaces = ()          => API.get('/faces/unlabeled');

// ── Albums ────────────────────────────────────────────────────────────────────
export const getAlbums         = ()          => API.get('/albums/');
export const createAlbum       = (data)      => API.post('/albums/create', data);
export const getAlbum          = (id)        => API.get(`/albums/${id}`);
export const updateAlbum       = (id, data)  => API.put(`/albums/${id}`, data);
export const deleteAlbum       = (id)        => API.delete(`/albums/${id}`);
export const addPhotosToAlbum  = (id, photo_ids) => API.post(`/albums/${id}/add-photos`, { photo_ids });
export const removePhotoFromAlbum = (albumId, photoId) =>
  API.delete(`/albums/${albumId}/remove-photo/${photoId}`);
export const updatePhotoMeta   = (photoId, data) => API.put(`/albums/photo/${photoId}/meta`, data);
export const getPhotosByTag    = (tag)       => API.get(`/albums/photos/by-tag?tag=${encodeURIComponent(tag)}`);

// ── Chatbot / Delivery ────────────────────────────────────────────────────────
export const sendMessage       = (data)      => API.post('/chatbot/chat', data);
export const sendEmail         = (data)      => API.post('/chatbot/send-email', data);
export const sendWhatsApp      = (data)      => API.post('/chatbot/send-whatsapp', data);
export const getHistory        = ()          => API.get('/chatbot/history');

export default API;
