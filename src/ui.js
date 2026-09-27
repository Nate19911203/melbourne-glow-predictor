import { MELBOURNE, TIMEZONE, fetchForecast, hourKey } from './api.js';
import { glowScore, describe, rating } from './score.js';
import { paletteFor, applyPalette } from './palette.js';
import { drawScene, sunBearing } from './scene.js';

const timeFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
});

const $ = (id) => document.getElementById(id);
const scene = $('scene');
const statusEl = $('status');
const refreshBtn = $('refresh');
const tabs = [...document.querySelectorAll('.switch [role="tab"]')];

// Score used for colours before any forecast has loaded.
const NEUTRAL_SCORE = 25;

const EVENTS = {
  sunrise: { name: 'Sunrise', facing: 90, horizonKey: 'east' },
  sunset: { name: 'Sunset', facing: 270, horizonKey: 'west' },
};

const state = { day: null, forecast: null, events: {}, selected: null, message: 'Loading forecast…' };

// Once today's sunset has passed, switch to tomorrow's sunrise and sunset.
function pickDay(now) {
  const today = SunCalc.getTimes(now, MELBOURNE.lat, MELBOURNE.lon);
  if (now < today.sunset) return { times: today, label: 'Today', date: now };
  const tomorrow = new Date(now.getTime() + 86_400_000);
  return { times: SunCalc.getTimes(tomorrow, MELBOURNE.lat, MELBOURNE.lon), label: 'Tomorrow', date: tomorrow };
}

function buildEvents() {
  for (const [id, cfg] of Object.entries(EVENTS)) {
    const time = state.day.times[id];
    const key = hourKey(time);
    const local = state.forecast?.city[key];
    const horizon = state.forecast?.[cfg.horizonKey][key];
    state.events[id] = {
      ...cfg,
      time,
      local,
      horizon,
      result: local && horizon ? glowScore(local, horizon) : null,
      bearing: sunBearing(time, MELBOURNE.lat, MELBOURNE.lon),
    };
  }
}

function formatCountdown(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

function whenText(ev) {
  const day = state.day.label === 'Today' ? 'Today’s' : 'Tomorrow’s';
  const diff = ev.time - Date.now();
  return `${day} ${ev.name.toLowerCase()} · ${timeFmt.format(ev.time)} · ${diff > 0 ? formatCountdown(diff) : 'passed'}`;
}

function quality(part) {
  if (part >= 0.7) return 'good';
  if (part >= 0.4) return 'ok';
  return 'bad';
}

function statsFor({ local, horizon, horizonKey, result }) {
  const { cover, parts } = result;
  const km = local.visibility / 1000;
  return [
    {
      label: 'Mid & high cloud',
      value: `${Math.round(cover)}%`,
      note: cover < 30 ? 'Too thin' : cover > 70 ? 'Too thick' : 'In the sweet spot',
      q: quality(parts.canvas),
    },
    {
      label: `Low cloud to the ${horizonKey}`,
      value: `${horizon.low}%`,
      note: horizon.low < 20 ? 'Clear horizon' : horizon.low < 50 ? 'Patchy' : 'Blocked',
      q: quality(parts.horizon),
    },
    {
      label: 'Visibility',
      value: `${Math.round(km)} km`,
      note: km >= 20 ? 'Crisp' : km >= 10 ? 'Fair' : 'Hazy',
      q: quality(parts.visibility),
    },
    {
      label: 'Humidity',
      value: `${local.humidity}%`,
      note: local.humidity <= 60 ? 'Dry air' : local.humidity <= 80 ? 'Moderate' : 'Humid',
      q: quality(parts.humidity),
    },
  ];
}

function drawSelectedScene() {
  const ev = state.events[state.selected];
  if (!ev) return;
  const { width, height } = scene.getBoundingClientRect();
  drawScene(scene, {
    width,
    height,
    bearing: ev.bearing,
    facing: ev.facing,
    cover: ev.result?.cover ?? 0,
    lowCloud: ev.horizon?.low ?? 0,
  });
  scene.setAttribute('aria-label', `The ${ev.horizonKey}ern horizon at ${ev.name.toLowerCase()}`);
}

function render() {
  const ev = state.events[state.selected];
  const palette = paletteFor(ev.result?.score ?? NEUTRAL_SCORE);
  applyPalette(document.documentElement, palette);
  $('theme-color').content = palette.top;

  $('hero-when').textContent = whenText(ev);
  $('hero-score').textContent = ev.result ? ev.result.score : '--';
  $('hero-rating').textContent = ev.result ? `${rating(ev.result.score)} glow potential` : ' ';
  $('hero-summary').textContent = ev.result ? describe(ev.result) : state.message;
  drawSelectedScene();

  for (const tab of tabs) {
    const other = state.events[tab.dataset.event];
    const p = paletteFor(other.result?.score ?? NEUTRAL_SCORE);
    tab.setAttribute('aria-selected', String(tab.dataset.event === state.selected));
    tab.querySelector('.swatch').style.background = `linear-gradient(180deg, ${p.top}, ${p.mid} 55%, ${p.horizon})`;
    tab.querySelector('.switch-time').textContent = timeFmt.format(other.time);
    tab.querySelector('.switch-score').textContent = other.result ? other.result.score : '--';
  }

  $('briefing-title').textContent = `Conditions at ${ev.name.toLowerCase()}`;
  $('stats').innerHTML = ev.result
    ? statsFor(ev).map((s) => `
      <div class="stat" data-q="${s.q}">
        <dt>${s.label}</dt>
        <dd class="stat-value">${s.value}</dd>
        <dd class="stat-note">${s.note}</dd>
      </div>`).join('')
    : '';
}

async function load() {
  const day = pickDay(new Date());
  const dayChanged = !state.day || dateFmt.format(state.day.date) !== dateFmt.format(day.date);
  state.day = day;
  $('date').textContent = `${day.label} · ${dateFmt.format(day.date)}`;

  if (dayChanged) {
    state.selected = Date.now() < day.times.sunrise ? 'sunrise' : 'sunset';
    state.forecast = null;
    state.message = 'Loading forecast…';
  }
  buildEvents();
  render();

  refreshBtn.classList.add('spinning');
  refreshBtn.disabled = true;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Updating…';

  try {
    state.forecast = await fetchForecast();
    state.message = 'No forecast available for this time.';
    buildEvents();
    render();
    statusEl.textContent = `Updated ${timeFmt.format(new Date())}`;
  } catch (err) {
    console.error(err);
    state.message = 'Couldn’t load the forecast.';
    render();
    statusEl.textContent = 'Couldn’t load the forecast. Check your connection and try again.';
    statusEl.classList.add('error');
  } finally {
    refreshBtn.classList.remove('spinning');
    refreshBtn.disabled = false;
  }
}

// Keeps the countdown current and rolls over to tomorrow after sunset.
function tick() {
  if (!state.day) return;
  if (Date.now() > state.day.times.sunset) {
    load();
    return;
  }
  $('hero-when').textContent = whenText(state.events[state.selected]);
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    state.selected = tab.dataset.event;
    render();
  });
}

refreshBtn.addEventListener('click', load);

// Refresh when the app comes back to the foreground (e.g. reopened from the home screen).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') load();
});

new ResizeObserver(drawSelectedScene).observe(scene);
setInterval(tick, 30_000);

load();
