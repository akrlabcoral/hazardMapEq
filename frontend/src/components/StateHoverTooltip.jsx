import React from 'react';
import useStore from '../store/useStore';
import { classifyRisk, getDamageIndex, getIntensityLabel, getRiskColorText } from '../utils/hazardCalculations';

export default function StateHoverTooltip() {
  const hoveredStateId = useStore((state) => state.hoveredStateId);
  const hoveredCellData = useStore((state) => state.hoveredCellData);
  const isHoverTooltipEnabled = useStore((state) => state.isHoverTooltipEnabled);
  const mousePos = useStore((state) => state.mousePos);
  const stateIdMapping = useStore((state) => state.stateIdMapping);

  if (!isHoverTooltipEnabled || !hoveredStateId || !stateIdMapping) {
    return null;
  }

  // Find the state name from the mapping
  const stateName = Object.keys(stateIdMapping).find(k => stateIdMapping[k] === hoveredStateId);
  if (!stateName) return null;

  return (
    <div 
      className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+20px)]"
      style={{ left: mousePos.x, top: mousePos.y }}
    >
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[220px] text-white font-sans tracking-wide">
        <h3 className="text-lg font-bold border-b border-slate-700 pb-2 mb-2">{stateName}</h3>
        
        {!hoveredCellData ? (
          <div className="text-sm text-slate-400 italic py-1">
            No local hazard data.
          </div>
        ) : (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Risk:</span>
              <span className={`font-bold ${getRiskColorText(classifyRisk(hoveredCellData.pga_final))}`}>
                {classifyRisk(hoveredCellData.pga_final)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Intensity:</span>
              <span className="font-medium text-slate-200">{getIntensityLabel(hoveredCellData.pga_final)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Local PGA:</span>
              <span className="font-mono text-slate-200">{hoveredCellData.pga_final?.toFixed(4)}g</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Damage Index:</span>
              <span className="font-mono text-slate-200">{getDamageIndex(hoveredCellData.pga_final)}%</span>
            </div>
            {hoveredCellData.population !== undefined && (
              <div className="flex justify-between border-t border-slate-700/50 pt-1.5 mt-1.5">
                <span className="text-slate-400">Local Pop Exposure:</span>
                <span className="font-mono text-white">
                  {hoveredCellData.population.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Tooltip triangle pointer */}
      <div className="absolute left-1/2 bottom-[-8px] -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-slate-700"></div>
    </div>
  );
}
