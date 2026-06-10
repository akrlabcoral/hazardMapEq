<div align="center">

# 🌍 HazardMap

**Real-Time Earthquake Hazard Mapping & Simulation Engine**

*A full-stack, scientific-grade geospatial application designed to monitor, model, and visualize real-time seismic impacts across the Indian Subcontinent.*

![Python](https://img.shields.io/badge/backend-FastAPI%20%28Python%29-blue) ![React](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-cyan) ![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2016-blue) ![Docker](https://img.shields.io/badge/deployment-Docker%20Compose-2496ED) ![MapLibre](https://img.shields.io/badge/maps-MapLibre%20GL%20JS-purple)

</div>

---

## 📌 Overview

HazardMap is a rigorous real-time seismic hazard platform. It actively monitors global and regional earthquake data feeds (USGS and India's NCS), immediately applies Ground Motion Prediction Equations (GMPEs) optimized for specific tectonic regions, and pushes interactive Peak Ground Acceleration (PGA) heatmaps directly to connected browsers via WebSockets in a matter of seconds.

The system evaluates hazard over a nationwide 20-kilometer analysis grid, incorporating local `Vs30` soil data to apply realistic site-specific amplification factors.

---

## 🔬 Scientific Engine Features

- **Real-Time Automated Ingestion**: Continuous polling of the USGS and National Center for Seismology (NCS) feeds. Incoming events are spatially and temporally deduplicated.
- **Tectonic Region Detection**: The engine automatically classifies the epicenter into distinct tectonic zones (`Himalayan`, `Northeast India`, `Peninsular Shield`) and selects the appropriate empirical GMPE model.
- **High-Performance Vectorized Math**: Replaces slow Python loops with vectorized NumPy math to evaluate Ground Motion on 6,500+ grid cells instantly.
- **Soil Amplification (Vs30 Proxy)**: Directly samples a national GeoTIFF raster to extract local Vs30 values, assign NEHRP site classifications, and compute non-linear soil amplification factors on the fly.
- **Contour Polygon Generation**: Utilizes `scipy.interpolate.griddata` and `matplotlib` to convert scattered cell data into smoothed, USGS ShakeMap-compliant GeoJSON contour polygons.
- **WebSocket Broadcast**: Employs an ultra-fast asynchronous `orjson` WebSocket broadcaster to push live simulation results directly to all connected users.

## 🗺️ Frontend Capabilities

- **Interactive GIS Dashboard**: Built using React 19, MapLibre GL JS, and Zustand state management. Features dark/light themes and collapsible data panels.
- **Live Event Feeds**: View real-time incoming earthquakes. Earthquakes of Magnitude $\ge$ 6.0 trigger automatic red-alert banners across the UI.
- **Manual "What-If" Simulations**: Users can drop a pin anywhere on the map, set a custom magnitude and depth, and run an instant manual simulation.
- **Dynamic Layers & Data Export**: Toggle satellite/terrain overlays, regional boundaries, and the raw soil amplification overlay. Export simulation results to JSON, CSV, or GeoJSON directly from the browser.

---

## 🛠️ Architecture & Tech Stack

### `backend/` (FastAPI + Python 3.10+)
The core scientific computation and ingestion engine:
- **`ingest/`**: Async HTTP pollers for USGS and NCS with spatial-temporal deduplication.
- **`layers/pga/`**: Region definitions and GMPE mathematical equations.
- **`soil/`**: Rasterio-powered GeoTIFF caching and batch coordinate sampling for Vs30.
- **`jobs/`**: Background AsyncIO queue and blocking thread dispatch (for matplotlib).
- **`models/`**: Thread-safe `psycopg2` PostgreSQL connection pooling for persistence.

### `frontend/` (React 19 + Vite)
The real-time MapLibre GL presentation layer:
- **`hooks/`**: Custom hooks for WebSocket management (`useWebSocket`) and simulation data handling.
- **`store/`**: Centralized `useStore` (Zustand) for global Map and UI state.
- **`services/`**: Map layer toggling, raster injection, and GeoJSON polygon styling logic.

### Database
- **PostgreSQL 16**: Relational storage of all ingested events and computed simulations.

---

## 🚀 Getting Started

The entire application is fully dockerized for single-command orchestration.

### Prerequisites
- Docker & Docker Compose installed.

### Quick Start

1. Clone the repository and navigate to the project root:
   ```bash
   cd hazardmap-realtime
   ```
2. Build and start the cluster:
   ```bash
   docker compose up --build
   ```
3. Access the Application:
   - **Frontend UI**: `http://localhost:5173`
   - **Backend API Docs**: `http://localhost:8000/docs`

> **Note**: The backend initializes a one-time connection to the PostgreSQL database and loads the 6,500-cell GeoJSON grid into memory at startup. The first initialization may take a few seconds.

### Runtime Configuration

The Docker Compose defaults are development-friendly. For staging or production, set these backend environment variables explicitly:

- `CORS_ALLOWED_ORIGINS`: comma-separated browser origins allowed to call the API, for example `https://hazardmap.example.com`.
- `DATABASE_URL`: PostgreSQL connection URL.
- `VS30_RASTER_PATH`: path to the national Vs30 GeoTIFF inside the backend container.
- `GRID_PATH`: path to the analysis grid GeoJSON.
- `USGS_POLL_INTERVAL_SECONDS` and `NCS_POLL_INTERVAL_SECONDS`: feed polling cadence.
- `AUTO_SIM_MIN_MAGNITUDE` and `AUTO_SIM_MAX_DEPTH_KM`: automatic simulation thresholds.

Frontend debug audit logs are disabled by default. Set `VITE_DEBUG_LOGS=true` when running Vite if you need detailed map, WebSocket, or raster diagnostics in the browser console.

---

## 🏗️ Future Roadmap
- Integration of finite fault models (rupture geometry) rather than point-source hypocenters for M > 7.0 events.
- Advanced PostGIS integration for dynamic routing of emergency evacuation vehicles around high-PGA zones.
- Support for structural building typologies to compute precise localized damage fragility curves rather than generic intensity indicators.
