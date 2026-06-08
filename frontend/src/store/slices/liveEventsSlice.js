export const createLiveEventsSlice = (set) => ({
  liveEvents: [],
  setLiveEvents: (events) => set({ liveEvents: events }),
  addLiveEvent: (event) => set((s) => ({ liveEvents: [event, ...s.liveEvents].slice(0, 50) })),
  clearLiveEvents: () => set({ liveEvents: [] }),

  activeAlert: null,
  setActiveAlert: (event) => set({ activeAlert: event }),
  dismissAlert: () => set({ activeAlert: null }),

  wsConnected: false,
  setWsConnected: (val) => set({ wsConnected: val }),

  autoSimEnabled: true,
  setAutoSimEnabled: (val) => set({ autoSimEnabled: val }),
});
