import { SIM_LAYERS } from '../config/simulationLayers';

const SOURCE_IDS = {
  historicEarthquakes: 'historic-earthquakes-source',
};

const registry = new Map();

const UNKNOWN = 'Unknown';

const INSPECTION_LAYER_PRIORITY = [
  'historic-clusters',
  'historic-cluster-count',
  'historic-unclustered-point',
  'live-earthquake-point',
  'live-earthquakes-point',
  'live-event-point',
  'live-events-point',
  'gps-vectors-circle',
  'gps-vectors-head',
  'gps-vectors-line',
  'tectonic-plates-line',
  SIM_LAYERS.SOIL_AMP,
  SIM_LAYERS.INTENSITY_FILL,
  SIM_LAYERS.WB_GRID_FILL,
  SIM_LAYERS.CONTOUR_FILL,
  'state-boundaries-fill',
];

const inspectionPriority = new Map(
  INSPECTION_LAYER_PRIORITY.map((layerId, index) => [layerId, index])
);

const isPresent = (value) => value !== undefined && value !== null && value !== '';

const asNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatNumber = (value, digits = 2) => {
  const num = asNumber(value);
  return num === null ? UNKNOWN : num.toLocaleString(undefined, { maximumFractionDigits: digits });
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

const pointCoordinates = (feature, fallbackLngLat) => {
  const coordinates = feature?.geometry?.type === 'Point' ? feature.geometry.coordinates : null;
  const lng = asNumber(coordinates?.[0] ?? fallbackLngLat?.lng);
  const lat = asNumber(coordinates?.[1] ?? fallbackLngLat?.lat);
  if (lng === null || lat === null) return null;
  return { lng, lat };
};

const formatCoordinates = (coordinates) => {
  if (!coordinates) return UNKNOWN;
  return `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`;
};

const rows = (items) => items
  .filter((item) => isPresent(item.value))
  .map((item) => ({ label: item.label, value: String(item.value) }));

const classifyIntensity = (pgaValue) => {
  const pga = asNumber(pgaValue);
  if (pga === null) return null;
  const mmi = 3.66 * Math.log10(Math.max(pga * 980.665, 1e-9)) - 1.66;
  if (mmi < 2.5) return 'I-II';
  if (mmi < 3.5) return 'III';
  if (mmi < 4.5) return 'IV';
  if (mmi < 5.5) return 'V';
  if (mmi < 6.5) return 'VI';
  if (mmi < 7.5) return 'VII';
  if (mmi < 8.5) return 'VIII';
  if (mmi < 9.5) return 'IX';
  return 'X+';
};

const contourIntensityLabel = (props) => {
  if (isPresent(props.intensity)) return props.intensity;
  const title = String(props.title || props.name || props.description || '');
  if (title.includes('X+')) return 'X+';
  const romanMatch = title.match(/\b(I-II|III|IV|V|VI|VII|VIII|IX)\b/);
  if (romanMatch) return romanMatch[1];
  return null;
};

export const registerInspector = (inspector) => {
  inspector.layerIds.forEach((layerId) => {
    registry.set(layerId, inspector);
  });
};

export const getInspectableLayerIds = () => Array.from(registry.keys());

export const inspectFeature = (feature, lngLat) => {
  const inspector = registry.get(feature?.layer?.id);
  if (!inspector) return null;
  return inspector.inspect(feature, lngLat);
};

export const sortInspectionFeatures = (features) => [...features].sort((a, b) => {
  const aPriority = inspectionPriority.get(a?.layer?.id) ?? Number.MAX_SAFE_INTEGER;
  const bPriority = inspectionPriority.get(b?.layer?.id) ?? Number.MAX_SAFE_INTEGER;
  return aPriority - bPriority;
});

export const getClusterExpansion = (feature) => {
  if (!['historic-clusters', 'historic-cluster-count'].includes(feature?.layer?.id)) return null;
  const clusterId = feature.properties?.cluster_id;
  if (!isPresent(clusterId)) return null;
  return {
    sourceId: SOURCE_IDS.historicEarthquakes,
    clusterId: Number(clusterId),
    center: feature.geometry?.coordinates,
  };
};

registerInspector({
  id: 'historicCluster',
  layerIds: ['historic-clusters', 'historic-cluster-count'],
  inspect: () => null,
});

registerInspector({
  id: 'state',
  layerIds: ['state-boundaries-fill'],
  inspect: (feature) => {
    const props = feature.properties || {};
    const stateName = props.state || props.STATE || props.name || props.NAME || UNKNOWN;

    return {
      type: 'state',
      title: stateName,
      subtitle: 'State',
      accent: '#38bdf8',
      sections: [
        {
          title: 'State',
          rows: rows([
            { label: 'State name', value: stateName },
          ]),
        },
      ],
    };
  },
});

registerInspector({
  id: 'historicEarthquake',
  layerIds: ['historic-unclustered-point'],
  inspect: (feature, lngLat) => {
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
  },
});

registerInspector({
  id: 'liveEarthquake',
  layerIds: ['live-earthquake-point', 'live-earthquakes-point', 'live-event-point', 'live-events-point'],
  inspect: (feature, lngLat) => {
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
  },
});

registerInspector({
  id: 'hazardZone',
  layerIds: [SIM_LAYERS.WB_GRID_FILL, SIM_LAYERS.CONTOUR_FILL, SIM_LAYERS.SOIL_AMP, SIM_LAYERS.INTENSITY_FILL],
  inspect: (feature) => {
    const props = feature.properties || {};
    if (feature.layer?.id === SIM_LAYERS.INTENSITY_FILL) {
      const intensity = contourIntensityLabel(props);
      return {
        type: 'hazardZone',
        title: intensity ? `Intensity ${intensity}` : 'Intensity zone',
        subtitle: 'MMI intensity',
        accent: props.fill || '#ffec7d',
        sections: [
          {
            title: 'Intensity',
            rows: rows([
              { label: 'Intensity', value: intensity },
            ]),
          },
        ],
      };
    }

    const zoneName = props.zone_name || props.state || props.name || 'Hazard zone';
    const riskLevel = props.risk_category || props.risk_level || props.category;
    const localPga = props.pga_final ?? props.local_pga;

    return {
      type: 'hazardZone',
      title: zoneName,
      subtitle: 'Hazard zone',
      accent: '#facc15',
      sections: [
        {
          title: 'Hazard Zone',
          rows: rows([
            { label: 'Risk level', value: riskLevel },
            { label: 'Intensity', value: props.intensity || classifyIntensity(localPga) },
            { label: 'MMI', value: props.mmi ? formatNumber(props.mmi, 2) : null },
            { label: 'Local PGA', value: localPga ? `${formatNumber(localPga, 4)}g` : null },
            { label: 'Base PGA', value: props.pga_base ? `${formatNumber(props.pga_base, 4)}g` : null },
            { label: 'Site class', value: props.site_class },
            { label: 'Population', value: props.population ? formatNumber(props.population, 0) : null },
          ]),
        },
      ],
    };
  },
});

registerInspector({
  id: 'tectonicPlate',
  layerIds: ['tectonic-plates-line'],
  inspect: (feature) => {
    const props = feature.properties || {};
    const type = props.Boundary_Type || props.boundary_type || UNKNOWN;

    return {
      type: 'tectonicPlate',
      title: 'Plate Boundary',
      subtitle: type,
      accent: '#fb923c',
      sections: [
        {
          title: 'Plate Boundary',
          rows: rows([
            { label: 'Boundary type', value: type },
          ]),
        },
      ],
    };
  },
});

registerInspector({
  id: 'gpsVector',
  layerIds: ['gps-vectors-circle', 'gps-vectors-line', 'gps-vectors-head'],
  inspect: (feature) => {
    const props = feature.properties || {};

    return {
      type: 'gpsVector',
      title: props.station || 'GPS Vector',
      subtitle: props.type || 'GPS velocity',
      accent: '#ef4444',
      sections: [
        {
          title: 'GPS Velocity',
          rows: rows([
            { label: 'Station', value: props.station },
            { label: 'Vector type', value: props.type },
            { label: 'Magnitude', value: props.magnitude },
          ]),
        },
      ],
    };
  },
});
