import circle from '@turf/circle';

class AnimationManager {
  constructor() {
    this.shockwaveAnimRef = null;
    this.timeoutId = null;
    this.map = null;
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

    const startTime = performance.now();

    // 10-second temporal failsafe. No matter what happens, kill it after 10s.
    this.timeoutId = setTimeout(() => {
      console.warn('[AnimationManager] Animation exceeded temporal timeout. Force stopping.');
      this.stopShockwave();
    }, 10000);

    const animate = (now) => {
      try {
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
          this.stopShockwave();
        }
      } catch (err) {
        console.error('[AnimationManager] Crash detected in animation loop:', err);
        this.stopShockwave(); // Guaranteed cleanup on crash
      }
    };

    this.shockwaveAnimRef = requestAnimationFrame(animate);
  }

  stopShockwave() {
    if (this.shockwaveAnimRef) {
      cancelAnimationFrame(this.shockwaveAnimRef);
      this.shockwaveAnimRef = null;
    }

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
  }
}

export const animationManager = new AnimationManager();

