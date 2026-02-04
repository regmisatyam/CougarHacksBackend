import { useEffect, useState } from 'react';
import { api } from '../api/http';

export default function AdminPage() {
  const [hackathons, setHackathons] = useState([]);
  const [hackathonId, setHackathonId] = useState('');
  const [registrations, setRegistrations] = useState([]);
  const [regStatusFilter, setRegStatusFilter] = useState('all');
  const [regSearchTerm, setRegSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [userStatusFilter, setUserStatusFilter] = useState('active');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const hs = await api('/hackathons');
      setHackathons(hs.hackathons || []);
      const selected = hackathonId || hs.hackathons?.[0]?.id || '';
      setHackathonId(selected);

      if (selected) {
        const statusQuery = regStatusFilter === 'all' ? '' : `&status=${regStatusFilter}`;
        const regs = await api(`/admin/registrations?hackathonId=${selected}${statusQuery}`);
        setRegistrations(regs.registrations || []);
      }

      const us = await api(`/admin/users?status=${userStatusFilter}`);
      setUsers(us.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [hackathonId, regStatusFilter, userStatusFilter]);

  const changeStatus = async (registrationId, decision) => {
    try {
      const response = await api('/admin/registrations/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          registrationId: registrationId, 
          decision: decision, 
          reason: `Changed to ${decision} by admin` 
        }),
      });
      await load();
    } catch (err) {
      console.error('Change status error:', err);
      setError(err.message || 'Failed to change status');
    }
  };

  const block = async (userId) => {
    try {
      await api('/admin/users/block', {
        method: 'POST',
        body: JSON.stringify({ userId, reason: 'Blocked by admin' }),
      });
      await load();
    } catch (err) {
      setError(err.message || 'Failed to block user');
    }
  };

  // Filter registrations based on search term
  const filteredRegistrations = registrations.filter((r) =>
    r.email.toLowerCase().includes(regSearchTerm.toLowerCase())
  );

  // Filter users based on search term
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const unblock = async (userId) => {
    try {
      await api('/admin/users/unblock', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const adminStyles = {
    container: {
      padding: '1rem',
      fontSize: '0.9rem',
    },
    header: {
      fontSize: '1.5rem',
      marginBottom: '1rem',
      borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
      paddingBottom: '0.5rem',
    },
    section: {
      background: 'rgba(30, 41, 59, 0.3)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '0.5rem',
      padding: '1rem',
      marginBottom: '1rem',
    },
    sectionTitle: {
      fontSize: '1.1rem',
      marginBottom: '0.75rem',
      color: '#ef4444',
    },
    filters: {
      display: 'flex',
      gap: '1rem',
      marginBottom: '1rem',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    filterGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
    },
    label: {
      fontSize: '0.8rem',
      fontWeight: '500',
      marginBottom: '0.25rem',
    },
    select: {
      padding: '0.4rem 0.6rem',
      fontSize: '0.85rem',
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.3)',
      borderRadius: '0.375rem',
      color: '#fff',
      minWidth: '150px',
    },
    input: {
      padding: '0.4rem 0.6rem',
      fontSize: '0.85rem',
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.3)',
      borderRadius: '0.375rem',
      color: '#fff',
      minWidth: '200px',
    },
    button: {
      padding: '0.35rem 0.7rem',
      fontSize: '0.75rem',
      background: '#ef4444',
      color: '#fff',
      border: 'none',
      borderRadius: '0.25rem',
      cursor: 'pointer',
      fontWeight: '500',
      textTransform: 'none',
      letterSpacing: 'normal',
    },
    buttonSecondary: {
      padding: '0.35rem 0.7rem',
      fontSize: '0.75rem',
      background: 'rgba(148, 163, 184, 0.3)',
      color: '#fff',
      border: '1px solid rgba(148, 163, 184, 0.4)',
      borderRadius: '0.25rem',
      cursor: 'pointer',
      fontWeight: '500',
      textTransform: 'none',
      letterSpacing: 'normal',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    row: {
      borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
      padding: '0.5rem 0',
    },
    cell: {
      padding: '0.5rem',
      verticalAlign: 'middle',
    },
    email: {
      fontWeight: '500',
    },
    status: {
      display: 'inline-block',
      padding: '0.2rem 0.5rem',
      borderRadius: '0.25rem',
      fontSize: '0.75rem',
      fontWeight: '600',
      marginLeft: '0.5rem',
    },
    buttonGroup: {
      display: 'flex',
      gap: '0.25rem',
      flexWrap: 'wrap',
    },
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: { bg: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' },
      accepted: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
      rejected: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' },
      waitlisted: { bg: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' },
      cancelled: { bg: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' },
      active: { bg: 'rgba(16, 185, 129, 0.2)', color: '#34d399' },
      blocked: { bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' },
    };
    return colors[status] || { bg: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' };
  };

  return (
    <div style={adminStyles.container}>
      <h2 style={adminStyles.header}>Admin Panel</h2>
      {error && <p className="error">{error}</p>}

      <div style={adminStyles.section}>
        <h3 style={adminStyles.sectionTitle}>Registrations Management</h3>
        
        <div style={adminStyles.filters}>
          <div style={adminStyles.filterGroup}>
            <label style={adminStyles.label}>Hackathon</label>
            <select style={adminStyles.select} value={hackathonId} onChange={(e) => setHackathonId(e.target.value)}>
              <option value="">Select hackathon</option>
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <div style={adminStyles.filterGroup}>
            <label style={adminStyles.label}>Status Filter</label>
            <select style={adminStyles.select} value={regStatusFilter} onChange={(e) => setRegStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div style={adminStyles.filterGroup}>
            <label style={adminStyles.label}>Search Email</label>
            <input
              type="text"
              style={adminStyles.input}
              placeholder="Search by email..."
              value={regSearchTerm}
              onChange={(e) => setRegSearchTerm(e.target.value)}
            />
          </div>

          <button style={{...adminStyles.buttonSecondary, marginTop: '1.2rem'}} onClick={load}>Refresh</button>
        </div>

        <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem'}}>
          Showing {filteredRegistrations.length} of {registrations.length} registrations
        </div>

        <table style={adminStyles.table}>
          <thead>
            <tr>
              <th style={{...adminStyles.cell, textAlign: 'left'}}>Email</th>
              <th style={{...adminStyles.cell, textAlign: 'left'}}>Status</th>
              <th style={{...adminStyles.cell, textAlign: 'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRegistrations.length === 0 ? (
              <tr>
                <td colSpan="3" style={{...adminStyles.cell, textAlign: 'center', color: '#94a3b8'}}>
                  {registrations.length === 0 ? 'No registrations found' : 'No matching registrations'}
                </td>
              </tr>
            ) : (
              filteredRegistrations.map((r) => {
                const statusStyle = getStatusColor(r.status);
                return (
                  <tr key={r.id} style={adminStyles.row}>
                    <td style={adminStyles.cell}>
                      <span style={adminStyles.email}>{r.email}</span>
                    </td>
                    <td style={adminStyles.cell}>
                      <span style={{...adminStyles.status, background: statusStyle.bg, color: statusStyle.color}}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{...adminStyles.cell, textAlign: 'right'}}>
                      <div style={adminStyles.buttonGroup}>
                        {r.status !== 'accepted' && (
                          <button style={adminStyles.button} onClick={() => changeStatus(r.id, 'accepted')}>Accept</button>
                        )}
                        {r.status !== 'pending' && (
                          <button style={adminStyles.button} onClick={() => changeStatus(r.id, 'pending')}>Pending</button>
                        )}
                        {r.status !== 'rejected' && (
                          <button style={adminStyles.button} onClick={() => changeStatus(r.id, 'rejected')}>Reject</button>
                        )}
                        {r.status !== 'waitlisted' && (
                          <button style={adminStyles.button} onClick={() => changeStatus(r.id, 'waitlisted')}>Waitlist</button>
                        )}
                        {r.status !== 'cancelled' && (
                          <button style={adminStyles.button} onClick={() => changeStatus(r.id, 'cancelled')}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={adminStyles.section}>
        <h3 style={adminStyles.sectionTitle}>User Management</h3>
        
        <div style={adminStyles.filters}>
          <div style={adminStyles.filterGroup}>
            <label style={adminStyles.label}>User Status</label>
            <select style={adminStyles.select} value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)}>
              <option value="active">Active Users</option>
              <option value="blocked">Blocked Users</option>
            </select>
          </div>

          <div style={adminStyles.filterGroup}>
            <label style={adminStyles.label}>Search Email</label>
            <input
              type="text"
              style={adminStyles.input}
              placeholder="Search by email..."
              value={userSearchTerm}
              onChange={(e) => setUserSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem'}}>
          Showing {filteredUsers.length} of {users.length} users
        </div>

        <table style={adminStyles.table}>
          <thead>
            <tr>
              <th style={{...adminStyles.cell, textAlign: 'left'}}>Email</th>
              <th style={{...adminStyles.cell, textAlign: 'left'}}>Role</th>
              <th style={{...adminStyles.cell, textAlign: 'left'}}>Status</th>
              <th style={{...adminStyles.cell, textAlign: 'right'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="4" style={{...adminStyles.cell, textAlign: 'center', color: '#94a3b8'}}>
                  {users.length === 0 ? 'No users found' : 'No matching users'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const statusStyle = getStatusColor(u.status);
                return (
                  <tr key={u.id} style={adminStyles.row}>
                    <td style={adminStyles.cell}>
                      <span style={adminStyles.email}>{u.email}</span>
                    </td>
                    <td style={adminStyles.cell}>{u.role}</td>
                    <td style={adminStyles.cell}>
                      <span style={{...adminStyles.status, background: statusStyle.bg, color: statusStyle.color}}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{...adminStyles.cell, textAlign: 'right'}}>
                      {u.role === 'organizer' ? (
                        <span style={{fontSize: '0.75rem', color: '#94a3b8'}}>Protected</span>
                      ) : u.status === 'active' ? (
                        <button style={adminStyles.button} onClick={() => block(u.id)}>Block User</button>
                      ) : (
                        <button style={{...adminStyles.button, background: '#10b981'}} onClick={() => unblock(u.id)}>Unblock User</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
