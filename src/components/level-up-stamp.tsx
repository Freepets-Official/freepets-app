import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { LevelUpColors as C, LevelUpFonts as F } from '@/constants/theme';

/**
 * 레벨업 순간의 「발도장 콩콩」 연출.
 *
 * 발자국이 화면 왼쪽 아래에서 걸어 올라와 도장이 쾅 찍히고, 고리와 하트가 퍼진 뒤 문구가
 * 올라온다. 막을 깔지 않고 지금 화면 위에 바로 찍는다 — 하던 일 위에 도장 하나가 얹히는
 * 느낌이어야 해서다. 그래서 글자에는 흰 외곽선을 둘러 어느 배경에서든 읽히게 했다.
 *
 * 타이밍·색·크기의 기준은 시안 `stamp-reference.html`(390×720)이다. Reanimated 4의 CSS
 * 애니메이션으로 **시안의 키프레임과 곡선을 그대로 옮겼다** — 손으로 다시 짜면 원본과
 * 비교할 길이 없어진다. 좌표도 시안 좌표계를 그대로 쓰고, 무대 전체를 도장 중심이 화면
 * 세로 44%에 오도록 옮겨 놓는다.
 */

/** 시안 무대 크기와 그 안의 도장 중심 */
const STAGE_W = 390;
const STAGE_H = 720;
const CX = 195;
const CY = 320;

/** 발자국이 지그재그로 걸어 올라오는 자리(시안의 left, top). 34px, 0.15초 간격 */
const PRINTS: [number, number][] = [
  [52, 650],
  [98, 606],
  [84, 546],
  [130, 504],
  [118, 446],
];

/** 도장이 찍힌 순간 사방으로 튀는 하트의 도착점(도장 중심 기준) */
const HEARTS: { x: number; y: number; color: string }[] = [
  { x: -140, y: -80, color: C.pink },
  { x: 140, y: -100, color: C.peach },
  { x: 150, y: 70, color: C.pink },
  { x: -150, y: 80, color: C.peach },
];

const OUT_AT_MS = 4400;
const OUT_MS = 400;
/** 움직임 줄이기 — 튀는 효과 없이 페이드 0.3초 → 2초 유지 → 페이드 0.3초 */
const REDUCED_FADE_MS = 300;
const REDUCED_HOLD_MS = 2000;
/** 도장이 바닥에 닿는 순간(쾅 시작 1.15s + 곡선이 가장 눌리는 지점). 고리·하트도 여기서 터진다 */
const IMPACT_MS = 1450;

export function LevelUpStamp({ level, onDone }: { level: number; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  // 누름과 자동 닫힘이 겹치면 두 번 불려 큐의 다음 연출까지 건너뛴다. 한 번만 넘긴다
  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  // 작은 화면에서는 무대를 줄인다. 도장 중심을 축으로 줄여야 위치가 흔들리지 않는다
  const scale = Math.min(1, width / STAGE_W, height / STAGE_H);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`레벨 ${level} 달성`);
  }, [level]);

  // 손끝으로도 알린다 — 도장이 닿는 순간에 맞춰야 「쾅」이 된다. 웹에는 햅틱이 없다
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const t = setTimeout(
      () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      reduced ? 0 : IMPACT_MS,
    );
    return () => clearTimeout(t);
  }, [reduced]);

  /**
   * 누르지 않아도 스스로 닫힌다.
   *
   * 레벨업은 리뷰를 쓰거나 판별한 **직후**에 뜬다 — 사용자가 하던 일이 있는 순간이다.
   * 닫는 것을 손에 맡기면, 축하가 아니라 길을 막는 것이 된다.
   */
  useEffect(() => {
    const total = reduced ? REDUCED_FADE_MS * 2 + REDUCED_HOLD_MS : OUT_AT_MS + OUT_MS;
    const t = setTimeout(finish, total);
    return () => clearTimeout(t);
  }, [finish, reduced]);

  const stage = {
    left: width / 2 - CX,
    top: height * 0.44 - CY,
    transform: [{ scale }],
    transformOrigin: `${CX}px ${CY}px`,
  } as const;

  return (
    <View style={styles.fill} accessibilityViewIsModal accessibilityLabel={`레벨 ${level} 달성`}>
      {/* 눌러서 먼저 닫을 수 있다. 막이 없으니 뒤 화면이 그대로 보인다 */}
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="닫기" />

      <Animated.View style={[styles.stage, stage, reduced ? reducedWhole : outWhole]} pointerEvents="none">
        {!reduced &&
          PRINTS.map(([left, top], i) => (
            <Animated.View key={i} style={[styles.print, { left, top }, printAnim(i)]}>
              <PawShape size={34} color={i % 2 === 0 ? C.peach : C.pink} />
            </Animated.View>
          ))}

        {!reduced && <Animated.View style={[styles.ring, ringAnim]} />}
        {!reduced &&
          HEARTS.map((h, i) => (
            <Animated.View key={i} style={[styles.heart, heartAnim(h.x, h.y)]}>
              <Svg viewBox="0 0 24 24" width={22} height={22}>
                <Path d="M12 21s-7-4.5-9.5-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" fill={h.color} />
              </Svg>
            </Animated.View>
          ))}

        {/* 쾅(바깥)과 흔들림(안쪽)을 한 뷰에 겹치면 둘 다 transform이라 뒤의 것이 앞을 덮는다.
            나눠 두고, 안쪽은 쾅이 끝난 -8° 위에 더하는 상대값으로 흔든다 */}
        <Animated.View style={[styles.stampPos, reduced ? rotated : slamAnim]}>
          <Animated.View style={reduced ? null : wiggleAnim}>
            <Stamp level={level} />
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.caption, reduced ? null : captionAnim]}>
          <OutlinedLine text="콩! 레벨 업!" size={30} color={C.title} y={30} />
          <OutlinedLine text="새 발도장이 찍혔어요" size={17} color={C.subtitle} y={20} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** 도장 — 분홍 테두리 원판에 원형 LEVEL UP, 점선, 발바닥, Lv.N */
function Stamp({ level }: { level: number }) {
  return (
    <View style={styles.stamp}>
      <Svg viewBox="0 0 206 206" width={206} height={206} style={StyleSheet.absoluteFill}>
        <Defs>
          <Path id="lvArc" d="M103,103 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
        </Defs>
        <Circle cx={103} cy={103} r={64} fill="none" stroke={C.dotted} strokeWidth={2.5} strokeDasharray="3 6" strokeLinecap="round" />
        <SvgText fontFamily={F.latin} fontWeight="700" fontSize={17} letterSpacing={4} fill={C.pink}>
          <TextPath href="#lvArc" startOffset="1%">
            LEVEL UP · LEVEL UP · LEVEL UP ·
          </TextPath>
        </SvgText>
      </Svg>
      <View style={styles.stampCenter}>
        <PawShape size={38} color={C.peach} />
        {/* 도장은 크기가 정해진 그림이라 글자 크기 설정을 따르지 않는다 */}
        <Text style={styles.level} allowFontScaling={false}>
          Lv.{level}
        </Text>
      </View>
    </View>
  );
}

/**
 * 흰 외곽선을 두른 한 줄.
 *
 * RN에는 text-stroke가 없다. SVG로 같은 글자를 두 번 — 아래에 굵은 흰 획, 위에 채움 —
 * 그려 시안의 `paint-order: stroke fill`을 흉내 낸다.
 */
function OutlinedLine({ text, size, color, y }: { text: string; size: number; color: string; y: number }) {
  const h = Math.ceil(size * 1.25);
  const common = { x: STAGE_W / 2, y, fontFamily: F.ko, fontSize: size, textAnchor: 'middle' as const };
  return (
    <Svg width={STAGE_W} height={h}>
      <SvgText {...common} fill={C.outline} stroke={C.outline} strokeWidth={6} strokeLinejoin="round">
        {text}
      </SvgText>
      <SvgText {...common} fill={color}>
        {text}
      </SvgText>
    </Svg>
  );
}

/** 시안의 발바닥 — 큰 볼 하나와 발가락 넷 */
function PawShape({ size, color }: { size: number; color: string }) {
  return (
    <Svg viewBox="0 0 64 64" width={size} height={size}>
      <Ellipse cx={32} cy={43} rx={15} ry={12.5} fill={color} />
      <Ellipse cx={12.5} cy={26} rx={6.5} ry={8.5} fill={color} transform="rotate(-18 12.5 26)" />
      <Ellipse cx={24.5} cy={14} rx={6.5} ry={8.5} fill={color} transform="rotate(-6 24.5 14)" />
      <Ellipse cx={39.5} cy={14} rx={6.5} ry={8.5} fill={color} transform="rotate(6 39.5 14)" />
      <Ellipse cx={51.5} cy={26} rx={6.5} ry={8.5} fill={color} transform="rotate(18 51.5 26)" />
    </Svg>
  );
}

/* ── 애니메이션 — 시안 CSS의 키프레임을 그대로 옮긴 것 ─────────────────────── */

const printAnim = (i: number) =>
  ({
    animationName: {
      '0%': { opacity: 0, transform: [{ rotate: '22deg' }, { scale: 1.6 }] },
      '12%': { opacity: 1, transform: [{ rotate: '22deg' }, { scale: 1 }] },
      '70%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ rotate: '22deg' }, { scale: 1 }] },
    },
    animationDuration: '1.9s',
    animationTimingFunction: 'ease-out',
    animationDelay: `${i * 0.15}s`,
    animationFillMode: 'both',
  }) as const;

const slamAnim = {
  animationName: {
    '0%': { opacity: 0, transform: [{ scale: 2.6 }, { rotate: '6deg' }] },
    '75%': { opacity: 1, transform: [{ scale: 0.9 }, { rotate: '-10deg' }] },
    '100%': { opacity: 1, transform: [{ scale: 1 }, { rotate: '-8deg' }] },
  },
  animationDuration: '0.45s',
  animationTimingFunction: cubicBezier(0.2, 0.9, 0.3, 1.2),
  animationDelay: '1.15s',
  animationFillMode: 'both',
} as const;

/** 시안은 -8° ↔ -3°(×1.03). 바깥이 이미 -8°라 여기서는 0° ↔ +5° */
const wiggleAnim = {
  animationName: {
    '0%': { transform: [{ rotate: '0deg' }, { scale: 1 }] },
    '50%': { transform: [{ rotate: '5deg' }, { scale: 1.03 }] },
    '100%': { transform: [{ rotate: '0deg' }, { scale: 1 }] },
  },
  animationDuration: '1.6s',
  animationTimingFunction: 'ease-in-out',
  animationDelay: '2.2s',
  animationIterationCount: 'infinite',
} as const;

const ringAnim = {
  animationName: {
    '0%': { opacity: 0.9, transform: [{ scale: 0.9 }] },
    '100%': { opacity: 0, transform: [{ scale: 1.6 }] },
  },
  animationDuration: '0.7s',
  animationTimingFunction: 'ease-out',
  animationDelay: '1.45s',
  animationFillMode: 'both',
} as const;

const heartAnim = (x: number, y: number) =>
  ({
    animationName: {
      '0%': { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0 }] },
      '60%': { opacity: 1 },
      '100%': { opacity: 0, transform: [{ translateX: x }, { translateY: y }, { scale: 1 }] },
    },
    animationDuration: '0.8s',
    animationTimingFunction: cubicBezier(0.2, 1.4, 0.4, 1),
    animationDelay: '1.45s',
    animationFillMode: 'both',
  }) as const;

const captionAnim = {
  animationName: {
    '0%': { opacity: 0, transform: [{ translateY: 16 }] },
    '100%': { opacity: 1, transform: [{ translateY: 0 }] },
  },
  animationDuration: '0.5s',
  animationTimingFunction: 'ease-out',
  animationDelay: '1.8s',
  animationFillMode: 'both',
} as const;

const outWhole = {
  animationName: {
    '0%': { opacity: 1, transform: [{ translateY: 0 }] },
    '100%': { opacity: 0, transform: [{ translateY: -20 }] },
  },
  animationDuration: `${OUT_MS}ms`,
  animationTimingFunction: 'ease-in',
  animationDelay: `${OUT_AT_MS}ms`,
  animationFillMode: 'both',
} as const;

const reducedWhole = {
  animationName: {
    '0%': { opacity: 0 },
    [`${(REDUCED_FADE_MS / (REDUCED_FADE_MS * 2 + REDUCED_HOLD_MS)) * 100}%`]: { opacity: 1 },
    [`${((REDUCED_FADE_MS + REDUCED_HOLD_MS) / (REDUCED_FADE_MS * 2 + REDUCED_HOLD_MS)) * 100}%`]: { opacity: 1 },
    '100%': { opacity: 0 },
  },
  animationDuration: `${REDUCED_FADE_MS * 2 + REDUCED_HOLD_MS}ms`,
  animationTimingFunction: 'linear',
  animationFillMode: 'both',
} as const;

/** 움직임 줄이기에서도 도장은 찍힌 모양(-8°)으로 둔다 */
const rotated = { transform: [{ rotate: '-8deg' }] } as const;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 400 },
  stage: { position: 'absolute', width: STAGE_W, height: STAGE_H },
  print: { position: 'absolute', width: 34, height: 34 },
  ring: {
    position: 'absolute',
    left: CX - 115,
    top: CY - 115,
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 4,
    borderColor: C.pink,
  },
  heart: { position: 'absolute', left: CX - 11, top: CY - 11, width: 22, height: 22 },
  stampPos: { position: 'absolute', left: CX - 110, top: CY - 110, width: 220, height: 220 },
  stamp: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 7,
    borderColor: C.pink,
    backgroundColor: C.stampPaper,
    boxShadow: `0 10px 30px ${C.shadow}`,
  },
  stampCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  level: { fontFamily: F.latin, fontSize: 50, lineHeight: 54, color: C.stampInk, includeFontPadding: false },
  // 도장 아래 40px
  caption: { position: 'absolute', left: 0, right: 0, top: CY + 110 + 40, alignItems: 'center', gap: 6 },
});
