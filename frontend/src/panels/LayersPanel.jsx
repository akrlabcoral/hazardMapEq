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
const GLOBAL_LAYERS = ['tectonicPlates'];
const BASE_LAYERS = ['satellite', 'terrain'];

const LAYER_LABELS = {
  indiaBoundary:    'India Boundary',
  stateBoundaries:  'State Boundaries',
  tectonicPlates:   'Tectonic Plate Boundaries',
  satellite:        'Satellite',
  terrain:          'Terrain',
};

export function LayersPanel({ isAdmin = true }) {
  const {
    gisLayers, toggleGisLayer,
    layerOpacities, setLayerOpacity,
  } = useLayersState();

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">

      {/* 1. Base Map Views */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Base Map Views</div>
        {BASE_LAYERS.map((key) => (
          <LayerRow
            key={key}
            label={LAYER_LABELS[key]}
            visible={gisLayers[key]}
            opacity={layerOpacities[key]}
            onToggle={() => toggleGisLayer(key)}
            onOpacityChange={isAdmin ? (v) => setLayerOpacity(key, v) : undefined}
          />
        ))}
      </div>

      {/* 2. Data Layers */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Data Layers</div>

        {/* GIS Boundary Layers */}
        {isAdmin && GIS_BOUNDARY_LAYERS.map((key) => (
          <LayerRow
            key={key}
            label={LAYER_LABELS[key]}
            visible={gisLayers[key]}
            opacity={layerOpacities[key]}
            onToggle={() => toggleGisLayer(key)}
            onOpacityChange={isAdmin ? (v) => setLayerOpacity(key, v) : undefined}
          />
        ))}

        {/* Global Overlays */}
        {GLOBAL_LAYERS.map((key) => (
          <LayerRow
            key={key}
            label={LAYER_LABELS[key]}
            visible={gisLayers[key]}
            opacity={layerOpacities[key]}
            onToggle={() => toggleGisLayer(key)}
            onOpacityChange={isAdmin ? (v) => setLayerOpacity(key, v) : undefined}
          />
        ))}

        {/* Raster Layers */}
        <React.Suspense fallback={<div className="p-4 text-sm text-slate-400 italic">Loading Raster panel...</div>}>
          <RasterLayersPanel isAdmin={isAdmin} />
        </React.Suspense>
      </div>

    </div>
  );
}
