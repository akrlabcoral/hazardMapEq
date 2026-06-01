/**
 * mapLayerManager.js
 * Centralized manager for safely handling MapLibre layers and sources.
 * Prevents duplicate layer registration, removes layers cleanly, and 
 * provides debugging insights into the map rendering lifecycle.
 */

class MapLayerManager {
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
      console.warn(`[MapLayerManager] Source ${sourceId} already exists. Skipping.`);
      return;
    }
    
    console.debug(`[MapLayerManager] Adding source: ${sourceId}`);
    map.addSource(sourceId, sourceConfig);
  }

  removeSourceSafe(map, sourceId) {
    if (!map || !map.getStyle()) return;
    
    if (this.sourceExists(map, sourceId)) {
      console.debug(`[MapLayerManager] Removing source: ${sourceId}`);
      map.removeSource(sourceId);
    }
  }

  addLayerSafe(map, layerConfig, beforeId = undefined) {
    if (!map || !map.getStyle()) return;
    
    if (this.layerExists(map, layerConfig.id)) {
      console.warn(`[MapLayerManager] Layer ${layerConfig.id} already exists. Skipping.`);
      return;
    }

    console.debug(`[MapLayerManager] Adding layer: ${layerConfig.id}`);
    
    // Check if beforeId exists before using it
    if (beforeId && this.layerExists(map, beforeId)) {
      map.addLayer(layerConfig, beforeId);
    } else {
      map.addLayer(layerConfig);
    }
  }

  removeLayerSafe(map, layerId) {
    if (!map || !map.getStyle()) return;
    
    if (this.layerExists(map, layerId)) {
      console.debug(`[MapLayerManager] Removing layer: ${layerId}`);
      map.removeLayer(layerId);
    }
  }

  /**
   * Clears the data from the specified sources instead of removing them entirely.
   * This preserves the persistent source -> persistent layer architecture.
   */
  clearSourcesData(map, sourceIds) {
    if (!map || !map.isStyleLoaded()) return;
    const emptyData = { type: 'FeatureCollection', features: [] };
    
    sourceIds.forEach(id => {
      const source = map.getSource(id);
      if (source && source.setData) {
        console.debug(`[MapLayerManager] Clearing data for source: ${id}`);
        source.setData(emptyData);
      }
    });
  }
}

export const mapLayerManager = new MapLayerManager();
