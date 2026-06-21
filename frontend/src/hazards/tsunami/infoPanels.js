const UNKNOWN = 'Unknown';

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatNumber = (value, digits = 2, suffix = '') => {
  const number = asNumber(value);
  if (number === null) return UNKNOWN;
  return `${number.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}`;
};

const rows = (items) => items
  .filter((item) => item.value !== undefined && item.value !== null && item.value !== '')
  .map((item) => ({ label: item.label, value: String(item.value) }));

export const tsunamiAccentForLevel = (level) => {
  switch (level) {
    case 'Very Low': return '#22c55e';
    case 'Low': return '#eab308';
    case 'Moderate': return '#f97316';
    case 'High': return '#ef4444';
    case 'Very High': return '#7f1d1d';
    default: return '#38bdf8';
  }
};

export const buildTsunamiInfoPanel = (result, source = null) => {
  if (!result) return null;
  const potential = result.tsunami_potential_class || {};
  const coordinates = source ? `${source.lat.toFixed(4)}, ${source.lng.toFixed(4)}` : null;

  return {
    type: 'tsunami',
    title: `${potential.level || 'Tsunami'} Potential`,
    subtitle: 'Tsunami estimate',
    accent: tsunamiAccentForLevel(potential.level),
    sections: [
      {
        title: 'Tsunami Estimate',
        rows: rows([
          { label: 'Potential', value: potential.description ? `${potential.level} / ${potential.description}` : potential.level },
          { label: 'Speed', value: formatNumber(result.tsunami_speed_kmh, 1, ' km/h') },
          { label: 'Wavelength', value: formatNumber(result.wavelength_m / 1000, 1, ' km') },
          { label: 'Initial height', value: result.initial_wave_height_m === null ? null : formatNumber(result.initial_wave_height_m, 2, ' m') },
          { label: 'Abe Mt', value: result.abe_tsunami_magnitude === null ? null : formatNumber(result.abe_tsunami_magnitude, 2) },
          { label: 'Run-up', value: result.estimated_runup_m === null ? null : formatNumber(result.estimated_runup_m, 2, ' m') },
          { label: 'Coordinates', value: coordinates },
        ]),
      },
    ],
  };
};

export const buildTsunamiFeatureInfoPanel = (feature) => {
  const props = feature?.properties || {};
  const source = feature?.geometry?.coordinates
    ? { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] }
    : null;
  let result = props;
  if (props.result) {
    try {
      result = JSON.parse(props.result);
    } catch (_err) {
      result = props;
    }
  }
  return buildTsunamiInfoPanel(result, source);
};
