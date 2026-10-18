import type { Coords } from '@/lib/location';

/**
 * 홈 「꼬리 친구」가 말해 주는 오늘 날씨.
 *
 * **Open-Meteo**를 쓴다. 키가 필요 없어 앱에 비밀이 들어가지 않고(키는 서버에만 — AGENTS.md),
 * 대기질(PM10·PM2.5)까지 같은 곳에서 받을 수 있다. 기상청 단기예보는 서비스 키가 필요해
 * 앱에서 직접 부를 수 없다.
 *
 * ⚠️ Open-Meteo 무료 API는 **비상업 용도**만 허용한다. 수익화하면 유료 플랜이나 기상청(백엔드
 * 경유)으로 옮겨야 한다 — 이 파일의 `fetchWalkWeather`만 바꾸면 화면은 그대로다.
 *
 * 좌표는 **소수 둘째 자리(약 1km)로 줄여서** 보낸다. 날씨에는 그 이상이 필요 없고,
 * 바깥 서비스에 정확한 위치를 넘길 이유가 없다. 개인정보처리방침 4·8조에 적어 두었다.
 */
export interface WalkWeather {
  /** 지금 기온(°C) */
  temp: number;
  /** 체감 온도(°C) — 산책 판단은 이 값으로 한다. 바람·습도가 실제로 느끼는 더위·추위를 바꾼다 */
  feels: number;
  /** WMO 날씨 코드 */
  code: number;
  /** 지금 내리는 비·눈(mm) */
  precipNow: number;
  /** 앞으로 몇 시간 안의 최대 강수 확률(%)과 그 시각(시) */
  rainChance: number;
  rainHour: number | null;
  windKmh: number;
  /** null이면 대기질을 못 받았다 — 미세먼지 말을 하지 않는다 */
  pm10: number | null;
  pm25: number | null;
  /** 오늘 최고 자외선 지수 */
  uvMax: number | null;
  isDay: boolean;
  /** 받은 시각(ms) — 캐시 판단용 */
  fetchedAt: number;
}

const FRESH_MS = 30 * 60 * 1000;
const TIMEOUT_MS = 8000;

let cache: { key: string; data: WalkWeather } | null = null;
let inflight: { key: string; promise: Promise<WalkWeather | null> } | null = null;

/** 소수 둘째 자리 — 위도 0.01°는 약 1.1km */
const round2 = (n: number) => Math.round(n * 100) / 100;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`weather ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 오늘 날씨와 대기질. 실패하면 null — 홈은 날씨 없이도 돌아가야 한다.
 *
 * 같은 동네(반올림한 좌표)면 30분 동안 다시 묻지 않는다. 탭을 오갈 때마다 부르면
 * 무료 한도를 쓸데없이 쓰고, 날씨는 그렇게 빨리 바뀌지 않는다.
 */
export async function fetchWalkWeather(coords: Coords): Promise<WalkWeather | null> {
  const lat = round2(coords.latitude);
  const lon = round2(coords.longitude);
  const key = `${lat},${lon}`;
  if (cache && cache.key === key && Date.now() - cache.data.fetchedAt < FRESH_MS) return cache.data;
  if (inflight && inflight.key === key) return inflight.promise;

  const q = `latitude=${lat}&longitude=${lon}&timezone=Asia%2FSeoul`;
  const promise = (async () => {
    try {
      const [fc, air] = await Promise.all([
        getJson(
          `https://api.open-meteo.com/v1/forecast?${q}` +
            '&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day' +
            '&hourly=precipitation_probability&forecast_hours=8&daily=uv_index_max&forecast_days=1',
        ),
        // 대기질은 없어도 날씨는 말할 수 있다 — 실패를 따로 삼킨다
        getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=pm10,pm2_5`).catch(() => null),
      ]);
      const data = parse(fc, air);
      if (data) cache = { key, data };
      return data;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  inflight = { key, promise };
  return promise;
}

/** 응답 모양이 기대와 다르면 null — 숫자가 아닌 값으로 "영하 NaN도"를 말하면 안 된다 */
function parse(fc: unknown, air: unknown): WalkWeather | null {
  const f = fc as {
    current?: Record<string, unknown>;
    hourly?: { time?: unknown[]; precipitation_probability?: unknown[] };
    daily?: { uv_index_max?: unknown[] };
  } | null;
  const cur = f?.current;
  const temp = num(cur?.temperature_2m);
  const feels = num(cur?.apparent_temperature);
  const code = num(cur?.weather_code);
  if (temp === null || code === null) return null;

  let rainChance = 0;
  let rainHour: number | null = null;
  const probs = f?.hourly?.precipitation_probability ?? [];
  const times = f?.hourly?.time ?? [];
  probs.forEach((v, i) => {
    const pr = num(v);
    if (pr !== null && pr > rainChance) {
      rainChance = pr;
      const t = times[i];
      // "2026-10-17T15:00" → 15
      rainHour = typeof t === 'string' && /T(\d{2})/.test(t) ? Number(t.match(/T(\d{2})/)![1]) : null;
    }
  });

  const a = (air as { current?: Record<string, unknown> } | null)?.current;
  return {
    temp,
    feels: feels ?? temp,
    code,
    precipNow: num(cur?.precipitation) ?? 0,
    rainChance,
    rainHour,
    windKmh: num(cur?.wind_speed_10m) ?? 0,
    pm10: num(a?.pm10),
    pm25: num(a?.pm2_5),
    uvMax: num(f?.daily?.uv_index_max?.[0]),
    isDay: num(cur?.is_day) !== 0,
    fetchedAt: Date.now(),
  };
}
