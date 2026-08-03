import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
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

import { LoginScene } from '@/components/login-scene';
import { SocialButtons } from '@/components/social-buttons';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

export default function LoginScreen() {
  const p = usePalette();
  const { login } = useAppStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  // 데모: 실제 인증은 백엔드. 여기선 입력값(또는 데모 계정)으로 세션만 연다
  const submit = () => login(email.trim() || 'guest@freepets.app');

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
              <View style={[styles.logo, { backgroundColor: p.accentSoft }]}>
                <Ionicons name="paw" size={30} color={p.accent} />
              </View>
              <Text style={[styles.wordmark, { color: p.ink }]}>프리펫스</Text>
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

              <Pressable
                onPress={submit}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: p.accent, opacity: pressed ? 0.9 : 1 },
                ]}>
                <Text style={[styles.primaryLabel, { color: p.onAccent }]}>로그인</Text>
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
            <SocialButtons onPress={() => login('social@freepets.app')} />

            {/* 회원가입 */}
            <View style={styles.bottom}>
              <Text style={[styles.bottomText, { color: p.muted }]}>계정이 없으신가요?</Text>
              <Link href="/signup" style={[styles.bottomLink, { color: p.accent }]}>
                회원가입
              </Link>
            </View>
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
  logo: {
    width: 68,
    height: 68,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  tagline: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
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
  input: { flex: 1, fontSize: 15, padding: 0 },
  primary: {
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryLabel: { fontSize: 16, fontWeight: '800' },
  forgot: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: 13, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '700' },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  bottomText: { fontSize: 13.5 },
  bottomLink: { fontSize: 13.5, fontWeight: '800' },
});
