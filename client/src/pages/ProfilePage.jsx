import { useEffect, useState } from 'react';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dob: '',
    gender: '',
    university: '',
    major: '',
    graduationYear: '',
    country: '',
    city: '',
    dietaryRestrictions: '',
    githubUrl: '',
    linkedinUrl: '',
    portfolioUrl: '',
  });
  const [password, setPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api('/auth/me');
      const u = data.user || {};
      setForm({
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        phone: u.phone || '',
        dob: u.dob ? u.dob.split('T')[0] : '',
        gender: u.gender || '',
        university: u.university || '',
        major: u.major || '',
        graduationYear: u.graduation_year ? String(u.graduation_year) : '',
        country: u.country || '',
        city: u.city || '',
        dietaryRestrictions: u.dietary_restrictions || '',
        githubUrl: u.github_url || '',
        linkedinUrl: u.linkedin_url || '',
        portfolioUrl: u.portfolio_url || '',
      });
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      await api('/profile/me', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
        }),
      });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    
    if (password.length < 8) {
      setPasswordMsg('Password must be at least 8 characters');
      return;
    }
    
    try {
      await api('/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setPasswordMsg('Password updated successfully!');
      setPassword('');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch (err) {
      setPasswordMsg(err.message);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p>Loading profile...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>My Profile</h2>
      
      {/* User Info */}
      <div className="card" style={{ background: 'var(--color-bg-secondary)' }}>
        <h3>Account Information</h3>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
        <p><strong>Status:</strong> <span style={{ 
          color: user.status === 'active' ? '#34d399' : '#f87171',
          fontWeight: '600'
        }}>{user.status}</span></p>
      </div>

      {/* Personal Information */}
      <div className="card">
        <h3>Personal Information</h3>
        <form onSubmit={updateProfile}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>

          <label>Phone Number</label>
          <input
            type="tel"
            placeholder="+1234567890"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />

          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Country</label>
              <input
                type="text"
                placeholder="United States"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>City</label>
              <input
                type="text"
                placeholder="New York"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>

          <button type="submit">Save Personal Info</button>
          {success && <p className="success">{success}</p>}
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Academic Information */}
      <div className="card">
        <h3>Academic Information</h3>
        <form onSubmit={updateProfile}>
          <label>University *</label>
          <input
            type="text"
            placeholder="Harvard University"
            value={form.university}
            onChange={(e) => setForm({ ...form, university: e.target.value })}
            required
          />

          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Major</label>
              <input
                type="text"
                placeholder="Computer Science"
                value={form.major}
                onChange={(e) => setForm({ ...form, major: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>Graduation Year</label>
              <input
                type="number"
                placeholder="2025"
                min="2020"
                max="2030"
                value={form.graduationYear}
                onChange={(e) => setForm({ ...form, graduationYear: e.target.value })}
              />
            </div>
          </div>

          <label>Dietary Restrictions</label>
          <input
            type="text"
            placeholder="e.g., Vegetarian, Vegan, None, Nut allergy, etc."
            value={form.dietaryRestrictions}
            onChange={(e) => setForm({ ...form, dietaryRestrictions: e.target.value })}
          />

          <button type="submit">Save Academic Info</button>
          {success && <p className="success">{success}</p>}
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Social Links */}
      <div className="card">
        <h3>Social Links</h3>
        <form onSubmit={updateProfile}>
          <label>GitHub URL</label>
          <input
            type="url"
            placeholder="https://github.com/username"
            value={form.githubUrl}
            onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
          />

          <label>LinkedIn URL</label>
          <input
            type="url"
            placeholder="https://linkedin.com/in/username"
            value={form.linkedinUrl}
            onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
          />

          <label>Portfolio URL</label>
          <input
            type="url"
            placeholder="https://yourportfolio.com"
            value={form.portfolioUrl}
            onChange={(e) => setForm({ ...form, portfolioUrl: e.target.value })}
          />

          <button type="submit">Save Social Links</button>
          {success && <p className="success">{success}</p>}
          {error && <p className="error">{error}</p>}
        </form>
      </div>

      {/* Password Change */}
      <div className="card">
        <h3>Change Password</h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
          {user.password_hash ? 'Update your password' : 'Set a password for email/password login (OAuth users)'}
        </p>
        <form onSubmit={updatePassword}>
          <label>New Password</label>
          <input
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
          />
          <button type="submit" disabled={password.length < 8}>
            {user.password_hash ? 'Update Password' : 'Set Password'}
          </button>
          {passwordMsg && (
            <p className={passwordMsg.includes('success') ? 'success' : 'error'}>
              {passwordMsg}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
