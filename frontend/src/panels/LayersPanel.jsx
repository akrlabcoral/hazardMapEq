// src/panels/LayersPanel.jsx
// Map Layers panel — Data layers, Raster layer, Base layers

import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import useStore from '../store/useStore';
import { useLayersState } from '../hooks/useLayersState';
import { LayerRow } from '../components/ui/LayerRow';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';

const RasterLayersPanel = React.lazy(() => import('../components/RasterLayersPanel'));

const GIS_BOUNDARY_LAYERS = ['indiaBoundary', 'stateBoundaries'];
const BASE_LAYERS = ['satellite', 'terrain'];

const LAYER_LABELS = {
  indiaBoundary:    'India Boundary',
  stateBoundaries:  'State Boundaries',
  satellite:        'Satellite',
  terrain:          'Terrain',
};

export function LayersPanel() {
  const {
    gisLayers, toggleGisLayer,
    layerOpacities, setLayerOpacity,
  } = useLayersState();

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">

      {/* 1. Data Layers */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Data Layers</div>

        {/* GIS Boundary Layers */}
        {GIS_BOUNDARY_LAYERS.map((key) => (
          <LayerRow
            key={key}
            label={LAYER_LABELS[key]}
            visible={gisLayers[key]}
            opacity={layerOpacities[key]}
            onToggle={() => toggleGisLayer(key)}
            onOpacityChange={(v) => setLayerOpacity(key, v)}
          />
        ))}
      </div>

      {/* 2. Raster Layer */}
      <React.Suspense fallback={<div className="p-4 text-sm text-slate-400 italic">Loading Raster panel...</div>}>
        <RasterLayersPanel />
      </React.Suspense>

      {/* 3. Base Layers */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Base Layers</div>
        {BASE_LAYERS.map((key) => (
          <LayerRow
            key={key}
            label={LAYER_LABELS[key]}
            visible={gisLayers[key]}
            opacity={layerOpacities[key]}
            onToggle={() => toggleGisLayer(key)}
            onOpacityChange={(v) => setLayerOpacity(key, v)}
          />
        ))}
      </div>

    </div>
  );
}
