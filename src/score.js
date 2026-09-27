// Glow score: a 0-100 heuristic for how likely clouds light up at sunrise/sunset.

const WEIGHTS = {
  canvas: 0.45,   // mid/high cloud to catch the light
  horizon: 0.30,  // clear low sky toward the sun so light can get through
  visibility: 0.15,
  humidity: 0.10,
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));

function combinedCover(mid, high) {
  return 100 * (1 - (1 - mid / 100) * (1 - high / 100));
}

// Mid/high cloud: ideal between 30% and 70%, falling off linearly to 0 at 0% and 100%.
function canvasScore(cover) {
  if (cover < 30) return cover / 30;
  if (cover > 70) return (100 - cover) / 30;
  return 1;
}

// Low cloud: less is better, weighted mostly toward the horizon in the sun's direction.
function horizonScore(localLow, horizonLow) {
  const low = 0.7 * horizonLow + 0.3 * localLow;
  return clamp01(1 - low / 80);
}

// Visibility in metres: poor below 5 km, full marks from 20 km.
function visibilityScore(metres) {
  return clamp01((metres - 5000) / 15000);
}

// Relative humidity: full marks at 50% or below, zero at 100%.
function humidityScore(rh) {
  return clamp01((100 - rh) / 50);
}

export function glowScore(local, horizon) {
  const cover = combinedCover(local.mid, local.high);
  const parts = {
    canvas: canvasScore(cover),
    horizon: horizonScore(local.low, horizon.low),
    visibility: visibilityScore(local.visibility),
    humidity: humidityScore(local.humidity),
  };
  let score = Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + w * parts[k], 0);

  // Without a canvas there's nothing to glow, and a blocked horizon stops the light
  // reaching it — either one caps the score no matter how good the rest is.
  score *= (0.4 + 0.6 * parts.canvas) * (0.4 + 0.6 * parts.horizon);

  return { score: Math.round(score * 100), parts, cover };
}

export function rating(score) {
  if (score >= 70) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 30) return 'Fair';
  return 'Poor';
}

export function describe({ score, parts, cover }) {
  if (parts.horizon < 0.35) {
    return 'Thick low cloud on the horizon is likely to block the light.';
  }
  if (parts.canvas < 0.3 && cover < 30) {
    return 'Skies are too clear — pretty colours, but little cloud to light up.';
  }
  if (parts.canvas < 0.3) {
    return 'Cloud cover is too thick — the light may struggle to get underneath.';
  }
  if (score >= 70) return 'Cloud conditions look great — well worth heading out.';
  if (score >= 50) return 'Cloud conditions look good, worth watching.';
  if (score >= 30) return 'Some chance of colour, but don’t count on it.';
  return 'Unlikely to be a memorable one.';
}
