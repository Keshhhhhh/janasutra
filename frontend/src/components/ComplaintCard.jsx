import React, { useState } from 'react';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { assetUrl, categoryLabel } from '../utils/api';
import { Icon } from './Icon';

const FAKE_LABELS = {
  ai_generated: 'AI-generated photo',
  screen_photo: 'Photo of a screen',
  downloaded: 'Downloaded / screenshot',
};

export function ComplaintCard({ complaint, onClick, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const img = complaint.images?.[0];
  const civic = complaint.civic_ai;
  const unconfirmed = civic && ['registry_unconfirmed', 'unresolved'].includes(civic.department_basis);
  const needsReview = civic && (civic.review_reasons.length > 0 || unconfirmed);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await onDelete(complaint.id);
    } catch (err) {
      console.error('Delete failed:', err);
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <article className={`ccard${deleting ? ' fading' : ''}`} onClick={onClick} tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="ccard-media">
        {img ? <img src={assetUrl(img)} alt="" loading="lazy" /> : <div className="ccard-noimg"><Icon name="image" size={28} /></div>}
        <div className="ccard-overlay">
          <PriorityBadge priority={complaint.priority} />
        </div>
      </div>
      <div className="ccard-body">
        <div className="ccard-top">
          <span className="mono ccard-id">{complaint.ticket_id}</span>
          <StatusBadge status={complaint.status} />
        </div>
        <p className="ccard-desc">{complaint.description}</p>

        {complaint.authenticity?.flagged && (
          <div className="flag danger" title={complaint.authenticity.reasons.join('\n')}>
            <Icon name="shield" size={14} /> Suspected fake: {FAKE_LABELS[complaint.authenticity.verdict] || complaint.authenticity.verdict}
          </div>
        )}
        {needsReview && (
          <div className="flag warn" title={[...civic.review_reasons, ...(unconfirmed ? ['Responsible authority not confirmed'] : [])].join('\n')}>
            <Icon name="info" size={14} /> Review: {civic.subcategory_name} ({Math.round(civic.confidence * 100)}%)
            {civic.consistency === 'contradiction' && ' · photo/text mismatch'}
          </div>
        )}

        <div className="ccard-foot">
          <span className="ccard-dept"><Icon name="building" size={14} /> {complaint.department || categoryLabel(complaint.category)}</span>
          <span className="ccard-date">{new Date(complaint.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          {onDelete && (
            confirming ? (
              <span className="ccard-confirm" onClick={(e) => e.stopPropagation()}>
                <button className="btn btn-danger btn-xs" onClick={handleDelete} disabled={deleting}>Delete</button>
                <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); setConfirming(false); }}>Cancel</button>
              </span>
            ) : (
              <button className="icon-btn" onClick={handleDelete} title="Delete report" aria-label="Delete report">
                <Icon name="trash" size={16} />
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
}
