import React, { useEffect, useRef, useState } from 'react';
import { Layers } from 'lucide-react';
import { LayersPanel } from '../panels/LayersPanel';

export default function MapLayersControl({ isAdmin = true }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="absolute top-13 right-2 z-30 pointer-events-auto">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={`flex h-10 w-10 items-center justify-center square-full border border-slate-700/60 bg-slate-900/80 text-slate-300 shadow-lg backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
          isOpen ? 'bg-slate-700/80 text-white' : ''
        }`}
        aria-label="Map layers"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title="Map Layers"
      >
        <Layers className="h-5 w-5" strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-xl border border-slate-700/60 bg-slate-900/90 p-3 shadow-[0_0_30px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="mb-3 border-b border-slate-700/50 pb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-200">
            Map Layers
          </div>
          <LayersPanel isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}
