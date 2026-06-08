const RISK_THRESHOLDS = {
  EXTREME:  0.8,
  SEVERE:   0.6,
  HIGH:     0.4,
  MODERATE: 0.2,
};

// Based on backend/app/config.py
const PGA_LEVELS = [
  0.001,   // < 0.001g : essentially zero shaking
  0.02,    // I–III    : No perceptible effect
  0.115,   // IV–V     : Light
  0.215,   // VI       : Moderate
  0.401,   // VII      : Strong
  0.747,   // VIII     : Very Strong
  1.39,    // IX       : Severe
];

const PGA_LABELS = [
  "No Effect",     // < 0.02
  "Light",         // 0.02 – 0.115
  "Moderate",      // 0.115 – 0.215
  "Strong",        // 0.215 – 0.401
  "Very Strong",   // 0.401 – 0.747
  "Severe",        // 0.747 – 1.39
  "Violent",       // > 1.39
];

export function classifyRisk(pga) {
  if (pga > RISK_THRESHOLDS.EXTREME) return "EXTREME";
  if (pga > RISK_THRESHOLDS.SEVERE) return "SEVERE";
  if (pga > RISK_THRESHOLDS.HIGH) return "HIGH";
  if (pga > RISK_THRESHOLDS.MODERATE) return "MODERATE";
  return "LOW";
}

export function getIntensityLabel(pga) {
  for (let i = 0; i < PGA_LEVELS.length; i++) {
    if (pga < PGA_LEVELS[i]) {
      return PGA_LABELS[Math.max(0, i - 1)];
    }
  }
  return PGA_LABELS[PGA_LABELS.length - 1];
}

export function getDamageIndex(pga) {
  // Matching the aggregator: min(int(pga * 100), 100) 
  // Wait, aggregator does avg_pga * 50 + max_pga * 50
  // Locally, avg_pga == max_pga, so it's pga * 100
  return Math.min(Math.floor(pga * 100), 100);
}

export function getRiskColorText(risk) {
  switch (risk) {
    case 'EXTREME': return 'text-purple-500';
    case 'SEVERE': return 'text-red-500';
    case 'HIGH': return 'text-orange-500';
    case 'MODERATE': return 'text-yellow-500';
    default: return 'text-slate-400';
  }
}
