import { GPS_VECTOR_ARROW_ICON_ID, LAYER_CONFIGS, RASTER_CONFIGS } from './layerManager';
import { fetchGeoJson } from './geoJsonLoader';

const SIMULATION_LAYER_ORDER = [
  'sim-wb-grid-fill',
  'sim-contour-fill',
  'sim-contour-stroke',
  'sim-intensity-fill',
  'sim-shockwave',
  'sim-epicenter-glow',
  'sim-epicenter-ring',
  'sim-epicenter',
  'live-earthquake-pulse',
  'live-earthquake-point',
];

const createGpsVectorArrowImage = () => {
  if (typeof document === 'undefined') return null;

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(27, 24);
  ctx.lineTo(16, 19);
  ctx.lineTo(5, 24);
  ctx.closePath();
  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
};

class MapLayerService {
  constructor() {
    this.map = null;
    this.initialized = false;
    this.dataLoaded = {};
    this.dataCache = {};
    this.dataPromises = {};
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

  ensureLayerImages(map) {
    if (!map || !map.getStyle()) return;
    if (!map.hasImage(GPS_VECTOR_ARROW_ICON_ID)) {
      const arrowImage = createGpsVectorArrowImage();
      if (arrowImage) {
        map.addImage(GPS_VECTOR_ARROW_ICON_ID, arrowImage, { pixelRatio: 2 });
      }
    }
  }

  setCachedSourceData(sourceId) {
    if (!this.map || !this.map.getStyle()) return;
    const source = this.map.getSource(sourceId);
    const data = this.dataCache[sourceId];
    if (source?.setData && data) {
      source.setData(data);
      this.dataLoaded[sourceId] = 'loaded';
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

  loadGeoJsonData(config, options = {}) {
    const dataUrl = options.dataUrl || config.dataUrl;
    const cacheKey = options.cacheKey || dataUrl;
    const { dataUrl: _dataUrl, cacheKey: _cacheKey, ...fetchOptions } = options;

    if (this.dataCache[cacheKey]) {
      if (this.map && this.map.getSource(config.sourceId)) {
        this.map.getSource(config.sourceId).setData(this.dataCache[cacheKey]);
        this.dataLoaded[config.sourceId] = 'loaded';
      }
      return Promise.resolve(this.dataCache[cacheKey]);
    }

    if (this.dataPromises[cacheKey]) {
      return this.dataPromises[cacheKey];
    }

    this.dataLoaded[config.sourceId] = 'loading';
    this.dataPromises[cacheKey] = fetchGeoJson(dataUrl, fetchOptions).then(data => {
      this.dataCache[cacheKey] = data;
      this.dataCache[config.sourceId] = data;
      if (this.map && this.map.getSource(config.sourceId)) {
        this.map.getSource(config.sourceId).setData(data);
      }
      this.dataLoaded[config.sourceId] = 'loaded';
      return data;
    }).catch(err => {
      if (err.name !== 'AbortError') {
        console.error(`Failed to lazy load ${config.sourceId}`, err);
      }
      this.dataLoaded[config.sourceId] = false;
      throw err;
    }).finally(() => {
      delete this.dataPromises[cacheKey];
    });

    return this.dataPromises[cacheKey];
  }

  loadLayerData(layerKey, options = {}) {
    const config = LAYER_CONFIGS[layerKey];
    if (!config) {
      return Promise.reject(new Error(`Unknown layer: ${layerKey}`));
    }
    return this.loadGeoJsonData(config, options);
  }

  async initializeSourcesAndLayers(mapInstance, initialVisibilityState) {
    if (this.initialized && this.map === mapInstance) return;
    this.map = mapInstance;
    this.ensureLayerImages(this.map);
    
    const BASE_LAYER_ANCHOR = 'sim-wb-grid-fill';

    for (const [key, config] of Object.entries(RASTER_CONFIGS)) {
      if (!this.map.getSource(config.sourceId)) {
        this.map.addSource(config.sourceId, {
          type: config.type,
          tiles: config.tiles,
          tileSize: config.tileSize
        });
      }
      config.layers.forEach(layer => {
        if (!this.map.getLayer(layer.id)) {
          const beforeId = this.map.getLayer(BASE_LAYER_ANCHOR) ? BASE_LAYER_ANCHOR : undefined;
          this.map.addLayer(
            { ...layer, layout: { ...layer.layout, visibility: initialVisibilityState[key] ? 'visible' : 'none' } },
            beforeId
          );
        }
      });
    }

    for (const [key, config] of Object.entries(LAYER_CONFIGS)) {
      if (!this.map.getSource(config.sourceId)) {
        const sourceConfig = {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        };
        if (config.promoteId) {
          sourceConfig.promoteId = config.promoteId;
        } else {
          sourceConfig.generateId = true;
        }
        if (config.cluster) {
          sourceConfig.cluster = true;
          sourceConfig.clusterMaxZoom = config.clusterMaxZoom;
          sourceConfig.clusterRadius = config.clusterRadius;
        }
        
        this.map.addSource(config.sourceId, sourceConfig);

        if (!config.manualLoad && (!config.lazy || initialVisibilityState[key])) {
          this.loadGeoJsonData(config).catch(() => {});
        }

      } else {
        this.setCachedSourceData(config.sourceId);
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
    
    this.initialized = true;
    this.bringSimulationLayersToFront(this.map);
  }

  setLayerVisibility(layerKey, isVisible) {
    if (!this.map) return;
    
    const visibility = isVisible ? 'visible' : 'none';
    
    if (LAYER_CONFIGS[layerKey]) {
      const config = LAYER_CONFIGS[layerKey];
      if (isVisible && config.lazy && !config.manualLoad && !this.dataLoaded[config.sourceId]) {
        this.loadGeoJsonData(config).catch(() => {});
      }
      if (isVisible) {
        this.setCachedSourceData(config.sourceId);
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
