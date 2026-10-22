/** 웹은 예약 알림이 없다 */
export async function planTripReminder(_opts: { eventId: number; start: string; title: string; left: number }): Promise<boolean> {
  return false;
}
export async function cancelTripReminders(): Promise<void> {}
