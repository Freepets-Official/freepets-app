import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { PawBurst } from '@/components/paw-burst';
import { Text } from '@/components/text';
import { CompanionColors, LevelUpFonts } from '@/constants/theme';
import type { Mood, Speaker, WeatherProp } from '@/data/companion';
import { haptic } from '@/lib/haptics';
import { useColorScheme, usePalette } from '@/hooks/use-theme';

/**
 * 홈의 「꼬리 친구」 — 앱 아이콘의 손그림 강아지와 고양이.
 *
 * 아이콘의 **하찮은 낙서 느낌을 지킨다.** 선은 굵기가 고르지 않고 조금씩 떨리며(손그림 떨림),
 * 귀여움은 볼터치·눈 하이라이트·표정으로 더한다. 정교하게 다듬으면 아이콘과 다른 캐릭터가 된다.
 *
 * 구조: 같은 viewBox(270×172)를 쓰는 SVG 층을 겹친다. 움직이는 부위(꼬리·머리·귀·눈·코)는
 * 층마다 `transformOrigin`을 그 부위의 관절에 두고 Reanimated로 돌린다 — 모든 동작이 UI
 * 스레드에서 돌아 JS가 바빠도 끊기지 않는다. 표정 바꾸기(눈 모양 교체)만 React 상태다.
 *
 * 손그림 떨림은 SVG 필터가 네이티브에 없어서, 숫자를 조금씩 흔든 윤곽 3벌을 8fps로 갈아 끼운다.
 */
const VB_W = 270;
const VB_H = 172;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/* ───────── 그림 ───────── */
const D = {
  dogTail: 'M63 132 C48 129 41 117 44 106',
  dogBody: 'M65 112 C59 128 61 148 65 158 L79 158 L81 147 L99 147 L101 158 L115 158 C119 144 119 127 113 112',
  dogToes: 'M70 158 l0 -4 M74 158 l0 -4 M106 158 l0 -4 M110 158 l0 -4',
  dogScarf: 'M64 108 C78 117 100 117 116 108 L117 117 C100 126 78 126 63 117 Z M101 118 L106 136 L97 137 L94 120',
  dogEarR: 'M120 50 C130 45 139 55 135 68 C133 73 128 72 126 68',
  dogHead: 'M48 80 C46 51 68 34 93 35 C118 36 134 53 133 78 C132 103 114 115 91 115 C66 115 49 106 48 80 Z',
  dogEarL: 'M60 54 C43 56 35 77 38 96 C40 106 53 105 58 94 C61 86 60 70 64 60',
  dogBrow: 'M70 66 l9 -3 M106 59 l8 2',
  dogHappy: 'M72 77 q6 -7 12 0 M106 71 q5 -6 10 0',
  dogMouth: 'M76 97 C86 104 104 103 114 94',
  dogTongue: 'M95 100 q2 11 10 3 l-1 -5 z',
  maskCloth: 'M84 80 C96 74 114 75 124 81 L121 96 C109 102 95 102 86 96 Z',
  maskStrings: 'M84 82 L62 77 M86 94 L64 98 M124 82 L132 74',
  maskPleats: 'M90 86 L118 86 M91 91 L117 91',
  catTail: 'M209 140 C226 140 235 127 229 114',
  catBody: 'M163 112 C159 126 159 148 163 158 L176 158 L178 147 L194 147 L196 158 L209 158 C213 144 213 126 207 112',
  catToes: 'M167 158 l0 -4 M171 158 l0 -4 M201 158 l0 -4 M205 158 l0 -4',
  catHead: 'M150 74 L154 42 L172 58 C180 56 191 56 199 58 L217 44 L219 74 C223 91 214 113 184 115 C156 117 145 98 150 74 Z',
  catStripes: 'M177 61 L177 68 M184 60 L184 67 M191 61 L191 68',
  catSleepy: 'M162 82 L174 84 M194 84 L206 82',
  catHappy: 'M162 84 q6 -7 12 0 M194 84 q6 -7 12 0',
  catMouth: 'M184 92 l-3.4 3.4 M184 92 l3.4 3.4',
  catWhiskers: 'M152 88 L138 86 M152 95 L138 97 M217 88 L231 86 M217 95 L231 97',
  umbrella: 'M54 36 C62 10 120 6 132 34 C124 30 117 31 112 36 C106 30 99 30 93 36 C87 30 80 30 74 36 C68 30 60 31 54 36 Z',
  umbrellaHandle: 'M93 36 L93 58 q0 6 -6 5',
  sparkle: 'M0 -7 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z',
  drop: 'M0 0 q5 7 0 10 q-5 -3 0 -10 z',
};

/** 손그림 떨림용 — 경로의 숫자를 조금씩 흔든다. 같은 seed면 같은 결과 */
function jitter(d: string, seed: number, amp = 0.75): string {
  if (seed === 0) return d;
  let i = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, (m) => {
    i += 1;
    const r = Math.sin(seed * 97.13 + i * 12.9898) * 43758.5453;
    return (parseFloat(m) + (r - Math.floor(r) - 0.5) * 2 * amp).toFixed(1);
  });
}

/** viewBox 좌표 → 층의 `transformOrigin`(%) */
const origin = (x: number, y: number) => `${((x / VB_W) * 100).toFixed(2)}% ${((y / VB_H) * 100).toFixed(2)}%`;
const at = (x: number, y: number) => ({ left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` }) as const;

function Layer({
  pivot,
  style,
  children,
}: {
  pivot?: [number, number];
  style?: object;
  children: ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, pivot && { transformOrigin: origin(pivot[0], pivot[1]) }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

/** 떨리는 윤곽 한 벌 — frame이 자기 차례일 때만 보인다 */
function BoilCopy({ frame, index, children }: { frame: SharedValue<number>; index: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.floor(frame.value) % 3 === index ? 1 : 0 }));
  return <Layer style={style}>{children}</Layer>;
}

/**
 * Android는 Svg 하나마다 화면 크기 비트맵을 따로 잡아(react-native-svg `SvgView`) 떨림용
 * 복사본 3벌이 메모리를 크게 먹는다(층마다 ~1.8MB). Android에서는 떨림 없이 한 벌만 그린다.
 */
const BOIL_COPIES = Platform.OS === 'android' ? [0] : [0, 1, 2];

function Boiled({
  frame,
  render,
}: {
  frame: SharedValue<number>;
  render: (j: (d: string) => string) => ReactNode;
}) {
  if (BOIL_COPIES.length === 1) return <Layer>{render((d) => d)}</Layer>;
  return (
    <>
      {BOIL_COPIES.map((i) => (
        <BoilCopy key={i} frame={frame} index={i}>
          {render((d) => jitter(d, i))}
        </BoilCopy>
      ))}
    </>
  );
}

/* ───────── 동작 ───────── */

type DogFace = 'open' | 'happy';
type CatFace = 'sleepy' | 'open' | 'happy' | 'yawn';

export interface MascotProps {
  width: number;
  /** 지금 말하는 쪽 — 그쪽이 표정을 짓고, 다른 쪽은 제 할 일(고양이는 졸기)을 한다 */
  speaker: Speaker;
  mood: Mood;
  props?: WeatherProp[];
  /** 바뀔 때마다 말하는 쪽이 한 번 깡충 뛴다(새 소식 신호) */
  cue: string;
  /** 화면이 안 보이면 반복 동작을 멈춘다 — 배터리 */
  active: boolean;
}

export function CompanionMascot({ width, speaker, mood, props = [], cue, active }: MascotProps) {
  const p = usePalette();
  const scheme = useColorScheme();
  const cc = CompanionColors[scheme === 'dark' ? 'dark' : 'light'];
  const reduce = useReducedMotion();
  const height = (width * VB_H) / VB_W;
  const moving = active && !reduce;

  const ink = cc.ink;
  const fill = cc.fill;
  const line = { stroke: ink, strokeWidth: 3.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  /* 표정 — 말하는 쪽의 기분에서 정해지고, 쓰다듬기·하품이 잠깐 덮어쓴다 */
  const baseDog: DogFace = speaker === 'dog' && mood === 'happy' ? 'happy' : 'open';
  const baseCat: CatFace = speaker === 'cat' ? (mood === 'happy' ? 'happy' : 'open') : 'sleepy';
  const [override, setOverride] = useState<{ dog?: DogFace; cat?: CatFace } | null>(null);
  const dogFace = override?.dog ?? baseDog;
  const catFace = override?.cat ?? baseCat;
  const showBrow = speaker === 'dog' && mood === 'worried';
  const showBang = mood === 'alert';
  const showSweat = mood === 'worried';
  const showZz = speaker === 'dog' && catFace === 'sleepy';
  const has = (k: WeatherProp) => props.includes(k);

  /* 공유 값 */
  const frame = useSharedValue(0);
  const breathe = useSharedValue(0);
  const dogTail = useSharedValue(0);
  const catTail = useSharedValue(0);
  const dogHop = useSharedValue(0);
  const catHop = useSharedValue(0);
  const catWiggle = useSharedValue(0);
  const catCurl = useSharedValue(0);
  const dogHead = useSharedValue(0);
  const catHead = useSharedValue(0);
  const dogEar = useSharedValue(0);
  const nose = useSharedValue(1);
  const blink = useSharedValue(1);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const touching = useSharedValue(0);

  // 손그림 떨림·숨쉬기·꼬리 — 계속 도는 것들
  const wagFast = speaker === 'dog' && (mood === 'happy' || override?.dog === 'happy');
  useEffect(() => {
    if (!moving) {
      [frame, breathe, dogTail, catTail].forEach((v) => cancelAnimation(v));
      frame.set(0);
      breathe.set(0);
      dogTail.set(0);
      catTail.set(0);
      return;
    }
    frame.set(0);
    if (BOIL_COPIES.length > 1) frame.set(withRepeat(withTiming(3, { duration: 375, easing: Easing.linear }), -1, false));
    breathe.set(withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true));
    const half = wagFast ? 170 : 340;
    dogTail.set(withRepeat(
      withSequence(withTiming(17, { duration: half }), withTiming(-15, { duration: half })),
      -1,
      false,
    ));
    catTail.set(withRepeat(
      withSequence(
        withTiming(10, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(-8, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    ));
    return () => [frame, breathe, dogTail, catTail].forEach((v) => cancelAnimation(v));
  }, [moving, wagFast, frame, breathe, dogTail, catTail]);

  // 새 소식 — 말하는 쪽이 깡충, 귀를 쫑긋(놀람)
  useEffect(() => {
    if (!moving) return;
    const hop = speaker === 'dog' ? dogHop : catHop;
    hop.set(0);
    hop.set(withTiming(1, { duration: 500, easing: Easing.linear }));
    dogEar.set(withTiming(speaker === 'dog' && mood === 'alert' ? 18 : 0, { duration: 260, easing: EASE_OUT }));
  }, [cue, moving, speaker, mood, dogHop, catHop, dogEar]);

  // 눈 깜빡임
  useEffect(() => {
    if (!moving) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        blink.set(withSequence(withTiming(0.1, { duration: 60 }), withTiming(1, { duration: 80 })));
        loop();
      }, 2400 + Math.random() * 2600);
    };
    loop();
    return () => clearTimeout(t);
  }, [moving, blink]);

  // 혼자 노는 동작 — 몇 초마다 하나
  const faceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashFace = (o: { dog?: DogFace; cat?: CatFace }, ms: number) => {
    if (faceTimer.current) clearTimeout(faceTimer.current);
    setOverride(o);
    faceTimer.current = setTimeout(() => setOverride(null), ms);
  };
  useEffect(() => () => {
    if (faceTimer.current) clearTimeout(faceTimer.current);
  }, []);
  const catSleeping = catFace === 'sleepy';
  useEffect(() => {
    if (!moving) return;
    let t: ReturnType<typeof setTimeout>;
    const actions: (() => void)[] = [
      // 고개 갸웃
      () => {
        dogHead.set(withSequence(
          withTiming(-9, { duration: 420, easing: EASE_OUT }),
          withDelay(600, withTiming(0, { duration: 420, easing: EASE_OUT })),
        ));
      },
      // 귀 펄럭
      () => {
        dogEar.set(withSequence(
          withTiming(16, { duration: 170 }),
          withTiming(-6, { duration: 170 }),
          withTiming(0, { duration: 200 }),
        ));
      },
      // 코 킁킁
      () => {
        nose.set(withRepeat(withSequence(withTiming(1.18, { duration: 90 }), withTiming(1, { duration: 90 })), 3));
      },
      // 서로 쳐다보기
      () => {
        if (touching.get()) return;
        gx.set(withSequence(withTiming(3, { duration: 200 }), withDelay(1100, withTiming(0, { duration: 260 }))));
        catHead.set(withSequence(withTiming(7, { duration: 380 }), withDelay(900, withTiming(0, { duration: 380 }))));
      },
      // 고양이 꼬리 말기
      () => {
        catCurl.set(withRepeat(withSequence(withTiming(1, { duration: 240 }), withTiming(0, { duration: 240 })), 3));
      },
      // 위를 올려다보기
      () => {
        dogHead.set(withSequence(withTiming(5, { duration: 380 }), withDelay(500, withTiming(0, { duration: 380 }))));
      },
    ];
    // 고양이 하품은 졸고 있을 때만 — 말하는 중에 하품하면 이상하다
    if (catSleeping) actions.push(() => flashFace({ cat: 'yawn' }, 1300));
    const loop = () => {
      t = setTimeout(() => {
        actions[Math.floor(Math.random() * actions.length)]();
        loop();
      }, 3200 + Math.random() * 2800);
    };
    loop();
    return () => clearTimeout(t);
  }, [moving, catSleeping, dogHead, dogEar, nose, gx, catHead, catCurl, touching]);

  /* 스타일 */
  const breatheDog = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + breathe.value * 0.012 }, { scaleY: 1 + breathe.value * 0.022 }] }));
  const breatheCat = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + (1 - breathe.value) * 0.012 }, { scaleY: 1 + (1 - breathe.value) * 0.022 }] }));
  const dogHopStyle = useHopStyle(dogHop);
  const catHopStyle = useHopStyle(catHop, catWiggle);
  const dogTailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${dogTail.value}deg` }] }));
  const catTailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${catTail.value + catCurl.value * 22}deg` }] }));
  const dogHeadStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${dogHead.value}deg` }] }));
  const catHeadStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${catHead.value}deg` }] }));
  const dogEarStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${dogEar.value}deg` }] }));
  const noseStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: nose.value }, { scaleY: 2 - nose.value }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.value }] }));
  // 시선은 한 칸(viewBox 1)이 화면에서 width/270px이라 그 비율로 옮긴다
  const k = width / VB_W;
  const pupilStyle = useAnimatedStyle(() => ({ transform: [{ translateX: gx.value * k }, { translateY: gy.value * k }] }));

  /* 손대기 — 누르면 강아지는 깡충, 고양이는 고개를 돌린다. 꾹 누르면 둘 다 눈웃음 */
  const [say, setSay] = useState<{ text: string; who: Speaker; key: number } | null>(null);
  const [burst, setBurst] = useState<{ kind: 'paw' | 'heart'; who: Speaker; key: number } | null>(null);
  const sayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (sayTimer.current) clearTimeout(sayTimer.current);
  }, []);
  const speak = (text: string, who: Speaker) => {
    if (sayTimer.current) clearTimeout(sayTimer.current);
    setSay({ text, who, key: Date.now() });
    sayTimer.current = setTimeout(() => setSay(null), 900);
  };
  const tapDog = () => {
    haptic.light();
    speak('멍!', 'dog');
    if (reduce) return;
    dogHop.set(0);
    dogHop.set(withTiming(1, { duration: 500, easing: Easing.linear }));
    setBurst({ kind: 'paw', who: 'dog', key: Date.now() });
  };
  const tapCat = () => {
    haptic.light();
    speak('…냥', 'cat');
    if (reduce) return;
    catWiggle.set(withSequence(withTiming(1, { duration: 500, easing: EASE_OUT }), withTiming(0, { duration: 0 })));
    catHead.set(withSequence(withTiming(-6, { duration: 200 }), withDelay(600, withTiming(0, { duration: 300 }))));
  };
  const love = (who: Speaker) => {
    haptic.medium();
    flashFace({ dog: 'happy', cat: 'happy' }, 1500);
    if (!reduce) setBurst({ kind: 'heart', who, key: Date.now() });
  };

  // 손가락·마우스 쪽으로 눈동자를 돌린다
  const onPoint = (x: number, y: number) => {
    const vx = (x / width) * VB_W - 95;
    const vy = (y / height) * VB_H - 73;
    const d = Math.hypot(vx, vy) || 1;
    const m = Math.min(3, d / 26);
    touching.set(1);
    gx.set(withTiming((vx / d) * m, { duration: 140 }));
    gy.set(withTiming(Math.max(-2.4, Math.min(2.4, (vy / d) * m)), { duration: 140 }));
  };
  const release = () => {
    touching.set(0);
    gx.set(withTiming(0, { duration: 260 }));
    gy.set(withTiming(0, { duration: 260 }));
  };

  const sayPos = say?.who === 'cat' ? at(196, 6) : at(84, 2);
  const burstPos = burst?.who === 'cat' ? at(184, 34) : at(90, 26);
  const pupils = useMemo(
    () => (
      <>
        <Circle cx={78} cy={76} r={4.6} fill={ink} />
        <Circle cx={76.6} cy={74.4} r={1.4} fill="#FFFFFF" />
        <Circle cx={111} cy={70} r={3.9} fill={ink} />
        <Circle cx={109.8} cy={68.6} r={1.2} fill="#FFFFFF" />
      </>
    ),
    [ink],
  );

  return (
    <View
      style={{ width, height }}
      // 웹(마우스)과 네이티브(손가락) 모두에서 시선을 따라오게 한다. 응답자를 가로채지 않아
      // 아래의 누르기 영역과 스크롤을 막지 않는다
      onPointerMove={(e) => onPoint(e.nativeEvent.offsetX ?? 0, e.nativeEvent.offsetY ?? 0)}
      onPointerLeave={release}
      onTouchMove={(e: GestureResponderEvent) => onPoint(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onTouchEnd={release}
      // 마스코트 위에서 시작해 스크롤로 넘어가면 End가 아니라 Cancel이 온다
      onTouchCancel={release}>
      {moving && Platform.OS !== 'web' ? <TiltGaze gx={gx} gy={gy} touching={touching} /> : null}

      {has('rain') && moving ? <Rain color={cc.rain} width={width} height={height} /> : null}

      <Layer>
        <Ellipse cx={136} cy={163} rx={104} ry={6} fill={cc.shadow} />
      </Layer>

      {/* 발자국·하트는 그림 뒤에서 튀어나온다 — 앞에 그리면 얼굴에 얼룩처럼 묻는다 */}
      {burst ? (
        <View key={`burst-${burst.key}`} style={[styles.abs, styles.burst, burstPos]} pointerEvents="none">
          {burst.kind === 'paw' ? <PawBurst color={p.accent} size={16} /> : <HeartBurst color={p.accent} />}
        </View>
      ) : null}

      {/* ── 강아지 ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(90, 158) }, dogHopStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(90, 158) }, breatheDog]}>
          <Layer pivot={[63, 132]} style={dogTailStyle}>
            <Path d={D.dogTail} fill="none" {...line} />
          </Layer>
          <Boiled
            frame={frame}
            render={(j) => (
              <>
                <Path d={j(D.dogBody)} fill={fill} {...line} />
                <Path d={D.dogToes} fill="none" {...line} strokeWidth={2} />
              </>
            )}
          />
          {has('scarf') ? (
            <Layer>
              <Path d={D.dogScarf} fill={cc.scarf} {...line} />
            </Layer>
          ) : null}
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(90, 112) }, dogHeadStyle]}>
            <Boiled
              frame={frame}
              render={(j) => (
                <>
                  <Path d={j(D.dogEarR)} fill={fill} {...line} />
                  <Path d={j(D.dogHead)} fill={fill} {...line} />
                </>
              )}
            />
            <Layer pivot={[62, 56]} style={dogEarStyle}>
              <Path d={D.dogEarL} fill={fill} {...line} />
            </Layer>
            <Layer>
              <Ellipse cx={69} cy={92} rx={7} ry={4} fill={cc.blush} />
              <Ellipse cx={119} cy={86} rx={5.5} ry={3.4} fill={cc.blush} />
              {showBrow ? <Path d={D.dogBrow} fill="none" {...line} strokeWidth={2.6} /> : null}
              {dogFace === 'happy' ? <Path d={D.dogHappy} fill="none" {...line} /> : null}
              <Path d={D.dogMouth} fill="none" {...line} />
              {dogFace === 'happy' ? <Path d={D.dogTongue} fill={cc.tongue} {...line} strokeWidth={2.4} /> : null}
            </Layer>
            {dogFace === 'open' ? (
              <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(94, 73) }, eyesStyle]} pointerEvents="none">
                <Layer style={pupilStyle}>{pupils}</Layer>
              </Animated.View>
            ) : null}
            <Layer pivot={[101, 83]} style={noseStyle}>
              <Ellipse cx={101} cy={83} rx={6} ry={4.6} fill={ink} />
            </Layer>
            {has('mask') ? (
              <Layer>
                <Path d={D.maskCloth} fill={fill} {...line} />
                <Path d={D.maskStrings} fill="none" {...line} strokeWidth={2} />
                <Path d={D.maskPleats} fill="none" {...line} strokeWidth={1.6} opacity={0.6} />
              </Layer>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* ── 고양이 ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(186, 158) }, catHopStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(186, 158) }, breatheCat]}>
          <Layer pivot={[209, 140]} style={catTailStyle}>
            <Path d={D.catTail} fill="none" {...line} />
          </Layer>
          <Boiled
            frame={frame}
            render={(j) => (
              <>
                <Path d={j(D.catBody)} fill={fill} {...line} />
                <Path d={D.catToes} fill="none" {...line} strokeWidth={2} />
              </>
            )}
          />
          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(184, 113) }, catHeadStyle]}>
            <Boiled frame={frame} render={(j) => <Path d={j(D.catHead)} fill={fill} {...line} />} />
            <Layer>
              <Path d={D.catStripes} fill="none" {...line} strokeWidth={2.6} />
              <Ellipse cx={163} cy={96} rx={6} ry={3.6} fill={cc.blush} />
              <Ellipse cx={206} cy={96} rx={6} ry={3.6} fill={cc.blush} />
              {catFace === 'sleepy' ? <Path d={D.catSleepy} fill="none" {...line} /> : null}
              {catFace === 'happy' || catFace === 'yawn' ? <Path d={D.catHappy} fill="none" {...line} /> : null}
              <Path d={D.catMouth} fill="none" {...line} />
              {catFace === 'yawn' ? <Ellipse cx={184} cy={101} rx={4.6} ry={5.6} fill={cc.tongue} {...line} /> : null}
              <Path d={D.catWhiskers} fill="none" {...line} strokeWidth={2.4} />
            </Layer>
            {catFace === 'open' ? (
              <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(184, 82) }, eyesStyle]} pointerEvents="none">
                <Layer style={pupilStyle}>
                  <Circle cx={168} cy={82} r={4.2} fill={ink} />
                  <Circle cx={166.8} cy={80.6} r={1.3} fill="#FFFFFF" />
                  <Circle cx={200} cy={82} r={4.2} fill={ink} />
                  <Circle cx={198.8} cy={80.6} r={1.3} fill="#FFFFFF" />
                </Layer>
              </Animated.View>
            ) : null}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {/* ── 날씨 소품 · 효과 ── */}
      {has('umbrella') ? (
        <Layer>
          <Path d={D.umbrella} fill={cc.umbrella} {...line} />
          <Path d={D.umbrellaHandle} fill="none" {...line} strokeWidth={2.6} />
        </Layer>
      ) : null}
      {has('sparkles') ? <Sparkles color={cc.sun} moving={moving} /> : null}
      {has('heat') ? <Sweat x={40} y={52} color={cc.rain} moving={moving} /> : null}
      {showSweat ? <Sweat x={speaker === 'cat' ? 224 : 138} y={44} color={cc.rain} moving={moving} /> : null}
      {showZz ? <Zz color={p.muted} moving={moving} /> : null}
      {showBang ? (
        <Animated.View key={cue} entering={moving ? FadeIn.duration(200) : undefined} style={[styles.abs, at(speaker === 'cat' ? 214 : 128, 6)]} pointerEvents="none">
          <Text style={[styles.bang, { color: p.danger }]}>!</Text>
        </Animated.View>
      ) : null}

      {/* 누르기 영역 — 그림 위에 투명하게 */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="강아지 쓰다듬기"
        onPress={tapDog}
        onLongPress={() => love('dog')}
        delayLongPress={450}
        style={[styles.abs, { left: '13%', top: '14%', width: '39%', height: '84%' }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="고양이 쓰다듬기"
        onPress={tapCat}
        onLongPress={() => love('cat')}
        delayLongPress={450}
        style={[styles.abs, { left: '53%', top: '20%', width: '36%', height: '78%' }]}
      />

      {say ? (
        <Animated.View
          key={`say-${say.key}`}
          // 사라질 때는 그냥 뺀다 — 웹에서 퇴장 애니메이션이 가끔 멈춰 글자가 남았다
          entering={reduce ? undefined : FadeIn.duration(120)}
          style={[styles.abs, sayPos]}
          pointerEvents="none">
          <Text style={[styles.say, { color: p.ink }]}>{say.text}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * 깡충 — 0→1 한 번에 찌그러짐 → 뜀 → 착지 → 원위치를 그린다. 소식 하나에 한 번이지
 * 제자리 반복이 아니다(가만히 통통 튀는 건 산만하다). `wiggle`은 고양이가 몸을 트는 양.
 */
function useHopStyle(h: SharedValue<number>, wiggle?: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const t = h.value;
    const y = t < 0.18 ? 0 : t < 0.48 ? -16 * ((t - 0.18) / 0.3) : t < 0.78 ? -16 * (1 - (t - 0.48) / 0.3) : 0;
    const sx =
      t < 0.18
        ? 1 + 0.07 * (t / 0.18)
        : t < 0.48
          ? 1.07 - 0.1 * ((t - 0.18) / 0.3)
          : t < 0.78
            ? 0.97 + 0.07 * ((t - 0.48) / 0.3)
            : 1.04 - 0.04 * ((t - 0.78) / 0.22);
    const done = t === 0 || t === 1;
    return {
      transform: [
        { translateY: done ? 0 : y },
        { scaleX: done ? 1 : sx },
        { scaleY: done ? 1 : 2 - sx },
        { rotate: `${wiggle ? Math.sin(wiggle.value * Math.PI * 2) * 4 : 0}deg` },
      ],
    };
  });
}

/** 기기를 기울이면 눈동자가 굴러간다(네이티브 전용). 손가락이 닿아 있으면 손가락이 이긴다 */
function TiltGaze({ gx, gy, touching }: { gx: SharedValue<number>; gy: SharedValue<number>; touching: SharedValue<number> }) {
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: 60 });
  const base = useSharedValue<{ x: number; y: number } | null>(null);
  useAnimatedReaction(
    () => sensor.sensor.value,
    (v) => {
      if (touching.get()) return;
      // 처음 잡은 기울기를 기준으로 삼는다 — 사람마다 폰을 드는 각도가 달라 절대값을 쓰면
      // 어떤 사람에게는 눈이 늘 한쪽에 몰려 있다
      // 센서의 첫 값은 아직 측정 전의 0이다. 그걸 기준으로 잡으면 폰을 세워 든 것만으로
      // 눈동자가 끝까지 몰린다 — 진짜 값이 들어올 때까지 건너뛴다
      if (v.x === 0 && v.y === 0 && v.z === 0) return;
      const b = base.get() ?? { x: v.x, y: v.y };
      if (!base.get()) base.set(b);
      gx.set(Math.max(-3, Math.min(3, (v.x - b.x) * 0.9)));
      gy.set(Math.max(-2.4, Math.min(2.4, -(v.y - b.y) * 0.7)));
    },
  );
  return null;
}

function Rain({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <>
      {[0.08, 0.2, 0.33, 0.47, 0.6, 0.72, 0.84, 0.94].map((x, i) => (
        <Drop key={i} x={x * width} height={height} delay={(i * 137) % 900} color={color} />
      ))}
    </>
  );
}

function Drop({ x, height, delay, color }: { x: number; height: number; delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false)));
    return () => cancelAnimation(t);
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : 1 - t.value,
    transform: [{ translateY: -20 + t.value * (height + 10) }, { translateX: 4 - t.value * 8 }, { rotate: '12deg' }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.drop, { left: x, backgroundColor: color }, style]} />;
}

function Sparkles({ color, moving }: { color: string; moving: boolean }) {
  return (
    <>
      {[
        [30, 40, 0],
        [246, 28, 600],
        [140, 14, 1200],
      ].map(([x, y, d]) => (
        <Twinkle key={x} x={x} y={y} delay={d} color={color} moving={moving} />
      ))}
    </>
  );
}

function Twinkle({ x, y, delay, color, moving }: { x: number; y: number; delay: number; color: string; moving: boolean }) {
  const t = useSharedValue(moving ? 0 : 1);
  useEffect(() => {
    if (!moving) {
      t.set(1);
      return;
    }
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true)));
    return () => cancelAnimation(t);
  }, [t, delay, moving]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.4 + t.value * 0.6 }] }));
  return (
    <Layer pivot={[x, y]} style={style}>
      <Path d={D.sparkle} transform={`translate(${x} ${y})`} fill={color} />
    </Layer>
  );
}

function Sweat({ x, y, color, moving }: { x: number; y: number; color: string; moving: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!moving) return;
    t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.in(Easing.quad) }), -1, false));
    return () => cancelAnimation(t);
  }, [t, moving]);
  const style = useAnimatedStyle(() => ({
    opacity: moving ? (t.value < 0.2 ? t.value / 0.2 : 1 - t.value) : 1,
    transform: [{ translateY: -3 + t.value * 13 }],
  }));
  return (
    <Layer style={style}>
      <Path d={D.drop} transform={`translate(${x} ${y})`} fill={color} />
    </Layer>
  );
}

function Zz({ color, moving }: { color: string; moving: boolean }) {
  return (
    <>
      <ZLetter x={222} y={40} size={15} delay={0} color={color} moving={moving} />
      <ZLetter x={232} y={28} size={12} delay={1200} color={color} moving={moving} />
    </>
  );
}

function ZLetter({ x, y, size, delay, color, moving }: { x: number; y: number; size: number; delay: number; color: string; moving: boolean }) {
  const t = useSharedValue(moving ? 0 : 0.5);
  useEffect(() => {
    if (!moving) return;
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, false)));
    return () => cancelAnimation(t);
  }, [t, delay, moving]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.3 ? t.value / 0.3 : 1 - (t.value - 0.3) / 0.7,
    transform: [{ translateX: t.value * 10 }, { translateY: -t.value * 22 }, { scale: 0.7 + t.value * 0.4 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, at(x, y), style]}>
      <Text style={{ fontFamily: LevelUpFonts.ko, fontSize: size, color }}>z</Text>
    </Animated.View>
  );
}

function HeartBurst({ color }: { color: string }) {
  return (
    <>
      {[-2, -1, 0, 1, 2].map((i) => (
        <Heart key={i} index={i} color={color} />
      ))}
    </>
  );
}

function Heart({ index, color }: { index: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(Math.abs(index) * 60, withTiming(1, { duration: 900, easing: EASE_OUT })));
  }, [t, index]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: index * 16 * t.value }, { translateY: -54 * t.value }, { scale: 0.5 + t.value * 0.6 }],
  }));
  return (
    <Animated.View style={[styles.heart, style]}>
      <Ionicons name="heart" size={16} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  bang: { fontFamily: LevelUpFonts.ko, fontSize: 28, lineHeight: 30 },
  say: { fontFamily: LevelUpFonts.ko, fontSize: 20, lineHeight: 24 },
  burst: { width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', left: -8, top: -8 },
  drop: { position: 'absolute', top: 0, width: 2, height: 10, borderRadius: 1 },
});
