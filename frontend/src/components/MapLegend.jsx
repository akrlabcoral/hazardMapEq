import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Navigation, Star } from 'lucide-react';

import useStore from '../store/useStore';
import { EARTHQUAKE_DAMAGE_PALETTE } from '../config/damagePalette';
import { MMI_INTENSITY_PALETTE } from '../config/intensityPalette';

const DAMAGE_LEGEND_PALETTE = [...EARTHQUAKE_DAMAGE_PALETTE].reverse();
const DAMAGE_GRADIENT = `linear-gradient(to right, ${DAMAGE_LEGEND_PALETTE.map((item) => item.color).join(', ')})`;

// ESA WorldCover 2021 Land Cover Legend
// Colors correspond to official ESA WorldCover classes
const ESA_WORLDCOVER_LEGEND_ITEMS = [
  { label: 'Tree Cover', color: '#006400' },
  { label: 'Shrubland', color: '#ffbb22' },
  { label: 'Grassland', color: '#ffff4c' },
  { label: 'Cropland', color: '#f096ff' },
  { label: 'Built-up', color: '#fa0000' },
  { label: 'Bare / Sparse Vegetation', color: '#b4b4b4' },
  { label: 'Snow & Ice', color: '#f0f0f0' },
  { label: 'Water Bodies', color: '#0064c8' },
  { label: 'Herbaceous Wetland', color: '#0096a0' },
  { label: 'Mangroves', color: '#00cf75' },
  { label: 'Moss & Lichen', color: '#fae6a0' },
];


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
            className="bg-slate-900/85 backdrop-blur-xl border border-slate-700/60 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] text-xs w-64 max-h-[calc(100vh-6rem)] overflow-y-auto"
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
            <Star className="w-4 h-4 fill-red-600 text-white stroke-[1.5px] drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" style={{ filter: 'drop-shadow(0 0 4px rgb(255, 0, 0))' }} />
            <span className="text-white">Earthquake origin point</span>
          </div>
        )}

        {show('historicEarthquakes') && (
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-white/80 flex-shrink-0"></div>
            <span className="text-white">Historic earthquakes</span>
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
            <span className="text-white">Tectonic plate boundaries</span>
          </div>
        )}

        {/* GPS Velocity Vectors Legend */}
        {show('gpsVectors') && (
          <div className="mt-3 pt-3 border-t border-slate-700/40">
            <div className="text-[10px] text-white uppercase tracking-wider mb-2">GPS Velocity Vectors</div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-black flex-shrink-0"></div>
              <span className="text-white">GPS Station (Anchor Point)</span>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5">
              <div className="w-6 h-0.5 bg-red-500 ml-[-6px] mr-1 flex-shrink-0 relative">
                <Navigation className="absolute right-[-7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-90 fill-red-500 text-red-500" />
              </div>
              <span className="text-white text-[10px] leading-tight">Line length ∝ Velocity<br/>Arrow indicates drift direction</span>
            </div>
          </div>
        )}

        {/* Damage palette legend runs least-damage-left to most-damage-right.
            MapLibre/contour interpolation is defined low-to-high internally,
            and low-impact cells fade by opacity so underlying layers remain visible. */}
        {show('pgaIntensity') && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-white uppercase tracking-wider mb-2">Earthquake Damage</div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white mb-1.5">
            <span>Least Damage</span>
            <span>Most Damage</span>
          </div>
          <div
            className="h-3 rounded-full border border-white/20 shadow-[0_0_8px_rgba(14,165,233,0.25)]"
            style={{ background: DAMAGE_GRADIENT }}
          />
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {DAMAGE_LEGEND_PALETTE.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {show('mmiIntensity') && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-white uppercase tracking-wider mb-2">MMI Intensity</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {MMI_INTENSITY_PALETTE.map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/30 shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Soil Amplification Multipliers */}
        {show('soilAmplification') && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-white uppercase tracking-wider mb-2">Site Class Amplification (Vs30)</div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400"></div>
              <span className="text-slate-400">Site E (&lt;180 m/s)</span>
            </div>
            <span className="text-white font-mono">2.0x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-400"></div>
              <span className="text-slate-400">Site D (180-360)</span>
            </div>
            <span className="text-white font-mono">1.5x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400"></div>
              <span className="text-slate-400">Site C (360-760)</span>
            </div>
            <span className="text-white font-mono">1.2x</span>
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

        {show('landCover') && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-white uppercase tracking-wider mb-2">ESA WorldCover 2021 Land Cover</div>
          {ESA_WORLDCOVER_LEGEND_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2 mt-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm border border-white/20 flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-white">{item.label}</span>
            </div>
          ))}
        </div>
        )}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
