import React from 'react';
import useStore from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, ShieldAlert, Users, TrendingUp } from 'lucide-react';

export default function StateAnalysisPanel() {
  const selectedStateName = useStore((state) => state.selectedStateName);
  const setSelectedStateName = useStore((state) => state.setSelectedStateName);
  const simulationResults = useStore((state) => state.simulationResults);

  // Find data
  const summary = simulationResults?.state_summary?.[selectedStateName];

  return (
    <AnimatePresence>
      {selectedStateName && summary && (
        <motion.div 
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-0 right-0 h-full w-[400px] bg-slate-900/90 backdrop-blur-xl border-l border-slate-700/50 shadow-2xl z-40 pointer-events-auto flex flex-col"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <div>
              <div className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase mb-1">State Analysis</div>
              <h2 className="text-2xl font-bold text-white tracking-wide">{selectedStateName}</h2>
            </div>
            <button 
              onClick={() => setSelectedStateName(null)}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors border border-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
            
            {/* Main Alert Card */}
            <div className={`p-4 rounded-xl border ${summary.risk_category === 'EXTREME' ? 'bg-red-900/20 border-red-500/50' : summary.risk_category === 'SEVERE' ? 'bg-orange-900/20 border-orange-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="flex items-center gap-3 mb-2">
                <ShieldAlert className={summary.risk_category === 'EXTREME' ? 'text-red-500' : 'text-orange-500'} />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">{summary.risk_category} RISK</h3>
              </div>
              <p className="text-sm text-slate-300">
                This state has an estimated damage index of <span className="font-bold text-white">{summary.damage_score}%</span>, affecting highly populated and vulnerable sectors.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col justify-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity size={12}/> Avg PGA</div>
                <div className="text-2xl font-mono font-bold text-cyan-400">{summary.avg_pga}g</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col justify-center">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={12}/> Max PGA</div>
                <div className="text-2xl font-mono font-bold text-red-400">{summary.max_pga}g</div>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-xl flex flex-col justify-center col-span-2">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={12}/> Pop Exposure ({'>'}0.1g)</div>
                <div className="text-2xl font-mono font-bold text-emerald-400">{(summary.pop_affected / 1000000).toFixed(2)} Million</div>
              </div>
            </div>

            {/* Simulated Infrastructure Analysis */}
            <div>
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-3 border-b border-slate-700 pb-2">Infrastructure Impact Model</h3>
              <div className="space-y-3">
                {[
                  { label: "Residential Zones", val: Math.min(100, summary.damage_score * 1.2), color: "bg-red-500" },
                  { label: "Commercial Hubs", val: summary.damage_score, color: "bg-orange-500" },
                  { label: "Critical Facilities", val: summary.damage_score * 0.8, color: "bg-yellow-500" },
                  { label: "Transport Networks", val: summary.damage_score * 0.9, color: "bg-emerald-500" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="text-white font-mono">{Math.round(item.val)}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.min(100, item.val)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500 italic mt-4">
              * Note: Values are simulated deterministic estimates based on current attenuation models. Real-world structural impacts may vary based on local building codes.
            </div>
            
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
