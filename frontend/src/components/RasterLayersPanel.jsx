import React, { useRef } from 'react';
import { Eye, EyeOff, Trash2, UploadCloud } from 'lucide-react';
import useStore from '../store/useStore';
import { rasterService } from '../services/rasterService';

export default function RasterLayersPanel({ isAdmin = true }) {
  const fileInputRef = useRef(null);
  const rasterLayers = useStore((state) => state.rasterLayers);
  const addRasterLayer = useStore((state) => state.addRasterLayer);
  const removeRasterLayer = useStore((state) => state.removeRasterLayer);
  const updateRasterLayerOpacity = useStore((state) => state.updateRasterLayerOpacity);
  const updateRasterLayerVisibility = useStore((state) => state.updateRasterLayerVisibility);
  const updateRasterLayerLoaded = useStore((state) => state.updateRasterLayerLoaded);

  const addUploadTask = useStore((state) => state.addUploadTask);
  const updateUploadTask = useStore((state) => state.updateUploadTask);
  const removeUploadTask = useStore((state) => state.removeUploadTask);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // Reset input so the same files can be selected again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';

    files.forEach(async (file) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const layerId = `raster-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const abortController = new AbortController();

      addUploadTask({
        id: taskId,
        fileName: file.name,
        loadedBytes: 0,
        totalBytes: file.size,
        status: 'reading', // reading, processing, completed, failed
        error: null,
        abortController
      });

      try {
        await rasterService.addGeoTiffLayer(file, layerId, {
          abortSignal: abortController.signal,
          onProgress: (loaded, total) => {
            updateUploadTask(taskId, { loadedBytes: loaded, totalBytes: total });
          },
          onStateChange: (status) => {
            updateUploadTask(taskId, { status });
          }
        });

        // Add to main raster list once successfully processed
        addRasterLayer({
          id: layerId,
          name: file.name,
          opacity: 0.8,
          visible: true
        });

        updateUploadTask(taskId, { status: 'completed' });

        // Auto-remove completed task after 3 seconds
        setTimeout(() => removeUploadTask(taskId), 3000);
      } catch (error) {
        if (error.message.includes('cancelled')) {
          removeUploadTask(taskId);
        } else {
          updateUploadTask(taskId, { status: 'failed', error: error.message });
        }
      }
    });
  };

  const handleRemove = (id) => {
    rasterService.removeGeoTiffLayer(id);
    removeRasterLayer(id);
  };

  const handleToggleVisibility = async (layer) => {
    const newVisibility = !layer.visible;
    
    if (layer.isBuiltIn && newVisibility && !layer.isLoaded) {
      try {
        await rasterService.addGeoTiffFromUrl(layer.url, layer.id, {
          opacity: layer.opacity,
          visible: true,
          renderingModeOverride: layer.id === 'population-exposure' ? 'population' : undefined
        });
        updateRasterLayerLoaded(layer.id, true);
      } catch (error) {
        alert(`Failed to load built-in layer: ${error.message}`);
        return;
      }
    } else {
      rasterService.updateVisibility(layer.id, newVisibility);
    }

    updateRasterLayerVisibility(layer.id, newVisibility);
  };

  const handleOpacityChange = (id, opacity) => {
    rasterService.updateOpacity(id, opacity);
    updateRasterLayerOpacity(id, opacity);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-semibold text-slate-300">GeoTIFF Overlays</h4>
        
        <input 
          type="file" 
          accept=".tif,.tiff" 
          multiple
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
        />
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-600/80 hover:bg-slate-500 text-white text-xs font-bold rounded shadow-[0_0_10px_rgba(8,145,178,0.3)] transition-all"
        >
          <UploadCloud size={14} />
          Add GeoTIFF
        </button>
      </div>

      {rasterLayers.length === 0 ? (
        <div className="p-4 border border-slate-700/50 bg-slate-800/30 rounded-lg text-center text-slate-500 text-xs italic">
          No raster layers loaded. Upload a .tif file to begin.
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {rasterLayers.map(layer => (
            <div key={layer.id} className="p-3 bg-slate-800/80 rounded-lg border border-slate-700/80 hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-300 text-sm truncate max-w-[180px]" title={layer.name}>
                  {layer.name}
                </span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleToggleVisibility(layer)}
                    className={`p-1.5 rounded transition-colors ${layer.visible ? 'text-white bg-cyan-900/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'}`}
                    title="Toggle Visibility"
                  >
                    {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  {!layer.isBuiltIn && (
                    <button 
                      onClick={() => handleRemove(layer.id)}
                      className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="Remove Layer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {layer.visible && isAdmin && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider w-12">Opacity</span>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.05" 
                    value={layer.opacity}
                    onChange={(e) => handleOpacityChange(layer.id, parseFloat(e.target.value))}
                    className="flex-1 accent-cyan-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-white w-8 text-right font-mono">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
