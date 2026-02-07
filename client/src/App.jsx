import { Link, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useLayoutEffect, useRef, useState } from 'react';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TeamPage from './pages/TeamPage';
import AdminPage from './pages/AdminPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import ProfilePage from './pages/ProfilePage';
import { api } from './api/http';
import { neonAuth } from './lib/neonAuth';
import logo from './assets/logo.png';

// Home redirect component
function Home() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading...</p>
      </div>
    );
  }
  
  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

function Nav() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const ulRef = useRef(null);
  const linkRefs = useRef([]);
  const [pill, setPill] = useState({ x: 0, y: 0, w: 0, h: 0, opacity: 0 });
  const [isOpen, setIsOpen] = useState(false);

  // Define navigation links based on user state
  const LINKS = user ? [
    { label: 'Dashboard', path: '/dashboard' },

    { label: 'Teams', path: '/team' },
    { label: 'Profile', path: '/profile' },
    ...((['admin', 'organizer'].includes(user.role)) ? [{ label: 'Admin', path: '/admin' }] : []),
  ] : [
    { label: 'Login', path: '/login' },
    { label: 'Register', path: '/register' },
  ];

  const activeIndex = LINKS.findIndex(l => l.path === location.pathname);

  const measureTo = (index, show = true) => {
    const ul = ulRef.current;
    const el = linkRefs.current[index];
    if (!ul || !el) return;

    const ulRect = ul.getBoundingClientRect();
    const aRect = el.getBoundingClientRect();

    setPill({
      x: aRect.left - ulRect.left,
      y: aRect.top - ulRect.top,
      w: aRect.width,
      h: aRect.height,
      opacity: show ? 1 : 0,
    });
  };

  useLayoutEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 950) setIsOpen(false);
      if (pill.opacity === 1 && activeIndex >= 0) measureTo(activeIndex, true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeIndex, pill.opacity]);

  const handleClick = (e, path) => {
    e.preventDefault();
    navigate(path);
    setIsOpen(false);
  };

  const logout = async () => {
    await neonAuth.signOut();
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore local-session logout failures
    }
    sessionStorage.removeItem('local_session_hint');
    sessionStorage.removeItem('neon_verifier_handled');
    setUser(null);
  };

  return (
    <nav className="navbar">
      <div className="navbarInner">
        {/* Logo */}
        <a href="https://cougarhacks.com" className="navLogo">
          <img src={logo} alt="CougarHacks Logo" className="logoImg" />
        </a>

        {/* Mobile hamburger */}
        <button
          className="hamburgerBtn"
          aria-label="Open menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((v) => !v)}
        >
          <span className="hamburgerIcon" />
        </button>

        {/* Nav Links */}
        <ul
          ref={ulRef}
          className={`navList ${isOpen ? 'open' : ''}`}
          onMouseLeave={() => setPill((p) => ({ ...p, opacity: 0 }))}
        >
          {/* Hover pill */}
          <span
            className="navPill"
            style={{
              transform: `translate3d(${pill.x}px, ${pill.y}px, 0)`,
              width: `${pill.w}px`,
              height: `${pill.h}px`,
              opacity: pill.opacity,
            }}
            aria-hidden="true"
          />

          {LINKS.map((link, idx) => (
            <li key={link.path}>
              <a
                ref={(node) => (linkRefs.current[idx] = node)}
                href={link.path}
                className={idx === activeIndex ? 'active' : ''}
                onMouseEnter={() => measureTo(idx, true)}
                onFocus={() => measureTo(idx, true)}
                onClick={(e) => handleClick(e, link.path)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Logout button */}
        {user && (
          <button className="logoutBtn" onClick={logout}>
            Logout
          </button>
        )}
      </div>

      {/* Mobile backdrop */}
      {isOpen && <div className="mobileBackdrop" onClick={() => setIsOpen(false)} />}
    </nav>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/complete-profile"
            element={
              <ProtectedRoute>
                <CompleteProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <TeamPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </>
  );
}
