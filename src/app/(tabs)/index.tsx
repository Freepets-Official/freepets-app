import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { ResultBadge } from '@/components/badge';
import { GameCardFx } from '@/components/game-card-fx';
import { PetAvatar } from '@/components/pet-avatar';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { CATEGORY_LABEL, satisfactionMood, type Pet } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { uniqueRegionCount } from '@/data/stamps';
import { useAppStore } from '@/store/app-store';

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

/** 홈 우측 상단 알림 종 — 안 읽은 알림 수 배지. 거부가 있으면 빨강(긴급). */
function NotificationBell({
  count,
  urgent,
  onPress,
}: {
  count: number;
  urgent: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.bellBtn,
        { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
      ]}>
      <Ionicons name="notifications-outline" size={22} color={p.ink} />
      {count > 0 && (
        <View style={[styles.bellBadge, { backgroundColor: urgent ? p.danger : p.accent, borderColor: p.bg }]}>
          <Text style={styles.bellBadgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function HomeScreen() {
  const p = usePalette();
  const router = useRouter();
  const { pets, checks, plannedDenialAlerts, upcomingVaccinations, stamps, facilityById, loadFacility, hideCheck } =
    useAppStore();

  /**
   * 이력에 담긴 시설을 캐시에 채운다. 이름을 보여주려면 시설을 알아야 하는데 판별 이력에는
   * facilityId만 들어 있다.
   *
   * **한 번 시도한 시설은 다시 부르지 않는다.** 서버에 없는 시설이면 캐시가 끝내 비어 있어
   * 리렌더마다 같은 요청을 반복하게 된다 — 탭을 오갈 때마다 실패할 요청이 쌓인다.
   */
  const triedFacilities = useRef<Set<number>>(new Set());
  useEffect(() => {
    for (const c of checks.slice(0, 5)) {
      if (triedFacilities.current.has(c.facilityId)) continue;
      if (facilityById(c.facilityId)) continue;
      triedFacilities.current.add(c.facilityId);
      void loadFacility(c.facilityId);
    }
  }, [checks, facilityById, loadFacility]);
  // 뱃지 기준과 같은 값(서로 다른 시군구 수)을 쓴다 — 홈과 도장첩이 다른 숫자를 보이면 안 된다
  const stampCount = useMemo(() => uniqueRegionCount(stamps), [stamps]);
  const alerts = plannedDenialAlerts();
  const vax = upcomingVaccinations();

  // 흩어져 있던 푸시성 알림(현장 거부·접종 기한)은 우측 상단 종 버튼 → 알림 페이지로 모았다.
  const alertCount = alerts.length + vax.length;

  return (
    <Screen
      eyebrow={greeting()}
      title="반려동물 여권"
      subtitle="아이마다 좋아한 장소를 한눈에 확인하세요."
      headerRight={
        <NotificationBell
          count={alertCount}
          urgent={alerts.length > 0}
          onPress={() => router.push('/notifications')}
        />
      }
      // 데모: 당기면 발자국 연출 후 마무리. 백엔드 연동 시 실제 데이터 새로고침으로 교체.
      onRefresh={() => new Promise((r) => setTimeout(r, 800))}>
      {pets.length === 0 ? (
        <View style={[styles.empty, { borderColor: p.line }]}>
          <Ionicons name="paw" size={30} color={p.accent} />
          <Text style={[styles.emptyText, { color: p.muted }]}>
            내 반려동물 탭에서{'\n'}아이를 먼저 등록해 주세요.
          </Text>
        </View>
      ) : pets.length === 1 ? (
        <View style={[styles.card, { borderColor: p.line, backgroundColor: p.card }]}>
          <PetCardBody pet={pets[0]} />
          <GameCardFx />
        </View>
      ) : (
        <PetStack pets={pets} />
      )}

      {/*
        여권 도장첩 — 모은 지역 수를 캡션으로 보여준다. 진도가 보여야 다음 도장을 찍는다.
        도장이 없어도 카드는 남긴다. 기능이 있다는 걸 알아야 첫 도장을 찍는다.
      */}
      <Pressable
        onPress={() => router.push('/stamps')}
        style={({ pressed }) => [
          styles.stampEntry,
          { borderColor: p.line, backgroundColor: p.card, opacity: pressed ? 0.92 : 1 },
        ]}>
        <View style={[styles.stampEntryIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="footsteps" size={18} color={p.accent} />
        </View>
        <View style={styles.stampEntryTexts}>
          <Text style={[styles.stampEntryTitle, { color: p.ink }]}>여권 도장첩</Text>
          <Text style={[styles.stampEntryBody, { color: p.muted }]}>
            {stampCount > 0
              ? `${stampCount}개 지역을 모았어요`
              : '다녀온 곳에서 인증샷을 남기고 지역을 모아보세요'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.muted} />
      </Pressable>

      {checks.length > 0 && (
        <>
          <SectionTitle title="최근 판별 이력" caption={`${checks.length}건`} />
          <View style={styles.histList}>
            {checks.slice(0, 5).map((c) => {
              // 스토어 캐시를 먼저 본다. 목 데이터에만 기대면 관광공사에서 온 실제 시설이
              // 전부 "알 수 없는 시설"로 뜬다 — 판별 이력은 대부분 그쪽이다.
              const facility = facilityById(c.facilityId) ?? FACILITIES.find((f) => f.facilityId === c.facilityId);
              // petIds를 쓴다 — 서버에서 불러온 이력엔 verdicts가 없어서 이름이 통째로 비어버린다
              const names = c.petIds.map((id) => pets.find((x) => x.petId === id)?.name).filter(Boolean);
              return (
                <Swipeable
                  key={c.checkId}
                  friction={2}
                  rightThreshold={40}
                  // 목록에서만 지운다. 서버에 삭제 API가 없어 다시 불러오면 되살아나므로
                  // 스토어가 지운 id를 기기에 남겨 걸러낸다.
                  renderRightActions={() => (
                    <Pressable
                      onPress={() => hideCheck(c.checkId)}
                      style={[styles.histDelete, { backgroundColor: p.danger }]}>
                      <Ionicons name="trash" size={18} color="#FFFFFF" />
                      <Text style={styles.histDeleteText}>삭제</Text>
                    </Pressable>
                  )}>
                  <Pressable
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
                </Swipeable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

/** 거부 알림의 통통 뛰는 벨 — 시선을 끈다 */
const STACK_CARD_H = 280;
const STACK_PEEK = 72;
const STACK_SPRING = { damping: 16, stiffness: 180, mass: 0.7 };
// 틸트가 원위치로 돌아올 때의 스프링 — 살짝 출렁이며 손을 떼는 느낌
const TILT_SPRING = { damping: 12, stiffness: 140, mass: 0.6 };

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

  /**
   * 뒤 카드를 **투명하게 만들지 않는다.**
   *
   * 예전에는 `opacity`로 깊이를 줬는데, 카드가 반투명해지면서 **뒤 카드의 내용이 앞
   * 카드에 비쳐 보였다.** 아이가 여럿이면 이름·레벨·XP 바가 겹쳐 읽혀 지저분하다.
   * 다크에서 특히 두드러진다.
   *
   * 깊이는 이미 `scale`과 `translateY`가 만들고 있어서 투명도까지 쓸 이유가 없다.
   */
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: tY.value }, { scale: sc.value }],
  }));

  const isFront = pos === 0;

  // 홀로그램 카드 틸트 — 앞 카드 위에서 포인터/손가락을 움직이면 그쪽으로 3D로 기운다.
  // 유리 광택이 각도에 따라 다르게 걸려 실제 홀로그램 카드를 만지는 느낌을 준다.
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const dim = useRef({ w: 1, h: 1 });
  const tilt = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateX: `${rx.value}deg` }, { rotateY: `${ry.value}deg` }],
  }));
  // 웹은 offsetX/Y, 네이티브는 locationX/Y — 있는 쪽을 쓴다 (플랫폼별 필드가 달라 any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onMove = (e: any) => {
    const ne = e.nativeEvent as Record<string, number>;
    const ox = ne.offsetX ?? ne.locationX;
    const oy = ne.offsetY ?? ne.locationY;
    if (!Number.isFinite(ox) || !Number.isFinite(oy)) return;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const nx = (ox / dim.current.w) * 2 - 1; // -1..1
    const ny = (oy / dim.current.h) * 2 - 1;
    ry.value = withTiming(clamp(nx) * 9, { duration: 80 });
    rx.value = withTiming(clamp(-ny) * 9, { duration: 80 });
  };
  const resetTilt = () => {
    rx.value = withSpring(0, TILT_SPRING);
    ry.value = withSpring(0, TILT_SPRING);
  };

  return (
    <Animated.View style={[styles.stackItem, { zIndex: total - pos }, anim]}>
      <Animated.View
        style={[styles.card, styles.stackCard, { borderColor: p.line, backgroundColor: p.card }, isFront && tilt]}
        onLayout={isFront ? (e) => { dim.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; } : undefined}
        onPointerMove={isFront ? onMove : undefined}
        onPointerLeave={isFront ? resetTilt : undefined}
        onPointerUp={isFront ? resetTilt : undefined}
        onPointerCancel={isFront ? resetTilt : undefined}>
        {isFront ? (
          <>
            <PetCardBody pet={pet} />
            <GameCardFx />
          </>
        ) : (
          <Pressable onPress={onFront} style={styles.flex}>
            <View pointerEvents="none">
              <PetCardBody pet={pet} />
            </View>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

/** 여권 카드 내용(테두리 카드 안에 들어가는 본문) — 원형 프로필 + 좋아한 곳 TOP 3 */
/**
 * 반려동물 레벨(게임 요소) — 방문/판별 활동으로 XP를 쌓는다.
 * ⚠️ 임시 공식(placeholder). 정식 레벨/보상 체계 정해지면 교체.
 */
function petProgress(xpRaw: number) {
  const STEP = 40;
  const level = 1 + Math.floor(xpRaw / STEP);
  const into = xpRaw % STEP;
  const title = level >= 6 ? '여행 마스터' : level >= 4 ? '여행 탐험가' : level >= 2 ? '여행 새싹' : '첫 발자국';
  return { level, into, step: STEP, ratio: into / STEP, title };
}

function PetCardBody({ pet }: { pet: Pet }) {
  const p = usePalette();
  const router = useRouter();
  const { topPlacesForPet, satisfactions, checks, stamps } = useAppStore();
  const top = topPlacesForPet(pet.petId, 3);

  const medal = ['🥇', '🥈', '🥉'];

  // 활동 기반 XP(임시): 만족도 남긴 곳 ×12 + 판별 함께한 횟수 ×6 + 여권 도장 ×15
  // 도장이 가장 큰 이유는 실제로 다녀와야 찍히기 때문이다 — 손이 제일 많이 간 활동이다
  const visits = satisfactions.filter((s) => s.petId === pet.petId).length;
  const judged = checks.filter((c) => c.petIds.includes(pet.petId)).length;
  const stamped = stamps.filter((s) => s.petIds.includes(pet.petId)).length;
  const { level, into, step, ratio, title } = petProgress(visits * 12 + judged * 6 + stamped * 15);

  return (
    <>
      {/* 게임 캐릭터 네임플레이트 — 그라디언트 배너 */}
      <LinearGradient
        colors={[p.accent, p.accentDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}>
        <View style={styles.portrait}>
          {/* 글래스 림 — 좌상단이 밝게 빛나는 유리·금속 질감 링 */}
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.7)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.portraitRing}>
            <PetAvatar pet={pet} size={52} />
          </LinearGradient>
          {/* 레벨 칩 — 금속·글래스 하이라이트 */}
          <LinearGradient
            colors={['#FFFFFF', '#E8EBF1']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.levelBadge}>
            <Text style={[styles.levelText, { color: p.accentDark }]}>Lv.{level}</Text>
          </LinearGradient>
        </View>
        <View style={styles.bannerInfo}>
          <Text style={styles.gameName} numberOfLines={1}>
            {pet.name}
          </Text>
          <View style={styles.rankChip}>
            <Text style={styles.rankEmoji}>🏆</Text>
            <Text style={styles.rankText}>{title}</Text>
          </View>
          <View style={styles.xpRow}>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.max(6, ratio * 100)}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {into}/{step} XP
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.bodyPad}>
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
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  // 프리미엄 수집형 카드 — 그라디언트 네임플레이트 + 얇은 테두리 + 깊은 플로팅 그림자
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    // 깊고 부드러운 플로팅 그림자(살짝 핑크 톤) — 카드가 떠 있는 입체감
    shadowColor: '#E86397',
    shadowOpacity: 0.16,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  stackItem: { position: 'absolute', top: 0, left: 0, right: 0 },
  stackCard: { height: STACK_CARD_H },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  portrait: { width: 60, height: 60 },
  portraitRing: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    // 유리 디스크가 살짝 떠 보이게
    shadowColor: '#5B2130',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    // 금속 칩이 도드라지게
    shadowColor: '#5B2130',
    shadowOpacity: 0.22,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1.5 },
  },
  levelText: { fontSize: 11, fontWeight: '900', letterSpacing: -0.2 },
  bannerInfo: { flex: 1, gap: 5 },
  gameName: { fontSize: 21, lineHeight: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  rankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rankEmoji: { fontSize: 11 },
  rankText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.2 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  xpTrack: {
    flex: 1,
    height: 7,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  xpFill: { height: '100%', borderRadius: Radius.full, backgroundColor: '#FFFFFF' },
  xpText: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.95)', fontVariant: ['tabular-nums'] },
  bodyPad: { padding: Spacing.xl, gap: Spacing.md },
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
  histDelete: {
    justifyContent: 'center', alignItems: 'center', gap: 2,
    width: 76, marginLeft: 8, borderRadius: Radius.md,
  },
  histDeleteText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  stampEntry: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, marginTop: 4,
  },
  stampEntryIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  stampEntryTexts: { flexShrink: 1, gap: 2 },
  stampEntryTitle: { fontSize: 13.5, fontWeight: '800' },
  stampEntryBody: { fontSize: 11.5 },

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
