import { describe, it, expect } from 'vitest';

// Auth schema logic: password required for admin/faculty, optional for student
const createUserSchema = (data: {
  email: string;
  password?: string;
  full_name: string;
  role: 'admin' | 'faculty' | 'student';
  guardian_email?: string;
}) => {
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { success: false, error: 'invalid email' };
  if (!data.full_name?.trim()) return { success: false, error: 'missing full_name' };
  if (!['admin', 'faculty', 'student'].includes(data.role)) return { success: false, error: 'invalid role' };
  if (data.role !== 'student' && (!data.password || data.password.length < 6)) {
    return { success: false, error: 'password required for admin/faculty (min 6)' };
  }
  return { success: true };
};

describe('createUserSchema (auth validation)', () => {
  it('accepts valid student without password', () => {
    expect(createUserSchema({
      email: 's@example.com',
      full_name: 'Student',
      role: 'student',
    }).success).toBe(true);
  });

  it('rejects admin without password', () => {
    expect(createUserSchema({
      email: 'a@example.com',
      full_name: 'Admin',
      role: 'admin',
    }).success).toBe(false);
  });

  it('accepts faculty with password >= 6 chars', () => {
    expect(createUserSchema({
      email: 'f@example.com',
      full_name: 'Faculty',
      role: 'faculty',
      password: 'secret12',
    }).success).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(createUserSchema({
      email: 'not-an-email',
      full_name: 'X',
      role: 'student',
    }).success).toBe(false);
  });
});
