import os
import pickle
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor

MODEL_PATH = os.path.join(os.path.dirname(__file__), '../../models/earthquake_model.pkl')

feature_cols = [
    "source_lon",
    "source_lat",
    "source_magnitude",
    "source_depth",
    "distance from source",
    "hypocentral_distance",
    "log_distance",
    "log_hypocentral_distance",
    "inverse_hypocentral_distance",
    "magnitude_minus_logR",
    "mag_by_inverse_R"
]

class EarthquakeModel:
    def __init__(self):
        self.model = None
        self.load_model()
        
    def load_model(self):
        if os.path.exists(MODEL_PATH):
            with open(MODEL_PATH, 'rb') as f:
                self.model = pickle.load(f)
        else:
            print(f"Warning: Model not found at {MODEL_PATH}. Attempting to train synthetic model.")
            self.train_synthetic_model()
            
    def train_synthetic_model(self):
        """
        Trains a quick synthetic model using physics formulas if the real .pkl is missing.
        """
        from app.preprocessing.features import add_physics_features
        
        print("Generating synthetic data...")
        # Generate some synthetic distances and magnitudes
        distances = np.random.uniform(0, 1000, 10000)
        depths = np.random.uniform(5, 50, 10000)
        mags = np.random.uniform(4.0, 9.0, 10000)
        
        df = pd.DataFrame({
            "source_lon": 77.0,
            "source_lat": 28.0,
            "distance from source": distances,
            "source_depth": depths,
            "source_magnitude": mags
        })
        
        df = add_physics_features(df)
        
        # Synthetic label generation: higher magnitude + closer = higher effect
        base_effect = mags * 1.5 - np.log1p(distances) * 0.8
        effect = np.clip(base_effect, 1.0, 10.0)
        
        X = df[feature_cols].astype(float)
        y = effect
        
        monotone_constraints = [0, 0, 1, -1, -1, -1, -1, -1, 1, 1, 1]
        
        model = LGBMRegressor(
            n_estimators=100,
            learning_rate=0.1,
            random_state=42,
            monotone_constraints=monotone_constraints
        )
        
        print("Training LightGBM on synthetic data...")
        model.fit(X, y)
        
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, 'wb') as f:
            pickle.dump(model, f)
            
        self.model = model
        print("Synthetic model trained and saved.")

    def predict(self, df: pd.DataFrame, force_epicenter_to_max=True) -> pd.DataFrame:
        if self.model is None:
            raise ValueError("Model is not loaded.")
            
        X = df[feature_cols].astype(float)
        df["predicted_effect"] = self.model.predict(X)
        
        if force_epicenter_to_max:
            max_effect = df["predicted_effect"].max()
            df.loc[df["distance from source"] == 0, "predicted_effect"] = max_effect
            
        # Normalize the predicted effect to 0-1 for a base intensity
        min_effect = df["predicted_effect"].min()
        max_effect = df["predicted_effect"].max()
        
        if max_effect == min_effect:
            base_intensity = 1.0
        else:
            base_intensity = (df["predicted_effect"] - min_effect) / (max_effect - min_effect)
            
        # Apply Gaussian attenuation based on distance to enforce realistic gradient
        max_dist = df["distance from source"].max()
        if max_dist > 0:
            # Set sigma so that intensity decays smoothly across the radius
            # This configures ~0-20% as red (>0.85), 20-40% as orange, down to blue at edges
            sigma = max_dist * 0.35  
            df["intensity_normalized"] = base_intensity * np.exp(-(df["distance from source"]**2) / (2 * sigma**2))
        else:
            df["intensity_normalized"] = base_intensity
            
        return df

model_instance = EarthquakeModel()
