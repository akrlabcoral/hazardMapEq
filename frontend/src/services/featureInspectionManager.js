import { SIM_LAYERS } from '../config/simulationLayers';
import {
  buildLiveEarthquakeInfoPanel,
  buildSimulationInfoPanel,
  EARTHQUAKE_LAYERS,
  EARTHQUAKE_SOURCES,
  earthquakeInspectionProvider,
} from '../hazards/earthquake';
import { TSUNAMI_LAYERS, tsunamiInspectionProvider } from '../hazards/tsunami';

const registry = new Map();

const UNKNOWN = 'Unknown';

const INSPECTION_LAYER_PRIORITY = [
  EARTHQUAKE_LAYERS.historicClusters,
  EARTHQUAKE_LAYERS.historicClusterCount,
  EARTHQUAKE_LAYERS.livePoint,
  ...EARTHQUAKE_LAYERS.legacyLivePointIds,
  EARTHQUAKE_LAYERS.historicPoint,
  TSUNAMI_LAYERS.marker,
  'gps-vectors-circle',
  'gps-vectors-head',
  'gps-vectors-line',
  'tectonic-plates-line',
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

const rows = (items) => items
  .filter((item) => isPresent(item.value))
  .map((item) => ({ label: item.label, value: String(item.value) }));

export { buildLiveEarthquakeInfoPanel, buildSimulationInfoPanel };

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

export const registerInspectionProvider = (provider) => {
  provider.inspectors.forEach(registerInspector);
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
  if (![EARTHQUAKE_LAYERS.historicClusters, EARTHQUAKE_LAYERS.historicClusterCount].includes(feature?.layer?.id)) return null;
  const clusterId = feature.properties?.cluster_id;
  if (!isPresent(clusterId)) return null;
  return {
    sourceId: EARTHQUAKE_SOURCES.historic,
    clusterId: Number(clusterId),
    center: feature.geometry?.coordinates,
  };
};

registerInspectionProvider(earthquakeInspectionProvider);
registerInspectionProvider(tsunamiInspectionProvider);

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
  id: 'hazardZone',
  layerIds: [SIM_LAYERS.WB_GRID_FILL, SIM_LAYERS.CONTOUR_FILL, SIM_LAYERS.INTENSITY_FILL],
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
            { label: 'MMI', value: props.mmi ? formatNumber(props.mmi, 2) : null },
            { label: 'Local PGA', value: localPga ? `${formatNumber(localPga, 4)}g` : null },
            { label: 'Base PGA', value: props.pga_base ? `${formatNumber(props.pga_base, 4)}g` : null },
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
            { label: 'Azimuth', value: props.azimuth },
          ]),
        },
      ],
    };
  },
});
