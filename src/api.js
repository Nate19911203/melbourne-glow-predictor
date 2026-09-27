// Weather data from Open-Meteo (free, no API key).

export const MELBOURNE = { lat: -37.8136, lon: 144.9631 };
export const TIMEZONE = 'Australia/Melbourne';

// Glow depends on whether sunlight can reach the clouds from below the horizon,
// so we also sample low cloud ~55 km east (sunrise) and west (sunset) of the city.
const HORIZON_OFFSET_DEG = 0.6;

const LOCATIONS = {
  city: MELBOURNE,
  east: { lat: MELBOURNE.lat, lon: MELBOURNE.lon + HORIZON_OFFSET_DEG },
  west: { lat: MELBOURNE.lat, lon: MELBOURNE.lon - HORIZON_OFFSET_DEG },
};

const HOURLY_VARS = [
  'cloudcover_low',
  'cloudcover_mid',
  'cloudcover_high',
  'visibility',
  'relativehumidity_2m',
];

// Returns { city, east, west }, each mapping "YYYY-MM-DDTHH:00" (Melbourne local) to hourly values.
export async function fetchForecast() {
  const points = Object.values(LOCATIONS);
  const params = new URLSearchParams({
    latitude: points.map((p) => p.lat).join(','),
    longitude: points.map((p) => p.lon).join(','),
    hourly: HOURLY_VARS.join(','),
    timezone: TIMEZONE,
    forecast_days: '2',
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status})`);
  const data = await res.json();

  const names = Object.keys(LOCATIONS);
  return Object.fromEntries(names.map((name, i) => [name, indexByHour(data[i].hourly)]));
}

function indexByHour(hourly) {
  const byHour = {};
  hourly.time.forEach((time, i) => {
    byHour[time] = {
      low: hourly.cloudcover_low[i],
      mid: hourly.cloudcover_mid[i],
      high: hourly.cloudcover_high[i],
      visibility: hourly.visibility[i],
      humidity: hourly.relativehumidity_2m[i],
    };
  });
  return byHour;
}

// Formats a Date as the Open-Meteo hourly key in Melbourne local time, rounded to the nearest hour.
export function hourKey(date) {
  const rounded = new Date(Math.round(date.getTime() / 3_600_000) * 3_600_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(rounded).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
}
