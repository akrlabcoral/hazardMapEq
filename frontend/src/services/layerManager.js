// Static layer configurations for MapLibre

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
          'line-width': 0.5,
          'line-opacity': 0.6
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
            0.6
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
            0.6
          ]
        }
      }
    ]
  },
  gpsVectors: {
    sourceId: 'gps-vectors-source',
    dataUrl: 'gps_vectors.geojson',
    lazy: true,
    layers: [
      {
        id: 'gps-vectors-circle',
        type: 'circle',
        source: 'gps-vectors-source',
        filter: ['==', 'type', 'anchor'],
        paint: {
          'circle-radius': 3,
          'circle-color': '#ef4444',
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
          'line-color': '#ef4444',
          'line-width': 4.0,
          'line-opacity': 0.9
        }
      },
      {
        id: 'gps-vectors-head',
        type: 'symbol',
        source: 'gps-vectors-source',
        filter: ['==', 'type', 'head'],
        layout: {
          'text-field': '^',
          'text-rotate': ['get', 'azimuth'],
          'text-size': 20,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-offset': [0, 0.2]
        },
        paint: {
          'text-color': '#ef4444',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1
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
