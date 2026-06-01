import React from 'react';
import useStore from '../store/useStore';

/**
 * LiveEventsPanel — scrollable sidebar panel showing auto-detected earthquake events.
 *
 * Features:
 *  - Live connection status dot (green = connected, grey = disconnected)
 *  - Colour-coded magnitude badges
 *  - Relative timestamps ("2m ago")
 *  - Empty state when no events yet
 */

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function magColor(magnitude) {
  if (magnitude >= 7.0) return '#7e22ce'; // violent — purple
  if (magnitude >= 6.0) return '#dc2626'; // extreme — red
  if (magnitude >= 5.0) return '#ea580c'; // severe  — orange
  if (magnitude >= 4.0) return '#eab308'; // moderate — yellow
  return '#22c55e';                        // low — green
}

function MagBadge({ magnitude }) {
  return (
    <span style={{
      display: 'inline-block',
      minWidth: '36px',
      padding: '2px 7px',
      borderRadius: '999px',
      background: magColor(magnitude),
      color: '#fff',
      fontSize: '11px',
      fontWeight: 700,
      textAlign: 'center',
      flexShrink: 0,
    }}>
      M{magnitude.toFixed(1)}
    </span>
  );
}

export default function LiveEventsPanel() {
  const liveEvents  = useStore((s) => s.liveEvents);
  const wsConnected = useStore((s) => s.wsConnected);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '13px', letterSpacing: '0.05em' }}>
          LIVE EVENTS
        </span>
        {/* Connection dot */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: wsConnected ? '#4ade80' : '#6b7280' }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: wsConnected ? '#4ade80' : '#4b5563',
            animation: wsConnected ? 'livePulse 2s infinite' : 'none',
          }} />
          {wsConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      {/* Event list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px 0',
      }}>
        {liveEvents.length === 0 ? (
          <div style={{
            padding: '32px 16px',
            textAlign: 'center',
            color: '#4b5563',
            fontSize: '13px',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📡</div>
            Monitoring USGS & NCS feeds…<br />
            <span style={{ fontSize: '11px' }}>Events will appear here automatically</span>
          </div>
        ) : (
          liveEvents.map((event, i) => (
            <div key={event.id ?? i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              cursor: 'default',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <MagBadge magnitude={event.magnitude} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {event.place || `${event.latitude?.toFixed(2)}°N, ${event.longitude?.toFixed(2)}°E`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
                  <span style={{ 
                    background: event.source === 'USGS' ? '#0f766e' : '#1d4ed8', 
                    color: '#fff', 
                    padding: '1px 4px', 
                    borderRadius: '4px', 
                    fontSize: '9px',
                    fontWeight: 700
                  }}>
                    {event.source || 'USGS'}
                  </span>
                  <span>{event.origin_time ? timeAgo(event.origin_time) : ''}</span>
                  <span>{event.depth_km ? `· ${Math.round(event.depth_km)}km depth` : ''}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
