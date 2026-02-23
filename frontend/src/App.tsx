import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Schedules from './pages/Schedules';
import Users from './pages/Users';
import AttendanceReport from './pages/AttendanceReport';
import IotDevices from './pages/IotDevices';
import Privacy from './pages/Privacy';
import MyAttendance from './pages/MyAttendance';

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/my-attendance" element={<MyAttendance />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="schedules" element={<PrivateRoute roles={['admin']}><Schedules /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute roles={['admin']}><Users /></PrivateRoute>} />
        <Route path="iot-devices" element={<PrivateRoute roles={['admin']}><IotDevices /></PrivateRoute>} />
        <Route path="attendance/:sessionId" element={<AttendanceReport />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
