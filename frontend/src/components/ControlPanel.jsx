import React from 'react';

export default function ControlPanel({ title, children }) {
  return (
    <div className="glass-card flex h-full min-h-0 flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.4)]">
      <div className="relative bg-slate-900/90 px-4 py-3 border-b border-slate-700/50">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-white" />
        <h3 className="font-semibold tracking-wide neon-text pl-3">{title}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  );
}
