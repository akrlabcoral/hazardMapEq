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
    CustomOverrideGMPE
)

class GMPESelector:
    """
    Factory for selecting the appropriate GMPE model for an earthquake.
    """
    @staticmethod
    def select(lat: float, lon: float, custom_params: dict | None = None) -> tuple[BaseGMPE, TectonicRegion]:
        """
        Returns an instantiated GMPE object and the tectonic region enum.
        If custom_params are provided (e.g. via manual API override), it uses them
        instead of the region-specific parameters.
        """
        region = get_tectonic_region(lat, lon)
        
        # Backward compatibility for custom API overrides
        if custom_params is not None:
            # We still return the detected region for diagnostic logging
            return CustomOverrideGMPE(custom_params), region
            
        if region == TectonicRegion.HIMALAYA:
            gmpe = HimalayanGMPE()
        elif region == TectonicRegion.NORTHEAST:
            gmpe = NortheastGMPE()
        else:
            gmpe = PeninsularGMPE()
            
        return gmpe, region
