import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ResultBadge } from '@/components/badge';
import { PetAvatar } from '@/components/pet-avatar';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { CATEGORY_LABEL, satisfactionMood, type Pet } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { useAppStore } from '@/store/app-store';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const { pets, checks } = useAppStore();

  return (
    <Screen eyebrow="우리 아이들" title="반려동물 여권" subtitle="아이마다 좋아한 장소를 한눈에 확인하세요.">
      {pets.length === 0 ? (
        <View style={[styles.empty, { borderColor: p.line }]}>
          <Ionicons name="paw" size={30} color={p.accent} />
          <Text style={[styles.emptyText, { color: p.muted }]}>
            내 반려동물 탭에서{'\n'}아이를 먼저 등록해 주세요.
          </Text>
        </View>
      ) : (
        pets.map((pet) => <PetPassport key={pet.petId} pet={pet} />)
      )}

      {checks.length > 0 && (
        <>
          <SectionTitle title="최근 판별 이력" caption={`${checks.length}건`} />
          <View style={styles.histList}>
            {checks.slice(0, 5).map((c) => {
              const facility = FACILITIES.find((f) => f.facilityId === c.facilityId);
              const names = c.verdicts.map((v) => pets.find((x) => x.petId === v.petId)?.name).filter(Boolean);
              return (
                <Pressable
                  key={c.checkId}
                  onPress={() =>
                    router.push({ pathname: '/facility/[id]', params: { id: String(c.facilityId) } })
                  }
                  style={({ pressed }) => [
                    styles.histCard,
                    { backgroundColor: p.card, borderColor: p.line, opacity: pressed ? 0.92 : 1 },
                  ]}>
                  <View style={styles.histTop}>
                    <Text style={[styles.histName, { color: p.ink }]} numberOfLines={1}>
                      {facility?.name ?? '알 수 없는 시설'}
                    </Text>
                    <ResultBadge result={c.overall} />
                  </View>
                  <Text style={[styles.histMeta, { color: p.muted }]}>
                    {names.join(' · ')} · {formatDate(c.createdAt)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

/** 신분증(여권) 형태의 반려동물 카드 — 핑크 테두리, 원형 프로필, 좋아한 곳 TOP 3 */
function PetPassport({ pet }: { pet: Pet }) {
  const p = usePalette();
  const router = useRouter();
  const { topPlacesForPet } = useAppStore();
  const top = topPlacesForPet(pet.petId, 3);

  const medal = ['🥇', '🥈', '🥉'];

  return (
    <View style={[styles.card, CardShadow, { borderColor: p.accent, backgroundColor: p.card }]}>
      <View style={styles.idRow}>
        <View style={[styles.avatarRing, { borderColor: p.accentSoft }]}>
          <PetAvatar pet={pet} size={56} />
        </View>
        <View style={styles.idText}>
          <Text style={[styles.petName, { color: p.ink }]}>{pet.name}</Text>
          <View style={[styles.passTag, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="paw" size={11} color={p.accent} />
            <Text style={[styles.passTagText, { color: p.accent }]}>프리펫스</Text>
          </View>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: p.line }]} />

      <Text style={[styles.favTitle, { color: p.muted }]}>이 아이가 좋아한 곳 TOP 3</Text>

      {top.length === 0 ? (
        <Text style={[styles.favEmpty, { color: p.muted }]}>
          아직 기록이 없어요. 방문한 곳에서 만족도를 남기면 여기에 모여요.
        </Text>
      ) : (
        <View style={styles.favList}>
          {top.map((item, i) => {
            const mood = satisfactionMood(item.score);
            return (
              <View
                key={item.facility.facilityId}
                onTouchEnd={() =>
                  router.push({
                    pathname: '/facility/[id]',
                    params: { id: String(item.facility.facilityId) },
                  })
                }
                style={styles.favRow}>
                <Text style={styles.medal}>{medal[i]}</Text>
                <View style={styles.favInfo}>
                  <Text style={[styles.favName, { color: p.ink }]} numberOfLines={1}>
                    {item.facility.name}
                  </Text>
                  <Text style={[styles.favCat, { color: p.muted }]}>
                    {CATEGORY_LABEL[item.facility.category]}
                  </Text>
                </View>
                <View style={[styles.scorePill, { backgroundColor: p.accentSoft }]}>
                  <Text style={styles.scoreEmoji}>{mood.emoji}</Text>
                  <Text style={[styles.scoreValue, { color: p.accent }]}>
                    {item.score.toFixed(1)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatarRing: {
    borderRadius: Radius.full,
    borderWidth: 3,
    padding: 2,
  },
  idText: { gap: 6 },
  petName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  passTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  passTagText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  divider: { height: 1 },
  favTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  favEmpty: { fontSize: 13, lineHeight: 20 },
  favList: { gap: Spacing.sm },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  medal: { fontSize: 20, width: 26, textAlign: 'center' },
  favInfo: { flex: 1, gap: 1 },
  favName: { fontSize: 15, fontWeight: '700' },
  favCat: { fontSize: 11.5 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreEmoji: { fontSize: 13 },
  scoreValue: { fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  empty: {
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    paddingVertical: 56,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  histList: { gap: Spacing.sm },
  histCard: { borderRadius: Radius.lg, borderWidth: 1, padding: Spacing.lg, gap: 5 },
  histTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  histName: { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },
  histMeta: { fontSize: 12 },
});
