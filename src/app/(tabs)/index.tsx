import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ResultBadge } from '@/components/badge';
import { PetAvatar } from '@/components/pet-avatar';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { CATEGORY_LABEL, satisfactionMood, sinceText, type Pet } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { DENIAL_REASON_LABEL, useAppStore } from '@/store/app-store';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/** 시간대별 인사 — 홈을 열 때마다 조금씩 다른 온기를 준다 */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '편안한 밤이에요 🌙';
  if (h < 11) return '좋은 아침이에요 🐾';
  if (h < 17) return '좋은 오후예요 🐾';
  if (h < 21) return '좋은 저녁이에요 🐾';
  return '편안한 밤이에요 🌙';
}

export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const { pets, checks, plannedDenialAlerts, upcomingVaccinations } = useAppStore();
  const alerts = plannedDenialAlerts();
  const vax = upcomingVaccinations();

  return (
    <Screen
      eyebrow={greeting()}
      title="반려동물 여권"
      subtitle="아이마다 좋아한 장소를 한눈에 확인하세요."
      // 데모: 당기면 발자국 연출 후 마무리. 백엔드 연동 시 실제 데이터 새로고침으로 교체.
      onRefresh={() => new Promise((r) => setTimeout(r, 800))}>
      {/* 가려던 곳(판별받은 시설)에 거부가 뜨면 홈에서 먼저 알린다 — 가장 눈에 띄게 */}
      {alerts.length > 0 && (
        <View style={styles.alertWrap}>
          {alerts.map(({ facility, report }) => (
            <Pressable
              key={facility.facilityId}
              onPress={() =>
                router.push({ pathname: '/facility/[id]', params: { id: String(facility.facilityId) } })
              }
              style={({ pressed }) => [
                styles.denialCard,
                CardShadow,
                { backgroundColor: p.danger, opacity: pressed ? 0.92 : 1 },
              ]}>
              <PulseBell />
              <View style={styles.alertText}>
                <View style={styles.denialTitleRow}>
                  <Text style={styles.denialLabel}>실시간 거부</Text>
                  <Text style={styles.denialTitle}>가려던 곳에 거부가 떴어요</Text>
                </View>
                <Text style={styles.denialBody} numberOfLines={2}>
                  {facility.name} · {report.createdAt ? sinceText(report.createdAt) : ''}
                  {report.reason ? ` · ${DENIAL_REASON_LABEL[report.reason]}` : ''} — 방문 전 확인하세요
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
          ))}
        </View>
      )}

      {/* 다가오는(또는 지난) 예방접종 — 개·고양이 부스터 리마인더 */}
      {vax.length > 0 && (
        <View style={styles.alertWrap}>
          {vax.map(({ pet, dday, date }) => {
            const overdue = dday < 0;
            const tone = overdue ? p.danger : p.accent;
            const toneSoft = overdue ? p.dangerSoft : p.accentSoft;
            return (
              <Pressable
                key={pet.petId}
                onPress={() => router.push('/calendar')}
                style={({ pressed }) => [
                  styles.alertCard,
                  { backgroundColor: pressed ? toneSoft : p.card, borderColor: tone },
                ]}>
                <View style={[styles.alertIcon, { backgroundColor: toneSoft }]}>
                  <Ionicons name="medkit" size={18} color={tone} />
                </View>
                <View style={styles.alertText}>
                  <Text style={[styles.alertTitle, { color: tone }]}>
                    {overdue ? `${pet.name} 접종 기한이 지났어요` : `${pet.name} 예방접종이 다가와요`}
                  </Text>
                  <Text style={[styles.alertBody, { color: p.ink }]} numberOfLines={2}>
                    다음 접종 {date} · {overdue ? `${-dday}일 지남` : `D-${dday}`} — 캘린더에서 확인하세요
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={tone} />
              </Pressable>
            );
          })}
        </View>
      )}

      {pets.length === 0 ? (
        <View style={[styles.empty, { borderColor: p.line }]}>
          <Ionicons name="paw" size={30} color={p.accent} />
          <Text style={[styles.emptyText, { color: p.muted }]}>
            내 반려동물 탭에서{'\n'}아이를 먼저 등록해 주세요.
          </Text>
        </View>
      ) : pets.length === 1 ? (
        <View style={[styles.card, CardShadow, { borderColor: p.accent, backgroundColor: p.card }]}>
          <PetCardBody pet={pets[0]} />
        </View>
      ) : (
        <PetStack pets={pets} />
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

/** 거부 알림의 통통 뛰는 벨 — 시선을 끈다 */
function PulseBell() {
  const p = usePalette();
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withRepeat(withTiming(1, { duration: 850 }), -1, true);
  }, [s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.14 * s.value }] }));
  return (
    <Animated.View style={[styles.denialIcon, style]}>
      <Ionicons name="notifications" size={18} color={p.danger} />
    </Animated.View>
  );
}

const STACK_CARD_H = 280;
const STACK_PEEK = 72;
const STACK_SPRING = { damping: 16, stiffness: 180, mass: 0.7 };

/** 반려동물 카드 스택 — 겹쳐 쌓고, 뒤 카드를 탭하면 셔플하듯 앞으로 나온다 */
function PetStack({ pets }: { pets: Pet[] }) {
  const [order, setOrder] = useState<number[]>(() => pets.map((pt) => pt.petId));
  // pets가 바뀌면(추가/삭제) order 동기화 — 있는 것만 유지 + 새로 생긴 것 뒤에 추가
  const ids = pets.map((pt) => pt.petId).join(',');
  useEffect(() => {
    setOrder((prev) => {
      const now = pets.map((pt) => pt.petId);
      const kept = prev.filter((id) => now.includes(id));
      const added = now.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const bringFront = (id: number) => setOrder((prev) => [id, ...prev.filter((x) => x !== id)]);
  const height = STACK_CARD_H + (pets.length - 1) * STACK_PEEK;

  return (
    <View style={{ height }}>
      {pets.map((pet) => (
        <StackCard
          key={pet.petId}
          pet={pet}
          pos={order.indexOf(pet.petId)}
          total={pets.length}
          onFront={() => bringFront(pet.petId)}
        />
      ))}
    </View>
  );
}

function StackCard({
  pet,
  pos,
  total,
  onFront,
}: {
  pet: Pet;
  pos: number;
  total: number;
  onFront: () => void;
}) {
  const p = usePalette();
  // 뒤 카드는 위로 살짝 올라가 헤더만 보이고(peek), 앞 카드가 그 위를 덮는다
  const tY = useSharedValue((total - 1 - pos) * STACK_PEEK);
  const sc = useSharedValue(1 - pos * 0.03);

  useEffect(() => {
    tY.value = withSpring((total - 1 - pos) * STACK_PEEK, STACK_SPRING);
    sc.value = withSpring(Math.max(0.9, 1 - pos * 0.03), STACK_SPRING);
  }, [pos, total, tY, sc]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: tY.value }, { scale: sc.value }],
    opacity: 1 - Math.min(pos, 3) * 0.06,
  }));

  const isFront = pos === 0;

  return (
    <Animated.View style={[styles.stackItem, { zIndex: total - pos }, anim]}>
      <View style={[styles.card, styles.stackCard, CardShadow, { borderColor: p.accent, backgroundColor: p.card }]}>
        {isFront ? (
          <PetCardBody pet={pet} />
        ) : (
          <Pressable onPress={onFront} style={styles.flex}>
            <View pointerEvents="none">
              <PetCardBody pet={pet} />
            </View>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

/** 여권 카드 내용(테두리 카드 안에 들어가는 본문) — 원형 프로필 + 좋아한 곳 TOP 3 */
function PetCardBody({ pet }: { pet: Pet }) {
  const p = usePalette();
  const router = useRouter();
  const { topPlacesForPet } = useAppStore();
  const top = topPlacesForPet(pet.petId, 3);

  const medal = ['🥇', '🥈', '🥉'];

  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alertWrap: { gap: Spacing.sm },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertText: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3 },
  alertBody: { fontSize: 12.5, lineHeight: 18 },
  // 거부 알림 — 빨강 채운 카드로 가장 눈에 띄게
  denialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  denialIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  denialTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  denialLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#B91C1C',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: 'hidden',
    letterSpacing: 0.2,
  },
  denialTitle: { fontSize: 14.5, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
  denialBody: { fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.92)' },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  stackItem: { position: 'absolute', top: 0, left: 0, right: 0 },
  stackCard: { height: STACK_CARD_H, overflow: 'hidden' },
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
