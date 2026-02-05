import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { clearSessionToken, neonAuth } from '../lib/neonAuth';
import Spline from '@splinetool/react-spline';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { user, loading, setUser, setProfileComplete } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading state
  if (loading) {
    return (
      <section className="card">
        <p style={{ textAlign: 'center' }}>Loading...</p>
      </section>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      clearSessionToken();
      await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      sessionStorage.setItem('local_session_hint', '1');

      const data = await api('/auth/me');
      setUser(data.user);
      setProfileComplete(Boolean(data.profileComplete));
      navigate(data.profileComplete ? '/dashboard' : '/complete-profile');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="display-flex">
      <div className=" login-card">
      <h2>Login</h2>
      
      <div className="form-container">
        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input 
            placeholder="Enter your email" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          
          <label>Password</label>
          <input 
            placeholder="Enter your password" 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          
          <button type="submit">Login</button>
          
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            marginTop: '1rem',
            flexDirection: 'column'
          }}>
            {/* <button 
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/auth/google/start`}
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              Continue with Google
            </button> */}
            <button 
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}/auth/github/start`}
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              Continue with GitHub
            </button>
          </div>
        </form>
        
        {/* <div className="right-side splineFixed">
          <Spline scene="https://prod.spline.design/6elw4OLN7yEqIw9t/scene.splinecode" />
        </div> */}
      </div>
      
      {error && <p className="error">{error}</p>}
      </div>
    </section>
  );
}
