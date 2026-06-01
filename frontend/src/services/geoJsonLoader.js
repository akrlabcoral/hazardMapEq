export const fetchGeoJson = async (filename) => {
  try {
    const url = `/data/${filename}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return { type: 'FeatureCollection', features: [] };
  }
};
