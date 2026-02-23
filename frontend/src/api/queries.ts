import { api } from './client';

export const queryKeys = {
  sessions: ['sessions'] as const,
  schedules: ['schedules'] as const,
  serverTime: ['serverTime'] as const,
  students: ['students'] as const,
  users: ['users'] as const,
  iotDevices: ['iot', 'devices'] as const,
  attendanceReport: (sessionId: string) => ['attendance', 'session', sessionId] as const,
  sessionStats: (sessionId: string) => ['attendance', 'session', sessionId, 'stats'] as const,
  atRisk: ['behavior', 'at-risk'] as const,
};

export async function fetchServerTime(): Promise<{ dayOfWeek: number; date: string }> {
  return api.get<{ dayOfWeek: number; date: string }>('/api/sessions/server-time');
}

export async function fetchSessions() {
  return api.get<Array<Record<string, unknown>>>('/api/sessions');
}

export async function fetchSchedules() {
  return api.get<Array<Record<string, unknown>>>('/api/schedules');
}

export async function fetchStudents() {
  return api.get<Array<Record<string, unknown>>>('/api/users/students');
}

export async function fetchUsers() {
  return api.get<Array<Record<string, unknown>>>('/api/users');
}

export async function fetchAtRisk() {
  return api.get<{ config: { criticalBelow: number }; atRisk: Array<{ userId: string; full_name: string; email: string; attendanceRate: number; level: string }> }>('/api/behavior/at-risk');
}

export interface IoTDevice {
  id: string;
  device_id: string;
  name: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export async function fetchIotDevices() {
  return api.get<IoTDevice[]>('/api/iot/devices');
}

export async function createIotDevice(body: { device_id: string; name?: string }) {
  return api.post<IoTDevice & { api_key: string }>('/api/iot/devices', body);
}

export async function updateIotDevice(id: string, body: { name?: string; is_active?: boolean }) {
  return api.patch<IoTDevice>(`/api/iot/devices/${id}`, body);
}

export async function deleteIotDevice(id: string) {
  return api.delete(`/api/iot/devices/${id}`);
}
