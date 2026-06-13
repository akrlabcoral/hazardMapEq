export const MMI_INTENSITY_PALETTE = [
  { id: 'iII', label: 'I-II', color: '#ffffff' },
  { id: 'iii', label: 'III', color: '#bfccff' },
  { id: 'iv', label: 'IV', color: '#a0e6ff' },
  { id: 'v', label: 'V', color: '#80ffff' },
  { id: 'vi', label: 'VI', color: '#7cd37c' },
  { id: 'vii', label: 'VII', color: '#ffec7d' },
  { id: 'viii', label: 'VIII', color: '#ffb834' },
  { id: 'ix', label: 'IX', color: '#ff6666' },
  { id: 'xPlus', label: 'X+', color: '#cc0000' },
];

export const MMI_INTENSITY_FILL_COLOR = [
  'step',
  ['coalesce', ['get', 'mmi'], 0],
  '#ffffff',
  2.5, '#bfccff',
  3.5, '#a0e6ff',
  4.5, '#80ffff',
  5.5, '#7cd37c',
  6.5, '#ffec7d',
  7.5, '#ffb834',
  8.5, '#ff6666',
  9.5, '#cc0000',
];

export const MMI_INTENSITY_FILL_OPACITY = [
  'interpolate',
  ['linear'],
  ['coalesce', ['get', 'mmi'], 0],
  1.0, 0.0,
  2.5, 0.34,
  4.5, 0.52,
  6.5, 0.7,
  8.5, 0.84,
  10.0, 0.9,
];
