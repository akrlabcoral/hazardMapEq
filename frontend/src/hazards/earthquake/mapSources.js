import { mapLayerService } from '../../services/mapLayerService';
import { EARTHQUAKE_LAYERS, EARTHQUAKE_SOURCES } from './layerMetadata';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };

const asFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const buildEpicenterFeatureCollection = (epicenter) => ({
  type: 'FeatureCollection',
  features: epicenter ? [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [epicenter.lng, epicenter.lat] },
  }] : [],
});

export const buildLiveEventsFeatureCollection = (events = []) => ({
  type: 'FeatureCollection',
  features: events
    .map((event, index) => {
      const longitude = asFiniteNumber(event.longitude ?? event.lon ?? event.lng);
      const latitude = asFiniteNumber(event.latitude ?? event.lat);
      if (longitude === null || latitude === null) return null;

      const magnitude = asFiniteNumber(event.magnitude ?? event.mag) ?? 0;
      const depth = asFiniteNumber(event.depth ?? event.depth_km);
      const place = event.place || event.location || 'Live earthquake';
      const time = event.time || event.origin_time || event.created_at || null;

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        properties: {
          id: event.id ?? index,
          source_id: event.source_id || '',
          source: event.source || '',
          magnitude,
          mag: magnitude,
          depth,
          depth_km: depth,
          place,
          location: place,
          time,
          is_relevant: Boolean(event.is_relevant),
        },
      };
    })
    .filter(Boolean),
});

export const syncLiveEarthquakesSource = (mapInstance, events) => {
  if (!mapInstance?.getStyle()) return;
  const source = mapInstance.getSource(EARTHQUAKE_SOURCES.live);
  if (source?.setData) {
    source.setData(buildLiveEventsFeatureCollection(events));
  }
};

const routeFeatures = (geojson, role) => (
  geojson?.features || []
).map((feature) => ({
  ...feature,
  properties: {
    ...(feature.properties || {}),
    evacuation_role: role,
  },
}));

const autoRouteFeatures = (autoPlans = []) => autoPlans.flatMap((entry) => (
  entry?.plan?.geojson?.features || []
).map((feature) => ({
  ...feature,
  properties: {
    ...(feature.properties || {}),
    evacuation_role: 'hospital',
    evacuation_route_type: 'auto',
    evacuation_rank: entry.rank,
    pga: entry.target?.pga,
  },
})));

export const buildEvacuationRoutesFeatureCollection = ({ plan, autoPlans = [] }) => ({
  type: 'FeatureCollection',
  features: [
    ...routeFeatures(plan?.responder_route?.geojson, 'responder'),
    ...routeFeatures(plan?.hospital_route?.geojson, 'hospital'),
    ...autoRouteFeatures(autoPlans),
  ],
});

export const buildEvacuationPointsFeatureCollection = ({ origin, target, plan, autoPlans = [] }) => {
  const features = [];
  if (origin) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [origin.lng ?? origin.lon, origin.lat] },
      properties: { evacuation_role: 'origin', label: 'Responder origin' },
    });
  }
  if (target) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [target.lng ?? target.lon, target.lat] },
      properties: { evacuation_role: 'target', label: 'Vulnerable zone' },
    });
  }
  const hospital = plan?.hospital_route?.hospital;
  if (hospital) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [hospital.lon, hospital.lat] },
      properties: { evacuation_role: 'hospital', label: hospital.name, type: hospital.type },
    });
  }
  autoPlans.forEach((entry) => {
    if (entry?.target) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [entry.target.lng ?? entry.target.lon, entry.target.lat] },
        properties: {
          evacuation_role: 'target',
          label: `Auto vulnerable zone #${entry.rank}`,
          evacuation_route_type: 'auto',
          evacuation_rank: entry.rank,
          pga: entry.target.pga,
        },
      });
    }
    const autoHospital = entry?.plan?.hospital;
    if (autoHospital) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [autoHospital.lon, autoHospital.lat] },
        properties: {
          evacuation_role: 'hospital',
          label: autoHospital.name,
          type: autoHospital.type,
          evacuation_route_type: 'auto',
          evacuation_rank: entry.rank,
        },
      });
    }
  });
  return { type: 'FeatureCollection', features };
};

export const initEvacuationLayers = (mapInstance) => {
  mapLayerService.addSourceSafe(mapInstance, EARTHQUAKE_SOURCES.evacuationRoutes, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
  });
  mapLayerService.addSourceSafe(mapInstance, EARTHQUAKE_SOURCES.evacuationPoints, {
    type: 'geojson',
    data: EMPTY_FEATURE_COLLECTION,
  });
  mapLayerService.addLayerSafe(mapInstance, {
    id: EARTHQUAKE_LAYERS.evacuationResponderRoute,
    type: 'line',
    source: EARTHQUAKE_SOURCES.evacuationRoutes,
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#2563eb',
      'line-width': ['case', ['==', ['get', 'is_best'], true], 6, 4],
      'line-opacity': ['case', ['==', ['get', 'is_best'], true], 0.95, 0.45],
    },
    filter: ['==', ['get', 'evacuation_role'], 'responder'],
  });
  mapLayerService.addLayerSafe(mapInstance, {
    id: EARTHQUAKE_LAYERS.evacuationHospitalRoute,
    type: 'line',
    source: EARTHQUAKE_SOURCES.evacuationRoutes,
    layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#22c55e',
      'line-width': ['case', ['==', ['get', 'is_best'], true], 6, 4],
      'line-opacity': ['case', ['==', ['get', 'is_best'], true], 0.95, 0.45],
    },
    filter: ['==', ['get', 'evacuation_role'], 'hospital'],
  });
  mapLayerService.addLayerSafe(mapInstance, {
    id: EARTHQUAKE_LAYERS.evacuationOrigin,
    type: 'circle',
    source: EARTHQUAKE_SOURCES.evacuationPoints,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': 8,
      'circle-color': '#2563eb',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
    filter: ['==', ['get', 'evacuation_role'], 'origin'],
  });
  mapLayerService.addLayerSafe(mapInstance, {
    id: EARTHQUAKE_LAYERS.evacuationTarget,
    type: 'circle',
    source: EARTHQUAKE_SOURCES.evacuationPoints,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': 9,
      'circle-color': '#f97316',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
    filter: ['==', ['get', 'evacuation_role'], 'target'],
  });
  mapLayerService.addLayerSafe(mapInstance, {
    id: EARTHQUAKE_LAYERS.evacuationHospital,
    type: 'circle',
    source: EARTHQUAKE_SOURCES.evacuationPoints,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius': 9,
      'circle-color': '#16a34a',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
    filter: ['==', ['get', 'evacuation_role'], 'hospital'],
  });
};

export const syncEvacuationSources = (mapInstance, { origin, target, plan, autoPlans }) => {
  if (!mapInstance?.getStyle()) return;
  const routesSource = mapInstance.getSource(EARTHQUAKE_SOURCES.evacuationRoutes);
  if (routesSource?.setData) routesSource.setData(buildEvacuationRoutesFeatureCollection({ plan, autoPlans }));
  const pointsSource = mapInstance.getSource(EARTHQUAKE_SOURCES.evacuationPoints);
  if (pointsSource?.setData) pointsSource.setData(buildEvacuationPointsFeatureCollection({ origin, target, plan, autoPlans }));
};
