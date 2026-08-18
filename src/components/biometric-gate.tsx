import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View, type AppStateStatus } from 'react-native';

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

  const unlock = useCallback(async () => {
    if (authing) return;
    setAuthing(true);
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: '프리펫스 잠금 해제',
        cancelLabel: '취소',
      });
      if (res.success) setLocked(false);
    } finally {
      setAuthing(false);
    }
  }, [authing]);

  // 잠금이 활성화되면(로그인 + 설정 on) 곧바로 잠근다
  useEffect(() => {
    if (active) setLocked(true);
    else setLocked(false);
  }, [active]);

  // 백그라운드 → 포그라운드 복귀 시 다시 잠근다
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
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
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 10 },
  sub: { fontSize: 13.5, marginTop: 4, textAlign: 'center' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: Spacing.xl,
  },
  btnText: { fontSize: 15, fontWeight: '800' },
});
