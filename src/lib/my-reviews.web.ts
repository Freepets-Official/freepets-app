/**
 * 웹은 SecureStore가 없다. localStorage를 쓴다(네이티브 구현과 같은 계약).
 * 자세한 배경은 `my-reviews.ts` 주석 참고.
 */
const KEY = 'freepets.myReviewIds';

export async function loadMyReviewIds(): Promise<number[]> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export async function saveMyReviewIds(ids: number[]): Promise<void> {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // 저장에 실패하면 이번 세션에만 내 글로 인식된다. 리뷰 작성 자체를 막지는 않는다.
  }
}
