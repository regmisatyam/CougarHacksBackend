import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hackathons, setHackathons] = useState([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState('');
  const [registration, setRegistration] = useState(null);
  const [team, setTeam] = useState(null);
  const [applyMsg, setApplyMsg] = useState('');
  const [applyError, setApplyError] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    (async () => {
      const data = await api('/hackathons');
      setHackathons(data.hackathons || []);
      
      // Get user's active hackathon from profile
      try {
        const userData = await api('/auth/me');
        const activeHackathonId = userData.user?.active_hackathon_id;
        if (activeHackathonId) {
          setSelectedHackathonId(activeHackathonId);
        } else if (data.hackathons?.[0]) {
          setSelectedHackathonId(data.hackathons[0].id);
        }
      } catch {
        if (data.hackathons?.[0]) setSelectedHackathonId(data.hackathons[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedHackathonId) return;
    (async () => {
      try {
        const reg = await api(`/registrations/me?hackathonId=${selectedHackathonId}`);
        setRegistration(reg.registration || null);
      } catch {
        setRegistration(null);
      }

      try {
        const tm = await api(`/teams/me?hackathonId=${selectedHackathonId}`);
        setTeam(tm.team || null);
        setTeamMembers(tm.members || []);
      } catch {
        setTeam(null);
        setTeamMembers([]);
      }
    })();
  }, [selectedHackathonId]);

  const handleHackathonChange = async (newHackathonId) => {
    setSelectedHackathonId(newHackathonId);
    // Save the new active hackathon to user's profile
    try {
      await api('/profile/set-active-hackathon', {
        method: 'POST',
        body: JSON.stringify({ hackathonId: newHackathonId }),
      });
    } catch (err) {
      console.error('Failed to save active hackathon:', err);
    }
  };

  const applyToHackathon = async () => {
    setApplyMsg('');
    setApplyError('');
    setLoading(true);
    
    try {
      await api('/registrations/apply', {
        method: 'POST',
        body: JSON.stringify({ hackathonId: selectedHackathonId }),
      });
      setApplyMsg('Application submitted successfully! Status: pending');
      
      // Refresh registration status
      const reg = await api(`/registrations/me?hackathonId=${selectedHackathonId}`);
      setRegistration(reg.registration || null);
    } catch (err) {
      setApplyError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedHackathon = hackathons.find(h => h.id === selectedHackathonId);
  const isRegistered = registration && registration.status !== 'cancelled';
  const canApply = selectedHackathonId && !isRegistered;
  const isAccepted = registration && registration.status === 'accepted';
  const needsTeam = isAccepted && !team;

  return (
    <section className="card">
      <h2>Dashboard</h2>
      <p>
        Signed in as <strong>{user.email}</strong> ({user.role}/{user.status})
      </p>

      {/* Team Formation Prompt for Accepted Users */}
      {needsTeam && (
        <div className="card" style={{ 
          marginTop: '1rem', 
          backgroundColor: '#fef3c7', 
          border: '2px solid #f59e0b',
          padding: '1rem'
        }}>
          <h3 style={{ color: '#92400e', marginTop: 0 }}>🎉 Congratulations! You've been accepted!</h3>
          <p style={{ color: '#78350f', marginBottom: '1rem' }}>
            You need to either <strong>create a team</strong> (as team leader) or <strong>join an existing team</strong> to participate. 
            Teams can have up to 4 members. You can also skip this for now and join a team later.
          </p>
          <button 
            onClick={() => navigate('/team')}
            style={{ 
              backgroundColor: '#f59e0b', 
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            Go to Team Management
          </button>
        </div>
      )}
      
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3>Active Hackathon</h3>
        <label>
          Select your hackathon:
          <select value={selectedHackathonId} onChange={(e) => handleHackathonChange(e.target.value)}>
            <option value="">Select hackathon</option>
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        
        {selectedHackathon && (
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Event:</strong> {selectedHackathon.name}</p>
            <p><strong>Dates:</strong> {new Date(selectedHackathon.start_at).toLocaleDateString()} - {new Date(selectedHackathon.end_at).toLocaleDateString()}</p>
            <p><strong>Registration:</strong> {registration ? <span style={{ color: registration.status === 'accepted' ? 'green' : registration.status === 'rejected' ? 'red' : 'orange' }}>{registration.status}</span> : 'not applied'}</p>
            <p><strong>Team:</strong> {team ? (
              <>
                {team.name} ({team.team_code}) - {teamMembers.length}/{selectedHackathon.max_team_size || 4} members
              </>
            ) : (
              isAccepted ? <span style={{ color: '#f59e0b' }}>⚠️ Not in a team yet</span> : 'no team'
            )}</p>
            
            {canApply && (
              <div style={{ marginTop: '1rem' }}>
                <button onClick={applyToHackathon} disabled={loading}>
                  {loading ? 'Applying...' : 'Apply to This Hackathon'}
                </button>
                {applyMsg && <p style={{ color: 'green', marginTop: '0.5rem' }}>{applyMsg}</p>}
                {applyError && <p style={{ color: 'red', marginTop: '0.5rem' }}>{applyError}</p>}
              </div>
            )}
            
            {isRegistered && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '4px' }}>
                <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.8)' }}>
                  ✓ You have already applied to this hackathon. Status: <strong>{registration.status}</strong>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </section>
  );
}
