import React from 'react';
import { AlertTriangle } from 'lucide-react';

import useStore from '../../../store/useStore';
import { getTsunamiAlertColor } from '../analysisSummary';

export default function TsunamiAlertsPanel() {
  const alerts = useStore((state) => state.tsunamiAlerts || []);

  if (!alerts.length) {
    return (
      <div className="rounded border border-slate-700/70 bg-slate-900/50 p-4 text-sm text-slate-400">
        No tsunami alerts
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => {
        const color = getTsunamiAlertColor(alert.level);
        return (
          <div key={alert.id || index} className="rounded border bg-slate-900/60 p-3" style={{ borderColor: `${color}88` }}>
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <AlertTriangle className="h-4 w-4" style={{ color }} />
              {alert.level || 'Tsunami Alert'}
            </div>
            <div className="mt-1 text-xs text-slate-400">{alert.message || 'No additional details'}</div>
          </div>
        );
      })}
    </div>
  );
}
