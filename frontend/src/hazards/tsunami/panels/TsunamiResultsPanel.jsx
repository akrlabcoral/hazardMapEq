import React from 'react';
import { AlertTriangle, Clock, DollarSign, Users, Waves } from 'lucide-react';

import useStore from '../../../store/useStore';
import { formatMetric, getTsunamiAlertColor, summarizeTsunamiAnalysis } from '../analysisSummary';

const MetricCard = ({ icon: Icon, label, value, accent = '#38bdf8' }) => (
  <div className="rounded border border-slate-700/70 bg-slate-900/60 p-3">
    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
      <Icon className="h-4 w-4" style={{ color: accent }} />
      {label}
    </div>
    <div className="font-mono text-lg font-bold text-white">{value}</div>
  </div>
);

export default function TsunamiResultsPanel() {
  const result = useStore((state) => state.tsunamiAnalysisResult);
  const status = useStore((state) => state.tsunamiAnalysisStatus);
  const error = useStore((state) => state.tsunamiAnalysisError);

  if (!result) {
    return (
      <div className="rounded border border-slate-700/70 bg-slate-900/50 p-4 text-sm text-slate-400">
        No tsunami analysis result yet. Run an analysis from the input panel.
        {status && status !== 'idle' && <div className="mt-2 font-mono text-xs text-slate-500">Status: {status}</div>}
        {error && <div className="mt-2 text-red-300">{error}</div>}
      </div>
    );
  }

  const summary = summarizeTsunamiAnalysis(result);
  const alertColor = getTsunamiAlertColor(summary.alertLevel);

  return (
    <div className="space-y-3">
      <div className="rounded border p-3" style={{ borderColor: `${alertColor}88`, backgroundColor: `${alertColor}22` }}>
        <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white">
          <AlertTriangle className="h-4 w-4" style={{ color: alertColor }} />
          {summary.alertLevel}
        </div>
        <div className="mt-1 text-xs text-slate-300">
          Simplified empirical tsunami analysis. Not an official warning product.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Clock} label="ETA" value={formatMetric(summary.etaMinutes, { digits: 0, suffix: ' min' })} accent={alertColor} />
        <MetricCard icon={Waves} label="Wave Height" value={formatMetric(summary.waveHeightM, { digits: 2, suffix: ' m' })} accent="#38bdf8" />
        <MetricCard icon={Users} label="Affected Pop." value={formatMetric(summary.affectedPopulation, { digits: 0 })} accent="#facc15" />
        <MetricCard icon={DollarSign} label="Economic Loss" value={`${summary.currency} ${formatMetric(summary.economicLoss, { digits: 0 })}`} accent="#22c55e" />
      </div>
    </div>
  );
}
