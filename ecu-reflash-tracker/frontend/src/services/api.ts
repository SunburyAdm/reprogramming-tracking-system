import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Auth ────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post('/api/auth/login', { email, password }).then(r => r.data);

export const getMe = () =>
  api.get('/api/auth/me').then(r => r.data);

export const updateProfile = (data: {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
  avatar?: string;
  avatar_color?: string;
}) => api.patch('/api/auth/me', data).then(r => r.data);

export const getUsers = () =>
  api.get('/api/users').then(r => r.data);

export const createUser = (data: { email: string; password: string; name: string; role: string }) =>
  api.post('/api/users', data).then(r => r.data);

export const updateUser = (userId: string, data: { name?: string; email?: string; password?: string; role?: string }) =>
  api.patch(`/api/users/${userId}`, data).then(r => r.data);

export const deleteUser = (userId: string) =>
  api.delete(`/api/users/${userId}`);

// ── Sessions ─────────────────────────────────────────────────────────────────
export const listSessions = () =>
  api.get('/api/sessions').then(r => r.data);

export const getSession = (id: string) =>
  api.get(`/api/sessions/${id}`).then(r => r.data);

export const createSession = (data: { name: string; target_sw_version: string }) =>
  api.post('/api/sessions', data).then(r => r.data);

export const updateSession = (id: string, data: object) =>
  api.patch(`/api/sessions/${id}`, data).then(r => r.data);

export const sessionReady = (id: string) =>
  api.post(`/api/sessions/${id}/ready`).then(r => r.data);

export const sessionStart = (id: string) =>
  api.post(`/api/sessions/${id}/start`).then(r => r.data);

export const sessionClose = (id: string) =>
  api.post(`/api/sessions/${id}/close`).then(r => r.data);

export const getStations = (sessionId: string) =>
  api.get(`/api/sessions/${sessionId}/stations`).then(r => r.data);

export const getStation = (sessionId: string, stationId: string) =>
  api.get(`/api/sessions/${sessionId}/stations/${stationId}`).then(r => r.data);

export const updateStationMembers = (sessionId: string, stationId: string, memberIds: string[]) =>
  api.put(`/api/sessions/${sessionId}/stations/${stationId}/members`, { member_ids: memberIds }).then(r => r.data);

export const createStation = (sessionId: string, data: { name: string; member_ids?: string[] }) =>
  api.post(`/api/sessions/${sessionId}/stations`, data).then(r => r.data);

export const deleteSession = (id: string) =>
  api.delete(`/api/sessions/${id}`);

export const reopenSession = (id: string) =>
  api.post(`/api/sessions/${id}/reopen`).then(r => r.data);

// ── Boxes ────────────────────────────────────────────────────────────────────
const boxBase = (sid: string) => `/api/sessions/${sid}/boxes`;

export const listBoxes = (sessionId: string) =>
  api.get(boxBase(sessionId)).then(r => r.data);

export const getBox = (sessionId: string, boxId: string) =>
  api.get(`${boxBase(sessionId)}/${boxId}`).then(r => r.data);

export const createBox = (sessionId: string, data: { box_serial: string; expected_ecu_count?: number }) =>
  api.post(boxBase(sessionId), data).then(r => r.data);

export const updateBoxStatus = (sessionId: string, boxId: string, status: string) =>
  api.patch(`${boxBase(sessionId)}/${boxId}/status`, { status }).then(r => r.data);

export const deleteBox = (sessionId: string, boxId: string) =>
  api.delete(`${boxBase(sessionId)}/${boxId}`);

export const deleteEcu = (sessionId: string, boxId: string, ecuContextId: string) =>
  api.delete(`${boxBase(sessionId)}/${boxId}/ecus/${ecuContextId}`);

export const markEcuScratch = (sessionId: string, boxId: string, ecuContextId: string) =>
  api.post(`${boxBase(sessionId)}/${boxId}/ecus/${ecuContextId}/scratch`).then(r => r.data);

export const claimBox = (sessionId: string, boxId: string, stationId: string) =>
  api.post(`${boxBase(sessionId)}/${boxId}/claim`, null, { params: { station_id: stationId } }).then(r => r.data);

export const getBoxEcus = (sessionId: string, boxId: string) =>
  api.get(`${boxBase(sessionId)}/${boxId}/ecus`).then(r => r.data);

export const scanEcu = (sessionId: string, boxId: string, ecuCode: string) =>
  api.post(`${boxBase(sessionId)}/${boxId}/scan_ecu`, null, { params: { ecu_code: ecuCode } }).then(r => r.data);

export const freezeBox = (sessionId: string, boxId: string) =>
  api.post(`${boxBase(sessionId)}/${boxId}/freeze`).then(r => r.data);

export const startFlash = (sessionId: string, boxId: string, data: { ecu_code: string; expected_version: number }) =>
  api.post(`${boxBase(sessionId)}/${boxId}/start_flash`, data).then(r => r.data);

export const finishFlash = (sessionId: string, boxId: string, data: { ecu_code: string; result: 'success' | 'failed'; notes?: string; expected_version: number }) =>
  api.post(`${boxBase(sessionId)}/${boxId}/finish_flash`, data).then(r => r.data);

export const startRework = (sessionId: string, boxId: string, ecuCode: string) =>
  api.post(`${boxBase(sessionId)}/${boxId}/start_rework`, { ecu_code: ecuCode }).then(r => r.data);

export const getEcuAttempts = (sessionId: string, boxId: string, ecuContextId: string) =>
  api.get(`${boxBase(sessionId)}/${boxId}/ecus/${ecuContextId}/attempts`).then(r => r.data);

export const getEcuHistory = (sessionId: string, boxId: string, ecuContextId: string) =>
  api.get(`${boxBase(sessionId)}/${boxId}/ecus/${ecuContextId}/history`).then(r => r.data);

export const getEcuUploads = (sessionId: string, boxId: string, ecuContextId: string) =>
  api.get(`${boxBase(sessionId)}/${boxId}/ecus/${ecuContextId}/uploads`).then(r => r.data);

// ── Reports / Analytics ──────────────────────────────────────────────────────
export const getAnalytics = (sessionId: string) =>
  api.get(`/api/sessions/${sessionId}/analytics`).then(r => r.data);

export const downloadSessionReport = (sessionId: string) =>
  api.get(`/api/sessions/${sessionId}/report.xlsx`, { responseType: 'blob' }).then(r => r.data);

export const downloadBoxReport = (sessionId: string, boxId: string) =>
  api.get(`/api/sessions/${sessionId}/boxes/${boxId}/report.xlsx`, { responseType: 'blob' }).then(r => r.data);

export default api;
