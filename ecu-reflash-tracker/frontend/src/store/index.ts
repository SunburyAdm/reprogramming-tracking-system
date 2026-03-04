import { create } from 'zustand';
import { getMe } from '../services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'tech' | 'viewer';
  avatar?: string;
  avatar_color?: string;
  created_at?: string;
}

export interface StationSetup {
  id: string;
  station_id: string;
  name: string;
  attributes: Record<string, string>;
  created_at: string;
  updated_at?: string;
}

export interface Station {
  id: string;
  session_id: string;
  name: string;
  members: User[];
  setups: StationSetup[];
}

export interface Session {
  id: string;
  name: string;
  target_sw_version: string;
  status: 'draft' | 'ready' | 'active' | 'completed' | 'archived';
  created_at: string;
  started_at?: string;
  closed_at?: string;
  stations: Station[];
}

export interface ECUContext {
  id: string;
  session_id: string;
  box_id: string;
  ecu_code: string;
  status: 'learned' | 'flashing' | 'success' | 'failed' | 'rework_pending' | 'scratch';
  attempts: number;
  last_station_id?: string;
  last_user_id?: string;
  total_time_seconds?: number;
  created_at: string;
  updated_at: string;
}

export interface Box {
  id: string;
  session_id: string;
  box_serial: string;
  expected_ecu_count?: number;
  learned_count: number;
  inventory_frozen: boolean;
  status: 'pending' | 'learning' | 'in_progress' | 'blocked' | 'completed';
  assigned_station_id?: string;
  assigned_station_name?: string;
  failed_count: number;
  scratch_count: number;
  frozen_at?: string;
  completed_at?: string;
  created_at?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  },
  fetchMe: async () => {
    try {
      const user = await getMe();
      set({ user });
    } catch {
      localStorage.removeItem('token');
      set({ token: null, user: null });
    }
  },
}));

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  setSessions: (s: Session[]) => void;
  setCurrentSession: (s: Session | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentSession: null,
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSession) => set({ currentSession }),
}));

interface WorkbenchState {
  stationId: string | null;
  currentBox: Box | null;
  ecus: ECUContext[];
  setStation: (id: string | null) => void;
  setCurrentBox: (b: Box | null) => void;
  setEcus: (e: ECUContext[]) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  stationId: null,
  currentBox: null,
  ecus: [],
  setStation: (stationId) => set({ stationId }),
  setCurrentBox: (currentBox) => set({ currentBox }),
  setEcus: (ecus) => set({ ecus }),
}));

// ── User preferences (persisted in localStorage) ─────────────────────────────
interface PrefsState {
  confirmReflash: boolean;
  setConfirmReflash: (v: boolean) => void;
}

export const usePrefsStore = create<PrefsState>((set) => ({
  confirmReflash: localStorage.getItem('pref-confirmReflash') !== 'false',
  setConfirmReflash: (v) => {
    localStorage.setItem('pref-confirmReflash', String(v));
    set({ confirmReflash: v });
  },
}));
