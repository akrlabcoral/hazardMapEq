export const EARTHQUAKE_DAMAGE_PALETTE = [
  { id: 'extreme', label: 'Extreme', color: '#8b5a45' },
  { id: 'severe', label: 'Severe', color: '#e5e875' },
  { id: 'high', label: 'High', color: '#88d66b' },
  { id: 'moderate', label: 'Moderate', color: '#00b956' },
  { id: 'light', label: 'Light', color: '#008fd3' },
  { id: 'veryLight', label: 'Very Light', color: '#0046b8' },
  { id: 'minimal', label: 'Minimal', color: '#0b006e' },
];


export const EARTHQUAKE_DAMAGE_FILL_COLOR = [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', 'fused_hazard'], 0],
  0.0, '#0b006e',
  0.15, '#0b006e',
  0.30, '#0046b8',
  0.45, '#008fd3',
  0.60, '#00b956',
  0.75, '#88d66b',
  0.90, '#e5e875',
  1.0, '#8b5a45',
];

export const EARTHQUAKE_DAMAGE_FILL_OPACITY = [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', 'fused_hazard'], 0],
  0.0, 0.0,
  0.15, 0.32,
  0.30, 0.44,
  0.60, 0.58,
  1.0, 0.72,
];
