/**
 * 계절 판정용 서울 일평균기온(최근 40일).
 *
 * 서버 계절 판정(`GET /api/v1/seasons/current`, api-specs/season-recap.md)이 생기면 이 파일을
 * 지운다. 그 전까지는 산책 날씨와 같은 Open-Meteo를 쓰되 **서울 고정 좌표**만 보낸다 —
 * 사용자 위치는 나가지 않는다. 하루에 한 번만 받는다.
 */
const URL =
  'https://api.open-meteo.com/v1/forecast?latitude=37.57&longitude=126.97&daily=temperature_2m_mean&past_days=40&forecast_days=1&timezone=Asia%2FSeoul';

let cache: { day: string; data: { date: string; mean: number }[] } | null = null;
let pending: Promise<{ date: string; mean: number }[]> | null = null;

export async function fetchSeoulDailyMeans(today: string): Promise<{ date: string; mean: number }[]> {
  if (cache?.day === today) return cache.data;
  if (pending) return pending;
  pending = (async () => {
    try {
      const r = await fetch(URL);
      if (!r.ok) return [];
      const j = (await r.json()) as { daily?: { time?: string[]; temperature_2m_mean?: (number | null)[] } };
      const t = j.daily?.time ?? [];
      const v = j.daily?.temperature_2m_mean ?? [];
      // 오늘은 아직 하루가 안 끝나 평균이 예보값이다 — 어제까지만 쓴다
      const data = t
        .map((date, i) => ({ date, mean: v[i] }))
        .filter((d): d is { date: string; mean: number } => typeof d.mean === 'number' && d.date < today);
      cache = { day: today, data };
      return data;
    } catch {
      return [];
    } finally {
      pending = null;
    }
  })();
  return pending;
}
