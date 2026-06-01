import numpy as np
from scipy.ndimage import gaussian_filter

# 400x400 grid
grid_z = np.zeros((400, 400))
# Create a rough octagonal peak
for i in range(400):
    for j in range(400):
        dist = max(abs(i-200), abs(j-200)) # L_infinity norm creates a square/octagon
        grid_z[i, j] = 5.817 * np.exp(-dist/10.0)

print("Max before blur:", np.max(grid_z))
grid_z_blur = gaussian_filter(grid_z, sigma=3.0)
new_max = np.max(grid_z_blur)
print("Max after blur:", new_max)
grid_z_blur_scaled = grid_z_blur * (np.max(grid_z) / new_max)
print("Max after scaling:", np.max(grid_z_blur_scaled))
