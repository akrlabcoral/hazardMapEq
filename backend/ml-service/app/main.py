from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd

from app.prediction.grid import generate_prediction_grid
from app.model.inference import model_instance

app = FastAPI(title="HazardMap ML Earthquake Service")

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EarthquakeRequest(BaseModel):
    lat: float
    lng: float
    magnitude: float
    depth: float
    radius_km: float

@app.post("/simulate-earthquake")
def simulate_earthquake(req: EarthquakeRequest):
    # 1. Generate Vectorized Prediction Grid & Compute Physics Features
    grid_df = generate_prediction_grid(
        source_lat=req.lat,
        source_lon=req.lng,
        magnitude=req.magnitude,
        depth=req.depth,
        max_radius_km=req.radius_km,
        grid_step_km=2.0
    )
    
    # 2. Run LightGBM Inference & Normalize for MapLibre
    result_df = model_instance.predict(grid_df)
    
    # 3. Format as clean JSON array (FastAPI will handle JSON serialization)
    # Return lat, lng, and normalized intensity for the heatmap rendering
    output_df = result_df[["point_lat", "point_lon", "intensity_normalized"]].copy()
    output_df = output_df.rename(columns={
        "point_lat": "lat",
        "point_lon": "lng",
        "intensity_normalized": "intensity"
    })
    
    # Optional: we can filter out very low intensity points to save bandwidth
    output_df = output_df[output_df["intensity"] > 0.05]
    
    return {
        "heatmap": output_df.to_dict(orient="records")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
