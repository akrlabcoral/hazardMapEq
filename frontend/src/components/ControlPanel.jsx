import React from 'react';

// ControlPanel — generic wrapper for bottom control panels
// Premium glassmorphism with cyan header accent bar and layered depth
export default function ControlPanel({ title, children }) {
  return (
    <div className="glass-card flex flex-col overflow-hidden max-h-full shadow-[0_0_40px_rgba(0,0,0,0.4)]">
      {/* Panel header with left cyan accent bar and gradient background */}
      {/* The accent bar provides visual hierarchy and command-center aesthetic */}
      <div className="relative bg-slate-900/90 px-4 py-3 border-b border-slate-700/50">
        {/* Top edge glow line for depth separation */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
        {/* Left accent bar — provides visual weight and section identity */}
        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
        <h3 className="font-semibold tracking-wide neon-text pl-3">{title}</h3>
      </div>
      <div className="p-4 overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}
