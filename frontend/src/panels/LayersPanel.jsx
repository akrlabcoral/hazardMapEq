// src/panels/LayersPanel.jsx
// Map Layers panel — Data layers, Raster layer, Base layers

import React from 'react';
import { useLayersState } from '../hooks/useLayersState';
import { LayerRow } from '../components/ui/LayerRow';

const RasterLayersPanel = React.lazy(() => import('../components/RasterLayersPanel'));

const GIS_BOUNDARY_LAYERS = ['indiaBoundary', 'stateBoundaries'];
const GLOBAL_LAYERS = ['tectonicPlates', 'gpsVectors'];
const BASE_LAYERS = ['satellite', 'terrain'];

const LAYER_LABELS = {
  indiaBoundary:    'India Boundary',
  stateBoundaries:  'State Boundaries',
  tectonicPlates:   'Tectonic Plate Boundaries',
  satellite:        'Satellite',
  terrain:          'Terrain',
  gpsVectors:       'GPS Velocity Vectors',
};

export function LayersPanel({ isAdmin = true }) {
  const {
    gisLayers, toggleGisLayer,
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
            onToggle={() => toggleGisLayer(key)}
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
            onToggle={() => toggleGisLayer(key)}
          />
        ))}

        {/* Global Overlays */}
        {GLOBAL_LAYERS.map((key) => (
          <LayerRow
            key={key}
            label={LAYER_LABELS[key]}
            visible={gisLayers[key]}
            onToggle={() => toggleGisLayer(key)}
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
