import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 하루 기록을 기기에 남긴다(네이티브). 사진은 앱 문서 폴더에 복사해 둔다 —
 * 사진 앱의 원본 주소는 사용자가 원본을 지우거나 임시 캐시가 비워지면 깨진다.
 * 계정마다 폴더를 나눠 다른 계정의 사진이 섞이지 않게 한다. 웹은 `.web.ts`.
 */
const safe = (account: string) => account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
const dirOf = (account: string) => new Directory(Paths.document, 'diary', safe(account));

export async function loadDiaryRaw(account: string): Promise<unknown> {
  try {
    const f = new File(dirOf(account), 'index.json');
    if (!f.exists) return null;
    return JSON.parse(await f.text());
  } catch {
    return null;
  }
}

export async function saveDiaryRaw(account: string, map: object): Promise<boolean> {
  try {
    const dir = dirOf(account);
    dir.create({ intermediates: true, idempotent: true });
    const f = new File(dir, 'index.json');
    if (!f.exists) f.create();
    f.write(JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

/** 고른 사진을 1280px JPEG로 줄여 계정 폴더에 넣고 그 주소를 돌려준다 */
export async function storeDiaryPhoto(account: string, srcUri: string): Promise<string | null> {
  try {
    const out = await ImageManipulator.manipulateAsync(srcUri, [{ resize: { width: 1280 } }], {
      compress: 0.8,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const dir = dirOf(account);
    dir.create({ intermediates: true, idempotent: true });
    const dest = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
    await new File(out.uri).copy(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export function deleteDiaryPhoto(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // 이미 없으면 그만이다
  }
}
