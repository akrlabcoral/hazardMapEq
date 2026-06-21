export const createUiSlice = (set) => ({
  activeHazard: 'earthquake',
  setActiveHazard: (hazard) => set({ activeHazard: hazard }),

  activeSection: null,
  setActiveSection: (section) => set((state) => ({ activeSection: state.activeSection === section ? null : section })),
  forceActiveSection: (section) => set({ activeSection: section }),

  mapStyle: 'light',
  toggleMapStyle: () => set((state) => ({ mapStyle: state.mapStyle === 'dark' ? 'light' : 'dark' })),
});
