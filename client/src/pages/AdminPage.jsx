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
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [selectedTeamToJoin, setSelectedTeamToJoin] = useState('');
  const [regCurrentPage, setRegCurrentPage] = useState(1);
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

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

  const loadUserDetails = async (userId) => {
    try {
      setError('');
      const data = await api(`/admin/users/${userId}`);
      setUserDetails(data);
      setSelectedUser(userId);
      
      // Load available teams for each hackathon the user is registered for
      if (data.registrations && data.registrations.length > 0) {
        const hackathonId = data.registrations[0].hackathon_id;
        const teamsData = await api(`/admin/teams/available/${hackathonId}`);
        setAvailableTeams(teamsData.teams || []);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const removeFromTeam = async (teamId, userId) => {
    if (!confirm('Are you sure you want to remove this user from the team?')) return;
    try {
      await api('/admin/teams/remove-member', {
        method: 'POST',
        body: JSON.stringify({ teamId, userId, reason: 'Removed by admin' }),
      });
      await loadUserDetails(userId);
    } catch (err) {
      setError(err.message);
    }
  };

  const addToTeam = async (userId) => {
    if (!selectedTeamToJoin) {
      setError('Please select a team');
      return;
    }
    try {
      await api('/admin/teams/add-member', {
        method: 'POST',
        body: JSON.stringify({ teamId: selectedTeamToJoin, userId }),
      });
      await loadUserDetails(userId);
      setSelectedTeamToJoin('');
    } catch (err) {
      setError(err.message);
    }
  };

  const changeUserRole = async (userId, newRole) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) return;
    try {
      await api('/admin/users/change-role', {
        method: 'POST',
        body: JSON.stringify({ userId, role: newRole }),
      });
      await loadUserDetails(userId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const closeUserModal = () => {
    setSelectedUser(null);
    setUserDetails(null);
    setAvailableTeams([]);
    setSelectedTeamToJoin('');
  };

  // Filter registrations based on search term
  const filteredRegistrations = registrations.filter((r) =>
    r.email.toLowerCase().includes(regSearchTerm.toLowerCase())
  );

  // Filter users based on search term
  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  // Pagination for registrations
  const regTotalPages = Math.ceil(filteredRegistrations.length / ITEMS_PER_PAGE);
  const regStartIndex = (regCurrentPage - 1) * ITEMS_PER_PAGE;
  const regEndIndex = regStartIndex + ITEMS_PER_PAGE;
  const paginatedRegistrations = filteredRegistrations.slice(regStartIndex, regEndIndex);

  // Pagination for users
  const userTotalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const userStartIndex = (userCurrentPage - 1) * ITEMS_PER_PAGE;
  const userEndIndex = userStartIndex + ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(userStartIndex, userEndIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setRegCurrentPage(1);
  }, [regSearchTerm, regStatusFilter]);

  useEffect(() => {
    setUserCurrentPage(1);
  }, [userSearchTerm, userStatusFilter]);

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
      fontSize: '1rem',
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
      borderRadius: '50px',
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
      fontSize: '1rem',
      fontWeight: '500',
      marginBottom: '0.25rem',
    },
    select: {
      padding: '0.4rem 0.6rem',
      fontSize: '1.1rem',
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.3)',
      borderRadius: '50px',
      color: '#fff',
      minWidth: '150px',
    },
    input: {
      padding: '0.4rem 0.6rem',
      fontSize: '1.1rem',
      background: 'rgba(30, 41, 59, 0.5)',
      border: '1px solid rgba(148, 163, 184, 0.3)',
      borderRadius: '50px',
      color: '#fff',
      minWidth: '200px',
    },
    button: {
      padding: '0.35rem 0.7rem',
      fontSize: '1.1rem',
      background: '#ef4444',
      color: '#fff',
      border: 'none',
      borderRadius: '50px',
      cursor: 'pointer',
      fontWeight: '500',
      textTransform: 'none',
      letterSpacing: 'normal',
    },
    buttonSecondary: {
      padding: '0.35rem 0.7rem',
      fontSize: '1.1rem',
      background: 'rgba(148, 163, 184, 0.3)',
      color: '#fff',
      border: '1px solid rgba(148, 163, 184, 0.4)',
      borderRadius: '50px',
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
      borderRadius: '50px',
      fontSize: '1.1rem',
      fontWeight: '600',
      marginLeft: '0.5rem',
    },
    buttonGroup: {
      display: 'flex',
      gap: '0.25rem',
      flexWrap: 'wrap',
    },
    clickableRow: {
      cursor: 'pointer',
      transition: 'background 0.2s',
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    },
    modalContent: {
      background: 'rgba(30, 41, 59, 0.95)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(148, 163, 184, 0.3)',
      borderRadius: '50px',
      padding: '1.5rem',
      maxWidth: '800px',
      width: '100%',
      maxHeight: '90vh',
      overflowY: 'auto',
      position: 'relative',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '1rem',
      paddingBottom: '1rem',
      borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
    },
    modalTitle: {
      fontSize: '1.25rem',
      color: '#ef4444',
      margin: 0,
    },
    closeButton: {
      background: 'transparent',
      border: 'none',
      color: '#fff',
      fontSize: '1.5rem',
      cursor: 'pointer',
      padding: '0.25rem 0.5rem',
      lineHeight: 1,
    },
    detailSection: {
      marginBottom: '1.5rem',
    },
    detailTitle: {
      fontSize: '1rem',
      color: '#ef4444',
      marginBottom: '0.5rem',
      fontWeight: '600',
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: '150px 1fr',
      gap: '0.5rem',
      fontSize: '1rem',
    },
    detailLabel: {
      color: '#94a3b8',
      fontWeight: '500',
    },
    detailValue: {
      color: '#fff',
    },
    teamCard: {
      background: 'rgba(148, 163, 184, 0.1)',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      borderRadius: '50px',
      padding: '0.75rem',
      marginBottom: '0.5rem',
    },
    pagination: {
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '1rem',
      fontSize: '1.1rem',
    },
    paginationButton: {
      padding: '0.4rem 0.8rem',
      fontSize: '1rem',
      background: 'rgba(148, 163, 184, 0.3)',
      color: '#fff',
      border: '1px solid rgba(148, 163, 184, 0.4)',
      borderRadius: '50px',
      cursor: 'pointer',
      fontWeight: '500',
      textTransform: 'none',
      letterSpacing: 'normal',
    },
    paginationButtonActive: {
      background: '#ef4444',
      borderColor: '#ef4444',
    },
    paginationInfo: {
      color: '#94a3b8',
      padding: '0 0.5rem',
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

        <div style={{fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem'}}>
          Showing {regStartIndex + 1}-{Math.min(regEndIndex, filteredRegistrations.length)} of {filteredRegistrations.length} registrations
          {filteredRegistrations.length !== registrations.length && ` (filtered from ${registrations.length})`}
          • Click on email to view user details
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
            {paginatedRegistrations.length === 0 ? (
              <tr>
                <td colSpan="3" style={{...adminStyles.cell, textAlign: 'center', color: '#94a3b8'}}>
                  {registrations.length === 0 ? 'No registrations found' : 'No matching registrations'}
                </td>
              </tr>
            ) : (
              paginatedRegistrations.map((r) => {
                const statusStyle = getStatusColor(r.status);
                return (
                  <tr key={r.id} style={adminStyles.row}>
                    <td 
                      style={{...adminStyles.cell, cursor: 'pointer'}}
                      onClick={() => loadUserDetails(r.user_id)}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
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

        {regTotalPages > 1 && (
          <div style={adminStyles.pagination}>
            <button
              style={{...adminStyles.paginationButton, ...(regCurrentPage === 1 && {opacity: 0.5, cursor: 'not-allowed'})}}
              onClick={() => setRegCurrentPage(p => Math.max(1, p - 1))}
              disabled={regCurrentPage === 1}
            >
              Previous
            </button>
            {Array.from({ length: regTotalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                style={{
                  ...adminStyles.paginationButton,
                  ...(page === regCurrentPage && adminStyles.paginationButtonActive)
                }}
                onClick={() => setRegCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              style={{...adminStyles.paginationButton, ...(regCurrentPage === regTotalPages && {opacity: 0.5, cursor: 'not-allowed'})}}
              onClick={() => setRegCurrentPage(p => Math.min(regTotalPages, p + 1))}
              disabled={regCurrentPage === regTotalPages}
            >
              Next
            </button>
          </div>
        )}
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

        <div style={{fontSize: '1.1rem', color: '#94a3b8', marginBottom: '0.5rem'}}>
          Showing {userStartIndex + 1}-{Math.min(userEndIndex, filteredUsers.length)} of {filteredUsers.length} users
          {filteredUsers.length !== users.length && ` (filtered from ${users.length})`}
          • Click on a user to view details
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
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan="4" style={{...adminStyles.cell, textAlign: 'center', color: '#94a3b8'}}>
                  {users.length === 0 ? 'No users found' : 'No matching users'}
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => {
                const statusStyle = getStatusColor(u.status);
                return (
                  <tr 
                    key={u.id} 
                    style={{...adminStyles.row, ...adminStyles.clickableRow}}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={adminStyles.cell} onClick={() => loadUserDetails(u.id)}>
                      <span style={adminStyles.email}>{u.email}</span>
                    </td>
                    <td style={adminStyles.cell} onClick={() => loadUserDetails(u.id)}>{u.role}</td>
                    <td style={adminStyles.cell} onClick={() => loadUserDetails(u.id)}>
                      <span style={{...adminStyles.status, background: statusStyle.bg, color: statusStyle.color}}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{...adminStyles.cell, textAlign: 'right'}}>
                      {u.role === 'organizer' ? (
                        <span style={{fontSize: '0.85rem', color: '#94a3b8'}}>Protected</span>
                      ) : u.status === 'active' ? (
                        <button style={adminStyles.button} onClick={(e) => { e.stopPropagation(); block(u.id); }}>Block</button>
                      ) : (
                        <button style={{...adminStyles.button, background: '#10b981'}} onClick={(e) => { e.stopPropagation(); unblock(u.id); }}>Unblock</button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {userTotalPages > 1 && (
          <div style={adminStyles.pagination}>
            <button
              style={{...adminStyles.paginationButton, ...(userCurrentPage === 1 && {opacity: 0.5, cursor: 'not-allowed'})}}
              onClick={() => setUserCurrentPage(p => Math.max(1, p - 1))}
              disabled={userCurrentPage === 1}
            >
              Previous
            </button>
            {Array.from({ length: userTotalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                style={{
                  ...adminStyles.paginationButton,
                  ...(page === userCurrentPage && adminStyles.paginationButtonActive)
                }}
                onClick={() => setUserCurrentPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              style={{...adminStyles.paginationButton, ...(userCurrentPage === userTotalPages && {opacity: 0.5, cursor: 'not-allowed'})}}
              onClick={() => setUserCurrentPage(p => Math.min(userTotalPages, p + 1))}
              disabled={userCurrentPage === userTotalPages}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && userDetails && (
        <div style={adminStyles.modal} onClick={closeUserModal}>
          <div style={adminStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={adminStyles.modalHeader}>
              <h3 style={adminStyles.modalTitle}>User Details</h3>
              <button style={adminStyles.closeButton} onClick={closeUserModal}>&times;</button>
            </div>

            {error && <p className="error" style={{marginBottom: '1rem'}}>{error}</p>}

            {/* Basic Info */}
            <div style={adminStyles.detailSection}>
              <h4 style={adminStyles.detailTitle}>Basic Information</h4>
              <div style={adminStyles.detailGrid}>
                <span style={adminStyles.detailLabel}>Email:</span>
                <span style={adminStyles.detailValue}>{userDetails.user.email}</span>
                
                <span style={adminStyles.detailLabel}>Name:</span>
                <span style={adminStyles.detailValue}>
                  {userDetails.user.first_name} {userDetails.user.last_name}
                </span>
                
                <span style={adminStyles.detailLabel}>Role:</span>
                <span style={adminStyles.detailValue}>
                  {userDetails.user.role}
                  {userDetails.user.role !== 'organizer' && (
                    <>
                      {' '}
                      <button 
                        style={{...adminStyles.button, marginLeft: '0.5rem'}}
                        onClick={() => changeUserRole(userDetails.user.id, userDetails.user.role === 'participant' ? 'organizer' : 'participant')}
                      >
                        Make {userDetails.user.role === 'participant' ? 'Organizer' : 'Participant'}
                      </button>
                    </>
                  )}
                </span>
                
                <span style={adminStyles.detailLabel}>Status:</span>
                <span style={adminStyles.detailValue}>{userDetails.user.status}</span>
                
                {userDetails.user.phone && (
                  <>
                    <span style={adminStyles.detailLabel}>Phone:</span>
                    <span style={adminStyles.detailValue}>{userDetails.user.phone}</span>
                  </>
                )}
                
                {userDetails.user.university && (
                  <>
                    <span style={adminStyles.detailLabel}>University:</span>
                    <span style={adminStyles.detailValue}>{userDetails.user.university}</span>
                  </>
                )}
                
                {userDetails.user.major && (
                  <>
                    <span style={adminStyles.detailLabel}>Major:</span>
                    <span style={adminStyles.detailValue}>{userDetails.user.major}</span>
                  </>
                )}
                
                {userDetails.user.graduation_year && (
                  <>
                    <span style={adminStyles.detailLabel}>Graduation Year:</span>
                    <span style={adminStyles.detailValue}>{userDetails.user.graduation_year}</span>
                  </>
                )}
              </div>
            </div>

            {/* Registrations */}
            <div style={adminStyles.detailSection}>
              <h4 style={adminStyles.detailTitle}>Registrations ({userDetails.registrations.length})</h4>
              {userDetails.registrations.length === 0 ? (
                <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>No registrations</p>
              ) : (
                userDetails.registrations.map((reg) => (
                  <div key={reg.id} style={adminStyles.teamCard}>
                    <div><strong>{reg.hackathon_name}</strong></div>
                    <div style={{fontSize: '1.1rem', color: '#94a3b8'}}>
                      Status: <span style={{color: getStatusColor(reg.status).color}}>{reg.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Teams */}
            <div style={adminStyles.detailSection}>
              <h4 style={adminStyles.detailTitle}>Teams ({userDetails.teams.length})</h4>
              {userDetails.teams.length === 0 ? (
                <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>Not in any team</p>
              ) : (
                userDetails.teams.map((team) => (
                  <div key={team.team_id} style={adminStyles.teamCard}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <div><strong>{team.team_name}</strong></div>
                        <div style={{fontSize: '1.1rem', color: '#94a3b8'}}>
                          {team.hackathon_name} • Role: {team.role}
                        </div>
                      </div>
                      <button 
                        style={adminStyles.button}
                        onClick={() => removeFromTeam(team.team_id, userDetails.user.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add to Team */}
            {availableTeams.length > 0 && (
              <div style={adminStyles.detailSection}>
                <h4 style={adminStyles.detailTitle}>Add to Team</h4>
                <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                  <select 
                    style={{...adminStyles.select, flex: 1}}
                    value={selectedTeamToJoin}
                    onChange={(e) => setSelectedTeamToJoin(e.target.value)}
                  >
                    <option value="">Select a team...</option>
                    {availableTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.current_members}/{team.max_team_size}) {team.is_public ? '🌐' : '🔒'}
                      </option>
                    ))}
                  </select>
                  <button 
                    style={adminStyles.button}
                    onClick={() => addToTeam(userDetails.user.id)}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
