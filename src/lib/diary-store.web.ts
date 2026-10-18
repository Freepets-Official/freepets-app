import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 웹은 파일 폴더가 없어 사진을 작게(720px) 줄인 data URL로 localStorage에 둔다(네이티브와 같은 계약).
 * localStorage는 브라우저마다 5MB 남짓이라 꽉 차면 저장이 실패한다 — 호출부가 알린다.
 */
const keyOf = (account: string) => `freepets.diary.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadDiaryRaw(account: string): Promise<unknown> {
  try {
    const raw = window.localStorage.getItem(keyOf(account));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveDiaryRaw(account: string, map: object): Promise<boolean> {
  try {
    window.localStorage.setItem(keyOf(account), JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export async function storeDiaryPhoto(_account: string, srcUri: string): Promise<string | null> {
  try {
    const out = await ImageManipulator.manipulateAsync(srcUri, [{ resize: { width: 720 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null;
  }
}

export function deleteDiaryPhoto(_uri: string) {
  // data URL은 기록에서 빠지면 함께 사라진다
}
