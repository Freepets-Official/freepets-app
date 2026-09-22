import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Screen } from '@/components/screen';
import { Radius, Spacing, Type } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';

/**
 * 로그인 없이 둘러보는 사람에게 계정 기능을 설명하는 안내.
 *
 * 애플 5.1.1(v): 계정과 무관한 기능(시설 탐색·상세)은 로그인 없이 써야 하고, 계정 기능은
 * 막되 **왜 로그인이 필요한지** 말해야 한다. 빈 화면이나 에러로 막으면 안 된다.
 */
export function GuestPrompt({
  title,
  body,
  compact,
}: {
  title: string;
  body: string;
  /** 화면 일부(탭 안)에 끼울 때 — 여백을 줄인다 */
  compact?: boolean;
}) {
  const p = usePalette();
  const router = useRouter();
  return (
    <View style={[styles.card, compact && styles.compact, { backgroundColor: p.surface, borderColor: p.line }]}>
      <View style={[styles.icon, { backgroundColor: p.accentSoft }]}>
        <Ionicons name="paw" size={22} color={p.accent} />
      </View>
      <Text style={[styles.title, { color: p.ink }]}>{title}</Text>
      <Text style={[styles.body, { color: p.muted }]}>{body}</Text>
      <Pressable
        onPress={() => router.push('/login')}
        style={({ pressed }) => [styles.primary, { backgroundColor: pressed ? p.accentDark : p.accent }]}>
        <Text style={[styles.primaryText, { color: p.onAccent }]}>로그인</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/signup')} hitSlop={8}>
        <Text style={[styles.secondary, { color: p.accent }]}>계정이 없다면 회원가입</Text>
      </Pressable>
    </View>
  );
}

/** 탭 화면 전체를 대신하는 버전 — 헤더는 그 탭 이름 그대로 두고 본문만 안내로 */
export function GuestScreen({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <Screen eyebrow={eyebrow} title={title} subtitle="로그인하면 쓸 수 있어요.">
      <GuestPrompt title={`${title}은(는) 로그인 후에`} body={body} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: 8 },
  compact: { padding: Spacing.lg },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: Type.cardTitle, lineHeight: 23, fontWeight: '900', letterSpacing: -0.4, textAlign: 'center' },
  body: { fontSize: Type.body, lineHeight: 20, textAlign: 'center' },
  primary: { alignSelf: 'stretch', alignItems: 'center', borderRadius: Radius.full, paddingVertical: 13, marginTop: 8 },
  primaryText: { fontSize: Type.callout, fontWeight: '800' },
  secondary: { fontSize: Type.body, fontWeight: '700', marginTop: 4 },
});
