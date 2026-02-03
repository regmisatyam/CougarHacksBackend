import { useEffect, useState } from 'react';
import { api } from '../api/http';
import { useAuth } from '../context/AuthContext';

export default function TeamPage() {
  const { user } = useAuth();
  const [hackathons, setHackathons] = useState([]);
  const [hackathonId, setHackathonId] = useState('');
  const [teamData, setTeamData] = useState({ team: null, members: [], invites: [] });
  const [myInvites, setMyInvites] = useState([]);
  const [createName, setCreateName] = useState('');
  const [createPublic, setCreatePublic] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [registration, setRegistration] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [showAvailableTeams, setShowAvailableTeams] = useState(false);

  const loadTeam = async (id) => {
    if (!id) return;
    try {
      const data = await api(`/teams/me?hackathonId=${id}`);
      setTeamData(data);
    } catch {
      setTeamData({ team: null, members: [], invites: [] });
    }
  };

  const loadMyInvites = async () => {
    try {
      const data = await api('/teams/invites/me');
      setMyInvites(data.invites || []);
    } catch {
      setMyInvites([]);
    }
  };

  const loadRegistration = async (id) => {
    if (!id) return;
    try {
      const data = await api(`/registrations/me?hackathonId=${id}`);
      setRegistration(data.registration || null);
    } catch {
      setRegistration(null);
    }
  };

  const loadAvailableTeams = async (id) => {
    if (!id) return;
    try {
      const data = await api(`/teams/available?hackathonId=${id}`);
      setAvailableTeams(data.teams || []);
    } catch {
      setAvailableTeams([]);
    }
  };

  useEffect(() => {
    (async () => {
      const data = await api('/hackathons');
      setHackathons(data.hackathons || []);
      
      // Try to get user's active hackathon
      try {
        const userData = await api('/auth/me');
        const activeHackathonId = userData.user?.active_hackathon_id;
        if (activeHackathonId) {
          setHackathonId(activeHackathonId);
        } else if (data.hackathons?.[0]) {
          setHackathonId(data.hackathons[0].id);
        }
      } catch {
        if (data.hackathons?.[0]) setHackathonId(data.hackathons[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    loadTeam(hackathonId);
    loadRegistration(hackathonId);
    loadAvailableTeams(hackathonId);
  }, [hackathonId]);

  useEffect(() => {
    loadMyInvites();
  }, []);

  const handle = async (fn) => {
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage('Success');
      await loadTeam(hackathonId);
      await loadMyInvites();
      await loadAvailableTeams(hackathonId);
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedHackathon = hackathons.find(h => h.id === hackathonId);
  const isAccepted = registration && registration.status === 'accepted';
  const maxTeamSize = selectedHackathon?.max_team_size || 4;
  const isLeader = teamData.members?.some(m => m.user_id === user?.id && m.role === 'leader');

  const togglePublic = async (isPublic) => {
    setError('');
    setMessage('');
    
    // Show confirmation dialog when making team public
    if (isPublic) {
      const confirmed = window.confirm(
        '⚠️ Make Team Public?\n\n' +
        'If you make this team public:\n' +
        '• Anyone can join your team without a code\n' +
        '• Your team will appear in the public teams list\n' +
        '• You can change it back to private anytime\n\n' +
        'Do you want to continue?'
      );
      
      if (!confirmed) {
        return; // User cancelled
      }
    }
    
    try {
      await api('/teams/toggle-public', {
        method: 'POST',
        body: JSON.stringify({ teamId: teamData.team.id, isPublic }),
      });
      setMessage(`Team is now ${isPublic ? 'public' : 'private'}`);
      await loadTeam(hackathonId);
    } catch (err) {
      setError(err.message);
    }
  };

  const joinPublicTeam = async (teamId) => {
    setError('');
    setMessage('');
    try {
      await api('/teams/join-by-id', {
        method: 'POST',
        body: JSON.stringify({ teamId }),
      });
      setMessage('Successfully joined team!');
      await loadTeam(hackathonId);
      await loadAvailableTeams(hackathonId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2>Team Management</h2>
      <label>
        Hackathon
        <select value={hackathonId} onChange={(e) => setHackathonId(e.target.value)}>
          <option value="">Select hackathon</option>
          {hackathons.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </label>

      {/* Registration Status Message */}
      {hackathonId && registration && (
        <div className="card" style={{ 
          marginTop: '1rem',
          backgroundColor: registration.status === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : 
                          registration.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.15)',
          border: `2px solid ${registration.status === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : 
                                registration.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.15)'}`
        }}>
          <p style={{ margin: 0 }}>
            <strong>Registration Status:</strong> <span style={{ color: registration.status === 'accepted' ? '#16a34a' : registration.status === 'rejected' ? '#dc2626' : '#f59e0b' }}>{registration.status}</span> 
            {!isAccepted && <span style={{ color: '#dc2626' }}> - You must be accepted before you can create or join a team.</span>}
          </p>
        </div>
      )}

      {!teamData.team ? (
        <>
          {isAccepted && (
            <div className="card" style={{ marginTop: '1rem', backgroundColor: '#f0f9ff', border: '1px solid #0369a1' }}>
              <p style={{ margin: 0, color: '#0369a1' }}>
                You can create a team (as team leader) or join an existing team. Teams can have up to {maxTeamSize} members. 
                You can also skip this for now and join a team later.
              </p>
            </div>
          )}

          <div className="card">
            <h3>Create Team (Become Team Leader)</h3>
            <p>Create a new team and invite up to {maxTeamSize - 1} other members to join.</p>
            <input 
              placeholder="Team name" 
              value={createName} 
              onChange={(e) => setCreateName(e.target.value)} 
              disabled={!isAccepted}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input 
                type="checkbox"
                checked={createPublic}
                onChange={(e) => setCreatePublic(e.target.checked)}
                disabled={!isAccepted}
              />
              <span>🌐 Make team public (anyone can join)</span>
            </label>
            {createPublic && (
              <p style={{ color: '#0369a1', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Public teams appear in the browse list and can be joined by anyone without a code.
              </p>
            )}
            <button 
              onClick={() => handle(() => api('/teams/create', { method: 'POST', body: JSON.stringify({ hackathonId, name: createName, isPublic: createPublic }) }))}
              disabled={!isAccepted || !createName.trim()}
            >
              Create Team
            </button>
            {!isAccepted && <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>You must be accepted to create a team.</p>}
          </div>

          <div className="card">
            <h3>Join Private Team with Code</h3>
            <p>Have a team code from a private team? Enter it here to join.</p>
            <input 
              placeholder="Team code (e.g., A1B2C3D4)" 
              value={joinCode} 
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
              disabled={!isAccepted}
            />
            <button 
              onClick={() => handle(() => api('/teams/join', { method: 'POST', body: JSON.stringify({ teamCode: joinCode }) }))}
              disabled={!isAccepted || !joinCode.trim()}
            >
              Join Team
            </button>
            {!isAccepted && <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>You must be accepted to join a team.</p>}
          </div>

          <div className="card">
            <h3>Browse Public Teams</h3>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0.5rem 0' }}>
              Public teams are open for anyone to join. Private teams require a code.
            </p>
            <button onClick={() => {
              setShowAvailableTeams(!showAvailableTeams);
              if (!showAvailableTeams) loadAvailableTeams(hackathonId);
            }}>
              {showAvailableTeams ? 'Hide' : 'Show'} Public Teams
            </button>
            {showAvailableTeams && (
              <div style={{ marginTop: '1rem' }}>
                {availableTeams.filter(team => team.is_public).length === 0 ? (
                  <p>No public teams available yet. Create a public team or join using a code!</p>
                ) : (
                  <div>
                    {availableTeams.filter(team => team.is_public).map((team) => (
                      <div key={team.id} style={{ 
                        padding: '0.75rem', 
                        border: team.is_public ? '2px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: team.is_public ? 'rgba(16, 185, 129, 0.15)' : 'transparent'
                      }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <strong>{team.name}</strong>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: '#10b981', 
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontWeight: 'bold'
                            }}>
                              🌐 PUBLIC
                            </span>
                          </div>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#6b7280' }}>
                            Members: {team.member_count}/{maxTeamSize}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => joinPublicTeam(team.id)}
                            disabled={!isAccepted}
                            style={{ 
                              minWidth: '80px',
                              backgroundColor: '#10b981',
                              color: 'white',
                              fontWeight: 'bold'
                            }}
                          >
                            Join Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="card" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '2px solid rgba(16, 185, 129, 0.15)' }}>
            <h3 style={{ color: '#16a34a', marginTop: 0 }}>Your Team</h3>
            <p style={{ fontSize: '1.1rem', margin: '0.5rem 0' }}>
              <strong>{teamData.team.name}</strong>
            </p>
            <p style={{ margin: '0.5rem 0' }}>
              Team Code: <code style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.1)', 
                padding: '4px 8px', 
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}>{teamData.team.team_code}</code>
            </p>
            <div style={{ 
              margin: '0.75rem 0',
              padding: '0.5rem',
              backgroundColor: teamData.team.is_public ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              borderRadius: '4px',
              border: `1px solid ${teamData.team.is_public ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                {teamData.team.is_public ? (
                  <>🌐 <strong>Public Team:</strong> Anyone can join without a code</>
                ) : (
                  <>🔒 <strong>Private Team:</strong> Share the code above to invite members</>
                )}
              </p>
            </div>
            {isLeader && (
              <div style={{ marginTop: '0.75rem' }}>
                <button 
                  onClick={() => togglePublic(!teamData.team.is_public)}
                  style={{ 
                    backgroundColor: teamData.team.is_public ? '#f59e0b' : '#10b981',
                    color: 'white',
                    fontSize: '0.9rem'
                  }}
                >
                  {teamData.team.is_public ? 'Make Private' : 'Make Public'}
                </button>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Team Members ({teamData.members.length}/{maxTeamSize})</h3>
            {teamData.members.map((m) => (
              <div key={m.user_id} style={{ 
                padding: '0.5rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>
                  {m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.email}
                </span>
                <span style={{ 
                  fontWeight: m.role === 'leader' ? 'bold' : 'normal',
                  color: m.role === 'leader' ? '#0369a1' : '#6b7280'
                }}>
                  {m.role === 'leader' ? '👑 Leader' : 'Member'}
                </span>
              </div>
            ))}
          </div>

          {isLeader && (
            <div className="card">
              <h3>Share Team Code (Leader only)</h3>
              <p>Share this code with your team members so they can join.</p>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                background: 'var(--color-bg-secondary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem'
              }}>
                <code style={{ 
                  flex: 1,
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'var(--color-primary-light)',
                  letterSpacing: '0.1em',
                  textAlign: 'center'
                }}>
                  {teamData.team.team_code}
                </code>
              </div>
              
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(teamData.team.team_code);
                  setMessage('Team code copied to clipboard! Share it with your team members.');
                  setTimeout(() => setMessage(''), 3000);
                }}
                disabled={teamData.members.length >= maxTeamSize}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  width: '100%'
                }}
              >
                📋 Copy Team Code
              </button>
              
              {teamData.members.length >= maxTeamSize && (
                <p style={{ color: '#dc2626', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  Team is full ({maxTeamSize}/{maxTeamSize} members).
                </p>
              )}
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button 
              onClick={() => handle(() => api('/teams/leave', { method: 'POST', body: JSON.stringify({ hackathonId }) }))}
              style={{ backgroundColor: '#dc2626', color: 'white' }}
            >
              Leave Team
            </button>
          </div>
        </>
      )}

      <div className="card">
        <h3>My Pending Invites</h3>
        {myInvites.length === 0 && <p>No pending invites</p>}
        {myInvites.map((invite) => (
          <div key={invite.id} className="row">
            <span>{invite.team_name} ({invite.team_code})</span>
            <button onClick={() => handle(() => api('/teams/invite/respond', { method: 'POST', body: JSON.stringify({ inviteId: invite.id, action: 'accept' }) }))}>Accept</button>
            <button onClick={() => handle(() => api('/teams/invite/respond', { method: 'POST', body: JSON.stringify({ inviteId: invite.id, action: 'decline' }) }))}>Decline</button>
          </div>
        ))}
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
