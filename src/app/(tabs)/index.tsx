import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PetIdCard } from '@/components/pet-id-card';
import { QuestScrollIcon } from '@/components/quest-scroll-icon';
import { Text } from '@/components/text';
import { ResultBadge } from '@/components/badge';
import { GameCardFx } from '@/components/game-card-fx';
import { Screen } from '@/components/screen';
import { SectionTitle } from '@/components/section-title';
import { Radius, Spacing } from '@/constants/theme';
import { FACILITIES } from '@/data/mock';
import { type Pet } from '@/data/types';
import { usePalette } from '@/hooks/use-theme';
import { uniqueRegionCount } from '@/data/stamps';
import { GuestScreen } from '@/components/guest-prompt';
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
  const {
    session,
    pets,
    checks,
    plannedDenialAlerts,
    upcomingVaccinations,
    stamps,
    facilityById,
    loadFacility,
    hideCheck,
    reloadAll,
  } = useAppStore();

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

  if (!session.authed) {
    return (
      <GuestScreen
        eyebrow="반갑꼬리"
        title="홈"
        body="내 아이 기준 판별 이력, 다음 접종, 좋아한 곳이 여기에 모여요. 탐색 탭은 로그인 없이도 볼 수 있어요."
      />
    );
  }

  return (
    <Screen
      eyebrow={greeting()}
      title="반려동물 여권"
      subtitle="아이마다 좋아한 장소를 한눈에 확인하세요."
      headerRight={
        <View style={styles.headerActions}>
          {/* 퀘스트(두루마리)와 알림(종)을 나란히 — 둘 다 "지금 할 일"을 여는 입구다 */}
          <Pressable
            onPress={() => router.push('/quests')}
            hitSlop={8}
            accessibilityLabel="오늘의 퀘스트"
            style={({ pressed }) => [
              styles.bellBtn,
              { borderColor: p.line, backgroundColor: pressed ? p.surface : 'transparent' },
            ]}>
            <QuestScrollIcon size={21} color={p.ink} />
          </Pressable>
          <NotificationBell
            count={alertCount}
            urgent={alerts.length > 0}
            onPress={() => router.push('/notifications')}
          />
        </View>
      }
      // 실제로 다시 불러온다. 예전에는 800ms 기다리는 연출뿐이라, 최초 조회가 실패하면
      // 앱을 껐다 켜기 전까지 빈 화면에서 빠져나올 방법이 없었다.
      onRefresh={reloadAll}>
      {pets.length === 0 ? (
        <View style={[styles.empty, { borderColor: p.line }]}>
          <Ionicons name="paw" size={30} color={p.accent} />
          <Text style={[styles.emptyText, { color: p.muted }]}>
            내 반려동물 탭에서{'\n'}아이를 먼저 등록해 주세요.
          </Text>
        </View>
      ) : pets.length === 1 ? (
        <View style={styles.card}>
          <PetIdCard pet={pets[0]} />
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
const STACK_CARD_H = 392;
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
        style={[styles.card, styles.stackCard, isFront && tilt]}
        onLayout={isFront ? (e) => { dim.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; } : undefined}
        onPointerMove={isFront ? onMove : undefined}
        onPointerLeave={isFront ? resetTilt : undefined}
        onPointerUp={isFront ? resetTilt : undefined}
        onPointerCancel={isFront ? resetTilt : undefined}>
        {isFront ? (
          <>
            <PetIdCard pet={pet} />
            <GameCardFx />
          </>
        ) : (
          <Pressable onPress={onFront} style={styles.flex}>
            <View pointerEvents="none">
              <PetIdCard pet={pet} />
            </View>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
    /**
     * **색을 반드시 적는다.** 안 적으면 React Native가 검정을 기본값으로 쓴다 —
     * 실기기 캡처를 픽셀로 보니 크림색 명함 둘레에 순수 검정 테두리가 둘려 있었다(2026-09-21).
     * 명함 안쪽 구분선과 같은 따뜻한 갈색을 써서 종이 카드의 가장자리처럼 보이게 한다
     * (`pet-id-card.tsx`의 `CARD.line`과 같은 값).
     */
    borderColor: 'rgba(120,101,66,0.32)',
    overflow: 'hidden',
    /**
     * 카드가 떠 있어 보이게 하는 그림자.
     *
     * 예전엔 앱 강조색인 로즈핑크(`#E86397`)를 썼다. 명함이 분홍 계열이던 시절엔 어울렸는데,
     * 지금은 종이 질감의 주민등록증(크림색 바탕 + 짙은 갈색 하단 띠)이라 카드 둘레에
     * **분홍 테가 둘린 것처럼 보였다.** 특히 아래쪽에서 짙은 띠와 맞닿아 대비가 커진다.
     * 카드 자체의 먹색(`pet-id-card.tsx`의 `CARD.strip`)을 써서 종이에 진 그림자로 보이게 한다.
     */
    shadowColor: '#3A332A',
    shadowOpacity: 0.14,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  stackItem: { position: 'absolute', top: 0, left: 0, right: 0 },
  stackCard: { height: STACK_CARD_H },
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
