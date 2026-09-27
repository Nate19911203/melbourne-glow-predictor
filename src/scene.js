// Horizon scene: sky gradient, clouds from the forecast, the sun at its real bearing, and a skyline.
// Colours come from CSS variables set by palette.js, so they animate when the palette changes.

const H = 500;          // viewBox height; width follows the element's aspect ratio
const HORIZON = 400;    // y of the horizon line
const SUN_Y = HORIZON - 12; // sits just above the rooftops so it stays readable
const HALF_VIEW = 50;   // degrees of compass visible either side of centre

const COMPASS = {
  90: [[45, 'NE'], [90, 'E'], [135, 'SE']],
  270: [[225, 'SW'], [270, 'W'], [315, 'NW']],
};

// Cloud streaks as [centre x (fraction of width), y, width (fraction), half-height].
// More of them appear as mid/high cloud cover rises.
const STREAKS = [
  [0.62, 130, 0.36, 12], [0.22, 175, 0.30, 10], [0.45, 225, 0.42, 14], [0.84, 250, 0.30, 11],
  [0.12, 280, 0.34, 12], [0.55, 310, 0.40, 10], [0.32, 100, 0.26, 8],
];

// Relative to the cluster centre: [dx, width, height]. Roughly a CBD skyline.
const TOWERS = [
  [-130, 26, 50], [-100, 22, 78], [-74, 30, 118], [-40, 22, 92], [-14, 34, 148],
  [24, 24, 108], [52, 28, 178], [84, 20, 88], [106, 30, 66], [140, 22, 44],
];

// Converts SunCalc's azimuth (radians from south, positive westward) to a compass bearing.
export function sunBearing(time, lat, lon) {
  const { azimuth } = SunCalc.getPosition(time, lat, lon);
  return ((azimuth * 180) / Math.PI + 180 + 360) % 360;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function skyline(W, sunX) {
  const rects = [];
  const rand = mulberry32(7);
  for (let x = 0; x < W; ) {
    const w = 18 + rand() * 26;
    const h = 6 + rand() * 14;
    rects.push([x, w, h]);
    x += w - 1;
  }
  // Keep the towers on the opposite side from the sun so they never hide it.
  const cx = sunX > W / 2 ? W * 0.26 : W * 0.74;
  const s = Math.min(1, Math.max(0.55, W / 1000));
  for (const [dx, w, h] of TOWERS) rects.push([cx + dx * s, w * s, h * s]);

  const spire = TOWERS.reduce((a, b) => (b[2] > a[2] ? b : a));
  const sx = cx + (spire[0] + spire[1] / 2) * s;
  const sy = HORIZON - spire[2] * s;

  return rects.map(([x, w, h]) => `<rect x="${x.toFixed(1)}" y="${(HORIZON - h).toFixed(1)}" width="${w.toFixed(1)}" height="${(h + 1).toFixed(1)}"/>`).join('')
    + `<path d="M${sx - 3} ${sy} L${sx} ${sy - 38 * s} L${sx + 3} ${sy} Z"/>`;
}

export function drawScene(svg, { width, height, bearing, facing, cover, lowCloud }) {
  const W = Math.max(300, Math.round((H * width) / Math.max(1, height)));
  const sunX = W / 2 + ((bearing - facing) / HALF_VIEW) * (W / 2);

  const streakCount = cover <= 0 ? 0 : Math.min(STREAKS.length, Math.ceil((cover / 100) * STREAKS.length));
  const clouds = STREAKS.slice(0, streakCount)
    .map(([fx, y, fw, ry]) => `<ellipse cx="${(fx * W).toFixed(1)}" cy="${y}" rx="${((fw * W) / 2).toFixed(1)}" ry="${ry}"/>`)
    .join('');
  const veil = cover > 60 ? ((cover - 60) / 40) * 0.55 : 0;
  const lowBand = Math.min(1, lowCloud / 70);

  const compass = COMPASS[facing].map(([b, label]) => {
    const x = W / 2 + ((b - facing) / HALF_VIEW) * (W / 2);
    return `<line x1="${x}" x2="${x}" y1="${HORIZON + 14}" y2="${HORIZON + 22}"/><text x="${x}" y="${HORIZON + 42}">${label}</text>`;
  }).join('');

  // Gradient ids are document-wide, so namespace them per SVG.
  const id = (name) => `${svg.id || 'scene'}-${name}`;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="${id('sky')}" x1="0" y1="0" x2="0" y2="${HORIZON}" gradientUnits="userSpaceOnUse">
        <stop offset="0" style="stop-color: var(--sky-top)"/>
        <stop offset="0.55" style="stop-color: var(--sky-mid)"/>
        <stop offset="1" style="stop-color: var(--sky-horizon)"/>
      </linearGradient>
      <radialGradient id="${id('glow')}" cx="${sunX}" cy="${HORIZON}" r="${W * 0.55}" gradientUnits="userSpaceOnUse">
        <stop offset="0" style="stop-color: var(--sky-horizon)"/>
        <stop offset="1" style="stop-color: var(--sky-horizon); stop-opacity: 0"/>
      </radialGradient>
      <linearGradient id="${id('cloud')}" x1="0" y1="80" x2="0" y2="320" gradientUnits="userSpaceOnUse">
        <stop offset="0" style="stop-color: var(--sky-mid)"/>
        <stop offset="1" style="stop-color: var(--sky-horizon)"/>
      </linearGradient>
      <linearGradient id="${id('low')}" x1="0" y1="${HORIZON - 60}" x2="0" y2="${HORIZON}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#2c2d42" stop-opacity="0"/>
        <stop offset="1" stop-color="#2c2d42"/>
      </linearGradient>
      <filter id="${id('soft')}" x="-20%" y="-200%" width="140%" height="500%">
        <feGaussianBlur stdDeviation="7"/>
      </filter>
      <radialGradient id="${id('halo')}">
        <stop offset="0" style="stop-color: var(--sun)"/>
        <stop offset="1" style="stop-color: var(--sun); stop-opacity: 0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${HORIZON}" fill="url(#${id('sky')})"/>
    <rect width="${W}" height="${HORIZON}" fill="url(#${id('glow')})" class="glow"/>
    <g fill="url(#${id('cloud')})" opacity="0.9" filter="url(#${id('soft')})">${clouds}</g>
    <rect width="${W}" height="${HORIZON}" fill="url(#${id('cloud')})" opacity="${veil.toFixed(2)}"/>
    <circle cx="${sunX}" cy="${SUN_Y}" r="150" fill="url(#${id('halo')})" class="glow"/>
    <circle cx="${sunX}" cy="${SUN_Y}" r="40" style="fill: var(--sun)"/>
    <rect y="${HORIZON - 60}" width="${W}" height="60" fill="url(#${id('low')})" opacity="${lowBand.toFixed(2)}"/>
    <g style="fill: var(--land)">
      ${skyline(W, sunX)}
      <rect y="${HORIZON}" width="${W}" height="${H - HORIZON}"/>
    </g>
    <g class="compass">${compass}</g>`;
}
