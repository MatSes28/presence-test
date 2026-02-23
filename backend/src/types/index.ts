export type UserRole = 'admin' | 'faculty' | 'student';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  created_at: string;
}

export interface RfidCard {
  id: string;
  card_uid: string;
  user_id: string;
  is_active: boolean;
}

export interface Schedule {
  id: string;
  subject: string;
  room: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
  faculty_id: string;
}

export interface ClassSession {
  id: string;
  schedule_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'scheduled' | 'active' | 'ended';
}

export interface AttendanceEvent {
  id: string;
  session_id: string;
  user_id: string;
  rfid_uid: string;
  proximity_valid: boolean;
  distance_cm: number | null;
  recorded_at: string;
  status: 'recorded' | 'rejected' | 'duplicate';
}

export interface IoTAttendancePayload {
  card_uid: string;
  proximity_cm: number;
  device_id?: string;
}
