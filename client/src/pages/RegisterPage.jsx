import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Spline from '@splinetool/react-spline';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';
import { neonAuth, extractSessionToken, storeSessionToken } from '../lib/neonAuth';

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [otp, setOtp] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { setUser, setProfileComplete } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const signUpResult = await neonAuth.signUp.email({
        email: form.email,
        password: form.password,
        name: `${form.firstName} ${form.lastName}`.trim(),
      });
      storeSessionToken(extractSessionToken(signUpResult));

      setNeedsVerification(true);
      setMessage('We sent a verification code to your email. Enter it below to continue.');
    } catch (err) {
      setError(err.message);
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const base = String(import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '');
      const authBase = base.endsWith('/api/auth') || base.endsWith('/neondb/auth') ? base : `${base}/api/auth`;
      const response = await fetch(`${authBase}/email-otp/verify-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          otp,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.status === false) {
        throw new Error(result?.error || 'Invalid verification code');
      }

      storeSessionToken(result?.token || null);

      await api('/auth/sync-signup', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          password: form.password,
        }),
      });

      try {
        const data = await api('/auth/me');
        setUser(data.user);
        setProfileComplete(Boolean(data.profileComplete));
        navigate('/complete-profile');
      } catch {
        setMessage('Email verified and account synced. Please log in to continue.');
        navigate('/login');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2>{needsVerification ? 'Verify Your Email' : 'Register'}</h2>
      
      <div className="form-container">
        {!needsVerification ? (
          <form onSubmit={onSubmit}>
            <label>First Name</label>
            <input 
              placeholder="Enter your first name" 
              value={form.firstName} 
              onChange={(e) => setForm({ ...form, firstName: e.target.value })} 
              required 
            />
            
            <label>Last Name</label>
            <input 
              placeholder="Enter your last name" 
              value={form.lastName} 
              onChange={(e) => setForm({ ...form, lastName: e.target.value })} 
              required 
            />
            
            <label>Email</label>
            <input 
              placeholder="Enter your email" 
              type="email" 
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              required 
            />
            
            <label>Password</label>
            <input 
              placeholder="Minimum 8 characters" 
              type="password" 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
              minLength={8}
            />
            
            <button type="submit">Create Account</button>
            
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              marginTop: '1rem',
              flexDirection: 'column'
            }}>
              <button 
                type="button"
                onClick={() => neonAuth.signIn.social({ provider: 'google', callbackURL: '/dashboard' })}
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                Continue with Google
              </button>
              <button 
                type="button"
                onClick={() => neonAuth.signIn.social({ provider: 'github', callbackURL: '/dashboard' })}
                style={{ background: 'var(--color-bg-secondary)' }}
              >
                Continue with GitHub
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onVerify}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              We sent a verification code to <strong>{form.email}</strong>
            </p>
            
            <label>Verification Code</label>
            <input 
              placeholder="Enter the 6-digit code" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value)} 
              required 
              maxLength={6}
            />
            
            <button type="submit">Verify Email</button>
          </form>
        )}
        
        <div className="right-side">
          <Spline scene="https://prod.spline.design/6elw4OLN7yEqIw9t/scene.splinecode" />
        </div>
      </div>
      
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
