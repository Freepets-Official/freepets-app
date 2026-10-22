import { loadLocalNotifications } from '@/lib/push';

/**
 * 여행 전날 저녁 알림 — "내일 ○○ 여행! 준비물 N개 남았어요".
 *
 * 키트를 열 때마다 다시 짠다(남은 개수가 바뀌므로). 여행마다 하나씩, 권한이 이미 있을 때만.
 * 권한을 묻는 건 사용자가 키트에서 직접 누를 때뿐이다. 웹은 `.web.ts`(아무것도 안 함).
 */
const PREFIX = 'trip-kit-';
const HOUR = 20;

export async function planTripReminder(opts: { eventId: number; start: string; title: string; left: number }): Promise<boolean> {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return false;
  const id = `${PREFIX}${opts.eventId}`;
  try {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return false;
    const [y, m, d] = opts.start.split('-').map(Number);
    const at = new Date(y, m - 1, d - 1, HOUR, 0, 0);
    if (at <= new Date()) return true;
    const body =
      opts.left > 0
        ? `내일 ${opts.title} 여행이에요! 준비물 ${opts.left}개가 남았어요.`
        : `내일 ${opts.title} 여행이에요! 준비 끝 — 들를 곳을 한 번 더 판별해 두면 든든해요.`;
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: '여행 안심 키트', body, data: { url: '/trip-kit', eventId: String(opts.eventId) } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
    return true;
  } catch {
    return false;
  }
}

/** 로그아웃 때 — 다른 계정에 남의 여행 알림이 가지 않게 */
export async function cancelTripReminders(): Promise<void> {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // 지울 게 없으면 그만
  }
}
