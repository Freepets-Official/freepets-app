/**
 * 캘린더 하루 기록 — 그날 찍은 사진과 짧은 메모.
 *
 * 서버 API가 아직 없어 **기기에만** 남긴다(사진은 개인적인 것이라 서버로 보내기 전에
 * 동의·보관 정책이 먼저다). 계정마다 따로 둔다.
 */
export type DiaryDay = {
  /** 저장된 사진 주소(네이티브 file://, 웹 data:) — 앞쪽이 대표 사진 */
  photos: string[];
  note: string;
  updatedAt: number;
};
export type DiaryMap = Record<string, DiaryDay>;

/** 하루에 담을 수 있는 사진 수 — 칸에 작게 보이고 상세에서 넘겨 보는 정도면 충분하다 */
export const DIARY_MAX_PHOTOS = 6;
export const DIARY_MAX_NOTE = 500;

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 저장된 값이 깨졌어도 화면이 죽지 않게 최소 조건만 보고 거른다 */
export function parseDiary(raw: unknown): DiaryMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: DiaryMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!YMD.test(k) || !v || typeof v !== 'object') continue;
    const d = v as Partial<DiaryDay>;
    const photos = Array.isArray(d.photos) ? d.photos.filter((p): p is string => typeof p === 'string').slice(0, DIARY_MAX_PHOTOS) : [];
    const note = typeof d.note === 'string' ? d.note.slice(0, DIARY_MAX_NOTE) : '';
    if (!photos.length && !note.trim()) continue;
    out[k] = { photos, note, updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0 };
  }
  return out;
}

/** 하루를 바꾼 결과. 사진도 메모도 없으면 그날 기록을 지운다 */
export function withDay(map: DiaryMap, ymd: string, day: Omit<DiaryDay, 'updatedAt'>): DiaryMap {
  const next = { ...map };
  if (!day.photos.length && !day.note.trim()) delete next[ymd];
  else next[ymd] = { photos: day.photos.slice(0, DIARY_MAX_PHOTOS), note: day.note.slice(0, DIARY_MAX_NOTE), updatedAt: Date.now() };
  return next;
}
