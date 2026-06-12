import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Star } from 'lucide-react';

import useStore from '../store/useStore';

const PGA_SCALE = [
  { color: '#cc0000', label: '> 1.24g (X+ Extreme)' },
  { color: '#ff6666', label: '0.65 - 1.24g (IX Violent)' },
  { color: '#ffb834', label: '0.34 - 0.65g (VIII Severe)' },
  { color: '#ffec7d', label: '0.18 - 0.34g (VII Very Strong)' },
  { color: '#7cd37c', label: '0.092 - 0.18g (VI Strong)' },
  { color: '#80ffff', label: '0.039 - 0.092g (V Moderate)' },
  { color: '#a0e6ff', label: '0.014 - 0.039g (IV Light)' },
];

// Map Legend — positioned top-right, shows layer symbology + intensity color scale
// Uses glassmorphism panel with premium dark GIS styling
export default function MapLegend() {
  const [isVisible, setIsVisible] = useState(true);
  const visibleLegendItems = useStore((state) => state.visibleLegendItems);
  const visibleItems = new Set(visibleLegendItems);
  const hasVisibleItems = visibleLegendItems.length > 0;
  const show = (itemId) => visibleItems.has(itemId);

  return (
    <div className="absolute top-6 right-20 z-20 flex flex-col items-end justify-end gap-2 pointer-events-auto">
      <button 
        onClick={() => setIsVisible(!isVisible)}
        className="p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 rounded-full text-slate-400 hover:text-white transition-colors shadow-lg flex items-center justify-center"
        title={isVisible ? "Hide Legend" : "Show Legend"}
      >
        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-xs w-64"
          >

            {/* Header with neon accent */}
            <h3 className="font-bold text-slate-200 uppercase tracking-[0.15em] mb-3 pb-2 border-b border-slate-700/50 text-[11px]"
                style={{ textShadow: '0 0 10px rgba(6,182,212,0.3)' }}>
              MAP LEGEND
            </h3>
      <div className="space-y-2.5">
        {/* Layer symbology items */}
        {!hasVisibleItems && (
          <div className="text-slate-500 text-xs italic">No visible map layers</div>
        )}

        {show('epicenter') && (
          <div className="flex items-center gap-2.5 mt-1">
            <Star className="w-4 h-4 fill-yellow-400 text-white stroke-[1.5px] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.8))' }} />
            <span className="text-slate-400">Earthquake origin point</span>
          </div>
        )}

        {show('historicEarthquakes') && (
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-white/80 flex-shrink-0"></div>
            <span className="text-slate-400">Historic earthquakes</span>
          </div>
        )}

        {show('liveEarthquakes') && (
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500 border border-white/80 flex-shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></div>
            <span className="text-slate-400">Live earthquakes</span>
          </div>
        )}

        {show('tectonicPlates') && (
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-7 h-0.5 bg-orange-600 flex-shrink-0"></div>
            <span className="text-slate-400">Tectonic plate boundaries</span>
          </div>
        )}

        {/* GPS Velocity Vectors Legend */}
        {show('gpsVectors') && (
          <div className="mt-3 pt-3 border-t border-slate-700/40">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">GPS Velocity Vectors</div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-black flex-shrink-0"></div>
              <span className="text-slate-400">GPS Station (Anchor Point)</span>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <div className="w-6 h-0.5 bg-red-500 ml-[-6px] mr-1 flex-shrink-0 relative">
                <div className="absolute right-[-4px] top-1/2 -translate-y-[45%] text-red-500 text-[10px] leading-none">^</div>
              </div>
              <span className="text-slate-400 text-[10px] leading-tight">Line length ∝ Velocity<br/>Arrow indicates drift direction</span>
            </div>
          </div>
        )}

        {/* Scientific PGA Scale */}
        {show('pgaIntensity') && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">PGA Intensity Scale</div>
          {PGA_SCALE.map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 mt-1.5">
              <div
                className="w-3.5 h-3.5 rounded-full border border-white/20"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
        )}

        {/* Soil Amplification Multipliers */}
        {show('soilAmplification') && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Site Class Amplification (Vs30)</div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400"></div>
              <span className="text-slate-400">Site E (&lt;180 m/s)</span>
            </div>
            <span className="text-white font-mono">1.70x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-400"></div>
              <span className="text-slate-400">Site D (180-360)</span>
            </div>
            <span className="text-white font-mono">1.40x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400"></div>
              <span className="text-slate-400">Site C (360-760)</span>
            </div>
            <span className="text-white font-mono">1.20x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-400"></div>
              <span className="text-slate-400">Site B (760-1500)</span>
            </div>
            <span className="text-white font-mono">1.00x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-400"></div>
              <span className="text-slate-400">Site A (&gt;1500 m/s)</span>
            </div>
            <span className="text-white font-mono">0.80x</span>
          </div>
        </div>
        )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
