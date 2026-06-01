import React from 'react';
import useStore from '../store/useStore';

export default function StateHoverTooltip() {
  const hoveredStateId = useStore((state) => state.hoveredStateId);
  const isHoverTooltipEnabled = useStore((state) => state.isHoverTooltipEnabled);
  const mousePos = useStore((state) => state.mousePos);
  const stateIdMapping = useStore((state) => state.stateIdMapping);
  const simulationResults = useStore((state) => state.simulationResults);

  if (!isHoverTooltipEnabled || !hoveredStateId || !stateIdMapping || !simulationResults?.state_summary) {
    return null;
  }

  // Find the state name from the mapping
  const stateName = Object.keys(stateIdMapping).find(k => stateIdMapping[k] === hoveredStateId);
  if (!stateName) return null;

  const summary = simulationResults.state_summary[stateName];
  if (!summary) return null;

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'EXTREME': return 'text-red-500';
      case 'SEVERE': return 'text-orange-500';
      case 'HIGH': return 'text-yellow-500';
      case 'MODERATE': return 'text-green-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <div 
      className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+20px)]"
      style={{ left: mousePos.x, top: mousePos.y }}
    >
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[200px] text-white font-sans tracking-wide">
        <h3 className="text-lg font-bold border-b border-slate-700 pb-2 mb-2">{stateName}</h3>
        
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400">Risk:</span>
            <span className={`font-bold ${getRiskColor(summary.risk_category)}`}>
              {summary.risk_category}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Avg PGA:</span>
            <span className="font-mono">{summary.avg_pga}g</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Max PGA:</span>
            <span className="font-mono">{summary.max_pga}g</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Population Affected:</span>
            <span className="font-mono">{(summary.pop_affected / 1000000).toFixed(1)}M</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Damage Index:</span>
            <span className="font-mono">{summary.damage_score}%</span>
          </div>
        </div>
      </div>
      
      {/* Tooltip triangle pointer */}
      <div className="absolute left-1/2 bottom-[-8px] -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-slate-700"></div>
    </div>
  );
}
