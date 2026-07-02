import circle from '@turf/circle';

class AnimationManager {
  constructor() {
    this.shockwaveAnimRef = null;
    this.tsunamiAnimRef = null;
    this.timeoutId = null;
    this.map = null;
    this.tsunamiMap = null;
    this.isLooping = false;
    this.isTsunamiLooping = false;
    this.loopConfig = null;
    this.tsunamiLoopConfig = null;
    this.loopTimeoutId = null;
    this.oceanMaskCache = new Map();
    this.tsunamiFrames = [];
    this.tsunamiLastFrameIndex = -1;
    // We intentionally removed setIsSimulationRunning to prevent state deadlocks.
    // The UI 'Run' button state should strictly follow the API fetch request,
    // not the async drawing loops.
  }

  _destinationPoint([lng, lat], distanceKm, bearingDeg) {
    const radiusKm = 6371.0088;
    const angularDistance = distanceKm / radiusKm;
    const bearing = bearingDeg * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return [
      ((((lng2 * 180 / Math.PI) + 540) % 360) - 180),
      lat2 * 180 / Math.PI,
    ];
  }

  _buildTsunamiWavefront(epicenter, radiusKm, { phase = 0, steps = 128 } = {}) {
    const coordinates = [];
    const center = [epicenter.lng, epicenter.lat];

    // Tsunami wavefront rendering: keep the geometry light, but slightly
    // deform each ring so it reads like a propagation contour instead of
    // a mechanical perfect circle.
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 360;
      const theta = angle * Math.PI / 180;
      const longWave = Math.sin(theta * 3 + phase) * 0.055;
      const shortWave = Math.sin(theta * 7 - phase * 0.7) * 0.025;
      const directionalStretch = Math.cos(theta - Math.PI * 0.7) * 0.08;
      const shapedRadius = Math.max(1, radiusKm * (1 + longWave + shortWave + directionalStretch));
      coordinates.push(this._destinationPoint(center, shapedRadius, angle));
    }

    return coordinates;
  }

  _isOceanCoordinate(mapInstance, coordinate) {
    const [lng, lat] = coordinate;
    const key = `${lng.toFixed(1)},${lat.toFixed(1)}`;
    if (this.oceanMaskCache.has(key)) return this.oceanMaskCache.get(key);

    let isOcean = false;
    try {
      const point = mapInstance.project(coordinate);
      const canvas = mapInstance.getCanvas();
      if (
        point.x < 0
        || point.y < 0
        || point.x > canvas.clientWidth
        || point.y > canvas.clientHeight
      ) {
        this.oceanMaskCache.set(key, false);
        return false;
      }

      const features = mapInstance.queryRenderedFeatures(point);
      const layerIds = features.map((feature) => feature.layer?.id || '').join(' ').toLowerCase();
      const sourceLayers = features.map((feature) => feature.sourceLayer || feature.sourceLayer || '').join(' ').toLowerCase();
      const descriptor = `${layerIds} ${sourceLayers}`;

      if (/(water|ocean|marine|sea)/.test(descriptor)) {
        isOcean = true;
      }
      if (/(land|admin|country|boundary|place|settlement|building)/.test(descriptor) && !/(water|ocean|marine|sea)/.test(descriptor)) {
        isOcean = false;
      }
    } catch (err) {
      isOcean = false;
    }

    if (this.oceanMaskCache.size > 1200) this.oceanMaskCache.clear();
    this.oceanMaskCache.set(key, isOcean);
    return isOcean;
  }

  _splitOceanWavefrontSegments(mapInstance, coordinates) {
    const features = [];
    let segment = [];

    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const current = coordinates[i];
      const midpoint = [(prev[0] + current[0]) / 2, (prev[1] + current[1]) / 2];
      if (this._isOceanCoordinate(mapInstance, midpoint)) {
        if (!segment.length) segment.push(prev);
        segment.push(current);
        continue;
      }
      if (segment.length >= 2) features.push(segment);
      segment = [];
    }

    if (segment.length >= 2) features.push(segment);
    return features;
  }

  startTsunamiWavefront(mapInstance, epicenter, options = {}) {
    this.stopTsunamiWavefront();

    if (!mapInstance || !mapInstance.getStyle()) return;
    if (!epicenter || !Number.isFinite(epicenter.lat) || !Number.isFinite(epicenter.lng)) {
      console.warn('[AnimationManager] Invalid tsunami epicenter coordinates, aborting wavefront animation.');
      return;
    }

    this.tsunamiMap = mapInstance;
    this.isTsunamiLooping = true;
    this.tsunamiLoopConfig = {
      epicenter,
      duration: options.duration || 8500,
      maxRadiusKm: options.maxRadiusKm || 1700,
      ringCount: options.ringCount || 4,
      steps: options.steps || 72,
      frameCount: options.frameCount || 24,
    };
    this.tsunamiFrames = this._precomputeTsunamiWavefrontFrames(mapInstance, this.tsunamiLoopConfig);
    this.tsunamiLastFrameIndex = -1;
    this._runTsunamiWavefront();
  }

  _precomputeTsunamiWavefrontFrames(mapInstance, config) {
    const { epicenter, maxRadiusKm, ringCount, steps, frameCount } = config;
    const frames = [];

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
      const cycleProgress = frameIndex / frameCount;
      const features = [];

      for (let ringIndex = 0; ringIndex < ringCount; ringIndex++) {
        const ringProgress = (cycleProgress + ringIndex / ringCount) % 1;
        const eased = ringProgress * ringProgress * (3 - 2 * ringProgress);
        const radiusKm = 80 + eased * maxRadiusKm;
        const fade = Math.max(0, 1 - ringProgress);
        const coordinates = this._buildTsunamiWavefront(epicenter, radiusKm, {
          phase: cycleProgress * Math.PI * 2 + ringIndex,
          steps,
        });

        // Ocean-valid wavefront segments are computed once per cached frame.
        // Playback only swaps prebuilt GeoJSON, avoiding per-frame land checks.
        this._splitOceanWavefrontSegments(mapInstance, coordinates).forEach((segment) => {
          features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: segment },
            properties: {
              opacity: 0.24 + fade * 0.58,
              glowOpacity: 0.08 + fade * 0.22,
              width: 1.4 + fade * 1.2,
              glowWidth: 5 + fade * 4,
            },
          });
        });
      }

      frames.push({ type: 'FeatureCollection', features });
    }

    return frames.length ? frames : [{ type: 'FeatureCollection', features: [] }];
  }

  _runTsunamiWavefront() {
    if (!this.isTsunamiLooping || !this.tsunamiMap || !this.tsunamiMap.getStyle()) return;

    const source = this.tsunamiMap.getSource('tsunami-wavefront-source');
    if (!source?.setData) return;

    const startTime = performance.now();
    const animate = (now) => {
      try {
        if (!this.isTsunamiLooping || !this.tsunamiMap?.getStyle()) return;

        const { duration } = this.tsunamiLoopConfig;
        const cycleProgress = ((now - startTime) % duration) / duration;
        const frameIndex = Math.floor(cycleProgress * this.tsunamiFrames.length) % this.tsunamiFrames.length;

        if (frameIndex !== this.tsunamiLastFrameIndex) {
          source.setData(this.tsunamiFrames[frameIndex]);
          this.tsunamiLastFrameIndex = frameIndex;
        }

        this.tsunamiAnimRef = requestAnimationFrame(animate);
      } catch (err) {
        console.error('[AnimationManager] Tsunami wavefront animation failed:', err);
        this.stopTsunamiWavefront();
      }
    };

    this.tsunamiAnimRef = requestAnimationFrame(animate);
  }

  stopTsunamiWavefront() {
    this.isTsunamiLooping = false;

    if (this.tsunamiAnimRef) {
      cancelAnimationFrame(this.tsunamiAnimRef);
      this.tsunamiAnimRef = null;
    }
    this.tsunamiFrames = [];
    this.tsunamiLastFrameIndex = -1;

    try {
      if (this.tsunamiMap && this.tsunamiMap.getStyle()) {
        const source = this.tsunamiMap.getSource('tsunami-wavefront-source');
        if (source?.setData) {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    } catch (err) {
      console.error('[AnimationManager] Failed to clear tsunami wavefront:', err);
    }
  }

  // Backward compatibility for MapView.jsx
  setStoreActions(setIsSimulationRunning) {
    // No-op to decouple animation state from UI simulation state lock
  }

  startShockwave(mapInstance, epicenter, maxRadiusKm, duration = 2000) {
    this.stopShockwave(); // Clear any existing animation first

    if (!mapInstance || !mapInstance.getStyle()) return;
    this.map = mapInstance;

    // Failsafe validation
    if (!epicenter || !Number.isFinite(epicenter.lat) || !Number.isFinite(epicenter.lng)) {
      console.warn('[AnimationManager] Invalid epicenter coordinates, aborting animation.');
      return;
    }
    
    if (!Number.isFinite(maxRadiusKm) || maxRadiusKm <= 0) {
      maxRadiusKm = 300; // fallback
    }

    this.isLooping = true;
    this.loopConfig = { epicenter, maxRadiusKm, duration };
    this._runCycle();
  }

  _runCycle() {
    if (!this.isLooping || !this.map || !this.map.getStyle()) return;

    if (this.shockwaveAnimRef) cancelAnimationFrame(this.shockwaveAnimRef);

    const { epicenter, maxRadiusKm, duration } = this.loopConfig;
    const startTime = performance.now();

    // Temporal failsafe. Force stop if it hangs for too long.
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => {
      console.warn('[AnimationManager] Animation cycle exceeded temporal timeout. Force ending cycle.');
      this._endCycle();
    }, duration + 5000);

    const animate = (now) => {
      try {
        if (!this.isLooping) return; // double check

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Three concentric shockwave rings at staggered progress for depth effect
        const rings = [
          { progress: progress, opacity: 0.6 * (1 - progress), width: 3 + progress * 4 },
          { progress: Math.max(0, progress - 0.15), opacity: 0.4 * (1 - Math.max(0, progress - 0.15)), width: 2 + Math.max(0, progress - 0.15) * 3 },
          { progress: Math.max(0, progress - 0.3), opacity: 0.25 * (1 - Math.max(0, progress - 0.3)), width: 1.5 + Math.max(0, progress - 0.3) * 2 },
        ].filter(r => r.progress > 0);

        const features = rings.map(r => {
          const currentRadius = Math.max(0.1, maxRadiusKm * r.progress);
          return circle(
            [epicenter.lng, epicenter.lat],
            currentRadius,
            { units: 'kilometers', steps: 64 }
          );
        });

        const source = this.map.getSource('sim-shockwave-source');
        if (source && source.setData) {
          source.setData({ type: 'FeatureCollection', features });
          if (this.map.getLayer('sim-shockwave')) {
            const primary = rings[0];
            if (primary) {
              this.map.setPaintProperty('sim-shockwave', 'line-opacity', primary.opacity);
              this.map.setPaintProperty('sim-shockwave', 'line-width', primary.width);
            }
          }
        }

        if (progress < 1) {
          this.shockwaveAnimRef = requestAnimationFrame(animate);
        } else {
          this._endCycle();
        }
      } catch (err) {
        console.error('[AnimationManager] Crash detected in animation loop:', err);
        this.stopShockwave(); // Guaranteed cleanup on crash
      }
    };

    this.shockwaveAnimRef = requestAnimationFrame(animate);
  }

  _endCycle() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    try {
      if (this.map && this.map.getStyle()) {
        const source = this.map.getSource('sim-shockwave-source');
        if (source && source.setData) {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    } catch (err) {
      console.error('[AnimationManager] Failed to clear layer state:', err);
    }

    if (this.isLooping) {
      this.loopTimeoutId = setTimeout(() => {
        this._runCycle();
      }, 2000); // 2-second pause before next loop
    }
  }

  stopShockwave() {
    this.isLooping = false;

    if (this.shockwaveAnimRef) {
      cancelAnimationFrame(this.shockwaveAnimRef);
      this.shockwaveAnimRef = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.loopTimeoutId) {
      clearTimeout(this.loopTimeoutId);
      this.loopTimeoutId = null;
    }

    try {
      if (this.map && this.map.getStyle()) {
        const source = this.map.getSource('sim-shockwave-source');
        if (source && source.setData) {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    } catch (err) {
      console.error('[AnimationManager] Failed to clear layer state:', err);
    }
  }

}

export const animationManager = new AnimationManager();
