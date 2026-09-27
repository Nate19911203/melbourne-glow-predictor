// Sky palette driven by the glow score: pale, cool blue-violet when glow is unlikely,
// deep indigo → rose gold → coral red when conditions look like burning clouds.

const STOPS = [
  { at: 0,   top: '#1d2442', mid: '#4f5d8a', horizon: '#aab5d8', sun: '#eef1f8' },
  { at: 50,  top: '#1f1a48', mid: '#76598f', horizon: '#dc9c98', sun: '#ffe4bd' },
  { at: 100, top: '#1a1240', mid: '#b76e79', horizon: '#ff5733', sun: '#ffd27a' },
];

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

export function paletteFor(score) {
  const s = Math.min(100, Math.max(0, score));
  const i = s < STOPS[1].at ? 0 : 1;
  const [a, b] = [STOPS[i], STOPS[i + 1]];
  const t = (s - a.at) / (b.at - a.at);
  const pick = (key) => mix(a[key], b[key], t);

  const top = pick('top');
  return {
    top,
    mid: pick('mid'),
    horizon: pick('horizon'),
    sun: pick('sun'),
    land: mix(top, '#05050b', 0.75),
    glow: 0.25 + 0.65 * (s / 100),
  };
}

export function applyPalette(el, p) {
  el.style.setProperty('--sky-top', p.top);
  el.style.setProperty('--sky-mid', p.mid);
  el.style.setProperty('--sky-horizon', p.horizon);
  el.style.setProperty('--sun', p.sun);
  el.style.setProperty('--land', p.land);
  el.style.setProperty('--glow', p.glow);
}
