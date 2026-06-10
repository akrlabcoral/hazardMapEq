const isAbsoluteUrl = (path) => path.startsWith('/') || /^https?:\/\//i.test(path);

export const fetchGeoJson = async (path, options = {}) => {
  const url = isAbsoluteUrl(path) ? path : `/data/${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  return response.json();
};
