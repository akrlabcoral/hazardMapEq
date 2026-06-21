import React from 'react';
import { AlertTriangle, Archive, Radio, Waves } from 'lucide-react';

const PANEL_CONFIG = {
  alerts: {
    icon: AlertTriangle,
    message: 'No tsunami alerts',
  },
  live: {
    icon: Radio,
    message: 'No live tsunami events',
  },
  historic: {
    icon: Archive,
    message: 'No historic tsunami records',
  },
};

export default function TsunamiEmptyPanel({ type = 'alerts' }) {
  const config = PANEL_CONFIG[type] || PANEL_CONFIG.alerts;
  const Icon = config.icon || Waves;

  return (
    <div className="p-6 h-full flex flex-col items-center justify-center text-slate-400 min-h-[260px]">
      <Icon size={44} className="mb-4 text-cyan-400/50" strokeWidth={1.4} />
      <p className="text-sm font-medium text-slate-300">{config.message}</p>
    </div>
  );
}
