export const createUiSlice = (set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  activeSection: null,
  setActiveSection: (section) => set((state) => ({ activeSection: state.activeSection === section ? null : section })),
  forceActiveSection: (section) => set({ activeSection: section }),

  activeRightSection: null,
  setActiveRightSection: (section) => set((state) => ({ activeRightSection: state.activeRightSection === section ? null : section })),

  mapStyle: 'light',
  toggleMapStyle: () => set((state) => ({ mapStyle: state.mapStyle === 'dark' ? 'light' : 'dark' })),
});
