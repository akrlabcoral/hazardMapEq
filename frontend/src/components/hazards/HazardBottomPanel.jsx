import React from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import HazardActionBar from './HazardActionBar';
import HazardSectionCard from './HazardSectionCard';

export default function HazardBottomPanel({ layout, onClose }) {
  if (!layout) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key={layout.id}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 28 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 border border-slate-600/60 bg-slate-900 shadow-[0_0_45px_rgba(0,0,0,0.45)]"
      >
        <div className="absolute left-0 right-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        <div className="flex h-[clamp(260px,30vh,320px)] min-h-0 flex-col overflow-hidden p-4">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-300/80">{layout.eyebrow || 'Hazard Controls'}</div>
              <h3 className="text-base font-bold tracking-wide text-white">{layout.title}</h3>
            </div>
            <div className="flex items-center gap-2">
              {layout.status && (
                <div className="rounded-full border border-slate-600 bg-slate-800/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-200">
                  {layout.status}
                </div>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center border border-slate-600 bg-slate-800 text-slate-300 transition hover:bg-slate-700 hover:text-white"
                  aria-label="Hide disaster panel"
                  title="Hide disaster panel"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {layout.sections.map((section) => (
              <HazardSectionCard key={section.id} {...section}>
                {section.content}
              </HazardSectionCard>
            ))}
            <HazardActionBar actions={layout.actions} />
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
