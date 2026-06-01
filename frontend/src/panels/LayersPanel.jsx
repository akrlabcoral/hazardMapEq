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
    soilAmpVisible, setSoilAmpVisible,
    isHoverTooltipEnabled, setHoverTooltipEnabled,
  } = useLayersState();

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">

      {/* 1. Data Layers */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Data Layers</div>

        {/* Hover Tooltip Toggle */}
        <div className="p-3 mb-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="font-medium text-slate-300">State Hover Tooltip</span>
              <div className="text-[10px] text-slate-500 mt-0.5">Show floating stats on hover</div>
            </div>
            <ToggleSwitch
              checked={isHoverTooltipEnabled}
              onChange={() => setHoverTooltipEnabled(!isHoverTooltipEnabled)}
            />
          </div>
        </div>

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

      {/* Simulation Overlays */}
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Simulation Overlays</div>
        <div className="p-3 mb-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="font-medium text-slate-300">Site Amplification</span>
              <div className="text-[10px] text-slate-500 mt-0.5">Vs30 Site Classification · blue→red scale</div>
            </div>
            <ToggleSwitch checked={soilAmpVisible} onChange={() => setSoilAmpVisible(!soilAmpVisible)} />
          </div>
          <div className="flex justify-between text-[9px] font-mono mt-2 px-1">
            <span className="text-blue-400">■ Site A</span>
            <span className="text-green-400">■ Site B</span>
            <span className="text-yellow-400">■ Site C</span>
            <span className="text-orange-400">■ Site D</span>
            <span className="text-red-400">■ Site E</span>
          </div>
        </div>
      </div>

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
