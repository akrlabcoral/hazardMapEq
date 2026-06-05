// src/components/ui/LayerRow.jsx
// Reusable row component for GIS layers — toggle + opacity slider

import { ToggleSwitch } from './ToggleSwitch';

export function LayerRow({ label, subtitle, visible, opacity, onToggle, onOpacityChange, disabled = false }) {
  return (
    <div className={`p-3 mb-2 bg-slate-800/50 rounded-lg border border-slate-700/50 ${disabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="font-medium text-slate-300">{label}</span>
          {subtitle && <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        <ToggleSwitch checked={visible} onChange={onToggle} disabled={disabled} />
      </div>
      {visible && onOpacityChange && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="range" min="0" max="1" step="0.05"
            value={opacity ?? 1}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
            className="flex-1 accent-cyan-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-white w-8 text-right">{Math.round((opacity ?? 1) * 100)}%</span>
        </div>
      )}
    </div>
  );
}
