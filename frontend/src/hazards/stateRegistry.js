const stateModules = import.meta.glob('./*/state.js', { eager: true });

export const getHazardStateSlices = () => Object.entries(stateModules)
  .map(([sourcePath, module]) => {
    const sliceFactory = module.default || module.createHazardSlice;
    if (typeof sliceFactory !== 'function') {
      throw new Error(`[Hazards] ${sourcePath} must export a default slice factory.`);
    }
    return sliceFactory;
  });
