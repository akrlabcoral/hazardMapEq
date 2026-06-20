import React from 'react';
import { X } from 'lucide-react';
import useStore from '../store/useStore';

export default function InfoPanel() {
  const infoPanel = useStore((state) => state.infoPanel);
  const clearInfoPanel = useStore((state) => state.clearInfoPanel);

  if (!infoPanel) return null;

  return (
    <aside className="absolute bottom-5 left-55 z-50 w-[320px] max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/90 shadow-2xl backdrop-blur-md pointer-events-auto">
      <div className="flex items-start gap-3 border-b border-slate-800 p-4">
        <div
          className="mt-1 h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: infoPanel.accent || '#38bdf8' }}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {infoPanel.subtitle}
          </div>
          <h2 className="mt-1 truncate text-base font-bold text-white">
            {infoPanel.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={clearInfoPanel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          title="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(100vh-14rem)] overflow-y-auto p-4">
        {infoPanel.sections?.map((section) => (
          section.rows?.length > 0 && (
            <section key={section.title} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </h3>
              <dl className="space-y-2">
                {section.rows.map((row) => (
                  <div key={`${section.title}-${row.label}`} className="grid grid-cols-[120px_1fr] gap-3 text-sm">
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="min-w-0 break-words text-right font-mono text-slate-100">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        ))}
      </div>
    </aside>
  );
}
