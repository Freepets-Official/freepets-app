import { useEffect } from 'react';
import { StyleSheet, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Radius } from '@/constants/theme';

/**
 * 로그인 상단의 움직이는 자연 배경 — 하늘·해·언덕 위에서 강아지·고양이·햄스터·
 * 토끼가 통통 뛰고 앵무새가 날아다닌다. 귀여운 만화 느낌.
 */
const GROUND = [
  { emoji: '🐶', left: '8%' },
  { emoji: '🐰', left: '31%' },
  { emoji: '🐹', left: '56%' },
  { emoji: '🐱', left: '79%' },
] as const;

export function LoginScene() {
  const bounce = useSharedValue(0);
  const fly = useSharedValue(0);
  const cloud = useSharedValue(0);

  useEffect(() => {
    bounce.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
    fly.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.linear }), -1, false);
    cloud.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false);
  }, [bounce, fly, cloud]);

  const parrotStyle = useAnimatedStyle(() => {
    const t = fly.value;
    return {
      transform: [
        { translateX: Math.sin(t * 2 * Math.PI) * 95 },
        { translateY: Math.sin(t * 4 * Math.PI) * 6 },
        { scaleX: Math.cos(t * 2 * Math.PI) < 0 ? -1 : 1 },
      ],
    };
  });
  const cloud1 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(cloud.value * 2 * Math.PI) * 16 }] }));
  const cloud2 = useAnimatedStyle(() => ({ transform: [{ translateX: Math.sin(cloud.value * 2 * Math.PI + 2) * 22 }] }));

  return (
    <View style={styles.scene}>
      {/* 하늘·해·언덕 (SVG) */}
      <Svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#BFE3FF" />
            <Stop offset="1" stopColor="#EAF7FF" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="360" height="180" fill="url(#sky)" />
        <Circle cx="312" cy="40" r="26" fill="#FFE38C" />
        <Circle cx="312" cy="40" r="17" fill="#FFEFB0" />
        {/* 언덕 두 겹 */}
        <Ellipse cx="120" cy="220" rx="230" ry="98" fill="#BCE7A0" />
        <Ellipse cx="290" cy="235" rx="210" ry="98" fill="#A3DA80" />
      </Svg>

      {/* 구름 (천천히 흔들) */}
      <Animated.View style={[styles.cloud, { top: 22, left: 44 }, cloud1]}>
        <View style={styles.cloudBig} />
        <View style={[styles.cloudSmall, { left: 22, top: 6 }]} />
      </Animated.View>
      <Animated.View style={[styles.cloud, { top: 46, left: 200 }, cloud2]}>
        <View style={styles.cloudBig} />
        <View style={[styles.cloudSmall, { left: 20, top: 5 }]} />
      </Animated.View>

      {/* 앵무새 — 하늘을 날며 좌우로 */}
      <Animated.Text style={[styles.parrot, parrotStyle]}>🦜</Animated.Text>

      {/* 땅 위 동물들 — 통통 */}
      {GROUND.map((g, i) => (
        <Hop key={g.emoji} bounce={bounce} index={i} style={[styles.ground, { left: g.left }]}>
          {g.emoji}
        </Hop>
      ))}
    </View>
  );
}

function Hop({
  children,
  bounce,
  index,
  style,
}: {
  children: string;
  bounce: SharedValue<number>;
  index: number;
  style: TextStyle | TextStyle[];
}) {
  const s = useAnimatedStyle(() => {
    const ph = (bounce.value + index * 0.2) % 1;
    const hop = Math.max(0, Math.sin(ph * Math.PI));
    return { transform: [{ translateY: -14 * hop }, { scale: 1 + 0.08 * hop }] };
  });
  return <Animated.Text style={[style, s]}>{children}</Animated.Text>;
}

const styles = StyleSheet.create({
  scene: {
    height: 180,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  cloud: { position: 'absolute' },
  cloudBig: { width: 40, height: 18, borderRadius: 12, backgroundColor: '#FFFFFF', opacity: 0.92 },
  cloudSmall: {
    position: 'absolute',
    width: 26,
    height: 16,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    opacity: 0.92,
  },
  parrot: { position: 'absolute', top: 40, alignSelf: 'center', fontSize: 26 },
  ground: { position: 'absolute', bottom: 20, fontSize: 32 },
});
