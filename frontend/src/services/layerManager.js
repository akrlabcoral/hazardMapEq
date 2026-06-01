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
          'line-color': '#00d4ff',
          'line-width': 1.5,
          'line-opacity': 0.6
        }
      }
    ]
  },
  stateBoundaries: {
    sourceId: 'state-boundaries-source',
    dataUrl: 'india_states.geojson',
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
            '#0ea5e9', // Bright neon blue when hovered
            '#00d4ff'  // Default cyan
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
