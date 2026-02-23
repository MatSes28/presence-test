import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Link } from 'react-router-dom';
import { buttonVariants } from '../components/ui/button';
import { cn } from '../lib/utils';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/login" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          ← Back to login
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Privacy Notice</CardTitle>
            <CardDescription>
              CLIRDEC:PRESENCE — Central Luzon State University · Department of Information Technology (DIT) · College of Engineering (BSIT)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h2 className="font-semibold text-base mb-2">Purpose of processing</h2>
              <p>
                This system collects and processes personal data for <strong>attendance monitoring and classroom engagement</strong> only.
                Data is used to record student presence (via RFID and proximity), to generate reports for faculty and administrators, and,
                where configured, to send notifications to guardians.
              </p>
            </section>
            <section>
              <h2 className="font-semibold text-base mb-2">Data we collect</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Users (students, faculty, admin):</strong> name, email, role; for students, optional guardian email.</li>
                <li><strong>Attendance:</strong> session, timestamp, and linkage to your user account when you tap an RFID card.</li>
                <li><strong>Technical:</strong> access and export actions may be logged (audit log) for security and compliance.</li>
              </ul>
            </section>
            <section>
              <h2 className="font-semibold text-base mb-2">Who can access your data</h2>
              <p>
                Access is restricted by role: administrators manage users and schedules; faculty view and manage their sessions and attendance;
                students are identified only via RFID for attendance. Exports (e.g. CSV) and report views are logged.
              </p>
            </section>
            <section>
              <h2 className="font-semibold text-base mb-2">Retention and security</h2>
              <p>
                Data is retained as required for academic and operational purposes. Retention periods should be defined by your institution.
                We use access controls, encryption of passwords, and secure connections (HTTPS in production) to protect your data.
              </p>
            </section>
            <section>
              <h2 className="font-semibold text-base mb-2">Your rights</h2>
              <p>
                You may have the right to access, correct, or request deletion of your personal data, subject to applicable law and
                institutional policy. Contact your institution or the system administrator for requests.
              </p>
            </section>
            <p className="text-[var(--text-muted)] pt-2">
              Last updated: Feb 2025. This notice is provided for transparency and alignment with privacy and ISO-oriented practices.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
