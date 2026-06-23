export const TSUNAMI_DEFAULT_FORM = {
  magnitude: '7.0',
  latitude: '',
  longitude: '',
  depth_km: '10',
  offshore_wave_height_m: '',
  strike_deg: '0',
  dip_deg: '15',
  rake_deg: '90',
  mechanism: 'thrust',
  max_targets: '100',
  target_spacing_km: '50',
  coastal_depth_m: '10',
  amplification_factor: '1.5',
  max_coast_points: '50',
  coast_spacing_km: '25',
  transect_length_km: '10',
  transect_spacing_m: '250',
  include_damage_assessment: true,
};

export const createTsunamiSlice = (set) => ({
  tsunamiResult: null,
  tsunamiSource: null,
  tsunamiSimulationForm: TSUNAMI_DEFAULT_FORM,
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
  setTsunamiSimulationForm: (updates) => set((state) => ({
    tsunamiSimulationForm: {
      ...state.tsunamiSimulationForm,
      ...(typeof updates === 'function' ? updates(state.tsunamiSimulationForm) : updates),
    },
  })),
  resetTsunamiSimulationForm: () => set({ tsunamiSimulationForm: TSUNAMI_DEFAULT_FORM }),
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
