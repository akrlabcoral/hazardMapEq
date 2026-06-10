import sys
import os
import json
from datetime import datetime, timezone

# Setup path so we can import from app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.historic_repository import save_historic_event
from app.ingest.normalizer import EarthquakeEvent
from app.models.repository import init_db, init_pool, close_pool

def import_geojson(filepath: str):
    print(f"Loading {filepath}...")
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"Found {len(features)} features.")
    
    init_pool()
    # Ensure historic_events table is created if it hasn't been yet
    init_db()

    count = 0
    for feat in features:
        props = feat.get('properties', {})
        geom = feat.get('geometry', {})
        
        # Skip if magnitude is missing or below 4.0
        mag = props.get('mag')
        if mag is None or mag < 4.0:
            continue
            
        coords = geom.get('coordinates', [0, 0, 0])
        lon = coords[0]
        lat = coords[1]
        depth = coords[2] if len(coords) > 2 else 0.0
        
        # USGS time is ms since epoch
        time_ms = props.get('time')
        if time_ms is None:
            continue
        origin_time = datetime.fromtimestamp(time_ms / 1000.0, tz=timezone.utc)
        
        source_id = feat.get('id') or props.get('code')
        if not source_id:
            continue

        event = EarthquakeEvent(
            source_id=str(source_id),
            source='USGS',
            fingerprint=f"hist:{source_id}", 
            latitude=float(lat),
            longitude=float(lon),
            depth_km=float(depth),
            magnitude=float(mag),
            mag_type=props.get('magType') or 'Mw',
            origin_time=origin_time,
            place=props.get('place') or 'Unknown',
            status=props.get('status') or 'reviewed',
            alert_level=props.get('alert')
        )
        
        save_historic_event(event)
        count += 1
        if count % 1000 == 0:
            print(f"Imported {count} historic events...")

    print(f"Successfully imported {count} historic events (>= 4.0).")
    close_pool()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python import_historic.py <geojson_path>")
        sys.exit(1)
    import_geojson(sys.argv[1])
