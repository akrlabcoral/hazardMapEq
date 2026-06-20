import circle from '@turf/circle';

const EMPTY_FEATURE_COLLECTION = { type: 'FeatureCollection', features: [] };
const TSUNAMI_SOURCE_ID = 'tsunami-wave-source';
const TSUNAMI_WAVE_RADII_KM = [150, 350, 650, 950, 1300];
const TSUNAMI_WAVE_LABELS = ['1h', '2h', '3h', '5h', ''];

const getEventEpicenter = (event) => {
  if (!event) return null;
  const lat = Number(event.latitude ?? event.lat);
  const lng = Number(event.longitude ?? event.lng ?? event.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const polygonCircleToLineString = (circleFeature, properties) => {
  const coordinates = circleFeature?.geometry?.coordinates?.[0];
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;

  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates,
    },
    properties: {
      ...properties,
      geomType: 'LineString',
    },
  };
};

const buildTsunamiLabelFeature = (circleFeature, label, properties) => {
  if (!label) return null;
  const coordinates = circleFeature?.geometry?.coordinates?.[0];
  if (!Array.isArray(coordinates) || !coordinates.length) return null;

  const labelIndex = Math.min(coordinates.length - 1, Math.floor(coordinates.length * 0.12));
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coordinates[labelIndex],
    },
    properties: {
      ...properties,
      label,
      geomType: 'Point',
    },
  };
};

class AnimationManager {
  constructor() {
    this.shockwaveAnimRef = null;
    this.timeoutId = null;
    this.map = null;
    this.isLooping = false;
    this.loopConfig = null;
    this.loopTimeoutId = null;
    this.tsunamiAnimRef = null;
    this.tsunamiTimeoutId = null;
    this.isTsunamiLooping = false;
    this.tsunamiLoopConfig = null;
    this.tsunamiLoopTimeoutId = null;
    // We intentionally removed setIsSimulationRunning to prevent state deadlocks.
    // The UI 'Run' button state should strictly follow the API fetch request,
    // not the async drawing loops.
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

  startTsunamiWave(mapInstance, event, duration = 6500) {
    this.stopTsunamiWave();

    if (!mapInstance || !mapInstance.getStyle()) return;
    const epicenter = getEventEpicenter(event);
    if (!epicenter) {
      console.warn('[AnimationManager] Invalid tsunami epicenter coordinates, aborting animation.');
      return;
    }

    this.map = mapInstance;
    this.isTsunamiLooping = true;
    this.tsunamiLoopConfig = { epicenter, duration };
    this._runTsunamiCycle();
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

  _runTsunamiCycle() {
    if (!this.isTsunamiLooping || !this.map || !this.map.getStyle()) return;

    if (this.tsunamiAnimRef) cancelAnimationFrame(this.tsunamiAnimRef);

    const { epicenter, duration } = this.tsunamiLoopConfig;
    const startTime = performance.now();

    if (this.tsunamiTimeoutId) clearTimeout(this.tsunamiTimeoutId);
    this.tsunamiTimeoutId = setTimeout(() => {
      console.warn('[AnimationManager] Tsunami animation cycle exceeded temporal timeout. Force ending cycle.');
      this._endTsunamiCycle();
    }, duration + 5000);

    const animate = (now) => {
      try {
        if (!this.isTsunamiLooping) return;

        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const features = [];

        TSUNAMI_WAVE_RADII_KM.forEach((targetRadiusKm, index) => {
          const delay = index * 0.11;
          const localProgress = Math.max(0, Math.min((progress - delay) / (1 - delay), 1));
          if (localProgress <= 0) return;

          const radiusKm = Math.max(8, targetRadiusKm * localProgress);
          const fadeIn = Math.min(localProgress / 0.18, 1);
          const fadeOut = Math.max(0, 1 - Math.max(0, localProgress - 0.72) / 0.28);
          const opacity = fadeIn * fadeOut;
          const waveCircle = circle(
            [epicenter.lng, epicenter.lat],
            radiusKm,
            { units: 'kilometers', steps: 128 }
          );
          const lineFeature = polygonCircleToLineString(waveCircle, {
            waveIndex: index,
            radiusKm,
            lineOpacity: 0.28 + opacity * 0.62,
            glowOpacity: 0.12 + opacity * 0.22,
            lineWidth: 1.4 + opacity * 1.2,
            glowWidth: 5 + opacity * 5,
          });
          const labelFeature = buildTsunamiLabelFeature(waveCircle, TSUNAMI_WAVE_LABELS[index], {
            waveIndex: index,
            labelOpacity: opacity,
          });

          if (lineFeature) features.push(lineFeature);
          if (labelFeature && localProgress > 0.35) features.push(labelFeature);
        });

        const source = this.map.getSource(TSUNAMI_SOURCE_ID);
        if (source?.setData) {
          source.setData({ type: 'FeatureCollection', features });
        }

        if (progress < 1) {
          this.tsunamiAnimRef = requestAnimationFrame(animate);
        } else {
          this._endTsunamiCycle();
        }
      } catch (err) {
        console.error('[AnimationManager] Crash detected in tsunami animation loop:', err);
        this.stopTsunamiWave();
      }
    };

    this.tsunamiAnimRef = requestAnimationFrame(animate);
  }

  _endTsunamiCycle() {
    if (this.tsunamiTimeoutId) {
      clearTimeout(this.tsunamiTimeoutId);
      this.tsunamiTimeoutId = null;
    }

    this._clearTsunamiWaveSource();

    if (this.isTsunamiLooping) {
      this.tsunamiLoopTimeoutId = setTimeout(() => {
        this._runTsunamiCycle();
      }, 700);
    }
  }

  _clearTsunamiWaveSource() {
    try {
      if (this.map && this.map.getStyle()) {
        const source = this.map.getSource(TSUNAMI_SOURCE_ID);
        if (source?.setData) {
          source.setData(EMPTY_FEATURE_COLLECTION);
        }
      }
    } catch (err) {
      console.error('[AnimationManager] Failed to clear tsunami layer state:', err);
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

  stopTsunamiWave() {
    this.isTsunamiLooping = false;

    if (this.tsunamiAnimRef) {
      cancelAnimationFrame(this.tsunamiAnimRef);
      this.tsunamiAnimRef = null;
    }

    if (this.tsunamiTimeoutId) {
      clearTimeout(this.tsunamiTimeoutId);
      this.tsunamiTimeoutId = null;
    }

    if (this.tsunamiLoopTimeoutId) {
      clearTimeout(this.tsunamiLoopTimeoutId);
      this.tsunamiLoopTimeoutId = null;
    }

    this._clearTsunamiWaveSource();
  }
}

export const animationManager = new AnimationManager();
