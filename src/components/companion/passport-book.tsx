import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useDerivedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { LevelUpFonts, Type } from '@/constants/theme';
import { footprintsOf } from '@/data/footprints';
import { levelProgress, tierName } from '@/data/level';
import { BREED_SIZE_LABEL, PET_GENDER_LABEL, PET_KIND_LABEL, petAgeYears, type Pet } from '@/data/types';
import { usePetStats } from '@/hooks/use-pet-stats';
import { usePalette } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';
import { useAppStore } from '@/store/app-store';

/**
 * 홈 맨 아래의 반려동물 여권 — **손가락으로 넘기는 3D 책.**
 *
 * 화면에 처음 들어오면 가죽 표지가 열리고(앱을 켠 뒤 한 번), 좌우로 끌면 페이지가 손가락을
 * 따라 넘어가며 다음 아이의 여권이 나온다. 반쯤 넘기고 놓거나 빠르게 튕기면 마저 넘어가고,
 * 아니면 제자리로 돌아온다. 아이가 하나면 살짝 버티다 돌아온다(넘길 게 없다는 손맛).
 *
 * 깜빡임 없이 넘기려고 **넘기는 동안에만 낱장(leaf)을 띄운다.** 넘기는 중에는 아래 깔린
 * 페이지를 "넘긴 뒤의 모습"으로 미리 바꿔 두므로, 낱장이 다 넘어간 순간과 다음 상태(낱장 없음)가
 * 픽셀 단위로 같다 — 회전 값을 되돌리는 타이밍과 React 렌더 타이밍이 어긋나도 티가 안 난다.
 *
 * 종이는 실제 물건이라 **두 테마에서 같은 색**이다(예전 여권 카드와 같은 이유).
 */
const PAPER = '#F6F0E2';
const PAPER_DEEP = '#EADFC6';
const INK = '#2E2823';
const SUB = '#8A7B62';
const LINE = 'rgba(120,101,66,0.32)';
const GOLD = '#E6C47F';
const LEATHER = ['#8E4632', '#6A2F21', '#57261B'] as const;
const PERSPECTIVE = 1600;

/** 끌기 시작했지만 아직 방향을 모름 */
const PENDING = 3;

/** 앱을 켠 뒤 표지는 한 번만 연다 — 홈을 오갈 때마다 다시 열면 지루하다 */
let openedOnce = false;

type Flip = { dir: 1 | -1; from: number; to: number };

export function PassportBook({
  pets,
  focusPetId,
  scrollY,
  viewportH,
}: {
  pets: Pet[];
  /** 위 칩에서 고른 아이 — 그 아이 여권으로 넘긴다 */
  focusPetId: number | null;
  scrollY: SharedValue<number>;
  viewportH: number;
}) {
  const p = usePalette();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const pageW = width / 2;
  const pageH = Math.min(290, Math.round(pageW * 1.42));
  const n = pets.length;
  const wrap = useCallback((i: number) => ((i % n) + n) % n, [n]);

  const [cur, setCur] = useState(0);
  const curIdx = n ? Math.min(cur, n - 1) : 0;
  const [flip, setFlip] = useState<Flip | null>(null);
  /** 넘기는 중인 목적지. 손을 뗀 뒤(UI 스레드) 마무리할 때 읽는다 */
  const toSV = useSharedValue(0);
  const angle = useSharedValue(0);
  const busy = useSharedValue(0);
  const dirSV = useSharedValue(0);
  const rubber = useSharedValue(0);

  const [opened, setOpened] = useState(openedOnce || reduce);
  const cover = useSharedValue(opened ? 1 : 0);
  const openTriggered = useSharedValue(opened ? 1 : 0);

  /* ───── 넘기기 ───── */
  const beginFlip = useCallback(
    (dir: 1 | -1, to?: number) => {
      const f: Flip = { dir, from: curIdx, to: to ?? wrap(curIdx + dir) };
      toSV.set(f.to);
      setFlip(f);
    },
    [curIdx, wrap, toSV],
  );
  const endFlip = useCallback(
    (done: boolean) => {
      if (done) {
        setCur(toSV.get());
        haptic.light();
      }
      setFlip(null);
      busy.set(0);
    },
    [busy, toSV],
  );
  /** 버튼·칩으로 넘길 때 — 손가락 없이 같은 동작을 재생한다 */
  const flipTo = useCallback(
    (to: number, dir: 1 | -1) => {
      if (busy.get() || to === curIdx) return;
      if (reduce) {
        setCur(to);
        return;
      }
      busy.set(1);
      angle.set(0);
      beginFlip(dir, to);
      angle.set(
        withTiming(dir === 1 ? -180 : 180, { duration: 620, easing: Easing.bezier(0.45, 0.05, 0.2, 1) }, (fin) => {
          if (fin) scheduleOnRN(endFlip, true);
        }),
      );
    },
    [busy, curIdx, reduce, angle, beginFlip, endFlip],
  );

  // 위에서 아이를 고르면 그 아이 여권으로 — 다음 아이면 앞으로, 아니면 뒤로 넘긴다
  useEffect(() => {
    if (focusPetId === null) return;
    const to = pets.findIndex((x) => x.petId === focusPetId);
    if (to < 0 || to === curIdx) return;
    // 한 틱 뒤에 — 칩이 눌리는 반응이 먼저 보이고, 그다음 여권이 넘어간다
    const t = setTimeout(() => (opened ? flipTo(to, to > curIdx ? 1 : -1) : setCur(to)), 0);
    return () => clearTimeout(t);
    // 고른 아이가 바뀔 때만 따라간다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPetId]);

  const pan = Gesture.Pan()
    .enabled(opened && n > 0 && width > 0)
    .activeOffsetX([-10, 10])
    .failOffsetY([-14, 14])
    .onStart(() => {
      if (busy.get()) {
        dirSV.set(0);
        return;
      }
      if (n < 2) {
        dirSV.set(2);
        return;
      }
      // 방향은 실제로 움직인 뒤에 정한다 — 웹은 시작 순간의 translationX가 0으로 온다
      dirSV.set(PENDING);
      busy.set(1);
      angle.set(0);
    })
    .onUpdate((e) => {
      let d = dirSV.get();
      if (d === PENDING) {
        if (Math.abs(e.translationX) < 4) return;
        d = e.translationX < 0 ? 1 : -1;
        dirSV.set(d);
        scheduleOnRN(beginFlip, d as 1 | -1);
      }
      if (d === 2) {
        // 넘길 아이가 없다 — 책이 손가락 쪽으로 조금만 기울다 만다
        rubber.set(Math.max(-9, Math.min(9, (e.translationX / pageW) * 14)));
        return;
      }
      if (d !== 1 && d !== -1) return;
      const prog = Math.min(1, Math.max(0, ((d === 1 ? -1 : 1) * e.translationX) / (pageW * 1.15)));
      angle.set(d === 1 ? -180 * prog : 180 * prog);
    })
    .onEnd((e) => {
      const d = dirSV.get();
      if (d === 2) {
        rubber.set(withSpring(0, { damping: 12, stiffness: 180 }));
        return;
      }
      if (d === PENDING) {
        // 움직이지 않고 끝났다
        dirSV.set(0);
        scheduleOnRN(endFlip, false);
        return;
      }
      if (d !== 1 && d !== -1) return;
      dirSV.set(0);
      const prog = Math.abs(angle.get()) / 180;
      // 넘기는 쪽 속도(+)·되돌리는 쪽 속도(-)
      const v = (d === 1 ? -1 : 1) * e.velocityX;
      const done = v < -500 ? false : prog > 0.5 || v > 500;
      const target = done ? (d === 1 ? -180 : 180) : 0;
      angle.set(
        withSpring(
          target,
          // 손을 뗀 속도를 이어받는다(px/s → °/s). 끝에서 튕겨 넘치면 종이가 뚫고 나가 보인다
          { damping: 22, stiffness: 170, velocity: (d === 1 ? -1 : 1) * (v / pageW) * 180, overshootClamping: true },
          (fin) => {
            if (fin) scheduleOnRN(endFlip, done);
          },
        ),
      );
    })
    .onFinalize((_, success) => {
      // 스크롤이 손가락을 가져가는 등 중간에 끊겼으면 원래대로
      const d = dirSV.get();
      if (!success && d === PENDING) {
        dirSV.set(0);
        scheduleOnRN(endFlip, false);
      }
      if (!success && (d === 1 || d === -1)) {
        dirSV.set(0);
        angle.set(withTiming(0, { duration: 200 }, (fin) => {
          if (fin) scheduleOnRN(endFlip, false);
        }));
      }
      if (!success && d === 2) rubber.set(withSpring(0));
    });

  /* ───── 표지 — 화면에 들어오면 한 번 열린다 ───── */
  const bookRef = useAnimatedRef<Animated.View>();
  const onOpened = () => {
    openedOnce = true;
    setOpened(true);
    haptic.medium();
  };
  const openCover = () => {
    if (openTriggered.get()) return;
    openTriggered.set(1);
    cover.set(
      withDelay(
        180,
        withTiming(1, { duration: 1050, easing: Easing.bezier(0.3, 0.9, 0.3, 1) }, (fin) => {
          if (fin) scheduleOnRN(onOpened);
        }),
      ),
    );
  };
  useAnimatedReaction(
    () => scrollY.value,
    () => {
      if (openTriggered.get() || pageW <= 0) return;
      const m = measure(bookRef);
      // 책이 화면 아래에서 절반쯤 올라왔을 때 연다
      if (m && m.pageY + m.height * 0.5 < viewportH) scheduleOnRN(openCover);
    },
    [pageW, viewportH, openCover],
  );

  /* ───── 스타일 ───── */
  const bookStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: PERSPECTIVE },
      // 닫혀 있을 땐 표지(오른쪽 면)가 가운데 오게 반 쪽 밀어 둔다
      { translateX: -(pageW / 2) * (1 - cover.value) },
      { rotateX: '6deg' },
      { rotateY: `${rubber.value}deg` },
    ],
  }));
  // 닫힌 책에는 왼쪽 면이 없다. 표지가 반 넘게 열리면 보인다
  const leftStatic = useAnimatedStyle(() => ({ opacity: cover.value > 0.5 ? 1 : 0 }));
  const coverAngle = useDerivedValue(() => -180 * cover.value);

  if (!n) return null;
  const pet = pets[curIdx];

  // 넘기는 중이면 아래 페이지를 "넘긴 뒤"로 미리 바꿔 둔다(위 설명)
  const staticLeft = flip && flip.dir === -1 ? pets[flip.to] : pets[flip ? flip.from : curIdx];
  const staticRight = flip && flip.dir === 1 ? pets[flip.to] : pets[flip ? flip.from : curIdx];
  const page = { w: pageW, h: pageH };

  return (
    <View>
      <View style={styles.head}>
        <Text style={[styles.title, { color: p.ink }]}>{pet.name} 여권</Text>
        {n > 1 ? (
          <View style={styles.nav}>
            <NavButton icon="chevron-back" label="이전 아이 여권" onPress={() => flipTo(wrap(curIdx - 1), -1)} />
            <Text style={[styles.count, { color: p.muted }]}>
              {curIdx + 1} / {n}
            </Text>
            <NavButton icon="chevron-forward" label="다음 아이 여권" onPress={() => flipTo(wrap(curIdx + 1), 1)} />
          </View>
        ) : null}
      </View>

      <GestureDetector gesture={pan}>
        <View
          style={[styles.stage, { height: pageH + 14 }]}
          onLayout={(e) => setWidth(Math.min(e.nativeEvent.layout.width, 560))}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${pet.name} 여권, ${n}마리 중 ${curIdx + 1}번째`}
          accessibilityHint={n > 1 ? '좌우로 밀어 다른 아이 여권 보기' : undefined}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'increment') flipTo(wrap(curIdx + 1), 1);
            if (e.nativeEvent.actionName === 'decrement') flipTo(wrap(curIdx - 1), -1);
          }}
          accessibilityActions={n > 1 ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}>
          {width > 0 ? (
            <Animated.View ref={bookRef} style={[{ width, height: pageH }, bookStyle]}>
              <Animated.View style={[styles.slot, { left: 0, width: pageW, height: pageH }, leftStatic]}>
                <DataPage pet={staticLeft} {...page} />
              </Animated.View>
              <View style={[styles.slot, { left: pageW, width: pageW, height: pageH }]}>
                <RecordPage pet={staticRight} index={pets.indexOf(staticRight)} {...page} shimmer={!flip && !reduce} />
              </View>

              {flip ? (
                <Leaf
                  side={flip.dir === 1 ? 'right' : 'left'}
                  angle={angle}
                  {...page}
                  front={
                    flip.dir === 1 ? (
                      <RecordPage pet={pets[flip.from]} index={flip.from} {...page} />
                    ) : (
                      <DataPage pet={pets[flip.from]} {...page} />
                    )
                  }
                  back={
                    flip.dir === 1 ? (
                      <DataPage pet={pets[flip.to]} {...page} />
                    ) : (
                      <RecordPage pet={pets[flip.to]} index={flip.to} {...page} />
                    )
                  }
                />
              ) : null}

              {!opened ? (
                <Leaf side="right" angle={coverAngle} {...page} front={<Cover {...page} />} back={<DataPage pet={pet} {...page} />} />
              ) : null}

              {/* 책 등(가운데 접힌 곳)의 그늘 */}
              <Animated.View pointerEvents="none" style={[styles.spine, { left: pageW - 10, height: pageH }, leftStatic]}>
                <LinearGradient
                  colors={['rgba(46,40,35,0)', 'rgba(46,40,35,0.22)', 'rgba(46,40,35,0)']}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>

              {!opened ? (
                <Pressable
                  onPress={openCover}
                  accessibilityRole="button"
                  accessibilityLabel={`${pet.name} 여권 펼치기`}
                  style={[styles.slot, { left: pageW, width: pageW, height: pageH }]}
                />
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>

      {n > 1 && opened ? (
        <Text style={[styles.hint, { color: p.muted }]}>여권을 좌우로 밀면 다른 아이로 넘어가요</Text>
      ) : null}
    </View>
  );
}

/**
 * 넘어가는 낱장 한 장. 등(spine) 쪽 모서리를 축으로 돈다.
 * 앞·뒷면은 각도로 갈아 끼운다(90° 넘으면 뒷면) — `backfaceVisibility`는 안드로이드에서
 * 믿기 어렵다. 넘기는 중간엔 종이에 그늘이 진다.
 */
function Leaf({
  side,
  angle,
  w,
  h,
  front,
  back,
}: {
  side: 'left' | 'right';
  angle: SharedValue<number> | DerivedValue<number>;
  w: number;
  h: number;
  front: ReactNode;
  back: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${angle.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({ opacity: Math.abs(angle.value) <= 90 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: Math.abs(angle.value) > 90 ? 1 : 0 }));
  const shade = useAnimatedStyle(() => ({ opacity: Math.sin((Math.abs(angle.value) * Math.PI) / 180) * 0.3 }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.slot,
        { left: side === 'right' ? w : 0, width: w, height: h, zIndex: 5, transformOrigin: side === 'right' ? '0% 50%' : '100% 50%' },
        style,
      ]}>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>
        {front}
        <Animated.View style={[StyleSheet.absoluteFill, styles.shade, shade]} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotateY: '180deg' }] }, backStyle]}>
        {back}
        <Animated.View style={[StyleSheet.absoluteFill, styles.shade, shade]} />
      </Animated.View>
    </Animated.View>
  );
}

function NavButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.navBtn,
        { borderColor: p.line, backgroundColor: p.card, transform: [{ scale: pressed ? 0.9 : 1 }] },
      ]}>
      <Ionicons name={icon} size={16} color={p.ink} />
    </Pressable>
  );
}

/* ───────── 표지 ───────── */

function Cover({ w, h }: { w: number; h: number }) {
  const u = w / 170;
  return (
    <View style={[styles.cover, { width: w, height: h }]}>
      <LinearGradient colors={LEATHER} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* 등 쪽이 접혀 들어간 그늘 */}
      <LinearGradient
        colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.12, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.coverFrame, { borderColor: 'rgba(230,196,127,0.4)' }]} />
      <View style={styles.coverInner}>
        <Svg width={92 * u} height={50 * u} viewBox="0 0 180 100">
          <DoodleHeadPaths kind="dog" x={0} stroke={GOLD} fill="none" />
          <DoodleHeadPaths kind="cat" x={78} stroke={GOLD} fill="none" />
        </Svg>
        <Text style={[styles.coverKo, { fontSize: 17 * u }]}>반려동물 여권</Text>
        <Text style={[styles.coverEn, { fontSize: 7.5 * u }]}>PET PASSPORT</Text>
        <Svg width={26 * u} height={18 * u} viewBox="0 0 26 18" style={{ marginTop: 10 * u }}>
          <Rect x={1} y={1} width={24} height={16} rx={2} fill="none" stroke={GOLD} strokeWidth={1.4} />
          <Circle cx={13} cy={9} r={4} fill="none" stroke={GOLD} strokeWidth={1.4} />
          <Path d="M1 9h8M17 9h8" stroke={GOLD} strokeWidth={1.4} />
        </Svg>
        <Text style={[styles.coverBrand, { fontSize: 6.5 * u }]}>BANGAPKKORI</Text>
      </View>
    </View>
  );
}

/* ───────── 왼쪽 면 — 신원 ───────── */

function DataPage({ pet, w, h }: { pet: Pet; w: number; h: number }) {
  const u = w / 170;
  const age = petAgeYears(pet.birthDate);
  const serial = String(pet.petId).padStart(6, '0');
  const issued = pet.createdAt ? pet.createdAt.slice(0, 10).replace(/-/g, '.') : '—';
  // 기계 판독 줄(MRZ). 진짜 여권의 서식을 흉내 낸 무늬라 영문·숫자만 쓴다
  const mrz1 = `P<KOR<BANGAPKKORI<<PET${serial}`.padEnd(30, '<').slice(0, 30);
  const mrz2 = `${serial}<KOR${(pet.birthDate ?? '').replace(/-/g, '').slice(2) || '<<<<<<'}${pet.gender === 'FEMALE' ? 'F' : pet.gender === 'MALE' ? 'M' : '<'}`
    .padEnd(30, '<')
    .slice(0, 30);
  return (
    <View style={[styles.page, styles.pageLeft, { width: w, height: h, padding: 11 * u }]}>
      <Guilloche />
      <LinearGradient
        colors={['rgba(58,51,42,0)', 'rgba(58,51,42,0.16)']}
        start={{ x: 0.86, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.band}>
        <Text style={[styles.bandText, { fontSize: 6.5 * u }]}>여권 PASSPORT</Text>
        <Text style={[styles.bandText, { fontSize: 6.5 * u }]}>KOR</Text>
      </View>
      <View style={[styles.row, { gap: 8 * u, marginTop: 7 * u }]}>
        <PetPhoto pet={pet} size={52 * u} />
        <View style={styles.flex}>
          <Field label="이름 Name" value={pet.name} u={u} big />
          <Field label="종류 Type" value={`${PET_KIND_LABEL[pet.kind]}${pet.species ? ` · ${pet.species}` : ''}`} u={u} />
          <Field label="크기 Size" value={`${pet.weight}kg · ${BREED_SIZE_LABEL[pet.breedSize]}`} u={u} />
        </View>
      </View>
      <View style={[styles.grid, { marginTop: 7 * u, rowGap: 5 * u }]}>
        <Field
          label="성별·나이 Sex/Age"
          value={`${pet.gender ? PET_GENDER_LABEL[pet.gender] : '—'} · ${age === null ? '—' : `${age}살`}`}
          u={u}
          half
        />
        <Field label="생일 Birth" value={pet.birthDate ? pet.birthDate.replace(/-/g, '.') : '—'} u={u} half />
        <Field label="발급 Issued" value={issued} u={u} half />
        <Field label="번호 No." value={serial} u={u} half />
      </View>
      <View style={styles.mrzBox}>
        <Text style={[styles.mrz, { fontSize: 6.4 * u }]} numberOfLines={1}>
          {mrz1}
        </Text>
        <Text style={[styles.mrz, { fontSize: 6.4 * u }]} numberOfLines={1}>
          {mrz2}
        </Text>
      </View>
    </View>
  );
}

function Field({ label, value, u, big, half }: { label: string; value: string; u: number; big?: boolean; half?: boolean }) {
  return (
    <View style={[half && styles.half, { marginBottom: big ? 3 * u : 2 * u }]}>
      <Text style={[styles.fieldLabel, { fontSize: 6.3 * u }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[big ? styles.fieldBig : styles.fieldValue, { fontSize: (big ? 16 : 9.6) * u }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const TINTS = ['#FDE3D6', '#FBEACB', '#DDF1E3', '#E5EEFB', '#F0E7FB'];

function PetPhoto({ pet, size }: { pet: Pet; size: number }) {
  const h = size * 1.22;
  return (
    <View style={[styles.photo, { width: size, height: h, backgroundColor: TINTS[pet.petId % TINTS.length] }]}>
      {pet.photoUri ? (
        <Image source={{ uri: pet.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Svg width={size * 0.96} height={size * 0.96} viewBox="0 0 100 100" style={{ marginTop: h * 0.18 }}>
          <DoodleHeadPaths kind={pet.kind === 'CAT' ? 'cat' : 'dog'} x={0} stroke={INK} fill="#FFFFFF" />
        </Svg>
      )}
    </View>
  );
}

/** 앱 아이콘의 손그림 머리 — 여권 사진 칸과 표지 문양에 쓴다 */
function DoodleHeadPaths({ kind, x, stroke, fill }: { kind: 'dog' | 'cat'; x: number; stroke: string; fill: string }) {
  const sw = 3.4;
  return kind === 'dog' ? (
    <>
      <Path transform={`translate(${x} 0)`} d="M22 52c0-20 16-31 32-30 17 1 28 14 27 30-1 17-14 27-31 27S22 70 22 52z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <Path transform={`translate(${x} 0)`} d="M31 35c-11 3-17 18-12 30 3 6 10 4 12-2" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <Circle cx={45 + x} cy={49} r={3.4} fill={stroke} />
      <Circle cx={66 + x} cy={45} r={2.8} fill={stroke} />
      <Ellipse cx={62 + x} cy={56} rx={4.8} ry={3.7} fill={stroke} />
      <Path transform={`translate(${x} 0)`} d="M43 65c7 5 17 4 24-2" fill="none" stroke={stroke} strokeWidth={3.2} strokeLinecap="round" />
    </>
  ) : (
    <>
      <Path transform={`translate(${x} 0)`} d="M24 54 27 24l15 12c6-2 14-2 20 0l15-12 3 30c3 16-9 26-28 26S21 70 24 54z" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        transform={`translate(${x} 0)`}
        d="M46 36v7M52 35v7M58 36v7M36 54l9 1.5M59 55.5l9-1.5M52 63l-3 3m3-3 3 3M24 60 13 58M24 66l-11 2M80 60l11-2M80 66l11 2"
        fill="none"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  );
}

/** 진짜 여권 배경의 기요셰(guilloche) 대신 — 동심원 몇 겹만 아주 옅게 */
function Guilloche() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" viewBox="0 0 100 140" preserveAspectRatio="none">
      {[14, 22, 30, 38, 46, 54].map((r) => (
        <Circle key={r} cx={110} cy={150} r={r * 1.6} fill="none" stroke="rgba(176,138,60,0.12)" strokeWidth={0.6} />
      ))}
      {[10, 18, 26].map((r) => (
        <Circle key={`b${r}`} cx={-10} cy={-6} r={r * 1.4} fill="none" stroke="rgba(176,138,60,0.10)" strokeWidth={0.6} />
      ))}
    </Svg>
  );
}

/* ───────── 오른쪽 면 — 여행 기록 ───────── */

function RecordPage({ pet, index, w, h, shimmer }: { pet: Pet; index: number; w: number; h: number; shimmer?: boolean }) {
  const u = w / 170;
  const { topPlacesForPet, gamification, settings, checks, stamps, satisfactions } = useAppStore();
  const serverStats = usePetStats(pet.petId);
  const footprints = serverStats?.total ?? footprintsOf(pet.petId, { checks, stamps, satisfactions }).total;
  const top = topPlacesForPet(pet.petId, 1)[0];
  const prog = gamification ? levelProgress(gamification) : null;
  const R = 22;
  const C = 2 * Math.PI * R;
  return (
    <View style={[styles.page, styles.pageRight, { width: w, height: h, padding: 11 * u }]}>
      <LinearGradient
        colors={['rgba(58,51,42,0.16)', 'rgba(58,51,42,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.14, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.band}>
        <Text style={[styles.bandText, { fontSize: 6.5 * u }]}>여행 기록 TRAVEL</Text>
        <Text style={[styles.bandText, { fontSize: 6.5 * u }]}>{String(index * 2 + 2).padStart(2, '0')}</Text>
      </View>

      <View style={[styles.row, { gap: 8 * u, marginTop: 8 * u, alignItems: 'center' }]}>
        <Svg width={54 * u} height={54 * u} viewBox="0 0 54 54">
          <Circle cx={27} cy={27} r={R} fill="none" stroke={PAPER_DEEP} strokeWidth={5} />
          {prog ? (
            <Circle
              cx={27}
              cy={27}
              r={R}
              fill="none"
              stroke="#DB7850"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={`${C} ${C}`}
              strokeDashoffset={C * (1 - prog.ratio)}
              transform="rotate(-90 27 27)"
            />
          ) : null}
          <SvgText x={27} y={31} fontSize={11} fontWeight="800" fill={INK} textAnchor="middle">
            {prog ? `Lv.${prog.level}` : '—'}
          </SvgText>
        </Svg>
        <View style={styles.flex}>
          <Text style={[styles.fieldLabel, { fontSize: 6.3 * u }]}>보호자 레벨 Level</Text>
          <Text style={[styles.fieldValue, { fontSize: 9.6 * u }]} numberOfLines={2}>
            {gamification ? tierName(gamification, settings.pawAnimal || gamification.tierAnimal).replace(/^.* 발바닥 /, '발바닥 ') : '기록 전'}
          </Text>
          {prog && !prog.maxed ? (
            <Text style={[styles.fieldLabel, { fontSize: 6.3 * u, marginTop: 1 }]}>다음까지 {prog.remain} XP</Text>
          ) : null}
        </View>
      </View>

      <View style={[styles.dash, { marginTop: 8 * u, paddingTop: 6 * u }]}>
        <Text style={[styles.fieldLabel, { fontSize: 6.3 * u }]}>함께한 발자국 Footprints</Text>
        <Text style={[styles.fieldBig, { fontSize: 15 * u }]}>
          {footprints}
          <Text style={{ fontSize: 9 * u, fontWeight: '700' }}> 개</Text>
        </Text>
      </View>
      <View style={[styles.dash, { marginTop: 6 * u, paddingTop: 6 * u, paddingRight: 44 * u }]}>
        <Text style={[styles.fieldLabel, { fontSize: 6.3 * u }]}>가장 좋아한 곳 Favorite</Text>
        <Text style={[styles.fieldValue, { fontSize: 9.6 * u }]} numberOfLines={2}>
          {top ? top.facility.name : '아직 기록이 없어요'}
        </Text>
        {top ? <Text style={[styles.score, { fontSize: 8.5 * u }]}>만족 {top.score.toFixed(1)}</Text> : null}
      </View>

      <HoloSeal size={42 * u} shimmer={!!shimmer} />
    </View>
  );
}

/** 홀로그램 씰 — 무지갯빛 위로 빛줄기가 천천히 지나간다(넘기는 중엔 멈춤) */
function HoloSeal({ size, shimmer }: { size: number; shimmer: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!shimmer) return;
    t.set(withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, false));
  }, [shimmer, t]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -size + t.value * size * 2 }, { rotate: '20deg' }] }));
  return (
    <View style={[styles.holo, { width: size, height: size, borderRadius: size / 2, right: 9, bottom: 12 }]}>
      <LinearGradient
        colors={['#FFB3D9', '#FFE3A3', '#B9F3D0', '#A8DCFF', '#D9B8FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.holoSweep, { height: size * 1.6, top: -size * 0.3 }, sweep]} />
      <Text style={[styles.holoText, { fontSize: Math.max(5.5, size * 0.15) }]}>반갑꼬리{'\n'}인증</Text>
    </View>
  );
}

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' });

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  title: { fontSize: Type.sectionTitle - 2, fontWeight: '800', letterSpacing: -0.4 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: Type.footnote, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hint: { fontSize: Type.caption, textAlign: 'center', marginTop: 4 },
  stage: { marginTop: 10, alignItems: 'center', justifyContent: 'flex-start' },
  slot: { position: 'absolute', top: 0 },
  shade: { backgroundColor: '#1E140D' },
  spine: { position: 'absolute', top: 0, width: 20 },
  page: { backgroundColor: PAPER, overflow: 'hidden' },
  pageLeft: { borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  pageRight: { borderTopRightRadius: 12, borderBottomRightRadius: 12, borderTopLeftRadius: 2, borderBottomLeftRadius: 2 },
  cover: {
    overflow: 'hidden',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
  },
  coverFrame: { position: 'absolute', top: 8, bottom: 8, left: 10, right: 8, borderWidth: 1, borderRadius: 6 },
  coverInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverKo: { fontFamily: LevelUpFonts.ko, color: GOLD, letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 },
  coverEn: { color: GOLD, fontWeight: '800', letterSpacing: 2.6 },
  coverBrand: { color: GOLD, fontWeight: '800', letterSpacing: 2.2, opacity: 0.8 },
  band: { flexDirection: 'row', justifyContent: 'space-between' },
  bandText: { color: SUB, fontWeight: '800', letterSpacing: 1.2 },
  row: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 6 },
  half: { width: '47%' },
  photo: { borderRadius: 6, borderWidth: 1, borderColor: LINE, alignItems: 'center', overflow: 'hidden' },
  fieldLabel: { color: SUB, fontWeight: '600', letterSpacing: 0.2 },
  fieldValue: { color: INK, fontWeight: '700' },
  fieldBig: { color: INK, fontWeight: '800', letterSpacing: -0.4 },
  mrzBox: { marginTop: 'auto', opacity: 0.72 },
  mrz: { fontFamily: MONO, color: '#5A5044', letterSpacing: 0.3 },
  dash: { borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: LINE },
  score: { color: '#BC5F38', fontWeight: '800', marginTop: 1 },
  holo: { position: 'absolute', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
  holoSweep: { position: 'absolute', width: 14, backgroundColor: 'rgba(255,255,255,0.55)' },
  holoText: { color: 'rgba(70,40,60,0.72)', fontWeight: '900', textAlign: 'center' },
});
