export const createTsunamiSlice = (set) => ({
  tsunamiResult: null,
  tsunamiSource: null,
  setTsunamiResult: (result) => set({ tsunamiResult: result }),
  setTsunamiSource: (source) => set({ tsunamiSource: source }),
  clearTsunamiState: () => set({ tsunamiResult: null, tsunamiSource: null }),
});
