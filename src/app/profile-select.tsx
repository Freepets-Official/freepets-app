import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore, type ProfileKind } from '@/store/app-store';

const META: Record<ProfileKind, { label: string; caption: string; icon: 'person' | 'storefront' }> = {
  consumer: { label: '일반', caption: '반려동물과 떠나는 여행자 모드', icon: 'person' },
  owner: { label: '사업자', caption: '내 매장 관리 · 홍보 · 통계', icon: 'storefront' },
};

export default function ProfileSelectScreen() {
  const p = usePalette();
  const { availableProfiles, selectProfile } = useAppStore();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: p.bg }]}>
      <View style={styles.inner}>
        <View style={styles.head}>
          <Ionicons name="paw" size={22} color={p.accent} />
          <Text style={[styles.title, { color: p.ink }]}>누구로 이용할까요?</Text>
          <Text style={[styles.sub, { color: p.muted }]}>
            같은 계정에서 여행자와 사장님을 오갈 수 있어요.
          </Text>
        </View>

        <View style={styles.grid}>
          {availableProfiles.map((kind) => {
            const m = META[kind];
            return (
              <Pressable
                key={kind}
                onPress={() => selectProfile(kind)}
                style={({ pressed }) => [
                  styles.tile,
                  CardShadow,
                  { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.92 : 1 },
                ]}>
                <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                  <Ionicons name={m.icon} size={40} color={p.accent} />
                </View>
                <Text style={[styles.tileLabel, { color: p.ink }]}>{m.label}</Text>
                <Text style={[styles.tileCaption, { color: p.muted }]}>{m.caption}</Text>
              </Pressable>
            );
          })}
        </View>

        {availableProfiles.length === 1 && (
          <Text style={[styles.note, { color: p.muted }]}>
            설정 → 내 매장 관리에서 사업자등록번호를 인증하면 사업자 프로필이 생겨요.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl,
  },
  head: { alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  sub: { fontSize: 13.5, textAlign: 'center', lineHeight: 20 },
  grid: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg },
  tile: {
    flex: 1,
    maxWidth: 200,
    alignItems: 'center',
    gap: 8,
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileLabel: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  tileCaption: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  note: { fontSize: 12.5, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20 },
});
