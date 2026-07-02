const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Evacuation request failed');
  }
  return data;
};

export const createEvacuationPlan = (payload) => requestJson('/scientific-api/evacuation/plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const findNearestHospitalRoute = (payload) => requestJson('/scientific-api/evacuation/nearest-hospital', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
