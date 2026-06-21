import React from 'react';

export default function HazardActionBar({ actions = [] }) {
  if (!actions.length) return null;

  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-bold uppercase tracking-[0.16em] transition ${
              action.variant === 'danger'
                ? 'border-red-500 bg-red-600 text-white shadow-[0_0_18px_rgba(239,68,68,0.28)] hover:bg-red-500 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none'
                : action.variant === 'primary'
                  ? 'border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500 disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500'
                  : 'border-slate-600 bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60'
            }`}
          >
            {Icon && <Icon size={15} />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
