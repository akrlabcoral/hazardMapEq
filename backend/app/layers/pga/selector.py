"""
app/layers/pga/selector.py

Selects the correct GMPE model for a given earthquake based on its epicenter.
"""
from app.layers.pga.regions import get_tectonic_region, TectonicRegion
from app.layers.pga.gmpe import (
    BaseGMPE,
    HimalayanGMPE,
    NortheastGMPE,
    PeninsularGMPE,
)

class GMPESelector:
    """
    Factory for selecting the appropriate GMPE model for an earthquake.
    """
    @staticmethod
    def select(lat: float, lon: float) -> tuple[BaseGMPE, TectonicRegion]:
        """
        Returns an instantiated GMPE object and the tectonic region enum.
        """
        region = get_tectonic_region(lat, lon)

        if region == TectonicRegion.HIMALAYA:
            gmpe = HimalayanGMPE()
        elif region == TectonicRegion.NORTHEAST:
            gmpe = NortheastGMPE()
        else:
            gmpe = PeninsularGMPE()
            
        return gmpe, region
