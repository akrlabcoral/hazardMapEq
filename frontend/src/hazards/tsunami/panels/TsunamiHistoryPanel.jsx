import React from 'react';
import { Clock } from 'lucide-react';

import useStore from '../../../store/useStore';
import { formatMetric, summarizeTsunamiAnalysis } from '../analysisSummary';

export default function TsunamiHistoryPanel() {
  const history = useStore((state) => state.tsunamiAnalysisHistory || []);
  const setTsunamiAnalysisResult = useStore((state) => state.setTsunamiAnalysisResult);
  const forceActivePanel = useStore((state) => state.forceActivePanel);

  if (!history.length) {
    return (
      <div className="rounded border border-slate-700/70 bg-slate-900/50 p-4 text-sm text-slate-400">
        No historic tsunami records
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((result, index) => {
        const summary = summarizeTsunamiAnalysis(result);
        return (
          <button
            key={result.request_id || index}
            type="button"
            onClick={() => {
              setTsunamiAnalysisResult(result);
              forceActivePanel('results');
            }}
            className="w-full rounded border border-slate-700/70 bg-slate-900/60 p-3 text-left transition hover:bg-slate-800"
          >
            <div className="flex items-center justify-between gap-2 text-sm font-bold text-white">
              <span>{summary.alertLevel}</span>
              <Clock className="h-4 w-4 text-slate-500" />
            </div>
            <div className="mt-1 text-xs text-slate-400">
              ETA {formatMetric(summary.etaMinutes, { digits: 0, suffix: ' min' })} · Wave {formatMetric(summary.waveHeightM, { digits: 2, suffix: ' m' })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
