import { useEffect, useState } from 'react';
import { api } from '../api/http';

export default function AdminPage() {
  const [hackathons, setHackathons] = useState([]);
  const [hackathonId, setHackathonId] = useState('');
  const [pendingRegs, setPendingRegs] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const hs = await api('/hackathons');
      setHackathons(hs.hackathons || []);
      const selected = hackathonId || hs.hackathons?.[0]?.id || '';
      setHackathonId(selected);

      if (selected) {
        const regs = await api(`/admin/registrations?hackathonId=${selected}&status=pending`);
        setPendingRegs(regs.registrations || []);
      }

      const us = await api(`/admin/users?status=${statusFilter}`);
      setUsers(us.users || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const decide = async (registrationId, decision) => {
    await api('/admin/registrations/decision', {
      method: 'POST',
      body: JSON.stringify({ registrationId, decision, reason: `${decision} by admin` }),
    });
    await load();
  };

  const block = async (userId) => {
    await api('/admin/users/block', {
      method: 'POST',
      body: JSON.stringify({ userId, reason: 'Blocked by admin' }),
    });
    await load();
  };

  const unblock = async (userId) => {
    await api('/admin/users/unblock', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    await load();
  };

  return (
    <section className="card">
      <h2>Admin</h2>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>Pending Registrations</h3>
        <label>
          Hackathon
          <select value={hackathonId} onChange={(e) => setHackathonId(e.target.value)}>
            <option value="">Select hackathon</option>
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>
        <button onClick={load}>Refresh</button>
        {pendingRegs.map((r) => (
          <div key={r.id} className="row">
            <span>{r.email}</span>
            <button onClick={() => decide(r.id, 'accepted')}>Accept</button>
            <button onClick={() => decide(r.id, 'rejected')}>Reject</button>
            <button onClick={() => decide(r.id, 'waitlisted')}>Waitlist</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Users</h3>
        <label>
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </label>
        {users.map((u) => (
          <div key={u.id} className="row">
            <span>{u.email} ({u.role}/{u.status})</span>
            {u.status === 'active' ? (
              <button onClick={() => block(u.id)}>Block</button>
            ) : (
              <button onClick={() => unblock(u.id)}>Unblock</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
