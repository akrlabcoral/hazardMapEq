import { EARTHQUAKE_SOURCES } from './layerMetadata';

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
