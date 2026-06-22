import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Navigation, Star, Waves } from 'lucide-react';

import { getLegendItemById } from '../config/legendConfig';
import useStore from '../store/useStore';

const renderSymbol = (item) => {
  if (item.symbol === 'star') {
    return (
      <Star
        className="h-4 w-4 text-white stroke-[1.5px]"
        style={{
          fill: item.color,
          filter: item.glowColor ? `drop-shadow(0 0 4px ${item.glowColor})` : undefined,
        }}
      />
    );
  }

  if (item.symbol === 'waves') {
    return (
      <span
        className="flex h-4 w-4 items-center justify-center rounded-full border border-white"
        style={{
          backgroundColor: item.color,
          boxShadow: item.glowColor ? `0 0 10px ${item.glowColor}` : undefined,
        }}
      >
        <Waves className="h-3 w-3 text-white" strokeWidth={2.2} />
      </span>
    );
  }

  return null;
};

const LegendSwatch = ({ item }) => {
  if (item.type === 'circle') {
    return (
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full border"
        style={{
          backgroundColor: item.color,
          borderColor: item.strokeColor || 'rgba(255,255,255,0.8)',
        }}
      />
    );
  }

  if (item.type === 'line') {
    return <span className="h-0.5 w-7 shrink-0" style={{ backgroundColor: item.color }} />;
  }

  if (item.type === 'arrowLine') {
    return (
      <span className="relative ml-[-6px] mr-1 h-0.5 w-6 shrink-0" style={{ backgroundColor: item.color }}>
        <Navigation
          className="absolute right-[-7px] top-1/2 h-3 w-3 -translate-y-1/2 rotate-90"
          style={{ color: item.color, fill: item.color }}
        />
      </span>
    );
  }

  if (item.type === 'symbol') return renderSymbol(item);
  return null;
};

const LegendRow = ({ item }) => (
  <div className="mt-1.5 flex items-center gap-2.5">
    <LegendSwatch item={item} />
    <span className="whitespace-pre-line text-white">{item.label}</span>
  </div>
);

const PaletteLegend = ({ item }) => (
  <div className="mt-3 border-t border-slate-700/40 pt-3">
    <div className="mb-2 text-[10px] uppercase tracking-wider text-white">{item.label}</div>
    <div className={`grid gap-x-2 gap-y-1.5 ${item.columns === 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
      {item.palette.map((entry) => (
        <div key={entry.id || entry.label} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/20"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-400">{entry.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const GradientLegend = ({ item }) => {
  const gradient = `linear-gradient(to right, ${item.palette.map((entry) => entry.color).join(', ')})`;
  return (
    <div className="mt-3 border-t border-slate-700/40 pt-3">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-white">{item.label}</div>
      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-white">
        <span>{item.startLabel}</span>
        <span>{item.endLabel}</span>
      </div>
      <div
        className="h-3 rounded-full border border-white/20 shadow-[0_0_8px_rgba(14,165,233,0.25)]"
        style={{ background: gradient }}
      />
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {item.palette.map((entry) => (
          <div key={entry.id || entry.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">{entry.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const GroupLegend = ({ item }) => (
  <div className="mt-3 border-t border-slate-700/40 pt-3">
    <div className="mb-2 text-[10px] uppercase tracking-wider text-white">{item.label}</div>
    {item.items.map((child) => (
      <LegendRow key={child.label} item={child} />
    ))}
  </div>
);

const LegendItem = ({ item }) => {
  if (item.type === 'gradient') return <GradientLegend item={item} />;
  if (item.type === 'palette') return <PaletteLegend item={item} />;
  if (item.type === 'group') return <GroupLegend item={item} />;
  return <LegendRow item={item} />;
};

export default function MapLegend() {
  const [isVisible, setIsVisible] = useState(true);
  const activeHazard = useStore((state) => state.activeHazard);
  const visibleLegendItems = useStore((state) => state.visibleLegendItems);
  const legendItems = useMemo(
    () => visibleLegendItems
      .map((itemId) => getLegendItemById(itemId, activeHazard))
      .filter(Boolean),
    [activeHazard, visibleLegendItems]
  );

  return (
    <div className="absolute top-25 right-2.5 z-20 flex flex-col items-end justify-end gap-2 pointer-events-auto">
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        className="flex items-center justify-center rounded-full border border-slate-700/60 bg-slate-900/80 p-2.5 text-slate-400 shadow-lg backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-white"
        title={isVisible ? 'Hide Legend' : 'Show Legend'}
      >
        {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 text-xs shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <h3
              className="mb-3 border-b border-slate-700/50 pb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-200"
              style={{ textShadow: '0 0 10px rgba(6,182,212,0.3)' }}
            >
              MAP LEGEND
            </h3>
            <div className="space-y-2.5">
              {legendItems.length === 0 ? (
                <div className="text-xs italic text-slate-500">No visible map layers</div>
              ) : (
                legendItems.map((item) => <LegendItem key={item.id} item={item} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
