const UNKNOWN = 'Unknown';

const isPresent = (value) => value !== undefined && value !== null && value !== '';

const asNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatMagnitude = (value) => {
  const num = asNumber(value);
  return num === null ? UNKNOWN : `M ${num.toFixed(1)}`;
};

const formatDepth = (value) => {
  const num = asNumber(value);
  return num === null ? UNKNOWN : `${num.toFixed(1)} km`;
};

const formatDateTime = (value) => {
  if (!value) return UNKNOWN;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return UNKNOWN;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const rows = (items) => items
  .filter((item) => isPresent(item.value))
  .map((item) => ({ label: item.label, value: String(item.value) }));

export const coordinatesFromEvent = (event) => {
  const lat = asNumber(event?.latitude ?? event?.lat);
  const lng = asNumber(event?.longitude ?? event?.lng);
  if (lat === null || lng === null) return null;
  return { lat, lng };
};

export const pointCoordinates = (feature, fallbackLngLat) => {
  const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  const lng = asNumber(coordinates?.[0] ?? fallbackLngLat?.lng);
  const lat = asNumber(coordinates?.[1] ?? fallbackLngLat?.lat);
  if (lng === null || lat === null) return null;
  return { lng, lat };
};

export const formatCoordinates = (coordinates) => {
  if (!coordinates) return UNKNOWN;
  return `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
};

export const buildLiveEarthquakeInfoPanel = (event) => {
  if (!event) return null;
  const coordinates = coordinatesFromEvent(event);

  return {
    type: 'liveEarthquake',
    title: formatMagnitude(event.mag ?? event.magnitude),
    subtitle: event.place || event.location || 'Live earthquake',
    accent: '#ef4444',
    sections: [
      {
        title: 'Live Earthquake',
        rows: rows([
          { label: 'Magnitude', value: formatMagnitude(event.mag ?? event.magnitude) },
          { label: 'Time', value: formatDateTime(event.time ?? event.origin_time) },
          { label: 'Depth', value: formatDepth(event.depth ?? event.depth_km) },
          { label: 'Coordinates', value: formatCoordinates(coordinates) },
        ]),
      },
    ],
  };
};

export const buildLiveEarthquakeFeatureInfoPanel = (feature, lngLat) => {
  const props = feature.properties || {};
  const coordinates = pointCoordinates(feature, lngLat);

  return {
    type: 'liveEarthquake',
    title: formatMagnitude(props.mag ?? props.magnitude),
    subtitle: props.place || props.location || 'Live earthquake',
    accent: '#ef4444',
    sections: [
      {
        title: 'Live Earthquake',
        rows: rows([
          { label: 'Magnitude', value: formatMagnitude(props.mag ?? props.magnitude) },
          { label: 'Time', value: formatDateTime(props.time) },
          { label: 'Depth', value: formatDepth(props.depth) },
          { label: 'Coordinates', value: formatCoordinates(coordinates) },
        ]),
      },
    ],
  };
};

export const buildHistoricEarthquakeFeatureInfoPanel = (feature, lngLat) => {
  const props = feature.properties || {};
  const coordinates = pointCoordinates(feature, lngLat);
  const location = props.place || props.location || formatCoordinates(coordinates);

  return {
    type: 'historicEarthquake',
    title: formatMagnitude(props.mag ?? props.magnitude),
    subtitle: location,
    accent: '#f97316',
    sections: [
      {
        title: 'Historic Earthquake',
        rows: rows([
          { label: 'Magnitude', value: formatMagnitude(props.mag ?? props.magnitude) },
          { label: 'Date/Time', value: formatDateTime(props.time) },
          { label: 'Depth', value: formatDepth(props.depth) },
          { label: 'Coordinates', value: formatCoordinates(coordinates) },
        ]),
      },
    ],
  };
};

export const buildSimulationInfoPanel = (result, epicenter, event = null) => {
  if (!result?.grid_geojson?.type) return null;
  const coordinates = coordinatesFromEvent(event) || epicenter;

  return {
    type: 'simulation',
    title: 'Simulation Complete',
    subtitle: result.triggered_by === 'manual' ? 'Manual simulation' : 'Live simulation',
    accent: '#ef4444',
    sections: [
      {
        title: 'Completed Simulation',
        rows: rows([
          { label: 'Magnitude', value: formatMagnitude(event?.mag ?? event?.magnitude) },
          { label: 'Depth', value: formatDepth(event?.depth ?? event?.depth_km) },
          { label: 'Coordinates', value: formatCoordinates(coordinates) },
        ]),
      },
    ],
  };
};

