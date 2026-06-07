// src/components/ui/LayerRow.jsx
// Reusable row component for GIS layers — toggle + opacity slider

import { ToggleSwitch } from './ToggleSwitch';
import { Trash2 } from 'lucide-react';

export function LayerRow({ label, subtitle, visible, onToggle, onRemove, disabled = false }) {
  return (
    <div className={`p-3 mb-2 bg-slate-800/50 rounded-lg border border-slate-700/50 ${disabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="font-medium text-slate-300">{label}</span>
          {subtitle && <div className="text-[10px] text-slate-500 mt-0.5">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch checked={visible} onChange={onToggle} disabled={disabled} />
          {onRemove && (
            <button 
              onClick={onRemove}
              className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
              title="Remove Layer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
