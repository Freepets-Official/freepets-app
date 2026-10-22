/** 웹은 localStorage(네이티브와 같은 계약) */
const keyOf = (account: string) => `freepets.tripkit.${account.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)}`;

export async function loadKitRaw(account: string): Promise<unknown> {
  try {
    const raw = window.localStorage.getItem(keyOf(account));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveKitRaw(account: string, state: object): Promise<boolean> {
  try {
    window.localStorage.setItem(keyOf(account), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
