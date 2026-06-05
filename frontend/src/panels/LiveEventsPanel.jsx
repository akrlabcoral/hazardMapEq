import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Filter } from 'lucide-react';

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function magColor(magnitude) {
  if (magnitude >= 7.0) return 'bg-purple-700'; // violent — purple
  if (magnitude >= 6.0) return 'bg-red-600';    // extreme — red
  if (magnitude >= 5.0) return 'bg-orange-600'; // severe  — orange
  if (magnitude >= 4.0) return 'bg-yellow-500'; // moderate — yellow
  return 'bg-green-500';                        // low — green
}

function MagBadge({ magnitude }) {
  const colorClass = magColor(magnitude);
  return (
    <span className={`inline-block min-w-[36px] px-1.5 py-0.5 rounded-full ${colorClass} text-white text-[11px] font-bold text-center shrink-0 shadow-sm`}>
      M{magnitude.toFixed(1)}
    </span>
  );
}

export default function LiveEventsPanel() {
  const liveEvents  = useStore((s) => s.liveEvents);
  const wsConnected = useStore((s) => s.wsConnected);

  const [minMag, setMinMag] = useState('');
  const [timeframe, setTimeframe] = useState('24h');

  // Filter events
  const filteredEvents = liveEvents.filter(event => {
    if (minMag && !isNaN(parseFloat(minMag)) && event.magnitude < parseFloat(minMag)) return false;
    
    if (timeframe !== 'all' && event.origin_time) {
      const hours = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 0;
      if (hours > 0) {
        const diffHrs = (Date.now() - new Date(event.origin_time).getTime()) / (1000 * 60 * 60);
        if (diffHrs > hours) return false;
      }
    }
    return true;
  });

  return (
    <div className="glass-card flex flex-col h-full font-sans overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/90">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-white" />
        <span className="text-white font-semibold text-sm tracking-wide uppercase pl-3 neon-text">
          LIVE EVENTS
        </span>
        {/* Connection dot */}
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${wsConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400 sim-running-indicator' : 'bg-slate-600'}`} />
          {wsConnected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/80 flex gap-2 items-center">
        <Filter size={14} className="text-slate-400 shrink-0" />
        <div className="flex-1 flex gap-2">
          <input 
            type="number" 
            placeholder="Min Mag..." 
            value={minMag}
            onChange={(e) => setMinMag(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            step="0.1"
            min="0"
          />
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700 rounded px-1 py-1 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
          >
            <option value="1h">Last 1h</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        {liveEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <div className="text-3xl mb-2">📡</div>
            Monitoring USGS & NCS feeds…<br />
            <span className="text-xs opacity-70">Events will appear here automatically</span>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No events match your current filters.
          </div>
        ) : (
          filteredEvents.map((event, i) => (
            <div key={event.id ?? i} className="flex items-center gap-3 p-3 border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors rounded-lg group">
              <MagBadge magnitude={event.magnitude} />
              <div className="flex-1 min-w-0">
                <div className="text-slate-200 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                  {event.place || `${event.latitude?.toFixed(2)}°N, ${event.longitude?.toFixed(2)}°E`}
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${event.source === 'USGS' ? 'bg-teal-700' : 'bg-blue-700'}`}>
                    {event.source || 'USGS'}
                  </span>
                  <span>{event.origin_time ? timeAgo(event.origin_time) : ''}</span>
                  {event.depth_km && <span>· {Math.round(event.depth_km)}km depth</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
