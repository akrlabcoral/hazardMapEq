import * as GeoTIFF from 'geotiff';
import proj4 from 'proj4';
import { mapLayerService } from './mapLayerService';
import { debugLog } from '../utils/debug';

// ─── Memory Safety Constants ────────────────────────────────────────────────
// Reading large GeoTIFFs in one shot crashes the browser because geotiff.js
// decompresses strips/tiles at full resolution internally before resampling.
// Solution: read in spatial windows (tiles) so only a small portion is
// decompressed at any given time, then composite onto a single output canvas.
const MAX_OUTPUT_DIM     = 2048;   // Max output canvas dimension
const TILE_READ_SIZE     = 512;    // Read 512x512 pixel windows from the source
const MAX_SAFE_MEMORY_MB = 256;    // Memory threshold for single-shot decode

class RasterService {
  constructor() {
    this.map = null;
    this.rasterCache = new Map();
  }

  setMap(map) {
    this.map = map;
  }

  // ─── CRS / Projection Transformation ────────────────────────────────────────
  transformBoundsRaw(projection, xmin, ymin, xmax, ymax) {
    const crs = projection;

    debugLog(`%c[GeoTIFF CRS Audit]`, 'color: #0ea5e9; font-weight: bold;');
    debugLog(`Detected CRS: EPSG:${crs || 'Unknown'}`);
    debugLog(`Original Bounds: [${xmin}, ${ymin}, ${xmax}, ${ymax}]`);

    if (crs === 4326) {
      debugLog(`Projection Type: Geographic (WGS84)`);
      debugLog(`Coordinate Conversion: Skipped (Already EPSG:4326)`);
      return { xmin, ymin, xmax, ymax };
    }

    try {
      let sourceProj = null;
      let projectionType = 'Unknown';

      if (crs === 3857) {
        sourceProj = 'EPSG:3857';
        projectionType = 'Web Mercator';
      } else if (crs >= 32601 && crs <= 32660) {
        const zone = crs - 32600;
        sourceProj = `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`;
        projectionType = `UTM Zone ${zone}N`;
      } else if (crs >= 32701 && crs <= 32760) {
        const zone = crs - 32700;
        sourceProj = `+proj=utm +zone=${zone} +south +datum=WGS84 +units=m +no_defs`;
        projectionType = `UTM Zone ${zone}S`;
      } else if (crs) {
        console.warn(`Unsupported EPSG:${crs}. Assuming geographic coordinates.`);
        return { xmin, ymin, xmax, ymax };
      } else {
        console.warn(`Missing CRS metadata. Assuming geographic coordinates.`);
        return { xmin, ymin, xmax, ymax };
      }

      debugLog(`Projection Type: ${projectionType}`);

      const [lonMin, latMin] = proj4(sourceProj, 'EPSG:4326', [xmin, ymin]);
      const [lonMax, latMax] = proj4(sourceProj, 'EPSG:4326', [xmax, ymax]);

      debugLog(`Transformed Bounds (EPSG:4326): [${lonMin}, ${latMin}, ${lonMax}, ${latMax}]`);
      debugLog(`Coordinate Conversion: Success`);

      return { xmin: lonMin, ymin: latMin, xmax: lonMax, ymax: latMax };
    } catch (error) {
      console.error('CRS Transformation failed:', error);
      return { xmin, ymin, xmax, ymax };
    }
  }

  // ─── Memory-Safe GeoTIFF Decoder ────────────────────────────────────────────
  /**
   * Complete memory-safe GeoTIFF decoding pipeline:
   *
   * 1. Opens the TIFF and reads ONLY headers (no pixel decompression)
   * 2. Checks for overview images (pre-downsampled pyramids in the TIFF)
   * 3. If an overview fits in memory, uses it for a fast single-shot read
   * 4. Otherwise, reads the full-res image in small SPATIAL WINDOWS (tiles)
   *    so geotiff.js only decompresses one small strip/tile at a time
   * 5. Composites all tile results onto a single output canvas
   *
   * This avoids the root cause: geotiff.js decompresses strips at native
   * resolution internally, regardless of the output width/height you request.
   */
  async decodeGeoTiffSafe(arrayBuffer, options = {}) {
    const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
    const imageCount = await tiff.getImageCount();
    const primaryImage = await tiff.getImage(0);

    const fullWidth = primaryImage.getWidth();
    const fullHeight = primaryImage.getHeight();
    const bandCount = primaryImage.getSamplesPerPixel();
    const bbox = primaryImage.getBoundingBox();
    const noDataValue = primaryImage.getGDALNoData();

    // Extract CRS
    let projection = null;
    const geoKeys = primaryImage.getGeoKeys();
    if (geoKeys) {
      projection = geoKeys.ProjectedCSTypeGeoKey || geoKeys.GeographicTypeGeoKey || null;
    }

    // ── Raster Type Detection ──────────────────────────────────────────────
    // PhotometricInterpretation (TIFF tag 262) tells us how to render pixels:
    //   0 = WhiteIsZero (grayscale, inverted)
    //   1 = BlackIsZero (grayscale, normal)
    //   2 = RGB (multi-band color)
    const fileDir = primaryImage.fileDirectory || {};
    // In geotiff.js v3, TIFF tags are stored in the actualizedFields Map by their numeric tag ID
    // 262 = PhotometricInterpretation
    // 320 = ColorMap
    // 258 = BitsPerSample
    const photometric = fileDir.actualizedFields?.get(262);
    const rawColorMap = fileDir.actualizedFields?.get(320);
    const bitsPerSample = fileDir.actualizedFields?.get(258)?.[0] || 8;

    // Build a normalized RGB palette lookup table if ColorMap is present.
    // TIFF ColorMap is stored as [R0,R1,...,Rn, G0,G1,...,Gn, B0,B1,...,Bn]
    // with values in range 0-65535. We normalize them to 0-255.
    let palette = null;
    let renderingMode = 'grayscale'; // default fallback

    if (bandCount >= 3) {
      renderingMode = 'rgb';
    } else if (photometric === 3 && rawColorMap && rawColorMap.length > 0) {
      // Palette/Indexed color raster — build RGB lookup table
      const nColors = rawColorMap.length / 3;
      palette = new Array(nColors);
      for (let i = 0; i < nColors; i++) {
        // ColorMap values are 16-bit (0-65535), scale to 8-bit (0-255)
        palette[i] = [
          Math.round(rawColorMap[i] / 257),               // R
          Math.round(rawColorMap[nColors + i] / 257),     // G
          Math.round(rawColorMap[2 * nColors + i] / 257)  // B
        ];
      }
      renderingMode = 'palette';
    } else if (photometric === 0) {
      renderingMode = 'grayscale-inverted';
    }
    
    if (options.renderingModeOverride) {
      renderingMode = options.renderingModeOverride;
    }

    const fullMemMB = (fullWidth * fullHeight * bandCount * 8) / (1024 * 1024);

    debugLog(`%c[GeoTIFF Rendering Audit]`, 'color: #f59e0b; font-weight: bold;');
    debugLog(`Raster Width: ${fullWidth}`);
    debugLog(`Raster Height: ${fullHeight}`);
    debugLog(`Band Count: ${bandCount}`);
    debugLog(`BitsPerSample: ${bitsPerSample}`);
    debugLog(`Photometric Interpretation: ${photometric} (${['WhiteIsZero','BlackIsZero','RGB','Palette'][photometric] || 'Other'})`);
    debugLog(`ColorMap Detected: ${rawColorMap ? `Yes (${rawColorMap.length / 3} entries)` : 'No'}`);
    debugLog(`Palette Applied: ${palette ? 'Yes' : 'No'}`);
    debugLog(`Rendering Mode: ${renderingMode}`);
    debugLog(`Compression: ${fileDir.actualizedFields?.get(259) || 'Unknown'}`);
    debugLog(`Estimated Full Decoded Memory: ${fullMemMB.toFixed(1)} MB`);
    debugLog(`Image Count (overviews): ${imageCount}`);
    debugLog(`NoData Value: ${noDataValue}`);

    // ── Strategy 1: Try overview images (pre-downsampled pyramids) ──
    // Many GeoTIFFs (especially Cloud Optimized) contain overview images
    // at progressively lower resolutions. These are cheap to decode.
    if (imageCount > 1) {
      for (let i = imageCount - 1; i >= 1; i--) {
        try {
          const overview = await tiff.getImage(i);
          const ow = overview.getWidth();
          const oh = overview.getHeight();
          const omem = (ow * oh * bandCount * 8) / (1024 * 1024);

          if (omem <= MAX_SAFE_MEMORY_MB && ow <= MAX_OUTPUT_DIM * 2 && oh <= MAX_OUTPUT_DIM * 2) {
            debugLog(`Using overview image #${i}: ${ow}x${oh} (${omem.toFixed(1)} MB)`);

            const outW = Math.min(ow, MAX_OUTPUT_DIM);
            const outH = Math.min(oh, MAX_OUTPUT_DIM);

            const rasterData = await overview.readRasters({
              width: outW,
              height: outH,
              interleave: false
            });

            const dataUrl = this.renderToCanvas(rasterData, outW, outH, bandCount, noDataValue, palette, renderingMode);

            return {
              dataUrl, projection,
              xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3],
              noDataValue, fullWidth, fullHeight,
              decodeWidth: outW, decodeHeight: outH, downsampled: true
            };
          }
        } catch (e) {
          console.warn(`Overview #${i} failed, trying next...`);
        }
      }
    }

    // ── Strategy 2: Small raster — single-shot decode ──
    if (fullMemMB <= MAX_SAFE_MEMORY_MB) {
      debugLog(`Raster fits in memory. Decoding at constrained resolution.`);
      const outW = Math.min(fullWidth, MAX_OUTPUT_DIM);
      const outH = Math.min(fullHeight, MAX_OUTPUT_DIM);

      try {
        const rasterData = await primaryImage.readRasters({
          width: outW,
          height: outH,
          interleave: false
        });

        const dataUrl = this.renderToCanvas(rasterData, outW, outH, bandCount, noDataValue, palette, renderingMode);

        return {
          dataUrl, projection,
          xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3],
          noDataValue, fullWidth, fullHeight,
          decodeWidth: outW, decodeHeight: outH, downsampled: outW < fullWidth
        };
      } catch (e) {
        console.warn('Single-shot decode failed, falling back to tiled reading...', e.message);
      }
    }

    // ── Strategy 3: Large raster — tiled window-based reading ──
    // This is the critical memory-safe path. We read small spatial windows
    // (TILE_READ_SIZE x TILE_READ_SIZE pixels from the source) one at a time.
    // Each window only requires geotiff.js to decompress the strips/tiles
    // that intersect it, keeping peak memory usage bounded.
    debugLog(`%c[GeoTIFF Tiled Decode]`, 'color: #ef4444; font-weight: bold;');
    debugLog(`Using tiled window reading (${TILE_READ_SIZE}px windows)`);

    // Calculate output dimensions maintaining aspect ratio
    let outW, outH;
    if (fullWidth >= fullHeight) {
      outW = MAX_OUTPUT_DIM;
      outH = Math.max(1, Math.round((fullHeight / fullWidth) * MAX_OUTPUT_DIM));
    } else {
      outH = MAX_OUTPUT_DIM;
      outW = Math.max(1, Math.round((fullWidth / fullHeight) * MAX_OUTPUT_DIM));
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    // Scale factors from source pixels to output pixels
    const scaleX = outW / fullWidth;
    const scaleY = outH / fullHeight;

    const tilesX = Math.ceil(fullWidth / TILE_READ_SIZE);
    const tilesY = Math.ceil(fullHeight / TILE_READ_SIZE);
    const totalTiles = tilesX * tilesY;
    let tilesProcessed = 0;

    debugLog(`Tile grid: ${tilesX} x ${tilesY} = ${totalTiles} tiles`);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        // Source pixel window for this tile
        const srcX0 = tx * TILE_READ_SIZE;
        const srcY0 = ty * TILE_READ_SIZE;
        const srcX1 = Math.min(srcX0 + TILE_READ_SIZE, fullWidth);
        const srcY1 = Math.min(srcY0 + TILE_READ_SIZE, fullHeight);
        const srcW = srcX1 - srcX0;
        const srcH = srcY1 - srcY0;

        // Output pixel position and size for this tile
        const dstX = Math.round(srcX0 * scaleX);
        const dstY = Math.round(srcY0 * scaleY);
        const dstW = Math.max(1, Math.round(srcW * scaleX));
        const dstH = Math.max(1, Math.round(srcH * scaleY));

        try {
          // Read ONLY this spatial window — geotiff.js will only decompress
          // the strips/tiles that intersect [srcX0, srcY0, srcX1, srcY1]
          const tileData = await primaryImage.readRasters({
            window: [srcX0, srcY0, srcX1, srcY1],
            width: dstW,
            height: dstH,
            interleave: false
          });

          // Render this tile's pixels to a temporary canvas
          const tileCanvas = document.createElement('canvas');
          tileCanvas.width = dstW;
          tileCanvas.height = dstH;
          const tileCtx = tileCanvas.getContext('2d');
          const tileImgData = tileCtx.createImageData(dstW, dstH);

          this.fillImageData(tileImgData, tileData, bandCount, noDataValue, palette, renderingMode);

          tileCtx.putImageData(tileImgData, 0, 0);

          // Composite onto the main output canvas
          ctx.drawImage(tileCanvas, dstX, dstY);

        } catch (tileErr) {
          // If a single tile fails, skip it rather than crashing everything
          console.warn(`Tile [${tx},${ty}] failed: ${tileErr.message}`);
        }

        tilesProcessed++;
        if (tilesProcessed % 10 === 0 || tilesProcessed === totalTiles) {
          debugLog(`Tiles processed: ${tilesProcessed}/${totalTiles}`);
        }
      }
    }

    const dataUrl = canvas.toDataURL('image/png');

    debugLog(`Tiled decode complete: ${outW}x${outH} from ${fullWidth}x${fullHeight}`);

    return {
      dataUrl, projection,
      xmin: bbox[0], ymin: bbox[1], xmax: bbox[2], ymax: bbox[3],
      noDataValue, fullWidth, fullHeight,
      decodeWidth: outW, decodeHeight: outH, downsampled: true
    };
  }

  // ─── Pixel Rendering Helpers ────────────────────────────────────────────────

  /**
   * Fills an ImageData object from flat band arrays returned by readRasters().
   *
   * Rendering mode selection:
   *   - 'palette':            Single-band indexed raster with embedded ColorMap.
   *                           Each pixel value is an index into the palette array.
   *   - 'rgb':                Multi-band (3+) raster. Bands map to R, G, B directly.
   *   - 'grayscale-inverted': Single-band where 0=white, max=black (PhotometricInterpretation=0).
   *   - 'grayscale':          Default fallback. Normalizes values to 0-255 grayscale.
   */
  fillImageData(imageData, rasterData, bandCount, noDataValue, palette = null, renderingMode = 'grayscale') {
    const bandR = rasterData[0];
    const bandG = bandCount >= 3 ? rasterData[1] : null;
    const bandB = bandCount >= 3 ? rasterData[2] : null;
    const pixelCount = bandR.length;

    // ── Palette rendering: look up each pixel value in the ColorMap ──
    if (renderingMode === 'palette' && palette) {
      for (let i = 0; i < pixelCount; i++) {
        const v = bandR[i];
        if (v === noDataValue || isNaN(v) || !isFinite(v)) {
          imageData.data[i * 4 + 3] = 0; // Transparent
        } else {
          const idx = Math.round(v);
          if (idx >= 0 && idx < palette.length) {
            imageData.data[i * 4]     = palette[idx][0]; // R from palette
            imageData.data[i * 4 + 1] = palette[idx][1]; // G from palette
            imageData.data[i * 4 + 2] = palette[idx][2]; // B from palette
            imageData.data[i * 4 + 3] = 255;
          } else {
            // Index out of palette range — render transparent
            imageData.data[i * 4 + 3] = 0;
          }
        }
      }
      return;
    }

    // ── RGB rendering: use band values directly as color channels ──
    if (renderingMode === 'rgb' && bandG && bandB) {
      for (let i = 0; i < pixelCount; i++) {
        const v = bandR[i];
        if (v === noDataValue || isNaN(v) || !isFinite(v)) {
          imageData.data[i * 4 + 3] = 0;
        } else {
          imageData.data[i * 4]     = Math.min(255, Math.max(0, v));
          imageData.data[i * 4 + 1] = Math.min(255, Math.max(0, bandG[i]));
          imageData.data[i * 4 + 2] = Math.min(255, Math.max(0, bandB[i]));
          imageData.data[i * 4 + 3] = 255;
        }
      }
      return;
    }

    // ── Grayscale fallback or Custom Color Ramp ──
    let min = 0, max = 255;
    let cMin = Infinity, cMax = -Infinity;
    for (let i = 0; i < pixelCount; i++) {
      const v = bandR[i];
      if (v !== noDataValue && !isNaN(v) && isFinite(v)) {
        if (v < cMin) cMin = v;
        if (v > cMax) cMax = v;
      }
    }
    if (cMin !== Infinity) { min = cMin; max = cMax; }
    
    // For population density, a typical max is extremely high due to cities.
    // Clamp the max for visual rendering to 95th percentile or a fixed cap (e.g. 5000)
    // if using the population ramp, to prevent it from looking mostly blue.
    if (renderingMode === 'population') {
      max = Math.min(max, 2500); 
    }
    
    const range = (max - min) || 1;
    const invert = renderingMode === 'grayscale-inverted';

    for (let i = 0; i < pixelCount; i++) {
      const v = bandR[i];
      if (v === noDataValue || isNaN(v) || !isFinite(v)) {
        imageData.data[i * 4 + 3] = 0;
      } else if (renderingMode === 'population' && v <= 0) {
        imageData.data[i * 4] = 0;
        imageData.data[i * 4 + 1] = 0;
        imageData.data[i * 4 + 2] = 255;
        imageData.data[i * 4 + 3] = 255;
      } else if (v <= 0) {
        imageData.data[i * 4 + 3] = 0;
      } else {
        let frac = (v - min) / range;
        if (frac < 0) frac = 0; if (frac > 1) frac = 1;
        
        if (renderingMode === 'population') {
          // Heatmap: Blue -> Cyan -> Yellow -> Red -> Dark Red
          let r, g, b;
          if (frac < 0.25) {
            let f = frac / 0.25;
            r = 0; g = Math.floor(255 * f); b = 255;
          } else if (frac < 0.5) {
            let f = (frac - 0.25) / 0.25;
            r = Math.floor(255 * f); g = 255; b = Math.floor(255 * (1 - f));
          } else if (frac < 0.75) {
            let f = (frac - 0.5) / 0.25;
            r = 255; g = Math.floor(255 * (1 - f)); b = 0;
          } else {
            let f = (frac - 0.75) / 0.25;
            r = Math.floor(255 * (1 - 0.5 * f)); g = 0; b = 0;
          }
          imageData.data[i * 4]     = r;
          imageData.data[i * 4 + 1] = g;
          imageData.data[i * 4 + 2] = b;
        } else if (renderingMode === 'land-cover') {
          // ESA WorldCover 10m Classes
          let r = 0, g = 0, b = 0, a = 255;
          switch(Math.round(v)) {
            case 10: r = 0; g = 100; b = 0; break;       // Trees
            case 20: r = 255; g = 187; b = 34; break;    // Shrubland
            case 30: r = 255; g = 255; b = 76; break;    // Grassland
            case 40: r = 240; g = 150; b = 255; break;   // Cropland
            case 50: r = 250; g = 0; b = 0; break;       // Built-up
            case 60: r = 180; g = 180; b = 180; break;   // Bare / sparse veg
            case 70: r = 240; g = 240; b = 240; break;   // Snow and ice
            case 80: r = 0; g = 100; b = 200; break;     // Permanent water
            case 90: r = 0; g = 150; b = 160; break;     // Herbaceous wetland
            case 95: r = 0; g = 207; b = 117; break;     // Mangroves
            case 100: r = 250; g = 230; b = 160; break;  // Moss and lichen
            default: a = 0; break;                       // Transparent for unknown/nodata
          }
          imageData.data[i * 4]     = r;
          imageData.data[i * 4 + 1] = g;
          imageData.data[i * 4 + 2] = b;
          imageData.data[i * 4 + 3] = a;
          continue; // skip the default alpha assignment below
        } else {
          let c = Math.round(frac * 255);
          if (invert) c = 255 - c;
          imageData.data[i * 4]     = c;
          imageData.data[i * 4 + 1] = c;
          imageData.data[i * 4 + 2] = c;
        }
        imageData.data[i * 4 + 3] = 255;
      }
    }
  }

  /**
   * Renders flat rasterData arrays to a canvas and returns a data URL.
   * Used for single-shot (non-tiled) decodes.
   */
  renderToCanvas(rasterData, width, height, bandCount, noDataValue, palette = null, renderingMode = 'grayscale') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    this.fillImageData(imageData, rasterData, bandCount, noDataValue, palette, renderingMode);

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  // ─── Add GeoTIFF from Local File Upload ─────────────────────────────────────
  async addGeoTiffLayer(file, layerId, options = {}) {
    const { onProgress, onStateChange, abortSignal } = options;
    const map = this.map;
    if (!map) throw new Error("Map instance is not available.");

    try {
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            reader.abort();
            reject(new Error('Upload cancelled by user.'));
          });
        }

        reader.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(event.loaded, event.total);
          }
        };

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsArrayBuffer(file);
      });

      if (onStateChange) onStateChange('processing');

      const result = await this.decodeGeoTiffSafe(arrayBuffer, options);

      const { xmin, ymin, xmax, ymax } = this.transformBoundsRaw(
        result.projection, result.xmin, result.ymin, result.xmax, result.ymax
      );

      const coordinates = [
        [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
      ];

      const sourceId = `${layerId}-source`;

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'image', url: result.dataUrl, coordinates
        });

        debugLog(`%c[GeoTIFF Render]`, 'color: #22c55e; font-weight: bold;');
        debugLog(`Adding layer: ${layerId}`);
        debugLog(`Decoded: ${result.decodeWidth}x${result.decodeHeight} (from ${result.fullWidth}x${result.fullHeight})`);
        if (result.downsampled) console.warn(`⚠ Large raster was downsampled for memory safety.`);

        const beforeId = map.getLayer('india-boundary-fill') ? 'india-boundary-fill' : undefined;
        map.addLayer({
          id: layerId, type: 'raster', source: sourceId,
          layout: { 'visibility': 'visible' },
          paint: { 'raster-opacity': 0.8, 'raster-fade-duration': 0 }
        }, beforeId);

        debugLog(`Layer "${layerId}" added successfully.`);
      }

      this.rasterCache.set(layerId, { sourceId, layerId });
      mapLayerService.bringSimulationLayersToFront(this.map);

    } catch (error) {
      console.error('Failed to add GeoTIFF layer:', error);
      throw error;
    }
  }

  // ─── Add GeoTIFF from URL (Built-in Layers) ────────────────────────────────
  async addGeoTiffFromUrl(url, layerId, options = {}) {
    const { onStateChange } = options;
    const map = this.map;
    if (!map) throw new Error("Map instance is not available.");

    try {
      if (onStateChange) onStateChange('reading');

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch raster from ${url}`);
      const arrayBuffer = await response.arrayBuffer();

      if (onStateChange) onStateChange('processing');

      const result = await this.decodeGeoTiffSafe(arrayBuffer, options);

      const { xmin, ymin, xmax, ymax } = this.transformBoundsRaw(
        result.projection, result.xmin, result.ymin, result.xmax, result.ymax
      );

      const coordinates = [
        [xmin, ymax], [xmax, ymax], [xmax, ymin], [xmin, ymin]
      ];

      const sourceId = `${layerId}-source`;

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'image', url: result.dataUrl, coordinates
        });

        debugLog(`%c[GeoTIFF Render]`, 'color: #22c55e; font-weight: bold;');
        debugLog(`Adding built-in layer: ${layerId}`);
        debugLog(`Decoded: ${result.decodeWidth}x${result.decodeHeight}`);

        const beforeId = map.getLayer('india-boundary-fill') ? 'india-boundary-fill' : undefined;
        map.addLayer({
          id: layerId, type: 'raster', source: sourceId,
          layout: { 'visibility': options.visible !== false ? 'visible' : 'none' },
          paint: {
            'raster-opacity': options.opacity !== undefined ? options.opacity : 0.8,
            'raster-fade-duration': 0
          }
        }, beforeId);

        debugLog(`Layer "${layerId}" added successfully.`);
      }

      this.rasterCache.set(layerId, { sourceId, layerId });
      mapLayerService.bringSimulationLayersToFront(this.map);
      if (onStateChange) onStateChange('completed');

    } catch (error) {
      console.error('Failed to add GeoTIFF from URL:', error);
      if (onStateChange) onStateChange('failed', error.message);
      throw error;
    }
  }

  // ─── Layer Management ───────────────────────────────────────────────────────

  removeGeoTiffLayer(layerId) {
    const map = this.map;
    if (!map) return;
    const cacheEntry = this.rasterCache.get(layerId);
    if (!cacheEntry) return;
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(cacheEntry.sourceId)) map.removeSource(cacheEntry.sourceId);
    this.rasterCache.delete(layerId);
  }


  updateVisibility(layerId, isVisible) {
    const map = this.map;
    if (!map || !map.getLayer(layerId)) return;
    map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
    if (isVisible) {
      mapLayerService.bringSimulationLayersToFront(map);
    }
  }
}

export const rasterService = new RasterService();
