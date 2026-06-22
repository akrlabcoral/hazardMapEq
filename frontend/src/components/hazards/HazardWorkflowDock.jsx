import React from 'react';

import { getActiveWorkflowDock } from '../../hazards/registry';
import useStore from '../../store/useStore';

export default function HazardWorkflowDock({ onClose }) {
  const activeHazard = useStore((state) => state.activeHazard);
  const workflowDock = getActiveWorkflowDock(activeHazard, 'admin');

  if (!workflowDock?.Component) return null;

  const WorkflowDock = workflowDock.Component;
  return <WorkflowDock key={workflowDock.hazardId} onClose={onClose} />;
}
