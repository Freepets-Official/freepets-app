import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export default function SignupScreen() {
  const p = usePalette();
  const router = useRouter();
  const { login } = useAppStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [agree, setAgree] = useState(false);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const pwOk = pw.length >= 8;
  const matchOk = pw2.length > 0 && pw === pw2;
  const canSubmit = emailOk && pwOk && matchOk && agree;

  // 이메일 가입은 인증 코드 확인을 거친다 → 인증 화면으로. (자동 로그인은 인증 성공 후)
  const submit = () => {
    if (!canSubmit) return;
    router.push({ pathname: '/verify-email', params: { email: email.trim() } });
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

              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: canSubmit ? p.accent : p.line, opacity: pressed && canSubmit ? 0.9 : 1 },
                ]}>
                <Text style={[styles.primaryLabel, { color: canSubmit ? p.onAccent : p.muted }]}>
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700' },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  bottomText: { fontSize: 13.5 },
  bottomLink: { fontSize: 13.5, fontWeight: '800' },
});
