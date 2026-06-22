export const createTsunamiSlice = (set) => ({
  tsunamiResult: null,
  tsunamiSource: null,
  tsunamiAnalysisRequestId: null,
  tsunamiAnalysisStatus: 'idle',
  tsunamiAnalysisResult: null,
  tsunamiAnalysisLayers: null,
  tsunamiAnalysisError: '',
  tsunamiAnalysisHistory: [],
  tsunamiAlerts: [],
  isTsunamiAnalysisRunning: false,
  setTsunamiResult: (result) => set({ tsunamiResult: result }),
  setTsunamiSource: (source) => set({ tsunamiSource: source }),
  setTsunamiAnalysisRequestId: (requestId) => set({ tsunamiAnalysisRequestId: requestId }),
  setTsunamiAnalysisStatus: (status) => set({ tsunamiAnalysisStatus: status }),
  setTsunamiAnalysisResult: (result) => set((state) => ({
    tsunamiAnalysisResult: result,
    tsunamiAnalysisHistory: result
      ? [result, ...(state.tsunamiAnalysisHistory || []).filter((item) => item?.request_id !== result?.request_id)].slice(0, 10)
      : state.tsunamiAnalysisHistory,
  })),
  setTsunamiAnalysisLayers: (layers) => set({ tsunamiAnalysisLayers: layers }),
  setTsunamiAnalysisError: (error) => set({ tsunamiAnalysisError: error }),
  setIsTsunamiAnalysisRunning: (isRunning) => set({ isTsunamiAnalysisRunning: isRunning }),
  addTsunamiAlert: (alert) => set((state) => ({ tsunamiAlerts: [alert, ...(state.tsunamiAlerts || [])].slice(0, 20) })),
  clearTsunamiState: () => set({
    tsunamiResult: null,
    tsunamiSource: null,
    tsunamiAnalysisRequestId: null,
    tsunamiAnalysisStatus: 'idle',
    tsunamiAnalysisResult: null,
    tsunamiAnalysisLayers: null,
    tsunamiAnalysisError: '',
    isTsunamiAnalysisRunning: false,
  }),
});

export default createTsunamiSlice;
