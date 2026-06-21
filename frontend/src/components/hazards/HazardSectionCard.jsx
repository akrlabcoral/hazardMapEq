import React from 'react';

export default function HazardSectionCard({ title, icon: Icon, accent = 'cyan', children, className = '' }) {
  const accentClass = accent === 'red' ? 'text-red-300' : accent === 'amber' ? 'text-amber-300' : 'text-cyan-300';

  return (
    <section className={`min-w-[220px] rounded-xl border border-slate-600/60 bg-slate-900/55 p-3 shadow-inner ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 ${accentClass}`} />}
        <h4 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-200">{title}</h4>
      </div>
      {children}
    </section>
  );
}
