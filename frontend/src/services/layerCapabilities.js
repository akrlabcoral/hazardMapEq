export const HAZARD_LAYERS = [
  { 
    id: 'pga', 
    label: 'Peak Ground Accel. (PGA)', 
    available: true, 
    placeholder: false,
    defaultWeight: 1.0
  },
  { 
    id: 'soil', 
    label: 'Soil Amplification', 
    available: false, 
    placeholder: true,
    defaultWeight: 0.5
  },
  { 
    id: 'lithology', 
    label: 'Lithology Response', 
    available: false, 
    placeholder: true,
    defaultWeight: 0.3
  },
  { 
    id: 'liquefaction', 
    label: 'Liquefaction Susceptibility', 
    available: false, 
    placeholder: true,
    defaultWeight: 0.4
  },
  { 
    id: 'population', 
    label: 'Population Exposure', 
    available: false, 
    placeholder: true,
    defaultWeight: 0.8
  },
  { 
    id: 'infrastructure', 
    label: 'Infrastructure Vulnerability', 
    available: false, 
    placeholder: true,
    defaultWeight: 0.7
  }
];
