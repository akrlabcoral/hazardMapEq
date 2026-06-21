import React from 'react';
import { Layers3 } from 'lucide-react';

export default function OtherHazardsPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-slate-600/60 bg-slate-800/40 p-4">
        <Layers3 className="h-5 w-5 text-cyan-300" />
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-200">More Hazards</div>
          <div className="mt-1 text-xs text-slate-400">Module placeholder</div>
        </div>
      </div>
    </div>
  );
}
