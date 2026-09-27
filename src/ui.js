import { MELBOURNE, TIMEZONE, fetchForecast, hourKey } from './api.js';
import { glowScore, describe } from './score.js';

const timeFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE, hour: 'numeric', minute: '2-digit',
});
const dateFmt = new Intl.DateTimeFormat('en-AU', {
  timeZone: TIMEZONE, weekday: 'long', day: 'numeric', month: 'long',
});

const statusEl = document.getElementById('status');

function field(card, name) {
  return card.querySelector(`[data-field="${name}"]`);
}

function renderEvent(card, { time, local, horizon, horizonLabel }) {
  field(card, 'time').textContent = timeFmt.format(time);

  if (!local || !horizon) {
    field(card, 'summary').textContent = 'No forecast available for this time.';
    return;
  }

  const result = glowScore(local, horizon);
  field(card, 'score').textContent = result.score;
  field(card, 'bar').style.width = `${result.score}%`;
  field(card, 'summary').textContent = describe(result);

  const rows = [
    ['Mid / high cloud', `${local.mid}% / ${local.high}%`],
    [`Low cloud (${horizonLabel} horizon)`, `${horizon.low}%`],
    ['Low cloud (city)', `${local.low}%`],
    ['Visibility', `${(local.visibility / 1000).toFixed(1)} km`],
    ['Humidity', `${local.humidity}%`],
  ];
  field(card, 'details').innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join('');
}

async function init() {
  const now = new Date();
  document.getElementById('date').textContent = dateFmt.format(now);

  const { sunrise, sunset } = SunCalc.getTimes(now, MELBOURNE.lat, MELBOURNE.lon);
  const sunriseCard = document.getElementById('sunrise');
  const sunsetCard = document.getElementById('sunset');
  field(sunriseCard, 'time').textContent = timeFmt.format(sunrise);
  field(sunsetCard, 'time').textContent = timeFmt.format(sunset);

  try {
    statusEl.textContent = 'Fetching forecast…';
    const forecast = await fetchForecast();
    const riseKey = hourKey(sunrise);
    const setKey = hourKey(sunset);

    renderEvent(sunriseCard, {
      time: sunrise,
      local: forecast.city[riseKey],
      horizon: forecast.east[riseKey],
      horizonLabel: 'east',
    });
    renderEvent(sunsetCard, {
      time: sunset,
      local: forecast.city[setKey],
      horizon: forecast.west[setKey],
      horizonLabel: 'west',
    });
    statusEl.textContent = `Updated ${timeFmt.format(new Date())}`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Couldn’t load the forecast. Check your connection and refresh.';
    statusEl.classList.add('error');
  }
}

init();
