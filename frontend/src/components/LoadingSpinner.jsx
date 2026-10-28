import React from 'react';

export function LoadingSpinner({ text }) {
  return (
    <div className="page-loader">
      <span className="spin lg" />
      {text && <p className="muted">{text}</p>}
    </div>
  );
}
