"""
app/fusion/engine.py

Vectorized FusionEngine — blends independent normalized layers into a
final risk score using numpy matrix operations (dot product).
"""
import numpy as np


class FusionEngine:
    """
    Blends independent normalized layers into a final risk score using
    dynamic weights.  All arithmetic is vectorized via numpy.
    """

    def __init__(self, weights: dict[str, float]):
        """
        Args:
            weights: mapping of layer names to their weight,
                     e.g. {'pga': 0.7, 'soil': 0.3}
        """
        self.weights = weights
        self.total_weight = sum(weights.values()) or 1.0

    def merge(self, layer_outputs: dict[str, np.ndarray]) -> np.ndarray:
        """
        Blend layers into a single hazard score per grid cell.

        Args:
            layer_outputs: mapping of layer name → 1-D array of normalized
                           values in [0.0, 1.0], all the same length.

        Returns:
            1-D numpy array of fused hazard scores in [0.0, 1.0].
        """
        if not layer_outputs:
            return np.array([])

        names = list(layer_outputs.keys())
        grid_len = len(next(iter(layer_outputs.values())))

        # Stack layers into (num_layers × num_cells) matrix
        matrix = np.vstack([
            np.asarray(layer_outputs[n], dtype=np.float64)
            for n in names
        ])  # shape: (L, N)

        # Weight vector aligned with matrix rows
        w = np.array([self.weights.get(n, 0.0) for n in names], dtype=np.float64)

        # Weighted sum via dot product, then normalise
        fused = w @ matrix  # shape: (N,)
        return np.clip(fused / self.total_weight, 0.0, 1.0)
