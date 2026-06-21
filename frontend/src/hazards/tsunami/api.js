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

