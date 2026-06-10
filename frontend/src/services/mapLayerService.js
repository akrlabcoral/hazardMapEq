import { LAYER_CONFIGS, RASTER_CONFIGS } from './layerManager';
import { fetchGeoJson } from './geoJsonLoader';

const SIMULATION_LAYER_ORDER = [
  'sim-soil-amp-layer',
  'sim-wb-grid-fill',
  'sim-contour-fill',
  'sim-contour-stroke',
  'sim-shockwave',
  'sim-epicenter-glow',
  'sim-epicenter-ring',
  'sim-epicenter',
];

class MapLayerService {
  constructor() {
    this.map = null;
    this.initialized = false;
    this.dataLoaded = {};
  }

  // --- Safe MapLibre Layer Management ---

  layerExists(map, layerId) {
    if (!map || !map.getStyle()) return false;
    return !!map.getLayer(layerId);
  }

  sourceExists(map, sourceId) {
    if (!map || !map.getStyle()) return false;
    return !!map.getSource(sourceId);
  }

  addSourceSafe(map, sourceId, sourceConfig) {
    if (!map || !map.getStyle()) return;
    if (this.sourceExists(map, sourceId)) {
      console.warn(`[MapLayerService] Source ${sourceId} already exists. Skipping.`);
      return;
    }
    console.debug(`[MapLayerService] Adding source: ${sourceId}`);
    map.addSource(sourceId, sourceConfig);
  }

  removeSourceSafe(map, sourceId) {
    if (!map || !map.getStyle()) return;
    if (this.sourceExists(map, sourceId)) {
      console.debug(`[MapLayerService] Removing source: ${sourceId}`);
      map.removeSource(sourceId);
    }
  }

  addLayerSafe(map, layerConfig, beforeId = undefined) {
    if (!map || !map.getStyle()) return;
    if (this.layerExists(map, layerConfig.id)) {
      console.warn(`[MapLayerService] Layer ${layerConfig.id} already exists. Skipping.`);
      return;
    }
    console.debug(`[MapLayerService] Adding layer: ${layerConfig.id}`);
    if (beforeId && this.layerExists(map, beforeId)) {
      map.addLayer(layerConfig, beforeId);
    } else {
      map.addLayer(layerConfig);
    }
  }

  removeLayerSafe(map, layerId) {
    if (!map || !map.getStyle()) return;
    if (this.layerExists(map, layerId)) {
      console.debug(`[MapLayerService] Removing layer: ${layerId}`);
      map.removeLayer(layerId);
    }
  }

  clearSourcesData(map, sourceIds) {
    if (!map || !map.isStyleLoaded()) return;
    const emptyData = { type: 'FeatureCollection', features: [] };
    sourceIds.forEach(id => {
      const source = map.getSource(id);
      if (source && source.setData) {
        console.debug(`[MapLayerService] Clearing data for source: ${id}`);
        source.setData(emptyData);
      }
    });
  }

  bringSimulationLayersToFront(map) {
    if (!map || !map.getStyle()) return;
    SIMULATION_LAYER_ORDER.forEach(layerId => {
      if (this.layerExists(map, layerId)) {
        map.moveLayer(layerId);
      }
    });
  }

  // --- Stateful Layer Visibility & Data Loading ---

  loadGeoJsonData(config) {
    if (this.dataLoaded[config.sourceId] === 'loading') return;

    if (this.dataCache && this.dataCache[config.sourceId]) {
      if (this.map && this.map.getSource(config.sourceId)) {
        this.map.getSource(config.sourceId).setData(this.dataCache[config.sourceId]);
        this.dataLoaded[config.sourceId] = 'loaded';
      }
      return;
    }

    this.dataLoaded[config.sourceId] = 'loading';
    fetchGeoJson(config.dataUrl).then(data => {
      this.dataCache = this.dataCache || {};
      this.dataCache[config.sourceId] = data;
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

    for (const [key, config] of Object.entries(LAYER_CONFIGS)) {
      if (!this.map.getSource(config.sourceId)) {
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

        if (!config.lazy || initialVisibilityState[key]) {
          this.loadGeoJsonData(config);
        }

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
    this.bringSimulationLayersToFront(this.map);
  }

  setLayerVisibility(layerKey, isVisible) {
    if (!this.map) return;
    
    const visibility = isVisible ? 'visible' : 'none';
    
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
    
    if (RASTER_CONFIGS[layerKey]) {
      RASTER_CONFIGS[layerKey].layers.forEach(layer => {
        if (this.map.getLayer(layer.id)) {
          this.map.setLayoutProperty(layer.id, 'visibility', visibility);
        }
      });
    }

    this.bringSimulationLayersToFront(this.map);
  }
}

export const mapLayerService = new MapLayerService();
