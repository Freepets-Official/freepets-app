import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLogo } from '@/components/app-logo';
import { SocialButtons } from '@/components/social-buttons';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ApiError, authApi } from '@/lib/api';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export default function SignupScreen() {
  const p = usePalette();
  const router = useRouter();
  const { login, authenticate } = useAppStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState(false);
  // 닉네임은 폼이 아니라 '가입하기' 직후 모달에서 받는다
  const [nickModal, setNickModal] = useState(false);
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const pwOk = pw.length >= 8;
  const matchOk = pw2.length > 0 && pw === pw2;
  const formOk = emailOk && pwOk && matchOk && agree;
  const nickOk = nickname.trim().length >= 2 && nickname.trim().length <= 20;

  // 이메일·비번 입력 후 '가입하기' → 닉네임 모달을 연다
  const openNick = () => {
    if (!formOk) return;
    setError(null);
    setNickname('');
    setNickModal(true);
  };

  // 모달에서 닉네임 확정 → 백엔드 가입 → 곧바로 로그인해 토큰 발급 → 세션 진입.
  // (백엔드에 이메일 인증이 아직 없어 verify-email 화면은 건너뛴다. 추가되면 그때 연결.)
  const finishSignup = async () => {
    if (!nickOk || loading) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.signup(email.trim(), pw, nickname.trim());
      const tokens = await authApi.login(email.trim(), pw);
      authenticate(email.trim(), tokens);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '가입에 실패했어요.');
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
            <View style={styles.head}>
              <AppLogo size={52} />
              <Text style={[styles.title, { color: p.ink }]}>회원가입</Text>
              <Text style={[styles.sub, { color: p.muted }]}>
                이메일로 시작하거나 소셜 계정으로 간편하게 가입하세요.
              </Text>
            </View>

            <View style={styles.form}>
              <Field
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="이메일"
                keyboardType="email-address"
                hint={email.length > 0 && !emailOk ? '올바른 이메일 형식이 아니에요' : undefined}
              />
              <Field
                icon="lock-closed-outline"
                value={pw}
                onChangeText={setPw}
                placeholder="비밀번호 (8자 이상)"
                secureTextEntry
                hint={pw.length > 0 && !pwOk ? '8자 이상 입력해주세요' : undefined}
              />
              <Field
                icon="lock-closed-outline"
                value={pw2}
                onChangeText={setPw2}
                placeholder="비밀번호 확인"
                secureTextEntry
                hint={pw2.length > 0 && !matchOk ? '비밀번호가 일치하지 않아요' : undefined}
              />

              {/* 약관 동의 */}
              <Pressable style={styles.agree} onPress={() => setAgree((v) => !v)}>
                <Ionicons
                  name={agree ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={agree ? p.accent : p.muted}
                />
                <Text style={[styles.agreeText, { color: p.ink }]}>
                  <Text style={{ color: p.accent, fontWeight: '800' }}>이용약관</Text> 및{' '}
                  <Text style={{ color: p.accent, fontWeight: '800' }}>개인정보 처리방침</Text>에
                  동의합니다
                </Text>
              </Pressable>

              {error && !nickModal ? (
                <Text style={[styles.error, { color: p.danger }]}>{error}</Text>
              ) : null}

              <Pressable
                onPress={openNick}
                disabled={!formOk}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: formOk ? p.accent : p.line, opacity: pressed && formOk ? 0.9 : 1 },
                ]}>
                <Text style={[styles.primaryLabel, { color: formOk ? p.onAccent : p.muted }]}>
                  가입하기
                </Text>
              </Pressable>
            </View>

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: p.line }]} />
              <Text style={[styles.dividerText, { color: p.muted }]}>또는</Text>
              <View style={[styles.line, { backgroundColor: p.line }]} />
            </View>

            <SocialButtons onPress={() => login('social@freepets.app')} />

            <View style={styles.bottom}>
              <Text style={[styles.bottomText, { color: p.muted }]}>이미 계정이 있으신가요?</Text>
              <Link href="/login" replace style={[styles.bottomLink, { color: p.accent }]}>
                로그인
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 닉네임 만들기 모달 — 가입 마지막 단계 */}
      <Modal visible={nickModal} transparent animationType="fade" onRequestClose={() => setNickModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalWrap}>
          <View style={[styles.modalCard, { backgroundColor: p.card }]}>
            <View style={styles.modalHead}>
              <AppLogo size={44} />
              <Text style={[styles.modalTitle, { color: p.ink }]}>어떻게 불러드릴까요?</Text>
              <Text style={[styles.modalSub, { color: p.muted }]}>
                앱에서 보여질 닉네임을 정해주세요. 언제든 바꿀 수 있어요.
              </Text>
            </View>

            <View style={[styles.field, { backgroundColor: p.surface, borderColor: error ? p.danger : p.line }]}>
              <Ionicons name="paw-outline" size={18} color={p.muted} />
              <TextInput
                value={nickname}
                onChangeText={(t) => {
                  setError(null);
                  setNickname(t);
                }}
                placeholder="닉네임 (2~20자)"
                placeholderTextColor={p.muted}
                autoCapitalize="none"
                maxLength={20}
                autoFocus
                style={[styles.input, { color: p.ink }]}
              />
            </View>

            {error ? <Text style={[styles.error, { color: p.danger }]}>{error}</Text> : null}

            <Pressable
              onPress={finishSignup}
              disabled={!nickOk || loading}
              style={({ pressed }) => [
                styles.primary,
                {
                  backgroundColor: nickOk && !loading ? p.accent : p.line,
                  opacity: pressed && nickOk && !loading ? 0.9 : 1,
                },
              ]}>
              {loading ? (
                <ActivityIndicator color={p.onAccent} />
              ) : (
                <Text style={[styles.primaryLabel, { color: nickOk ? p.onAccent : p.muted }]}>
                  프리펫스 시작하기
                </Text>
              )}
            </Pressable>

            <Pressable onPress={() => setNickModal(false)} disabled={loading} style={styles.modalCancel}>
              <Text style={[styles.modalCancelText, { color: p.muted }]}>뒤로</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({
  icon,
  hint,
  ...input
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  hint?: string;
} & React.ComponentProps<typeof TextInput>) {
  const p = usePalette();
  return (
    <View style={styles.fieldWrap}>
      <View style={[styles.field, { backgroundColor: p.surface, borderColor: hint ? p.danger : p.line }]}>
        <Ionicons name={icon} size={18} color={p.muted} />
        <TextInput
          placeholderTextColor={p.muted}
          autoCapitalize="none"
          style={[styles.input, { color: p.ink }]}
          {...input}
        />
      </View>
      {hint ? <Text style={[styles.hint, { color: p.danger }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.xl },
  head: { alignItems: 'center', gap: 8 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  sub: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 16 },
  form: { gap: 10 },
  fieldWrap: { gap: 5 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  input: { flex: 1, fontSize: 15, padding: 0 },
  hint: { fontSize: 12, fontWeight: '600', paddingLeft: 4 },
  agree: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  agreeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  primary: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryLabel: { fontSize: 16, fontWeight: '800' },
  error: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalHead: { alignItems: 'center', gap: 8, marginBottom: 2 },
  modalTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  modalSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },
  modalCancel: { alignItems: 'center', paddingVertical: 6 },
  modalCancelText: { fontSize: 14, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700' },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  bottomText: { fontSize: 13.5 },
  bottomLink: { fontSize: 13.5, fontWeight: '800' },
});
