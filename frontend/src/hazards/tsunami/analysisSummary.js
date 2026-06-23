const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const classifyTsunamiAlertLevel = (result) => {
  const magnitude = asNumber(result?.source_model?.inputs?.magnitude);
  const maxWaveHeight = Math.max(
    0,
    ...(result?.wave_propagation?.targets || [])
      .map((target) => targetWaveHeight(target))
      .filter((value) => value != null)
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

const targetWaveHeight = (target) => (
  asNumber(target?.coastal_wave_height_m)
  ?? asNumber(target?.target?.properties?.coastal_wave_height_m)
  ?? asNumber(target?.properties?.coastal_wave_height_m)
);
const targetEta = (target) => (
  asNumber(target?.eta_minutes)
  ?? asNumber(target?.target?.properties?.eta_minutes)
  ?? asNumber(target?.properties?.eta_minutes)
  ?? Number.POSITIVE_INFINITY
);

const getTargetLabel = (target) => {
  const metadata = target?.admin_metadata || target?.metadata || {};
  const properties = target?.target?.properties || target?.properties || {};
  return (
    metadata.name ||
    metadata.state ||
    metadata.district ||
    metadata.DISTRICT ||
    metadata.STATE_UT ||
    metadata.region ||
    metadata.country ||
    properties.name ||
    properties.state ||
    properties.district ||
    properties.DISTRICT ||
    properties.STATE_UT ||
    properties.region ||
    properties.country ||
    'Unavailable'
  );
};

const getMostAffectedTarget = (targets) => {
  if (!targets.length) return null;
  return [...targets].sort((a, b) => {
    const waveDiff = (targetWaveHeight(b) ?? 0) - (targetWaveHeight(a) ?? 0);
    if (waveDiff !== 0) return waveDiff;
    return targetEta(a) - targetEta(b);
  })[0];
};

export const summarizeTsunamiAnalysis = (result) => {
  const wavePropagation = result?.wave_propagation || {};
  const targets = wavePropagation.targets || [];
  const damage = result?.damage_assessment || {};
  const economicLoss = damage.economic_loss || {};
  const mostAffectedTarget = getMostAffectedTarget(targets);
  const firstEta = targets
    .map((target) => asNumber(target.eta_minutes))
    .filter((value) => value !== null)
    .sort((a, b) => a - b)[0] ?? null;
  const maxWaveHeight = Math.max(
    0,
    ...targets
      .map((target) => targetWaveHeight(target))
      .filter((value) => value != null)
  );
  const alertLevel = classifyTsunamiAlertLevel(result);

  return {
    alertLevel,
    etaMinutes: firstEta,
    waveHeightM: maxWaveHeight || result?.inundation?.runup_height_m || null,
    affectedLocation: getTargetLabel(mostAffectedTarget),
    waveUnavailableReason: wavePropagation.is_available === false
      ? wavePropagation.metadata?.reason || 'Wave propagation did not produce coastal targets'
      : '',
    affectedPopulation: damage.affected_population ?? 0,
    economicLoss: economicLoss.estimated_total_loss ?? economicLoss.total_loss ?? 0,
    currency: economicLoss.currency || 'USD',
  };
};

export const summarizeTsunamiSimulation = summarizeTsunamiAnalysis;

export const formatMetric = (value, options = {}) => {
  const number = asNumber(value);
  if (number === null) return 'Unavailable';
  return `${number.toLocaleString(undefined, {
    maximumFractionDigits: options.digits ?? 1,
  })}${options.suffix || ''}`;
};
