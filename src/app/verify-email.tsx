import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

const CODE_LEN = 6;
const RESEND_COOLDOWN = 60; // 초

export default function VerifyEmailScreen() {
  const p = usePalette();
  const router = useRouter();
  const { login } = useAppStore();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);

  // 재발송 쿨다운 카운트다운
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const filled = code.length === CODE_LEN;

  // 데모: 백엔드 연동 전까지 6자리를 채우면 인증 성공으로 간주하고 자동 로그인.
  // 실제로는 POST /auth/verify-email {email, code} 응답으로 교체한다.
  const verify = () => {
    if (!filled) return;
    setError(null);
    login(email || 'me@freepets.app');
  };

  // 6자리 다 채우면 자동 제출
  useEffect(() => {
    if (filled) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  const resend = () => {
    if (cooldown > 0) return;
    // 실제로는 POST /auth/verify-email/resend {email}
    setCode('');
    setError(null);
    setCooldown(RESEND_COOLDOWN);
    inputRef.current?.focus();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
      {/* 뒤로 (회원가입으로) */}
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Ionicons name="chevron-back" size={24} color={p.ink} />
      </Pressable>

      <View style={styles.inner}>
        <View style={styles.head}>
          <AppLogo size={52} />
          <Text style={[styles.title, { color: p.ink }]}>이메일을 확인해 주세요</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            <Text style={{ color: p.ink, fontWeight: '700' }}>{email || '입력하신 메일'}</Text>
            {'\n'}로 보낸 6자리 코드를 입력해주세요.
          </Text>
        </View>

        {/* 코드 입력 — 보이지 않는 인풋 + 6칸 박스 */}
        <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
          {Array.from({ length: CODE_LEN }).map((_, i) => {
            const active = code.length === i;
            const char = code[i] ?? '';
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  {
                    backgroundColor: p.surface,
                    borderColor: error ? p.danger : active ? p.accent : p.line,
                    borderWidth: active || error ? 1.6 : 1,
                  },
                ]}>
                <Text style={[styles.boxChar, { color: p.ink }]}>{char}</Text>
              </View>
            );
          })}
        </Pressable>
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={(t) => {
            setError(null);
            setCode(t.replace(/\D/g, '').slice(0, CODE_LEN));
          }}
          keyboardType="number-pad"
          maxLength={CODE_LEN}
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          style={styles.hiddenInput}
        />

        {error ? <Text style={[styles.error, { color: p.danger }]}>{error}</Text> : null}

        <Pressable
          onPress={verify}
          disabled={!filled}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: filled ? p.accent : p.line, opacity: pressed && filled ? 0.9 : 1 },
          ]}>
          <Text style={[styles.primaryLabel, { color: filled ? p.onAccent : p.muted }]}>인증하기</Text>
        </Pressable>

        {/* 재발송 */}
        <View style={styles.resendRow}>
          <Text style={[styles.resendText, { color: p.muted }]}>코드를 못 받으셨나요?</Text>
          <Pressable onPress={resend} disabled={cooldown > 0} hitSlop={8}>
            <Text
              style={[
                styles.resendLink,
                { color: cooldown > 0 ? p.muted : p.accent },
              ]}>
              {cooldown > 0 ? `${cooldown}초 후 재발송` : '코드 재발송'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  back: { position: 'absolute', top: 8, left: 8, padding: 12, zIndex: 10 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  head: { alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6, marginTop: 4 },
  sub: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 9 },
  box: {
    width: 46,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChar: { fontSize: 24, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  error: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', marginTop: -8 },
  primary: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { fontSize: 16, fontWeight: '800' },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  resendText: { fontSize: 13 },
  resendLink: { fontSize: 13, fontWeight: '800' },
});
