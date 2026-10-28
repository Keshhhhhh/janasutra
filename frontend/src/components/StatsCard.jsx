import React from 'react';
import { Icon } from './Icon';

export function StatsCard({ icon, value, label, tone = 'neutral' }) {
  return (
    <div className={`stat tone-${tone}`}>
      <span className="stat-icon"><Icon name={icon} size={18} /></span>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
