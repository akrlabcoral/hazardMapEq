const hazardModules = import.meta.glob('./*/index.js', { eager: true });

const REQUIRED_FIELDS = [
  'id',
  'label',
  'icon',
  'defaultSection',
  'layerMetadata',
  'layerAdapter',
  'legendItems',
  'panels',
  'mapSources',
  'state',
];

const REQUIRED_LAYER_ADAPTER_METHODS = [
  'registerLayers',
  'syncLayers',
  'setVisibility',
  'bringToFront',
  'getVisibleLayers',
  'getLayerMetadata',
];

const validateHazard = (hazard, sourcePath) => {
  if (!hazard || typeof hazard !== 'object') {
    throw new Error(`[Hazards] ${sourcePath} must export a default hazard definition.`);
  }

  REQUIRED_FIELDS.forEach((field) => {
    if (hazard[field] === undefined || hazard[field] === null) {
      throw new Error(`[Hazards] ${hazard.id || sourcePath} is missing required field "${field}".`);
    }
  });

  if (!Array.isArray(hazard.panels)) {
    throw new Error(`[Hazards] ${hazard.id} panels must be an array.`);
  }

  if (!Array.isArray(hazard.legendItems)) {
    throw new Error(`[Hazards] ${hazard.id} legendItems must be an array.`);
  }

  if (hazard.workflowDock && typeof hazard.workflowDock.Component !== 'function') {
    throw new Error(`[Hazards] ${hazard.id} workflowDock must provide a Component.`);
  }

  REQUIRED_LAYER_ADAPTER_METHODS.forEach((method) => {
    if (typeof hazard.layerAdapter?.[method] !== 'function') {
      throw new Error(`[Hazards] ${hazard.id} layerAdapter must provide ${method}().`);
    }
  });

  return hazard;
};

const discoveredHazards = Object.entries(hazardModules)
  .map(([sourcePath, module]) => validateHazard(module.default, sourcePath))
  .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.label.localeCompare(b.label));

const hazardMap = new Map();
discoveredHazards.forEach((hazard) => {
  if (hazardMap.has(hazard.id)) {
    throw new Error(`[Hazards] Duplicate hazard id "${hazard.id}".`);
  }
  hazardMap.set(hazard.id, hazard);
});

export const getHazards = () => discoveredHazards;

export const getHazard = (id) => hazardMap.get(id) || null;

export const getDefaultSection = (hazardId, mode = 'public') => (
  getHazard(hazardId)?.defaultSection?.[mode] ?? null
);

export const getActiveHazard = (state) => getHazard(state?.activeHazard) || discoveredHazards[0] || null;

export const getVisibleHazardPanels = (hazardId, mode = 'public') => {
  const hazard = getHazard(hazardId);
  if (!hazard) return [];
  const workflowPanels = hazard.workflowDock && (!hazard.workflowDock.modes || hazard.workflowDock.modes.includes(mode))
    ? [hazard.workflowDock]
    : [];
  return [
    ...workflowPanels,
    ...hazard.panels.filter((panel) => !panel.modes || panel.modes.includes(mode)),
  ];
};

export const getHazardPanelIds = (hazardId, mode) => (
  getVisibleHazardPanels(hazardId, mode).map((panel) => panel.id)
);

export const getHazardPanel = (hazardId, panelId, mode) => {
  const hazard = getHazard(hazardId);
  if (!hazard) return null;
  const panels = mode ? getVisibleHazardPanels(hazardId, mode) : getVisibleHazardPanels(hazardId);
  const panel = panels.find((item) => item.id === panelId);
  return panel ? { ...panel, hazardId: hazard.id } : null;
};

export const findHazardPanel = (predicate, mode) => {
  for (const hazard of discoveredHazards) {
    const panels = mode ? getVisibleHazardPanels(hazard.id, mode) : hazard.panels;
    const panel = panels.find((item) => predicate(item, hazard));
    if (panel) return { panel, hazard };
  }
  return null;
};

export const getPanelTargetByComponent = (component, mode) => {
  const match = findHazardPanel((panel) => panel.component === component, mode);
  if (!match) return null;
  return {
    hazardId: match.hazard.id,
    sectionId: match.panel.id,
  };
};

export const getBottomDockPanelIds = (mode = 'admin') => new Set(
  discoveredHazards
    .filter((hazard) => hazard.workflowDock && (!hazard.workflowDock.modes || hazard.workflowDock.modes.includes(mode)))
    .map((hazard) => hazard.workflowDock.id)
);

export const getActiveWorkflowDock = (hazardId, mode = 'admin') => {
  const hazard = getHazard(hazardId);
  if (!hazard?.workflowDock) return null;
  if (hazard.workflowDock.modes && !hazard.workflowDock.modes.includes(mode)) return null;
  return { ...hazard.workflowDock, hazardId: hazard.id };
};

export const getHazardLegendItems = () => discoveredHazards.flatMap((hazard) => hazard.legendItems);

export const getHazardInspectionProviders = () => discoveredHazards
  .map((hazard) => hazard.inspectionProvider)
  .filter(Boolean);

export const getLayerAdapters = () => discoveredHazards.map((hazard) => hazard.layerAdapter);

export const getActiveLayerAdapter = (hazardId) => getHazard(hazardId)?.layerAdapter ?? null;

export const getHazardLayerMetadata = () => discoveredHazards.reduce((metadata, hazard) => ({
  ...metadata,
  [hazard.id]: hazard.layerAdapter.getLayerMetadata(),
}), {});
