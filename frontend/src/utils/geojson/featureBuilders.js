/**
 * src/utils/geojson/featureBuilders.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utility for converting individual raw simulation points into GeoJSON Features.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Converts a raw simulation point into a valid GeoJSON Feature.
 * Filters out invalid coordinates or missing data.
 * 
 * @param {Object} point Raw JSON simulation point
 * @returns {Object|null} GeoJSON Feature or null if invalid
 */
export function buildSimulationFeature(point) {
  if (!point || typeof point.lat !== 'number' || typeof point.lng !== 'number') {
    return null;
  }

  // Filter out invalid lat/lng ranges and NaN values
  if (isNaN(point.lat) || isNaN(point.lng) || point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
    return null;
  }

  // A predicted_effect is required for the heatmap intensity
  if (typeof point.predicted_effect !== 'number' || isNaN(point.predicted_effect)) {
    return null;
  }

  return {
    type: "Feature",
    properties: {
      predicted_effect: point.predicted_effect,
      distance_km: point.distance_km || 0,
      bearing_deg: point.bearing_deg || 0,
      source_magnitude: point.source_magnitude || 0,
      source_depth: point.source_depth || 0
    },
    geometry: {
      type: "Point",
      coordinates: [point.lng, point.lat] // GeoJSON requires [lng, lat]
    }
  };
}
