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

function renderFactors(card, local, horizon, horizonLabel, parts) {
  const rows = [
    ['Mid / high cloud', `${local.mid}% / ${local.high}%`, parts.canvas],
    [`Low cloud, ${horizonLabel}`, `${horizon.low}%`, parts.horizon],
    ['Visibility', `${(local.visibility / 1000).toFixed(0)} km`, parts.visibility],
    ['Humidity', `${local.humidity}%`, parts.humidity],
  ];
  const list = field(card, 'factors');
  list.innerHTML = rows.map(([name, value]) => `
    <li>
      <div class="factor-top">
        <span class="factor-name">${name}</span>
        <span class="factor-value">${value}</span>
      </div>
      <div class="factor-bar"><span></span></div>
    </li>`).join('');

  // Set widths on the next frame so the bars animate in.
  requestAnimationFrame(() => {
    list.querySelectorAll('.factor-bar span').forEach((bar, i) => {
      bar.style.width = `${Math.round(rows[i][2] * 100)}%`;
    });
  });
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
  renderFactors(card, local, horizon, horizonLabel, result.parts);
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
