import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View, type AppStateStatus } from 'react-native';

import { Text } from '@/components/text';
import { AppLogo } from '@/components/app-logo';
import { Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * 앱 잠금 — 설정에서 켜면, 앱 실행/백그라운드 복귀 시 생체인증(Face ID·지문)으로
 * 잠금을 해제해야 내용이 보인다. 로그인된 상태에서만 동작. 웹은 미지원(no-op).
 */
export function BiometricGate({ children }: { children: ReactNode }) {
  const p = usePalette();
  const { settings, session } = useAppStore();
  const active = supported && settings.appLock && session.authed;

  const [locked, setLocked] = useState(false);
  const [authing, setAuthing] = useState(false);
  const appState = useRef(AppState.currentState);

  /**
   * 생체인증 때문에 앱이 잠깐 백그라운드로 가는 구간.
   *
   * Face ID·지문 창이 뜨면 앱은 `inactive`가 되고, 인증이 끝나면 `active`로 돌아온다.
   * 그런데 아래 AppState 리스너는 그 복귀를 "사용자가 앱을 떠났다 돌아왔다"로 읽고 다시
   * 잠갔다 — 잠그면 다시 인증창이 뜨고, 그게 또 복귀를 만들어 **무한히 반복**됐다.
   *
   * 인증 중이거나 막 끝난 직후의 복귀는 우리가 만든 것이므로 다시 잠그지 않는다.
   * 리스너는 클로저라 상태가 아니라 ref로 읽어야 한다.
   */
  const authingRef = useRef(false);
  const settleUntilRef = useRef(0);
  /** 인증 직후 OS가 늦게 보내는 active 이벤트까지 덮을 여유 */
  const SETTLE_MS = 1500;

  const unlock = useCallback(async () => {
    if (authingRef.current) return;
    authingRef.current = true;
    setAuthing(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: '반갑꼬리 잠금 해제',
        cancelLabel: '취소',
      });
      if (res.success) setLocked(false);
    } finally {
      settleUntilRef.current = Date.now() + SETTLE_MS;
      authingRef.current = false;
      setAuthing(false);
    }
  }, []);

  // 잠금이 활성화되면(로그인 + 설정 on) 곧바로 잠근다
  useEffect(() => {
    if (active) setLocked(true);
    else setLocked(false);
  }, [active]);

  // 백그라운드 → 포그라운드 복귀 시 다시 잠근다.
  // 단, 인증창 때문에 생긴 복귀는 제외한다(위 주석 참고).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (authingRef.current || Date.now() < settleUntilRef.current) return;
      if (active && prev.match(/inactive|background/) && next === 'active') setLocked(true);
    });
    return () => sub.remove();
  }, [active]);

  // 잠긴 순간 자동으로 생체인증 요청
  useEffect(() => {
    if (locked && active && !authing) unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, active]);

  return (
    <View style={styles.flex}>
      {children}
      {locked ? (
        <View style={[styles.overlay, { backgroundColor: p.bg }]}>
          <AppLogo size={72} />
          <Ionicons name="lock-closed" size={22} color={p.muted} style={{ marginTop: Spacing.lg }} />
          <Text style={[styles.title, { color: p.ink }]}>잠겨 있어요</Text>
          <Text style={[styles.sub, { color: p.muted }]}>생체인증으로 잠금을 해제해주세요.</Text>
          <Pressable
            onPress={unlock}
            disabled={authing}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: p.accent, opacity: pressed || authing ? 0.85 : 1 },
            ]}>
            <Ionicons name="finger-print" size={18} color={p.onAccent} />
            <Text style={[styles.btnText, { color: p.onAccent }]}>잠금 해제</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    paddingHorizontal: Spacing.xl,
  },
  title: { fontSize: 20, lineHeight: 27, fontWeight: '900', letterSpacing: -0.5, marginTop: 10 },
  sub: { fontSize: 13.5, marginTop: 4, textAlign: 'center' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: Spacing.xl,
  },
  btnText: { fontSize: 15, fontWeight: '800' },
});
