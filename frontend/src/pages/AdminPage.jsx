import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { StatsCard } from '../components/StatsCard';
import { ComplaintCard } from '../components/ComplaintCard';
import { PriorityBadge } from '../components/PriorityBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Icon } from '../components/Icon';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default marker icons in bundled builds
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Priority-colored markers
function createPriorityIcon(priority) {
  const colors = { P1: '#DC2626', P2: '#EA580C', P3: '#CA8A04', P4: '#16A34A', P5: '#64748B' };
  const color = colors[priority] || '#64748B';
  return L.divIcon({
    className: 'priority-marker',
    html: `<div style="
      width: 14px; height: 14px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function AdminPage() {
  const { isAdmin, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ dept: '', priority: '', status: '', authenticity: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/login');
    } else if (isAdmin) {
      fetchDashboardData();
    }
  }, [isAdmin, authLoading]);

  const fetchDashboardData = async () => {
    try {
      const [statsData, complaintsData] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/complaints?limit=100')
      ]);
      setStats(statsData);
      setComplaints(complaintsData.complaints || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    if (filter.dept && c.department !== filter.dept) return false;
    if (filter.priority && c.priority !== filter.priority) return false;
    if (filter.status && c.status !== filter.status) return false;
    if (filter.authenticity === 'flagged' && !c.authenticity?.flagged) return false;
    if (filter.authenticity === 'ai_review' && !(c.civic_ai?.review_reasons?.length
      || ['registry_unconfirmed', 'unresolved'].includes(c.civic_ai?.department_basis))) return false;
    if (searchTerm && !c.ticket_id?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !c.description?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (authLoading || loading) return <LoadingSpinner text="Loading dashboard…" />;
  if (!isAdmin) return null;

  const defaultCenter = [12.9716, 77.5946];

  const p1Count = stats?.by_priority?.P1 || 0;
  const p2Count = stats?.by_priority?.P2 || 0;

  const handleDeleteComplaint = async (complaintId) => {
    await api.delete(`/admin/complaints/${complaintId}`);
    setComplaints(prev => prev.filter(c => c.id !== complaintId));
    try {
      const statsData = await api.get('/admin/stats');
      setStats(statsData);
    } catch {}
  };

  return (
    <div className="shell wide">
      <header className="page-head row">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Civic issues overview</h1>
          <p className="muted">All reports, their priority and where they are.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => { setLoading(true); fetchDashboardData(); }}><Icon name="refresh" size={18} /> Refresh</button>
      </header>

      <div className="stats">
        <StatsCard icon="file" value={stats?.total_complaints || 0} label="Total reports" />
        <StatsCard icon="clock" value={stats?.total_open || 0} label="Open" tone="info" />
        <StatsCard icon="check" value={stats?.total_resolved || 0} label="Resolved" tone="ok" />
        <StatsCard icon="link" value={stats?.total_master_tickets || 0} label="Grouped issues" />
        <StatsCard icon="alert" value={p1Count} label="P1 critical" tone="danger" />
        <StatsCard icon="alert" value={p2Count} label="P2 high" tone="warn" />
      </div>

      {/* Map */}
      <div className="panel flush map-panel">
        <div style={{ height: '420px' }}>
          <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {complaints.filter(c => c.location?.lat && c.location?.lon).map(c => (
              <Marker
                key={c.id}
                position={[c.location.lat, c.location.lon]}
                icon={createPriorityIcon(c.priority)}
              >
                <Popup>
                  <div style={{ minWidth: '180px' }}>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{c.ticket_id}</strong>
                    <div style={{ margin: '6px 0', fontSize: '14px' }}>{c.description?.slice(0, 80)}{c.description?.length > 80 ? '...' : ''}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className={`badge badge-${c.priority?.toLowerCase()}`}>{c.priority}</span>
                      <span className="badge" style={{ background: '#F1F5F9', color: '#475569' }}>{c.department}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Filters + Complaint List */}
      <section>
        <div className="section-row">
          <h2 className="h3">All reports <span className="muted">· {filteredComplaints.length}</span></h2>
        </div>
        <div className="toolbar">
          <label className="searchbar compact">
            <Icon name="search" size={18} />
            <input
              type="text"
              placeholder="Search ticket ID or description"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </label>
          <select className="select" value={filter.dept} onChange={e => setFilter({...filter, dept: e.target.value})}>
            <option value="">All Departments</option>
            {[...new Set(complaints.map(c => c.department).filter(Boolean))].sort().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select className="select" value={filter.priority} onChange={e => setFilter({...filter, priority: e.target.value})}>
            <option value="">All Priorities</option>
            <option value="P1">P1 Critical</option>
            <option value="P2">P2 High</option>
            <option value="P3">P3 Medium</option>
            <option value="P4">P4 Low</option>
            <option value="P5">P5 Minimal</option>
          </select>
          <select className="select" value={filter.status} onChange={e => setFilter({...filter, status: e.target.value})}>
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="verified">Verified</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <select className="select" value={filter.authenticity} onChange={e => setFilter({...filter, authenticity: e.target.value})}>
            <option value="">All Photos</option>
            <option value="flagged">Suspected Fake</option>
            <option value="ai_review">Needs AI review</option>
          </select>
        </div>

        {filteredComplaints.length > 0 ? (
          <div className="cards">
            {filteredComplaints.map(c => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                onClick={() => navigate(`/track/${c.ticket_id}`)}
                onDelete={handleDeleteComplaint}
              />
            ))}
          </div>
        ) : (
          <div className="empty small">
            <h3>No reports match these filters</h3>
            <p className="muted">Try clearing a filter or the search.</p>
          </div>
        )}
      </section>
    </div>
  );
}
