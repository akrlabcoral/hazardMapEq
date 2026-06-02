export const BUILT_IN_RASTERS = [
  {
    id: "land-cover",
    name: "Land Cover",
    type: "raster",
    sourceType: "geotiff",
    url: "/rasters/land-cover.tif",
    visible: false,
    opacity: 0.7,
    isBuiltIn: true,
    isLoaded: false
  },
  {
    id: "population-exposure",
    name: "Population Exposure (WorldPop)",
    type: "raster",
    sourceType: "geotiff",
    url: "/rasters/ind_pd_2020_1km.tif",
    visible: false,
    opacity: 0.8,
    isBuiltIn: true,
    isLoaded: false
  }
];
