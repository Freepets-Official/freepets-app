import { Directory, File, Paths } from 'expo-file-system';

/**
 * 여행 안심 키트(준비물 체크·서류함)를 기기에 남긴다(네이티브). 계정마다 파일을 나눈다.
 * 하루 기록과 같은 문서 폴더를 쓴다 — SecureStore는 한 값이 2KB를 넘으면 경고가 난다. 웹은 `.web.ts`.
 */
const safe = (account: string) => account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80);
const fileOf = (account: string) => new File(new Directory(Paths.document, 'diary', safe(account)), 'trip-kit.json');

export async function loadKitRaw(account: string): Promise<unknown> {
  try {
    const f = fileOf(account);
    if (!f.exists) return null;
    return JSON.parse(await f.text());
  } catch {
    return null;
  }
}

export async function saveKitRaw(account: string, state: object): Promise<boolean> {
  try {
    const dir = new Directory(Paths.document, 'diary', safe(account));
    dir.create({ intermediates: true, idempotent: true });
    const f = fileOf(account);
    if (!f.exists) f.create();
    f.write(JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
