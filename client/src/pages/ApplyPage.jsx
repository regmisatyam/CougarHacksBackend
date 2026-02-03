import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';

export default function ApplyPage() {
  const navigate = useNavigate();
  const { user, profileComplete } = useAuth();
  const [hackathons, setHackathons] = useState([]);
  const [registration, setRegistration] = useState(null);
  const [selectedHackathon, setSelectedHackathon] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileComplete) {
      navigate('/complete-profile');
      return;
    }
    loadData();
  }, [profileComplete]);

  const loadData = async () => {
    try {
      // Load hackathons
      const hackData = await api('/hackathons');
      setHackathons(hackData.hackathons || []);

      // Load user's registration
      try {
        const regData = await api('/registrations/me');
        setRegistration(regData.registration);
        if (regData.registration) {
          setSelectedHackathon(regData.registration.hackathon_id);
        } else if (hackData.hackathons?.[0]) {
          setSelectedHackathon(hackData.hackathons[0].id);
        }
      } catch {
        // No registration yet
        if (hackData.hackathons?.[0]) {
          setSelectedHackathon(hackData.hackathons[0].id);
        }
      }
    } catch (err) {
      setError('Failed to load hackathons');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!selectedHackathon) {
      setError('Please select a hackathon');
      return;
    }

    try {
      const data = await api('/registrations/apply', {
        method: 'POST',
        body: JSON.stringify({ hackathonId: selectedHackathon }),
      });
      setRegistration(data.registration);
      setMessage('Application submitted successfully!');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p>Loading...</p>
      </section>
    );
  }

  if (registration) {
    const hackathon = hackathons.find(h => h.id === registration.hackathon_id);
    
    return (
      <section className="card">
        <h2>Your Application</h2>
        
        <div className="card" style={{ background: 'var(--color-bg-secondary)' }}>
          <h3>{hackathon?.name || 'Hackathon'}</h3>
          <p><strong>Status:</strong> <span style={{
            color: registration.status === 'accepted' ? '#34d399' : 
                   registration.status === 'rejected' ? '#f87171' : '#fbbf24',
            fontWeight: '600'
          }}>{registration.status}</span></p>
          <p><strong>Applied:</strong> {new Date(registration.created_at).toLocaleDateString()}</p>
          {hackathon && (
            <>
              <p><strong>Start:</strong> {new Date(hackathon.start_at).toLocaleDateString()}</p>
              <p><strong>End:</strong> {new Date(hackathon.end_at).toLocaleDateString()}</p>
              {hackathon.description && <p>{hackathon.description}</p>}
            </>
          )}
        </div>

        {registration.status === 'pending' && (
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '1rem' }}>
            Your application is under review. You'll be notified once a decision is made.
          </p>
        )}

        {registration.status === 'accepted' && (
          <div className="card" style={{ 
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <p style={{ color: '#34d399', fontWeight: '600', margin: 0 }}>
              🎉 Congratulations! You've been accepted to this hackathon!
            </p>
            <button onClick={() => navigate('/team')} style={{ marginTop: '1rem' }}>
              Manage Your Team →
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Apply to Hackathon</h2>
      <p>Choose a hackathon to apply to and submit your application.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Select Hackathon <span className="required">*</span>
        </label>
        <select
          value={selectedHackathon}
          onChange={(e) => setSelectedHackathon(e.target.value)}
          required
        >
          <option value="">Choose a hackathon...</option>
          {hackathons.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} - {new Date(h.start_at).toLocaleDateString()} to {new Date(h.end_at).toLocaleDateString()}
            </option>
          ))}
        </select>

        {selectedHackathon && (
          <div className="card" style={{ background: 'var(--color-bg-secondary)', marginTop: '1rem' }}>
            {hackathons.find(h => h.id === selectedHackathon)?.description && (
              <p>{hackathons.find(h => h.id === selectedHackathon).description}</p>
            )}
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: 0 }}>
              <strong>Important:</strong> Make sure all your profile information is accurate before applying.
            </p>
          </div>
        )}

        <button type="submit" style={{ marginTop: '1.5rem' }}>
          Submit Application
        </button>
      </form>

      {message && <p className="success" style={{ marginTop: '1rem' }}>{message}</p>}
      {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
    </section>
  );
}
