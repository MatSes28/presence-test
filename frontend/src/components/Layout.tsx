import { Outlet, NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isFaculty = user?.role === 'faculty' || isAdmin;

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>CLIRDEC</span>
          <span className={styles.tagline}>Attendance & Classroom Engagement · CLSU DIT</span>
        </div>
        <nav className={styles.nav}>
          <NavLink to="/" className={({ isActive }) => (isActive ? styles.active : '')} end>
            Dashboard
          </NavLink>
          {(isFaculty || isAdmin) && (
            <NavLink to="/sessions" className={({ isActive }) => (isActive ? styles.active : '')}>
              Sessions
            </NavLink>
          )}
          {isAdmin && (
            <>
              <NavLink to="/schedules" className={({ isActive }) => (isActive ? styles.active : '')}>
                Schedules
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => (isActive ? styles.active : '')}>
                Users
              </NavLink>
              <NavLink to="/iot-devices" className={({ isActive }) => (isActive ? styles.active : '')}>
                IoT devices
              </NavLink>
            </>
          )}
        </nav>
        <div className={styles.user}>
          <span>{user?.full_name}</span>
          <span className={styles.role}>{user?.role}</span>
          <Link to="/privacy" className={styles.footerLink}>Privacy</Link>
          <button type="button" onClick={logout} className={styles.logout}>
            Log out
          </button>
        </div>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
