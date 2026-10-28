import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, assetUrl, categoryLabel } from '../utils/api';
import { PriorityBadge } from '../components/PriorityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { StatusTimeline } from '../components/StatusTimeline';
import { Icon } from '../components/Icon';

const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function TrackPage() {
  const { ticketId: paramTicketId } = useParams();
  const navigate = useNavigate();
  const [ticketId, setTicketId] = useState(paramTicketId || '');
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (paramTicketId) {
      setTicketId(paramTicketId);
      handleSearch(paramTicketId);
    }
  }, [paramTicketId]);

  const handleSearch = async (id = ticketId) => {
    if (!id.trim()) return;
    setLoading(true);
    setError('');
    setComplaint(null);
    try {
      setComplaint(await api.get(`/complaints/track/${id.trim().toUpperCase()}`));
    } catch (err) {
      setError(err.message || 'Ticket not found.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const id = ticketId.trim().toUpperCase();
    if (id && id !== paramTicketId) navigate(`/track/${id}`);
    else handleSearch(id);
  };

  const copy = () => {
    navigator.clipboard?.writeText(complaint.ticket_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="shell narrow">
      <header className="page-head">
        <span className="eyebrow">Track</span>
        <h1>Where is my report?</h1>
        <p className="muted">Enter the ticket ID you received after submitting.</p>
      </header>

      <form onSubmit={onSubmit} className="searchbar">
        <Icon name="search" size={20} />
        <input
          type="text"
          className="mono"
          placeholder="JS-2026-00001"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          aria-label="Ticket ID"
        />
        <button type="submit" className="btn btn-primary" disabled={!ticketId.trim() || loading}>
          {loading ? <span className="spin" /> : 'Track'}
        </button>
      </form>

      {loading && (
        <div className="panel">
          <div className="skeleton" style={{ width: '40%', height: 22 }} />
          <div className="skeleton" style={{ width: '90%', height: 14, marginTop: 18 }} />
          <div className="skeleton" style={{ width: '70%', height: 14, marginTop: 10 }} />
          <div className="skeleton" style={{ width: '100%', height: 90, marginTop: 24 }} />
        </div>
      )}

      {error && (
        <div className="empty">
          <div className="empty-icon"><Icon name="search" size={26} /></div>
          <h3>No report with that ID</h3>
          <p className="muted">Check the ID — it looks like JS-2026-00012.</p>
        </div>
      )}

      {complaint && !loading && (
        <article className="panel appear">
          <div className="ticket-head">
            <button className="ticket-inline" onClick={copy} title="Copy ticket ID">
              <span className="mono">{complaint.ticket_id}</span>
              <Icon name={copied ? 'check' : 'copy'} size={15} />
            </button>
            <div className="badges">
              <StatusBadge status={complaint.status} />
              <PriorityBadge priority={complaint.priority} />
            </div>
          </div>

          <p className="lead">{complaint.description}</p>

          {complaint.images?.length > 0 && (
            <div className="gallery">
              {complaint.images.map((img, idx) => (
                <a key={idx} href={assetUrl(img)} target="_blank" rel="noreferrer">
                  <img src={assetUrl(img)} alt={`Photo ${idx + 1}`} />
                </a>
              ))}
            </div>
          )}

          <dl className="facts">
            <div><dt>Sent to</dt><dd>{complaint.department}</dd></div>
            <div><dt>Category</dt><dd>{categoryLabel(complaint.category)}</dd></div>
            <div><dt>Filed</dt><dd>{fmt(complaint.created_at)}</dd></div>
            <div><dt>Last update</dt><dd>{fmt(complaint.updated_at)}</dd></div>
          </dl>

          {complaint.master_ticket_id && (
            <div className="notice info">
              <Icon name="link" />
              <div>Others reported the same problem nearby, so the reports were grouped. Grouped reports get a higher priority.</div>
            </div>
          )}

          <h3 className="section-title">Progress</h3>
          <StatusTimeline status={complaint.status} />
        </article>
      )}
    </div>
  );
}
