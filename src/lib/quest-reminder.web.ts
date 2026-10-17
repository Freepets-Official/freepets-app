/**
 * 웹은 기기 알림을 예약할 수 없다(서비스 워커를 쓰지 않는다). 켜기 버튼은 앱에서만 보인다.
 */
export async function askReminderPermission(): Promise<boolean> {
  return false;
}
export async function cancelQuestReminders(): Promise<void> {}
export async function planQuestReminders(_: { doneToday: boolean; streak: number }): Promise<void> {}
