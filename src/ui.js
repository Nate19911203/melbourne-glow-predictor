import { MELBOURNE, TIMEZONE, fetchForecast, hourKey } from './api.js';
import { glowScore, describe, rating } from './score.js';

const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

const timeFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
});

const cards = {
  sunrise: document.getElementById('sunrise'),
  sunset: document.getElementById('sunset'),
};
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refresh');
const nextEl = document.getElementById('next');

let times = null;

function field(card, name) {
  return card.querySelector(`[data-field="${name}"]`);
}

function setScore(card, score) {
  field(card, 'score').textContent = score;
  field(card, 'ring').style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - score / 100);
  const label = rating(score);
  const chip = field(card, 'rating');
  chip.textContent = label;
  chip.dataset.rating = label.toLowerCase();
}

function quality(part) {
  if (part >= 0.7) return 'good';
  if (part >= 0.4) return 'ok';
  return 'bad';
}

function renderFactors(card, local, horizon, horizonLabel, { parts, cover }) {
  const km = local.visibility / 1000;
  const rows = [
    {
      name: 'Mid / high cloud',
      value: `${local.mid}% / ${local.high}%`,
      verdict: cover < 30 ? 'Too thin' : cover > 70 ? 'Too thick' : 'In the sweet spot',
      q: quality(parts.canvas),
    },
    {
      name: `Low cloud, ${horizonLabel}`,
      value: `${horizon.low}%`,
      verdict: horizon.low < 20 ? 'Clear horizon' : horizon.low < 50 ? 'Patchy' : 'Blocked',
      q: quality(parts.horizon),
    },
    {
      name: 'Visibility',
      value: `${km.toFixed(0)} km`,
      verdict: km >= 20 ? 'Crisp' : km >= 10 ? 'Fair' : 'Hazy',
      q: quality(parts.visibility),
    },
    {
      name: 'Humidity',
      value: `${local.humidity}%`,
      verdict: local.humidity <= 60 ? 'Dry' : local.humidity <= 80 ? 'Moderate' : 'Humid',
      q: quality(parts.humidity),
    },
  ];

  // Mid/high cloud is best in the middle, so it gets a range bar with the 30–70% sweet spot shaded.
  const range = `
    <div class="range" aria-hidden="true">
      <span class="range-zone"></span>
      <span class="range-marker" style="left: ${Math.round(cover)}%"></span>
    </div>
    <div class="range-scale" aria-hidden="true"><span>0%</span><span>sweet spot</span><span>100%</span></div>`;

  field(card, 'factors').innerHTML = rows.map((r, i) => `
    <li class="factor">
      <span class="factor-name">${r.name}</span>
      <span class="factor-value">${r.value}</span>
      <span class="factor-verdict" data-q="${r.q}">${r.verdict}</span>
      ${i === 0 ? range : ''}
    </li>`).join('');
}

function renderEvent(card, { time, local, horizon, horizonLabel }) {
  field(card, 'time').textContent = timeFmt.format(time);
  card.classList.remove('is-loading');

  if (!local || !horizon) {
    field(card, 'summary').textContent = 'No forecast available for this time.';
    return;
  }

  const result = glowScore(local, horizon);
  setScore(card, result.score);
  field(card, 'summary').textContent = describe(result);
  renderFactors(card, local, horizon, horizonLabel, result);
}

function formatCountdown(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

// Once today's sunset has passed, switch to tomorrow's sunrise and sunset.
function pickDay(now) {
  const today = SunCalc.getTimes(now, MELBOURNE.lat, MELBOURNE.lon);
  if (now < today.sunset) return { times: today, label: 'Today', date: now };
  const tomorrow = new Date(now.getTime() + 86_400_000);
  return { times: SunCalc.getTimes(tomorrow, MELBOURNE.lat, MELBOURNE.lon), label: 'Tomorrow', date: tomorrow };
}

// Highlights the upcoming event and dims the one already passed.
function updateNext() {
  if (!times) return;
  const now = Date.now();
  if (now > times.sunset) {
    load();
    return;
  }
  cards.sunrise.classList.toggle('is-past', now > times.sunrise);

  const [name, time] = now < times.sunrise ? ['Sunrise', times.sunrise] : ['Sunset', times.sunset];
  nextEl.hidden = false;
  document.getElementById('next-label').textContent = `Next · ${name}`;
  document.getElementById('next-countdown').textContent = formatCountdown(time - now);
}

async function load() {
  const day = pickDay(new Date());
  document.getElementById('date').textContent = `${day.label} · ${dateFmt.format(day.date)}`;

  times = day.times;
  field(cards.sunrise, 'time').textContent = timeFmt.format(times.sunrise);
  field(cards.sunset, 'time').textContent = timeFmt.format(times.sunset);
  updateNext();

  refreshBtn.classList.add('spinning');
  refreshBtn.disabled = true;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Updating…';

  try {
    const forecast = await fetchForecast();
    const riseKey = hourKey(times.sunrise);
    const setKey = hourKey(times.sunset);

    renderEvent(cards.sunrise, {
      time: times.sunrise,
      local: forecast.city[riseKey],
      horizon: forecast.east[riseKey],
      horizonLabel: 'east',
    });
    renderEvent(cards.sunset, {
      time: times.sunset,
      local: forecast.city[setKey],
      horizon: forecast.west[setKey],
      horizonLabel: 'west',
    });
    statusEl.textContent = `Updated ${timeFmt.format(new Date())}`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Couldn’t load the forecast. Check your connection and try again.';
    statusEl.classList.add('error');
  } finally {
    refreshBtn.classList.remove('spinning');
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', load);

// Refresh when the app comes back to the foreground (e.g. reopened from the home screen).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') load();
});

setInterval(updateNext, 30_000);

load();
