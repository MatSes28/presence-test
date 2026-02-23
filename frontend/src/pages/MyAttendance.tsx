import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

interface AttendanceRow {
  id: string;
  recorded_at: string;
  attendance_status: string | null;
  session_start: string;
  subject: string;
  room: string;
}

export default function MyAttendance() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<{ full_name: string; email: string; attendance: AttendanceRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing link. Use the link provided by your administrator.');
      return;
    }
    fetch(`/api/attendance/me?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Invalid or expired link'))))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-[var(--error)]">Cannot load attendance</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>My attendance</CardTitle>
            <CardDescription>{data.full_name} — {data.email}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Records</CardTitle>
            <CardDescription>Your recent attendance events.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.attendance.length === 0 ? (
              <p className="text-[var(--text-muted)]">No attendance records yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 pr-4">Date / time</th>
                      <th className="text-left py-2 pr-4">Subject</th>
                      <th className="text-left py-2 pr-4">Room</th>
                      <th className="text-left py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.map((row) => (
                      <tr key={row.id} className="border-b border-[var(--border-muted)]">
                        <td className="py-2 pr-4">{new Date(row.recorded_at).toLocaleString()}</td>
                        <td className="py-2 pr-4">{row.subject}</td>
                        <td className="py-2 pr-4">{row.room}</td>
                        <td className="py-2 capitalize">{row.attendance_status ?? 'present'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
