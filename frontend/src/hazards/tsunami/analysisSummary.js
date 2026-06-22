const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const classifyTsunamiAlertLevel = (result) => {
  const magnitude = asNumber(result?.source_model?.inputs?.magnitude);
  const maxWaveHeight = Math.max(
    0,
    ...(result?.wave_propagation?.targets || [])
      .map((target) => asNumber(target.coastal_wave_height_m))
      .filter((value) => value !== null)
  );

  if (magnitude >= 8 || maxWaveHeight >= 5) return 'EVACUATE';
  if (magnitude >= 7.5 || maxWaveHeight >= 2) return 'WARNING';
  if (magnitude >= 6.5 || maxWaveHeight > 0) return 'WATCH';
  return 'INFORMATION';
};

export const getTsunamiAlertColor = (level) => {
  switch (level) {
    case 'EVACUATE': return '#7f1d1d';
    case 'WARNING': return '#ef4444';
    case 'WATCH': return '#f97316';
    default: return '#38bdf8';
  }
};

export const summarizeTsunamiAnalysis = (result) => {
  const targets = result?.wave_propagation?.targets || [];
  const damage = result?.damage_assessment || {};
  const economicLoss = damage.economic_loss || {};
  const firstEta = targets
    .map((target) => asNumber(target.eta_minutes))
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0] ?? null;
  const maxWaveHeight = Math.max(
    0,
    ...targets
      .map((target) => asNumber(target.coastal_wave_height_m))
      .filter((value) => value !== null)
  );
  const alertLevel = classifyTsunamiAlertLevel(result);

  return {
    alertLevel,
    etaMinutes: firstEta,
    waveHeightM: maxWaveHeight || result?.inundation?.runup_height_m || null,
    affectedPopulation: damage.affected_population ?? 0,
    economicLoss: economicLoss.estimated_total_loss ?? economicLoss.total_loss ?? 0,
    currency: economicLoss.currency || 'USD',
  };
};

export const formatMetric = (value, options = {}) => {
  const number = asNumber(value);
  if (number === null) return 'Unavailable';
  return `${number.toLocaleString(undefined, {
    maximumFractionDigits: options.digits ?? 1,
  })}${options.suffix || ''}`;
};
