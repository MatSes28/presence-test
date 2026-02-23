import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Layout.module.css';

const navItems: { to: string; label: string; roles?: ('admin' | 'faculty')[] }[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/sessions', label: 'Sessions', roles: ['admin', 'faculty'] },
  { to: '/schedules', label: 'Schedules', roles: ['admin'] },
  { to: '/users', label: 'User Management', roles: ['admin'] },
  { to: '/iot-devices', label: 'IoT Devices', roles: ['admin'] },
  { to: '/classrooms', label: 'Classrooms', roles: ['admin'] },
  { to: '/subjects', label: 'Subjects', roles: ['admin'] },
  { to: '/lab-computers', label: 'Lab Computers', roles: ['admin', 'faculty'] },
];

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/sessions')) return 'Sessions';
  if (pathname.startsWith('/schedules')) return 'Schedules';
  if (pathname.startsWith('/users')) return 'User Management';
  if (pathname.startsWith('/iot-devices')) return 'IoT Devices';
  if (pathname.startsWith('/classrooms')) return 'Classrooms';
  if (pathname.startsWith('/subjects')) return 'Subjects';
  if (pathname.startsWith('/lab-computers')) return 'Lab Computers';
  if (pathname.startsWith('/attendance')) return 'Attendance Report';
  return 'Dashboard';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isFaculty = user?.role === 'faculty' || isAdmin;

  const initial = user?.full_name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.logo}>CLIRDEC</div>
          <div className={styles.tagline}>Attendance & Classroom Engagement · CLSU DIT</div>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            if (item.roles && !item.roles.some((r) => (r === 'admin' && isAdmin) || (r === 'faculty' && isFaculty))) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => [styles.navLink, isActive && styles.active].filter(Boolean).join(' ')}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userBlock}>
            <div className={styles.userAvatar}>{initial}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.full_name}</div>
              <div className={styles.role}>{user?.role}</div>
            </div>
          </div>
          <Link to="/privacy" className={styles.footerLink}>Privacy</Link>
          <button
            type="button"
            onClick={logout}
            className={styles.logout}
            aria-label="Log out and end session"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className={styles.mainWrap}>
        <header className={styles.topBar}>
          <span className={styles.breadcrumb}>Home / {getPageTitle(location.pathname)}</span>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
