import { LAYER_CONFIGS, RASTER_CONFIGS } from './layerManager';
import { fetchGeoJson } from './geoJsonLoader';
import { mapLayerManager } from './mapLayerManager';

class MapLayerService {
  constructor() {
    this.map = null;
    this.initialized = false;
    this.dataLoaded = {};
  }

  loadGeoJsonData(config) {
    if (this.dataLoaded[config.sourceId]) return;
    this.dataLoaded[config.sourceId] = 'loading';
    fetchGeoJson(config.dataUrl).then(data => {
      if (this.map && this.map.getSource(config.sourceId)) {
        this.map.getSource(config.sourceId).setData(data);
        this.dataLoaded[config.sourceId] = 'loaded';
      }
    }).catch(err => {
      console.error(`Failed to lazy load ${config.sourceId}`, err);
      this.dataLoaded[config.sourceId] = false;
    });
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
          data: { type: 'FeatureCollection', features: [] },
          generateId: true
        };
        if (config.cluster) {
          sourceConfig.cluster = true;
          sourceConfig.clusterMaxZoom = config.clusterMaxZoom;
          sourceConfig.clusterRadius = config.clusterRadius;
        }
        
        this.map.addSource(config.sourceId, sourceConfig);

        // Fetch data asynchronously (unless lazy and initially hidden)
        if (!config.lazy || initialVisibilityState[key]) {
          this.loadGeoJsonData(config);
        }

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
    mapLayerManager.bringSimulationLayersToFront(this.map);
  }

  setLayerVisibility(layerKey, isVisible) {
    if (!this.map) return;
    
    const visibility = isVisible ? 'visible' : 'none';
    
    // Check GeoJSON configs
    if (LAYER_CONFIGS[layerKey]) {
      const config = LAYER_CONFIGS[layerKey];
      if (isVisible && config.lazy && !this.dataLoaded[config.sourceId]) {
        this.loadGeoJsonData(config);
      }
      config.layers.forEach(layer => {
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

    mapLayerManager.bringSimulationLayersToFront(this.map);
  }

}

export const mapLayerService = new MapLayerService();
