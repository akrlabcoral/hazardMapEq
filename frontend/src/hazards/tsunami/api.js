export const calculateTsunamiHazard = async (payload) => {
  const response = await fetch('/scientific-api/hazards/tsunami/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(', ')
      : detail || 'Tsunami calculation failed';
    throw new Error(message);
  }
  return data;
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(', ')
      : detail || 'Tsunami request failed';
    throw new Error(message);
  }
  return data;
};

export const startTsunamiAnalysis = (payload) => requestJson('/scientific-api/hazards/tsunami/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const getTsunamiAnalysisResult = (requestId) => (
  requestJson(`/scientific-api/hazards/tsunami/result/${encodeURIComponent(requestId)}`)
);

export const getTsunamiAnalysisLayers = (requestId) => (
  requestJson(`/scientific-api/hazards/tsunami/layers/${encodeURIComponent(requestId)}`)
);
