from abc import ABC, abstractmethod
import numpy as np

class BaseHazardLayer(ABC):
    """
    Abstract base class enforcing independent computation and normalization 
    for all HazardMap computational layers.
    """
    
    @abstractmethod
    def compute(self, grid_features, **kwargs):
        """
        Computes the raw hazard value for each feature in the grid.
        Returns a list/array of raw values aligned with grid_features.
        """
        pass
        
    def normalize(self, raw_values):
        """
        Normalizes the raw values to a scale of 0.0 to 1.0 independently.
        Uses min-max scaling, safely handling zero-variance arrays.
        """
        arr = np.array(raw_values, dtype=float)
        if arr.size == 0:
            return []
        min_val, max_val = np.min(arr), np.max(arr)
        
        if max_val - min_val == 0:
            return [0.0 for _ in raw_values]
            
        normalized = (arr - min_val) / (max_val - min_val)
        return np.clip(normalized, 0.0, 1.0).tolist()
