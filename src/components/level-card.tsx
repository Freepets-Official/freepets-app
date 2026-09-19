import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { TierPaw } from '@/components/tier-paw';
import { Radius, Spacing } from '@/constants/theme';
import { MAX_LEVEL, TIER_COLOR_HEX, levelProgress, tierName } from '@/data/level';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

/**
 * 발바닥 티어 배지 — 서버가 그림 URL을 주면 그걸, 없으면 `TierPaw`가 직접 그린다.
 * (디자인 리소스가 없어 지금은 항상 직접 그린다 — `tierBadgeImageUrl`은 늘 생략된다)
 */
function TierBadge({ size = 56 }: { size?: number }) {
  const { gamification } = useAppStore();
  if (!gamification) return null;

  if (gamification.tierBadgeImageUrl) {
    return (
      <Image
        source={{ uri: gamification.tierBadgeImageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={tierName(gamification)}
      />
    );
  }
  return <TierPaw gamification={gamification} size={size} />;
}

/**
 * 집사 레벨 카드 — 레벨·티어·다음 레벨까지 남은 XP.
 *
 * XP는 계정 단위로 쌓인다(판별·리뷰·제보·만족도·코스 공개/복사). 반려동물별 값이 아니다.
 * 서버에서 아직 못 받았으면 **아무것도 그리지 않는다** — 0레벨이 잠깐 스쳐 지나가면
 * 레벨이 내려간 것처럼 보인다.
 */
export function LevelCard() {
  const p = usePalette();
  const { gamification } = useAppStore();
  if (!gamification) return null;

  const { level, into, step, remain, ratio, maxed } = levelProgress(gamification);
  const color = TIER_COLOR_HEX[gamification.tierColor];

  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line }]}>
      <TierBadge />
      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={[styles.level, { color: p.ink }]}>Lv.{level}</Text>
          <View style={[styles.tierChip, { backgroundColor: p.card, borderColor: color }]}>
            <Text style={[styles.tierText, { color }]} numberOfLines={1}>
              {tierName(gamification)}
            </Text>
          </View>
          <Text style={[styles.max, { color: p.muted }]}>/ {MAX_LEVEL}</Text>
        </View>

        <View style={[styles.track, { backgroundColor: p.line }]}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: color }]} />
        </View>

        <Text style={[styles.sub, { color: p.muted }]}>
          {maxed
            ? `최고 레벨이에요 · 누적 ${gamification.totalXp.toLocaleString()} XP`
            : `다음 레벨까지 ${remain.toLocaleString()} XP · ${into.toLocaleString()}/${step.toLocaleString()}`}
        </Text>
      </View>
    </View>
  );
}

/**
 * 받은 배지.
 *
 * 하나도 없을 때 빈 줄만 남으면 "안 불러와진 것"처럼 보인다 — 어떻게 받는지 한 줄로 말해준다.
 */
export function EarnedBadges() {
  const p = usePalette();
  const { gamification } = useAppStore();
  if (!gamification) return null;

  if (gamification.badges.length === 0) {
    return (
      <Text style={[styles.empty, { color: p.muted }]}>
        아직 받은 배지가 없어요. 판별·리뷰·제보로 경험치를 쌓으면 레벨과 함께 배지가 열려요.
      </Text>
    );
  }

  return (
    <View style={styles.badgeList}>
      {gamification.badges.map((b) => (
        <View
          key={b.code || b.label}
          style={[styles.badge, { backgroundColor: p.card, borderColor: p.line }]}>
          <Ionicons name="ribbon-outline" size={18} color={p.accent} />
          <View style={styles.badgeBody}>
            <Text style={[styles.badgeLabel, { color: p.ink }]}>{b.label}</Text>
            {!!b.description && (
              <Text style={[styles.badgeDesc, { color: p.muted }]}>{b.description}</Text>
            )}
          </View>
          {!!b.earnedAt && (
            <Text style={[styles.badgeDate, { color: p.muted }]}>{b.earnedAt.slice(0, 10)}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  tierCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  body: { flex: 1, gap: 7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  level: { fontSize: 22, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 },
  max: { fontSize: 12, marginLeft: 'auto' },
  tierChip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: 9, paddingVertical: 2 },
  tierText: { fontSize: 11.5, fontWeight: '800' },
  track: { height: 7, borderRadius: Radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full },
  sub: { fontSize: 12 },

  empty: { fontSize: 13, lineHeight: 19 },
  badgeList: { gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  badgeBody: { flex: 1 },
  badgeLabel: { fontSize: 14, fontWeight: '800' },
  badgeDesc: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  badgeDate: { fontSize: 11 },
});
