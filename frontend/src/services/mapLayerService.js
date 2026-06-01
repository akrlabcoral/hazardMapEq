import { LAYER_CONFIGS, RASTER_CONFIGS } from './layerManager';
import { fetchGeoJson } from './geoJsonLoader';

class MapLayerService {
  constructor() {
    this.map = null;
    this.initialized = false;
  }

  async initializeSourcesAndLayers(mapInstance, initialVisibilityState) {
    if (this.initialized && this.map === mapInstance) return;
    this.map = mapInstance;
    
    // Add raster sources and layers BELOW simulation layers.
    // We insert them before 'sim-soil-amp-layer' (the bottommost sim layer)
    // so satellite/terrain never cover the heatmap.
    const BASE_LAYER_ANCHOR = 'sim-soil-amp-layer';

    for (const [key, config] of Object.entries(RASTER_CONFIGS)) {
      if (!this.map.getSource(config.sourceId)) {
        this.map.addSource(config.sourceId, {
          type: config.type,
          tiles: config.tiles,
          tileSize: config.tileSize
        });
        config.layers.forEach(layer => {
          if (!this.map.getLayer(layer.id)) {
            const beforeId = this.map.getLayer(BASE_LAYER_ANCHOR) ? BASE_LAYER_ANCHOR : undefined;
            this.map.addLayer(
              { ...layer, layout: { visibility: initialVisibilityState[key] ? 'visible' : 'none' } },
              beforeId
            );
          }
        });
      }
    }

    // Add GeoJSON sources and layers
    for (const [key, config] of Object.entries(LAYER_CONFIGS)) {
      if (!this.map.getSource(config.sourceId)) {
        // Init with empty data
        const sourceConfig = {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        };
        if (config.cluster) {
          sourceConfig.cluster = true;
          sourceConfig.clusterMaxZoom = config.clusterMaxZoom;
          sourceConfig.clusterRadius = config.clusterRadius;
        }
        
        this.map.addSource(config.sourceId, sourceConfig);

        // Fetch data asynchronously
        fetchGeoJson(config.dataUrl).then(data => {
          if (this.map && this.map.getSource(config.sourceId)) {
            this.map.getSource(config.sourceId).setData(data);
          }
        });

        // Add layers
        config.layers.forEach(layer => {
          if (!this.map.getLayer(layer.id)) {
            const { beforeId, ...layerConfig } = layer;
            const targetBeforeId = beforeId && this.map.getLayer(beforeId) ? beforeId : undefined;
            this.map.addLayer({ 
              ...layerConfig, 
              layout: { ...layerConfig.layout, visibility: initialVisibilityState[key] ? 'visible' : 'none' } 
            }, targetBeforeId);
          }
        });
      }
    }
    
    this.initialized = true;
  }

  setLayerVisibility(layerKey, isVisible) {
    if (!this.map) return;
    
    const visibility = isVisible ? 'visible' : 'none';
    
    // Check GeoJSON configs
    if (LAYER_CONFIGS[layerKey]) {
      LAYER_CONFIGS[layerKey].layers.forEach(layer => {
        if (this.map.getLayer(layer.id)) {
          this.map.setLayoutProperty(layer.id, 'visibility', visibility);
        }
      });
    }
    
    // Check Raster configs
    if (RASTER_CONFIGS[layerKey]) {
      RASTER_CONFIGS[layerKey].layers.forEach(layer => {
        if (this.map.getLayer(layer.id)) {
          this.map.setLayoutProperty(layer.id, 'visibility', visibility);
        }
      });
    }
  }

  setLayerOpacity(layerKey, opacity) {
    if (!this.map) return;

    // GeoJSON layer opacity
    if (LAYER_CONFIGS[layerKey]) {
      LAYER_CONFIGS[layerKey].layers.forEach(layer => {
        if (!this.map.getLayer(layer.id)) return;
        // Different paint property depending on layer type
        if (layer.type === 'fill') {
          this.map.setPaintProperty(layer.id, 'fill-opacity', opacity * 0.4);
        } else if (layer.type === 'line') {
          this.map.setPaintProperty(layer.id, 'line-opacity', opacity);
        } else if (layer.type === 'circle') {
          this.map.setPaintProperty(layer.id, 'circle-opacity', opacity);
        } else if (layer.type === 'heatmap') {
          // heatmap-opacity is top-level, scale relative to zoom interpolation
          this.map.setPaintProperty(layer.id, 'heatmap-opacity', opacity);
        } else if (layer.type === 'symbol') {
          this.map.setPaintProperty(layer.id, 'text-opacity', opacity);
        }
      });
    }

    // Raster layer opacity
    if (RASTER_CONFIGS[layerKey]) {
      RASTER_CONFIGS[layerKey].layers.forEach(layer => {
        if (this.map.getLayer(layer.id)) {
          this.map.setPaintProperty(layer.id, 'raster-opacity', opacity);
        }
      });
    }
  }
}

export const mapLayerService = new MapLayerService();
