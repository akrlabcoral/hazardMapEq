import React, { useEffect, useState, useMemo } from 'react';
import useStore from '../store/useStore';
import { useSimulation } from '../hooks/useSimulation';

// Simple time formatter
const formatDate = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
};

const MagBadge = ({ magnitude }) => {
  let color = 'bg-slate-700 text-slate-300';
  if (magnitude >= 4.0) color = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  if (magnitude >= 5.0) color = 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
  if (magnitude >= 6.0) color = 'bg-red-500/20 text-red-400 border border-red-500/30';
  if (magnitude >= 7.0) color = 'bg-rose-600/30 text-rose-300 border border-rose-500/50';

  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm ${color} shadow-lg shrink-0`}>
      {magnitude ? magnitude.toFixed(1) : '?'}
    </div>
  );
};

export default function HistoricPanel() {
  const { handleRunSimulation } = useSimulation();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [minMag, setMinMag] = useState('4.0');

  useEffect(() => {
    // Enable layer on mount
    useStore.setState((state) => ({ gisLayers: { ...state.gisLayers, historicEarthquakes: true } }));
    
    // Fetch data for the panel
    fetch('/scientific-api/historic')
      .then(res => res.json())
      .then(json => {
        if (json && json.features) {
          setData(json.features);
        } else {
          setData([]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load historic events:", err);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      // Disable layer on unmount
      useStore.setState((state) => ({ gisLayers: { ...state.gisLayers, historicEarthquakes: false } }));
    };
  }, []);

  // Update map filter when minMag changes
  useEffect(() => {
    useStore.setState({ historicMinMag: parseFloat(minMag) });
  }, [minMag]);

  const filteredFeatures = useMemo(() => {
    if (!data) return [];
    const mag = parseFloat(minMag);
    return data.filter(f => f.properties.mag >= mag);
  }, [data, minMag]);

  // Only show top 100 in the UI list to avoid DOM lag
  const displayFeatures = filteredFeatures.slice(0, 100);

  return (
    <div className="glass-card flex flex-col h-full font-sans overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)] w-[360px]">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-900/90 shrink-0">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-white" />
        <span className="text-white font-semibold text-sm tracking-wide uppercase pl-3 text-shadow-sm">
          HISTORIC ARCHIVE
        </span>
        <span className="relative flex h-2.5 w-2.5 mr-2">
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
        </span>
      </div>

      {/* Filters & Stats */}
      <div className="p-3 border-b border-slate-700/50 bg-slate-800/40 shrink-0 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Total Events</span>
          <span className="text-sm font-bold text-slate-200">
            {loading ? '...' : filteredFeatures.length.toLocaleString()}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Min Mag:</span>
          <select
            value={minMag}
            onChange={(e) => setMinMag(e.target.value)}
            className="w-[70px] bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
          >
            <option value="4.0">4.0+</option>
            <option value="5.0">5.0+</option>
            <option value="6.0">6.0+</option>
            <option value="7.0">7.0+</option>
          </select>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <div className="animate-spin text-3xl mb-2 inline-block">⏳</div>
            <div>Loading historic data...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 text-sm">
            Failed to load data.
          </div>
        ) : displayFeatures.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No events match your current filters.
          </div>
        ) : (
          <>
            {displayFeatures.map((feat, index) => {
              const event = feat.properties;
              return (
                <div 
                  key={event.id || index} 
                  className="flex items-center gap-3 p-3 border-b border-slate-700/30 hover:bg-slate-700/30 hover:bg-slate-800 transition-colors rounded-lg group cursor-pointer"
                  onClick={() => {
                    const store = useStore.getState();
                    store.setEarthquakeEpicenter({ 
                      lat: feat.geometry.coordinates[1], 
                      lng: feat.geometry.coordinates[0] 
                    });
                    store.setEarthquakeMagnitude(event.mag);
                    store.setEarthquakeDepth(event.depth || 10);
                    
                    // Center the map on the epicenter for better context
                    store.setMapViewport({
                      longitude: feat.geometry.coordinates[0],
                      latitude: feat.geometry.coordinates[1],
                      zoom: 6
                    });

                    // Switch to the disasters panel to run simulation
                    store.forceActiveSection('disasters');
                    
                    // Auto-run simulation
                    handleRunSimulation();
                  }}
                >
                  <MagBadge magnitude={event.mag} />
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 text-xs font-semibold whitespace-nowrap overflow-hidden text-ellipsis">
                      {event.place || `${feat.geometry.coordinates[1].toFixed(2)}°N, ${feat.geometry.coordinates[0].toFixed(2)}°E`}
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] mt-1">
                      <span>{event.time ? formatDate(event.time) : ''}</span>
                      {event.depth && <span>· {Math.round(event.depth)}km depth</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredFeatures.length > 100 && (
              <div className="text-center p-3 text-[10px] text-slate-500">
                Showing top 100 of {filteredFeatures.length.toLocaleString()} events.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
