import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { AppLogo } from '@/components/app-logo';
import { LoginScene } from '@/components/login-scene';
import { SocialButtons } from '@/components/social-buttons';
import { useSocialLogin } from '@/hooks/use-social-login';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { ApiError, authApi } from '@/lib/api';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export default function LoginScreen() {
  const p = usePalette();
  const router = useRouter();
  const { authenticate, enterGuest } = useAppStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const social = useSocialLogin();
  // 소셜 로그인 실패도 같은 자리에 보여준다 — 훅이 따로 들고 있으면 화면에 아무것도 안 뜬다
  const shownError = error ?? social.error;

  // 소셜 로그인이 도는 동안 이메일 로그인을 막는다. 둘이 동시에 끝나면 A의 데이터 위에 B 토큰이 얹힌다
  const canSubmit = email.trim().length > 0 && pw.length > 0 && !loading && social.pending == null;

  // 실제 백엔드 로그인 — 성공 시 토큰 저장 + 세션 진입
  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const tokens = await authApi.login(email.trim(), pw);
      authenticate(email.trim(), tokens);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '로그인에 실패했어요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            {/* 움직이는 자연 배경 + 동물들 */}
            <LoginScene />

            {/* 브랜드 */}
            <View style={styles.brand}>
              <AppLogo size={68} />
              <Text style={[styles.wordmark, { color: p.ink }]}>반갑꼬리</Text>
              <Text style={[styles.tagline, { color: p.muted }]}>
                반려동물과 어디를 가든, 문 앞에서 거부당하지 않게.
              </Text>
            </View>

            {/* 이메일 로그인 */}
            <View style={styles.form}>
              <View style={[styles.field, { backgroundColor: p.surface, borderColor: p.line }]}>
                <Ionicons name="mail-outline" size={18} color={p.muted} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="이메일"
                  placeholderTextColor={p.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: p.ink }]}
                />
              </View>
              <View style={[styles.field, { backgroundColor: p.surface, borderColor: p.line }]}>
                <Ionicons name="lock-closed-outline" size={18} color={p.muted} />
                <TextInput
                  value={pw}
                  onChangeText={setPw}
                  placeholder="비밀번호"
                  placeholderTextColor={p.muted}
                  secureTextEntry
                  style={[styles.input, { color: p.ink }]}
                />
              </View>

              {shownError ? (
                <Text style={[styles.error, { color: p.danger }]}>{shownError}</Text>
              ) : null}

              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: canSubmit ? p.accent : p.line, opacity: pressed && canSubmit ? 0.9 : 1 },
                ]}>
                {loading ? (
                  <ActivityIndicator color={p.onAccent} />
                ) : (
                  <Text style={[styles.primaryLabel, { color: canSubmit ? p.onAccent : p.muted }]}>
                    로그인
                  </Text>
                )}
              </Pressable>

              <Pressable style={styles.forgot}>
                <Text style={[styles.forgotText, { color: p.muted }]}>비밀번호를 잊으셨나요?</Text>
              </Pressable>
            </View>

            {/* 구분선 */}
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: p.line }]} />
              <Text style={[styles.dividerText, { color: p.muted }]}>또는</Text>
              <View style={[styles.line, { backgroundColor: p.line }]} />
            </View>

            {/* 소셜 로그인 */}
            <SocialButtons
              onPress={social.signIn}
              available={social.isProviderAvailable}
              pending={social.pending}
              disabled={loading}
            />

            {/* 회원가입 */}
            <View style={styles.bottom}>
              <Text style={[styles.bottomText, { color: p.muted }]}>계정이 없으신가요?</Text>
              <Link href="/signup" style={[styles.bottomLink, { color: p.accent }]}>
                회원가입
              </Link>
            </View>
            {/* 계정 없이도 시설은 둘러볼 수 있어야 한다(애플 5.1.1(v)). 판별·리뷰·캘린더는 로그인 뒤 */}
            <Pressable
              onPress={() => {
                enterGuest();
                router.replace('/(tabs)/explore');
              }}
              style={styles.guest}
              hitSlop={8}>
              <Text style={[styles.guestText, { color: p.muted }]}>로그인 없이 둘러보기</Text>
              <Ionicons name="chevron-forward" size={14} color={p.muted} />
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl },
  brand: { alignItems: 'center', gap: 10 },
  // 워드마크는 UI 글씨가 아니라 브랜드 타이포라 Type 사다리를 따르지 않는다
  wordmark: { fontSize: 28, lineHeight: 38, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: Type.body, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  form: { gap: 10 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  input: { flex: 1, fontSize: Type.callout, padding: 0 },
  primary: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryLabel: { fontSize: Type.cardTitle, fontWeight: '800' },
  error: { fontSize: Type.body, fontWeight: '600', textAlign: 'center', marginBottom: 2 },
  forgot: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: Type.body, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: Type.footnote, fontWeight: '700' },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  bottomText: { fontSize: Type.body },
  bottomLink: { fontSize: Type.body, fontWeight: '800' },
  guest: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, marginTop: 14 },
  guestText: { fontSize: Type.body, fontWeight: '700', textDecorationLine: 'underline' },
});
