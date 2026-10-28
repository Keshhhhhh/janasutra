import React from 'react';

const STEPS = [
  { key: 'submitted', label: 'Submitted', sub: 'Received and classified' },
  { key: 'verified', label: 'Verified', sub: 'Checked by an official' },
  { key: 'in_progress', label: 'In progress', sub: 'Work has started' },
  { key: 'resolved', label: 'Resolved', sub: 'Fixed' },
];

export function StatusTimeline({ status }) {
  const i = STEPS.findIndex((s) => s.key === (status || 'submitted').toLowerCase().replace(' ', '_'));
  const active = i === -1 ? 0 : i;
  return (
    <ol className="timeline" style={{ '--progress': `${(active / (STEPS.length - 1)) * 100}%` }}>
      {STEPS.map((s, idx) => (
        <li key={s.key} className={`tl-step${idx <= active ? ' done' : ''}${idx === active ? ' current' : ''}`}>
          <span className="tl-dot" />
          <span className="tl-label">{s.label}</span>
          <span className="tl-sub">{s.sub}</span>
        </li>
      ))}
    </ol>
  );
}
