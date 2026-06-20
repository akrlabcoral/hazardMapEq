"""
app/layers/pga/gmpe.py

Modular GMPE Framework.
Allows easy plugging of new empirical equations per region.
"""
from abc import ABC, abstractmethod
import numpy as np

__all__ = [
    "BaseGMPE",
    "GenericLogPolynomialGMPE",
    "HimalayanGMPE",
    "NortheastGMPE",
    "PeninsularGMPE",
]


class BaseGMPE(ABC):
    """
    Interface for all GMPE models.
    """
    @abstractmethod
    def calculate_pga(self, magnitude: float, R: np.ndarray, depth_km: float) -> np.ndarray:
        """
        Calculates base PGA given earthquake properties and an array of distances.
        
        Args:
            magnitude: Earthquake magnitude (Mw)
            R: Hypocentral distance array (km)
            depth_km: Earthquake depth (km)
            
        Returns:
            np.ndarray of PGA values in g.
        """
        pass


class GenericLogPolynomialGMPE(BaseGMPE):
    """
    Standard logarithmic polynomial GMPE used by HazardMap v1.
    ln(PGA) = c1 + c2*(M - 6) + c3*(M - 6)^2 + c4*R - C*ln(R)
    """
    def __init__(self, c1: float, c2: float, c3: float, c4: float, C: float):
        self.c1 = c1
        self.c2 = c2
        self.c3 = c3
        self.c4 = c4
        self.C  = C

    def calculate_pga(self, magnitude: float, R: np.ndarray, depth_km: float) -> np.ndarray:
        m_adj = magnitude - 6.0
        ln_pga = self.c1 + self.c2 * m_adj + self.c3 * (m_adj ** 2) + self.c4 * R - self.C * np.log(R)
        return np.exp(ln_pga)


# -------------------------------------------------------------------
# Region-Specific Models
# -------------------------------------------------------------------

class HimalayanGMPE(GenericLogPolynomialGMPE):
    """
    Tuned for the Himalayan active continental collision zone.
    High near-source shaking, standard attenuation.
    """
    def __init__(self):
        # Example tuned parameters
        super().__init__(c1=1.40, c2=0.5, c3=0.0, c4=-0.004, C=1.0)


class NortheastGMPE(GenericLogPolynomialGMPE):
    """
    Tuned for the Northeast India subduction/collision zone.
    Extremely high near-source shaking, faster attenuation.
    """
    def __init__(self):
        # Example tuned parameters
        super().__init__(c1=1.45, c2=0.55, c3=0.0, c4=-0.0045, C=1.0)


class PeninsularGMPE(GenericLogPolynomialGMPE):
    """
    Tuned for the stable continental region of Peninsular India.
    Lower near-source shaking, but slower attenuation (travels further).
    """
    def __init__(self):
        # Example tuned parameters
        super().__init__(c1=1.30, c2=0.45, c3=0.0, c4=-0.003, C=0.95)

