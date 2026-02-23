import { api } from './client';

export const queryKeys = {
  sessions: ['sessions'] as const,
  schedules: ['schedules'] as const,
  students: ['students'] as const,
  users: ['users'] as const,
  attendanceReport: (sessionId: string) => ['attendance', 'session', sessionId] as const,
};

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
