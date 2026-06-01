import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';

// Map Legend — positioned top-right, shows layer symbology + intensity color scale
// Uses glassmorphism panel with premium dark GIS styling
export default function MapLegend() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="absolute top-24 right-6 z-20 flex flex-col items-end gap-2 pointer-events-auto">
      <button 
        onClick={() => setIsVisible(!isVisible)}
        className="p-2 bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 rounded-full text-slate-400 hover:text-cyan-400 transition-colors shadow-lg flex items-center justify-center"
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
        <div className="flex items-center gap-2.5 mt-1">
          <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white/80 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
          <span className="text-slate-400">Earthquake origin point</span>
        </div>

        {/* Scientific PGA Scale */}
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">PGA Intensity Scale</div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-purple-700/90 shadow-[0_0_6px_rgba(126,34,206,0.4)]"></div>
            <span className="text-slate-400">&gt; 1.39g (Violent)</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-red-500/90 shadow-[0_0_6px_rgba(239,68,68,0.4)]"></div>
            <span className="text-slate-400">0.747 - 1.39g (Severe)</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-orange-600/90 shadow-[0_0_6px_rgba(234,88,12,0.4)]"></div>
            <span className="text-slate-400">0.401 - 0.747g (Very Strong)</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500/90 shadow-[0_0_6px_rgba(249,115,22,0.4)]"></div>
            <span className="text-slate-400">0.215 - 0.401g (Strong)</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/90 shadow-[0_0_6px_rgba(234,179,8,0.4)]"></div>
            <span className="text-slate-400">0.115 - 0.215g (Moderate)</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-green-500/90 shadow-[0_0_6px_rgba(34,197,94,0.4)]"></div>
            <span className="text-slate-400">0.02 - 0.115g (Light)</span>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500/90 shadow-[0_0_6px_rgba(59,130,246,0.4)]"></div>
            <span className="text-slate-400">&lt; 0.02g (No affect)</span>
          </div>
        </div>

        {/* Soil Amplification Multipliers */}
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Site Class Amplification (Vs30)</div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-red-400"></div>
              <span className="text-slate-400">Site E (&lt;180 m/s)</span>
            </div>
            <span className="text-cyan-400 font-mono">1.70x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-orange-400"></div>
              <span className="text-slate-400">Site D (180-360)</span>
            </div>
            <span className="text-cyan-400 font-mono">1.40x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-yellow-400"></div>
              <span className="text-slate-400">Site C (360-760)</span>
            </div>
            <span className="text-cyan-400 font-mono">1.20x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-green-400"></div>
              <span className="text-slate-400">Site B (760-1500)</span>
            </div>
            <span className="text-cyan-400 font-mono">1.00x</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm bg-blue-400"></div>
              <span className="text-slate-400">Site A (&gt;1500 m/s)</span>
            </div>
            <span className="text-cyan-400 font-mono">0.80x</span>
          </div>
        </div>
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
