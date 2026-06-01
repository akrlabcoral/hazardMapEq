const fs = require('fs');

console.log("Loading files...");
const states = JSON.parse(fs.readFileSync('frontend/public/data/india_states.geojson', 'utf8'));
const grid = JSON.parse(fs.readFileSync('backend/data/grids/nationwide_20km.geojson', 'utf8'));

console.log("Injecting IDs into states...");
states.features.forEach((f, i) => {
    f.id = i + 1;
    if (!f.properties) f.properties = {};
    f.properties.id = i + 1;
});
fs.writeFileSync('frontend/public/data/india_states.geojson', JSON.stringify(states));

function pointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getFeatureState(lon, lat) {
    for (const stateFeature of states.features) {
        if (stateFeature.geometry.type === 'Polygon') {
            if (pointInPolygon([lon, lat], stateFeature.geometry.coordinates[0])) {
                return stateFeature.properties.state || stateFeature.properties.STATE;
            }
        } else if (stateFeature.geometry.type === 'MultiPolygon') {
            for (const poly of stateFeature.geometry.coordinates) {
                if (pointInPolygon([lon, lat], poly[0])) {
                    return stateFeature.properties.state || stateFeature.properties.STATE;
                }
            }
        }
    }
    return 'Unknown';
}

console.log("Mapping grid cells to states (this might take a few seconds)...");
let count = 0;
for (const cell of grid.features) {
    const lon = cell.properties.centroid_lon;
    const lat = cell.properties.centroid_lat;
    cell.properties.state = getFeatureState(lon, lat);
    count++;
    if (count % 1000 === 0) console.log(`Processed ${count} / ${grid.features.length}`);
}

fs.writeFileSync('backend/data/grids/nationwide_20km.geojson', JSON.stringify(grid));
console.log("Done.");
