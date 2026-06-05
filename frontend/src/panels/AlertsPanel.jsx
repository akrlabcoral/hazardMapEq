import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function AlertsPanel() {
  return (
    <div className="p-6 h-full flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
      <ShieldCheck size={48} className="mb-4 text-emerald-500/50" strokeWidth={1} />
      <p className="text-sm font-medium text-slate-300">No Active Alerts</p>
      <p className="text-xs mt-1 opacity-70 text-center">
        Extreme seismic events (M≥6.0) will trigger emergency alerts here.
      </p>
    </div>
  );
}
