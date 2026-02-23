import { describe, it, expect } from 'vitest';
import { parseUsersCsv } from '../bulkImportService.js';

describe('parseUsersCsv', () => {
  it('parses CSV with header row', () => {
    const csv = `email,full_name,role,guardian_email,card_uid
jane@example.com,Jane Doe,student,jane.parent@example.com,CARD001
john@example.com,John Smith,faculty,,`;
    const rows = parseUsersCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      email: 'jane@example.com',
      full_name: 'Jane Doe',
      role: 'student',
      guardian_email: 'jane.parent@example.com',
      card_uid: 'CARD001',
    });
    expect(rows[1].email).toBe('john@example.com');
    expect(rows[1].role).toBe('faculty');
    expect(rows[1].guardian_email).toBeUndefined();
    expect(rows[1].card_uid).toBeUndefined();
  });

  it('parses CSV without header when first cell is not "email"', () => {
    const csv = `a@b.com,Alice,admin,,,secret123`;
    const rows = parseUsersCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: 'a@b.com',
      full_name: 'Alice',
      role: 'admin',
      password: 'secret123',
    });
  });

  it('skips empty rows and invalid roles', () => {
    const csv = `email,full_name,role
,,,
x@y.com,Bob,invalid
c@d.com,Carol,student`;
    const rows = parseUsersCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('c@d.com');
  });

  it('returns empty array for empty input', () => {
    expect(parseUsersCsv('')).toHaveLength(0);
    expect(parseUsersCsv('\n\n')).toHaveLength(0);
  });
});
