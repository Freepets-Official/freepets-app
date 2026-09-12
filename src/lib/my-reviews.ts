import * as SecureStore from 'expo-secure-store';

/**
 * 내가 쓴 리뷰 ID.
 *
 * 서버 리뷰에는 `userId`만 있고 "내 것" 표시가 없는데, 앱은 내 `userId`를 알 방법이
 * 마땅치 않다 — 지금은 `POST /auth/refresh` 응답에만 들어 있어서 로그인 직후에는 모른다.
 * 그 사이 자기 리뷰에 삭제 대신 신고가 떠서 지울 방법이 없었다.
 *
 * 그래서 리뷰를 쓴 시점에 그 ID를 기기에 남긴다. 기기를 바꾸면 잃지만, 그때는 서버가
 * 주는 `userId`로 판정하면 된다(백엔드에 `GET /users/account` 추가를 요청해 뒀다).
 */
const KEY = 'freepets.myReviewIds';

export async function loadMyReviewIds(): Promise<number[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export async function saveMyReviewIds(ids: number[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(ids));
  } catch {
    // 저장에 실패하면 이번 세션에만 내 글로 인식된다. 리뷰 작성 자체를 막지는 않는다.
  }
}
