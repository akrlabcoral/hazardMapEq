export const createHazardSlice = (set) => ({
  activeHazard: 'earthquake',
  setActiveHazard: (hazard) => set({ activeHazard: hazard }),

  activePanel: null,
  activeSection: null,
  setActivePanel: (panel) => set((state) => {
    const nextPanel = state.activePanel === panel ? null : panel;
    return { activePanel: nextPanel, activeSection: nextPanel };
  }),
  forceActivePanel: (panel) => set({ activePanel: panel, activeSection: panel }),

  setActiveSection: (section) => set((state) => {
    const nextSection = state.activePanel === section ? null : section;
    return { activePanel: nextSection, activeSection: nextSection };
  }),
  forceActiveSection: (section) => set({ activePanel: section, activeSection: section }),
});
