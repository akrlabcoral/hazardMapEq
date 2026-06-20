import React, { useEffect } from 'react';
import useStore from '../store/useStore';

/**
 * AlertBanner — slide-in notification for significant (M≥5.0) earthquakes.
 *
 * - Orange for M5.0–5.9
 * - Red with pulse animation for M≥6.0
 * - Auto-dismisses after 12 seconds
 * - Manual dismiss with ✕ button
 */
export default function AlertBanner() {
  const activeAlert  = useStore((s) => s.activeAlert);
  const dismissAlert = useStore((s) => s.dismissAlert);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(dismissAlert, 12000);
    return () => clearTimeout(timer);
  }, [activeAlert, dismissAlert]);

  if (!activeAlert) return null;

  const mag = activeAlert.magnitude;
  const isExtreme = mag >= 6.0;
  const bannerBackground = isExtreme
    ? 'linear-gradient(135deg, #7f1d1d, #dc2626)'
    : 'linear-gradient(135deg, #78350f, #d97706)';

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      borderRadius: '12px',
      background: bannerBackground,
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: 600,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      animation: 'alertSlideIn 0.4s ease',
      maxWidth: '90vw',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Pulsing dot */}
      <span style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: '#fff',
        flexShrink: 0,
        animation: isExtreme ? 'alertPulse 1s infinite' : 'none',
      }} />

      {/* Icon + text */}
      <span>
        ⚠ <strong>{`M${mag.toFixed(1)} Earthquake`}</strong>
        {activeAlert.place ? ` — ${activeAlert.place}` : ''}
        {' — Simulation running...'}
      </span>

      {/* Dismiss */}
      <button
        onClick={dismissAlert}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: 'none',
          color: '#fff',
          borderRadius: '6px',
          padding: '2px 8px',
          cursor: 'pointer',
          fontSize: '13px',
          flexShrink: 0,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes alertSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes alertPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
}
