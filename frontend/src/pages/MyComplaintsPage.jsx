import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { ComplaintCard } from '../components/ComplaintCard';
import { Icon } from '../components/Icon';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'resolved', label: 'Resolved' },
];

export function MyComplaintsPage() {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate('/login');
    else if (isLoggedIn) {
      api.get('/complaints/my')
        .then((d) => setComplaints([...d].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))))
        .catch(() => { setError('Could not load your reports.'); setComplaints([]); });
    }
  }, [isLoggedIn, authLoading, navigate]);

  const shown = (complaints || []).filter((c) =>
    filter === 'all' ? true : filter === 'resolved' ? c.status === 'resolved' : c.status !== 'resolved');

  return (
    <div className="shell">
      <header className="page-head row">
        <div>
          <span className="eyebrow">My reports</span>
          <h1>Your reports</h1>
          <p className="muted">{complaints ? `${complaints.length} report${complaints.length === 1 ? '' : 's'} filed` : 'Loading…'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/')}><Icon name="plus" size={18} /> New report</button>
      </header>

      {complaints?.length > 0 && (
        <div className="segmented" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {error && <div className="notice error"><Icon name="alert" /><div>{error}</div></div>}

      {complaints === null ? (
        <div className="cards">
          {[0, 1, 2].map((i) => <div key={i} className="panel"><div className="skeleton" style={{ height: 120 }} /><div className="skeleton" style={{ height: 14, marginTop: 14, width: '70%' }} /></div>)}
        </div>
      ) : complaints.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Icon name="file" size={26} /></div>
          <h3>No reports yet</h3>
          <p className="muted">Seen a pothole, garbage pile or broken streetlight? Report it in under a minute.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>Report an issue</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty small"><p className="muted">Nothing here.</p></div>
      ) : (
        <div className="cards">
          {shown.map((c) => (
            <ComplaintCard key={c.ticket_id} complaint={c} onClick={() => navigate(`/track/${c.ticket_id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}
