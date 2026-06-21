// Static layer configurations for MapLibre

export const GPS_VECTOR_ARROW_ICON_ID = 'gps-vector-arrow-icon';
export const GPS_VECTOR_COLOR = '#f2ff00';
const GPS_VECTOR_LENGTH_SCALE = 4;

const scaleGpsVectorData = (data) => {
  if (!data?.features) return data;

  const scaledVectorEnds = new Map();
  const features = data.features.map((feature) => {
    if (feature?.properties?.type !== 'vector' || feature.geometry?.type !== 'LineString') {
      return feature;
    }

    const coordinates = feature.geometry.coordinates;
    const start = coordinates?.[0];
    const end = coordinates?.[coordinates.length - 1];
    if (!start || !end) return feature;

    const scaledEnd = [
      start[0] + (end[0] - start[0]) * GPS_VECTOR_LENGTH_SCALE,
      start[1] + (end[1] - start[1]) * GPS_VECTOR_LENGTH_SCALE,
    ];
    const station = feature.properties?.station;
    if (station) {
      scaledVectorEnds.set(station, scaledEnd);
    }

    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: [start, scaledEnd],
      },
    };
  });

  return {
    ...data,
    features: features.map((feature) => {
      if (feature?.properties?.type !== 'head' || feature.geometry?.type !== 'Point') {
        return feature;
      }

      const scaledEnd = scaledVectorEnds.get(feature.properties?.station);
      if (!scaledEnd) return feature;

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: scaledEnd,
        },
      };
    }),
  };
};

export const LAYER_CONFIGS = {
  indiaBoundary: {
    sourceId: 'india-boundary-source',
    dataUrl: 'india_boundary.geojson',
    layers: [
      {
        id: 'india-boundary-fill',
        type: 'fill',
        source: 'india-boundary-source',
        beforeId: 'sim-wb-grid-fill',
        paint: {
          'fill-color': '#0f172a',
          'fill-opacity': 0.08
        }
      },
      {
        id: 'india-boundary-line',
        type: 'line',
        source: 'india-boundary-source',
        beforeId: 'sim-wb-grid-fill',
        paint: {
          'line-color': '#000000',
          'line-width': 1.0,
          'line-opacity': 1.0
        }
      }
    ]
  },
  stateBoundaries: {
    sourceId: 'state-boundaries-source',
    dataUrl: 'india_states.geojson',
    promoteId: 'id',
    layers: [
      {
        id: 'state-boundaries-fill',
        type: 'fill',
        source: 'state-boundaries-source',
        beforeId: 'sim-wb-grid-fill',
        paint: {
          'fill-color': '#0ea5e9',
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            0.1, // Slight glow on hover
            0.0 // Transparent otherwise
          ]
        }
      },
      {
        id: 'state-boundaries-line',
        type: 'line',
        source: 'state-boundaries-source',
        beforeId: 'sim-wb-grid-fill',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#000000', // Hover color
            '#000000'  // Default color
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1.0, // Thicker when hovered (reduced from 3.0)
            0.5  // Default width
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1.0,
            1.0
          ]
        }
      }
    ]
  },
  tectonicPlates: {
    sourceId: 'tectonic-plates-source',
    dataUrl: 'tectonic_plates.geojson',
    lazy: true,
    layers: [
      {
        id: 'tectonic-plates-line',
        type: 'line',
        source: 'tectonic-plates-source',
        beforeId: 'sim-wb-grid-fill',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#ffed4a', // bright yellow on hover
            '#ea580c'  // orange by default
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            3.0,
            1.5
          ],
          'line-opacity': [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            1.0,
            1.0
          ]
        }
      }
    ]
  },
  gpsVectors: {
    sourceId: 'gps-vectors-source',
    dataUrl: 'gps_vectors.geojson',
    lazy: true,
    transformData: scaleGpsVectorData,
    layers: [
      {
        id: 'gps-vectors-circle',
        type: 'circle',
        source: 'gps-vectors-source',
        filter: ['==', 'type', 'anchor'],
        paint: {
          'circle-radius': 3,
          'circle-color': GPS_VECTOR_COLOR,
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1
        }
      },
      {
        id: 'gps-vectors-line',
        type: 'line',
        source: 'gps-vectors-source',
        filter: ['==', 'type', 'vector'],
        paint: {
          'line-color': GPS_VECTOR_COLOR,
          'line-width': 1.0,
          'line-opacity': 0.9
        }
      },
      {
        id: 'gps-vectors-head',
        type: 'symbol',
        source: 'gps-vectors-source',
        filter: ['==', 'type', 'head'],
        layout: {
          'icon-image': GPS_VECTOR_ARROW_ICON_ID,
          'icon-rotate': ['get', 'azimuth'],
          'icon-size': 0.55,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'map'
        }
      }
    ]
  },
  historicEarthquakes: {
    sourceId: 'historic-earthquakes-source',
    dataUrl: '/scientific-api/historic',
    lazy: true,
    manualLoad: true,
    cluster: true,
    clusterMaxZoom: 12,
    clusterRadius: 45,
    layers: [
      {
        id: 'historic-clusters',
        type: 'circle',
        source: 'historic-earthquakes-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#f97316', 50,    
            '#f59e0b', 200,   
            '#ef4444'         
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15, 50,
            20, 200,
            25
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.85)'
        }
      },
      {
        id: 'historic-cluster-count',
        type: 'symbol',
        source: 'historic-earthquakes-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff'
        }
      },
      {
        id: 'historic-unclustered-point',
        type: 'circle',
        source: 'historic-earthquakes-source',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#f97316',
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'mag'],
            4, 4,
            6, 7,
            8, 10
          ],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      }
    ]
  },
};

// Raster layer configs (no GeoJSON)
export const RASTER_CONFIGS = {
  satellite: {
    sourceId: 'satellite-source',
    type: 'raster',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    tileSize: 256,
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite-source',
        minzoom: 0,
        maxzoom: 22,
        paint: { 'raster-opacity': 1 }
      }
    ]
  },
  terrain: {
    sourceId: 'terrain-source',
    type: 'raster',
    tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    layers: [
      {
        id: 'terrain-layer',
        type: 'raster',
        source: 'terrain-source',
        minzoom: 0,
        maxzoom: 17,
        paint: { 'raster-opacity': 1 }
      }
    ]
  }
};
