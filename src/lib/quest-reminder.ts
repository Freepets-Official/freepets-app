import { loadLocalNotifications } from '@/lib/push';

/**
 * 저녁 퀘스트 알림 — **기기 안에서만** 예약하는 로컬 알림(서버 푸시가 아니다).
 *
 * 사용자가 켰을 때만 쓴다. 하루 한 번, 저녁 8시. 오늘 이미 무언가 했으면 오늘 몫은 건너뛴다 —
 * 했는데 "오늘 하나만 해요"가 오면 귀찮은 앱이 된다. "매일 반복" 트리거는 특정 날만 뺄 수
 * 없어서, 앞으로 7일치를 하루씩 예약하고 앱을 열 때마다 다시 짠다.
 */
const PREFIX = 'quest-reminder-';

/**
 * 예약·취소를 한 줄로 세운다. 예약이 도는 사이 스위치를 끄면 취소가 먼저 끝나고 예약이 이어져,
 * 꺼 둔 알림이 울렸다. 앞 작업이 끝나야 다음 작업이 돈다.
 */
let chain: Promise<void> = Promise.resolve();
const enqueue = (job: () => Promise<void>) => {
  chain = chain.then(job).catch(() => {});
  return chain;
};
const HOUR = 20;

const LINES = [
  '갈 곳이 생겼나요? 들어갈 수 있는지 먼저 판별해 둬요.',
  '오늘 다녀온 곳, 아이가 좋아했나요? 만족도 하나 남겨요.',
  '꼬리 친구가 기다려요. 오늘 퀘스트 하나면 충분해요.',
];

export async function askReminderPermission(): Promise<boolean> {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return false;
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export function cancelQuestReminders(): Promise<void> {
  return enqueue(cancelNow);
}

async function cancelNow(): Promise<void> {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // 예약 목록을 못 읽으면 지울 것도 없다
  }
}

/**
 * 앞으로 7일 저녁 알림을 다시 짠다. 오늘 이미 했거나 8시가 지났으면 오늘 몫은 없다.
 * `stillWanted`는 예약 직전에 다시 묻는다 — 줄을 서 있는 사이 사용자가 껐을 수 있다.
 */
export function planQuestReminders(opts: { doneToday: boolean; streak: number; stillWanted: () => boolean }): Promise<void> {
  return enqueue(() => planNow(opts));
}

async function planNow({ doneToday, streak, stillWanted }: { doneToday: boolean; streak: number; stillWanted: () => boolean }) {
  const Notifications = loadLocalNotifications();
  if (!Notifications) return;
  await cancelNow();
  if (!stillWanted()) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, HOUR, 0, 0);
      if (i === 0 && (doneToday || at <= now)) continue;
      // 오늘 알림은 이어 온 기록을 말해 준다. 그 뒤 날짜는 그날 기록을 미리 알 수 없어 일반 문구
      const body =
        i === 0 && streak > 0 ? `오늘 하나만 하면 ${streak + 1}일 연속이에요. 꼬리 친구가 기다려요!` : LINES[i % LINES.length];
      const id = `${PREFIX}${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`;
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: { title: '반갑꼬리', body, data: { url: '/quests' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
      });
    }
  } catch {
    // 예약 실패는 조용히 — 알림이 안 오는 것보다 앱이 멈추는 게 더 나쁘다
  }
}
