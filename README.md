<div align="center">

# 🌍 HazardMap

**Scientific Earthquake Hazard Simulation & Visualization Platform**

*A full-stack geospatial application designed to model, simulate, and visualize seismic impacts, specifically engineered for West Bengal, India.*

![Python](https://img.shields.io/badge/backend-FastAPI%20%28Python%29-blue) ![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-cyan) ![GeoPandas](https://img.shields.io/badge/GIS-GeoPandas%20%2B%20Shapely-green) ![MapLibre](https://img.shields.io/badge/maps-MapLibre%20GL%20JS-purple)

</div>

---

## Overview

HazardMap has evolved into a rigorous scientific simulation tool. It uses a **FastAPI (Python)** backend to run mathematical Ground Motion Prediction Equations (GMPEs) and a **React/Vite** frontend to visualize the resulting Peak Ground Acceleration (PGA) heatmaps using MapLibre GL JS. 

The current implementation focuses on simulating earthquakes affecting **West Bengal**, calculating impacts across a 5x5 km spatial grid, dynamically adjusting for local soil types, and estimating district-level damage.

---

## 🔬 Scientific Engine Features

- **Multiple GMPE Attenuation Models**: Choose between distinct regional attenuation behaviors:
  - `Indian Shield`: Balanced attenuation for peninsular India (Default).
  - `Himalayan Region`: Strong near-source shaking with rapid attenuation for complex tectonic boundaries.
  - `Stable Continental`: Slower attenuation typical of cratonic shields.
- **Magnitude & Depth Scaling**: The engine rigorously scales shaking intensity based on earthquake magnitude (Mw) and hypocentral depth ($R = \sqrt{D_{epi}^2 + depth^2}$).
- **Soil Amplification (Vs30 Proxy)**: The spatial grid intersects with geological raster data to apply precise amplification factors (e.g., Soft Sediment 2.0x, Rock 0.8x) to the base PGA.
- **Damage Classification**: Translates PGA values (`g`) into structural damage categories (Negligible, Light, Moderate, Strong, Severe).
- **Automated District Summaries**: Automatically aggregates severe cell counts and average PGA values per district for rapid response planning.

## 🗺️ Frontend Capabilities

- **Interactive Cinematic Map**: A highly polished, glassmorphism-styled command center interface.
- **Dynamic Scientific Visualization**: Instantly toggle the heatmap rendering between **Raw Base PGA** and **Soil Amplified PGA**.
- **Vector & Raster Layers**: Superimpose critical infrastructure (hospitals, shelters, roads) and environmental rasters (precipitation, elevation) on top of the simulation.
- **Data Export**: Export simulation results directly to CSV or JSON formats.

---

## 🛠️ Architecture & Tech Stack

### `backend/` (FastAPI + Python)
The scientific engine is strictly separated into modular domains:
- **`api/`**: Pydantic validated REST endpoints.
- **`seismic/`**: GMPE mathematical formulas and distance calculations.
- **`soil/`**: Amplification factors and soil-type mapping.
- **`damage/`**: Fragility curves and impact classification.
- **`gis/`**: GeoPandas dataframes, spatial joins, raster sampling, and bounding boxes.

**Running the Backend:**
```bash
cd backend
python -m uvicorn app.main:app --reload
```
*(Runs on `http://localhost:8000`)*

### `frontend/` (React + Vite + TailwindCSS)
The presentation layer handling pure rendering and user state.
- **`store/`**: Zustand for global state management.
- **`components/`**: Modular MapLibre panels, cinematic legends, and scientific toggles.

**Running the Frontend:**
```bash
cd frontend
npm install
npm run dev
```
*(Runs on `http://localhost:5173`)*

---

## 🚀 Future Roadmap
- Integration with live USGS and IMD (India Meteorological Department) GeoJSON earthquake feeds.
- Integration of PostGIS for advanced network routing (evacuation paths) around severe damage zones.
- Support for detailed fragility curves based on building typologies (e.g., unreinforced masonry vs RC frames).
