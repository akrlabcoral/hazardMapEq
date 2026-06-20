export const createLiveEventsSlice = (set) => ({
  liveEvents: [],
  setLiveEvents: (events) => set({ liveEvents: events }),
  addLiveEvent: (event) => set((s) => ({ liveEvents: [event, ...s.liveEvents].slice(0, 50) })),
  clearLiveEvents: () => set({ liveEvents: [], activeTsunamiWarning: null }),

  activeAlert: null,
  setActiveAlert: (event) => set({ activeAlert: event }),
  dismissAlert: () => set({ activeAlert: null, activeTsunamiWarning: null }),

  activeTsunamiWarning: null,
  setActiveTsunamiWarning: (event) => set({ activeTsunamiWarning: event }),
  clearActiveTsunamiWarning: () => set({ activeTsunamiWarning: null }),

  wsConnected: false,
  setWsConnected: (val) => set({ wsConnected: val }),

  autoSimEnabled: true,
  setAutoSimEnabled: (val) => set({ autoSimEnabled: val }),

  // Shared region filter — used by LiveEventsPanel (UI) and useWebSocket (WS push guard)
  regionFilter: 'india',
  setRegionFilter: (region) => set({ regionFilter: region }),
});
