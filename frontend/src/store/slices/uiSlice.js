export const createUiSlice = (set) => ({
  mapStyle: 'light',
  toggleMapStyle: () => set((state) => ({ mapStyle: state.mapStyle === 'dark' ? 'light' : 'dark' })),
});
